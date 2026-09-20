"use client";

import React from 'react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import { Pickaxe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ComingSoon({ title }: { title: string }) {
  const router = useRouter();
  
  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint selection:text-deep-ocean flex flex-col">
      <Header />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
          <Pickaxe size={48} className="text-neon-mint" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">{title}</h1>
        <p className="text-gray-400 mb-8 max-w-xs">We are currently building this module. It will be available very soon!</p>
        
        <button 
          onClick={() => router.back()}
          className="btn-neon px-8 py-3 rounded-xl font-bold"
        >
          Go Back
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
