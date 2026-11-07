import { createContext, useContext } from 'react'

export interface ConfirmationOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => Promise<unknown>
}
export type Confirm = (options: ConfirmationOptions) => Promise<boolean>
export const ConfirmationContext = createContext<Confirm | null>(null)
export function useConfirmation() {
  const confirm = useContext(ConfirmationContext)
  if (!confirm) throw new Error('ConfirmationProvider is required')
  return confirm
}
