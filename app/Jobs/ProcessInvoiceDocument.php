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
        /** @var InvoiceDocument|null $document */
        $document = InvoiceDocument::query()->find($this->invoiceDocumentId);
        if (! $document) {
            return;
        }

        $document->status = InvoiceStatus::Processing;
        $document->save();

        try {
            if ($document->file_path && Storage::exists($document->file_path)) {
                $processor->handle($document);
            } else {
                $document->status = InvoiceStatus::Failed;
                $document->save();

                return;
            }
        } catch (\Throwable $e) {
            $document->status = InvoiceStatus::Failed;
            $document->save();

            throw $e;
        }
    }
}

