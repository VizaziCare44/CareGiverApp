import type { Config } from 'tailwindcss'

/**
 * Vizazi Care design tokens — built fresh for FD-ACC's Family Member booking
 * flow, per docs/UI-UX Designer Skill.md: calm, human-centric, accessible.
 * Not derived from the earlier Figma-prototype extraction — that prototype
 * isn't this feature's design source (FD-ACC §6.2: wireframes built fresh).
 */

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // warm, low-chroma neutrals — never pure white/black (skill: avoid clinical white)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        // sage green — primary brand/action color (calm, care-oriented)
        sage: {
          50: '#f1f5f0',
          100: '#dfe9dc',
          200: '#c1d4bb',
          300: '#9cba91',
          400: '#7a9f6d',
          500: '#5c8250',
          600: '#48693e',
          700: '#3a5433',
          800: '#31442c',
          900: '#293a25',
        },
        // warm sand — secondary surfaces/accents
        sand: {
          50: '#faf6ef',
          100: '#f3ead7',
          200: '#e6d3ae',
          300: '#d6b77e',
          400: '#c69c56',
          500: '#b3833f',
          600: '#946a34',
          700: '#78552e',
          800: '#63472a',
          900: '#523c26',
        },
        // muted blue — trust/informational accents
        trust: {
          50: '#f0f4f7',
          100: '#dae6ed',
          200: '#b8cedb',
          300: '#8fadc0',
          400: '#6890a8',
          500: '#4d748c',
          600: '#3e5c70',
          700: '#354c5c',
          800: '#2f414d',
          900: '#2a3842',
        },
        // muted terracotta — errors/destructive, never harsh red
        alert: {
          50: '#fbf1ee',
          100: '#f4dcd3',
          200: '#e8b8a7',
          300: '#d88f74',
          400: '#c4694a',
          500: '#a8502f',
          600: '#8a4227',
          700: '#703623',
          800: '#5e2f20',
          900: '#4f291d',
        },
      },

      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // "sm" is the floor for any real UI copy — skill sets 16px as the true minimum,
        // sm exists only for dense secondary labels, never primary content
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], // 15px/22.4px
        base: ['1rem', { lineHeight: '1.6rem' }], // 16px/25.6px — body floor
        lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        xl: ['1.375rem', { lineHeight: '1.9rem', fontWeight: '600' }], // 22px — section headings
        '2xl': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700' }], // 28px — screen titles
        '3xl': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }], // 36px — hero
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
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        modal: '0 8px 24px -4px rgb(0 0 0 / 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
