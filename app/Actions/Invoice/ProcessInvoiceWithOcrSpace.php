<?php

namespace App\Actions\Invoice;

use Illuminate\Http\UploadedFile;

/**
 * Process a single invoice document using the laravel-ocr-space integration.
 */
class ProcessInvoiceWithOcrSpace
{
    /**
     * Run OCR and extraction for the provided invoice file.
     *
     * @param  \Illuminate\Http\UploadedFile  $file
     * @return void
     */
    public function handle(UploadedFile $file): void
    {
        // TODO: Implement invoice OCR using laravel-ocr-space.
        // - Call the OCR service
        // - Persist raw OCR output if needed
        // - Normalize into structured invoice fields
        // - Dispatch any follow-up jobs/events
    }
}
