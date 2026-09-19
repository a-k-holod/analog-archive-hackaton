import { ArchiveProvider } from "@/components/ArchiveProvider";
import { AppShell } from "@/components/AppShell";
import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Analog Archive",
  description: "A digital archive for analog photography, including process and context.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full bg-paper font-sans text-ink antialiased">
        <ArchiveProvider>
          <AppShell>{children}</AppShell>
        </ArchiveProvider>
      </body>
    </html>
  );
}
