/**
 * Books exports in the browser (BOOKS-01): downloads a `.csv` file the admin can import into
 * QuickBooks Online, Xero or Wave, or send to the CPA. A byte-order mark keeps Excel reading
 * "Tapua'i" and "Mālo" correctly.
 */

/**
 * @purpose Download one CSV export by name.
 * @sideEffects Creates and clicks a temporary object-URL link.
 */
export async function exportCsv(filename: string, csv: string): Promise<'shared' | 'downloaded' | 'dismissed'> {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
