import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REALTIME_URL = process.env.REALTIME_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const authHeader = request.headers.get('authorization');

  try {
    const targetUrl = `${REALTIME_URL}/api/admin/reconciliation/run`;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(authHeader ? { 'authorization': authHeader } : {})
      }
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Error executing reconciliation sweep' },
      { status: 500 }
    );
  }
}
