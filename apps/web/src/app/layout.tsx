import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppShell from '@/components/layout/AppShell';

// Self-hosted (SIL Open Font License) so builds never depend on reaching Google Fonts.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  weight: "400 800",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "400 700",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F8FC",
};

export const metadata: Metadata = {
  title: "WinDaq | Fair games, instant results",
  description: "Roulette, Andar Bahar, Aviator, Sic Bo and more. Every round settled on our server and verifiable.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
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
      className={`${jakarta.variable} ${geistMono.variable} antialiased`}
    >
      <body className="antialiased selection:bg-emerald-200 selection:text-slate-900 bg-deep-ocean min-h-screen text-slate-900">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
