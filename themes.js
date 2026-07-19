// ---------------------------------------------------------------------------
// THEME PRESETS (shared — never varies per client).
// Loaded as a plain script (like client-config.js), so this defines a global
// `THEMES` object rather than using ES module exports.
//
// A tenant picks one preset by name in client-config.js:
//   theme: "coolProfessional"
// and may optionally nudge only the accent color:
//   themeOverrides: { primary: "#0e7490" }
// (primaryDark and the image tint are re-derived from the override
// automatically in config.js, so one hex is all a tenant ever touches.)
//
// Every preset controls ONLY the skin — colors, fonts, button style, corner
// radii, image tint. Layout/structure is identical across all presets.
//
// Preset shape:
//   colors:      primary, primaryDark, secondary (deep header/heading color),
//                text, bg (page background), surface (cards/panels)
//   fonts:       heading/body CSS stacks + Google Fonts css2 family params
//   buttonStyle: "solid" | "outline" | "pill"  (drives body[data-style=...])
//   radius:      button / card / image corner radii matching the aesthetic
//   imageTintAlpha: opacity of the primary-color wash applied over
//                hero/listing images (tint color itself derives from primary)
// ---------------------------------------------------------------------------
const THEMES = {
  warmOrange: {
    colors: {
      primary: "#e76f51",
      primaryDark: "#b34a31",
      secondary: "#264653",
      text: "#2b2420",
      bg: "#fdf6f0",
      surface: "#fffaf5"
    },
    fonts: {
      heading: '"Poppins", "DM Sans", sans-serif',
      body: '"Inter", "DM Sans", sans-serif',
      google: ["Poppins:wght@500;600;700;800", "Inter:wght@400;500;700"]
    },
    buttonStyle: "solid",
    radius: {
      button: "14px",
      card: "18px",
      image: "14px"
    },
    imageTintAlpha: 0.16
  },

  coolProfessional: {
    colors: {
      primary: "#2563eb",
      primaryDark: "#1e40af",
      secondary: "#0f172a",
      text: "#1e293b",
      bg: "#f8fafc",
      surface: "#ffffff"
    },
    fonts: {
      heading: '"Space Grotesk", "DM Sans", sans-serif',
      body: '"Inter", "DM Sans", sans-serif',
      google: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;700"]
    },
    buttonStyle: "outline",
    radius: {
      button: "8px",
      card: "12px",
      image: "10px"
    },
    imageTintAlpha: 0.12
  },

  friendlyPill: {
    colors: {
      primary: "#7c3aed",
      primaryDark: "#5b21b6",
      secondary: "#2e1065",
      text: "#342e45",
      bg: "#faf8ff",
      surface: "#ffffff"
    },
    fonts: {
      heading: '"Nunito", "DM Sans", sans-serif',
      body: '"Inter", "DM Sans", sans-serif',
      google: ["Nunito:wght@600;700;800", "Inter:wght@400;500;700"]
    },
    buttonStyle: "pill",
    radius: {
      button: "999px",
      card: "24px",
      image: "20px"
    },
    imageTintAlpha: 0.14
  },

  boldMinimal: {
    colors: {
      primary: "#d90429",
      primaryDark: "#9d0208",
      secondary: "#111318",
      text: "#16181d",
      bg: "#ffffff",
      surface: "#f5f5f4"
    },
    fonts: {
      heading: '"Playfair Display", "DM Sans", serif',
      body: '"Source Sans 3", "DM Sans", sans-serif',
      google: ["Playfair+Display:wght@600;700;800", "Source+Sans+3:wght@400;500;700"]
    },
    buttonStyle: "solid",
    radius: {
      button: "2px",
      card: "6px",
      image: "4px"
    },
    imageTintAlpha: 0.1
  }
};
