/**
 * Books exports on a phone (BOOKS-01): hands the CSV text to the system share sheet so it can be
 * mailed to the bookkeeper, saved to Files or AirDropped to a computer. The web build downloads a
 * real `.csv` file instead (`csvExport.web.ts`).
 */
import { Share } from 'react-native';

/**
 * @purpose Share one CSV export by name.
 * @sideEffects Opens the system share sheet.
 */
export async function exportCsv(filename: string, csv: string): Promise<'shared' | 'downloaded' | 'dismissed'> {
  // Very large ledgers may exceed what some Android share targets accept; export by month on a phone.
  const result = await Share.share({ title: filename, message: csv });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
