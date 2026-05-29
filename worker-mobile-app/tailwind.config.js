/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        cream: '#F2EEE5',
        'cream-2': '#EDE8DC',
        paper: '#F8F5EC',
        ink: '#111111',
        'ink-2': '#2A2622',
        'ink-soft': '#4A453E',
        muted: '#8A8378',
        orange: '#FF5A1F',
        'orange-soft': '#FFE2D4',
        mint: '#9DE8DC',
        'mint-dark': '#4FB6A2',
        yellow: '#F4D35E',
        lavender: '#C9C4F0',
        rose: '#F2BFC6',
      },
      fontFamily: {
        serif: ['Newsreader_400Regular', 'serif'],
        'serif-semibold': ['Newsreader_600SemiBold', 'serif'],
        'serif-bold': ['Newsreader_700Bold', 'serif'],
        'serif-italic': ['Newsreader_400Regular_Italic', 'serif'],
        mono: ['JetBrainsMono_400Regular', 'monospace'],
        'mono-bold': ['JetBrainsMono_700Bold', 'monospace'],
        sans: ['System', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
