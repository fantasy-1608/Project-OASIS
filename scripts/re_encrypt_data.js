#!/usr/bin/env node
/**
 * ============================================================
 * PROJECT OASIS — Re-encrypt Migration Script
 * ============================================================
 * 
 * Mục đích: Chuyển đổi data đã encrypt bằng key cũ (passphrase mode)
 *           sang format mới (AES-256-CBC + random IV)
 * 
 * Cách chạy:
 *   SUPABASE_SERVICE_KEY=... OASIS_CRYPTO_SECRET=... OASIS_LEGACY_CRYPTO_SECRET=... node scripts/re_encrypt_data.js
 * 
 * Quy trình:
 *   1. Fetch toàn bộ data từ Supabase
 *   2. Decrypt bằng legacy key từ OASIS_LEGACY_CRYPTO_SECRET
 *   3. Re-encrypt bằng new format (SHA256(key) + random IV)
 *   4. Update lại Supabase bằng service role key
 * 
 * LƯU Ý: 
 *   - Script này IDEMPOTENT — chạy nhiều lần không sao
 *   - Data đã ở format mới (có ':') sẽ được skip
 *   - BACKUP database trước khi chạy!
 * ============================================================
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// ---- Config ----
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SECRET_KEY = process.env.OASIS_CRYPTO_SECRET || process.env.VITE_CRYPTO_SECRET;
const LEGACY_KEY = process.env.OASIS_LEGACY_CRYPTO_SECRET;

const PHI_FIELDS = [
  'patient_name',
  'patient_id',
  'diagnosis',
  'surgical_method',
  'procedure',
  'notes',
  'anesthesia',
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

if (!SECRET_KEY || !LEGACY_KEY) {
  console.error('❌ Missing OASIS_CRYPTO_SECRET/VITE_CRYPTO_SECRET or OASIS_LEGACY_CRYPTO_SECRET.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Crypto helpers ----
function isNewFormat(text) {
  if (typeof text !== 'string') return false;
  // Format mới: 32-char hex IV + ':' + ciphertext
  return text.indexOf(':') === 32;
}

function legacyDecrypt(text) {
  try {
    const bytes = CryptoJS.AES.decrypt(text, LEGACY_KEY);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

function newEncrypt(plaintext) {
  const key = CryptoJS.SHA256(SECRET_KEY);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(String(plaintext), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

// ---- Main ----
async function main() {
  console.log('🔐 Re-encrypt Migration Script');
  console.log('================================');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`PHI Fields: ${PHI_FIELDS.join(', ')}`);
  console.log('');

  // Fetch all surgeries
  const { data: surgeries, error } = await supabase
    .from('surgeries')
    .select('*');

  if (error) {
    console.error('❌ Fetch error:', error.message);
    process.exit(1);
  }

  console.log(`📋 Tìm thấy ${surgeries.length} records`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const surgery of surgeries) {
    const updates = {};
    let needsUpdate = false;

    for (const field of PHI_FIELDS) {
      const value = surgery[field];
      if (!value || typeof value !== 'string') continue;

      // Đã ở format mới → skip
      if (isNewFormat(value)) {
        continue;
      }

      // Thử decrypt bằng legacy key
      const decrypted = legacyDecrypt(value);
      if (decrypted) {
        // Re-encrypt bằng format mới
        updates[field] = newEncrypt(decrypted);
        needsUpdate = true;
      }
      // Nếu không decrypt được → có thể là plaintext hoặc format lạ → encrypt luôn
      // (uncomment dòng dưới nếu muốn encrypt plaintext data cũ)
      // else {
      //   updates[field] = newEncrypt(value);
      //   needsUpdate = true;
      // }
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('surgeries')
        .update(updates)
        .eq('id', surgery.id);

      if (updateError) {
        console.error(`  ❌ ${surgery.id}: ${updateError.message}`);
        errorCount++;
      } else {
        const fields = Object.keys(updates).join(', ');
        console.log(`  ✅ ${surgery.id}: re-encrypted [${fields}]`);
        migratedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log('');
  console.log('================================');
  console.log(`✅ Migrated: ${migratedCount}`);
  console.log(`⏭️  Skipped (already new format): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('Done!');
}

main().catch(console.error);
