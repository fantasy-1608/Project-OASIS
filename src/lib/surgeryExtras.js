// DB chưa có các cột này, nên lưu tạm trong `notes`.
export const SURGERY_EXTRA_FIELDS = ['surgical_method', 'admission_date', 'room', 'readiness_manual', 'readiness_auto'];

function parsePackedNotes(notes) {
  if (!notes || typeof notes !== 'string') return { extras: {}, legacyNotes: '' };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { extras: parsed, legacyNotes: '' };
    }
  } catch {
    return { extras: {}, legacyNotes: notes };
  }
  return { extras: {}, legacyNotes: notes };
}

function hasExtraValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

export function packExtras(surgery) {
  const { extras: currentExtras, legacyNotes } = parsePackedNotes(surgery.notes);
  const extras = { ...currentExtras };
  if (legacyNotes) extras.__legacy_notes = legacyNotes;

  for (const key of SURGERY_EXTRA_FIELDS) {
    if (hasExtraValue(surgery[key])) {
      extras[key] = surgery[key];
    } else {
      delete extras[key];
    }
  }

  const packed = { ...surgery };
  if (Object.keys(extras).length > 0) {
    packed.notes = JSON.stringify(extras);
  } else if (legacyNotes) {
    packed.notes = legacyNotes;
  }

  for (const key of SURGERY_EXTRA_FIELDS) delete packed[key];
  return packed;
}

export function unpackExtras(surgery) {
  const unpacked = { ...surgery };
  if (unpacked.notes) {
    try {
      const extras = JSON.parse(unpacked.notes);
      for (const key of SURGERY_EXTRA_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(extras, key)) unpacked[key] = extras[key];
      }
      unpacked.notes = extras.__legacy_notes || '';
    } catch {
      // notes không phải JSON (dữ liệu cũ) -> giữ nguyên.
    }
  }
  return unpacked;
}
