<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Processing = 'processing';
    case Processed = 'processed';
    case Reviewed = 'reviewed';
    case Failed = 'failed';
}

