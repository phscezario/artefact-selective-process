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
      {/*
        Some browser extensions (ColorZilla, Grammarly, ...) mutate <body> right
        before React hydrates. ColorZilla adds `cz-shortcut-listen`, which makes
        React log a hydration mismatch that is not our code's fault. This flag
        only silences attribute/text mismatches on this element, so a real
        mismatch anywhere inside the tree still surfaces.
      */}
      <body suppressHydrationWarning>
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
