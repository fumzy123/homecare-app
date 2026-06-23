import { useMemo, useState } from 'react'
import { getDateRange, getDateRangeLabel, type Period } from '@/features/shifts/utils/period'

export type PeriodMode = Period | 'custom'

const PERIOD_PHRASE: Record<Period, string> = {
  this_week:  'this week',
  this_month: 'this month',
  last_90:    'last 90 days',
  this_year:  'this year',
  all_time:   'all time',
}

/** Shared period state for the client tabs: the preset/custom toggle plus the
 *  resolved { from, to } range and display labels. */
export function usePeriodRange(initial: PeriodMode = 'this_month') {
  const [mode, setMode] = useState<PeriodMode>(initial)
  const preset = getDateRange('this_month')
  const [customFrom, setCustomFrom] = useState(preset.from)
  const [customTo, setCustomTo] = useState(preset.to)

  const resolved = useMemo(() => {
    if (mode === 'custom') {
      return { from: customFrom, to: customTo, rangeLabel: `${customFrom} → ${customTo}`, periodLabel: 'selected range' }
    }
    return { ...getDateRange(mode), rangeLabel: getDateRangeLabel(mode), periodLabel: PERIOD_PHRASE[mode] }
  }, [mode, customFrom, customTo])

  return { mode, setMode, customFrom, setCustomFrom, customTo, setCustomTo, ...resolved }
}

export type PeriodRange = ReturnType<typeof usePeriodRange>
