import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'

export interface AddressSuggestion {
  label: string
  street: string
  city: string
  province: string
  postal_code: string
}

export function useAddressSuggestions(text: string, enabled: boolean) {
  const search = text.trim()
  const [debounced, setDebounced] = useState({ text: search, enabled, ready: false })
  // Reset on input change before rendering old results (also covers returning
  // to the previous text before its replacement has finished debouncing).
  if (debounced.text !== search || debounced.enabled !== enabled) {
    setDebounced({ text: search, enabled, ready: false })
  }
  useEffect(() => {
    if (!enabled || search.length < 3) return
    const timer = setTimeout(() => setDebounced({ text: search, enabled, ready: true }), 350)
    return () => clearTimeout(timer)
  }, [search, enabled])
  const ready = enabled && search.length >= 3 && search === debounced.text && debounced.ready
  const query = useQuery({
    queryKey: ['address-suggestions', ready ? search : ''],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.post<{ suggestions: AddressSuggestion[] }>(
        '/api/addresses/autocomplete', { text: search }, { signal },
      )
      return data.suggestions
    },
    enabled: ready,
    retry: false,
    networkMode: 'always',
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  return {
    suggestions: ready ? query.data ?? [] : [],
    loading: enabled && search.length >= 3 && (!ready || query.isFetching),
    failed: ready && query.isError,
    empty: ready && query.isSuccess && query.data.length === 0,
  }
}
