import { Head, router } from '@inertiajs/react';
import { ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { history } from '@/routes';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'History',
        href: history().url,
    },
];

type InvoiceStatus = 'processed' | 'reviewed' | 'processing' | 'failed';
type InvoiceSource = 'ocr' | 'text';

type HistoryRow = {
    id: string;
    filename: string;
    dateProcessed: string;
    source: InvoiceSource;
    detectedTotal: string;
    status: InvoiceStatus;
};

const MOCK_ROWS: HistoryRow[] = [
    {
        id: '1',
        filename: 'amazon-in.pdf',
        dateProcessed: '2026-01-20 10:41',
        source: 'text',
        detectedTotal: '$1,284.33',
        status: 'processed',
    },
    {
        id: '2',
        filename: 'east-repair.png',
        dateProcessed: '2026-01-20 10:32',
        source: 'ocr',
        detectedTotal: '$438.00',
        status: 'reviewed',
    },
    {
        id: '3',
        filename: 'scan-2026-01-19.pdf',
        dateProcessed: '2026-01-19 18:12',
        source: 'ocr',
        detectedTotal: '$97.20',
        status: 'processing',
    },
    {
        id: '4',
        filename: 'vendor-invoice-unknown.png',
        dateProcessed: '2026-01-19 16:02',
        source: 'ocr',
        detectedTotal: '—',
        status: 'failed',
    },
];

function StatusBadge({ status }: { status: InvoiceStatus }) {
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    if (status === 'processing') return <Badge variant="secondary">Processing</Badge>;
    if (status === 'reviewed') return <Badge variant="outline">Reviewed</Badge>;
    return <Badge>Processed</Badge>;
}

export default function History() {
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>(
        'all',
    );

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return MOCK_ROWS.filter((row) => {
            const matchesQuery = !q || row.filename.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === 'all' ? true : row.status === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [query, statusFilter]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="History" />
            <div className="mx-auto w-full">
                <Card className="border-none shadow-none">
                    <CardHeader className="space-y-2">
                        <CardTitle>History</CardTitle>
                        <CardDescription>
                            Review processed invoices and their extraction results.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 items-center gap-2">
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by filename…"
                                />
                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) =>
                                        setStatusFilter(v as InvoiceStatus | 'all')
                                    }
                                >
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="processed">
                                            Processed
                                        </SelectItem>
                                        <SelectItem value="reviewed">Reviewed</SelectItem>
                                        <SelectItem value="processing">
                                            Processing
                                        </SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="button" variant="outline">
                                Refresh
                            </Button>
                        </div>

                        <div className="rounded-md border border-foreground/10">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Filename</TableHead>
                                        <TableHead>Date Processed</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-sm text-left font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                            >
                                                Detected Total
                                                <ArrowUpDown className="size-3 opacity-70" />
                                            </button>
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="py-8 text-center text-muted-foreground"
                                            >
                                                No matches.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((row) => (
                                            <TableRow
                                                key={row.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    router.visit(`/invoice/${row.id}`)
                                                }
                                            >
                                                <TableCell className="font-medium">
                                                    {row.filename}
                                                </TableCell>
                                                <TableCell>{row.dateProcessed}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {row.source === 'ocr'
                                                            ? 'OCR'
                                                            : 'Text'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{row.detectedTotal}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={row.status} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
