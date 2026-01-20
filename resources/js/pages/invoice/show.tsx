import { Head, router, usePage, usePoll } from '@inertiajs/react';
import { CheckCircle2, CircleSlash2, HelpCircle } from 'lucide-react';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { history } from '@/routes';
import { type BreadcrumbItem } from '@/types';

type PageProps = {
    invoice: {
        id: string;
        filename: string;
        filePath: string | null;
        fileUrl: string | null;
        status: 'processing' | 'processed' | 'reviewed' | 'failed' | null;
        source: 'text' | 'ocr' | null;
        dateProcessed: string | null;
        invoiceNumber: string;
        invoiceDate: string | null;
        totalAmount: string | number | null;
        taxAmount: string | number | null;
    };
};

type FieldStatus = 'detected' | 'low' | 'missing';

type SummaryField = {
    label: string;
    value: string | null;
    confidence: number | null;
    status: FieldStatus;
    available: boolean;
};

function fieldStatusIcon(status: FieldStatus) {
    if (status === 'detected') {
        return <CheckCircle2 className="size-3.5 text-emerald-500" />;
    }
    if (status === 'low') {
        return <HelpCircle className="size-3.5 text-amber-500" />;
    }
    return <CircleSlash2 className="size-3.5 text-muted-foreground" />;
}

function SummaryFieldCard({
    field,
    emphasis = 'normal',
}: {
    field: SummaryField;
    emphasis?: 'normal' | 'total';
}) {
    const hasValue = field.available && field.value !== null;

    return (
        <div
            className={[
                'space-y-2 rounded-xl p-3 text-xs',
                emphasis === 'total'
                    ? 'bg-primary/5 text-primary'
                    : 'bg-muted text-foreground',
            ].join(' ')}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {field.label}
                </span>
                <span className="inline-flex items-center gap-1">
                    {fieldStatusIcon(field.status)}
                    {field.confidence != null && (
                        <span className="text-[10px] text-muted-foreground">
                            {field.confidence}%
                        </span>
                    )}
                </span>
            </div>
            <div className="min-h-6">
                {hasValue ? (
                    <span
                        className={
                            emphasis === 'total'
                                ? 'text-base font-semibold text-primary'
                                : 'text-sm font-medium'
                        }
                    >
                        {field.value}
                    </span>
                ) : (
                    <Skeleton className="h-4 w-24" />
                )}
            </div>
            <Progress value={field.confidence ?? 0} className="h-1.5" />
        </div>
    );
}

export default function InvoiceShow() {
    const page = usePage<PageProps>();
    const invoice = page.props.invoice;

    // Keep a stable preview URL/filename so the iframe/img is not reloaded on each poll.
    const previewRef = useRef<{ url: string | null; filename: string }>({
        url: invoice.fileUrl,
        filename: invoice.filename,
    });

    if (invoice.fileUrl && !previewRef.current.url) {
        previewRef.current = {
            url: invoice.fileUrl,
            filename: invoice.filename,
        };
    }

    // Smart Inertia polling: poll only the `invoice` prop every 3s while processing.
    // Automatically stops when the invoice status is no longer "processing".
    const { stop } = usePoll(
        3000,
        {
            only: ['invoice'],
            preserveScroll: true,
            onSuccess: (newPage) => {
                const next = (newPage.props as PageProps).invoice;
                if (next.status !== 'processing') {
                    stop();
                }
            },
        },
        {
            autoStart: invoice.status === 'processing',
        },
    );

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'History', href: history().url },
        { title: `Invoice ${invoice.id}`, href: `/invoice/${invoice.id}` },
    ];

    const isProcessing = invoice.status === 'processing';
    const sourceLabel = invoice.source ? invoice.source.toUpperCase() : null;

    const summaryFields = {
        invoiceDate: {
            label: 'Invoice Date',
            value: invoice.invoiceDate,
            confidence: null,
            status: invoice.invoiceDate ? 'detected' : 'missing',
            available: invoice.invoiceDate !== null,
        } satisfies SummaryField,
        total: {
            label: 'Total Amount',
            value:
                invoice.totalAmount !== null
                    ? `$${Number(invoice.totalAmount).toFixed(2)}`
                    : null,
            confidence: null,
            status: invoice.totalAmount !== null ? 'detected' : 'missing',
            available: invoice.totalAmount !== null,
        } satisfies SummaryField,
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Invoice ${invoice.id}`} />

            <div className="mx-auto w-full">
                <Card className="border-none shadow-none">
                    <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Invoice details</CardTitle>
                            <CardDescription>
                                Inspect extracted fields, processing stages, and confidence
                                signals for this invoice.
                            </CardDescription>
                        </div>
                        {isProcessing ? (
                            <Badge
                                variant="secondary"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium"
                            >
                                <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                                Processing
                                {sourceLabel ? ` · ${sourceLabel}` : ''}
                            </Badge>
                        ) : (
                            <Button type="button" size="sm" variant="outline">
                                Review
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 pb-4 pt-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    {/* Left: raw document only */}
                    <div className="space-y-2">
                        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-muted">
                            {previewRef.current.url ? (
                                previewRef.current.filename
                                    .toLowerCase()
                                    .endsWith('.pdf') ? (
                                    <iframe
                                        src={previewRef.current.url}
                                        className="h-full w-full"
                                        title={previewRef.current.filename}
                                    />
                                ) : (
                                    <img
                                        src={previewRef.current.url}
                                        alt={previewRef.current.filename}
                                        className="h-full w-full object-contain"
                                    />
                                )
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">
                                        {invoice.filename}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: extracted data – key summary fields only */}
                    <div className="space-y-6">
                        <section className="space-y-3">
                            <p className="text-sm font-semibold">Invoice summary</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <SummaryFieldCard field={summaryFields.invoiceDate} />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <SummaryFieldCard
                                    field={summaryFields.total}
                                    emphasis="total"
                                />
                            </div>
                        </section>

                        {/* Line items intentionally omitted to keep this view focused */}
                    </div>
                </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

