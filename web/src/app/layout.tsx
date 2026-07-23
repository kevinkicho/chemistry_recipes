import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HistorySidebar } from "@/components/HistorySidebar";
import { HistoryTracker } from "@/components/HistoryTracker";
import {
  TableOfContents,
  TocBalanceSpacer,
} from "@/components/TableOfContents";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Chemistry Recipes",
    template: "%s · Chemistry Recipes",
  },
  description:
    "Evidence-first process recipe hub for pharmaceutical, clinical, and biotech manufacturing: dual-view routes, tech-transfer export, modality templates, and free public provenance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased flex flex-col bg-slate-950 text-slate-100`}
      >
        <Header />
        <HistoryTracker />
        {/*
          Layout: History | TOC | Main | TOC-width spacer
          The right spacer mirrors TOC width so dossier content (max-w-6xl)
          stays optically centered for the viewer when TOC is visible.
        */}
        <div className="flex min-h-0 flex-1">
          <HistorySidebar />
          <TableOfContents />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <TocBalanceSpacer />
        </div>
      </body>
    </html>
  );
}
