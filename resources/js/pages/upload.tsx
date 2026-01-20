import { Head, router, usePage } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { upload } from '@/routes';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Upload',
        href: upload().url,
    },
];

const ACCEPT_ALL = '.pdf,application/pdf,.jpg,.jpeg,.png,image/jpeg,image/png';

export default function Upload() {
    const page = usePage();
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const detectedType = useMemo(() => {
        if (!file) return null;
        const name = file.name.toLowerCase();
        if (name.endsWith('.pdf')) return 'PDF';
        if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'JPEG';
        if (name.endsWith('.png')) return 'PNG';
        return null;
    }, [file]);

    const validateFile = (candidate: File | null) => {
        if (!candidate) {
            return 'Select a file to continue.';
        }

        const name = candidate.name.toLowerCase();
        const isPdf = name.endsWith('.pdf');
        const isJpeg = name.endsWith('.jpg') || name.endsWith('.jpeg');
        const isPng = name.endsWith('.png');

        if (!isPdf && !(isJpeg || isPng)) {
            return 'Only PDF, JPEG, or PNG invoices are accepted.';
        }

        return null;
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const candidate = event.target.files?.item(0) ?? null;
        const validationError = validateFile(candidate);

        setFile(candidate);
        setError(validationError);
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const candidate = event.dataTransfer.files?.item(0) ?? null;
        const validationError = validateFile(candidate);
        setFile(candidate);
        setError(validationError);
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const validationError = validateFile(file);

        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);

        const formData = new FormData();
        formData.append('file', file as File);

        router.post(upload().url, formData, {
            forceFormData: true,
            onSuccess: () => {
                // For now, backend redirects back to /upload with a flash "Received".
            },
        });
    };

    const isValid = !validateFile(file);
    const received = (page.props as { flash?: { status?: string } })?.flash
        ?.status === 'Received';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Upload" />
            <div className="mx-auto w-full ">
                <Card className="w-full border-none shadow-none">
                    <CardHeader className="space-y-2">
                        <CardTitle>Invoice OCR Demo</CardTitle>
                        <CardDescription>
                            Upload a PDF or image invoice to extract structured
                            financial data using hybrid text extraction and OCR.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="mt-2 space-y-4" onSubmit={onSubmit}>
                            <Alert className="border-foreground/20">
                                <Info className="size-4" />
                                <AlertTitle>Processing approach</AlertTitle>
                                <AlertDescription>
                                    Embedded text is extracted first. OCR is only used
                                    when the document is scanned or provided as an
                                    image.
                                </AlertDescription>
                            </Alert>
                            {received && (
                                <Alert>
                                    <AlertTitle>Received</AlertTitle>
                                    <AlertDescription>
                                        Invoice was uploaded successfully.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTitle>Upload blocked</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="invoice-upload">Invoice file</Label>
                                <div
                                    className={[
                                        'group relative w-full rounded-md border border-dashed transition-colors',
                                        isDragging
                                            ? 'border-primary bg-primary/5'
                                            : 'border-foreground/40 hover:border-foreground/60',
                                    ].join(' ')}
                                    onDrop={onDrop}
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                >
                                    <div className="flex flex-col items-start gap-2 p-4">
                                        <p className="text-sm font-medium">
                                            Drop an invoice or browse to upload
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Accepts PDF, JPEG, or PNG invoices. Digitally
                                            generated PDFs extract text directly; OCR is only
                                            applied when needed (scans or images).
                                        </p>
                                        {file && (
                                            <div className="mt-1 w-full rounded-md border border-foreground/20 bg-muted/40 px-3 py-2">
                                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                    {detectedType && (
                                                        <Badge variant="secondary">
                                                            {detectedType}
                                                        </Badge>
                                                    )}
                                                    <span className="truncate">
                                                        {file.name}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <Input
                                        ref={fileInputRef}
                                        id="invoice-upload"
                                        type="file"
                                        accept={ACCEPT_ALL}
                                        multiple={false}
                                        onChange={onFileChange}
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                    {isValid && detectedType && (
                                        <Badge variant="outline" className="font-medium">
                                            {detectedType} detected
                                        </Badge>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                        Controlled ingestion ensures correct parsing per
                                        document type.
                                    </p>
                                </div>

                                <Button type="submit" disabled={!isValid}>
                                    Process Invoice
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
