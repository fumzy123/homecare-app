import { useBlocker } from '@tanstack/react-router'

/** Protect record edits when navigating through the tower or sidebar. */
export function useUnsavedChanges(dirty: boolean) {
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: dirty,
    shouldBlockFn: () => !window.confirm('You have unsaved changes. Leave this page and discard them?'),
  })
}
