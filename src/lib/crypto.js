import CryptoJS from 'crypto-js';

// Mật khẩu mặc định hoặc có thể lấy từ localStorage sau này.
const SECRET_KEY = 'CTCH';

export function encryptData(text) {
  if (!text) return text;
  try {
    return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  } catch (error) {
    console.error('Lỗi mã hoá:', error);
    return text;
  }
}

export function decryptData(encryptedText) {
  if (!encryptedText) return encryptedText;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // Nếu giải mã thất bại (do đổi key hoặc data cũ không mã hoá)
    if (!originalText) return encryptedText;
    return originalText;
  } catch {
    // Không phải chuỗi mã hoá (dữ liệu cũ)
    return encryptedText;
  }
}

/**
 * Encrypt specific fields of a surgery object before sending to Supabase
 */
export function encryptSurgery(surgery) {
  const result = {
    ...surgery,
    patient_name: encryptData(surgery.patient_name),
    diagnosis: encryptData(surgery.diagnosis),
    patient_id: encryptData(surgery.patient_id),
  };
  // surgical_method: chỉ mã hoá nếu đã có trong object (chưa có cột trên Supabase)
  if ('surgical_method' in surgery) {
    result.surgical_method = encryptData(surgery.surgical_method);
  }
  // admission_date: không mã hoá (ngày tháng, không nhạy cảm)
  if ('admission_date' in surgery) {
    result.admission_date = surgery.admission_date;
  }
  return result;
}

/**
 * Decrypt specific fields of a surgery object after fetching from Supabase
 */
export function decryptSurgery(surgery) {
  const result = {
    ...surgery,
    patient_name: decryptData(surgery.patient_name),
    diagnosis: decryptData(surgery.diagnosis),
    patient_id: decryptData(surgery.patient_id),
  };
  // surgical_method: chỉ giải mã nếu cột tồn tại
  if ('surgical_method' in surgery) {
    result.surgical_method = decryptData(surgery.surgical_method);
  }
  // admission_date: passthrough
  if ('admission_date' in surgery) {
    result.admission_date = surgery.admission_date;
  }
  return result;
}
