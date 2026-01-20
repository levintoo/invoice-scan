import { Head, usePage } from '@inertiajs/react';
import { CheckCircle2, CircleSlash2, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

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
    id: string;
};

type ProcessingStage = 'pending' | 'text' | 'ocr' | 'fields' | 'complete';

type FieldStatus = 'detected' | 'low' | 'missing';

type SummaryFieldKey =
    | 'invoiceNumber'
    | 'invoiceDate'
    | 'currency'
    | 'total'
    | 'subtotal'
    | 'tax';

type SummaryField = {
    key: SummaryFieldKey;
    label: string;
    value: string | null;
    confidence: number | null;
    status: FieldStatus;
    available: boolean;
};

type LineItem = {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
};

type Metadata = {
    source: 'text' | 'ocr';
    ocrLanguage: string | null;
    durationSeconds: number | null;
    pageCount: number | null;
    warnings: string[];
};

type InvoiceState = {
    stage: ProcessingStage;
    summary: Record<SummaryFieldKey, SummaryField>;
    lineItems: LineItem[] | null;
    metadata: Metadata | null;
};

function initInvoiceState(): InvoiceState {
    const baseField = (key: SummaryFieldKey, label: string): SummaryField => ({
        key,
        label,
        value: null,
        confidence: null,
        status: 'missing',
        available: false,
    });

    return {
        stage: 'pending',
        summary: {
            invoiceNumber: baseField('invoiceNumber', 'Invoice Number'),
            invoiceDate: baseField('invoiceDate', 'Invoice Date'),
            currency: baseField('currency', 'Currency'),
            total: baseField('total', 'Total Amount'),
            subtotal: baseField('subtotal', 'Subtotal'),
            tax: baseField('tax', 'Tax / VAT'),
        },
        lineItems: null,
        metadata: null,
    };
}

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
            <div className="min-h-[1.5rem]">
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
    const id = page.props.id;
    const [invoice, setInvoice] = useState<InvoiceState>(() => initInvoiceState());

    // Demo polling (every 3s) — replace with real backend polling.
    useEffect(() => {
        const started = Date.now();

        const interval = setInterval(() => {
            const elapsed = Date.now() - started;
            setInvoice((prev) => {
                if (prev.stage === 'complete') return prev;

                if (elapsed < 3000) return { ...prev, stage: 'text' };

                if (elapsed < 6000) {
                    return {
                        ...prev,
                        stage: 'ocr',
                        metadata: {
                            source: 'text',
                            ocrLanguage: null,
                            durationSeconds: null,
                            pageCount: null,
                            warnings: [],
                        },
                    };
                }

                if (elapsed < 9000) {
                    const summary = { ...prev.summary };
                    summary.invoiceNumber = {
                        ...summary.invoiceNumber,
                        value: 'INV-2048',
                        confidence: 96,
                        status: 'detected',
                        available: true,
                    };
                    summary.invoiceDate = {
                        ...summary.invoiceDate,
                        value: '2026-01-19',
                        confidence: 91,
                        status: 'detected',
                        available: true,
                    };
                    summary.currency = {
                        ...summary.currency,
                        value: 'USD',
                        confidence: 88,
                        status: 'detected',
                        available: true,
                    };
                    summary.total = {
                        ...summary.total,
                        value: '$1,284.33',
                        confidence: 93,
                        status: 'detected',
                        available: true,
                    };
                    summary.subtotal = {
                        ...summary.subtotal,
                        value: '$1,070.27',
                        confidence: 87,
                        status: 'detected',
                        available: true,
                    };
                    summary.tax = {
                        ...summary.tax,
                        value: '$214.06',
                        confidence: 72,
                        status: 'low',
                        available: true,
                    };
                    return { ...prev, stage: 'fields', summary };
                }

                clearInterval(interval);
                return {
                    ...prev,
                    stage: 'complete',
                    lineItems: [
                        {
                            id: '1',
                            description: 'Cloud compute usage — January',
                            quantity: '1',
                            unitPrice: '$1,070.27',
                            total: '$1,070.27',
                        },
                    ],
                    metadata: {
                        source: 'text',
                        ocrLanguage: null,
                        durationSeconds: 11,
                        pageCount: 2,
                        warnings: ['Tax amount inferred from line totals.'],
                    },
                };
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [id]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'History', href: history().url },
        { title: `Invoice ${id}`, href: `/invoice/${id}` },
    ];

    const isProcessing = invoice.stage !== 'complete';
    const sourceLabel =
        invoice.metadata?.source === 'ocr' || invoice.stage === 'ocr' ? 'OCR' : 'Text';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Invoice ${id}`} />

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
                                variant="outline"
                                className="px-2 py-1 text-[11px] font-medium"
                            >
                                {invoice.stage === 'pending' ? 'Queued' : 'Processing'}
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
                        <div className="relative aspect-4/3 w-full overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-muted">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">
                                    Preview placeholder – embed PDF or image viewer here
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: extracted data – key summary fields only */}
                    <div className="space-y-6">
                        <section className="space-y-3">
                            <p className="text-sm font-semibold">Invoice summary</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <SummaryFieldCard field={invoice.summary.invoiceNumber} />
                                <SummaryFieldCard field={invoice.summary.invoiceDate} />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <SummaryFieldCard
                                    field={invoice.summary.total}
                                    emphasis="total"
                                />
                                <SummaryFieldCard field={invoice.summary.tax} />
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

