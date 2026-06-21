// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;

const ALLOWED_SURGERY_COLUMNS = new Set([
  'id', 'patient_name', 'diagnosis', 'priority', 'shift', 'date',
  'patient_id', 'status', 'order_in_shift', 'surgeon_id', 'room_id',
  'gender', 'birth_year', 'age',
  'procedure', 'start_time', 'duration_minutes', 'anesthesia', 'equipment',
  'notes', 'created_at', 'updated_at',
]);

const PHI_FIELDS = [
  'patient_name',
  'patient_id',
  'diagnosis',
  'surgical_method',
  'procedure',
  'notes',
  'anesthesia',
  'age',
  'birth_year',
  'gender',
  'admission_date',
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function authorizationError(message = 'Unauthorized.') {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function getSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const first = Object.values(parsed)[0];
    return typeof first === 'string' ? first : '';
  } catch {
    return '';
  }
}

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = getSecretKey();
  if (!url || !key) {
    throw new Error('Supabase admin credentials are not configured.');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getRuntimeSecret(supabase, name) {
  const envValue = Deno.env.get(name);
  if (envValue) return envValue;

  const { data, error } = await supabase
    .from('oasis_runtime_config')
    .select('secret_value')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn(`[oasis-surgery-api] Could not read runtime config ${name}:`, error.message);
    return '';
  }
  return data?.secret_value || '';
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlEncodeText(text) {
  return base64Url(new TextEncoder().encode(text));
}

function base64UrlDecodeText(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
}

async function hmac(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64Url(new Uint8Array(signature));
}

function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

async function getEditTokenSecret(supabase) {
  return await getRuntimeSecret(supabase, 'OASIS_EDIT_TOKEN_SECRET') || getSecretKey();
}

async function createEditToken(supabase) {
  const secret = await getEditTokenSecret(supabase);
  if (!secret) throw new Error('Edit token signing secret is not configured.');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'shared-edit-passcode',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await hmac(encodedPayload, secret);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

async function verifyEditToken(supabase, token) {
  const secret = await getEditTokenSecret(supabase);
  if (!secret) throw new Error('Edit token signing secret is not configured.');
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw authorizationError('Missing edit session token.');
  }

  const [payloadPart, signature] = token.split('.');
  const expected = await hmac(payloadPart, secret);
  if (!timingSafeEqual(signature, expected)) {
    throw authorizationError('Invalid edit session token.');
  }

  const payload = JSON.parse(base64UrlDecodeText(payloadPart));
  if (payload.sub !== 'shared-edit-passcode' || !payload.exp) {
    throw authorizationError('Invalid edit session payload.');
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    throw authorizationError('Edit session expired.');
  }
  return payload;
}

async function verifyReadAccess(req, supabase, body) {
  if (body.editToken) {
    await verifyEditToken(supabase, body.editToken);
    return;
  }

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) return;
  }

  throw authorizationError('Vui lòng mở khóa để xem dữ liệu dự kiến mổ.');
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

async function getCryptoSecret(supabase, required = true) {
  const secret =
    await getRuntimeSecret(supabase, 'OASIS_CRYPTO_SECRET') ||
    await getRuntimeSecret(supabase, 'OASIS_ENCRYPTION_KEY');
  if (!secret && required) throw new Error('OASIS_CRYPTO_SECRET is not configured.');
  return secret;
}

async function getCryptoKey(supabase, required = true) {
  const secret = await getCryptoSecret(supabase, required);
  if (!secret) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}

