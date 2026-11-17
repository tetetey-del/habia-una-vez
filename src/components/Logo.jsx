// Marca propia: estrella de cuento sobre un libro abierto
export function Isotipo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#5B2EA6" />
      <path d="M8 33c5-3 11-3 16 0 5-3 11-3 16 0v4c-5-3-11-3-16 0-5-3-11-3-16 0z" fill="#FBF7FF" />
      <path d="M24 9l3.6 7.3 8 1.2-5.8 5.6 1.4 8L24 27.3l-7.2 3.8 1.4-8-5.8-5.6 8-1.2z" fill="#FFC93C" />
    </svg>
  )
}

export function Logo({ claro = false, subtitulo = true }) {
  return (
    <span className="flex items-center gap-2">
      <Isotipo />
      <span className="leading-none">
        <span className={`block font-titulo text-xl font-extrabold ${claro ? 'text-white' : 'text-violeta'}`}>Había una Vez</span>
        {subtitulo && <span className={`block text-[11px] font-semibold ${claro ? 'text-white/70' : 'text-tinta-suave'}`}>Salón de fiestas infantiles</span>}
      </span>
    </span>
  )
}

// Ilustraciones simples propias (bloques de color)
export function Castillo({ className = '' }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden="true">
      <ellipse cx="110" cy="166" rx="100" ry="10" fill="#5B2EA6" opacity="0.12" />
      <rect x="40" y="70" width="140" height="92" rx="14" fill="#FF6F61" />
      <rect x="22" y="50" width="40" height="112" rx="12" fill="#FFC93C" />
      <rect x="158" y="50" width="40" height="112" rx="12" fill="#FFC93C" />
      <path d="M22 54l20-30 20 30z" fill="#5B2EA6" />
      <path d="M158 54l20-30 20 30z" fill="#5B2EA6" />
      <path d="M70 72l40-46 40 46z" fill="#1BB5A6" />
      <path d="M92 162v-34a18 18 0 0136 0v34z" fill="#5B2EA6" />
      <circle cx="42" cy="88" r="7" fill="#FBF7FF" />
      <circle cx="178" cy="88" r="7" fill="#FBF7FF" />
      <circle cx="80" cy="104" r="6" fill="#FBF7FF" opacity="0.8" />
      <circle cx="140" cy="104" r="6" fill="#FBF7FF" opacity="0.8" />
      <path d="M110 26V8l16 5-16 5" fill="#FFC93C" stroke="#5B2EA6" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function Globos({ className = '' }) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden="true">
      <path d="M40 70c4 30-6 50 4 86M80 60c-4 34 6 56-6 96" stroke="#221A33" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <ellipse cx="40" cy="44" rx="26" ry="32" fill="#FF6F61" />
      <ellipse cx="82" cy="36" rx="24" ry="30" fill="#1BB5A6" />
      <ellipse cx="32" cy="34" rx="6" ry="10" fill="#fff" opacity="0.4" />
      <ellipse cx="74" cy="26" rx="5" ry="9" fill="#fff" opacity="0.4" />
    </svg>
  )
}
