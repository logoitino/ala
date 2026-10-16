/**
 * Reconcile tab of the Finance & Books hub (BOOKS-02; owned by INTERNAL_CONTROLS): proves every
 * money row in the app reached the revenue log the books are built from, stream by stream, and lists
 * money that has no posting path yet. A source that could not be read says so; it is never shown as zero.
 */
import { View } from 'react-native';

import { AdminReportSection } from '@/components/Admin/Reports/AdminReportSection';
import type { ReportSection } from '@/components/Admin/Reports/reportPages';
import { booksUsd, type BookIssue } from '@tapuai/shared-types/admin/bookkeeping';
import type { ReconRow } from '@tapuai/shared-types/admin/financeChecks';

const STATUS_WORD: Record<ReconRow['status'], string> = { match: 'Complete', gap: 'Gap found', unread: 'Not read' };

/** @purpose Source-to-ledger reconciliation table, findings and per-source read errors. */
export function BooksReconcileTab({ rows, findings, sourceErrors }: { rows: ReconRow[]; findings: BookIssue[]; sourceErrors: Record<string, string> }) {
  const complete = rows.filter((row) => row.status === 'match').length;
  const sections: ReportSection[] = [
    {
      id: 'recon',
      title: 'Every money row reached the books?',
      hint: `${complete} of ${rows.length} streams complete · all time`,
      sentences: [
        'Each source row must have exactly one revenue-log row with the same amount. "Missing" undercounts the books; "orphan" is a log row whose source is gone.',
        ...findings.map((issue) => `${issue.severity === 'block' ? 'Stop' : issue.severity === 'warn' ? 'Review' : 'Note'}: ${issue.title}. ${issue.detail}`),
        ...Object.entries(sourceErrors).map(([table, error]) => `Read problem on ${table}: ${error}`),
      ],
      tables: [{
        title: 'Source to revenue log, by stream',
        initiallyOpen: true,
        source: 'Source tables versus company_revenue_logs (source, source_id, gross_cents)',
        table: {
          columns: ['Stream', 'Source', 'State', 'Source rows', 'Source total', 'Log rows', 'Log total', 'Missing', 'Orphans', 'Amounts differ'],
          rows: rows.map((row) => [row.title, row.source, STATUS_WORD[row.status], row.status === 'unread' ? '—' : String(row.sourceCount), row.status === 'unread' ? '—' : booksUsd(row.sourceCents), String(row.ledgerCount), booksUsd(row.ledgerCents), row.status === 'unread' ? '—' : String(row.missing.length), row.status === 'unread' ? '—' : String(row.orphans.length), row.status === 'unread' ? '—' : String(row.mismatched.length)]),
        },
      }],
    },
  ];
  return <View style={{ gap: 28 }}>{sections.map((section) => <AdminReportSection key={section.id} section={section} />)}</View>;
}
