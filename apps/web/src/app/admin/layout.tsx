"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  ActivitySquare,
  CreditCard,
  Coins,
  Gamepad2,
  Layers,
  History,
  LogOut,
  type LucideIcon
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface NavItem { href: string; label: string; icon: LucideIcon; iconClass?: string; badge?: string; live?: boolean }

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Core', items: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/kyc', label: 'KYC Verification', icon: ShieldCheck }
  ] },
  { section: 'Games & Operations', items: [
    { href: '/admin/realtime', label: 'Realtime Control', icon: ActivitySquare, iconClass: 'text-emerald-600', live: true },
    { href: '/admin/tables', label: 'Live Tables (Dealers)', icon: Layers, iconClass: 'text-amber-600', badge: 'AUTO' },
    { href: '/admin/games', label: 'Game Control', icon: Gamepad2, iconClass: 'text-emerald-600' },
    { href: '/admin/history', label: 'Result History & Audits', icon: History, iconClass: 'text-amber-600', badge: 'AUDIT' }
  ] },
  { section: 'Finance', items: [
    { href: '/admin/reconciliation', label: 'Wallet Reconciliation', icon: ShieldCheck, iconClass: 'text-emerald-600', badge: 'ENGINE' },
    { href: '/admin/payments', label: 'Payments & UPI', icon: CreditCard },
    { href: '/admin/adjustments', label: 'Manual Adjustments', icon: Coins },
    { href: '/admin/ledger', label: 'Double-Entry Ledger', icon: ActivitySquare }
  ] },
  { section: 'Security', items: [
    { href: '/admin/risk', label: 'Risk & Anti-Fraud', icon: ShieldCheck },
    { href: '/admin/audit', label: 'Audit Logs', icon: ActivitySquare }
  ] }
];

const isActive = (pathname: string, href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname() || '/admin';

  return (
    <ProtectedRoute requiredRole="ADMIN" title="WINDAQ OPS CONSOLE">
      <div className="bg-white text-slate-800 lg:flex lg:h-[calc(100vh-64px)] lg:overflow-hidden">
        {/* Phones and tablets: a sticky, horizontally scrolling section strip instead of the sidebar. */}
        <nav className="sticky top-[64px] z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Admin sections">
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-500" /> WinDaq Ops</span>
            <span className="text-[11px] font-bold text-emerald-600">{user?.role || ''}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
            {NAV.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white/90 backdrop-blur lg:flex">
          <div className="flex items-center gap-3 border-b border-slate-200 p-6">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <h1 className="text-lg font-bold tracking-tight">WinDaq Ops</h1>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Admin sections">
            {NAV.map((group, gi) => (
              <React.Fragment key={group.section}>
                <div className={`mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 ${gi === 0 ? 'mt-4' : 'mt-6'}`}>{group.section}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                      className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm ${active ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <span className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${item.iconClass || ''}`} /> {item.label}
                      </span>
                      {item.live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
                      {item.badge && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${item.badge === 'ENGINE' ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-600' : 'border-amber-500/30 bg-amber-500/20 text-amber-600'}`}>{item.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="truncate">
                <p className="truncate font-medium text-slate-900">{user?.phone || user?.id || 'Admin'}</p>
                <p className="text-xs font-bold text-emerald-600">{user?.role || ''}</p>
              </div>
              <button onClick={() => logout()} title="Log out"
                className="cursor-pointer rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 lg:flex lg:flex-col lg:overflow-hidden">
          <div className="p-4 sm:p-6 lg:flex-1 lg:overflow-y-auto lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
