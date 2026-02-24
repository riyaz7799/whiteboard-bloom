import { create } from 'zustand';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface User {
  id: string;
  name: string;
  email: string;
  image: string;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },

  logout: async () => {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    set({ user: null });
  },
}));