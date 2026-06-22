import { Link } from '@tanstack/react-router'
import { useToastStore } from '@/shared/stores/toast'

/**
 * App-shell toast stack (bottom-right). Confirms the result of the admin's own
 * action and offers a deep link to where it landed — distinct from the bell,
 * which is reserved for inbound activity from other users.
 */
export function Toaster() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-[340px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-3 border border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] leading-snug text-ink">{t.message}</p>
            {t.action && (
              <Link
                to={t.action.to as never}
                params={t.action.params as never}
                onClick={() => dismiss(t.id)}
                className="inline-block mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-orange hover:underline underline-offset-2"
              >
                {t.action.label} →
              </Link>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="font-mono text-[15px] leading-none text-ink-soft hover:text-ink"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
