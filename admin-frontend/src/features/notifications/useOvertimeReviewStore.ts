import { create } from 'zustand'
import type { Notification } from './api'

interface OvertimeReviewState {
  notification: Notification | null
  open: (n: Notification) => void
  close: () => void
}

export const useOvertimeReviewStore = create<OvertimeReviewState>((set) => ({
  notification: null,
  open: (n) => set({ notification: n }),
  close: () => set({ notification: null }),
}))
