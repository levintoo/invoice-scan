<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Models\InvoiceDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InvoiceUploadController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'mimetypes:application/pdf,image/jpeg,image/png',
                'max:2048', // 2MB
            ],
        ]);

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $validated['file'];

        // Persist the raw file to storage.
        $storedPath = $file->store('invoice-uploads');

        // Create an invoice document record. Most extracted fields
        // will be filled in asynchronously once OCR completes.
        $document = InvoiceDocument::create([
            'filename'       => $file->getClientOriginalName(),
            'file_path'      => $storedPath,
            'status'         => InvoiceStatus::Processing,
            'source'         => null,
            'date_processed' => null,
            'invoice_number' => 'PENDING', // real value will be set after OCR
            'invoice_date'   => null,
            'total_amount'   => null,
            'tax_amount'     => null,
        ]);

        // TODO: Dispatch background job that uses ProcessInvoiceWithOcrSpace
        // to run OCR and update this record with extracted fields.

        return redirect()->route('invoice.show', ['id' => $document->getKey()]);
    }
}

