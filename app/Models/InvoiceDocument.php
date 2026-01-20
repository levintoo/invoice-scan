<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvoiceDocument extends Model
{
    use HasFactory;
    use HasUlids;

    protected $table = 'invoice_documents';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'filename',
        'file_path',
        'date_processed',
        'source',
        'status',
        'invoice_number',
        'invoice_date',
        'total_amount',
        'tax_amount',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date_processed' => 'datetime',
        'invoice_date'   => 'date',
        'total_amount'   => 'decimal:2',
        'tax_amount'     => 'decimal:2',
        'status'         => InvoiceStatus::class,
    ];
}

