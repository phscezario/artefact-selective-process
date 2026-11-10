import type { Metadata } from 'next';
import Link from 'next/link';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task Manager · Artefact written case',
  description:
    'Small task manager built with Next.js 15 (App Router) and a tRPC API over an in-memory store.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
            <header className="site-header">
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden="true">
                  ✓
                </span>
                Task Manager
              </Link>

              <nav className="site-nav" aria-label="Main">
                <Link href="/tasks/new" className="btn btn-primary btn-sm">
                  New task
                </Link>
              </nav>
            </header>

            <main className="site-main">{children}</main>

            <footer className="site-footer">
              <span>In-memory demo · tasks reset when the server restarts.</span>
              <span className="footer-sep" aria-hidden="true">
                ·
              </span>
              <a href="https://github.com/phscezario/artefact-selective-process" rel="noreferrer">
                Source code
              </a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
