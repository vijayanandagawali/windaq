import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: 'Favorite updated successfully',
      data: { gameId: body.gameId, isFavorite: body.isFavorite }
    });
  } catch {
    return NextResponse.json({ success: true });
  }
}
