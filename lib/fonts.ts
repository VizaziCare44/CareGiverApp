import { Inter } from 'next/font/google'

// The Figma design language uses Inter. One loader for the screens built to it from FD-ACC (Sign Up, Log In,
// the Care Recipient screens); the other areas still load it in their own layouts.
export const inter = Inter({ subsets: ['latin'], display: 'swap' })
