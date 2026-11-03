export const SIGN_IN_TIMEOUT_MS = 20_000;

/** Bound password exchange before Supabase can persist its result. A UI-only
 * timeout would still allow a late response to sign the user in after retry. */
export function createAuthFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.pathname.endsWith('/auth/v1/token') || url.searchParams.get('grant_type') !== 'password') {
      return fetcher(input, init);
    }

    const controller = new AbortController();
    const upstream = init?.signal ?? (typeof input === 'object' && 'signal' in input ? input.signal : null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const stopped = new Promise<never>((_, reject) => {
      cancel = () => {
        reject(new Error('Sign-in was cancelled. Please try again.'));
        controller.abort();
      };
      timer = setTimeout(() => {
        reject(new Error('Sign-in timed out. Check your connection and try again.'));
        controller.abort();
      }, SIGN_IN_TIMEOUT_MS);
      if (upstream?.aborted) cancel();
      else upstream?.addEventListener('abort', cancel, { once: true });
    });

    try {
      return await Promise.race([
        stopped,
        (async () => {
          if (controller.signal.aborted) throw new Error('Sign-in was cancelled. Please try again.');
          const response = await fetcher(input, { ...init, signal: controller.signal });
          // Include a stalled response body in the deadline, not just headers.
          const body = await response.text();
          return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
        })(),
      ]);
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', cancel);
    }
  };
}
