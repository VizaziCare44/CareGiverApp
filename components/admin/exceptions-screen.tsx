'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadExceptionsAction } from '@/app/admin/exceptions/actions'
import { ActionButton, ActionLink } from '@/components/ui/action-button'
import { StatusChip } from '@/components/ui/status-chip'
import { BUNDLES } from '@/lib/bookings/bundles'
import { formatDateTime, formatTime } from '@/lib/datetime'
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

function Blocks({ row }: { row: ExceptionRow }) {
  return (
    <ul className="flex flex-col gap-3">
      {exceptionLines(row).map((line) => (
        <li key={line.kind} data-testid={`exception-${line.kind}`} className="flex flex-col items-start gap-1">
          <StatusChip status="exception" label={line.label} icon={line.icon} size="report" />
          {line.detail && <p className={`${body} ${words}`}>{line.detail}</p>}
          {line.tasks.map((task, index) => (
            <div key={`${task.name}-${index}`} className={`${body} ${words}`}>
              <p className="font-semibold">{task.name}</p>
              <p data-testid="exception-reason">Reason: {task.reason}</p>
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
      href={`/admin/bookings/${row.booking_id}`}
      variant="secondary"
      className={`min-w-[44px] ${className}`}
      aria-label={`${EXCEPTIONS_TEXT.openBooking}: ${row.recipient_name}, ${formatDateTime(row.requested_datetime)}`}
    >
      {EXCEPTIONS_TEXT.openBooking}
    </ActionLink>
  )
}

function Table({ rows }: { rows: ExceptionRow[] }) {
  const head = `px-4 py-3 text-left text-[16px] font-semibold ${words}`
  return (
    <div className="hidden lg:block" data-testid="exceptions-table">
      <table className="w-full table-fixed border-collapse rounded-xl border border-figma-line bg-white">
        <thead className="bg-figma-surface">
          <tr>
            <th scope="col" className={head}>{EXCEPTIONS_TEXT.columns.visit}</th>
            <th scope="col" className={head}>{EXCEPTIONS_TEXT.columns.recipient}</th>
            <th scope="col" className={head}>{EXCEPTIONS_TEXT.columns.caregiver}</th>
            <th scope="col" className={`${head} w-[34%]`}>{EXCEPTIONS_TEXT.columns.exceptions}</th>
            <th scope="col" className={`${head} w-[14%]`}>{EXCEPTIONS_TEXT.columns.action}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.booking_id} data-testid="exception-row" className="border-t border-figma-line align-top">
              <td className={`px-4 py-4 ${body}`}>{formatDateTime(row.requested_datetime)}</td>
              <td className={`px-4 py-4 ${body} ${words}`}>
                <p className="font-semibold">{row.recipient_name}</p>
                <p>{BUNDLES[row.bundle_code].name}</p>
              </td>
              <td className={`px-4 py-4 ${body} ${words}`}>{row.caregiver_name ?? '—'}</td>
              <td className="px-4 py-4"><Blocks row={row} /></td>
              <td className="px-4 py-4"><OpenBooking row={row} className="w-full" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cards({ rows }: { rows: ExceptionRow[] }) {
  return (
    <ul className="flex flex-col gap-4 lg:hidden" data-testid="exceptions-cards">
      {rows.map((row) => (
        <li key={row.booking_id} data-testid="exception-card" className="grid gap-4 rounded-xl border border-figma-line bg-white p-5 md:grid-cols-2">
          <div className={`flex flex-col gap-2 ${body} ${words}`}>
            <p className="font-semibold">{formatDateTime(row.requested_datetime)}</p>
            <p>
              <span className="font-semibold">{row.recipient_name}</span>
              <br />
              {BUNDLES[row.bundle_code].name}
            </p>
            <p>{row.caregiver_name ?? '—'}</p>
          </div>
          <div className="flex flex-col gap-4">
            <Blocks row={row} />
            <OpenBooking row={row} className="w-full md:ml-auto md:w-auto" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Placeholders() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-figma-line" />
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
  if (!loading) loadLine = neverLoaded ? EXCEPTIONS_TEXT.notLoaded : EXCEPTIONS_TEXT.loaded(formatTime(loadedAt!))

  return (
    <section aria-label="Exceptions list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <p className={body} data-testid="loaded-line" aria-live="polite">
          {loadLine}
        </p>
        {!(failed && neverLoaded) && (
          <ActionButton variant="secondary" onClick={() => void load()} disabled={busy}>
            {busy && !loading ? EXCEPTIONS_TEXT.refreshing : EXCEPTIONS_TEXT.refresh}
          </ActionButton>
        )}
      </div>

      {showPanel && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-figma-border bg-figma-surface p-5" data-testid="exceptions-error">
          <p className={body}>{EXCEPTIONS_TEXT.error}</p>
          <ActionButton onClick={() => void load()} disabled={busy}>
            {EXCEPTIONS_TEXT.tryAgain}
          </ActionButton>
        </div>
      )}
      {failed && busy && (
        <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-figma-border bg-figma-surface p-5">
          <p className={body}>{EXCEPTIONS_TEXT.error}</p>
          <ActionButton disabled>{EXCEPTIONS_TEXT.tryingAgain}</ActionButton>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          <p className={`${body} font-semibold`}>{EXCEPTIONS_TEXT.loadingList}</p>
          <Placeholders />
        </div>
      )}

      {!loading && !neverLoaded && rows.length === 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-figma-line bg-white p-5" data-testid="exceptions-empty">
          <h2 className="text-[20px] font-semibold leading-[1.3]">{EXCEPTIONS_TEXT.emptyHeading}</h2>
          <p className={body}>{EXCEPTIONS_TEXT.emptyBody}</p>
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
