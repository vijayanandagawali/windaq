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
    const limit = searchParams.get('limit') || '20';
    const page = searchParams.get('page') || '1';
    const variantId = searchParams.get('variantId') || '';
    const tableId = searchParams.get('tableId') || '';

    // Proxy to realtime backend
    const targetUrl = `${REALTIME_URL}/api/games/${encodeURIComponent(gameId)}/history?limit=${limit}&page=${page}&variantId=${variantId}&tableId=${tableId}`;
    
    try {
      const res = await fetch(targetUrl, { next: { revalidate: 0 } });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (backendErr) {
      console.warn('[NextAPI:History] Backend proxy failed, checking fallback:', backendErr);
    }

    // Graceful fallback response
    return NextResponse.json({
      success: true,
      gameId,
      variantId: variantId || 'ALL',
      page: Number(page),
      limit: Number(limit),
      total: 0,
      totalPages: 1,
      history: []
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
