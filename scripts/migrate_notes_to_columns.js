/**
 * ============================================================
 * PROJECT OASIS — Script: Migrate Notes → Columns
 * ============================================================
 * TRẠNG THÁI: ⏸️  CHƯA CHẠY
 *
 * Mục đích:
 *   Sau khi chạy migration 001_normalize_schema.sql,
 *   script này đọc tất cả records có JSON trong cột notes
 *   và unpack surgical_method, admission_date vào cột riêng.
 *
 * Cách chạy (sau khi migration 001 đã xong):
 *   node scripts/migrate_notes_to_columns.js
 *
 * Yêu cầu:
 *   - SUPABASE_URL và SUPABASE_SERVICE_KEY trong .env
 *   - (Dùng service key, không phải anon key để bypass RLS)
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config(); // Load .env

// Dùng service_role key để bypass RLS trong quá trình migration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Thêm vào .env

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong .env');
  console.error('   Thêm SUPABASE_SERVICE_KEY vào .env (lấy từ Supabase Dashboard → Settings → API → service_role)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log('🔄 Bắt đầu migrate notes → columns...\n');

  // 1. Lấy tất cả records có notes
  const { data: surgeries, error } = await supabase
    .from('surgeries')
    .select('id, notes, surgical_method, admission_date')
    .not('notes', 'is', null);

  if (error) {
    console.error('❌ Lỗi khi fetch:', error.message);
    process.exit(1);
  }

  console.log(`📋 Tìm thấy ${surgeries.length} records có notes\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const surgery of surgeries) {
    // Parse notes JSON
    let extras;
    try {
      extras = JSON.parse(surgery.notes);
    } catch {
      // notes không phải JSON → skip
      skipped++;
      continue;
    }

    if (!extras || typeof extras !== 'object') {
      skipped++;
      continue;
    }

    // Chỉ update nếu có dữ liệu cần migrate
    const updates = {};
    if (extras.surgical_method && !surgery.surgical_method) {
      updates.surgical_method = extras.surgical_method;
    }
    if (extras.admission_date && !surgery.admission_date) {
      updates.admission_date = extras.admission_date;
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    // Update record
    const { error: updateError } = await supabase
      .from('surgeries')
      .update(updates)
      .eq('id', surgery.id);

    if (updateError) {
      console.error(`  ❌ ${surgery.id}: ${updateError.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${surgery.id}: ${JSON.stringify(updates)}`);
      migrated++;
    }
  }

  console.log('\n📊 Kết quả:');
  console.log(`  ✅ Đã migrate: ${migrated}`);
  console.log(`  ⏭️  Bỏ qua: ${skipped}`);
  console.log(`  ❌ Lỗi: ${errors}`);

  if (errors === 0) {
    console.log('\n🎉 Migration hoàn tất! Bật FEATURES.NORMALIZED_SCHEMA = true');
  } else {
    console.log('\n⚠️  Có lỗi — Kiểm tra lại trước khi bật flag');
  }
}

run().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
