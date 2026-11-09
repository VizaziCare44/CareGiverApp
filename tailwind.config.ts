import type { Config } from 'tailwindcss'

/**
 * Vizazi Care design tokens: the Figma design language ("Vizazi Care — FD-ACC + FD-VERIFY Wireframes", Components
 * page, variables color/*), as the figma-* colours below. The earlier sage, sand, trust and alert palettes are gone,
 * so the old look cannot come back.
 */

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Figma design language (see app/globals.css): bg-figma-soft, text-figma-ink, ...
        figma: {
          ink: 'var(--figma-ink)',
          soft: 'var(--figma-soft)',
          softtext: 'var(--figma-softtext)',
          surface: 'var(--figma-surface)',
          border: 'var(--figma-border)',
          line: 'var(--figma-line)',
          primary: 'var(--figma-primary)',
          danger: 'var(--figma-danger)',
          dangersoft: 'var(--figma-dangersoft)',
          muted: 'var(--figma-muted)',
          amber: 'var(--figma-amber)',
          ambertext: 'var(--figma-ambertext)',
        },
      },

      spacing: {
        touch: '3rem', // 48px — accessible minimum tap target (skill: 48x48dp)
      },
      minHeight: {
        touch: '3rem',
      },
      minWidth: {
        touch: '3rem',
      },

      borderRadius: {
        // soft, organic curves (Fuseproject influence) rather than sharp corners
        lg: '0.875rem', // 14px — cards, inputs
        xl: '1.25rem', // 20px — modals, prominent surfaces
        full: '9999px',
      },

      boxShadow: {
        modal: '0 8px 24px -4px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
