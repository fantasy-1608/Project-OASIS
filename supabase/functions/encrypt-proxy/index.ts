// @ts-nocheck
// ============================================================
// PROJECT OASIS — Supabase Edge Function: Encrypt Proxy
// ============================================================
//
// TRẠNG THÁI: 📐 SCAFFOLD — Chuẩn bị cho compliance nghiêm ngặt
//
// File này chạy trong Deno runtime (Supabase Edge Functions),
// KHÔNG phải trong Vite build. Các Deno API (Deno.serve, Deno.env)
// chỉ available trong môi trường deploy.
//
// Mục đích:
//   Client gửi plaintext → Edge Function encrypt bằng server key → lưu DB
//   Client yêu cầu data → Edge Function đọc DB → decrypt → trả plaintext
//
// Deploy:
//   supabase functions deploy encrypt-proxy
//
// Yêu cầu:
//   - Supabase CLI đã cài đặt
//   - Secret key đã lưu trong Supabase Vault:
//     supabase secrets set OASIS_ENCRYPTION_KEY=<your-secret-key>
//
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- Crypto helpers (Deno built-in Web Crypto API) ----

/**
 * Derive AES-256 key từ secret string bằng PBKDF2
 */
async function deriveKey(secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('oasis-phi-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext → iv:ciphertext (base64)
 */
async function encrypt(plaintext, key) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV cho AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  // Format: base64(iv):base64(ciphertext)
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}:${ctB64}`;
}

/**
 * Decrypt iv:ciphertext → plaintext
 */
async function decrypt(encryptedText, key) {
  const [ivB64, ctB64] = encryptedText.split(':');
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ---- PHI Fields (mirror from src/lib/crypto.js) ----
const PHI_FIELDS = [
  'patient_name', 'patient_id', 'diagnosis', 'surgical_method',
  'procedure', 'notes', 'anesthesia',
  'age', 'birth_year', 'gender', 'admission_date',
];

// ---- Main Handler ----
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get encryption key from Vault
    const encryptionSecret = Deno.env.get('OASIS_ENCRYPTION_KEY');
    if (!encryptionSecret) {
      return new Response(JSON.stringify({ error: 'Server encryption key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = await deriveKey(encryptionSecret);

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop(); // "read" | "write" | "update"
    const body = await req.json();

    // ---- READ: Fetch + decrypt ----
    if (path === 'read') {
      const { table = 'surgeries', filters = {} } = body;
      let query = supabase.from(table).select('*');
      for (const [col, val] of Object.entries(filters)) {
        query = query.eq(col, val);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Decrypt PHI fields
      const decrypted = await Promise.all(
        (data || []).map(async (row) => {
          const result = { ...row };
          for (const field of PHI_FIELDS) {
            if (result[field] && typeof result[field] === 'string' && result[field].includes(':')) {
              try {
                result[field] = await decrypt(result[field], key);
              } catch {
                // Not encrypted or different format — keep as-is
              }
            }
          }
          return result;
        })
      );

      return new Response(JSON.stringify({ data: decrypted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- WRITE: Encrypt + insert ----
    if (path === 'write') {
      const { table = 'surgeries', record } = body;

      // Encrypt PHI fields
      const encrypted = { ...record };
      for (const field of PHI_FIELDS) {
        if (encrypted[field] && typeof encrypted[field] === 'string') {
          encrypted[field] = await encrypt(encrypted[field], key);
        }
      }

      const { data, error } = await supabase.from(table).insert([encrypted]).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- UPDATE: Encrypt changed fields + update ----
    if (path === 'update') {
      const { table = 'surgeries', id, updates } = body;

      // Encrypt PHI fields in updates
      const encrypted = { ...updates };
      for (const field of PHI_FIELDS) {
        if (encrypted[field] && typeof encrypted[field] === 'string') {
          encrypted[field] = await encrypt(encrypted[field], key);
        }
      }

      const { data, error } = await supabase.from(table).update(encrypted).eq('id', id).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use /read, /write, or /update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
