import CryptoJS from 'crypto-js';

// ============================================================
// PROJECT OASIS — Mã hóa thông tin bệnh nhân (PHI Encryption)
// ============================================================
// Phase 1: AES-256-CBC + Random IV per encryption
// - Key từ env var hoặc sessionStorage, không có fallback hard-code
// - Tự nhận biết data cũ (passphrase mode) vs mới (iv:ciphertext)
// - Mở rộng danh sách field nhạy cảm
// ============================================================

export function getSecretKey() {
  if (typeof window !== 'undefined') {
    const sessionKey = sessionStorage.getItem('OASIS_DECRYPTION_KEY');
    if (sessionKey) return sessionKey;
  }
  const envKey = import.meta.env.VITE_CRYPTO_SECRET;
  if (envKey) return envKey;
  throw new Error('Missing VITE_CRYPTO_SECRET. Refusing to encrypt PHI without a configured key.');
}

const LEGACY_KEY = import.meta.env.VITE_LEGACY_CRYPTO_SECRET || '';

/**
 * Danh sách field nhạy cảm (PHI — Protected Health Information)
 * Các field này sẽ được mã hóa trước khi gửi lên Supabase
 */
export const PHI_FIELDS = [
  // Direct identifiers (trực tiếp nhận diện bệnh nhân)
  'patient_name',
  'patient_id',
  'diagnosis',
  'surgical_method',
  'procedure',
  'notes',
  'anesthesia',
  // Quasi-identifiers (kết hợp có thể nhận diện)
  'age',
  'birth_year',
  'gender',
  'admission_date',
];

/**
 * Mã hóa AES-256-CBC với Random IV
 * Format output: <iv_hex>:<ciphertext_base64>
 * @param {string} text - Plaintext cần mã hóa
 * @returns {string} Ciphertext dạng "iv:encrypted"
 */
export function encryptData(text) {
  if (!text) return text;
  try {
    const secretKey = getSecretKey();
    const key = CryptoJS.SHA256(secretKey);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(String(text), key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    // Prepend IV để decrypt biết dùng IV nào
    return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
  } catch (error) {
    console.error('[Crypto] Lỗi mã hoá:', error);
    throw error;
  }
}

/**
 * Giải mã — tự nhận biết format cũ (passphrase) vs mới (iv:ciphertext)
 * @param {string} encryptedText - Ciphertext cần giải mã
 * @returns {string} Plaintext
 */
export function decryptData(encryptedText) {
  if (!encryptedText) return encryptedText;
  // Bỏ qua giá trị không phải string (boolean, number, etc.)
  if (typeof encryptedText !== 'string') return encryptedText;

  try {
    // ---- Format mới: iv_hex(32chars):ciphertext_base64 ----
    const colonIdx = encryptedText.indexOf(':');
    if (colonIdx === 32) {
      const ivHex = encryptedText.substring(0, 32);
      const ciphertext = encryptedText.substring(33);
      const secretKey = getSecretKey();
      const key = CryptoJS.SHA256(secretKey);
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const bytes = CryptoJS.AES.decrypt(ciphertext, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result) return result;
    }

    // ---- Format cũ: CryptoJS passphrase mode ----
    if (LEGACY_KEY) {
      const bytes = CryptoJS.AES.decrypt(encryptedText, LEGACY_KEY);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result) return result;
    }

    // Không giải mã được → trả nguyên (dữ liệu plaintext hoặc format lạ)
    return encryptedText;
  } catch {
    // Không phải chuỗi mã hoá (dữ liệu cũ chưa encrypt)
    return encryptedText;
  }
}

/**
 * Encrypt toàn bộ field nhạy cảm của surgery object trước khi gửi Supabase
 * @param {Object} surgery - Surgery record (plaintext)
 * @returns {Object} Surgery record với PHI fields đã encrypt
 */
export function encryptSurgery(surgery) {
  const result = { ...surgery };
  for (const field of PHI_FIELDS) {
    if (field in result && result[field]) {
      result[field] = encryptData(result[field]);
    }
  }
  return result;
}

/**
 * Decrypt toàn bộ field nhạy cảm của surgery object sau khi fetch từ Supabase
 * @param {Object} surgery - Surgery record (encrypted)
 * @returns {Object} Surgery record với PHI fields đã decrypt
 */
export function decryptSurgery(surgery) {
  const result = { ...surgery };
  for (const field of PHI_FIELDS) {
    if (field in result && result[field]) {
      result[field] = decryptData(result[field]);
    }
  }
  return result;
}

/**
 * Encrypt chỉ các field nhạy cảm trong một partial update object
 * Dùng trong updateSurgery/moveSurgery khi chỉ gửi subset of fields
 * @param {Object} updates - Object chứa các field cần update
 * @returns {Object} Object với PHI fields đã encrypt
 */
export function encryptFields(updates) {
  const result = { ...updates };
  for (const field of PHI_FIELDS) {
    if (field in result && result[field]) {
      result[field] = encryptData(result[field]);
    }
  }
  return result;
}
