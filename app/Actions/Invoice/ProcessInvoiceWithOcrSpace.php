<?php

namespace App\Actions\Invoice;

use App\Enums\InvoiceStatus;
use App\Models\InvoiceDocument;
use Carbon\Carbon;
use Codesmiths\LaravelOcrSpace\Facades\OcrSpace;
use Codesmiths\LaravelOcrSpace\OcrSpaceOptions;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Process a single invoice document using the laravel-ocr-space integration.
 */
class ProcessInvoiceWithOcrSpace
{
    /**
     * Run OCR and extraction for the provided invoice document.
     *
     * This method is intentionally conservative: it only updates fields when it
     * can confidently extract them, and otherwise leaves existing values intact.
     *
     * @param  \App\Models\InvoiceDocument  $document
     * @return void
     */
    public function handle(InvoiceDocument $document): void
    {
        if (! $document->file_path || ! Storage::exists($document->file_path)) {
            throw new \RuntimeException('Invoice file not found for OCR processing.');
        }

        $absolutePath = Storage::path($document->file_path);

        // Cache key is stable per file path + a simple version so we can bust the cache
        // when our extraction strategy changes.
        $cacheKey = 'invoice_ocr_raw:v1:'.sha1($document->file_path);

        $rawText = Cache::remember($cacheKey, now()->addDay(), function () use ($absolutePath) {
            // Build OCR.Space options. You can tune language/engine later if needed.
            $options = OcrSpaceOptions::make()
                ->isTable(true);

            $response = OcrSpace::parseImageFile($absolutePath, $options);

            if ($response->hasError() || ! $response->hasParsedResults()) {
                throw new \RuntimeException($response->getErrorMessage() ?? 'OCR failed');
            }

            $parsedResults = $response->getParsedResults();
            $first = $parsedResults->first();
            $raw = $first?->getParsedText() ?? '';

            if ($raw === '') {
                throw new \RuntimeException('OCR returned empty text for invoice.');
            }

            return $raw;
        });

        // Keep a line-wise representation for some heuristics (e.g. tax/subtotal).
        $textWithNewlines = Str::of($rawText)->replace(["\r\n", "\r"], "\n")->toString();
        $lines = preg_split("/\n+/", $textWithNewlines) ?: [];

        // Also build a fully normalized text blob for pattern-based extraction of
        // the main business fields (invoice number, date, total).
        $normalizedText = $this->normalizeOcrText($rawText);

        $invoiceNumber = $this->extractInvoiceNumberFromText($normalizedText);
        $invoiceDateString = $this->extractInvoiceDateFromText($normalizedText);
        $totalAmount = $this->extractTotalAmountFromText($normalizedText);

        // Use line-based heuristics for subtotal and tax as they often depend on
        // relative position in the totals block.
        $subtotalAmount = $this->extractSubtotalAmount($lines);
        $taxAmount = $this->extractTaxAmount($lines, $totalAmount, $subtotalAmount);

        if ($invoiceNumber !== null) {
            $document->invoice_number = $invoiceNumber;
        }

        if ($invoiceDateString !== null) {
            $document->invoice_date = $invoiceDateString;
        }

        if ($totalAmount !== null) {
            $document->total_amount = $totalAmount;
        }

        if ($taxAmount !== null) {
            $document->tax_amount = $taxAmount;
        }

        $document->date_processed = now();
        $document->source = $document->source ?? 'ocr';
        $document->status = InvoiceStatus::Processed;
        $document->save();
    }

    private function extractInvoiceNumberFromText(string $text): ?string
    {
        $text = $this->normalizeOcrText($text);

        $patterns = [
            // Strong signals – require an explicit label after "invoice" so we don't
            // accidentally match heading lines like "INVOICE 1912 Harvest Lane".
            // Capture the full trailing token (including embedded spaces) and
            // let the normalizer clean it up.
            '/invoice\s+(no|number|#|id|ref)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/\s]{2,})/i',
            '/tax\s*invoice\s+(no|number)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/\s]{2,})/i',

            // Medium signals
            '/\binv\s*(no|#)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/\s]{2,})/i',
            '/\bbill\s*(no|#)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/\s]{2,})/i',

            // Fallback (ref-style)
            '/\breference\s*(no|#)\s*[:\-]?\s*([a-z0-9][a-z0-9\-\/\s]{2,})/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $value = strtoupper($matches[2]);

                return $this->isLikelyInvoiceNumber($value) ? $value : null;
            }
        }

