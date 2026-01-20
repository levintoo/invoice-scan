<?php

namespace App\Actions\Invoice;

use App\Enums\InvoiceStatus;
use App\Models\InvoiceDocument;
use Carbon\Carbon;
use Codesmiths\LaravelOcrSpace\Facades\OcrSpace;
use Codesmiths\LaravelOcrSpace\OcrSpaceOptions;
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

        // Build OCR.Space options. You can tune language/engine later if needed.
        $options = OcrSpaceOptions::make()
            ->isTable(true);

        $response = OcrSpace::parseImageFile($absolutePath, $options);

        if ($response->hasError() || ! $response->hasParsedResults()) {
            throw new \RuntimeException($response->getErrorMessage() ?? 'OCR failed');
        }

        $parsedResults = $response->getParsedResults();
        $first = $parsedResults->first();
        $rawText = $first?->getParsedText() ?? '';

        if ($rawText === '') {
            throw new \RuntimeException('OCR returned empty text for invoice.');
        }

        $text = Str::of($rawText)->replace(["\r\n", "\r"], "\n")->toString();

        $invoiceNumber = $this->extractInvoiceNumber($text);
        $invoiceDate = $this->extractInvoiceDate($text);
        $totalAmount = $this->extractTotalAmount($text);
        $taxAmount = $this->extractTaxAmount($text);

        if ($invoiceNumber !== null) {
            $document->invoice_number = $invoiceNumber;
        }

        if ($invoiceDate !== null) {
            $document->invoice_date = $invoiceDate;
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

    private function extractInvoiceNumber(string $text): ?string
    {
        $patterns = [
            '/invoice\s+number[:\s]+([A-Z0-9\-\/]+)/i',
            '/invoice\s+no\.?[:\s]+([A-Z0-9\-\/]+)/i',
            '/inv\s*#[:\s]+([A-Z0-9\-\/]+)/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches) === 1) {
                return Str::upper(trim($matches[1]));
            }
        }

        return null;
    }

    private function extractInvoiceDate(string $text): ?Carbon
    {
        // Common date formats: 2025-01-20, 20/01/2025, 01-20-2025, 20 Jan 2025.
        $patterns = [
            '/invoice\s+date[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i',
            '/invoice\s+date[:\s]+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i',
            '/invoice\s+date[:\s]+([0-9]{2}-[0-9]{2}-[0-9]{4})/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches) === 1) {
                $raw = trim($matches[1]);

                foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y'] as $format) {
                    try {
                        $dt = Carbon::createFromFormat($format, $raw);
                        if ($dt !== false) {
                            return $dt;
                        }
                    } catch (\Throwable) {
                        // Try next format.
                    }
                }
            }
        }

        return null;
    }

    private function extractTotalAmount(string $text): ?float
    {
        // Look for lines containing "Total" but not "Tax" or "VAT".
        $lines = preg_split("/\n+/", $text) ?: [];

        foreach ($lines as $line) {
            $lineLower = Str::lower($line);
            if (! Str::contains($lineLower, 'total')) {
                continue;
            }

            if (Str::contains($lineLower, ['tax', 'vat'])) {
                continue;
            }

            if (preg_match('/([0-9]+[0-9\.,]*)/', $line, $matches) === 1) {
                return $this->normalizeAmount($matches[1]);
            }
        }

        return null;
    }

    private function extractTaxAmount(string $text): ?float
    {
        $lines = preg_split("/\n+/", $text) ?: [];

        foreach ($lines as $line) {
            $lineLower = Str::lower($line);
            if (! Str::contains($lineLower, ['tax', 'vat'])) {
                continue;
            }

            if (preg_match('/([0-9]+[0-9\.,]*)/', $line, $matches) === 1) {
                return $this->normalizeAmount($matches[1]);
            }
        }

        return null;
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
