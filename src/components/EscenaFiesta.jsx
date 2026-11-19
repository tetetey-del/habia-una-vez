// Ilustración propia de la portada: torta de cumpleaños con velitas que titilan,
// regalos, globos que flotan, estrellas y papel picado.
// Las animaciones usan grupos internos (no pisan la posición de cada pieza) y
// se apagan si el teléfono pide reducir el movimiento.

const ESTILOS = `
.hv-llama { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-llama 1.1s ease-in-out infinite; }
.hv-flota { transform-box: fill-box; animation: hv-flota 4.5s ease-in-out infinite; }
.hv-brilla { transform-origin: 50% 50%; transform-box: fill-box; animation: hv-brilla 2.4s ease-in-out infinite; }
.hv-cae { transform-box: fill-box; animation: hv-cae 6s linear infinite; }
.hv-moño { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-moño 3s ease-in-out infinite; }
@keyframes hv-llama { 0%,100% { transform: scale(1,1) rotate(-3deg) } 50% { transform: scale(.85,1.12) rotate(3deg) } }
@keyframes hv-flota { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-16px) rotate(2deg) } }
@keyframes hv-brilla { 0%,100% { transform: scale(.6); opacity: .4 } 50% { transform: scale(1.1); opacity: 1 } }
@keyframes hv-cae { 0% { transform: translateY(-30px) rotate(0); opacity: 0 } 8% { opacity: 1 } 92% { opacity: 1 } 100% { transform: translateY(380px) rotate(600deg); opacity: 0 } }
@keyframes hv-moño { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@media (prefers-reduced-motion: reduce) {
  .hv-llama, .hv-flota, .hv-brilla, .hv-cae, .hv-moño { animation: none }
}
`

const CONFETI = [
  { x: 30, d: '0s', c: '#FF6F61' }, { x: 78, d: '2.1s', c: '#FFC93C' }, { x: 128, d: '4.2s', c: '#1BB5A6' },
  { x: 176, d: '1.1s', c: '#5B2EA6' }, { x: 240, d: '3.3s', c: '#FF6F61' }, { x: 292, d: '.5s', c: '#FFC93C' },
  { x: 338, d: '2.7s', c: '#1BB5A6' }, { x: 392, d: '4.8s', c: '#5B2EA6' }, { x: 212, d: '5.4s', c: '#1BB5A6' },
]

const ESTRELLAS = [
  { x: 64, y: 70, r: 9, d: '0s' }, { x: 352, y: 96, r: 7, d: '.8s' }, { x: 300, y: 40, r: 5, d: '1.5s' },
  { x: 120, y: 132, r: 5, d: '1.1s' }, { x: 384, y: 186, r: 6, d: '.3s' }, { x: 36, y: 210, r: 5, d: '1.9s' },
]

