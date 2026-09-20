import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import GlobalBetSlip from '@/components/GlobalBetSlip';
import NetworkWatcher from '@/components/NetworkWatcher';
import Header from '@/components/layout/Header';
import GlobalModalProvider from '@/components/GlobalModalProvider';

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
      <body className="antialiased selection:bg-neon-mint selection:text-deep-ocean overscroll-none touch-pan-y safe-area-pt">
        <NetworkWatcher />
        <Header />
        {children}
        <GlobalBetSlip />
        <GlobalModalProvider />
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#0a192f',
              color: '#fff',
              border: '1px solid rgba(0, 255, 163, 0.3)',
              boxShadow: '0 0 20px rgba(0, 255, 163, 0.2)'
            },
            success: {
              iconTheme: {
                primary: '#00FFA3',
                secondary: '#0a192f',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
