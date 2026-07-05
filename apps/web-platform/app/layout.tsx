import './globals.css';
import { ConsoleShell } from '@line-rag/ui';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sales Bot Platform Console',
};

const nav = [
  { href: '/console', label: 'Tenants' },
  { href: '/usage', label: 'Usage' },
  { href: '/health', label: 'Health' },
  { href: '/settings', label: 'Settings' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConsoleShell title="Platform Ops" nav={nav}>
          {children}
        </ConsoleShell>
      </body>
    </html>
  );
}