function estrella(r) {
  const p = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    p.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`)
  }
  return p.join(' ')
}

function Globo({ x, y, color, retraso }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="hv-flota" style={{ animationDelay: retraso }}>
        <path d="M0 38 q-8 40 6 90" stroke="#221A33" strokeOpacity=".3" strokeWidth="1.6" fill="none" />
        <ellipse cx="0" cy="0" rx="26" ry="32" fill={color} />
        <path d="M-5 30 L5 30 L0 39 Z" fill={color} />
        <ellipse cx="-9" cy="-12" rx="6" ry="10" fill="#fff" opacity=".45" />
      </g>
    </g>
  )
}

function Vela({ x, y, color, retraso }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-5" y="0" width="10" height="34" rx="3" fill={color} />
      <path d="M-5 8 L5 4 M-5 18 L5 14 M-5 28 L5 24" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" />
      <path d="M0 0 v-5" stroke="#221A33" strokeWidth="1.5" />
      <g className="hv-llama" style={{ animationDelay: retraso }}>
        <path d="M0 -24 C 8 -14 7 -6 0 -5 C -7 -6 -8 -14 0 -24 Z" fill="#FFC93C" />
        <path d="M0 -16 C 3 -11 3 -8 0 -7 C -3 -8 -3 -11 0 -16 Z" fill="#FF6F61" />
      </g>
    </g>
  )
}

function Regalo({ x, y, ancho, alto, caja, cinta }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={ancho} height={alto} rx="6" fill={caja} />
      <rect x="-4" y="-10" width={ancho + 8} height="14" rx="5" fill={caja} />
      <rect x="-4" y="-10" width={ancho + 8} height="14" rx="5" fill="#000" opacity=".08" />
      <rect x={ancho / 2 - 5} y="-10" width="10" height={alto + 10} fill={cinta} />
      <g className="hv-moño">
        <path d={`M${ancho / 2} -10 c-14 -16 -26 -2 0 0 c26 -2 14 -16 0 0`} fill={cinta} />
      </g>
    </g>
  )
}

export default function EscenaFiesta({ className = '' }) {
  return (
    <svg viewBox="0 0 420 380" className={className} role="img" aria-label="Torta de cumpleaños con velitas, regalos y globos">
      <style>{ESTILOS}</style>
      <defs>
        <radialGradient id="hv-fondo" cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#EFE7FB" />
        </radialGradient>
        <linearGradient id="hv-bizcocho" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f7b8c9" />
          <stop offset=".5" stopColor="#fbd0dc" />
          <stop offset="1" stopColor="#ef9fb4" />
        </linearGradient>
        <linearGradient id="hv-bizcocho2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b994e6" />
          <stop offset=".5" stopColor="#cdb1f0" />
          <stop offset="1" stopColor="#a57edb" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="420" height="380" rx="40" fill="url(#hv-fondo)" />
      <circle cx="210" cy="200" r="150" fill="#FFC93C" opacity=".18" />

      {ESTRELLAS.map((e, i) => (
        <g key={i} transform={`translate(${e.x} ${e.y})`}>
          <polygon className="hv-brilla" style={{ animationDelay: e.d }} points={estrella(e.r)} fill="#FFC93C" />
        </g>
      ))}

      <Globo x={62} y={128} color="#FF6F61" retraso="0s" />
      <Globo x={108} y={92} color="#1BB5A6" retraso="1.2s" />
      <Globo x={350} y={118} color="#5B2EA6" retraso=".6s" />

      {/* mesa */}
      <ellipse cx="210" cy="338" rx="178" ry="18" fill="#5B2EA6" opacity=".12" />

      {/* plato */}
      <ellipse cx="210" cy="322" rx="120" ry="14" fill="#ffffff" stroke="#e7def5" strokeWidth="3" />

      {/* piso de abajo */}
      <rect x="110" y="236" width="200" height="84" rx="16" fill="url(#hv-bizcocho)" />
      <path d="M110 252 q12.5 18 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 v-0 a16 16 0 0 0 -16 -16 h-168 a16 16 0 0 0 -16 16 z" fill="#ffffff" />
      {[138, 170, 202, 234, 266, 290].map((x, i) => (
        <circle key={x} cx={x} cy="290" r="6" fill={['#FF6F61', '#FFC93C', '#1BB5A6'][i % 3]} />
      ))}

      {/* piso de arriba */}
      <rect x="146" y="168" width="128" height="70" rx="14" fill="url(#hv-bizcocho2)" />
      <path d="M146 182 q8 16 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 a14 14 0 0 0 -14 -14 h-100 a14 14 0 0 0 -14 14 z" fill="#ffffff" />
      <path d="M160 214 h100" stroke="#FFC93C" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />

      {/* velitas */}
      <Vela x={178} y={134} color="#FF6F61" retraso="0s" />
      <Vela x={210} y={130} color="#1BB5A6" retraso=".35s" />
      <Vela x={242} y={134} color="#FFC93C" retraso=".7s" />

      {/* regalos */}
      <Regalo x={44} y={276} ancho={58} alto={50} caja="#1BB5A6" cinta="#FFC93C" />
      <Regalo x={318} y={250} ancho={62} alto={56} caja="#FF6F61" cinta="#5B2EA6" />
      <Regalo x={330} y={300} ancho={36} alto={28} caja="#FFC93C" cinta="#FF6F61" />

      {CONFETI.map((p, i) => (
        <g key={i} transform={`translate(${p.x} 0)`}>
          <rect className="hv-cae" style={{ animationDelay: p.d }} x="0" y="0" width="7" height="12" rx="2" fill={p.c} />
        </g>
      ))}
    </svg>
  )
}
