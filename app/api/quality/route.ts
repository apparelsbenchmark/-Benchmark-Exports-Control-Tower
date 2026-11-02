import { NextRequest } from 'next/server';
import { gasGet } from '@/lib/gas';
import type { QualityData } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || undefined;
    const data = await gasGet<QualityData>('quality', date);
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Unable to load quality data.' }, { status: 502 });
  }
}
