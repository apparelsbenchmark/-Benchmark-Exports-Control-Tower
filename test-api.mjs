import fs from 'node:fs';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

async function callAppsScript(endpoint, action, token) {
  const url = new URL(endpoint);
  url.searchParams.set('action', action);
  url.searchParams.set('token', token);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });

  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    if (/accounts\.google\.com|ServiceLogin|Sign in to continue/i.test(raw)) {
      throw new Error('Google returned a sign-in page. Check Web App access and deploy a new version with access set to Anyone if your Workspace allows it.');
    }
    throw new Error(`The endpoint did not return JSON (HTTP ${response.status}). Check the /exec URL and deployment access.`);
  }

  if (!response.ok) {
    throw new Error(`Apps Script returned HTTP ${response.status}.`);
  }
  if (body?.ok === false) {
    const message = typeof body.error === 'string' ? body.error : 'Apps Script returned ok:false.';
    if (/unauthorized api request/i.test(message)) {
      throw new Error('The API token was rejected. APPS_SCRIPT_TOKEN must exactly match CT_API_TOKEN in Apps Script Script Properties.');
    }
    throw new Error(`Apps Script API error: ${message}`);
  }
  if (body?.ok !== true || !Object.prototype.hasOwnProperty.call(body, 'data')) {
    if (body && !Object.prototype.hasOwnProperty.call(body, 'ok') &&
        ('success' in body || 'system' in body || 'status' in body)) {
      throw new Error(
        `The URL is reaching an OLD or DIFFERENT Apps Script handler. Returned fields: ${Object.keys(body).join(', ')}. Replace the bound project's Code.gs with the supplied complete merged Code.gs, ensure it is the only active doGet/doPost handler, save, and deploy a NEW VERSION.`
      );
    }
    throw new Error(`Unexpected Apps Script response. Fields received: ${body && typeof body === 'object' ? Object.keys(body).join(', ') : 'not an object'}. Expected { ok: true, data: ... }.`);
  }
  return body.data;
}

async function main() {
  loadEnvFile('.env.local');

  const rawUrl = process.env.APPS_SCRIPT_URL?.trim();
  const token = process.env.APPS_SCRIPT_TOKEN?.trim();

  if (!rawUrl || !token) {
    throw new Error('APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN is missing. Create/update vercel-app/.env.local first.');
  }

  let endpoint;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new Error('APPS_SCRIPT_URL is not a valid URL.');
  }

  if (endpoint.protocol !== 'https:' || !endpoint.pathname.endsWith('/exec')) {
    throw new Error('APPS_SCRIPT_URL must be the HTTPS Google Apps Script Web App URL ending in /exec.');
  }

  const health = await callAppsScript(endpoint.toString(), 'health', token);
  if (health?.status !== 'connected') {
    throw new Error('Apps Script health check did not return status=connected.');
  }

  const targets = await callAppsScript(endpoint.toString(), 'targets', token);
  if (!Array.isArray(targets?.lines) || targets.lines.length !== 14) {
    throw new Error(`Google Sheets is reachable, but LINE MASTER did not return 14 records. Received ${Array.isArray(targets?.lines) ? targets.lines.length : 0}. Run setupEnterpriseControlTower() once if this is a first-time installation.`);
  }

  console.log('CONNECTION TEST PASSED');
  console.log(`Apps Script system: ${health.system || 'connected'}`);
  console.log(`LINE MASTER records: ${targets.lines.length}`);
  console.log('Credentials: not displayed');
}

main().catch(error => {
  console.error('\nCONNECTION TEST FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('\nCredentials are never printed by this test.\n');
  process.exitCode = 1;
});
