// base44/shared/totp.ts — Genuine RFC 6238 TOTP (HMAC-SHA1) via Web Crypto.
// Compatible with Google Authenticator, Microsoft Authenticator and other TOTP apps.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  str = String(str).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of str) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function timingSafeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function intToBytes(num) {
  const bytes = new Uint8Array(8);
  let n = num;
  for (let i = 7; i >= 0; i--) { bytes[i] = n & 0xff; n = Math.floor(n / 256); }
  return bytes;
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return new Uint8Array(sig);
}

export async function generateTotpForCounter(secretBase32, counter, digits = 6) {
  const keyBytes = base32Decode(secretBase32);
  const msg = intToBytes(counter);
  const hash = await hmacSha1(keyBytes, msg);
  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
  const otp = binary % Math.pow(10, digits);
  return String(otp).padStart(digits, '0');
}

// Returns the accepted time-step counter, or -1 if no match within +/- window.
export async function verifyTotp(secretBase32, code, window = 1) {
  if (!code) return -1;
  code = String(code).replace(/\s+/g, '');
  if (!/^\d+$/.test(code)) return -1;
  const now = Math.floor(Date.now() / 1000);
  for (let w = -window; w <= window; w++) {
    const counter = Math.floor((now + w * 30) / 30);
    const expected = await generateTotpForCounter(secretBase32, counter);
    if (timingSafeEqual(expected, code)) return counter;
  }
  return -1;
}

export function generateSecret(bytes = 20) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base32Encode(arr);
}

export function buildOtpauthUri(secret, label, issuer) {
  const labelEnc = encodeURIComponent(issuer + ':' + label);
  const issuerEnc = encodeURIComponent(issuer);
  return 'otpauth://totp/' + labelEnc + '?secret=' + secret + '&issuer=' + issuerEnc + '&algorithm=SHA1&digits=6&period=30';
}

export function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    const s = base32Encode(arr).toLowerCase();
    codes.push(s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16));
  }
  return codes;
}

export async function hashRecoveryCode(code) {
  const data = new TextEncoder().encode(String(code).trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}