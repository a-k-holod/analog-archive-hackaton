import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-6 px-6 py-5">
          <Link href="/" className="font-serif text-[1.35rem] leading-none tracking-tight text-ink">
            Analog Archive
          </Link>
          <p className="hidden text-sm text-muted sm:block">Film rolls, frames, and process</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
