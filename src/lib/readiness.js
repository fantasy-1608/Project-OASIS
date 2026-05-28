export const READINESS_STATUS = {
  READY: 'ready',
  MISSING: 'missing',
  UNCHECKED: 'unchecked',
  UNKNOWN: 'unknown',
};

export const READINESS_ITEMS = [
  { id: 'cbc', shortLabel: 'CTM', label: 'Công thức máu', category: 'lab' },
  { id: 'biochemistry', shortLabel: 'SH', label: 'Sinh hóa máu', category: 'lab' },
  { id: 'urine', shortLabel: 'NT', label: 'Tổng phân tích nước tiểu', category: 'lab' },
  { id: 'chest_xray', shortLabel: 'XQ ngực', label: 'X-quang ngực thẳng', category: 'imaging' },
  { id: 'abdominal_ultrasound', shortLabel: 'SA bụng', label: 'Siêu âm bụng', category: 'imaging' },
  { id: 'ecg', shortLabel: 'ECG', label: 'ECG', category: 'imaging' },
  { id: 'consultation', shortLabel: 'HC', label: 'Hội chẩn gây mê/hội chẩn cần thiết', category: 'document' },
  { id: 'surgery_consent', shortLabel: 'CD mổ', label: 'Cam đoan mổ', category: 'document' },
  { id: 'anesthesia_consent', shortLabel: 'CD GM', label: 'Cam đoan gây mê', category: 'document' },
];

const ITEM_IDS = READINESS_ITEMS.map(item => item.id);

export function createDefaultManualReadiness(existing = {}) {
  const checked = {};
  for (const id of ITEM_IDS) {
    checked[id] = Boolean(existing?.checked?.[id]);
  }

  return {
    version: 1,
    checked,
    regionalXray: String(existing.regionalXray || existing.regional_xray || '').trim(),
    regionalXrayDone: Boolean(existing.regionalXrayDone || existing.regional_xray_done),
    updatedAt: existing.updatedAt || existing.updated_at || null,
  };
}

export function normalizeManualReadiness(value) {
  if (!value || typeof value !== 'object') return createDefaultManualReadiness();
  return createDefaultManualReadiness(value);
}

export function normalizeAutoReadiness(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    status: value.status || READINESS_STATUS.UNCHECKED,
    checked: value.checked && typeof value.checked === 'object' ? value.checked : {},
    matched: value.matched && typeof value.matched === 'object' ? value.matched : {},
    missing: Array.isArray(value.missing) ? value.missing : [],
    checkedAt: value.checkedAt || value.checked_at || null,
    source: value.source || '',
  };
}

function hasManualSignal(manual) {
  return ITEM_IDS.some(id => Boolean(manual.checked[id])) ||
    Boolean(manual.regionalXray) ||
    Boolean(manual.regionalXrayDone);
}

function hasAutoSignal(auto) {
  return Boolean(auto?.status) || ITEM_IDS.some(id => Boolean(auto?.checked?.[id]));
}

function itemCompleted(item, manual, auto) {
  return Boolean(manual.checked[item.id] || auto?.checked?.[item.id]);
}

function buildRequiredItems(manual, auto) {
  const requiredItems = [...READINESS_ITEMS];
  const regionalXray = String(manual.regionalXray || auto?.regionalXray || '').trim();

  if (regionalXray) {
    requiredItems.push({
      id: 'regional_xray',
      shortLabel: 'XQ vùng',
      label: `X-quang vùng riêng: ${regionalXray}`,
      category: 'imaging',
    });
  }

  return requiredItems;
}

export function evaluateSurgeryReadiness(surgery = {}) {
  const manual = normalizeManualReadiness(surgery.readiness_manual);
  const auto = normalizeAutoReadiness(surgery.readiness_auto);
  const requiredItems = buildRequiredItems(manual, auto);

  const completedItems = [];
  const missingItems = [];

  for (const item of requiredItems) {
    const completed = item.id === 'regional_xray'
      ? Boolean(manual.regionalXrayDone || auto?.checked?.regional_xray)
      : itemCompleted(item, manual, auto);

    if (completed) completedItems.push(item);
    else missingItems.push(item);
  }

  const manualSignal = hasManualSignal(manual);
  const autoSignal = hasAutoSignal(auto);
  let status = READINESS_STATUS.UNCHECKED;

  if (missingItems.length === 0) {
    status = READINESS_STATUS.READY;
  } else if (auto?.status === READINESS_STATUS.UNKNOWN && !manualSignal) {
    status = READINESS_STATUS.UNKNOWN;
  } else if (manualSignal || autoSignal) {
    status = READINESS_STATUS.MISSING;
  }

  const statusLabel = {
    [READINESS_STATUS.READY]: 'Đủ hồ sơ',
    [READINESS_STATUS.MISSING]: 'Thiếu hồ sơ',
    [READINESS_STATUS.UNCHECKED]: 'Chưa kiểm',
    [READINESS_STATUS.UNKNOWN]: 'Không xác định từ HIS',
  }[status];

  return {
    status,
    label: statusLabel,
    missingItems,
    completedItems,
    totalRequired: requiredItems.length,
    completedRequired: completedItems.length,
    checkedAt: auto?.checkedAt || manual.updatedAt || null,
    requiredItems,
  };
}

export function formatReadinessMissingText(readiness, limit = 6) {
  if (!readiness || !readiness.missingItems?.length) return '';
  const labels = readiness.missingItems.slice(0, limit).map(item => item.label);
  const remaining = readiness.missingItems.length - labels.length;
  return `${labels.join(', ')}${remaining > 0 ? ` và ${remaining} mục khác` : ''}`;
}
