/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0B0B0B',
                green: {
                    DEFAULT: '#0F2A1D',
                    light: '#1A3F2E', // Lighter variant for hover
                },
                brown: {
                    dark: '#2A1B12',
                    light: '#6B4B2A',
                },
                gold: {
                    DEFAULT: '#C9A24A',
                    hover: '#DBB55F',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
