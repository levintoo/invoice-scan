<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class InvoiceUploadController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'mimetypes:application/pdf,image/jpeg,image/png',
                'max:20480', // 20MB
            ],
        ]);

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $validated['file'];

        dd('received');
    }
}

