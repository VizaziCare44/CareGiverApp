import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { AREAS, AUTH_PREFIX, PUBLIC_PATHS, areaFor, homeFor, type Role } from '../../lib/route-guard'
import { createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-049: route guarding for the new screens (extends DEV-012). Every Admin,
// Family Member and Caregiver route is reachable only by the matching role; each
// role lands in its own area after Log In and is sent back to it from anyone
// else's; a signed-out visitor goes to Log In; look-alike paths belong to no one.

const ID = '00000000-0000-4000-8000-000000000000'

// every screen of every area, as the browser would ask for it (dynamic segments filled in)
const ROUTES: Record<Role, string[]> = {
  admin: [
    '/admin/queue',
    '/admin/queue?tab=assigned',
    '/admin/caregivers',
    `/admin/caregivers/${ID}`,
    `/admin/bookings/${ID}`,
    `/admin/bookings/${ID}/choose-caregiver`,
  ],
  family_member: [
    '/recipients',
    '/recipients/new',
    '/book/who',
    '/book/bundle',
    '/book/datetime',
    '/book/review',
    '/book/confirmation',
    '/bookings',
    `/bookings/${ID}`,
  ],
  caregiver: ['/assignments', `/assignments/${ID}`],
}
const ROLES = Object.keys(ROUTES) as Role[]
const LOOK_ALIKES = ['/administrator', '/adminx/queue', '/bookings-old', '/bookx', '/recipientsx', '/assignmentsx', '/assignments-old']

const pathOf = (page: Page) => new URL(page.url()).pathname

async function signIn(page: Page, role: Role, label: string) {
  const user = await createUserWithRole(role, `${label} ${Date.now()}`)
  await logInViaUI(page, user.email, undefined, `**${homeFor(role)}`)
  return user
}

test.describe('DEV-049 — route guarding', () => {
  test('every screen in app/ has an owner: public, auth, or exactly one role (so a new screen cannot be left open)', () => {
    const root = path.join(__dirname, '..', '..', 'app')
    const routes: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name))
        else if (/^(page|route)\.(tsx|ts)$/.test(entry.name)) {
          const segments = path
            .relative(root, dir)
            .split(path.sep)
            .filter((segment) => segment && !/^\(.*\)$/.test(segment))
            .map((segment) => (segment.startsWith('[') ? 'x' : segment))
          routes.push('/' + segments.join('/'))
        }
      }
    }
    walk(root)
    expect(routes.length).toBeGreaterThan(15)

    // /reset-password is reached through the session a reset link creates: no role owns it
    const open = new Set(['/', '/reset-password', ...PUBLIC_PATHS])
    const unowned = routes.filter((route) => !open.has(route) && !route.startsWith(AUTH_PREFIX) && !areaFor(route))
    expect(unowned, `screens with no owner in lib/route-guard.ts: ${unowned.join(', ')}`).toEqual([])

    // and every route the matrix below tries is a real screen
    for (const role of ROLES) for (const route of ROUTES[role]) expect(areaFor(route.split('?')[0])?.role).toBe(role)
    // the areas do not overlap
    const owners = new Map<string, Role>()
    for (const area of AREAS) for (const prefix of area.prefixes) {
      expect(owners.has(prefix)).toBe(false)
      owners.set(prefix, area.role)
    }
  })

  for (const role of ROLES) {
    test(`${role}: lands in their own area after Log In, opens all of it, and is sent home from every other role's screens`, async ({ page }) => {
      await signIn(page, role, `Guard ${role}`)
      const home = homeFor(role)!
      expect(pathOf(page)).toBe(home)

      // their own screens: never bounced to another area or to Log In
      for (const route of ROUTES[role]) {
        await page.goto(route)
        expect(areaFor(pathOf(page))?.role, `${role} opening ${route} ended on ${pathOf(page)}`).toBe(role)
      }

      // every other role's screens send them home
      for (const other of ROLES.filter((r) => r !== role)) {
        for (const route of ROUTES[other]) {
          await page.goto(route)
          expect(pathOf(page), `${role} opening ${route}`).toBe(home)
        }
      }

      // the public pages and the front door send a signed-in user home, not into a loop
      for (const route of [...PUBLIC_PATHS, '/']) {
        await page.goto(route)
        expect(pathOf(page), `${role} opening ${route}`).toBe(home)
      }
    })
  }

  test('a signed-out visitor goes to Log In from every screen, and still sees the public pages', async ({ page }) => {
    for (const role of ROLES) {
      for (const route of ROUTES[role]) {
        await page.goto(route)
        expect(pathOf(page), `signed out opening ${route}`).toBe('/log-in')
      }
    }
    for (const route of [...PUBLIC_PATHS, '/']) {
      await page.goto(route)
      expect(pathOf(page), `signed out opening ${route}`).toBe(route)
    }
  })

  test('look-alike paths belong to no role: a plain 404 for a signed-in user, Log In when signed out', async ({ page }) => {
    for (const route of LOOK_ALIKES) {
      expect(areaFor(route), route).toBeNull()
      await page.goto(route)
      expect(pathOf(page), `signed out opening ${route}`).toBe('/log-in')
    }
    await signIn(page, 'family_member', 'Guard lookalike')
    for (const route of LOOK_ALIKES) {
      const response = await page.goto(route)
      expect(response!.status(), `signed in opening ${route}`).toBe(404)
      expect(pathOf(page)).toBe(route)
    }
    // and the neighbouring real screens are still the family's own
    for (const route of ['/book/who', '/bookings']) {
      await page.goto(route)
      expect(areaFor(pathOf(page))?.role).toBe('family_member')
    }
  })

  test('a signed-in user with no profile row is not sent round in a circle: public pages open, everything else goes to Log In', async ({ page }) => {
    const user = await createUserWithRole('family_member', `Guard orphan ${Date.now()}`)
    const removed = await serviceClient().from('profiles').delete().eq('id', user.userId)
    expect(removed.error).toBeNull()

    await page.goto('/log-in')
    await page.getByLabel('Email address').fill(user.email)
    await page.getByLabel('Password').fill('Sup3rSecret!')
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForTimeout(2500)
    expect(pathOf(page)).toBe('/log-in')

    for (const route of ['/recipients', '/admin/queue', '/assignments']) {
      await page.goto(route)
      expect(pathOf(page), `no role opening ${route}`).toBe('/log-in')
    }
    await page.goto('/sign-up')
    expect(pathOf(page)).toBe('/sign-up')
  })
})
