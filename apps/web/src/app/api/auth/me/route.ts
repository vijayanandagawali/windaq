import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, code: 'AUTH_REQUIRED', message: 'Missing Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    let decoded: any = null;

    if (token.startsWith('windaq_')) {
      const payloadBase64 = token.replace('windaq_', '');
      try {
        decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
      } catch {
        return NextResponse.json(
          { success: false, code: 'INVALID_TOKEN', message: 'Invalid token format' },
          { status: 401 }
        );
      }
    } else {
      // Standard JWT: extract payload
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        } catch {
          return NextResponse.json(
            { success: false, code: 'INVALID_TOKEN', message: 'Malformed JWT' },
            { status: 401 }
          );
        }
      }
    }

    if (!decoded) {
      return NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Could not decode session' },
        { status: 401 }
      );
    }

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = decoded.exp > 10000000000 ? Math.floor(decoded.exp / 1000) : decoded.exp;
    if (exp && exp < nowSec) {
      return NextResponse.json(
        { success: false, code: 'SESSION_EXPIRED', message: 'Session expired' },
        { status: 401 }
      );
    }

    const userId = decoded.userId || decoded.id;
    const phone = decoded.phone || '+919999900000';
    const role = decoded.role || 'USER';
    const isGuest = Boolean(decoded.isGuest);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        phone,
        role,
        isGuest,
        kycStatus: 'VERIFIED'
      },
      wallet: {
        balance: isGuest ? 50000 : 9420.00,
        currency: 'INR'
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
