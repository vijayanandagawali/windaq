import { NextResponse } from 'next/server';
import { normalizePhone, sendOtpSms } from '@/lib/smsService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone: rawPhone, referralCode } = body;

    if (!rawPhone) {
      return NextResponse.json(
        { success: false, message: 'Please provide your mobile number.' },
        { status: 400 }
      );
    }

    const { e164, digits10 } = normalizePhone(rawPhone);

    if (digits10.length !== 10) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    // 1. Dispatch real SMS OTP via Fast2SMS
    try {
      await sendOtpSms(digits10);
    } catch (smsErr) {
      console.warn('Fast2SMS send warning:', smsErr);
    }

    // 2. Generate user session with ₹500 Welcome Bonus
    const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const user = {
      id: userId,
      phone: e164,
      role: 'USER' as const,
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    // Lightweight browser-compatible session token
    const token = `windaq_${Buffer.from(JSON.stringify({ userId, phone: e164, role: 'USER', exp: Date.now() + 86400000 })).toString('base64')}`;

    return NextResponse.json({
      success: true,
      message: 'Registration successful! ₹500 welcome bonus credited to your wallet.',
      token,
      user,
      wallet: {
        balance: 500,
        currency: 'INR'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { success: false, message: 'Registration server encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}
