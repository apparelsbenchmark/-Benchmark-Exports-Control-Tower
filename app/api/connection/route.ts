import { gasGet } from '@/lib/gas';
import type { TargetLine } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await gasGet<{ lines: TargetLine[]; timestamp: string }>('targets');

    if (!Array.isArray(result.lines) || result.lines.length !== 14) {
      throw new Error(
        `Apps Script responded, but LINE MASTER data is incomplete. Expected 14 line records and received ${Array.isArray(result.lines) ? result.lines.length : 0}.`
      );
    }

    return Response.json({
      ok: true,
      connected: true,
      message: 'Connected to the Benchmark Control Tower Google Sheet.',
      lineCount: result.lines.length,
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