async function encryptValue(value, key) {
  if (value === null || value === undefined || value === '') return value;
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    new TextEncoder().encode(String(value)),
  );
  return `${bytesToHex(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptValue(value, key, legacySecret) {
  if (!value || typeof value !== 'string') return value;
  const colonIdx = value.indexOf(':');
  if (colonIdx === 32) {
    try {
      const iv = hexToBytes(value.slice(0, 32));
      const ciphertext = base64ToBytes(value.slice(33));
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);
      return new TextDecoder().decode(decrypted);
    } catch {
      return value;
    }
  }

  if (legacySecret) {
    try {
      const bytes = CryptoJS.AES.decrypt(value, legacySecret);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted) return decrypted;
    } catch {
      return value;
    }
  }
  return value;
}

async function encryptSurgeryFields(supabase, row) {
  const key = await getCryptoKey(supabase, true);
  const encrypted = { ...row };
  for (const field of PHI_FIELDS) {
    if (field in encrypted) {
      encrypted[field] = await encryptValue(encrypted[field], key);
    }
  }
  return encrypted;
}

async function decryptSurgeryFields(supabase, row) {
  const key = await getCryptoKey(supabase, false);
  if (!key) return { ...row };

  const legacySecret = await getRuntimeSecret(supabase, 'OASIS_LEGACY_CRYPTO_SECRET');
  const decrypted = { ...row };
  for (const field of PHI_FIELDS) {
    if (field in decrypted) {
      decrypted[field] = await decryptValue(decrypted[field], key, legacySecret);
    }
  }
  return decrypted;
}

async function verifyPasscode(supabase, passcode) {
  const expectedSha256 = await getRuntimeSecret(supabase, 'OASIS_EDIT_PASSCODE_SHA256');
  if (expectedSha256) {
    const actual = await sha256Hex(passcode);
    return timingSafeEqual(actual, expectedSha256.toLowerCase());
  }

  const serverPasscode = await getRuntimeSecret(supabase, 'OASIS_EDIT_PASSCODE');
  if (serverPasscode) {
    return timingSafeEqual(passcode, serverPasscode);
  }

  throw new Error('OASIS_EDIT_PASSCODE_SHA256 is not configured.');
}

function getClientFingerprint(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown-ip';
  const userAgent = req.headers.get('user-agent') || 'unknown-ua';
  return `${ip}:${userAgent.slice(0, 120)}`;
}

async function assertNotRateLimited(supabase, fingerprint) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('edit_unlock_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('client_fingerprint', fingerprint)
    .eq('success', false)
    .gte('created_at', since);

  if (error) throw error;
  if ((count || 0) >= RATE_LIMIT_MAX_FAILURES) {
    const err = new Error('Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    err.status = 429;
    throw err;
  }
}

async function recordUnlockAttempt(supabase, fingerprint, success) {
  const { error } = await supabase
    .from('edit_unlock_attempts')
    .insert([{ client_fingerprint: fingerprint, success }]);
  if (error) console.warn('[oasis-surgery-api] Could not record unlock attempt:', error.message);
}

function cleanSurgeryPayload(payload) {
  const clean = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (ALLOWED_SURGERY_COLUMNS.has(key)) clean[key] = value;
  }
  return clean;
}

async function handleVerifyPasscode(req, body) {
  const passcode = String(body.passcode || '');
  if (!passcode) return json({ error: 'Missing passcode.' }, 400);

  const supabase = getAdminClient();
  const fingerprint = getClientFingerprint(req);
  await assertNotRateLimited(supabase, fingerprint);

  const ok = await verifyPasscode(supabase, passcode);
  await recordUnlockAttempt(supabase, fingerprint, ok);
  if (!ok) return json({ error: 'Mật khẩu không chính xác.' }, 401);

  return json(await createEditToken(supabase));
}

async function handleCreate(supabase, body) {
  const record = await encryptSurgeryFields(supabase, cleanSurgeryPayload(body.record));
  const { data, error } = await supabase
    .from('surgeries')
    .insert([record])
    .select()
    .single();
  if (error) throw error;
  return json({ data: await decryptSurgeryFields(supabase, data) });
}

async function handleUpdate(supabase, body) {
  const id = String(body.id || '');
  if (!id) return json({ error: 'Missing surgery id.' }, 400);

  const updates = await encryptSurgeryFields(supabase, cleanSurgeryPayload(body.updates));
  delete updates.id;
  delete updates.created_at;
  delete updates.updated_at;

  const { data, error } = await supabase
    .from('surgeries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return json({ data: await decryptSurgeryFields(supabase, data) });
}

async function handleDelete(supabase, body) {
  const id = String(body.id || '');
  if (!id) return json({ error: 'Missing surgery id.' }, 400);

  const { error } = await supabase
    .from('surgeries')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return json({ data: { deleted: true } });
}

async function handleMove(supabase, body) {
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) return json({ data: [] });
  if (updates.length > 200) return json({ error: 'Too many move updates.' }, 400);

  const rows = [];
  for (const item of updates) {
    const id = String(item.id || '');
    if (!id) return json({ error: 'Move update is missing id.' }, 400);

    const clean = await encryptSurgeryFields(supabase, cleanSurgeryPayload(item.updates));
    delete clean.id;
    delete clean.created_at;
    delete clean.updated_at;

    const { data, error } = await supabase
      .from('surgeries')
      .update(clean)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    rows.push(await decryptSurgeryFields(supabase, data));
  }
  return json({ data: rows });
}

async function handleRead(supabase, body) {
  let query = supabase
    .from('surgeries')
    .select('*')
    .order('order_in_shift', { ascending: true });

  if (body.date) {
    query = query.eq('date', String(body.date));
  }

  const { data, error } = await query;
  if (error) throw error;
  const decrypted = await Promise.all((data || []).map(row => decryptSurgeryFields(supabase, row)));
  return json({ data: decrypted });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'verify_passcode') {
      return await handleVerifyPasscode(req, body);
    }

    const supabase = getAdminClient();

    if (action === 'read_surgeries') {
      await verifyReadAccess(req, supabase, body);
      return await handleRead(supabase, body);
    }

    await verifyEditToken(supabase, body.editToken);

    if (action === 'create_surgery') return await handleCreate(supabase, body);
    if (action === 'update_surgery') return await handleUpdate(supabase, body);
    if (action === 'delete_surgery') return await handleDelete(supabase, body);
    if (action === 'move_surgery') return await handleMove(supabase, body);

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    const status = err?.status || 500;
    return json({ error: err?.message || 'Unknown error.' }, status);
  }
});
