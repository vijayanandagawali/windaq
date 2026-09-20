import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: "#0A1128",
};

export const metadata: Metadata = {
  title: "WinDaq | Elite Real-Money Gaming",
  description: "100% Safe & Secure Real-Money Gaming Platform. Play Aviator, Live Casino, and Sportsbook.",
  manifest: "/manifest.json",
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
      <body className="min-h-full flex flex-col">
        {children}
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
