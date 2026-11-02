import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export type AccessRole = 'admin' | 'supervisor';

type PinCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

function expectedPin(role: AccessRole): string {
  const dedicated = role === 'admin'
    ? process.env.ADMIN_ACCESS_PIN
    : process.env.SUPERVISOR_ACCESS_PIN;

  return (dedicated || process.env.CONTROL_TOWER_PIN || '').trim();
}

/** Exposes configuration state only; PIN values are never returned. */
export function getPinConfigurationStatus() {
  return {
    admin: Boolean(expectedPin('admin')),
    supervisor: Boolean(expectedPin('supervisor')),
    sharedFallback: Boolean(process.env.CONTROL_TOWER_PIN?.trim()),
  };
}

function constantTimeEqual(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyAccessPin(role: AccessRole, suppliedPin: string): PinCheck {
  const expected = expectedPin(role);

  if (!expected) {
    const variable = role === 'admin' ? 'ADMIN_ACCESS_PIN' : 'SUPERVISOR_ACCESS_PIN';
    return {
      ok: false,
      status: 503,
      error: `${variable} or CONTROL_TOWER_PIN is not configured. Add it to .env.local and restart the server.`
    };
  }

  const supplied = String(suppliedPin || '').trim();
  if (!supplied || !constantTimeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: 'Invalid access PIN. Check the PIN and try again.' };
  }

  return { ok: true };
}

export function checkAccessPin(request: NextRequest, role: AccessRole): Response | null {
  const supplied = request.headers.get('x-control-pin') || '';
  const result = verifyAccessPin(role, supplied);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: result.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return null;
}

export function checkInputPin(request: NextRequest): Response | null {
  return checkAccessPin(request, 'supervisor');
}

export function checkAdminPin(request: NextRequest): Response | null {
  return checkAccessPin(request, 'admin');
}
