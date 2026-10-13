/**
 * Root layout for the read-only Next admin portal. The title template names every tab
 * "<Page> · Tapua'i Admin"; each page sets its own `metadata.title`. The favicon is `app/icon.svg`.
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: "Tapua'i Admin Portal", template: "%s · Tapua'i Admin" },
  description: 'Read-only oversight for Tapua\'i — Reports, Money, Soft-Wall, Features, People. All edits happen in Expo /admin.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
