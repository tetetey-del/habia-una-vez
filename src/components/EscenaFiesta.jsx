// Ilustración propia de la portada: castillo inflable que rebota, chicos saltando,
// pelotero, globos que flotan, banderines y papel picado. Se anima con CSS y
// se queda quieta si el teléfono pide reducir el movimiento.

const ESTILOS = `
.hv-rebote { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-rebote 1.6s ease-in-out infinite; }
.hv-salto1 { transform-box: fill-box; animation: hv-salto 1.1s ease-in-out infinite; }
.hv-salto2 { transform-box: fill-box; animation: hv-salto 1.1s ease-in-out .55s infinite; }
.hv-globo1 { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-flota 4s ease-in-out infinite; }
.hv-globo2 { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-flota 4.6s ease-in-out .8s infinite; }
.hv-globo3 { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-flota 5s ease-in-out 1.6s infinite; }
.hv-bola { transform-box: fill-box; animation: hv-bola 2.4s ease-in-out infinite; }
.hv-confeti { transform-box: fill-box; animation: hv-cae 5s linear infinite; }
.hv-bandera { transform-origin: 50% 0; transform-box: fill-box; animation: hv-viento 2.6s ease-in-out infinite; }
@keyframes hv-rebote { 0%,100% { transform: scale(1,1) } 45% { transform: scale(1.015,.975) } 60% { transform: scale(.99,1.01) } }
@keyframes hv-salto { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-22px) } }
@keyframes hv-flota { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-14px) rotate(3deg) } }
@keyframes hv-bola { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes hv-cae { 0% { transform: translateY(-40px) rotate(0) ; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { transform: translateY(360px) rotate(540deg); opacity: 0 } }
@keyframes hv-viento { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@media (prefers-reduced-motion: reduce) {
  .hv-rebote, .hv-salto1, .hv-salto2, .hv-globo1, .hv-globo2, .hv-globo3, .hv-bola, .hv-confeti, .hv-bandera { animation: none }
}
`

const CONFETI = [
  { x: 40, d: '0s', c: '#FF6F61' }, { x: 95, d: '1.2s', c: '#FFC93C' }, { x: 150, d: '2.6s', c: '#1BB5A6' },
  { x: 215, d: '.6s', c: '#5B2EA6' }, { x: 270, d: '3.4s', c: '#FF6F61' }, { x: 330, d: '1.9s', c: '#FFC93C' },
  { x: 380, d: '4.1s', c: '#1BB5A6' }, { x: 120, d: '3.8s', c: '#5B2EA6' }, { x: 300, d: '.2s', c: '#1BB5A6' },
]

const BANDERAS = ['#FF6F61', '#FFC93C', '#1BB5A6', '#5B2EA6', '#FF6F61', '#FFC93C', '#1BB5A6', '#5B2EA6', '#FF6F61']

function Chico({ x, y, piel, remera, pelo, clase }) {
  return (
    <g className={clase} transform={`translate(${x} ${y})`}>
      {/* brazos arriba */}
      <path d="M-11 4 L-20 -12 M11 4 L20 -12" stroke={piel} strokeWidth="5" strokeLinecap="round" />
      <rect x="-11" y="0" width="22" height="24" rx="9" fill={remera} />
      <circle cx="0" cy="-9" r="10" fill={piel} />
      <path d="M-10 -11 a10 10 0 0 1 20 0 c-4 -3 -9 -4 -14 -1 z" fill={pelo} />
      <circle cx="-3.5" cy="-8" r="1.3" fill="#221A33" />
      <circle cx="3.5" cy="-8" r="1.3" fill="#221A33" />
      <path d="M-3.5 -4 q3.5 3 7 0" stroke="#221A33" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M-5 24 L-7 34 M5 24 L7 34" stroke="#221A33" strokeWidth="5" strokeLinecap="round" />
    </g>
  )
}

