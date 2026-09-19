import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-6 px-5 py-6 sm:px-8 sm:py-7">
          <Link
            href="/"
            className="font-serif text-[1.5rem] leading-none tracking-tight text-ink transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-cobalt"
          >
            Analog Archive
          </Link>
          <nav className="flex items-baseline gap-5">
            <Link
              href="/search"
              className="meta transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-ink"
            >
              Search
            </Link>
            <p className="meta hidden sm:block">Film · frames · process</p>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}
