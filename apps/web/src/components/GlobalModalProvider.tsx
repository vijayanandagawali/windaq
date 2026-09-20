"use client";

import React from 'react';
import BottomNav from '@/components/layout/BottomNav';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import PassbookModal from '@/components/modals/PassbookModal';
import VipClubModal from '@/components/modals/VipClubModal';
import ReferralModal from '@/components/modals/ReferralModal';
import DailySpinModal from '@/components/modals/DailySpinModal';
import NotifDrawer from '@/components/modals/NotifDrawer';

export default function GlobalModalProvider() {
  return (
    <>
      <BottomNav />
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
