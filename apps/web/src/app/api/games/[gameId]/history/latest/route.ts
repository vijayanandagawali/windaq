import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';
    const variantId = searchParams.get('variantId') || '';

    const targetUrl = `${REALTIME_URL}/api/games/${encodeURIComponent(gameId)}/history/latest?limit=${limit}&variantId=${variantId}`;
    
    try {
      const res = await fetch(targetUrl, { next: { revalidate: 0 } });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (backendErr) {
      console.warn('[NextAPI:HistoryLatest] Backend proxy failed:', backendErr);
    }

    return NextResponse.json({
      success: true,
      gameId,
      limit: Number(limit),
      history: []
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
