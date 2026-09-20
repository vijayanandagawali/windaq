import { NextResponse } from 'next/server';
import { sendOtpSms, normalizePhone } from '@/lib/smsService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required.' },
        { status: 400 }
      );
    }

    const { digits10 } = normalizePhone(phone);
    if (digits10.length !== 10) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 10-digit Indian phone number.' },
        { status: 400 }
      );
    }

    const result = await sendOtpSms(phone);

    return NextResponse.json({
      success: true,
      message: result.message,
      phone: `+91 ${digits10}`
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}
