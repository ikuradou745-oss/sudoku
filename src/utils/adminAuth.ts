import { BanRecord, BanRouletteTriggerEvent } from '../types';

// Cryptographic hash for admin code verification
// Code is protected with salted SHA-256 one-way hashing
// The actual plaintext secret is NEVER committed to code or bundle
const HASH_SALT_PREFIX = 'uow_admin_salt_';
const HASH_SALT_SUFFIX = '_2026';
const EXPECTED_HASH = '191527bb4da18539d86c9f6956b71fa0d44ec350a560ca49dc0f14889779f6f8';

const ADMIN_SESSION_KEY = 'uow_admin_auth_token_v1';
const BAN_STORAGE_KEY = 'uow_active_ban_record_v1';
const IN_ROULETTE_KEY = 'uow_in_ban_roulette_penalty_v1';
const RATE_LIMIT_KEY = 'uow_admin_rate_limit_v1';

// Cross-tab broadcast channel for instant multi-tab sync
const adminBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('uow_admin_roulette_channel')
  : null;

/**
 * Computes SHA-256 hash using the Web Crypto API
 */
async function computeSha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Verifies if entered code matches the encrypted administrator secret.
 * Enforces rate limiting against brute force attempts.
 */
export async function verifyAdminCode(enteredCode: string): Promise<{ success: boolean; error?: string }> {
  const clean = String(enteredCode || '').trim().toLowerCase();
  if (!clean) {
    return { success: false, error: 'コードを入力してください。' };
  }

  // Rate Limiting Check
  try {
    const rateRaw = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (rateRaw) {
      const rateData = JSON.parse(rateRaw);
      if (rateData.lockedUntil && Date.now() < rateData.lockedUntil) {
        const waitSec = Math.ceil((rateData.lockedUntil - Date.now()) / 1000);
        return { 
          success: false, 
          error: `認証試行回数の上限に達しました。あと ${waitSec} 秒待ってから再試行してください。` 
        };
      }
    }
  } catch {
    // Ignore
  }

  const salted = `${HASH_SALT_PREFIX}${clean}${HASH_SALT_SUFFIX}`;
  const computed = await computeSha256(salted);

  if (computed === EXPECTED_HASH) {
    // Successful authentication
    sessionStorage.removeItem(RATE_LIMIT_KEY);
    const sessionToken = `adm_tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(ADMIN_SESSION_KEY, sessionToken);
    return { success: true };
  }

  // Record failed attempt
  try {
    const rateRaw = sessionStorage.getItem(RATE_LIMIT_KEY);
    const rateData = rateRaw ? JSON.parse(rateRaw) : { attempts: 0 };
    rateData.attempts = (rateData.attempts || 0) + 1;
    if (rateData.attempts >= 5) {
      rateData.lockedUntil = Date.now() + 30000; // Lock for 30s
    }
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateData));
  } catch {
    // Ignore
  }

  return { success: false, error: '認証コードが正しくありません。' };
}

/**
 * Checks if current user is actively logged in as admin
 */
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY));
}

/**
 * Clears administrator session
 */
export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

/**
 * Gets currently active ban record if exists and not expired
 */
export function getStoredBanInfo(): BanRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BAN_STORAGE_KEY);
    if (!raw) return null;
    const ban: BanRecord = JSON.parse(raw);
    if (!ban.isPermanent && ban.expiresAt && Date.now() >= ban.expiresAt) {
      // Ban has naturally expired
      localStorage.removeItem(BAN_STORAGE_KEY);
      return null;
    }
    return ban;
  } catch {
    return null;
  }
}

/**
 * Saves a new ban record to local storage
 */
export function saveBanInfo(ban: BanRecord): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BAN_STORAGE_KEY, JSON.stringify(ban));
  // Notify other tabs
  adminBroadcastChannel?.postMessage({ type: 'BAN_APPLIED', ban });
}

/**
 * Clears current ban
 */
export function clearBanInfo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BAN_STORAGE_KEY);
  localStorage.removeItem(IN_ROULETTE_KEY);
  adminBroadcastChannel?.postMessage({ type: 'BAN_REMOVED' });
}

/**
 * Marks that this client is currently inside the BAN roulette.
 * If user reloads or navigates away while this flag is set, they are banned immediately!
 */
export function markInBanRoulette(event: BanRouletteTriggerEvent): void {
  if (typeof window === 'undefined') return;
  const state = {
    ...event,
    active: true,
    startedAt: Date.now(),
  };
  localStorage.setItem(IN_ROULETTE_KEY, JSON.stringify(state));
}

/**
 * Clears the in-roulette flag when roulette finishes safely
 */
export function clearInBanRouletteFlag(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(IN_ROULETTE_KEY);
}

/**
 * Checks if a reload violation occurred.
 * This runs on App startup. If `uow_in_ban_roulette` is still active,
 * it proves the user refreshed or closed the page during the roulette!
 */
export function checkAndEnforceReloadViolation(currentUser: { id: string; name: string }): {
  wasBannedByReload: boolean;
  ban: BanRecord | null;
} {
  if (typeof window === 'undefined') {
    return { wasBannedByReload: false, ban: null };
  }

  try {
    const raw = localStorage.getItem(IN_ROULETTE_KEY);
    if (!raw) {
      return { wasBannedByReload: false, ban: getStoredBanInfo() };
    }

    const state = JSON.parse(raw);
    if (state && state.active) {
      // VIOLATION DETECTED: The user reloaded during the roulette!
      localStorage.removeItem(IN_ROULETTE_KEY);

      const isPermanent = Boolean(state.isPermanent);
      const durationMinutes = state.durationMinutes || 60;
      const expiresAt = isPermanent ? null : Date.now() + durationMinutes * 60 * 1000;

      const penaltyBan: BanRecord = {
        id: `ban_reload_${Date.now()}`,
        userId: currentUser.id || state.targetUserId || 'unknown',
        userName: currentUser.name || state.targetUserName || 'ユーザー',
        isPermanent,
        bannedAt: Date.now(),
        expiresAt,
        durationMinutes,
        durationLabel: state.durationLabel || `${durationMinutes}分`,
        reason: 'BANルーレット中の再読み込み・離脱検知による即時ペナルティ',
        bannedByReload: true,
      };

      saveBanInfo(penaltyBan);

      // Report to server if reachable
      try {
        fetch('/api/admin/bans/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ban: penaltyBan }),
        }).catch(() => {});
      } catch {
        // Ignore
      }

      return { wasBannedByReload: true, ban: penaltyBan };
    }
  } catch {
    // Ignore
  }

  return { wasBannedByReload: false, ban: getStoredBanInfo() };
}

/**
 * Broadcasts or listens to roulette triggers across tabs / clients
 */
export function subscribeToAdminRoulette(
  currentUserId: string,
  onTrigger: (event: BanRouletteTriggerEvent) => void,
  onBanRemoved?: () => void
): () => void {
  if (!adminBroadcastChannel) return () => {};

  const handler = (ev: MessageEvent) => {
    const data = ev.data;
    if (!data) return;

    if (data.type === 'TRIGGER_BAN_ROULETTE') {
      const event: BanRouletteTriggerEvent = data.event;
      if (event.targetType === 'all' || event.targetUserId === currentUserId) {
        onTrigger(event);
      }
    } else if (data.type === 'BAN_REMOVED') {
      onBanRemoved?.();
    }
  };

  adminBroadcastChannel.addEventListener('message', handler);
  return () => {
    adminBroadcastChannel.removeEventListener('message', handler);
  };
}

/**
 * Triggers a ban roulette locally and across tabs
 */
export function triggerRouletteLocal(event: BanRouletteTriggerEvent): void {
  adminBroadcastChannel?.postMessage({
    type: 'TRIGGER_BAN_ROULETTE',
    event,
  });
}
