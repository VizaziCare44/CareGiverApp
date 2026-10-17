import { CONTACT } from '@/lib/contact'

/**
 * The address row (DECIDED, founder, 2026-10-16; FD-VISIT §6.6(m); frames VER-11
 * and VER-11b): the address as an underlined mail link on its own row, at least
 * 44px high and the full width of its container, with the full stop after it.
 * The underline, not the colour, marks it as a link. Built once: My Assignments
 * (DEV-047) uses it under the helper sentence, FD-VISIT (DEV-063) uses it as
 * built, and DEV-064 reuses it at the width of its notice. The full stop is inside
 * the tap target but is not read out or underlined.
 */
export function ContactAddressRow() {
  return (
    <a
      href={`mailto:${CONTACT.email}`}
      className="flex min-h-11 w-full items-center text-[14px] leading-[1.4] text-figma-softtext focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary"
    >
      <span className="underline">{CONTACT.email}</span>
      <span aria-hidden="true">.</span>
    </a>
  )
}

/**
 * "If a booking you expected is missing, contact Vizazi Care at" and the address
 * row below it, shown under the list and under the empty message (FD-VERIFY
 * §6.6(n)(i), (ii)). "Vizazi Care" here means the Admin, reached at that address.
 * The sentence ends "…at" and the full stop follows the address, on its own row.
 */
export function MissingBookingHelp() {
  return (
    <div className="flex flex-col">
      <p className="text-[14px] leading-[1.4] text-figma-muted">If a booking you expected is missing, contact Vizazi Care at</p>
      <ContactAddressRow />
    </div>
  )
}
