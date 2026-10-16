/**
 * Taxes tab of the Finance & Books hub (BOOKS-02; owned by TAX with INFO_RETURNS and SALES_TAX):
 * the tax-year pack, the next federal deadlines, what is and is not ready for taxes, and the monthly
 * close calendar. Every figure is preparation for the owner's CPA, not tax advice.
 */
import { View } from 'react-native';

import { AdminReportSection } from '@/components/Admin/Reports/AdminReportSection';
import type { ReportSection } from '@/components/Admin/Reports/reportPages';
import { MONTHLY_CLOSE_STEPS, taxCalendar, upcomingDeadlines, type TaxReadinessItem } from '@tapuai/shared-types/admin/financeTax';

const STATE_WORD: Record<TaxReadinessItem['state'], string> = { ready: 'Ready', partial: 'Partly', missing: 'Not yet' };

/** @purpose Tax pack plus calendar, readiness and close steps for the selected year. */
export function BooksTaxesTab({ taxSections, readiness, year, today }: { taxSections: ReportSection[]; readiness: TaxReadinessItem[]; year: number; today: string }) {
  const upcoming = upcomingDeadlines(today, 4);
  const ready = readiness.filter((item) => item.state === 'ready').length;
  const extra: ReportSection[] = [
    {
      id: 'tax-readiness',
      title: 'Ready for taxes?',
      hint: `${ready} of ${readiness.length} in place`,
      sentences: ['Owner actions (LLC, bank account, CPA) stay "Not yet" until they are recorded in FINANCE_OPERATIONS.md.'],
      tables: [{ title: 'Tax readiness', initiallyOpen: true, table: { columns: ['Item', 'State', 'Owner', 'Detail'], rows: readiness.map((item) => [item.item, STATE_WORD[item.state], item.owner, item.detail]) } }],
    },
    {
      id: 'tax-calendar',
      title: 'Tax calendar',
      hint: upcoming[0] ? `Next: ${upcoming[0].date} · ${upcoming[0].title}` : undefined,
      sentences: ['Federal dates for a calendar-year single-member LLC (the Wave 1 plan). Weekend dates move to Monday; holidays can move them again. State dates are added once Tapua\'i registers in a state.'],
      tables: [
        { title: 'Next deadlines', initiallyOpen: true, table: { columns: ['Date', 'What', 'Form', 'Owner', 'Applies when'], rows: upcoming.map((row) => [row.date, row.title, row.form, row.owner, row.appliesWhen]) } },
        { title: `All ${year} federal deadlines`, table: { columns: ['Date', 'What', 'Form', 'Owner', 'Applies when'], rows: taxCalendar(year).map((row) => [row.date, row.title, row.form, row.owner, row.appliesWhen]) } },
      ],
    },
    {
      id: 'close-calendar',
      title: 'Monthly close and tax prep',
      tables: [{ title: 'Monthly close steps', initiallyOpen: true, table: { columns: ['When', 'Step', 'Owner'], rows: MONTHLY_CLOSE_STEPS.map((row) => [row.day, row.step, row.owner]) } }],
    },
  ];
  return <View style={{ gap: 28 }}>{[...taxSections, ...extra].map((section) => <AdminReportSection key={section.id} section={section} />)}</View>;
}
