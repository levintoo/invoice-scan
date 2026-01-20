<?php

namespace App\Http\Controllers;

use App\Models\InvoiceDocument;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceHistoryController extends Controller
{
    /**
     * Display the latest processed invoices.
     */
    public function index(Request $request): Response
    {
        $invoices = InvoiceDocument::orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (InvoiceDocument $doc): array {
                return [
                    'id' => (string) $doc->getKey(),
                    'filename' => $doc->filename,
                    'dateProcessed' => optional($doc->date_processed)?->format('Y-m-d H:i') ?? '—',
                    'source' => $doc->source === 'ocr' ? 'ocr' : 'text',
                    'detectedTotal' => $doc->total_amount !== null
                        ? '$'.number_format((float) $doc->total_amount, 2)
                        : '—',
                    'status' => $doc->status?->value ?? 'processing',
                ];
            });

        return Inertia::render('history', [
            'invoices' => $invoices,
        ]);
    }
}

