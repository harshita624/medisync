/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        dm:   ['var(--font-dm)',   'system-ui', 'sans-serif'],
      },
      colors: {
        hb: {
          teal: '#42c6b8',
          blue: '#2262c3',
          dark: '#168997',
        },
      },
      animation: {
        'fade-in-up':    'fadeInUp 0.55s cubic-bezier(0.22,0.68,0,1.2) both',
        'fade-in-down':  'fadeInDown 0.45s ease both',
        'fade-in-left':  'fadeInLeft 0.45s ease both',
        'fade-in-right': 'fadeInRight 0.5s ease both',
        'float-slow':    'floatSlow 4s ease-in-out infinite',
        'float-card':    'floatCard 5s ease-in-out infinite',
        'shimmer':       'shimmer 2.5s linear infinite',
        'pulse-glow':    'pulseGlow 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp:    { from: { opacity:0, transform:'translateY(24px)'  }, to: { opacity:1, transform:'translateY(0)'  } },
        fadeInDown:  { from: { opacity:0, transform:'translateY(-16px)' }, to: { opacity:1, transform:'translateY(0)'  } },
        fadeInLeft:  { from: { opacity:0, transform:'translateX(-20px)' }, to: { opacity:1, transform:'translateX(0)'  } },
        fadeInRight: { from: { opacity:0, transform:'translateX(20px)'  }, to: { opacity:1, transform:'translateX(0)'  } },
        floatSlow:   { '0%,100%': { transform:'translateY(0)'    }, '50%': { transform:'translateY(-8px)'  } },
        floatCard:   { '0%,100%': { transform:'translateY(0) rotate(-1deg)' }, '50%': { transform:'translateY(-10px) rotate(1deg)' } },
        shimmer:     { '0%': { transform:'translateX(-100%)' }, '100%': { transform:'translateX(100%)' } },
        pulseGlow:   { '0%,100%': { boxShadow:'0 0 0 0 rgba(66,198,184,0)'  }, '50%': { boxShadow:'0 0 20px 4px rgba(66,198,184,0.35)' } },
      },
    },
  },
  plugins: [],
};