import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tapua'i Admin Portal",
  description: 'Soft-Wall auth oversight and Features control plane for Tapua\'i Sports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
