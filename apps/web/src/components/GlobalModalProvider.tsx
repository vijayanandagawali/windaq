"use client";

import React, { useEffect } from 'react';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import PassbookModal from '@/components/modals/PassbookModal';
import VipClubModal from '@/components/modals/VipClubModal';
import ReferralModal from '@/components/modals/ReferralModal';
import DailySpinModal from '@/components/modals/DailySpinModal';
import NotifDrawer from '@/components/modals/NotifDrawer';
import AuthModal from '@/components/modals/AuthModal';
import { useAuthStore } from '@/store/authStore';

export default function GlobalModalProvider() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <>
      <AuthModal />
      <DepositModal />
      <WithdrawModal />
      <PassbookModal />
      <VipClubModal />
      <ReferralModal />
      <DailySpinModal />
      <NotifDrawer />
    </>
  );
}
