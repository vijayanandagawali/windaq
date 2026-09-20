'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function NetworkWatcher() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Network disconnected. Financial actions disabled.', { id: 'network-status', duration: Infinity });
    };

    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Network restored. Reconnected to WinDaq.', { id: 'network-status', duration: 4000 });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white font-bold text-sm py-2 px-4 flex items-center justify-center gap-3 shadow-lg"
        >
          <WifiOff size={18} />
          <span>You are currently offline. Betting and transactions are paused until connection is restored.</span>
          <RefreshCcw size={16} className="animate-spin ml-2 opacity-50" />
          
          {/* Cover layer to prevent interactions globally while offline */}
          <div className="fixed inset-0 top-10 bg-black/20 backdrop-blur-[1px] z-[99]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
