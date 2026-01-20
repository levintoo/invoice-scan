<?php

namespace App\Jobs;

use App\Actions\Invoice\ProcessInvoiceWithOcrSpace;
use App\Enums\InvoiceStatus;
use App\Models\InvoiceDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ProcessInvoiceDocument implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param  string  $invoiceDocumentId  ULID
     */
    public function __construct(public string $invoiceDocumentId)
    {
    }

    public function handle(ProcessInvoiceWithOcrSpace $processor): void
    {
        /** @var InvoiceDocument|null $doc */
        $doc = InvoiceDocument::query()->find($this->invoiceDocumentId);
        if (! $doc) {
            return;
        }

        $doc->status = InvoiceStatus::Processing;
        $doc->save();

        try {
            // If you store locally, this path should exist.
            // When you implement the OCR action, you'll likely want to read the file
            // from storage and pass the UploadedFile / file contents as needed.
            if ($doc->file_path && Storage::exists($doc->file_path)) {
                // TODO: Replace this with actual OCR processing output.
                // $processor->handle(...);
            }

            // Temporary demo behavior: mark as processed.
            $doc->status = InvoiceStatus::Processed;
            $doc->date_processed = now();
            $doc->source = $doc->source ?? 'ocr';
            $doc->save();
        } catch (\Throwable $e) {
            $doc->status = InvoiceStatus::Failed;
            $doc->save();

            throw $e;
        }
    }
}

