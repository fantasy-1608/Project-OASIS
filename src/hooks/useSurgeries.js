import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_SURGERIES, buildInitialBoardState } from '../lib/mockData';
import { encryptSurgery, decryptSurgery, encryptData } from '../lib/crypto';

export function useSurgeries(date) {
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const { data, error } = await supabase
        .from('surgeries')
        .select('*')
        .order('order_in_shift', { ascending: true });
      if (error) throw error;
      setSurgeries((data || []).map(decryptSurgery));
    } catch {
      setSurgeries(MOCK_SURGERIES.map(decryptSurgery));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSurgeries(); }, [fetchSurgeries]);

  // ---- REALTIME ----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('surgeries-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surgeries' }, fetchSurgeries)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchSurgeries]);

  // Các cột được xác nhận tồn tại trên Supabase. surgical_method sẽ thêm sau.
  const KNOWN_DB_COLUMNS = [
    'id', 'patient_name', 'diagnosis', 'priority', 'shift', 'date',
    'patient_id', 'status', 'order_in_shift', 'surgeon_id', 'room_id',
    'created_at', 'updated_at',
  ];

  const stripUnknownColumns = (obj) => {
    const clean = {};
    for (const key of Object.keys(obj)) {
      if (KNOWN_DB_COLUMNS.includes(key)) clean[key] = obj[key];
    }
    return clean;
  };

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
    const dbSurgery = stripUnknownColumns(newSurgery);
    const encryptedSurgery = encryptSurgery(dbSurgery);
    const { data, error } = await supabase.from('surgeries').insert([encryptedSurgery]).select().single();
    if (!error) setSurgeries(prev => [...prev, decryptSurgery(data)]);
    return { data, error };
  }, [date]);

  const updateSurgery = useCallback(async (id, updates) => {
    if (!isSupabaseConfigured) {
      setSurgeries(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return { error: null };
    }
    const dbUpdates = stripUnknownColumns(updates);
    const encryptedUpdates = { ...dbUpdates };
    if (encryptedUpdates.patient_name) encryptedUpdates.patient_name = encryptData(encryptedUpdates.patient_name);
    if (encryptedUpdates.diagnosis) encryptedUpdates.diagnosis = encryptData(encryptedUpdates.diagnosis);
    if (encryptedUpdates.patient_id) encryptedUpdates.patient_id = encryptData(encryptedUpdates.patient_id);

    const { error } = await supabase.from('surgeries').update(encryptedUpdates).eq('id', id);
    if (!error) setSurgeries(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    return { error };
  }, []);

  const deleteSurgery = useCallback(async (id) => {
    if (!isSupabaseConfigured) {
      setSurgeries(prev => prev.filter(s => s.id !== id));
      return { error: null };
    }
    const { error } = await supabase.from('surgeries').delete().eq('id', id);
    if (!error) setSurgeries(prev => prev.filter(s => s.id !== id));
    return { error };
  }, []);

  const moveSurgery = useCallback(async (id, targetShift, orderInShift) => {
    const updates = { shift: targetShift, order_in_shift: orderInShift };
    if (targetShift === 'morning' || targetShift === 'afternoon') {
      updates.date = date;
    }
    return updateSurgery(id, updates);
  }, [updateSurgery, date]);

  // ---- BOARD STATE ----
  const boardState = buildInitialBoardState(surgeries, date);

  return {
    surgeries,
    boardState,
    loading,
    isOnline,
    addSurgery,
    updateSurgery,
    deleteSurgery,
    moveSurgery,
    refresh: fetchSurgeries,
  };
}
