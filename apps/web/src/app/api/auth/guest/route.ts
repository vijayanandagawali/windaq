import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const guestSuffix = Math.floor(1000 + Math.random() * 9000);
    const userId = `guest_${guestSuffix}`;
    const user = {
      id: userId,
      phone: `+91999000${guestSuffix}`,
      role: 'USER' as const,
      isGuest: true,
      createdAt: new Date().toISOString()
    };

    const token = `guest_${Buffer.from(JSON.stringify({ userId, isGuest: true, exp: Date.now() + 86400000 })).toString('base64')}`;

    return NextResponse.json({
      success: true,
      message: 'Guest session created with ₹10,000 demo balance.',
      token,
      user,
      wallet: {
        balance: 10000,
        currency: 'INR'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to create guest session.' },
      { status: 500 }
    );
  }
}
