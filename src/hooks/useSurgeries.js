import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_SURGERIES, buildInitialBoardState } from '../lib/mockData';
import { packExtras, unpackExtras } from '../lib/surgeryExtras';
import { getEditToken } from '../lib/editSession';

// Các cột được xác nhận tồn tại trên Supabase
const KNOWN_DB_COLUMNS = [
  'id', 'patient_name', 'diagnosis', 'priority', 'shift', 'date',
  'patient_id', 'status', 'order_in_shift', 'surgeon_id', 'room_id',
  'gender', 'birth_year', 'age',
  'procedure', 'start_time', 'duration_minutes', 'anesthesia', 'equipment',
  'notes', 'created_at', 'updated_at',
];

function stripUnknownColumns(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (KNOWN_DB_COLUMNS.includes(key)) clean[key] = obj[key];
  }
  return clean;
}

async function invokeSurgeryWrite(action, payload) {
  const editToken = getEditToken();
  if (!editToken) {
    return { error: new Error('Phiên mở khóa đã hết hạn. Vui lòng mở khóa lại.') };
  }

  const { data, error } = await supabase.functions.invoke('oasis-surgery-api', {
    body: {
      action,
      editToken,
      ...payload,
    },
  });

  if (error) return { error };
  if (data?.error) return { error: new Error(data.error) };
  return { data: data?.data ?? data, error: null };
}

async function invokeSurgeryRead() {
  const { data, error } = await supabase.functions.invoke('oasis-surgery-api', {
    body: {
      action: 'read_surgeries',
    },
  });

  if (error) return { error };
  if (data?.error) return { error: new Error(data.error) };
  return { data: data?.data || [], error: null };
}

export function useSurgeries(date) {
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [isOnline] = useState(isSupabaseConfigured);

  // ---- FETCH ----
  const fetchSurgeries = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSurgeries(MOCK_SURGERIES);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setConnectionError(null);
      const { data, error } = await invokeSurgeryRead();
      if (!error) {
        setSurgeries((data || []).map(d => unpackExtras(d)));
        return;
      }

      throw error;
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
    const { data, error } = await invokeSurgeryWrite('create_surgery', { record: dbSurgery });
    if (!error) setSurgeries(prev => [...prev, unpackExtras(data)]);
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

    const { data, error } = await invokeSurgeryWrite('update_surgery', { id, updates: toSend });
    if (!error) {
      const updated = data ? unpackExtras(data) : { ...merged, ...updates };
      setSurgeries(prev => prev.map(s => s.id === id ? updated : s));
    }
    return { data, error };
  }, [surgeries]);

  const deleteSurgery = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setSurgeries(prev => prev.filter(s => s.id !== id));
      return { error: null };
    }
    const { error } = await invokeSurgeryWrite('delete_surgery', { id });
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

    const updates = Object.entries(updatesMap).map(([taskId, merged]) => {
      const packed = packExtras(merged);
      const toSend = {};
      // Lấy tất cả column changes
      for (const key of KNOWN_DB_COLUMNS) {
        if (merged[key] !== undefined) toSend[key] = packed[key];
      }
      toSend.notes = packed.notes || null;

      return { id: taskId, updates: toSend };
    });

    const { error } = await invokeSurgeryWrite('move_surgery', { updates });
    if (error) {
      await fetchSurgeries();
      return { error };
    }
    return { error: null };

  }, [surgeries, date, fetchSurgeries]);

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
