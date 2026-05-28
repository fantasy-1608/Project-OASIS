import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { format, addDays } from 'date-fns';
import {
  READINESS_ITEMS,
  createDefaultManualReadiness,
  evaluateSurgeryReadiness,
  formatReadinessMissingText,
  normalizeManualReadiness,
} from '../../lib/readiness';

const DEFAULT_FORM = {
  patient_name: '',
  patient_id: '',
  diagnosis: '',
  surgical_method: '',
  priority: 'elective',
  shift: 'morning',
  date: format(new Date(), 'yyyy-MM-dd'),
  room: '',
  // Các field ẩn — giữ giá trị mặc định để không lỗi DB
  status: 'scheduled',
  order_in_shift: 999,
  readiness_manual: createDefaultManualReadiness(),
};

function generatePatientId() {
  return `BN-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}

export function SurgeryModal({ isOpen, onClose, onSave, initialData, defaultShift, currentDate }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!initialData?.id;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialData, setPrevInitialData] = useState(initialData);

  if (isOpen !== prevIsOpen || initialData !== prevInitialData) {
    setPrevIsOpen(isOpen);
    setPrevInitialData(initialData);
    if (isOpen) {
      if (initialData) {
        setForm({
          ...DEFAULT_FORM,
          ...initialData,
          readiness_manual: normalizeManualReadiness(initialData.readiness_manual),
        });
      } else {
        setForm({
          ...DEFAULT_FORM,
          shift: defaultShift || 'morning',
          date: currentDate || format(new Date(), 'yyyy-MM-dd'),
          patient_id: generatePatientId(),
          readiness_manual: createDefaultManualReadiness(),
        });
      }
      setErrors({});
    }
  }

  if (!isOpen) return null;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const manualReadiness = normalizeManualReadiness(form.readiness_manual);
  const readinessSummary = evaluateSurgeryReadiness({
    readiness_manual: manualReadiness,
    readiness_auto: form.readiness_auto,
  });
  const missingReadinessText = formatReadinessMissingText(readinessSummary, 4);

  const setManualReadiness = (updater) => {
    setForm(prev => {
      const nextManual = updater(normalizeManualReadiness(prev.readiness_manual));
      return {
        ...prev,
        readiness_manual: {
          ...nextManual,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const toggleReadinessItem = (itemId) => {
    setManualReadiness(current => ({
      ...current,
      checked: {
        ...current.checked,
        [itemId]: !current.checked[itemId],
      },
    }));
  };

  const setRegionalXray = (value) => {
    setManualReadiness(current => ({
      ...current,
      regionalXray: value,
      regionalXrayDone: value.trim() ? current.regionalXrayDone : false,
    }));
  };

  const setRegionalXrayDone = () => {
    setManualReadiness(current => ({
      ...current,
      regionalXrayDone: !current.regionalXrayDone,
    }));
  };

  const formatCheckedAt = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const validate = () => {
    const e = {};
    if (!form.patient_name.trim()) e.patient_name = 'Bắt buộc nhập tên bệnh nhân';
    if (!form.diagnosis.trim()) e.diagnosis = 'Bắt buộc nhập chẩn đoán';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    await onSave({
      ...form,
      patient_id: form.patient_id || generatePatientId(),
      surgeon_id: form.surgeon_id || null,
      room_id: form.room_id || null,
      readiness_manual: normalizeManualReadiness(form.readiness_manual),
    });
    setIsSaving(false);
    onClose();
  };

  // Tạo nhanh các ngày gợi ý
  const today = new Date();
  const dateOptions = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const date = addDays(today, d);
    return { value: format(date, 'yyyy-MM-dd'), label: format(date, 'dd/MM') };
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-panel glass-panel" style={{ maxWidth: '620px' }} onSubmit={handleSubmit}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? '✏️ Chỉnh sửa dự kiến mổ' : '➕ Thêm dự kiến mổ'}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Tên bệnh nhân */}
          <div className="form-field">
            <label>Tên bệnh nhân *</label>
            <input
              type="text"
              className={`form-input ${errors.patient_name ? 'form-input--error' : ''}`}
              value={form.patient_name}
              onChange={e => set('patient_name', e.target.value)}
              placeholder=""
              autoFocus
            />
            {errors.patient_name && <span className="form-error">{errors.patient_name}</span>}
          </div>

          {/* Giới tính và Năm sinh */}
          <div className="form-grid-2">
            <div className="form-field">
              <label>Giới tính</label>
              <select
                className="form-input"
                value={form.gender || ''}
                onChange={e => set('gender', e.target.value)}
              >
                <option value="">-- Chọn --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div className="form-field">
              <label>Năm sinh</label>
              <input
                type="text"
                className="form-input"
                value={form.birth_year || ''}
                onChange={e => set('birth_year', e.target.value)}
                placeholder="VD: 1990"
              />
            </div>
          </div>

          {/* Mã bệnh nhân và Buồng */}
          <div className="form-grid-2">
            <div className="form-field">
              <label>Mã bệnh nhân / Mã BA</label>
              <input
                type="text"
                className="form-input"
                value={form.patient_id || ''}
                onChange={e => set('patient_id', e.target.value)}
                placeholder="VD: 24012345"
              />
            </div>
            <div className="form-field">
              <label>Buồng / Phòng</label>
              <input
                type="text"
                className="form-input"
                value={form.room || ''}
                onChange={e => set('room', e.target.value)}
                placeholder="VD: N"
              />
            </div>
          </div>

          {/* Chẩn đoán */}
          <div className="form-field">
            <label>Chẩn đoán *</label>
            <input
              type="text"
              className={`form-input ${errors.diagnosis ? 'form-input--error' : ''}`}
              value={form.diagnosis}
              onChange={e => set('diagnosis', e.target.value)}
              placeholder=""
            />
            {errors.diagnosis && <span className="form-error">{errors.diagnosis}</span>}
          </div>

          {/* Phương pháp mổ */}
          <div className="form-field">
            <label>Phương pháp mổ</label>
            <input
              type="text"
              className="form-input"
              value={form.surgical_method || ''}
              onChange={e => set('surgical_method', e.target.value)}
              placeholder=""
            />
          </div>

          {/* Ngày nhập viện */}
          <div className="form-field">
            <label>Ngày nhập viện</label>
            <input
              type="text"
              className="form-input"
              value={form.admission_date || ''}
              readOnly
              style={{ opacity: 0.7, cursor: 'default' }}
            />
          </div>

          <div className="form-section readiness-section">
            <div className="form-section-title">Sẵn sàng hồ sơ</div>
            <div className={`readiness-summary readiness-summary--${readinessSummary.status}`}>
              <span className="readiness-summary-label">{readinessSummary.label}</span>
              {readinessSummary.status === 'missing' && missingReadinessText && (
                <span className="readiness-summary-missing">{missingReadinessText}</span>
              )}
              {readinessSummary.checkedAt && (
                <span className="readiness-summary-time">HIS {formatCheckedAt(readinessSummary.checkedAt)}</span>
              )}
            </div>

            <div className="readiness-checklist">
              {READINESS_ITEMS.map(item => (
                <label key={item.id} className="readiness-check-row">
                  <input
                    type="checkbox"
                    checked={Boolean(manualReadiness.checked[item.id])}
                    onChange={() => toggleReadinessItem(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="readiness-regional-row">
              <div className="form-field">
                <label>X-quang vùng riêng</label>
                <input
                  type="text"
                  className="form-input"
                  value={manualReadiness.regionalXray}
                  onChange={e => setRegionalXray(e.target.value)}
                  placeholder="VD: cột sống, khớp háng, gối, cổ chân"
                />
              </div>
              <label className={`readiness-check-row readiness-check-row--regional ${manualReadiness.regionalXray ? '' : 'readiness-check-row--disabled'}`}>
                <input
                  type="checkbox"
                  checked={Boolean(manualReadiness.regionalXrayDone)}
                  onChange={setRegionalXrayDone}
                  disabled={!manualReadiness.regionalXray}
                />
                <span>Đã có</span>
              </label>
            </div>
          </div>

          {/* Ưu tiên */}
          <div className="form-field">
            <label>Mức độ ưu tiên</label>
            <div className="priority-selector">
              {[
                { value: 'elective', label: '✅ Chương trình' },
                { value: 'urgent',   label: '⚡ Bán cấp' },
                { value: 'emergency', label: '🚨 Cấp cứu' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`priority-option ${form.priority === opt.value ? 'priority-option--active' : ''}`}
                  onClick={() => set('priority', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buổi dự kiến */}
          <div className="form-field">
            <label>Buổi dự kiến</label>
            <div className="shift-selector">
              <button
                type="button"
                className={`shift-option ${form.shift === 'morning' ? 'shift-option--active' : ''}`}
                onClick={() => set('shift', 'morning')}
              >
                🌅 Ca Sáng
              </button>
              <button
                type="button"
                className={`shift-option ${form.shift === 'afternoon' ? 'shift-option--active' : ''}`}
                onClick={() => set('shift', 'afternoon')}
              >
                🌆 Ca Chiều
              </button>
              <button
                type="button"
                className={`shift-option ${form.shift === 'waiting' ? 'shift-option--active' : ''}`}
                onClick={() => set('shift', 'waiting')}
              >
                🕐 Chờ
              </button>
            </div>
          </div>

          {/* Ngày dự kiến — quick-select 7 ngày */}
          <div className="form-field" style={{ opacity: form.shift === 'waiting' ? 0.4 : 1, pointerEvents: form.shift === 'waiting' ? 'none' : 'auto' }}>
            <label>Ngày dự kiến {form.shift === 'waiting' && <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>(Không áp dụng cho ca chờ)</span>}</label>
            <div className="date-quick-select">
              {dateOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`date-option ${form.date === opt.value ? 'date-option--active' : ''}`}
                  onClick={() => set('date', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Hoặc chọn thủ công */}
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              style={{ marginTop: '8px' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? '...' : <><Save size={14} /> {isEdit ? 'Cập nhật' : 'Thêm dự kiến'}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
