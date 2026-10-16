'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal dialog on the native <dialog> element, so focus is trapped inside it,
 * Escape closes it, and the page behind is inert, with no extra code. Escape is
 * ignored while `locked` (a request is running) so a half-sent action cannot be
 * dismissed. Clicking the backdrop does not close it.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  locked = false,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  locked?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) onClose()
      }}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-xl border border-figma-line bg-white p-0 text-figma-ink shadow-modal backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-5 p-6">{children}</div>
    </dialog>
  )
}
