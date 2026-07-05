import './globals.css';
import type React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'LINE RAG Admin',
  description: 'Admin console for the LINE RAG prototype',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">LINE RAG Admin</div>
            <nav className="nav">
              <Link href="/documents">Documents</Link>
              <Link href="/playground">Playground</Link>
              <Link href="/logs">Logs</Link>
              <Link href="/super/tenants">Super Tenants</Link>
              <Link href="/super/usage">Super Usage</Link>
              <Link href="/app/products">Shop Products</Link>
              <Link href="/app/upload">Shop Upload</Link>
              <Link href="/app/leads">Shop Leads</Link>
              <form action="/api/logout" method="post">
                <button type="submit">Log out</button>
              </form>
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
