"use client";

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Wifi } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';

export default function AndroidStatusBar() {
  const [time, setTime] = useState('12:00');
  const { soundEnabled, toggleSound } = useAudioStore();

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#05070d] text-gray-400 text-[11px] font-bold px-4 py-1.5 flex items-center justify-between border-b border-white/5 select-none z-50">
      <div className="flex items-center gap-1.5 text-white font-extrabold tracking-wide">
        <span>{time}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button 
          onClick={toggleSound} 
          className="hover:text-neon-mint transition-colors cursor-pointer"
          title={soundEnabled ? "Mute Sound" : "Unmute Sound"}
          aria-label={soundEnabled ? "Mute Sound" : "Unmute Sound"}
        >
          {soundEnabled ? <Volume2 size={13} className="text-neon-mint" /> : <VolumeX size={13} className="text-red-400" />}
        </button>
        <span className="text-[10px] text-gray-300 font-black tracking-wider">5G</span>
        <Wifi size={12} className="text-gray-300" />
        <span className="text-[10px] text-neon-mint font-extrabold">98% 🔋</span>
      </div>
    </div>
  );
}
