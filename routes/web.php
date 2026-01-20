<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use App\Http\Controllers\InvoiceUploadController;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('upload', function () {
        return Inertia::render('upload');
    })->name('upload');

    Route::post('upload', [InvoiceUploadController::class, 'store'])->name('upload.store');

    Route::get('history', function () {
        return Inertia::render('history');
    })->name('history');

    Route::get('invoice/{id}', function (string $id) {
        return Inertia::render('invoice/show', [
            'id' => $id,
        ]);
    })->name('invoice.show');

    Route::get('templates', function () {
        return Inertia::render('templates');
    })->name('templates');
});

require __DIR__.'/settings.php';