export default function EscenaFiesta({ className = '' }) {
  return (
    <svg viewBox="0 0 420 360" className={className} role="img" aria-label="Castillo inflable con chicos saltando, pelotero y globos">
      <style>{ESTILOS}</style>
      <defs>
        <linearGradient id="hv-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFE7FB" />
          <stop offset="1" stopColor="#FBF7FF" />
        </linearGradient>
        <linearGradient id="hv-lona" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a7e" />
          <stop offset="1" stopColor="#e85a4d" />
        </linearGradient>
        <linearGradient id="hv-torre" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd766" />
          <stop offset=".5" stopColor="#FFC93C" />
          <stop offset="1" stopColor="#e9b021" />
        </linearGradient>
        <pattern id="hv-red" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 0 L8 8 M8 0 L0 8" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1" />
        </pattern>
      </defs>

      {/* fondo */}
      <rect x="0" y="0" width="420" height="360" rx="36" fill="url(#hv-cielo)" />
      <circle cx="350" cy="70" r="46" fill="#FFC93C" opacity=".35" />

      {/* banderines */}
      <path d="M10 34 Q210 86 410 34" stroke="#5B2EA6" strokeOpacity=".5" strokeWidth="2" fill="none" />
      {BANDERAS.map((c, i) => {
        const t = (i + 0.5) / BANDERAS.length
        const x = 10 + 400 * t
        const y = 34 + 52 * 4 * t * (1 - t) * 0.5
        return <path key={i} className="hv-bandera" style={{ animationDelay: `${i * 0.2}s` }} d={`M${x - 11} ${y} L${x + 11} ${y} L${x} ${y + 22} Z`} fill={c} />
      })}

      {/* sombra */}
      <ellipse cx="200" cy="330" rx="170" ry="14" fill="#5B2EA6" opacity=".14" />

      {/* castillo inflable */}
      <g className="hv-rebote">
        {/* torres */}
        {[58, 342].map((cx) => (
          <g key={cx}>
            <rect x={cx - 26} y="128" width="52" height="196" rx="24" fill="url(#hv-torre)" />
            <path d={`M${cx - 30} 136 Q${cx} 60 ${cx + 30} 136 Z`} fill="#5B2EA6" />
            <circle cx={cx} cy="82" r="7" fill="#FFC93C" />
            <rect x={cx - 3} y="128" width="6" height="196" fill="#ffffff" opacity=".18" />
          </g>
        ))}
        {/* pared trasera con almenas inflables */}
        <rect x="76" y="150" width="248" height="174" rx="22" fill="url(#hv-lona)" />
        {[96, 136, 176, 216, 256, 296].map((x) => <circle key={x} cx={x + 8} cy="152" r="18" fill="#1BB5A6" />)}
        {/* red de seguridad */}
        <rect x="102" y="182" width="196" height="86" rx="14" fill="#5B2EA6" opacity=".25" />
        <rect x="102" y="182" width="196" height="86" rx="14" fill="url(#hv-red)" />
        {/* costuras */}
        {[140, 200, 260].map((x) => <rect key={x} x={x - 2} y="176" width="4" height="148" rx="2" fill="#ffffff" opacity=".2" />)}
        {/* chicos saltando */}
        <Chico x={160} y={214} piel="#f2c6a0" remera="#FFC93C" pelo="#5a3a22" clase="hv-salto1" />
        <Chico x={240} y={214} piel="#c98d63" remera="#1BB5A6" pelo="#221A33" clase="hv-salto2" />
        {/* base / colchón */}
        <rect x="70" y="274" width="260" height="52" rx="22" fill="#1BB5A6" />
        <rect x="70" y="274" width="260" height="10" rx="5" fill="#ffffff" opacity=".25" />
        {/* rampa de entrada */}
        <path d="M168 326 L232 326 L250 346 L150 346 Z" fill="#FFC93C" />
      </g>

      {/* pelotero */}
      <g>
        <rect x="300" y="282" width="104" height="48" rx="16" fill="#5B2EA6" />
        {[
          [314, 288, '#FF6F61'], [332, 284, '#FFC93C'], [350, 289, '#1BB5A6'], [368, 285, '#FF6F61'], [386, 289, '#FFC93C'],
          [322, 276, '#1BB5A6'], [342, 274, '#FF6F61'], [362, 276, '#FFC93C'], [380, 275, '#1BB5A6'],
        ].map(([cx, cy, c], i) => (
          <circle key={i} className="hv-bola" style={{ animationDelay: `${i * 0.25}s` }} cx={cx} cy={cy} r="9" fill={c} />
        ))}
      </g>

      {/* globos */}
      {[
        { x: 34, y: 196, c: '#FF6F61', clase: 'hv-globo1' },
        { x: 70, y: 178, c: '#5B2EA6', clase: 'hv-globo2' },
        { x: 388, y: 168, c: '#1BB5A6', clase: 'hv-globo3' },
      ].map((g) => (
        <g key={g.x} className={g.clase}>
          <path d={`M${g.x} ${g.y + 32} q-6 40 4 84`} stroke="#221A33" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
          <ellipse cx={g.x} cy={g.y} rx="20" ry="25" fill={g.c} />
          <path d={`M${g.x - 4} ${g.y + 24} L${g.x + 4} ${g.y + 24} L${g.x} ${g.y + 31} Z`} fill={g.c} />
          <ellipse cx={g.x - 7} cy={g.y - 9} rx="5" ry="8" fill="#fff" opacity=".4" />
        </g>
      ))}

      {/* papel picado */}
      {CONFETI.map((p, i) => (
        <rect key={i} className="hv-confeti" style={{ animationDelay: p.d }} x={p.x} y="0" width="7" height="12" rx="2" fill={p.c} />
      ))}
    </svg>
  )
}
