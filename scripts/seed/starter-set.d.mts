export const EMAIL_DOMAIN: string
export interface SeedAccount { key: string; role: 'admin' | 'caregiver' | 'family_member'; fullName: string; phone: string; email: string }
export interface SeedRecipient { key: string; owner: string; name: string; careNotes: string | null }
export interface SeedBooking { key: string; recipient: string; bundle: 'medicheck' | 'doctors_day_out'; days: number; hour: number; status?: 'cancelled' }
export const ACCOUNTS: SeedAccount[]
export const RECIPIENTS: SeedRecipient[]
export const BOOKINGS: SeedBooking[]
export function occurrence(booking: SeedBooking): number
export const LONG_CARE_NOTE_LENGTH: number
export function longCareNote(head?: string): string
export const VERIFICATION_NOTE: string
export const VERIFICATION_AGE_DAYS: number
export interface SeedVerification { caregiver: string; state: 'verified' | 'removed' | 'none' }
export interface SeedAssignment { booking: string; caregiver: string; status: 'assigned' | 'in_progress' | 'completed' }
export const VERIFICATION: SeedVerification[]
export const ASSIGNMENTS: SeedAssignment[]
export interface SeedClockTime { h: number; m: number }
export interface SeedEntry { task: string; outcome: 'done' | 'not_done'; note?: string | null; reason?: string | null; at: SeedClockTime }
export interface SeedVisit { booking: string; caregiver: string; checkedIn: SeedClockTime; checkedOut: SeedClockTime | null; visitNote: string | null; entries: SeedEntry[] }
export const VISITS: SeedVisit[]
export const STARTER_SET: { EMAIL_DOMAIN: string; ACCOUNTS: SeedAccount[]; RECIPIENTS: SeedRecipient[]; BOOKINGS: SeedBooking[]; VERIFICATION: SeedVerification[]; ASSIGNMENTS: SeedAssignment[]; VISITS: SeedVisit[] }
