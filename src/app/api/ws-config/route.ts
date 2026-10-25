import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ url: process.env.WS_PUBLIC_URL || null });
}
