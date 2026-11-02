import { NextRequest } from 'next/server';
import { gasGet, gasPost } from '@/lib/gas';
import { checkInputPin } from '@/lib/auth';
import type { TargetLine } from '@/lib/types';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const data = await gasGet<{ lines: TargetLine[]; timestamp: string }>('targets');
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Unable to load targets.' }, { status: 502 });
  }
}
export async function POST(request: NextRequest) {
  const denied = checkInputPin(request); if (denied) return denied;
  try {
    const body = await request.json();
    const data = await gasPost<{ saved: boolean; lines: number }>( { action: 'targets.save', ...body } );
    return Response.json({ ok: true, data });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Unable to save targets.' }, { status: 502 });
  }
}
