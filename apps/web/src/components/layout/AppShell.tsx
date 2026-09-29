"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import TrustFooter from '@/components/ui/TrustFooter';
import GlobalModalProvider from '@/components/GlobalModalProvider';
import GlobalBetSlip from '@/components/GlobalBetSlip';
import NetworkWatcher from '@/components/NetworkWatcher';
import DemoModeBanner from '@/components/layout/DemoModeBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { audioEngine } from '@/lib/audioEngine';

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
    pathname.includes('/ludo') ||
    pathname.includes('/fantasy/') ||
    pathname.includes('/colour-prediction') ||
    pathname.includes('/color-prediction')
  );

  // A light haptic tick on every tap of a control (touch only; respects the haptics setting).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const target = (e.target as Element | null)?.closest?.('button, [role="button"], a, .press');
      if (!target || (target as HTMLButtonElement).disabled || target.getAttribute('aria-disabled') === 'true') return;
      audioEngine.vibrate(8);
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // The admin console has its own navigation; the player bottom bar and footer stay out of its way.
  const hidePlayerChrome = isImmersiveGame || pathname?.startsWith('/admin');

  // Trigger top route loading bar on path changes
  useEffect(() => {
    setIsNavigating(true);
    const t = setTimeout(() => setIsNavigating(false), 250);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-deep-ocean text-slate-900 font-sans selection:bg-emerald-200 selection:text-slate-900 relative">
        {/* Network & Offline Status */}
        <NetworkWatcher />

        {/* Global Loading Top Bar on Navigation */}
        {isNavigating && (
          <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-gradient-to-r from-emerald-500 via-sky-500 to-pink-500 animate-pulse" />
        )}

        {/* Unified Responsive Application Header */}
        <Header />

        {/* Explicit demo notice while games run on the browser simulator */}
        <DemoModeBanner />

        {/* Main Content Area */}
        <main className={`flex-1 w-full ${hidePlayerChrome ? 'pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
          {/* Opacity-only fade: a transform here would re-anchor fixed overlays inside pages. */}
          <div key={pathname} className="animate-page">{children}</div>
        </main>

        {/* Brand Trust Footer (Shown on non-immersive pages) */}
        {!hidePlayerChrome && <TrustFooter />}

        {/* Mobile Sticky Bottom Navigation (Shown on non-immersive pages) */}
        {!hidePlayerChrome && <BottomNav />}

        {/* Global Sportsbook Betslip */}
        <GlobalBetSlip />

        {/* Global Modals Manager (Deposit, Withdraw, Auth, VIP, Spin, Passbook, Notifications) */}
        <GlobalModalProvider />

        {/* Global Styled Toaster */}
        <Toaster 
          position="top-center"
          containerStyle={{ top: 76 }}
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '14px'
            },
            success: { iconTheme: { primary: '#059669', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: '#E11D48', secondary: '#FFFFFF' } }
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
