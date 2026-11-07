import { useBlocker } from '@tanstack/react-router'
import { useConfirmation, type ConfirmationOptions } from '@/shared/components/confirmation'

/** Protect record edits when navigating through the tower or sidebar. */
export function useUnsavedChanges(dirty: boolean, options?: ConfirmationOptions, busy = false) {
  const confirm = useConfirmation()
  useBlocker({
    disabled: !dirty && !busy,
    enableBeforeUnload: dirty || busy,
    shouldBlockFn: async () => busy || !(await confirm(options ?? {
      title: 'Discard changes and leave?',
      description: 'You have unsaved changes. Leaving will discard this draft.',
      cancelLabel: 'Keep editing',
      confirmLabel: 'Discard and leave',
    })),
  })
}
