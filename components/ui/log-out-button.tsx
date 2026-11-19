import { TEXT_LINK_CLASS } from '@/components/ui/text-link'

// VIZ-201: Log out, for every signed-in role. A POST from a same-origin form, never a link, so a prefetch or a link
// on another site cannot sign anyone out (app/auth/sign-out/route.ts also refuses a POST from another origin). It looks
// like the other text links (Figma "Text link (44 tap target)"). `className` goes on the form, so a layout can place it.
export function LogOutButton({ className = '' }: { className?: string }) {
  return (
    <form method="post" action="/auth/sign-out" className={className}>
      <button type="submit" className={TEXT_LINK_CLASS}>
        Log out
      </button>
    </form>
  )
}