        return null;
    }

    /**
     * Normalize a candidate invoice number token the way a human would read it:
     * - trim whitespace
     * - strip leading/trailing punctuation and label leftovers
     * - upper-case
     *
     * Returns null if the token becomes empty.
     */
    private function normalizeInvoiceNumberCandidate(string $raw): ?string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }

        // Remove common label residue / separators around the value.
        $raw = preg_replace('/^(no\.?|number|#)\s*/i', '', $raw) ?? $raw;

        // Strip common non-ID separators that may have bled into the token, and
        // collapse embedded spaces (e.g. "CCC 1-4632921" -> "CCC1-4632921").
        $raw = str_replace([':', '/', '#', ' '], '', $raw);

        // Strip wrapping punctuation like ":" "#" "(" ")" and trailing punctuation.
        $raw = preg_replace('/^[^\pL\pN]+/u', '', $raw) ?? $raw;
        $raw = preg_replace('/[^\pL\pN]+$/u', '', $raw) ?? $raw;

        $raw = strtoupper($raw);

        return $raw === '' ? null : $raw;
    }

    /**
     * Conservative checks to avoid false positives while still supporting diverse formats.
     */
    private function isLikelyInvoiceNumber(string $value): bool
    {
        // Must contain at least one digit (most invoice numbers do).
        if (! preg_match('/\d/', $value)) {
            return false;
        }

        // And at least one letter – avoid treating plain numeric customer/phone IDs as invoice numbers.
        if (! preg_match('/[A-Z]/', $value)) {
            return false;
        }

        // Avoid phone-like long digit runs (common in headers).
        if (preg_match('/^\d{8,}$/', $value)) {
            return false;
        }

        // Avoid matching currency codes or totals accidentally.
        if (preg_match('/^(USD|EUR|GBP|ZAR|NGN|KES|GHS|AED|SAR)$/', $value)) {
            return false;
        }

        // Reasonable length bounds.
        $len = strlen($value);
        if ($len < 3 || $len > 32) {
            return false;
        }

        // Human invoice numbers tend to start/end with alnum; allow -, /, . in the middle only.
        if (! preg_match('/^[A-Z0-9](?:[A-Z0-9\-\/\.]*[A-Z0-9])$/', $value)) {
            return false;
        }

        return true;
    }

    private function extractInvoiceDateFromText(string $text): ?string
    {
        $text = $this->normalizeOcrText($text);

        $datePatterns = [
            // 2025-01-20 or 2025.01.20
            '/(\d{4}[-\.]\d{2}[-\.]\d{2})/',
            // 20/01/2025 or 20-01-2025 or 20.01.2025 and OCR-glitched 20.012025
            '/(\d{2}[\/\-\.]\d{2}[\/\-\.]?\d{4})/',
        ];

        $dateLabelPatterns = [
            // ISO & common variants with explicit labels
            '/(invoice\s*date|date)\s*[:\-]?\s*(\d{4}[-\/\.]\d{2}[-\/\.]\d{2})/i',
            '/(invoice\s*date|date)\s*[:\-]?\s*(\d{2}[-\/\.]\d{2}[-\/\.]\d{4})/i',
            '/(invoice\s*date|date)\s*[:\-]?\s*(\d{2}\s*[a-z]{3,}\s*\d{4})/i',
            '/(invoice\s*date|date)\s*[:\-]?\s*([a-z]{3,}\s*\d{2},?\s*\d{4})/i',
        ];

        foreach ($dateLabelPatterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $raw = trim($matches[2]);

                // Repair common OCR glitch like "04.022022" -> "04.02.2022"
                if (preg_match('/^(\d{2}[\.\/\-])(\d{2})(\d{4})$/', $raw, $m)) {
                    $raw = $m[1].$m[2].'.'.$m[3];
                }

                try {
                    $dt = new Carbon($raw);

                    return $dt->format('Y-m-d');
                } catch (\Throwable) {
                    // Try next pattern.
                }
            }
        }

        // Fallback: any date-looking string
        foreach ($datePatterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $raw = trim($matches[1]);

                // Repair OCR glitch if needed.
                if (preg_match('/^(\d{2}[\.\/\-])(\d{2})(\d{4})$/', $raw, $m)) {
                    $raw = $m[1].$m[2].'.'.$m[3];
                }

                try {
                    $dt = new Carbon($raw);

                    return $dt->format('Y-m-d');
                } catch (\Throwable) {
                    // try next pattern
                }
            }
        }

        return null;
    }

    private function extractTotalAmountFromText(string $text): ?float
    {
        $text = $this->normalizeOcrText($text);

        $candidates = [];

        $patterns = [
            // Strong
            '/(grand\s*total|invoice\s*total|total\s*amount|amount\s*due|total)\s*[:\-]?\s*([a-z]{0,3}\s?\$?\s?[\d,.]+)/i',

            // Medium
            '/(balance\s*due|amount\s*payable)\s*[:\-]?\s*([a-z]{0,3}\s?\$?\s?[\d,.]+)/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    $amount = preg_replace('/[^\d\.,]/', '', $match[2]);
                    $amount = (float) str_replace(',', '', $amount);

                    if ($amount > 0) {
                        $candidates[] = $amount;
                    }
                }
            }
        }

        // Fallback: largest currency-looking number.
        if ($candidates === []) {
            if (preg_match_all('/\$?\s?[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})/', $text, $matches)) {
                foreach ($matches[0] as $raw) {
                    $amount = (float) str_replace(',', '', preg_replace('/[^\d\.,]/', '', $raw));
                    if ($amount > 0) {
                        $candidates[] = $amount;
                    }
                }
            }
        }

        return $candidates !== [] ? max($candidates) : null;
    }

    private function extractInvoiceDate(array $lines): ?Carbon
    {
        $datePatterns = [
            // 2025-01-20
            '/(\d{4}-\d{2}-\d{2})/',
            // 20/01/2025 or 20-01-2025
            '/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/',
        ];

        $candidates = [];

        foreach ($lines as $index => $line) {
            $lower = Str::lower($line);

            $hasLabel = Str::contains($lower, [
                'invoice date',
                'date of invoice',
                'issue date',
                'issued on',
                'billing date',
            ]);

            foreach ($datePatterns as $pattern) {
                if (preg_match($pattern, $line, $matches) === 1) {
                    $raw = trim($matches[1]);

                    foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'] as $format) {
                        try {
                            $dt = Carbon::createFromFormat($format, $raw);
                            if ($dt === false) {
                                continue;
                            }

                            $score = 50;
                            if ($hasLabel) {
                                $score += 40;
                            }

                            // Dates near the top of the document are usually header metadata.
                            $score += max(0, 30 - $index);

                            $candidates[] = [
                                'value' => $dt,
                                'score' => $score,
                            ];
                        } catch (\Throwable) {
                            // Try next format.
                        }
                    }
                }
            }

            // If we saw a date label but no inline date, check the immediate next line –
            // common in stacked header layouts.
            if ($hasLabel && ! Str::contains($line, ['0','1','2','3','4','5','6','7','8','9'])) {
                $nextIndex = $index + 1;
                if (isset($lines[$nextIndex])) {
                    $nextLine = $lines[$nextIndex];
                    foreach ($datePatterns as $pattern) {
                        if (preg_match($pattern, $nextLine, $matches) === 1) {
                            $raw = trim($matches[1]);

                            foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'] as $format) {
                                try {
                                    $dt = Carbon::createFromFormat($format, $raw);
                                    if ($dt === false) {
                                        continue;
                                    }

                                    $score = 60;
                                    $score += max(0, 25 - $index);

                                    $candidates[] = [
                                        'value' => $dt,
                                        'score' => $score,
                                    ];
                                } catch (\Throwable) {
                                    // continue
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback: look for the first plausible date in the header region.
        if ($candidates === []) {
            $headerLines = array_slice($lines, 0, 20);

            foreach ($headerLines as $index => $line) {
                foreach ($datePatterns as $pattern) {
                    if (preg_match($pattern, $line, $matches) === 1) {
                        $raw = trim($matches[1]);

                        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'] as $format) {
                            try {
                                $dt = Carbon::createFromFormat($format, $raw);
                                if ($dt === false) {
                                    continue;
                                }

                                $score = 40 + max(0, 20 - $index);

                                $candidates[] = [
                                    'value' => $dt,
                                    'score' => $score,
                                ];
                            } catch (\Throwable) {
                                // continue
                            }
                        }
                    }
                }
            }
        }

        if ($candidates === []) {
            return null;
        }

        usort($candidates, static fn ($a, $b) => $b['score'] <=> $a['score']);

        /** @var \Carbon\Carbon $best */
        $best = $candidates[0]['value'];

        return $best;
    }

    /**
     * Detect the grand total amount (not tax, not line totals).
     *
     * Strategy:
     * - Scan from the bottom up, looking for strong "total" labels.
     * - Avoid "Tax", "VAT", "Subtotal".
     * - Prefer lines with "invoice total", "total amount", "amount due".
     */
    private function extractTotalAmount(array $lines): ?float
    {
        // Fast path: scan from top to bottom for strong total labels and return
        // the first amount that looks like a grand total.
        $totalLabelTokens = [
            'grand total',
            'total amount',
            'amount due',
            'total due',
            'invoice total',
            'balance due',
            'amount payable',
            'total payable',
            'total:',
            'total ',
            'total\t',
        ];

        foreach ($lines as $line) {
            $lower = Str::lower($line);

            if (! Str::contains($lower, $totalLabelTokens)) {
                continue;
            }

            if (Str::contains($lower, ['tax', 'vat', 'gst', 'subtotal'])) {
                continue;
            }

            if (preg_match('/([0-9]+[0-9\.,]*)/', $line, $matches) === 1) {
                $amount = $this->normalizeAmount($matches[1]);
                if ($amount !== null) {
                    return $amount;
                }
            }
        }

        $candidates = [];

        // We scan bottom-up because totals often live near the footer.
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            $line = $lines[$i];
            $lower = Str::lower($line);

            if (! Str::contains($lower, 'total') && ! Str::contains($lower, 'amount due')) {
                continue;
            }

            if (Str::contains($lower, ['tax', 'vat', 'subtotal'])) {
                continue;
            }

            if (preg_match('/([0-9]+[0-9\.,]*)/', $line, $matches) === 1) {
                $amount = $this->normalizeAmount($matches[1]);
                if ($amount === null) {
                    continue;
                }

                $score = 50;

                if (Str::contains($lower, ['invoice total', 'total amount', 'grand total', 'total due', 'amount due'])) {
                    $score += 40;
                } elseif (preg_match('/^total\b/i', ltrim($line))) {
                    $score += 25;
                }

                // Lines closer to the bottom get a slight boost.
                $score += (int) (count($lines) - $i) / 5;

                $candidates[] = [
                    'value' => $amount,
                    'score' => $score,
                ];
            }
        }

        if ($candidates === []) {
            // Fallback: pick the largest plausible amount in the document, biased
            // away from obvious line items (qty/unit/price rows).
            $amountCandidates = [];

            foreach ($lines as $index => $line) {
                $lower = Str::lower($line);

                // Skip likely line-item rows.
                if (Str::contains($lower, ['qty', 'quantity', 'unit price', 'rate', 'line total'])) {
                    continue;
                }

                if (! preg_match_all('/[0-9]+[0-9\.,]*/', $line, $matches)) {
                    continue;
                }

                foreach ($matches[0] as $rawAmount) {
                    $amount = $this->normalizeAmount($rawAmount);
                    if ($amount === null) {
                        continue;
                    }

                    // Ignore tiny amounts (< 1) and absurdly large ones.
                    if ($amount < 1 || $amount > 100000000) {
                        continue;
                    }

                    $score = 10;
                    $score += (int) (count($lines) - $index) / 5;

                    $amountCandidates[] = [
                        'value' => $amount,
                        'score' => $score,
                    ];
                }
            }

            if ($amountCandidates === []) {
                return null;
            }

            usort($amountCandidates, static fn ($a, $b) => $b['value'] <=> $a['value']);

            // Use the largest amount but keep conservative scoring.
            return $amountCandidates[0]['value'];
        }

        usort($candidates, static fn ($a, $b) => $b['score'] <=> $a['score']);

        return $candidates[0]['value'];
    }

    /**
     * Attempt to find a subtotal amount (used as a base for tax math when only a % is present).
     * This is not persisted to the DB; it's only used to increase accuracy for tax detection.
     */
    private function extractSubtotalAmount(array $lines): ?float
    {
        $candidates = [];

        // Scan bottom-up: subtotal tends to appear in the totals block.
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            $line = $lines[$i];
            $lower = Str::lower($line);

            if (! Str::contains($lower, ['subtotal', 'sub total', 'sub-total'])) {
                continue;
            }

            // Avoid lines like "Subtotal (before tax)" still okay; avoid "total".
            if (Str::contains($lower, ['total due', 'grand total', 'invoice total'])) {
                continue;
            }

            if (preg_match('/([0-9]+[0-9\.,]*)/', $line, $matches) === 1) {
                $amount = $this->normalizeAmount($matches[1]);
                if ($amount === null) {
                    continue;
                }

                $score = 60;
                $score += (int) (count($lines) - $i) / 5;

                $candidates[] = [
                    'value' => $amount,
                    'score' => $score,
                ];
            }
        }

        if ($candidates === []) {
            return null;
        }

        usort($candidates, static fn ($a, $b) => $b['score'] <=> $a['score']);

        return $candidates[0]['value'];
    }

    /**
     * Detect Tax / VAT amount.
     *
     * Strategy:
     * - Look for lines explicitly mentioning "Tax", "VAT", "GST".
     * - Prefer lines that also include a rate or percent.
     */
    private function extractTaxAmount(array $lines, ?float $totalAmount, ?float $subtotalAmount): ?float
    {
        foreach ($lines as $index => $line) {
            $lower = Str::lower($line);
            if (! Str::contains($lower, ['tax', 'vat', 'gst'])) {
                continue;
            }

            $rate = $this->extractPercentRate($line);

            // 1) Prefer explicit tax amount if present.
            $amount = null;
            if (preg_match_all('/[0-9]+[0-9\.,]*/', $line, $matches) && isset($matches[0]) && $matches[0] !== []) {
                // Heuristic: On tax lines like "Sales Tax 6.25% 9.06", the last
                // number is usually the monetary amount, earlier ones are rates.
                $rawAmount = end($matches[0]);
                $amount = $this->normalizeAmount($rawAmount);
            }

            // 2) If we only have a % rate, compute tax.
            if ($amount === null && $rate !== null) {
                // Prefer computing from subtotal if we found one.
                if ($subtotalAmount !== null) {
                    $amount = $subtotalAmount * $rate;
                } elseif ($totalAmount !== null) {
                    // Common human convention: "Total" includes tax.
                    // If total includes tax, tax = total * rate / (1 + rate).
                    $amount = ($totalAmount * $rate) / (1 + $rate);
                }
            }

            if ($amount === null) {
                continue;
            }

            // Return the first plausible tax amount we find.
            return $amount;
        }

        return null;
    }

    /**
     * Normalize OCR text into a consistent, lowercase, whitespace-collapsed form
     * and fix a few common OCR glitches to improve matching.
     */
    private function normalizeOcrText(string $text): string
    {
        $text = Str::lower($text);

        $replacements = [
            'invo1ce' => 'invoice',
            'inv0ice' => 'invoice',
            'invoíce' => 'invoice',
            't0tal'   => 'total',
            'am0unt'  => 'amount',
            '—'       => '-',
            '–'       => '-',
            '\''      => '',
            '|'       => ' ',
        ];

        $text = str_replace(array_keys($replacements), array_values($replacements), $text);

        // Normalize all whitespace (spaces, tabs, newlines) to single spaces.
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    /**
     * Extract a percent rate from a line, as a decimal (e.g. "20%" => 0.20).
     */
    private function extractPercentRate(string $line): ?float
    {
        if (preg_match('/(\d{1,2}(?:\.\d{1,2})?)\s*%/i', $line, $matches) !== 1) {
            return null;
        }

        $pct = (float) $matches[1];
        if ($pct <= 0 || $pct > 50) {
            // Guardrails: tax rates above 50% are almost certainly wrong for invoices.
            return null;
        }

        return $pct / 100;
    }

    private function normalizeAmount(string $raw): ?float
    {
        $raw = trim($raw);
        // Remove currency symbols and spaces.
        $raw = preg_replace('/[^\d,\.]/', '', $raw) ?? '';

        // If there are both comma and dot, assume comma is thousands.
        if (Str::contains($raw, ',') && Str::contains($raw, '.')) {
            $raw = str_replace(',', '', $raw);
        } elseif (Str::contains($raw, ',') && ! Str::contains($raw, '.')) {
            // European style "1.234,56" or "123,45" – normalize comma to dot.
            $raw = str_replace('.', '', $raw);
            $raw = str_replace(',', '.', $raw);
        }

        if ($raw === '') {
            return null;
        }

        return (float) $raw;
    }
}
