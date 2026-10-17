export const EMAIL_DOMAIN: string
export interface SeedAccount { key: string; role: 'admin' | 'caregiver' | 'family_member'; fullName: string; phone: string; email: string }
export interface SeedRecipient { key: string; owner: string; name: string; careNotes: string | null }
export interface SeedBooking { key: string; recipient: string; bundle: 'medicheck' | 'doctors_day_out'; days: number; hour: number }
export const ACCOUNTS: SeedAccount[]
export const RECIPIENTS: SeedRecipient[]
export const BOOKINGS: SeedBooking[]
export const STARTER_SET: { EMAIL_DOMAIN: string; ACCOUNTS: SeedAccount[]; RECIPIENTS: SeedRecipient[]; BOOKINGS: SeedBooking[] }
