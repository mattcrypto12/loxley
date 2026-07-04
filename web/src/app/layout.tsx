import type { Metadata } from "next";
import { Cinzel, Outfit, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { FirefliesCanvas } from "@/components/FirefliesCanvas";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Loxley — The outlaw's true name",
  description:
    "The flagship DEX of Robinhood Chain. Steal the spread, share the spoils.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${outfit.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div className="forest-base" aria-hidden />
        <div className="forest-mist one" aria-hidden />
        <div className="forest-mist two" aria-hidden />
        <FirefliesCanvas />
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-6xl px-4 pb-8">
            <div className="gold-divider mb-4" />
            <p className="text-center text-xs leading-relaxed text-moon-700">
              Loxley is themed on the public-domain legend of Robin of Loxley
              and is not affiliated with Robinhood Markets, Inc.
              <br />
              Contracts are <span className="text-gold-600">unaudited</span> —
              testnet and demonstration use only. Never supply funds you
              cannot afford to lose.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
