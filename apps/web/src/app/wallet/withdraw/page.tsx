"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

// Legacy URL: the withdraw flow lives in the wallet modal, which reads its settings from the server.
export default function LegacyWithdrawPage() {
  const router = useRouter();
  const setWithdrawing = useWalletStore((s) => s.setWithdrawing);
  useEffect(() => {
    setWithdrawing(true);
    router.replace('/wallet');
  }, [setWithdrawing, router]);
  return null;
}
