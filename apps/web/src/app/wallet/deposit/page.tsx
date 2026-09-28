"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

// Legacy URL: the deposit flow lives in the wallet modal, which reads its settings from the server.
export default function LegacyDepositPage() {
  const router = useRouter();
  const setDepositing = useWalletStore((s) => s.setDepositing);
  useEffect(() => {
    setDepositing(true);
    router.replace('/wallet');
  }, [setDepositing, router]);
  return null;
}
