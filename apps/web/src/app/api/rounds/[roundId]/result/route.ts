import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    const targetUrl = `${REALTIME_URL}/api/rounds/${encodeURIComponent(roundId)}/result`;
    
    try {
      const res = await fetch(targetUrl, { next: { revalidate: 0 } });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (backendErr) {
      console.warn('[NextAPI:RoundResult] Backend proxy failed:', backendErr);
    }

    return NextResponse.json(
      { success: false, error: 'Round result not found or backend unavailable' },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
