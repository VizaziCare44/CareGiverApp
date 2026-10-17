// seedAccounts: the accounts module of the test seed (DEV-054; Test_Data_Strategy.md
// §8 T2). Creates the starter set (starter-set.mjs) through the Auth admin API, so
// each profile row comes out the way a real sign-up would leave it (§9(d)).
//
// Idempotent, so it can be run again on the dev project (the fallback to a reset):
//   - an account that is missing is created; one that exists has its password, name,
//     phone and role put back as they should be;
//   - a recipient that is missing is created; one that exists has its care notes put back;
//   - a booking that is missing is created; one that exists and is still `requested`
//     has its date moved to the new "relative to now"; one that has moved on (assigned,
//     in progress, completed, cancelled) is left exactly as it is;
//   - NOTHING IS EVER DELETED, and nothing outside the starter set is touched.
// It writes no verification or assignment rows: those are DEV-051's.

import { ACCOUNTS, BOOKINGS, RECIPIENTS } from './starter-set.mjs'
import { nairobiTime } from './dates.mjs'

async function listEmailToId(supabase) {
  const byEmail = new Map()
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`could not list accounts: ${error.message}`)
    for (const user of data.users) byEmail.set((user.email ?? '').toLowerCase(), user.id)
    if (data.users.length < 1000) break
  }
  return byEmail
}

export async function seedAccounts({ supabase, password, now = new Date() }) {
  const summary = {
    accounts: { created: 0, restored: 0 },
    recipients: { created: 0, restored: 0 },
    bookings: { created: 0, redated: 0, left: 0 },
  }
  const ids = {} // account key -> user id
  const emailToId = await listEmailToId(supabase)

  for (const account of ACCOUNTS) {
    const attributes = {
      password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, phone: account.phone },
      // the role only ever comes from app_metadata, which only the service role can write
      ...(account.role === 'family_member' ? {} : { app_metadata: { role: account.role } }),
    }
    let id = emailToId.get(account.email)
    if (id) {
      const { error } = await supabase.auth.admin.updateUserById(id, attributes)
      if (error) throw new Error(`could not restore ${account.email}: ${error.message}`)
      summary.accounts.restored += 1
    } else {
      const { data, error } = await supabase.auth.admin.createUser({ email: account.email, ...attributes })
      if (error || !data.user) throw new Error(`could not create ${account.email}: ${error?.message}`)
      id = data.user.id
      summary.accounts.created += 1
    }
    ids[account.key] = id

    // the profile row, as it should be (a changed role or name is put back; a missing row is made)
    const profile = { id, role: account.role, full_name: account.fullName, phone: account.phone, email: account.email }
    const { error: profileError } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' })
    if (profileError) throw new Error(`could not restore the profile of ${account.email}: ${profileError.message}`)
  }

  const recipientIds = {} // recipient key -> id
  for (const recipient of RECIPIENTS) {
    const accountId = ids[recipient.owner]
    const { data: found, error } = await supabase
      .from('care_recipients')
      .select('id, care_notes')
      .eq('account_id', accountId)
      .eq('name', recipient.name)
      .maybeSingle()
    if (error) throw new Error(`could not look up ${recipient.name}: ${error.message}`)
    if (found) {
      if ((found.care_notes ?? null) !== recipient.careNotes) {
        const { error: updateError } = await supabase.from('care_recipients').update({ care_notes: recipient.careNotes }).eq('id', found.id)
        if (updateError) throw new Error(`could not restore ${recipient.name}: ${updateError.message}`)
        summary.recipients.restored += 1
      }
      recipientIds[recipient.key] = found.id
    } else {
      const { data: created, error: insertError } = await supabase
        .from('care_recipients')
        .insert({ account_id: accountId, name: recipient.name, care_notes: recipient.careNotes })
        .select('id')
        .single()
      if (insertError || !created) throw new Error(`could not create ${recipient.name}: ${insertError?.message}`)
      recipientIds[recipient.key] = created.id
      summary.recipients.created += 1
    }
  }

  for (const booking of BOOKINGS) {
    const ownerKey = RECIPIENTS.find((r) => r.key === booking.recipient).owner
    const visit = nairobiTime({ days: booking.days, hour: booking.hour, now }).toISOString()
    const { data: found, error } = await supabase
      .from('bookings')
      .select('id, status, requested_datetime')
      .eq('care_recipient_id', recipientIds[booking.recipient])
      .eq('bundle_code', booking.bundle)
      .maybeSingle()
    if (error) throw new Error(`could not look up ${booking.key}: ${error.message}`)
    if (!found) {
      const { error: insertError } = await supabase.from('bookings').insert({
        account_id: ids[ownerKey],
        care_recipient_id: recipientIds[booking.recipient],
        bundle_code: booking.bundle,
        requested_datetime: visit,
        status: 'requested',
      })
      if (insertError) throw new Error(`could not create ${booking.key}: ${insertError.message}`)
      summary.bookings.created += 1
    } else if (found.status === 'requested') {
      const { error: updateError } = await supabase.from('bookings').update({ requested_datetime: visit }).eq('id', found.id)
      if (updateError) throw new Error(`could not re-date ${booking.key}: ${updateError.message}`)
      summary.bookings.redated += 1
    } else {
      summary.bookings.left += 1
    }
  }

  return summary
}
