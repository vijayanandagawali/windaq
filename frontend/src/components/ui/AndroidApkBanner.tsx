"use client";

import React from 'react';
import { Smartphone, Download, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AndroidApkBanner() {
  const handleInstall = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    toast.success('Downloading WinDaq Android APK (v2.5.0)...', {
      icon: '🤖',
      duration: 3500
    });
    setTimeout(() => {
      toast('Tap "Add to Home Screen" to install WinDaq as native Android App!', {
        icon: '📲',
        duration: 4000
      });
    }, 1500);
  };

  return (
    <div className="mx-4 my-3 bg-gradient-to-r from-emerald-950/70 via-gray-900 to-blue-950/70 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between shadow-[0_4px_20px_rgba(16,185,129,0.15)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-neon-mint/5 to-transparent pointer-events-none" />
      
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-deep-ocean font-black shadow-[0_0_15px_rgba(16,185,129,0.5)]">
          <Smartphone size={22} className="text-deep-ocean" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-white tracking-wide">WINDAQ ANDROID APP (.APK)</span>
            <span className="bg-neon-mint/20 text-neon-mint text-[9px] font-black px-1.5 py-0.2 rounded border border-neon-mint/30">V2.5</span>
          </div>
          <p className="text-[11px] text-gray-300 flex items-center gap-1 mt-0.5">
            <Sparkles size={11} className="text-yellow-400" />
            <span>Install on mobile for 2X faster gameplay</span>
          </p>
        </div>
      </div>

      <button 
        onClick={handleInstall}
        className="relative z-10 bg-gradient-to-r from-neon-mint to-emerald-400 hover:from-neon-mint hover:to-green-300 text-deep-ocean font-black text-xs px-3.5 py-2 rounded-xl shadow-[0_0_15px_rgba(0,255,163,0.4)] flex items-center gap-1.5 active:scale-95 transition-transform"
      >
        <Download size={13} strokeWidth={3} />
        <span>INSTALL</span>
      </button>
    </div>
  );
}
