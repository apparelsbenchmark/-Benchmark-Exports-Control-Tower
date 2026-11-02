import { NextRequest } from 'next/server';
import { gasPost } from '@/lib/gas';
import { checkInputPin } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const denied = checkInputPin(request); if (denied) return denied;
  try {
    const body = await request.json();
    const data = await gasPost<{ saved: boolean; duplicate?: boolean; requestId: string; savedAt?: string }>({ action: 'production.save', ...body });
    return Response.json({ ok: true, data });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'Unable to save production.' }, { status: 502 });
  }
}
