const { light, dark } = require("@charcoal-ui/theme");
/**
 * @type {import('tailwindcss/tailwind-config').TailwindConfig}
 */
module.exports = {
  darkMode: true,
  content: ["./src/**/*.tsx", "./src/**/*.html"],
  theme: {
    // Custom breakpoint for ultrawide / 4K displays. Tailwind's default `2xl`
    // caps at 1536 px, so a 2560×1440 monitor sits comfortably inside 2xl
    // and a 3440×1440 or 3840×2160 would still trigger 2xl styling without
    // this extra tier. `3xl: 1920px` lets us widen container caps for those
    // larger viewports without affecting standard desktops. All other
    // breakpoints match Tailwind defaults.
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px",
    },
    extend: {
      colors: {
        primary: "#856292",
        "primary-hover": "#8E76A1",
        "primary-press": "#988BB0",
        "primary-disabled": "#6F48694D",
        secondary: "#FF617F",
        "secondary-hover": "#FF849B",
        "secondary-press": "#FF9EB1",
        "secondary-disabled": "#FF617F4D",
        base: "#FBE2CA",
        "text-primary": "#514062",
        // --- Niya Tools palette ---
        // Mirrors `extension/tailwind.config.js` so the ported side-panel
        // components render identically inside the Next.js app. Do not
        // edit here alone — keep in sync with the extension config until
        // we extract a shared package.
        niya: {
          bg:           "#FDEEDC",
          panel:        "#FFFBF5",
          "panel-2":    "#FFF5E8",
          "panel-3":    "#FCEADB",
          // Retinted to warm brown (matches landing `#6B5344`) so the
          // Tools page reads as the same product as `/`. The previous
          // #1F1F1F was a cold black carried from the extension sidepanel.
          ink:          "#6B5344",
          // Bumped from #7A6450 to #6B5344 so body-copy usage hits WCAG AAA
          // (>=7:1) on the #FFFBF5 paper background. The ink-2 token is
          // mainly applied to secondary text via `text-niya-ink-2`; captions
          // read the same, body copy becomes noticeably crisper.
          "ink-2":      "#6B5344",
          "ink-3":      "#9B8570",
          "ink-mute":   "#B8A88F",
          // Accent retinted from coral `#D67A67` to the landing tan/gold
          // so the CTA matches the overall brand. Coral kept as accent-2
          // for error/danger states only.
          accent:       "#C9A86C",
          "accent-2":   "#E67080",
          pink:         "#E89B8B",
          "pink-soft":  "#FCE0D8",
          "rose-soft":  "#FEE3E7",
          "sage-soft":  "#DCFCE7",
          gold:         "#B8812A",
          sun:          "#E8A853",
          "sun-soft":   "#FDF0D4",
          border:       "#F0D9B0",
          "border-2":   "#EACDA0",
          tan:          "#F5DCB8",
          "tan-border": "#E8C899",
          "tan-ink":    "#7A5B36",
          up:           "#22C55E",
          "up-deep":    "#16A34A",
          dn:           "#E67080",
          // Legacy dark tokens kept for any chart overlay that still uses
          // them — but `.niya-dark-inset` in globals.css now renders warm.
          dark:         "#14161C",
          "dark-2":     "#1C1F27",
          "dark-ink":   "#F5E9D4",
          experimental: "#856292",
        },
      },
      fontFamily: {
        M_PLUS_2: ["Montserrat", "M_PLUS_2", "sans-serif"],
        Montserrat: ["Montserrat", "sans-serif"],
        // Outfit first — matches the landing. Fallbacks preserve the
        // extension's legacy look if a font fails to load.
        display: ['"Outfit"', '"M PLUS Rounded 1c"', '"Montserrat"', "system-ui", "sans-serif"],
        body:    ['"Montserrat"', '"Outfit"', '"M PLUS Rounded 1c"', "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in":  "fadeIn 400ms ease-out both",
        "slide-up": "slideUp 400ms ease-out both",
        "scale-in": "scaleIn 500ms cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer:    "shimmer 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
