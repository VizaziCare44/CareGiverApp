'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadExceptionsAction } from '@/app/admin/exceptions/actions'
import { ActionButton, ActionLink } from '@/components/ui/action-button'
import { CircleAlertIcon } from '@/components/admin/circle-alert-icon'
import { StatusChip } from '@/components/ui/status-chip'
import { BUNDLE_LINES } from '@/lib/bookings/bundles'
import { formatDateTime } from '@/lib/datetime'
import { exceptionLines, type ExceptionRow } from '@/lib/admin/exceptions'
import { EXCEPTIONS_TEXT } from '@/lib/admin/exceptions-text'

// The Exceptions list and its states (DEV-080; FD-ADMINEXC §7, frames EXC-01 to EXC-04b).
//   loading   "Loading exceptions…" with three grey placeholder rows; the load line reads "Loading…" and
//             Refresh is disabled
//   empty     the heading and the sentence; the load line and Refresh stay
//   error     one panel replaces the list; the load line reads "Not loaded", Refresh is hidden, "Try again"
//             repeats only this read. If a Refresh fails while rows are on screen, the same panel appears above
//             the old rows, which keep their earlier "Loaded" time
//   refreshing "Refreshing…", disabled; the rows stay until the new ones arrive
// The list is a table from 1024 wide and cards below that (D6); every text is 16px or more (D1), the cells and
// the header included. Reasons are plain text with line breaks kept, wrapping inside their cell or card (D8).
// No polling and no phone numbers (R-08, R-09).

const body = 'text-[16px] leading-[1.4]'
const words = 'whitespace-pre-wrap [overflow-wrap:anywhere]'
// the frames (EXC-01 to EXC-04b) draw the details, the bundle line and the labels in the muted colour; the size stays 16
const muted = 'text-figma-muted'

function Blocks({ row }: { row: ExceptionRow }) {
  return (
    <ul className="flex flex-col gap-4">
      {exceptionLines(row).map((line) => (
        <li key={line.kind} data-testid={'exception-' + line.kind} className="flex flex-col items-start gap-1.5">
          <StatusChip status="exception" label={line.label} icon={line.icon} size="report" />
          {line.detail && <p className={body + ' ' + words + ' ' + muted}>{line.detail}</p>}
          {line.tasks.map((task, index) => (
            <div key={task.name + '-' + index} className={body + ' ' + words}>
              <p className="font-semibold">{task.name}</p>
              <p className={muted} data-testid="exception-reason">Reason: {task.reason}</p>
            </div>
          ))}
        </li>
      ))}
    </ul>
  )
}

function OpenBooking({ row, className }: { row: ExceptionRow; className: string }) {
  return (
    <ActionLink
      href={'/admin/bookings/' + row.booking_id}
      variant="secondary"
      size="compact"
      className={'min-w-[44px] whitespace-nowrap ' + className}
      aria-label={EXCEPTIONS_TEXT.openBooking + ': ' + row.recipient_name + ', ' + formatDateTime(row.requested_datetime)}
    >
      {EXCEPTIONS_TEXT.openBooking}
    </ActionLink>
  )
}

// EXC-01: from 1024 wide a table in a white box with a 12px radius; the header row 44 high on the surface grey, the
// columns 240, 220, 160, the exceptions and 140 (plus 16 padding each side), the rows 16 inside with a line between.
function Table({ rows }: { rows: ExceptionRow[] }) {
  const head = 'px-4 text-left align-middle text-[16px] font-semibold leading-[1.4] ' + muted + ' ' + words
  return (
    <div className="hidden overflow-hidden rounded-[12px] border border-figma-border bg-white lg:block" data-testid="exceptions-table">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-figma-surface">
          <tr className="h-11">
            <th scope="col" className={head + ' w-[28%]'}>{EXCEPTIONS_TEXT.columns.visit}</th>
            <th scope="col" className={head + ' w-[20%]'}>{EXCEPTIONS_TEXT.columns.recipient}</th>
            <th scope="col" className={head + ' w-[15%]'}>{EXCEPTIONS_TEXT.columns.caregiver}</th>
            <th scope="col" className={head}>{EXCEPTIONS_TEXT.columns.exceptions}</th>
            <th scope="col" className={head + ' w-[14%]'}>{EXCEPTIONS_TEXT.columns.action}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.booking_id} data-testid="exception-row" className="border-t border-figma-line align-top">
              <td className={'p-4 ' + body}>{formatDateTime(row.requested_datetime)}</td>
              <td className={'p-4 ' + body + ' ' + words}>
                <p className="font-semibold">{row.recipient_name}</p>
                <p className={muted}>{BUNDLE_LINES[row.bundle_code]}</p>
              </td>
              <td className={'p-4 ' + body + ' ' + words}>{row.caregiver_name ?? '—'}</td>
              <td className="p-4"><Blocks row={row} /></td>
              <td className="p-4"><OpenBooking row={row} className="w-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// EXC-01b, 01c, 01d: under 1024 a card for each, the date in bold, the recipient and the bundle line, the caregiver;
// from 768 the exceptions beside them, under 768 under them after a line, and Open booking last.
function Cards({ rows }: { rows: ExceptionRow[] }) {
  return (
    <ul className="flex flex-col gap-4 lg:hidden" data-testid="exceptions-cards">
      {rows.map((row) => (
        <li key={row.booking_id} data-testid="exception-card" className="grid gap-4 rounded-[12px] border border-figma-border bg-white p-4 md:grid-cols-2">
          <div className={'flex flex-col gap-0.5 border-b border-figma-line pb-4 md:border-b-0 md:pb-0 ' + body + ' ' + words}>
            <p className="font-semibold">{formatDateTime(row.requested_datetime)}</p>
            <p>{row.recipient_name}</p>
            <p className={muted}>{BUNDLE_LINES[row.bundle_code]}</p>
            <p className={muted}>Caregiver: {row.caregiver_name ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-4">
            <Blocks row={row} />
            <OpenBooking row={row} className="w-full max-md:h-12 md:ml-auto md:w-auto md:px-6" />
          </div>
        </li>
      ))}
    </ul>
  )
}

// EXC-03: inside the white box the words, then three placeholders, each a long grey bar and a short one under it
function Placeholders() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex animate-pulse flex-col gap-1.5">
          <div className="h-3 rounded-full bg-figma-line" />
          <div className="h-3 w-40 rounded-full bg-figma-line" />
        </div>
      ))}
    </div>
  )
}

