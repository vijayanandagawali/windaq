import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Users, 
  WalletCards, 
  ActivitySquare,
  CreditCard,
  Coins,
  Gamepad2,
  LogOut
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Mock Admin ID for demo. Real implementation would fetch this from session context.
  const mockAdminId = "SUPER_ADMIN_DEMO_001";
  
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <ShieldCheck className="text-emerald-500 w-8 h-8" />
          <h1 className="text-lg font-bold tracking-tight">WinDaq Ops</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-2">Core</div>
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <Users className="w-4 h-4" /> Users
          </Link>
          <Link href="/admin/kyc" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <ShieldCheck className="w-4 h-4" /> KYC Verification
          </Link>

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-2">Games & Operations</div>
          <Link href="/admin/games" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <Gamepad2 className="w-4 h-4 text-emerald-400" /> Game Control
          </Link>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-2">Finance</div>
          <Link href="/admin/payments" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <CreditCard className="w-4 h-4" /> Payments & UPI
          </Link>
          <Link href="/admin/adjustments" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <Coins className="w-4 h-4" /> Manual Adjustments
          </Link>
          <Link href="/admin/ledger" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <ActivitySquare className="w-4 h-4" /> Double-Entry Ledger
          </Link>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-2">Security</div>
          <Link href="/admin/risk" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <ShieldCheck className="w-4 h-4" /> Risk & Anti-Fraud
          </Link>
          <Link href="/admin/audit" className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-slate-800 hover:text-white text-slate-300">
            <ActivitySquare className="w-4 h-4" /> Audit Logs
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800 text-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="truncate">
              <p className="text-white font-medium truncate">{mockAdminId}</p>
              <p className="text-emerald-400 text-xs">SUPER_ADMIN</p>
            </div>
            <LogOut className="w-5 h-5 text-slate-500 hover:text-white cursor-pointer" />
          </div>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
