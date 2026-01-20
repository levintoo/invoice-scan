<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('upload', function () {
        return Inertia::render('upload');
    })->name('upload');

    Route::get('history', function () {
        return Inertia::render('history');
    })->name('history');

    Route::get('templates', function () {
        return Inertia::render('templates');
    })->name('templates');
});

require __DIR__.'/settings.php';
