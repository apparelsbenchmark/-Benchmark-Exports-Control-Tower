import { NextRequest } from 'next/server';
import { gasGet, gasPost } from '@/lib/gas';
import { checkAdminPin } from '@/lib/auth';
import type { TargetLine } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await gasGet<{ lines: TargetLine[]; timestamp: string }>('targets');
    if (!Array.isArray(data.lines) || data.lines.length !== 14) {
      throw new Error(`LINE MASTER must return 14 lines. Received ${Array.isArray(data.lines) ? data.lines.length : 0}. Run setupEnterpriseControlTower() once in the bound Google Sheet if the sheet has not been initialized.`);
    }
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to load targets.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = checkAdminPin(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    if (!Array.isArray(body?.lines) || body.lines.length !== 14) {
      return Response.json({ ok: false, error: 'The target form must submit all 14 production lines.' }, { status: 400 });
    }

    const seen = new Set<number>();
    for (const item of body.lines) {
      const line = Number(item?.line);
      if (!Number.isInteger(line) || line < 1 || line > 14 || seen.has(line)) {
        return Response.json({ ok: false, error: 'Each line from 1 to 14 must appear exactly once.' }, { status: 400 });
      }
      seen.add(line);

      const numericFields = ['dailyTarget', 'smv', 'manpower', 'efficiencyTarget', 'dhuTarget', 'workingMinutes'];
      for (const field of numericFields) {
        const raw = item[field];
        if (raw === '' || raw == null) continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          return Response.json({ ok: false, error: `Line ${line}: ${field} must be a non-negative number.` }, { status: 400 });
        }
      }

      if (Array.isArray(item.hourlyTargets)) {
        if (item.hourlyTargets.length > 11) {
          return Response.json({ ok: false, error: `Line ${line}: no more than 11 hourly targets are allowed.` }, { status: 400 });
        }
        if (item.hourlyTargets.some((raw: unknown) => raw !== '' && raw != null && (!Number.isFinite(Number(raw)) || Number(raw) < 0))) {
          return Response.json({ ok: false, error: `Line ${line}: hourly targets must be non-negative numbers or blank.` }, { status: 400 });
        }
      }
    }

    const data = await gasPost<{ saved: boolean; lines: number; dataVersion?: string }>({
      ...body,
      action: 'targets.save'
    });
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to save targets.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
