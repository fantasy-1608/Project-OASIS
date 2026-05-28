import assert from 'node:assert/strict';
import {
  READINESS_STATUS,
  evaluateSurgeryReadiness,
  READINESS_ITEMS,
} from '../src/lib/readiness.js';
import { packExtras, unpackExtras } from '../src/lib/surgeryExtras.js';

const allChecked = Object.fromEntries(READINESS_ITEMS.map(item => [item.id, true]));

{
  const result = evaluateSurgeryReadiness({
    readiness_manual: { checked: allChecked },
  });
  assert.equal(result.status, READINESS_STATUS.READY);
  assert.equal(result.missingItems.length, 0);
}

{
  const result = evaluateSurgeryReadiness({
    readiness_manual: {
      checked: {
        ...allChecked,
        ecg: false,
        surgery_consent: false,
      },
    },
  });
  assert.equal(result.status, READINESS_STATUS.MISSING);
  assert.deepEqual(result.missingItems.map(item => item.id), ['ecg', 'surgery_consent']);
}

{
  const result = evaluateSurgeryReadiness({
    readiness_manual: {
      checked: allChecked,
      regionalXray: 'khớp háng',
      regionalXrayDone: false,
    },
  });
  assert.equal(result.status, READINESS_STATUS.MISSING);
  assert.deepEqual(result.missingItems.map(item => item.id), ['regional_xray']);
  assert.equal(result.missingItems[0].label, 'X-quang vùng riêng: khớp háng');
}

{
  const result = evaluateSurgeryReadiness({
    readiness_auto: {
      status: 'checked',
      checked: allChecked,
      checkedAt: '2026-05-01T00:00:00.000Z',
    },
  });
  assert.equal(result.status, READINESS_STATUS.READY);
  assert.equal(result.checkedAt, '2026-05-01T00:00:00.000Z');
}

{
  const result = evaluateSurgeryReadiness({
    readiness_auto: { status: READINESS_STATUS.UNKNOWN, checked: {} },
  });
  assert.equal(result.status, READINESS_STATUS.UNKNOWN);
}

{
  const oldResult = evaluateSurgeryReadiness({
    readiness_auto: {
      status: 'checked',
      checked: {
        ...allChecked,
        cbc: false,
      },
      checkedAt: '2024-01-01T00:00:00.000Z',
    },
  });
  assert.equal(oldResult.status, READINESS_STATUS.MISSING);
  assert.deepEqual(oldResult.missingItems.map(item => item.id), ['cbc']);
}

{
  const packed = packExtras({
    id: 'case-1',
    notes: 'ghi chú cũ',
    surgical_method: 'Kết hợp xương',
    admission_date: '01/05/2026',
    room: '12',
    readiness_manual: { checked: allChecked },
  });
  assert.equal(packed.surgical_method, undefined);
  assert.equal(packed.admission_date, undefined);
  assert.equal(packed.room, undefined);
  assert.equal(packed.readiness_manual, undefined);

  const unpacked = unpackExtras(packed);
  assert.equal(unpacked.notes, 'ghi chú cũ');
  assert.equal(unpacked.surgical_method, 'Kết hợp xương');
  assert.equal(unpacked.admission_date, '01/05/2026');
  assert.equal(unpacked.room, '12');
  assert.deepEqual(unpacked.readiness_manual, { checked: allChecked });
}

{
  const legacy = unpackExtras({ id: 'legacy', notes: 'ghi chú chưa phải JSON' });
  assert.equal(legacy.notes, 'ghi chú chưa phải JSON');
  assert.equal(legacy.readiness_manual, undefined);
}

console.log('readiness tests passed');
