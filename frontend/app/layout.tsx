import "./globals.css";
import "./motion.css";
import "./ui-refresh.css";
import "./sidebar.css";
import type { Metadata } from "next";
import PWARegister from "@/components/pwa-register";
export const metadata: Metadata = {
  title: "BuildLens",
  description: "Construction operations, organized.",
  icons: { icon: "/brand/buildlens-mark.png", apple: "/brand/buildlens-mark.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><PWARegister />{children}</body></html>; }
