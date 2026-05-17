import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  userRole: null,
  setUser: (user) => set({ user }),
  setUserRole: (role) => set({ userRole: role }),
  clearUser: () => set({ user: null, userRole: null }),

  posts: [],
  setPosts: (posts) => set({ posts }),

  brandAssets: [],
  setBrandAssets: (assets) => set({ brandAssets: assets }),

  notification: null,
  setNotification: (notification) => set({ notification }),
  clearNotification: () => set({ notification: null }),
}))

export default useAppStore
