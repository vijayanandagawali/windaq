import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await params;
    const body = await request.json();
    const targetUrl = `${REALTIME_URL}/api/admin/results/${encodeURIComponent(resultId)}/correct`;
    
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        next: { revalidate: 0 }
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (backendErr) {
      console.warn('[NextAPI:ResultCorrect] Backend proxy failed:', backendErr);
    }

    return NextResponse.json(
      { success: false, error: 'Realtime service unavailable' },
      { status: 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
