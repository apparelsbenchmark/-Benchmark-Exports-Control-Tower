import { NextRequest } from 'next/server';

export function checkInputPin(request: NextRequest): Response | null {
  const expected = process.env.CONTROL_TOWER_PIN;
  if (!expected) return Response.json({ ok: false, error: 'CONTROL_TOWER_PIN is not configured in Vercel.' }, { status: 503 });
  const supplied = request.headers.get('x-control-pin') || '';
  if (supplied !== expected) return Response.json({ ok: false, error: 'Invalid access PIN.' }, { status: 401 });
  return null;
}
