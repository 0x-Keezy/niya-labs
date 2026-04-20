/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        niya: {
          bg:           '#FDEEDC',
          panel:        '#FFFBF5',
          'panel-2':    '#FFF5E8',
          'panel-3':    '#FCEADB',
          ink:          '#1F1F1F',
          'ink-2':      '#3A3A3A',
          'ink-3':      '#6B6B6B',
          'ink-mute':   '#9B9B9B',
          accent:       '#D67A67',
          'accent-2':   '#E67080',
          pink:         '#E89B8B',
          'pink-soft':  '#FCE0D8',
          'rose-soft':  '#FEE3E7',
          'sage-soft':  '#DCFCE7',
          gold:         '#B8812A',
          sun:          '#E8A853',
          'sun-soft':   '#FDF0D4',
          border:       '#F0D9B0',
          'border-2':   '#EACDA0',
          tan:          '#F5DCB8',
          'tan-border': '#E8C899',
          'tan-ink':    '#7A5B36',
          up:           '#22C55E',
          'up-deep':    '#16A34A',
          dn:           '#E67080',
          dark:         '#14161C',
          'dark-2':     '#1C1F27',
          'dark-ink':   '#F5E9D4',
          experimental: '#856292',
        },
      },
      fontFamily: {
        display: ['"M PLUS Rounded 1c"', '"Montserrat"', 'system-ui', 'sans-serif'],
        body:    ['"Montserrat"', '"M PLUS Rounded 1c"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out both',
        'slide-up': 'slideUp 400ms ease-out both',
        'scale-in': 'scaleIn 500ms cubic-bezier(0.34,1.56,0.64,1) both',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
