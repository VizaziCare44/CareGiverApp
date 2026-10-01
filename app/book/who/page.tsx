import { createClient } from '@/lib/supabase/server'
import { WhoPicker } from '@/components/booking/who-picker'
import type { CareRecipient } from '@/lib/bookings/types'

export default async function WhoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase.from('care_recipients').select('*').eq('account_id', user!.id).order('created_at', { ascending: true })

  return <WhoPicker recipients={(data ?? []) as CareRecipient[]} />
}
