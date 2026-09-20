import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from '@/components/layout/AppShell';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A1128",
};

export const metadata: Metadata = {
  title: "WinDaq | Premium Next-Gen Casino",
  description: "Experience the ultimate crypto & fiat gaming platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WinDaq"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="antialiased selection:bg-neon-mint selection:text-deep-ocean overscroll-none touch-pan-y safe-area-pt bg-deep-ocean">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
