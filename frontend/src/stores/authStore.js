import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export default create(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    {
      name: 'wisemark-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
