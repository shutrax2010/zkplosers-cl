/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#020617',
        'bg-card': '#0f172a',
        'bg-card2': '#1e293b',
        'accent-purple': '#7c3aed',
        'accent-cyan': '#06b6d4',
        'accent-crimson': '#e11d48',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        orbitron: ['Orbitron', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
