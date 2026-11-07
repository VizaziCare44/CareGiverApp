'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingDraft } from '@/lib/bookings/draft-context'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { formatDate, formatDateTime, monthGrid, nairobiToday, slotToInstant, ZONE_LABEL } from '@/lib/datetime'
import { ActionButton } from '@/components/ui/action-button'
import { BookingScreen } from './booking-screen'

// FR-005, frames ACC-08 (MediCheck) and ACC-08b (Doctor's Day Out). A month calendar (Monday first, the
// earliest day is today in Nairobi, earlier days are greyed and cannot be chosen), then the start times
// 08:00 to 16:00 on the hour, then the chosen moment written out in Nairobi time and the note that choosing
// does not reserve it. Copy deliberately avoids "reserved"/"held" language — no slot-locking exists
// (FD-ACC §7.7), so a selection here is not a guarantee.
export const START_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`
const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) })
const monthIndex = (m: { year: number; month: number }) => m.year * 12 + (m.month - 1)
const fromIndex = (index: number) => ({ year: Math.floor(index / 12), month: (index % 12) + 1 })

const icon = (path: string, size: number) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

export function DateTimeSelect() {
  const router = useRouter()
  const draft = useBookingDraft()
  const today = nairobiToday()
  const [date, setDate] = useState(draft.date ?? '')
  const [time, setTime] = useState(draft.time ?? '')
  const [shown, setShown] = useState(() => monthOf(draft.date ?? today))

  useEffect(() => {
    if (!draft.bundleCode) router.replace('/book/bundle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.bundleCode])

  if (!draft.bundleCode) return null
  const bundleCode = draft.bundleCode

  const earliest = monthOf(today)
  const canGoBack = monthIndex(shown) > monthIndex(earliest)
  const grid = monthGrid(shown.year, shown.month) // Monday first
  const cells: (number | null)[] = [...Array(grid.leading).fill(null), ...Array.from({ length: grid.days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  let selectedText = ''
  if (date && time) {
    try {
      selectedText = formatDateTime(slotToInstant(date, time))
    } catch {
      selectedText = ''
    }
  }

  function handleContinue() {
    if (!date || !time) return
    try {
      slotToInstant(date, time) // a value the review step can show and store
    } catch {
      return
    }
    draft.setDateTime(date, time)
    router.push('/book/review')
  }

  return (
    <BookingScreen heading="Choose the date and time of the visit">
      <p className="text-[16px] font-semibold leading-[1.4]" data-testid="datetime-bundle">
        {BUNDLE_LINES[bundleCode]}
      </p>
      <p className="text-[14px] leading-[1.4] text-figma-muted">Each booking covers one visit. To book another day, make another booking afterwards.</p>
      <p className="text-[14px] leading-[1.4] text-figma-muted">Times are Nairobi time ({ZONE_LABEL}), where the visit takes place.</p>
      {bundleCode === 'doctors_day_out' && <p className="text-[14px] leading-[1.4] text-figma-muted">Choose a start time that suits the appointment.</p>}

      <div className="flex flex-col gap-0.5 rounded-[14px] border border-figma-border bg-white p-3" data-testid="date-picker">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => setShown(fromIndex(monthIndex(shown) - 1))}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-figma-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary disabled:text-figma-line"
          >
            {icon('M14 6l-6 6 6 6', 22)}
          </button>
          <p className="min-w-0 flex-1 text-center text-[16px] font-semibold leading-[1.4]" aria-live="polite" data-testid="month-label">
            {grid.label}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setShown(fromIndex(monthIndex(shown) + 1))}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-figma-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
          >
            {icon('M10 6l6 6-6 6', 22)}
          </button>
        </div>
        <div className="grid grid-cols-7" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day} className="flex h-7 items-center justify-center text-[13px] font-medium leading-[1.4] text-figma-muted">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            if (day === null) return <span key={`blank-${index}`} className="h-11" />
            const value = isoDate(shown.year, shown.month, day)
            const past = value < today
            const selected = value === date
            return (
              <button
                key={value}
                type="button"
                data-date={value}
                aria-label={formatDate(slotToInstant(value, '12:00'))}
                aria-pressed={selected}
                disabled={past}
                onClick={() => setDate(value)}
                className="flex h-11 items-center justify-center focus-visible:outline-none"
              >
                <span
                  className={[
                    'flex size-10 items-center justify-center rounded-full text-[16px] leading-[1.4]',
                    selected ? 'bg-figma-primary font-semibold text-white' : past ? 'text-figma-muted' : 'font-medium text-figma-ink',
                  ].join(' ')}
                >
                  {day}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[14px] font-semibold leading-[1.4]" id="start-time-label">
        Start time
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="start-time-label">
        {START_TIMES.map((slot) => {
          const selected = slot === time
          return (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={selected}
              data-time={slot}
              onClick={() => setTime(slot)}
              className={[
                'flex h-11 items-center justify-center gap-1.5 rounded-[10px] border text-[16px] font-semibold leading-[1.4]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
                selected ? 'border-figma-primary bg-figma-primary text-white' : 'border-figma-border bg-white text-figma-ink',
              ].join(' ')}
            >
              {selected && icon('M5 12.5l4.5 4.5L19 7.5', 16)}
              {slot}
            </button>
          )
        })}
      </div>

      {selectedText && (
        <p className="text-[16px] font-semibold leading-[1.4]" data-testid="selected-slot">
          Selected: {selectedText}
        </p>
      )}

      <div className="flex items-start gap-2 rounded-[10px] bg-figma-surface p-3">
        <svg aria-hidden="true" className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 11v6M12 7.2v.1" />
        </svg>
        <p className="min-w-0 flex-1 text-[14px] leading-[1.4]">Choosing a time does not reserve it. Your request is confirmed once Vizazi Care assigns a caregiver.</p>
      </div>

      <ActionButton disabled={!date || !time} onClick={handleContinue} className="w-full">
        Continue
      </ActionButton>
    </BookingScreen>
  )
}
