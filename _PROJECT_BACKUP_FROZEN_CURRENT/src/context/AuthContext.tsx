import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, Wallet, PurchaseItem, RegisterFormData, LoginFormData } from '../types';
import {
  fetchUserProfile,
  fetchWallet,
  fetchPurchases,
  settleAndFetchEarnings,
  loginUserAccount,
  registerUserAccount,
  clearAuthenticatedStorage,
} from '../services/api';

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  wallet: Wallet | null;
  purchases: PurchaseItem[];
  authStatus: AuthStatus;
  authLoading: boolean;
  isAuthenticated: boolean;
  isSigningOut: boolean;
  signIn: (formData: LoginFormData) => Promise<UserProfile>;
  signUp: (formData: RegisterFormData) => Promise<{ user: any; profile?: UserProfile; wallet?: Wallet; membershipNumber: string; referralCode: string }>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setWallet: React.Dispatch<React.SetStateAction<Wallet | null>>;
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseItem[]>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isSigningOutRef = useRef(false);
  const loadingUserIdRef = useRef<string | null>(null);

  // Load user data for a verified authenticated user
  const loadUserDataForUser = useCallback(async (targetUserId: string) => {
    if (!targetUserId || isSigningOutRef.current) return;
    loadingUserIdRef.current = targetUserId;

    try {
      // 1. Calculate & settle yields first
      await settleAndFetchEarnings(targetUserId).catch((e) =>
        console.warn('[AUTH] Yield settlement notice:', e)
      );

      if (isSigningOutRef.current || loadingUserIdRef.current !== targetUserId) return;

      // 2. Fetch fresh profile, wallet, and purchases in parallel
      const [freshProfile, freshWallet, freshPurchases] = await Promise.all([
        fetchUserProfile(targetUserId),
        fetchWallet(targetUserId),
        fetchPurchases(targetUserId),
      ]);

      if (isSigningOutRef.current || loadingUserIdRef.current !== targetUserId) return;

      setProfile(freshProfile);
      setWallet(freshWallet);
      setPurchases(freshPurchases);
    } catch (err) {
      console.error('[AUTH] Failed loading user profile data:', err);
    }
  }, []);

  // Main Auth State Synchronization Listener
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('[AUTH] getSession notice:', error.message);
          }

          if (!isMounted) return;

          if (data?.session?.user) {
            setSession(data.session);
            setUser(data.session.user);
            setAuthStatus('AUTHENTICATED');
            await loadUserDataForUser(data.session.user.id);
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
            setWallet(null);
            setPurchases([]);
            setAuthStatus('UNAUTHENTICATED');
          }
        } else {
          // Offline fallback mode
          try {
            const rawSession = localStorage.getItem('pb_session');
            if (rawSession) {
              const parsed = JSON.parse(rawSession);
              if (parsed?.userId) {
                setSession({ user: { id: parsed.userId, email: parsed.email } } as any);
                setUser({ id: parsed.userId, email: parsed.email } as any);
                setAuthStatus('AUTHENTICATED');
                await loadUserDataForUser(parsed.userId);
                return;
              }
            }
          } catch {}
          setAuthStatus('UNAUTHENTICATED');
        }
      } catch (err) {
        console.error('[AUTH] Auth initialization error:', err);
        if (isMounted) {
          setAuthStatus('UNAUTHENTICATED');
        }
      }
    };

    initializeAuth();

    // Supabase onAuthStateChange single central handler
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!isMounted) return;
          console.log(`[AUTH] onAuthStateChange event: ${event}, hasSession: ${!!newSession}`);

          if (event === 'SIGNED_OUT' || !newSession) {
            // Immediate synchronous state wipe on SIGNED_OUT
            setSession(null);
            setUser(null);
            setProfile(null);
            setWallet(null);
            setPurchases([]);
            setAuthStatus('UNAUTHENTICATED');
            clearAuthenticatedStorage();
            return;
          }

          if (
            (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') &&
            newSession?.user
          ) {
            if (isSigningOutRef.current) return;
            setSession(newSession);
            setUser(newSession.user);
            setAuthStatus('AUTHENTICATED');
            await loadUserDataForUser(newSession.user.id);
          }
        }
      );

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [loadUserDataForUser]);

  // Explicit Sign Out Handler
  const signOut = useCallback(async () => {
    isSigningOutRef.current = true;
    setIsSigningOut(true);

    try {
      // Record explicit logout action in session storage to keep user on /login after refresh
      try {
        sessionStorage.setItem('pb_last_auth_action', 'logout');
      } catch {}

      // Clear local storage and tokens immediately
      clearAuthenticatedStorage();

      // Reset all React state variables
      setSession(null);
      setUser(null);
      setProfile(null);
      setWallet(null);
      setPurchases([]);
      setAuthStatus('UNAUTHENTICATED');

      // Call Supabase signOut
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('[AUTH] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
      isSigningOutRef.current = false;

      // Update URL to /login cleanly
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/login');
      }
    }
  }, []);

  // Explicit Sign In Handler
  const signIn = useCallback(
    async (formData: LoginFormData) => {
      // Clear logout flag on fresh login attempt
      try {
        sessionStorage.removeItem('pb_last_auth_action');
      } catch {}

      const loggedInUser = await loginUserAccount(formData);
      const [freshProfile, freshWallet] = await Promise.all([
        fetchUserProfile(loggedInUser.id),
        fetchWallet(loggedInUser.id),
      ]);

      setUser({ id: loggedInUser.id, email: loggedInUser.email } as any);
      setProfile(freshProfile);
      setWallet(freshWallet);
      setAuthStatus('AUTHENTICATED');

      await loadUserDataForUser(loggedInUser.id);
      return freshProfile;
    },
    [loadUserDataForUser]
  );

  // Explicit Sign Up Handler
  const signUp = useCallback(
    async (formData: RegisterFormData) => {
      try {
        sessionStorage.removeItem('pb_last_auth_action');
      } catch {}

      const result = await registerUserAccount(formData);
      if (result?.user?.id) {
        setUser({ id: result.user.id, email: result.user.email } as any);
        if (result.profile) {
          setProfile(result.profile);
        }
        if (result.wallet) {
          setWallet(result.wallet);
        }
        setAuthStatus('AUTHENTICATED');
        await loadUserDataForUser(result.user.id);
      }
      return result;
    },
    [loadUserDataForUser]
  );

  // Manual Refresh Handler
  const refreshUserData = useCallback(async () => {
    const activeId = user?.id || profile?.userId || profile?.id;
    if (activeId) {
      await loadUserDataForUser(activeId);
    }
  }, [user?.id, profile?.userId, profile?.id, loadUserDataForUser]);

  const value: AuthContextType = {
    session,
    user,
    profile,
    wallet,
    purchases,
    authStatus,
    authLoading: authStatus === 'AUTH_LOADING',
    isAuthenticated: authStatus === 'AUTHENTICATED' && !isSigningOut,
    isSigningOut,
    signIn,
    signUp,
    signOut,
    refreshUserData,
    setProfile,
    setWallet,
    setPurchases,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
