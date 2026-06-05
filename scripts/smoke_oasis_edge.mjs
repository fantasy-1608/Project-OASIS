import { readFileSync } from 'node:fs';

function loadDotEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    for (const line of env.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key]) process.env[key] = rest.join('=');
    }
  } catch {
    // .env is optional in CI if variables are already set.
  }
}

async function invoke(action, body = {}) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${url}/functions/v1/oasis-surgery-api`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action, ...body }),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${action}: ${text}`);
  }

  if (!response.ok || json.error) {
    throw new Error(`${action} failed (${response.status}): ${json.error || text}`);
  }
  return json;
}

async function tryInvoke(action, body = {}) {
  try {
    return { data: await invoke(action, body), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

loadDotEnv();

const passcode = process.env.OASIS_TEST_PASSCODE || 'CTCH';

const readResult = await invoke('read_surgeries');
if (!Array.isArray(readResult.data)) {
  throw new Error('read_surgeries did not return an array.');
}
console.log(`read_surgeries ok: ${readResult.data.length} rows`);

const verifyAttempt = await tryInvoke('verify_passcode', { passcode });
if (verifyAttempt.error) {
  console.error(verifyAttempt.error.message);
  process.exitCode = 1;
  process.exit();
}
const verifyResult = verifyAttempt.data;
if (!verifyResult.token || !verifyResult.expiresAt) {
  throw new Error('verify_passcode did not return an edit token.');
}
console.log(`verify_passcode ok: expiresAt=${verifyResult.expiresAt}`);
