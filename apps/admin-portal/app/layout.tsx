import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tapua'i Admin Portal",
  description: 'Read-only oversight for Tapua\'i — Reports, Money, Soft-Wall, Features, People. All edits happen in Expo /admin.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
