import { Head, router } from '@inertiajs/react';
import { FileImage, FileText } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { upload as uploadRoute, templates } from '@/routes';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Templates',
        href: templates().url,
    },
];

const SAMPLE_FILES = [
    {
        label: 'Amazon Invoice',
        path: '/samples/amazon-in.pdf',
        filename: 'amazon-in.pdf',
        kind: 'pdf' as const,
    },
    {
        label: 'Sample Invoice',
        path: '/samples/sample-inv.pdf',
        filename: 'sample-inv.pdf',
        kind: 'pdf' as const,
    },
    {
        label: 'Repair Invoice',
        path: '/samples/east-repair.png',
        filename: 'east-repair.png',
        kind: 'image' as const,
    },
];

export default function Templates() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);

    const loadAndSubmitSample = async (path: string, filename: string) => {
        try {
            setLoading(filename);
            setError(null);

            const response = await fetch(path);
            if (!response.ok) {
                throw new Error('Unable to load sample file.');
            }

            const blob = await response.blob();
            const file = new File([blob], filename, {
                type: blob.type || 'application/octet-stream',
            });

            const formData = new FormData();
            formData.append('file', file);

            router.post(uploadRoute().url, formData, {
                forceFormData: true,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unexpected error.');
            setLoading(null);
        }
    };

    const openSample = (path: string) => {
        window.open(path, '_blank', 'noopener,noreferrer');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Templates" />
            <div className="mx-auto w-full">
                <Card className="border-none shadow-none">
                    <CardHeader className="space-y-2">
                        <CardTitle>Templates</CardTitle>
                        <CardDescription>
                            Use a known-good sample invoice as input. Selecting a
                            sample submits it to the ingestion endpoint exactly like
                            a manual upload.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertTitle>Unable to submit sample</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-2 sm:grid-cols-3">
                            {SAMPLE_FILES.map((sample) => (
                                <div
                                    key={sample.filename}
                                    className="flex h-full flex-col justify-between gap-2 rounded-md border border-foreground/10 bg-transparent px-4 py-3 text-sm"
                                >
                                    <div className="flex items-start gap-3">
                                        {sample.kind === 'pdf' ? (
                                            <FileText className="mt-0.5 size-5 opacity-80" />
                                        ) : (
                                            <FileImage className="mt-0.5 size-5 opacity-80" />
                                        )}
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">
                                                {sample.label}
                                            </span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {sample.filename}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => openSample(sample.path)}
                                        >
                                            Open
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="flex-1"
                                            disabled={!!loading}
                                            onClick={() =>
                                                loadAndSubmitSample(
                                                    sample.path,
                                                    sample.filename,
                                                )
                                            }
                                        >
                                            {loading === sample.filename
                                                ? 'Submitting…'
                                                : 'Process'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
