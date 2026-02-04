# Invoice OCR (Laravel 12 + Inertia + React)

Extract **invoice number** and **invoice date** from PDF invoices using **Tesseract OCR** (native C/C++ library) for image-based PDFs and **OpenAI** for smart parsing.

## 🖼 Screenshots

### Upload Invoice

<img width="350" height="750" alt="invoice-image" src="https://github.com/user-attachments/assets/a7a449c5-3abf-4da0-9199-72e7e2092eff" />


### OCR Results

<img width="1366" height="768" alt="Screenshot 2026-02-04 at 20-18-16 Invoice 01kgmthrqfr63pyvf6rg9wfar2 - OCR Admin" src="https://github.com/user-attachments/assets/0d00ea6e-bc54-47e0-92c2-f0dc31b9a3ff" />

## ✨ Features

- Upload PDF invoices  
- Smart text extraction:
  - Direct PDF text extraction (no OCR) for machine-readable PDFs  
  - OCR fallback using **Tesseract OCR** for scanned/image-based PDFs  
- AI-powered parsing with **OpenAI**  
- Extracts:
  - Invoice Number  
  - Invoice Date  
- Clean UI with **Inertia + React**  
- Easy to extend for more fields later  

## 🧱 Tech Stack

- **Backend:** Laravel 12  
- **Frontend:** Inertia.js + React  
- **OCR Engine:** **Tesseract OCR** (native C/C++ library)  
  - Repo: https://github.com/tesseract-ocr/tesseract  
- **AI Parsing:** OpenAI API  
- **Build Tooling:** Vite  

## ⚙️ Requirements

- PHP 8.3+  
- Composer  
- Node.js 18+  
- **Tesseract OCR (native C/C++ binary – required for scanned/image PDFs)**  
- **OpenAI API Key (required)**  

> ⚠️ This project will not work without:
> - Tesseract installed on your system  
> - A valid OpenAI API key  

## 🛠 Project Setup

### 1. Clone the repo
```bash
git clone https://github.com/levintoo/invoice-scan.git
cd invoice-ocr
````

### 2. Install backend deps

```bash
composer install
```

### 3. Install frontend deps

```bash
npm install
```

### 4. Environment setup

```bash
cp .env.example .env
php artisan key:generate
```

Set your OpenAI key:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### 5. Install Tesseract (Native Binary)

Tesseract is a **native C/C++ OCR engine**. You must install it on your OS.

**Linux (Ubuntu/Debian):**

```bash
sudo apt install tesseract-ocr
```

Verify:

```bash
tesseract --version
```

### 6. Start dev servers

```bash
php artisan serve
npm run dev
```

Open:

```
http://localhost:8000
```

## How It Works

1. User uploads a PDF invoice
2. App first attempts **direct text extraction from the PDF**
3. If meaningful text is found →
   ➜ Text is sent directly to **OpenAI** (no OCR used)
4. If the PDF is scanned / image-based or text extraction fails →
   ➜ The document is passed through **Tesseract OCR**
5. Extracted text is sent to **OpenAI**
6. OpenAI returns structured data:

   * `invoice_number`
   * `invoice_date`
7. Results are displayed in the UI

This approach avoids unnecessary OCR and speeds up processing for machine-readable PDFs.