export function ExceptionsScreen() {
  const [rows, setRows] = useState<ExceptionRow[]>([])
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    let result: Awaited<ReturnType<typeof loadExceptionsAction>>
    try {
      result = await loadExceptionsAction()
    } catch {
      result = { ok: false }
    }
    if (result.ok) {
      setRows(result.rows)
      // the server's time, from the response's Date header; the device clock only for this label if it is missing
      const server = result.loadedAt && !Number.isNaN(Date.parse(result.loadedAt)) ? new Date(result.loadedAt) : new Date()
      setLoadedAt(server.toISOString())
      setFailed(false)
    } else {
      setFailed(true)
    }
    setBusy(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loading = busy && loadedAt === null && !failed
  const neverLoaded = loadedAt === null
  const showPanel = failed && !busy

  let loadLine: string = EXCEPTIONS_TEXT.loading
  if (!loading) loadLine = neverLoaded ? EXCEPTIONS_TEXT.notLoaded : EXCEPTIONS_TEXT.loaded(formatDateTime(loadedAt!))

  const box = 'flex flex-col gap-3 rounded-[12px] border border-figma-border bg-white p-5'

  return (
    <section aria-label="Exceptions list" className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <p className={body + ' ' + muted} data-testid="loaded-line" aria-live="polite">
          {loadLine}
        </p>
        {!(failed && neverLoaded) && (
          <ActionButton variant="secondary" size="compact" className="min-w-[120px]" onClick={() => void load()} disabled={busy}>
            {busy && !loading ? EXCEPTIONS_TEXT.refreshing : EXCEPTIONS_TEXT.refresh}
          </ActionButton>
        )}
      </div>

      {showPanel && (
        <div role="alert" className={box + ' items-start'} data-testid="exceptions-error">
          <p className={'flex items-start gap-2 ' + body}>
            <CircleAlertIcon />
            {EXCEPTIONS_TEXT.error}
          </p>
          <ActionButton size="compact" onClick={() => void load()} disabled={busy}>
            {EXCEPTIONS_TEXT.tryAgain}
          </ActionButton>
        </div>
      )}
      {failed && busy && (
        <div role="status" className={box + ' items-start'}>
          <p className={'flex items-start gap-2 ' + body}>
            <CircleAlertIcon />
            {EXCEPTIONS_TEXT.error}
          </p>
          <ActionButton size="compact" disabled>{EXCEPTIONS_TEXT.tryingAgain}</ActionButton>
        </div>
      )}

      {loading && (
        <div className={box}>
          <p className={body}>{EXCEPTIONS_TEXT.loadingList}</p>
          <Placeholders />
        </div>
      )}

      {!loading && !neverLoaded && rows.length === 0 && (
        <div className="flex flex-col gap-1 rounded-[12px] border border-figma-border bg-white p-5" data-testid="exceptions-empty">
          <h2 className="text-[20px] font-semibold leading-[1.4]">{EXCEPTIONS_TEXT.emptyHeading}</h2>
          <p className={body + ' ' + muted}>{EXCEPTIONS_TEXT.emptyBody}</p>
        </div>
      )}

      {!loading && !neverLoaded && rows.length > 0 && (
        <>
          <Table rows={rows} />
          <Cards rows={rows} />
        </>
      )}
    </section>
  )
}
