import { Head, router, usePage } from '@inertiajs/react';
import { ArrowUpDown, Trash2 } from 'lucide-react';
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

type InvoiceStatus = 'processed' | 'reviewed' | 'processing' | 'failed';
type InvoiceSource = 'ocr' | 'text';

type HistoryRow = {
    id: string;
    filename: string;
    dateProcessed: string;
    source: InvoiceSource;
    status: InvoiceStatus;
};

type PageProps = {
    invoices: HistoryRow[];
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'History',
        href: history().url,
    },
];

function StatusBadge({ status }: { status: InvoiceStatus }) {
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    if (status === 'processing') return <Badge variant="secondary">Processing</Badge>;
    if (status === 'reviewed') return <Badge variant="outline">Reviewed</Badge>;
    return <Badge>Processed</Badge>;
}

export default function History() {
    const page = usePage<PageProps>();
    const initialRows = page.props.invoices ?? [];
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>(
        'all',
    );

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return initialRows.filter((row) => {
            const matchesQuery = !q || row.filename.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === 'all' ? true : row.status === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [initialRows, query, statusFilter]);

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
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-0 text-right">
                                            <span className="sr-only">Actions</span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={4}
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
                                                <TableCell>
                                                    <StatusBadge status={row.status} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.delete(
                                                                `/invoice/${row.id}`,
                                                                {
                                                                    preserveScroll: true,
                                                                },
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="sr-only">
                                                            Delete
                                                        </span>
                                                    </Button>
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
