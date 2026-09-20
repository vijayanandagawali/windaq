import React from 'react';
import { ShieldCheck, Lock, Award, CheckCircle } from 'lucide-react';

export default function TrustFooter() {
  return (
    <footer className="w-full bg-[#050814] border-t border-white/5 py-12 px-4 mt-8 pb-32">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        
        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-6 mb-8">
          <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
            <ShieldCheck size={32} className="text-neon-mint mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">256-Bit SSL</span>
          </div>
          <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
            <CheckCircle size={32} className="text-blue-500 mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">Provably Fair</span>
          </div>
          <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
            <Lock size={32} className="text-yellow-500 mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">Secure Payouts</span>
          </div>
          <div className="flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
            <Award size={32} className="text-purple-500 mb-2" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">Provably Fair</span>
          </div>
          <div className="flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 text-red-500 flex items-center justify-center font-black text-xs mb-2">
              18+
            </div>
            <span className="text-white text-xs font-bold uppercase tracking-wider">Play Responsibly</span>
          </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

        <div className="text-center max-w-2xl">
          <h4 className="text-white font-black tracking-widest uppercase mb-4 opacity-50">WinDaq Originals</h4>
          <p className="text-gray-500 text-[10px] leading-relaxed mb-4">
            WinDaq operates a proprietary Provably Fair gaming engine. Cryptographic hashes are generated before every round, ensuring zero manipulation. All payouts and balances are settled on our secure, lightning-fast ledger.
          </p>
          <div className="flex justify-center gap-4 text-xs font-bold text-gray-400">
            <a href="#" className="hover:text-neon-mint transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-neon-mint transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-neon-mint transition-colors">KYC / AML</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
