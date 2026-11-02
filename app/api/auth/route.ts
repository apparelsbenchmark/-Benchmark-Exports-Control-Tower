import { NextRequest } from 'next/server';
import { getPinConfigurationStatus, verifyAccessPin } from '@/lib/auth';
import type { AccessRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  // Return booleans only. Never return configured PIN values.
  return Response.json(
    { ok: true, configured: getPinConfigurationStatus() },
    { headers: noStore }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = body?.role;

    if (role !== 'admin' && role !== 'supervisor') {
      return Response.json(
        { ok: false, error: 'A valid access role is required.' },
        { status: 400, headers: noStore }
      );
    }

    const pin = request.headers.get('x-control-pin') || '';
    const result = verifyAccessPin(role as AccessRole, pin);

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: result.status, headers: noStore }
      );
    }

    return Response.json(
      { ok: true, role, message: 'PIN verified. The write API will verify it again when saving.' },
      { headers: noStore }
    );
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid verification request. Send a JSON body containing the role.' },
      { status: 400, headers: noStore }
    );
  }
}
