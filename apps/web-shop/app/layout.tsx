import '@line-rag/ui';
import './globals.css';
import { ConsoleShell } from '@line-rag/ui';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sales Bot Shop Console',
};

const nav = [
  { href: '/products', label: 'Products' },
  { href: '/upload', label: 'Upload' },
  { href: '/playground', label: 'Playground' },
  { href: '/leads', label: 'Leads' },
  { href: '/conversations', label: 'Conversations' },
  { href: '/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConsoleShell title="Shop Console" nav={nav}>
          {children}
        </ConsoleShell>
      </body>
    </html>
  );
}
