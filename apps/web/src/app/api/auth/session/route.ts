import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ success: false, message: 'No session' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: 'usr_current',
      role: 'USER',
      isGuest: false
    }
  });
}
