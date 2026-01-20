<?php

namespace App\Http\Controllers;

use App\Models\InvoiceDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceShowController extends Controller
{
    public function show(Request $request, string $id): Response
    {
        /** @var InvoiceDocument $doc */
        $doc = InvoiceDocument::query()->findOrFail($id);

        return Inertia::render('invoice/show', [
            'invoice' => [
                'id' => (string) $doc->getKey(),
                'filename' => $doc->filename,
                'filePath' => $doc->file_path,
                'fileUrl' => $doc->file_path ? Storage::temporaryUrl($doc->file_path, now()->addMinutes(30)) : null,
                'status' => $doc->status?->value,
                'source' => $doc->source,
                'dateProcessed' => optional($doc->date_processed)?->toIso8601String(),
                'invoiceNumber' => $doc->invoice_number,
                'invoiceDate' => optional($doc->invoice_date)?->format('Y-m-d'),
                'totalAmount' => $doc->total_amount,
                'taxAmount' => $doc->tax_amount,
            ],
        ]);
    }
}

