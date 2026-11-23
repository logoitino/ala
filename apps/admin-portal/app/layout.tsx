/**
 * Root layout for the read-only Next admin portal. The title template names every tab
 * "<Page> · Tapua'i Admin"; each page sets its own `metadata.title`. The favicon is `app/icon.png`
 * (the Tapua'i app icon). Brand fonts follow the 2026-11 Lovable standard: Figtree for text and
 * Bricolage Grotesque for headings, bundled locally (SIL OFL, licences in `app/fonts/`).
 */
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const figtree = localFont({
  src: [
    { path: './fonts/Figtree-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Figtree-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Figtree-Bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/Figtree-ExtraBold.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-figtree',
  display: 'swap',
});

const bricolage = localFont({
  src: [{ path: './fonts/BricolageGrotesque-ExtraBold.ttf', weight: '800', style: 'normal' }],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  title: { default: "Tapua'i Admin Portal", template: "%s · Tapua'i Admin" },
  description: 'Read-only oversight for Tapua\'i — Reports, Money, Soft-Wall, Features, People. All edits happen in Expo /admin.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
