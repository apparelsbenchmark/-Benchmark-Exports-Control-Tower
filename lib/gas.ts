type AppsScriptEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

function config() {
  const rawUrl = process.env.APPS_SCRIPT_URL?.trim();
  const token = process.env.APPS_SCRIPT_TOKEN?.trim();

  if (!rawUrl || !token || rawUrl.includes('REPLACE_WITH') || token.includes('REPLACE_WITH')) {
    throw new Error(
      'Google Sheets credentials are missing. Set APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN in vercel-app/.env.local, then restart the Next.js server.'
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('APPS_SCRIPT_URL is invalid. Paste the deployed Google Apps Script Web App URL ending in /exec.');
  }

  if (url.protocol !== 'https:' || !url.pathname.endsWith('/exec')) {
    throw new Error('APPS_SCRIPT_URL must be the HTTPS Google Apps Script Web App URL ending in /exec.');
  }

  return { url: url.toString(), token };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function parseAppsScriptResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    if (/accounts\.google\.com|ServiceLogin|Sign in to continue/i.test(raw)) {
      throw new Error(
        'Google Apps Script returned a Google sign-in page. In Apps Script → Deploy → Manage deployments, set Web app access to Anyone if your Workspace permits it, deploy a new version, and use that deployment URL ending in /exec.'
      );
    }

    throw new Error(
      `Google Apps Script did not return JSON (HTTP ${response.status}). Check the /exec URL and Web App deployment access.`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error('Google Apps Script returned JSON in an unexpected format. Expected an object containing ok and data.');
  }

  const body = parsed as AppsScriptEnvelope<T> & Record<string, unknown>;

  if (!response.ok) {
    const detail = typeof body.error === 'string' ? ` ${body.error}` : '';
    throw new Error(`Google Apps Script returned HTTP ${response.status}.${detail}`);
  }

  if (body.ok === true) {
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
      throw new Error('Google Apps Script accepted the request but did not return the required data field.');
    }
    return body.data as T;
  }

  if (body.ok === false) {
    const message = typeof body.error === 'string' && body.error.trim()
      ? body.error
      : 'Google Apps Script rejected the request without an error message.';

    if (/unauthorized api request/i.test(message)) {
      throw new Error(
        'Google Apps Script rejected the API token. APPS_SCRIPT_TOKEN in .env.local/Vercel must exactly match CT_API_TOKEN in Apps Script → Project Settings → Script Properties.'
      );
    }

    if (/api is not initialized|spreadsheet id missing|line master is missing/i.test(message)) {
      throw new Error(`${message} Open the bound Google Sheet's Apps Script project and complete the one-time Control Tower setup.`);
    }

    throw new Error(message);
  }

  const keys = Object.keys(body);
  const looksLikeLegacyHealthCheck =
    !Object.prototype.hasOwnProperty.call(body, 'ok') &&
    (Object.prototype.hasOwnProperty.call(body, 'success') ||
      Object.prototype.hasOwnProperty.call(body, 'system') ||
      Object.prototype.hasOwnProperty.call(body, 'status'));

  if (looksLikeLegacyHealthCheck) {
    throw new Error(
      `The Apps Script URL is reaching an OLD or DIFFERENT handler. It returned fields [${keys.join(', ')}], but the Control Tower API must return { ok: true, data: ... }. In the bound Apps Script project, make sure EnterpriseApi.gs is saved and deployed as a NEW VERSION. Keep its doGet/doPost as the only active handlers; rename every old handler in other files to legacyOldDoGet/legacyOldDoPost.`
    );
  }

  throw new Error(
    `Unexpected Apps Script response. Expected { ok: true, data: ... }; received fields [${keys.join(', ') || 'none'}]. Check that the latest EnterpriseApi.gs deployment is selected.`
  );
}

async function fetchAppsScript(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Google Apps Script did not respond within 20 seconds. Check the deployment and try again.');
    }
    throw new Error(
      `Could not reach Google Apps Script. Check the internet connection and APPS_SCRIPT_URL. ${error instanceof Error ? error.message : ''}`.trim()
    );
  }
}

export async function gasGet<T>(action: string, date?: string): Promise<T> {
  const c = config();
  const url = new URL(c.url);
  url.searchParams.set('action', action);
  url.searchParams.set('token', c.token);
  if (date) url.searchParams.set('date', date);

  const response = await fetchAppsScript(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  return parseAppsScriptResponse<T>(response);
}

export async function gasPost<T>(payload: Record<string, unknown>): Promise<T> {
  const c = config();
  const response = await fetchAppsScript(c.url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...payload, token: c.token })
  });

  return parseAppsScriptResponse<T>(response);
}
