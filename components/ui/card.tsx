import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['rounded-xl border border-border bg-surface p-5 shadow-card', className].join(' ')} {...props} />
}
