import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import PWARegister from "@/components/pwa-register";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BuildLens — Construction Operations Platform",
  description: "Construction operations, organized.",
  icons: {
    icon: "/brand/buildlens-mark.png",
    apple: "/brand/buildlens-mark.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="bg-canvas text-ink font-sans text-sm antialiased selection:bg-accent-subtle selection:text-accent-text">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
