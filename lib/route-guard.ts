// Route guarding (FD-ACC §7.4 / DEV-012, extended by FD-VERIFY DEV-049): which
// role may open which part of the app, in one place. middleware.ts applies it and
// tests/e2e/route-guarding.spec.ts checks that every screen in app/ is covered, so
// a new screen cannot be added without deciding who may open it. A convenience
// for fast redirects: row-level security in Postgres is the real boundary.

export type Role = 'admin' | 'family_member' | 'caregiver'

/** Reachable by anyone; a signed-in user is sent to their own area instead. */
export const PUBLIC_PATHS = ['/sign-up', '/log-in', '/forgot-password']

/**
 * Reachable by anyone, signed in or not: /auth/confirm is what establishes a
 * session, and /auth/auth-code-error explains a bad link. (/reset-password needs
 * the session that link creates, and its page deals with the rest.)
 */
export const AUTH_PREFIX = '/auth/'

/**
 * Each role's own area. A path belongs to an area when it is the prefix or sits
 * under it ("/book" owns "/book/bundle" but not "/bookings", which is listed on its
 * own), so a look-alike such as "/administrator" belongs to no one and is a plain 404.
 */
export const AREAS: { role: Role; home: string; prefixes: string[] }[] = [
  { role: 'admin', home: '/admin/queue', prefixes: ['/admin'] },
  { role: 'family_member', home: '/recipients', prefixes: ['/recipients', '/book', '/bookings'] },
  { role: 'caregiver', home: '/assignments', prefixes: ['/assignments'] },
]

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`)

/** The area a path belongs to, or null when it belongs to none. */
export function areaFor(pathname: string) {
  return AREAS.find((area) => area.prefixes.some((prefix) => within(pathname, prefix))) ?? null
}

/** Where a signed-in user of this role lands, and is sent back to; null for a role the app does not know. */
export function homeFor(role: string | null | undefined) {
  return AREAS.find((area) => area.role === role)?.home ?? null
}

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.includes(pathname)
