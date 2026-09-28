import { NextResponse } from 'next/server';
import { CATEGORIES, GAMES } from '@/lib/games';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: { categories: CATEGORIES, games: GAMES }
  });
}
