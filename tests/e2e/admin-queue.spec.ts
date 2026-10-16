import { test, expect } from '@playwright/test'
import { apiAddRecipient, createUserWithRole, logInViaUI, serviceClient } from './helpers'

// DEV-040: the Admin Booking Queue extended with an Assigned tab, an "Assign
// caregiver" action and a requested-at line (frames VER-05, 05b).

test.describe('DEV-040 — Admin booking queue', () => {
  test('Requested and Assigned tabs, the flag, and no accidental taps', async ({ page }, testInfo) => {
    const stamp = Date.now()
    const admin = await createUserWithRole('admin', 'Ada Admin')
    const careA = await createUserWithRole('caregiver', `Queue A ${stamp}`)
    const careB = await createUserWithRole('caregiver', `Queue B ${stamp}`)
    const family = await createUserWithRole('family_member', `Family ${stamp}`)
    for (const caregiver of [careA, careB]) {
      await admin.client.rpc('verify_caregiver', { p_caregiver_id: caregiver.userId, p_note: 'Met in person' })
    }

    const book = async (label: string, visit: string) => {
      const recipientId = await apiAddRecipient(family.client, family.userId, `${label} ${stamp}`)
      const { data } = await family.client
        .from('bookings')
        .insert({ account_id: family.userId, care_recipient_id: recipientId, bundle_code: 'medicheck', requested_datetime: visit })
        .select('id')
        .single()
      return data!.id as string
    }
    await book('Req', '2030-01-15T06:30:00.000Z')
    const assignedId = await book('Asg', '2030-01-16T06:30:00.000Z')
    const flaggedId = await book('Flag', '2030-01-17T06:30:00.000Z')
    const startedId = await book('Started', '2030-01-18T06:30:00.000Z')

    await admin.client.rpc('assign_booking', { p_booking_id: assignedId, p_caregiver_id: careA.userId })
    await admin.client.rpc('assign_booking', { p_booking_id: flaggedId, p_caregiver_id: careB.userId })
    await admin.client.rpc('assign_booking', { p_booking_id: startedId, p_caregiver_id: careB.userId })
    // the visit starts (no function for that exists yet, so the service role does it)
    const started = await serviceClient().from('bookings').update({ status: 'in_progress' }).eq('id', startedId)
    expect(started.error).toBeNull()
    // then caregiver B loses Verified: the not-started booking needs a new caregiver, the started one does not
    await admin.client.rpc('remove_caregiver_verification', { p_caregiver_id: careB.userId, p_note: 'Reference failed' })

    await logInViaUI(page, admin.email, undefined, '**/admin/queue')

    // Requested tab (the default): DEV-022's cards, plus requested-at and the action
    await expect(page.getByRole('link', { name: /^Requested \(\d+\)$/ })).toHaveAttribute('aria-current', 'page')
    const requestedRow = page.getByRole('listitem').filter({ hasText: `Recipient: Req ${stamp}` })
    await expect(requestedRow).toContainText(`Requested by Family ${stamp}`)
    await expect(requestedRow).toContainText('Visit: Tue 15 Jan 2030, 09:30 EAT')
    await expect(requestedRow).toContainText(/Requested at: [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} EAT/)
    // assigned bookings are not in this tab
    await expect(page.getByText(`Recipient: Asg ${stamp}`)).toHaveCount(0)

    // the action is its own button and the way into Booking Detail is its own link; the row itself is
    // neither, so a stray tap on it does nothing
    await expect(requestedRow.getByRole('link')).toHaveCount(1)
    await expect(requestedRow.getByRole('link', { name: 'View details' })).toBeVisible()
    await expect(requestedRow.getByRole('button')).toHaveCount(1)
    const assign = requestedRow.getByRole('button', { name: 'Assign caregiver' })
    await expect(assign).toBeDisabled()
    expect((await assign.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    // Assigned tab
    await page.getByRole('link', { name: /^Assigned \(\d+\)$/ }).click()
    await page.waitForURL('**/admin/queue?tab=assigned')
    await expect(page.getByRole('link', { name: /^Assigned \(\d+\)$/ })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText(`Recipient: Req ${stamp}`)).toHaveCount(0)

    const assignedRow = page.getByRole('listitem').filter({ hasText: `Recipient: Asg ${stamp}` })
    await expect(assignedRow).toContainText(`Caregiver: Queue A ${stamp}`)
    await expect(assignedRow).toContainText('Visit: Wed 16 Jan 2030, 09:30 EAT')
    await expect(assignedRow).toContainText('Assigned')
    await expect(assignedRow.getByText('Caregiver no longer Verified — reassign')).toHaveCount(0)
    await expect(assignedRow.getByRole('button', { name: 'Reassign' })).toBeDisabled()

    // caregiver lost Verified, visit not started: flagged, with the reassign entry
    const flaggedRow = page.getByRole('listitem').filter({ hasText: `Recipient: Flag ${stamp}` })
    await expect(flaggedRow).toContainText(`Caregiver: Queue B ${stamp}`)
    await expect(flaggedRow.getByText('Caregiver no longer Verified — reassign')).toBeVisible()
    await expect(flaggedRow.getByRole('button', { name: 'Reassign' })).toBeDisabled()

    // caregiver lost Verified but the visit has started: no flag and no entry (AC-008)
    const startedRow = page.getByRole('listitem').filter({ hasText: `Recipient: Started ${stamp}` })
    await expect(startedRow).toContainText(`Caregiver: Queue B ${stamp}`)
    await expect(startedRow).toContainText('In progress')
    await expect(startedRow.getByText('Caregiver no longer Verified — reassign')).toHaveCount(0)
    await expect(startedRow.getByRole('button')).toHaveCount(0)

    await testInfo.attach('assigned-tab', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // rows that can still change come before started ones
    const texts = await page.getByRole('listitem').allInnerTexts()
    const at = (needle: string) => texts.findIndex((t) => t.includes(needle))
    expect(at(`Recipient: Flag ${stamp}`)).toBeLessThan(at(`Recipient: Started ${stamp}`))
    expect(at(`Recipient: Asg ${stamp}`)).toBeLessThan(at(`Recipient: Started ${stamp}`))
  })
})
