import { NextRequest } from 'next/server';
import { gasPost } from '@/lib/gas';
import { checkInputPin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export async function POST(request: NextRequest) {
  const denied = checkInputPin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const line = Number(body?.line);
    const hour = Number(body?.hour);
    const pcs = Number(body?.pcs);

    if (!isDateKey(body?.date)) {
      return Response.json({ ok: false, error: 'Select a valid production date.' }, { status: 400 });
    }
    if (!Number.isInteger(line) || line < 1 || line > 14) {
      return Response.json({ ok: false, error: 'Select a production line from 1 to 14.' }, { status: 400 });
    }
    if (!Number.isInteger(hour) || hour < 1 || hour > 11) {
      return Response.json({ ok: false, error: 'Select an hour slot from H1 to H11.' }, { status: 400 });
    }
    if (!Number.isInteger(pcs) || pcs < 0) {
      return Response.json({ ok: false, error: 'Production PCS must be a whole number greater than or equal to zero.' }, { status: 400 });
    }

    const data = await gasPost<{ saved: boolean; duplicate?: boolean; requestId: string; savedAt?: string; dataVersion?: string }>({
      ...body,
      action: 'production.save',
      line,
      hour,
      pcs
    });

    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to save production.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
