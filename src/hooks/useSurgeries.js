import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_SURGERIES, buildInitialBoardState } from '../lib/mockData';
import { encryptSurgery, decryptSurgery, encryptData } from '../lib/crypto';

// ---- Pack/Unpack extra fields into DB `notes` column ----
// DB chưa có cột surgical_method, admission_date → pack vào notes dưới dạng JSON
const EXTRA_FIELDS = ['surgical_method', 'admission_date'];

function packExtras(surgery) {
  const extras = {};
  let hasExtras = false;
  for (const key of EXTRA_FIELDS) {
    if (surgery[key]) { extras[key] = surgery[key]; hasExtras = true; }
  }
  const packed = { ...surgery };
  if (hasExtras) {
    packed.notes = JSON.stringify(extras);
  }
  // Loại bỏ các field chưa có trên DB
  for (const key of EXTRA_FIELDS) delete packed[key];
  return packed;
}

function unpackExtras(surgery) {
  const unpacked = { ...surgery };
  if (unpacked.notes) {
    try {
      const extras = JSON.parse(unpacked.notes);
      for (const key of EXTRA_FIELDS) {
        if (extras[key]) unpacked[key] = extras[key];
      }
    } catch {
      // notes không phải JSON (dữ liệu cũ) → giữ nguyên
    }
  }
  return unpacked;
}

// Các cột được xác nhận tồn tại trên Supabase
const KNOWN_DB_COLUMNS = [
  'id', 'patient_name', 'diagnosis', 'priority', 'shift', 'date',
  'patient_id', 'status', 'order_in_shift', 'surgeon_id', 'room_id',
  'notes', 'created_at', 'updated_at',
];

function stripUnknownColumns(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (KNOWN_DB_COLUMNS.includes(key)) clean[key] = obj[key];
  }
  return clean;
}

export function useSurgeries(date) {
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [isOnline] = useState(isSupabaseConfigured);

  // ---- FETCH ----
  const fetchSurgeries = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSurgeries(MOCK_SURGERIES.map(decryptSurgery));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setConnectionError(null);
      const { data, error } = await supabase
        .from('surgeries')
        .select('*')
        .order('order_in_shift', { ascending: true });
      if (error) throw error;
      setSurgeries((data || []).map(d => unpackExtras(decryptSurgery(d))));
    } catch (error) {
      setConnectionError(error);
      setSurgeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) fetchSurgeries();
    });
    return () => { isMounted = false; };
  }, [fetchSurgeries]);

  // ---- REALTIME ----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('surgeries-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surgeries' }, fetchSurgeries)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchSurgeries]);

  const addSurgery = useCallback(async (surgery) => {
    const newSurgery = {
      ...surgery,
      id: `surg-${Date.now()}`,
      status: 'scheduled',
      date: surgery.date || date,
    };
    if (!isSupabaseConfigured) {
      setSurgeries(prev => [...prev, newSurgery]);
      return { data: newSurgery, error: null };
    }
    // Pack extras → strip → encrypt → send
    const packed = packExtras(newSurgery);
    const dbSurgery = stripUnknownColumns(packed);
    const encryptedSurgery = encryptSurgery(dbSurgery);
    const { data, error } = await supabase.from('surgeries').insert([encryptedSurgery]).select().single();
    if (!error) setSurgeries(prev => [...prev, unpackExtras(decryptSurgery(data))]);
    return { data, error };
  }, [date]);

  const updateSurgery = useCallback(async (id, updates) => {
    if (!isSupabaseConfigured) {
      setSurgeries(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return { error: null };
    }
    // Merge current surgery data với updates trước khi pack
    const currentSurgery = surgeries.find(s => s.id === id);
    const merged = { ...currentSurgery, ...updates };

    // Pack extras vào notes
    const packed = packExtras(merged);

    // Chỉ gửi các field thay đổi + notes (vì notes chứa extras)
    const toSend = {};
    for (const key of Object.keys(updates)) {
      if (KNOWN_DB_COLUMNS.includes(key)) toSend[key] = packed[key];
    }
    // Luôn gửi notes vì extras có thể đã thay đổi
    toSend.notes = packed.notes || null;

    // Encrypt sensitive fields
    if (toSend.patient_name) toSend.patient_name = encryptData(toSend.patient_name);
    if (toSend.diagnosis) toSend.diagnosis = encryptData(toSend.diagnosis);
    if (toSend.patient_id) toSend.patient_id = encryptData(toSend.patient_id);

    const { error } = await supabase.from('surgeries').update(toSend).eq('id', id);
    if (!error) setSurgeries(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    return { error };
  }, [surgeries]);

  const deleteSurgery = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setSurgeries(prev => prev.filter(s => s.id !== id));
      return { error: null };
    }
    const { error } = await supabase.from('surgeries').delete().eq('id', id);
    if (!error) setSurgeries(prev => prev.filter(s => s.id !== id));
    return { error };
  }, []);

  const moveSurgery = useCallback(async (id, targetShift, targetTaskIds, sourceShift, sourceTaskIds) => {
    // 1. Calculate updates
    const updatesMap = {};
    const newDate = (targetShift === 'morning' || targetShift === 'afternoon') ? date : undefined;

    // Helper to compute updates for a column
    const computeColumnUpdates = (taskIds, shift) => {
      taskIds.forEach((taskId, index) => {
        const surgery = surgeries.find(s => s.id === taskId);
        if (!surgery) return;
        const changes = {};
        if (taskId === id) {
          changes.shift = shift;
          if (newDate) changes.date = newDate;
        }
        if (surgery.order_in_shift !== index) {
          changes.order_in_shift = index;
        }
        if (Object.keys(changes).length > 0) {
          updatesMap[taskId] = { ...surgery, ...changes };
        }
      });
    };

    computeColumnUpdates(targetTaskIds, targetShift);
    if (sourceShift !== targetShift) {
      computeColumnUpdates(sourceTaskIds, sourceShift);
    }

    // 2. Optimistic UI Update
    setSurgeries(prev => prev.map(s => updatesMap[s.id] || s));

    // 3. Send updates to Supabase asynchronously
    if (!isSupabaseConfigured) return;

    Object.entries(updatesMap).forEach(async ([taskId, merged]) => {
      const packed = packExtras(merged);
      const toSend = {};
      // Lấy tất cả column changes 
      for (const key of KNOWN_DB_COLUMNS) {
        if (merged[key] !== undefined) toSend[key] = packed[key];
      }
      toSend.notes = packed.notes || null;

      if (toSend.patient_name) toSend.patient_name = encryptData(toSend.patient_name);
      if (toSend.diagnosis) toSend.diagnosis = encryptData(toSend.diagnosis);
      if (toSend.patient_id) toSend.patient_id = encryptData(toSend.patient_id);

      // Fire and forget update
      await supabase.from('surgeries').update(toSend).eq('id', taskId);
    });

  }, [surgeries, date]);

  // ---- BOARD STATE ----
  const boardState = buildInitialBoardState(surgeries, date);

  return {
    surgeries,
    boardState,
    loading,
    isOnline,
    connectionError,
    addSurgery,
    updateSurgery,
    deleteSurgery,
    moveSurgery,
    refresh: fetchSurgeries,
  };
}
