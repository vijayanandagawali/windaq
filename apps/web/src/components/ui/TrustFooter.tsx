import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, BadgeCheck, Smartphone } from 'lucide-react';

const BADGES = [
  { icon: Lock, label: 'Encrypted (HTTPS)', tone: 'text-sky-600 bg-sky-50' },
  { icon: BadgeCheck, label: 'Provably fair', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: ShieldCheck, label: 'Double-entry ledger', tone: 'text-violet-600 bg-violet-50' },
  { icon: Smartphone, label: 'UPI deposits', tone: 'text-amber-600 bg-amber-50' }
];

const LINKS = [
  { href: '/fairness', label: 'Fairness' },
  { href: '/responsible-gaming', label: 'Responsible gaming' },
  { href: '/support', label: 'Support' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' }
];

export default function TrustFooter() {
  return (
    <footer className="mt-4 w-full border-t border-slate-200 bg-white px-4 pb-32 pt-12 lg:pb-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-base font-black text-white">W</span>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">WinDaq</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Every round is locked to a hashed server seed before bets close, and every rupee is recorded on a double-entry ledger.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-semibold text-slate-600 transition hover:text-emerald-600">{l.label}</Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-wrap gap-2.5">
          {BADGES.map(({ icon: Icon, label, tone }) => (
            <span key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${tone}`}><Icon size={13} /></span>
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">18+ only · Play responsibly</span>
        </div>

        <p className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">© {new Date().getFullYear()} WinDaq. Games are for entertainment. Never play with money you cannot afford to lose.</p>
      </div>
    </footer>
  );
}
