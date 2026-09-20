"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-ocean">
      <div className="animate-spin w-8 h-8 border-2 border-neon-mint border-t-transparent rounded-full" />
    </div>
  );
}
