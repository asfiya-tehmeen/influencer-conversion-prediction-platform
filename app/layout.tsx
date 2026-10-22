import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Taseer",
  description: "Predict influencer conversions and cost per acquisition before you spend.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">T</span>
              Taseer
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
