import type { Metadata } from "next";
import { Instrument_Sans, Syne, Fredoka } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const bubble = Fredoka({
  subsets: ["latin"],
  variable: "--font-bubble",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CoinCanvas",
  description: "A guided crypto market canvas for beginners who want context before action.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${bubble.variable}`}>{children}</body>
    </html>
  );
}
