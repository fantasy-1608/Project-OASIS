/**
 * ============================================================
 * PROJECT OASIS — Hook: useAuth
 * ============================================================
 *
 * TRẠNG THÁI: ⏸️  SKELETON — CHƯA KẾT NỐI VÀO APP
 *
 * Khi FEATURES.AUTH_ENABLED = true:
 *   - Thay thế window.prompt('CTCH') trong App.jsx
 *   - Wrap Supabase Auth với role-based access
 *   - LoginModal.jsx sẽ được render thay cơ chế unlock hiện tại
 *
 * CÁCH KẾT NỐI vào App.jsx khi sẵn sàng:
 *   1. Import useAuth tại đầu App.jsx
 *   2. Thêm: const { user, role, signIn, signOut, isLoading } = useAuth();
 *   3. Thay isUnlocked bằng role check: canEdit = ['admin','scheduler'].includes(role)
 *   4. Xoá handleToggleLock() và requireUnlock()
 *   5. Set FEATURES.AUTH_ENABLED = true
 * ============================================================
 */

import { useState, useCallback } from 'react';
// import { supabase } from '../lib/supabase'; // Uncomment khi kết nối

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
  // State — setters are intentionally unused until AUTH_ENABLED = true
   
  const [user, _setUser] = useState(null);
  // role stays 'viewer' until AUTH_ENABLED = true (no setter needed yet)
  const [role] = useState('viewer');
   
  const [displayName, _setDisplayName] = useState('');
  const [isLoading] = useState(false); // false by default; real auth sets this via getSession
   
  const [error, _setError] = useState(null);

  // TODO: Implement khi FEATURES.AUTH_ENABLED = true
  // useEffect(() => {
  //   // Lấy session hiện tại
  //   supabase.auth.getSession().then(({ data: { session } }) => {
  //     setUser(session?.user ?? null);
  //     if (session?.user) fetchUserProfile(session.user.id);
  //     setIsLoading(false);
  //   });
  //
  //   // Listen for auth changes
  //   const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  //     setUser(session?.user ?? null);
  //     if (session?.user) fetchUserProfile(session.user.id);
  //     else { setRole('viewer'); setDisplayName(''); }
  //   });
  //
  //   return () => subscription.unsubscribe();
  // }, []);

  // const fetchUserProfile = async (userId) => {
  //   const { data, error } = await supabase
  //     .from('user_profiles')
  //     .select('role, display_name')
  //     .eq('id', userId)
  //     .single();
  //   if (!error && data) {
  //     setRole(data.role);
  //     setDisplayName(data.display_name);
  //   }
  //   setIsLoading(false);
  // };

   
  const signIn = useCallback(async (..._args) => {
    // setIsLoading(true);
    // const { data, error } = await supabase.auth.signInWithPassword({ email: _email, password: _password });
    // setIsLoading(false);
    // if (error) return { error };
    // return { data };
    console.warn('[useAuth] signIn: AUTH_ENABLED is false. This is a no-op skeleton.');
    return { error: new Error('AUTH_ENABLED is false') };
  }, []);

  const signOut = useCallback(async () => {
    // await supabase.auth.signOut();
    // _setUser(null); setRole('viewer'); _setDisplayName('');
    console.warn('[useAuth] signOut: AUTH_ENABLED is false. This is a no-op skeleton.');
  }, []);

  /**
   * Check if current user has a specific permission
   * @param {keyof typeof ROLE_PERMISSIONS.admin} permission
   */
  const can = useCallback((permission) => {
    return ROLE_PERMISSIONS[role]?.[permission] === true;
  }, [role]);

  // isLoading = false by default (useState(false) above) when AUTH is disabled

  return {
    user,
    role,
    displayName,
    isLoading,
    error,
    signIn,
    signOut,
    can,
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
