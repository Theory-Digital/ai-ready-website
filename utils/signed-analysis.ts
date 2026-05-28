import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';

export interface SignedAnalysisParams {
  url: string;
  expires: string | number;
  signature: string;
}

export interface SignedAnalysisResult {
  ok: boolean;
  url?: string;
  error?: string;
  status?: number;
}

export interface AnalysisAuthorizationResult extends SignedAnalysisResult {
  authKey?: string;
  mode?: 'access' | 'signed';
}

const MAX_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 45;

function getSigningSecret(): string | null {
  return process.env.SIGNED_ANALYSIS_SECRET || null;
}

function getAnalysisAccessCode(): string {
  return process.env.ANALYSIS_ACCESS_CODE || 'oilmens';
}

function safeStringMatch(expected: string, provided: string): boolean {
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  const providedHash = crypto.createHash('sha256').update(provided).digest();

  return crypto.timingSafeEqual(expectedHash, providedHash);
}

export function hasAnalysisAccess(access?: string | null): boolean {
  if (!access) return false;
  return safeStringMatch(getAnalysisAccessCode(), access);
}

function isPrivateIp(address: string): boolean {
  const ipVersion = net.isIP(address);

  if (ipVersion === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

export function normalizeAnalysisUrl(rawUrl: string): string {
  const candidate = rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS website URLs are allowed.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();

  return parsed.toString();
}

export async function assertPublicAnalysisUrl(normalizedUrl: string): Promise<void> {
  const parsed = new URL(normalizedUrl);
  const hostname = parsed.hostname;

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('Local and metadata URLs are not allowed.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private network URLs are not allowed.');
    }
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private network URLs are not allowed.');
  }
}

export function createAnalysisSignature(normalizedUrl: string, expires: string | number): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('SIGNED_ANALYSIS_SECRET is not configured.');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizedUrl}\n${expires}`)
    .digest('base64url');
}

function signaturesMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function verifySignedAnalysisParams(
  params: Partial<SignedAnalysisParams>
): Promise<SignedAnalysisResult> {
  if (!getSigningSecret()) {
    return {
      ok: false,
      error: 'Signed analysis links are not configured.',
      status: 503,
    };
  }

  if (!params.url || !params.expires || !params.signature) {
    return {
      ok: false,
      error: 'A valid signed analysis link is required.',
      status: 401,
    };
  }

  const expires = Number(params.expires);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(expires) || expires <= now) {
    return {
      ok: false,
      error: 'This analysis link has expired.',
      status: 401,
    };
  }

  if (expires - now > MAX_SIGNED_URL_TTL_SECONDS) {
    return {
      ok: false,
      error: 'This analysis link expires too far in the future.',
      status: 401,
    };
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeAnalysisUrl(String(params.url));
    await assertPublicAnalysisUrl(normalizedUrl);
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'Invalid analysis URL.',
      status: 400,
    };
  }

  const expectedSignature = createAnalysisSignature(normalizedUrl, String(params.expires));
  if (!signaturesMatch(expectedSignature, String(params.signature))) {
    return {
      ok: false,
      error: 'This analysis link is invalid.',
      status: 401,
    };
  }

  return {
    ok: true,
    url: normalizedUrl,
  };
}

export async function verifyAnalysisAuthorizationParams(
  params: Partial<SignedAnalysisParams> & { access?: string | null }
): Promise<AnalysisAuthorizationResult> {
  if (params.access) {
    if (!hasAnalysisAccess(params.access)) {
      return {
        ok: false,
        error: 'This analysis access code is invalid.',
        status: 401,
      };
    }

    if (!params.url) {
      return {
        ok: false,
        error: 'A website URL is required.',
        status: 400,
      };
    }

    try {
      const normalizedUrl = normalizeAnalysisUrl(String(params.url));
      await assertPublicAnalysisUrl(normalizedUrl);

      return {
        ok: true,
        url: normalizedUrl,
        mode: 'access',
        authKey: 'access',
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'Invalid analysis URL.',
        status: 400,
      };
    }
  }

  const signedAnalysis = await verifySignedAnalysisParams(params);

  return {
    ...signedAnalysis,
    mode: signedAnalysis.ok ? 'signed' : undefined,
    authKey: signedAnalysis.ok ? `signed:${params.expires}:${params.signature}` : undefined,
  };
}
