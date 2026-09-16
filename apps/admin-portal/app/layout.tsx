import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tapua'i Admin Portal",
  description: 'Web admin for Tapua\'i — Reports, Money, Soft-Wall, Features.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
