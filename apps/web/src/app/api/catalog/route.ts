import { NextResponse } from 'next/server';
import { DEFAULT_CATALOG } from '@/lib/defaultCatalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: DEFAULT_CATALOG
  });
}
