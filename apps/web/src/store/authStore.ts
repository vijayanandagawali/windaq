import { create } from 'zustand';
import { getApiUrl } from '@/lib/config';
import toast from 'react-hot-toast';

export interface UserProfile {
  id: string;
  phone: string;
  role: 'USER' | 'SUPPORT' | 'RISK' | 'FINANCE' | 'SUPER_ADMIN';
  isGuest: boolean;
  kycStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt?: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Modal State
  isAuthModalOpen: boolean;
  authModalMode: 'LOGIN' | 'REGISTER' | 'GUEST';
  redirectAfterAuth: string | null;

  // Actions
  login: (phone: string, otp: string) => Promise<boolean>;
  register: (phone: string, otp: string, referralCode?: string) => Promise<boolean>;
  loginAsGuest: () => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<boolean>;
  openAuthModal: (mode?: 'LOGIN' | 'REGISTER' | 'GUEST', redirectUrl?: string) => void;
  closeAuthModal: () => void;
  clearError: () => void;
}

// Sessions live in an httpOnly cookie set by the /api proxy; page code never sees the token.
// Older builds stored a bearer token here — it is purged on sight.
const LEGACY_TOKEN_KEY = 'windaq_auth_token';
const USER_KEY = 'windaq_user_data';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: false,
  error: null,
  isAuthModalOpen: false,
  authModalMode: 'LOGIN',
  redirectAfterAuth: null,

  openAuthModal: (mode = 'LOGIN', redirectUrl) => {
    set({
      isAuthModalOpen: true,
      authModalMode: mode,
      redirectAfterAuth: redirectUrl || null,
      error: null
    });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false, error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  login: async (phone: string, otp: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Login failed. Please verify your phone and OTP.';
        set({ error: errorMsg, isLoading: false });
        toast.error(errorMsg);
        return false;
      }

      const user: UserProfile = {
        id: data.user.id,
        phone: data.user.phone,
        role: data.user.role,
        isGuest: data.user.isGuest || false,
        createdAt: data.user.createdAt
      };


      if (typeof window !== 'undefined') {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      set({
        user,
        isAuthenticated: true,
        isGuest: user.isGuest,
        isLoading: false,
        isAuthModalOpen: false,
        error: null
      });

      // Synchronize Wallet Store
      const { useWalletStore } = await import('@/store/walletStore');
      useWalletStore.getState().setAuthenticatedUser(user, data.wallet?.balance ?? 0);

      toast.success(data.message || 'Logged in successfully!');
      return true;
    } catch {
      const errorMsg = 'Network error. Could not connect to authentication server.';
      set({ error: errorMsg, isLoading: false });
      toast.error(errorMsg);
      return false;
    }
  },

  register: async (phone: string, otp: string, referralCode?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, referralCode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Registration failed. Please check your phone number.';
        set({ error: errorMsg, isLoading: false });
        toast.error(errorMsg);
        return false;
      }

      const user: UserProfile = {
        id: data.user.id,
        phone: data.user.phone,
        role: data.user.role,
        isGuest: false,
        createdAt: data.user.createdAt
      };


      if (typeof window !== 'undefined') {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      set({
        user,
        isAuthenticated: true,
        isGuest: false,
        isLoading: false,
        isAuthModalOpen: false,
        error: null
      });

      // Synchronize Wallet Store
      const { useWalletStore } = await import('@/store/walletStore');
      useWalletStore.getState().setAuthenticatedUser(user, data.wallet?.balance ?? 0);

      toast.success('Registration successful! Welcome to WinDaq.');
      return true;
    } catch {
      const errorMsg = 'Network error. Registration server unavailable.';
      set({ error: errorMsg, isLoading: false });
      toast.error(errorMsg);
      return false;
    }
  },

  loginAsGuest: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(getApiUrl('/api/auth/guest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: true })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Could not provision test guest account.';
        set({ error: errorMsg, isLoading: false });
        toast.error(errorMsg);
        return false;
      }

      const user: UserProfile = {
        id: data.user.id,
        phone: data.user.phone,
        role: data.user.role,
        isGuest: true,
        createdAt: data.user.createdAt
      };


      if (typeof window !== 'undefined') {
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      set({
        user,
        isAuthenticated: true,
        isGuest: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null
      });

      // Synchronize Wallet Store
      const { useWalletStore } = await import('@/store/walletStore');
      useWalletStore.getState().setAuthenticatedUser(user, data.wallet?.balance ?? 0);

      toast.success('Entered 🧪 TEST GUEST MODE! ₹50,000 sandbox balance provisioned.');
      return true;
    } catch {
      const errorMsg = 'Network error. Test guest service unavailable.';
      set({ error: errorMsg, isLoading: false });
      toast.error(errorMsg);
      return false;
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    // Revokes the server-side session; the proxy clears the httpOnly cookie.
    fetch(getApiUrl('/api/auth/logout'), { method: 'POST' }).catch(() => {});

    set({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      isLoading: false,
      error: null
    });

    // Reset Wallet Store
    import('@/store/walletStore').then(({ useWalletStore }) => {
      useWalletStore.getState().resetWallet();
    });

    toast.success('Logged out successfully.');
  },

  checkSession: async () => {
    if (typeof window === 'undefined') return false;

    localStorage.removeItem(LEGACY_TOKEN_KEY);
    const cachedUser = localStorage.getItem(USER_KEY);

    try {
      // The httpOnly session cookie is sent automatically (same-origin request).
      const res = await fetch(getApiUrl('/api/auth/me'), { cache: 'no-store' });
      const data = await res.json();

      // 401: no session, or it expired / was revoked on the server.
      if (res.status === 401) {
        localStorage.removeItem(USER_KEY);
        set({ isAuthenticated: false, user: null, isLoading: false });
        if (cachedUser) toast.error('Session expired. Please log in again.');
        return false;
      }

      if (data.success && data.user) {
        const user: UserProfile = {
          id: data.user.id,
          phone: data.user.phone,
          role: data.user.role,
          isGuest: data.user.isGuest || false,
          kycStatus: data.user.kycStatus,
          createdAt: data.user.createdAt
        };

        localStorage.setItem(USER_KEY, JSON.stringify(user));
        set({
          user,
            isAuthenticated: true,
          isGuest: user.isGuest,
          isLoading: false
        });

        // Sync wallet
        const { useWalletStore } = await import('@/store/walletStore');
        useWalletStore.getState().setAuthenticatedUser(user, data.wallet?.balance ?? 0);

        return true;
      }

      // If response unexpected but cached user exists, fall back gracefully
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        set({ user: parsed, isAuthenticated: true, isGuest: parsed.isGuest, isLoading: false });
        return true;
      }

      return false;
    } catch {
      // Offline / network failure: retain cached session if available
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        set({ user: parsed, isAuthenticated: true, isGuest: parsed.isGuest, isLoading: false });
        return true;
      }
      return false;
    }
  }
}));
