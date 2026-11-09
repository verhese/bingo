import { isGameServiceReady } from '@/server/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ready = await isGameServiceReady();
  return Response.json(
    { status: ready ? 'ok' : 'unavailable' },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
