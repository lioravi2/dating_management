import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import VersionFooter from '@/components/VersionFooter';
import DebugLogger from '@/components/DebugLogger';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Dating Assistant',
    template: '%s | Dating Assistant',
  },
  description: 'Manage your dating life with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DebugLogger />
        {children}
        <VersionFooter />
      </body>
    </html>
  );
}
