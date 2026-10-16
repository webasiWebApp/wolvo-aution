// base44/shared/twoFactor.ts
// One server-side check for every action that asks for a second factor
// (sign-in challenge, confirming setup, disabling 2FA, regenerating recovery
// codes). Applies the same lockout, replay prevention and recovery-code rules
// everywhere so no endpoint can be used to brute-force a 6-digit code.

import { verifyTotp, hashRecoveryCode } from './totp.ts';

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function isLocked(tf) {
  return !!(tf && tf.locked_until && new Date(tf.locked_until).getTime() > Date.now());
}

// Verifies `body.code` (6-digit TOTP) or, when allowRecovery is set,
// `body.recovery_code` against the user's TwoFactorStatus record `tf`.
// On success the failure counter is cleared, the TOTP step is recorded (replay
// prevention) and a used recovery code is consumed. On failure the counter is
// incremented and the account locked after MAX_ATTEMPTS.
// Returns { ok: true, step, usedRecovery } or { ok: false, status, error, ... }.
export async function checkSecondFactor(svc, tf, body, { allowRecovery = true, invalidMessage = 'Invalid code.' } = {}) {
  if (isLocked(tf)) return { ok: false, status: 429, error: 'Too many failed attempts. Try again later.' };

  const code = body && body.code ? String(body.code).replace(/\s+/g, '') : '';
  const recoveryCode = allowRecovery && body && body.recovery_code ? String(body.recovery_code).trim().toLowerCase() : '';
  const hasTotp = /^\d{6}$/.test(code);
  if (!hasTotp && !recoveryCode) {
    return { ok: false, status: 400, error: allowRecovery ? 'Provide a 6-digit code or a recovery code.' : 'Enter the 6-digit code from your authenticator app.' };
  }

  const success = { failed_attempts: 0, locked_until: '' };
  let step = -1;
  let usedRecovery = false;

  if (hasTotp) {
    step = await verifyTotp(tf.totp_secret, code);
    if (step >= 0 && tf.last_used_step && step <= tf.last_used_step) {
      return { ok: false, status: 400, error: 'This code has already been used. Wait for the next one.' };
    }
    if (step >= 0) success.last_used_step = step;
  } else {
    const hash = await hashRecoveryCode(recoveryCode);
    const hashes = tf.recovery_codes || [];
    if (hashes.includes(hash)) {
      const remaining = hashes.filter((h) => h !== hash);
      success.recovery_codes = remaining;
      success.recovery_codes_remaining = remaining.length;
      usedRecovery = true;
    }
  }

  if (step < 0 && !usedRecovery) {
    const attempts = (tf.failed_attempts || 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : '';
    await svc.entities.TwoFactorStatus.update(tf.id, { failed_attempts: attempts, locked_until: lock });
    return { ok: false, status: 400, error: invalidMessage, attempts_remaining: Math.max(0, MAX_ATTEMPTS - attempts) };
  }

  await svc.entities.TwoFactorStatus.update(tf.id, success);
  return { ok: true, step, usedRecovery };
}

// Fields that fully reset a user's 2FA (disable, admin reset, account deletion).
export function clearedTwoFactorFields() {
  return {
    enabled: false, confirmed: false, totp_secret: '', recovery_codes: [], recovery_codes_remaining: 0,
    last_used_step: 0, mfa_verified_until: '', failed_attempts: 0, locked_until: ''
  };
}
