import { NextResponse } from 'next/server';
import { normalizePhone, verifyOtp } from '@/lib/smsService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone: rawPhone, otp } = body;

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

    // Verify OTP if provided, or default login
    if (otp) {
      const isValid = verifyOtp(digits10, otp);
      if (!isValid) {
        return NextResponse.json(
          { success: false, message: 'Invalid OTP code. Please enter the code sent via SMS.' },
          { status: 401 }
        );
      }
    }

    const userId = `usr_${digits10}`;
    const user = {
      id: userId,
      phone: e164,
      role: 'USER' as const,
      isGuest: false,
      createdAt: new Date().toISOString()
    };

    const token = `windaq_${Buffer.from(JSON.stringify({ userId, phone: e164, role: 'USER', exp: Date.now() + 86400000 })).toString('base64')}`;

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user,
      wallet: {
        balance: 9420.00,
        currency: 'INR'
      }
    });

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, message: 'Login encountered an error. Please try again.' },
      { status: 500 }
    );
  }
}
