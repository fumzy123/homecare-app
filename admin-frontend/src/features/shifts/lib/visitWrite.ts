import { onlineManager } from '@tanstack/react-query'
import { ApiError } from '@/shared/lib/api-client'

export function requireVisitConnection() {
  if (!onlineManager.isOnline() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    throw new ApiError("You're offline. Your changes haven't been sent. Your entries are still here; reconnect and retry saving.", 'VISIT_OFFLINE')
  }
}

export function isVisitConnectionError(error: unknown) {
  return error instanceof ApiError && ['VISIT_OFFLINE', 'ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')
}

export function visitWriteError(error: unknown) {
  if (error instanceof ApiError && error.code === 'VISIT_OFFLINE') return error.message
  if (isVisitConnectionError(error)) {
    return "We couldn't confirm the save because the connection was interrupted. Your entries are still here. Check the visit after reconnecting before retrying."
  }
  return error instanceof Error ? error.message : 'Could not save. Your entries are still here. Try again.'
}
