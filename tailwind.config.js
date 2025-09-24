/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./App.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./assets/**/*.{jpeg,jpg,svg,png}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: { 600: "#2D8A24" },
        surface: "#F9F6EE",
        text: { primary: "#1C1C1C", secondary: "#777777", tertiary: "#5A3E1B" },
        neutral: { 0: "#FFFFFF", 200: "#BDBDBD" },
        danger: { 600: "#C0392B" },
        warning: { bg: "#FFF3CD" },
        border: "#BDBDBD",
      },
      borderRadius: { "2xl": "24px" },
    },
  },
  plugins: [],
};
