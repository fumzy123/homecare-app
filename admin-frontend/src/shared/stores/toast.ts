import { create } from 'zustand'

/** A deep-link offered alongside a toast — "View placement →", "View schedule →". */
export interface ToastAction {
  label: string
  to: string
  params?: Record<string, string>
}

export interface Toast {
  id: number
  message: string
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, action?: ToastAction) => void
  dismiss: (id: number) => void
}

let counter = 0
const TTL_MS = 7000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, action) => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, message, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), TTL_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Fire a toast from anywhere (components or plain callbacks). */
export const toast = (message: string, action?: ToastAction) =>
  useToastStore.getState().push(message, action)
