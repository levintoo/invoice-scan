<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_documents', function (Blueprint $table) {
            $table->ulid('id')->primary();

            $table->string('filename');
            $table->string('file_path')->nullable();

            $table->timestamp('date_processed')->nullable();

            // 'text' or 'ocr'
            $table->string('source', 16)->nullable();

            // processing | processed | reviewed | failed (see App\Enums\InvoiceStatus)
            $table->string('status', 32)->nullable();

            // required
            $table->string('invoice_number');

            $table->date('invoice_date')->nullable();
            $table->decimal('total_amount', 15, 2)->nullable();
            $table->decimal('tax_amount', 15, 2)->nullable();

            $table->timestamps();

            $table->index('invoice_number');
            $table->index('date_processed');
            $table->index('source');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_documents');
    }
};

