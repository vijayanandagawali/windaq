"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import TrustFooter from '@/components/ui/TrustFooter';
import GlobalModalProvider from '@/components/GlobalModalProvider';
import GlobalBetSlip from '@/components/GlobalBetSlip';
import NetworkWatcher from '@/components/NetworkWatcher';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // Identify immersive fullscreen games where bottom nav and footer should be hidden to give maximum canvas space
  const isImmersiveGame = pathname?.startsWith('/games/') && (
    pathname.includes('/aviator') ||
    pathname.includes('/texas-holdem') ||
    pathname.includes('/slots') ||
    pathname.includes('/european-roulette') ||
    pathname.includes('/live-roulette') ||
    pathname.includes('/lightning-roulette') ||
    pathname.includes('/blackjack') ||
    pathname.includes('/rummy') ||
    pathname.includes('/teen-patti') ||
    pathname.includes('/dragon-tiger') ||
    pathname.includes('/andar-bahar') ||
    pathname.includes('/dice') ||
    pathname.includes('/scratch') ||
    pathname.includes('/lotto') ||
    pathname.includes('/colour-prediction') ||
    pathname.includes('/color-prediction')
  );

  // Trigger top route loading bar on path changes
  useEffect(() => {
    setIsNavigating(true);
    const t = setTimeout(() => setIsNavigating(false), 250);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-deep-ocean text-white font-sans selection:bg-neon-mint selection:text-deep-ocean relative">
        {/* Network & Offline Status */}
        <NetworkWatcher />

        {/* Global Loading Top Bar on Navigation */}
        {isNavigating && (
          <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-gradient-to-r from-neon-mint via-cyan-400 to-emerald-400 animate-pulse" />
        )}

        {/* Unified Responsive Application Header */}
        <Header />

        {/* Main Content Area */}
        <main className={`flex-1 w-full ${isImmersiveGame ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
          {children}
        </main>

        {/* Brand Trust Footer (Shown on non-immersive pages) */}
        {!isImmersiveGame && <TrustFooter />}

        {/* Mobile Sticky Bottom Navigation (Shown on non-immersive pages) */}
        {!isImmersiveGame && <BottomNav />}

        {/* Global Sportsbook Betslip */}
        <GlobalBetSlip />

        {/* Global Modals Manager (Deposit, Withdraw, Auth, VIP, Spin, Passbook, Notifications) */}
        <GlobalModalProvider />

        {/* Global Styled Toaster */}
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#0a192f',
              color: '#fff',
              border: '1px solid rgba(0, 255, 163, 0.3)',
              boxShadow: '0 0 20px rgba(0, 255, 163, 0.2)',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '12px'
            },
            success: {
              iconTheme: {
                primary: '#00FFA3',
                secondary: '#0a192f',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#0a192f',
              },
            }
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
