import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'OASIS_EDIT_SESSION';

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getEditSession() {
  const session = readStoredSession();
  if (!session?.token || !session?.expiresAt) return null;
  if (Date.now() >= session.expiresAt) {
    clearEditSession();
    return null;
  }
  return session;
}

export function getEditToken() {
  return getEditSession()?.token || null;
}

export function hasValidEditSession() {
  return Boolean(getEditSession());
}

export function clearEditSession() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export async function verifyEditPasscode(passcode) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase chưa được cấu hình nên không thể xác minh mã mở khóa.');
  }

  const { data, error } = await supabase.functions.invoke('oasis-surgery-api', {
    body: {
      action: 'verify_passcode',
      passcode,
    },
  });

  if (error) {
    throw new Error(error.message || 'Không thể xác minh mã mở khóa.');
  }
  if (!data?.token || !data?.expiresAt) {
    throw new Error(data?.error || 'Phản hồi mở khóa không hợp lệ.');
  }

  const expiresAt = new Date(data.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Phiên mở khóa không hợp lệ hoặc đã hết hạn.');
  }

  const session = {
    token: data.token,
    expiresAt,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}
