import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tapua'i Admin Portal",
  description: 'Web control plane scaffold for Tapua\'i Sports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
