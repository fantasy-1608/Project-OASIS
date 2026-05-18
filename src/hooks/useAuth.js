/**
 * ============================================================
 * PROJECT OASIS — Hook: useAuth
 * ============================================================
 *
 * Phase 2 — Kích hoạt Supabase Auth + Role-Based Access
 *
 * Khi FEATURES.AUTH_ENABLED = true:
 *   - Sử dụng Supabase Auth thực sự
 *   - Role-based permissions (admin, scheduler, nurse, viewer)
 *   - LoginModal.jsx thay thế window.prompt('CTCH')
 *
 * Khi FEATURES.AUTH_ENABLED = false:
 *   - Fallback về cơ chế unlock 'CTCH' cũ (không đổi hành vi)
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isEnabled } from '../lib/featureFlags';

// ============================================================
// Role permissions map
// ============================================================
const ROLE_PERMISSIONS = {
  admin: {
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canDrag: true,
    canLockProgram: true,
    canViewAuditLog: true,
    canManageSurgeons: true,
  },
  scheduler: {
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canDrag: true,
    canLockProgram: false,
    canViewAuditLog: false,
    canManageSurgeons: false,
  },
  nurse: {
    canAdd: false,
    canEdit: false,       // Chỉ sửa status
    canMarkStatus: true,  // in_progress, completed
    canDelete: false,
    canDrag: false,
    canLockProgram: false,
    canViewAuditLog: false,
    canManageSurgeons: false,
  },
  viewer: {
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canDrag: false,
    canLockProgram: false,
    canViewAuditLog: false,
    canManageSurgeons: false,
  },
};

// ============================================================
// Hook
// ============================================================
export function useAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('viewer');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(() => isEnabled('AUTH_ENABLED'));
  const [error, setError] = useState(null);

  // ---- Fetch user profile from DB ----
  const fetchUserProfile = useCallback(async (userId) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('role, display_name')
        .eq('id', userId)
        .single();
      if (!fetchError && data) {
        setRole(data.role);
        setDisplayName(data.display_name);
      }
    } catch (err) {
      console.warn('[useAuth] Could not fetch profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Session management (chỉ chạy khi AUTH_ENABLED) ----
  useEffect(() => {
    if (!isEnabled('AUTH_ENABLED') || !isSupabaseConfigured || !supabase) {
      return;
    }

    // Lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setRole('viewer');
        setDisplayName('');
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // ---- Sign In ----
  const signIn = useCallback(async (email, password) => {
    if (!isEnabled('AUTH_ENABLED')) {
      console.warn('[useAuth] AUTH_ENABLED is false. signIn is no-op.');
      return { error: new Error('AUTH_ENABLED is false') };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { error: new Error('Supabase not configured') };
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError);
        return { error: authError };
      }
      return { data };
    } catch (err) {
      setError(err);
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Sign Out ----
  const signOut = useCallback(async () => {
    if (!isEnabled('AUTH_ENABLED')) {
      console.warn('[useAuth] AUTH_ENABLED is false. signOut is no-op.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setRole('viewer');
    setDisplayName('');
  }, []);

  /**
   * Check if current user has a specific permission
   * @param {keyof typeof ROLE_PERMISSIONS.admin} permission
   */
  const can = useCallback((permission) => {
    return ROLE_PERMISSIONS[role]?.[permission] === true;
  }, [role]);

  return {
    user,
    role,
    displayName,
    isLoading,
    error,
    signIn,
    signOut,
    can,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
    isScheduler: ['admin', 'scheduler'].includes(role),
    isNurse: role === 'nurse',
    isViewer: role === 'viewer',
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer,
  };
}

// ============================================================
// Export role permissions for reference
// ============================================================
export { ROLE_PERMISSIONS };
