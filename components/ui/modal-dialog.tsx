'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal dialog on the native <dialog> element, so focus is trapped inside it,
 * Escape closes it, and the page behind is inert, with no extra code. Escape is
 * ignored while `locked` (a request is running) so a half-sent action cannot be
 * dismissed. Clicking the backdrop does not close it.
 *
 * `size="compact"` is the small confirmation of ACC-11 (Leave without finishing):
 * 16px radius, 20px padding, 12px between its parts, the page dimmed with the ink
 * colour at 55%.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  locked = false,
  size = 'default',
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  locked?: boolean
  size?: 'default' | 'compact'
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const compact = size === 'compact'

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) onClose()
      }}
      className={
        compact
          ? 'm-auto w-[calc(100%-64px)] max-w-[326px] rounded-2xl border-0 bg-white p-0 text-figma-ink shadow-modal backdrop:bg-[rgba(31,41,51,0.55)]'
          : 'm-auto w-[calc(100%-32px)] max-w-lg rounded-xl border border-figma-line bg-white p-0 text-figma-ink shadow-modal backdrop:bg-black/40'
      }
    >
      <div className={compact ? 'flex flex-col gap-3 p-5' : 'flex flex-col gap-5 p-6'}>{children}</div>
    </dialog>
  )
}
