import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Live Chat',
  description: 'Real-time messaging with Next.js, NestJS, MongoDB, and JWT.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
