#!/usr/bin/env node
import crypto from 'crypto';

const [targetUrl, baseUrl = 'http://localhost:3000', days = '14'] = process.argv.slice(2);
const secret = process.env.SIGNED_ANALYSIS_SECRET;

if (!targetUrl || !secret) {
  console.error('Usage: SIGNED_ANALYSIS_SECRET=... node scripts/sign-analysis-url.mjs <website-url> [base-url] [days]');
  process.exit(1);
}

const parsedTarget = new URL(targetUrl.match(/^https?:\/\//i) ? targetUrl : `https://${targetUrl}`);
if (parsedTarget.protocol !== 'https:') {
  console.error('Only HTTPS website URLs can be signed.');
  process.exit(1);
}

parsedTarget.hash = '';
parsedTarget.hostname = parsedTarget.hostname.toLowerCase();

const normalizedUrl = parsedTarget.toString();
const expires = Math.floor(Date.now() / 1000) + Math.floor(Number(days) * 24 * 60 * 60);
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${normalizedUrl}\n${expires}`)
  .digest('base64url');

const signedUrl = new URL(baseUrl);
signedUrl.searchParams.set('url', normalizedUrl);
signedUrl.searchParams.set('expires', String(expires));
signedUrl.searchParams.set('signature', signature);

console.log(signedUrl.toString());
