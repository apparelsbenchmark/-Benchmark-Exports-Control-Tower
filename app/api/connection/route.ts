import { gasGet } from '@/lib/gas';
import type { TargetLine } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [health, targets] = await Promise.all([
      gasGet<{ system: string; status: string; timestamp: string }>('health'),
      gasGet<{ lines: TargetLine[]; timestamp: string }>('targets')
    ]);

    if (health.status !== 'connected') {
      throw new Error('Apps Script health check did not return connected status.');
    }
    if (!Array.isArray(targets.lines) || targets.lines.length !== 14) {
      throw new Error(`LINE MASTER must contain 14 line records. Received ${Array.isArray(targets.lines) ? targets.lines.length : 0}.`);
    }

    return Response.json({
      ok: true,
      connected: true,
      message: 'Connected to the Benchmark Control Tower Google Sheet.',
      system: health.system,
      lineCount: targets.lines.length,
      checkedAt: new Date().toISOString()
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return Response.json({
      ok: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Google Sheets connection test failed.'
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
