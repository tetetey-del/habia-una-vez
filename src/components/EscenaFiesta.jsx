import { useState } from 'react'

// Ilustración propia de la portada: un libro de cuentos parado, de frente.
// La tapa se abre como una puerta y de adentro del libro sale un castillo.
// Después quedan banderines al viento, ventanas que se encienden, chispas,
// estrellas y nubes. Tocando el dibujo se repite la apertura.
// Cada pieza se ubica con un <g> exterior y se anima en uno interior.
// Si el teléfono pide reducir el movimiento, se muestra el libro abierto y quieto.

const ESTILOS = `
.hv-libro { animation: hv-centrar .7s cubic-bezier(.4,0,.2,1) .5s both; }
.hv-tapa { transform-origin: 0% 50%; transform-box: fill-box; animation: hv-cerrar-tapa .45s ease-in .5s both; }
.hv-hoja-izq { transform-origin: 100% 50%; transform-box: fill-box; animation: hv-abrir-hoja .4s ease-out .95s both; }
.hv-sale { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-sale 1.1s cubic-bezier(.2,1.35,.4,1) 1.3s both; }
.hv-aparece { animation: hv-aparece .9s ease-out 1.9s both; }
.hv-bandera { transform-origin: 0 50%; transform-box: fill-box; animation: hv-bandera 1.8s ease-in-out infinite; }
.hv-brilla { transform-origin: 50% 50%; transform-box: fill-box; animation: hv-brilla 2.6s ease-in-out infinite; }
.hv-chispa { transform-box: fill-box; opacity: 0; animation: hv-chispa 3.6s ease-out infinite; }
.hv-nube { animation: hv-nube 9s ease-in-out infinite; }
.hv-flota { animation: hv-flota 5s ease-in-out 2.5s infinite; }
.hv-ventana { animation: hv-ventana 3s ease-in-out infinite; }
@keyframes hv-centrar { from { transform: translateX(-75px) } to { transform: translateX(0) } }
@keyframes hv-cerrar-tapa { from { transform: scaleX(1) } to { transform: scaleX(0) } }
@keyframes hv-abrir-hoja { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes hv-sale { 0% { transform: scale(.15); opacity: 0 } 25% { opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes hv-aparece { from { opacity: 0 } to { opacity: 1 } }
@keyframes hv-bandera { 0%,100% { transform: skewY(-6deg) scaleX(1) } 50% { transform: skewY(6deg) scaleX(.85) } }
@keyframes hv-brilla { 0%,100% { transform: scale(.55) rotate(0); opacity: .35 } 50% { transform: scale(1.1) rotate(20deg); opacity: 1 } }
@keyframes hv-chispa { 0% { transform: translate(0,0) scale(.4); opacity: 0 } 15% { opacity: 1 } 100% { transform: translate(var(--dx), -170px) scale(1); opacity: 0 } }
@keyframes hv-nube { 0%,100% { transform: translateX(0) } 50% { transform: translateX(16px) } }
@keyframes hv-flota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes hv-ventana { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .hv-libro, .hv-hoja-izq, .hv-sale, .hv-aparece, .hv-bandera, .hv-brilla, .hv-nube, .hv-flota, .hv-ventana { animation: none; opacity: 1 }
  .hv-tapa { animation: none; transform: scaleX(0) }
  .hv-chispa { animation: none; opacity: 0 }
}
`

const ESTRELLAS = [
  { x: 40, y: 56, r: 10, d: '0s' }, { x: 382, y: 50, r: 8, d: '.9s' }, { x: 26, y: 190, r: 6, d: '1.6s' },
  { x: 392, y: 174, r: 6, d: '.4s' }, { x: 380, y: 300, r: 5, d: '2s' }, { x: 34, y: 300, r: 5, d: '1.2s' },
  { x: 210, y: 18, r: 7, d: '.6s' },
]

const CHISPAS = [
  { x: 150, dx: '-26px', d: '2.4s', c: '#FFC93C' }, { x: 182, dx: '-10px', d: '3.4s', c: '#ffffff' },
  { x: 208, dx: '4px', d: '2.8s', c: '#FFC93C' }, { x: 236, dx: '18px', d: '4.1s', c: '#1BB5A6' },
  { x: 266, dx: '30px', d: '3s', c: '#FFC93C' }, { x: 170, dx: '-36px', d: '4.8s', c: '#FF6F61' },
]

function estrella(r) {
  const p = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    p.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`)
  }
  return p.join(' ')
}

function Torre({ x, base, ancho, alto, cuerpo, techo, bandera, retraso }) {
  const arriba = base - alto
  const punta = arriba - ancho * 1.25
  return (
    <g>
      <rect x={x - ancho / 2} y={arriba} width={ancho} height={alto} rx="4" fill={cuerpo} />
      <rect x={x - ancho / 2} y={arriba} width={ancho * 0.28} height={alto} fill="#ffffff" opacity=".18" />
      <path d={`M${x - ancho / 2 - 6} ${arriba + 2} L${x} ${punta} L${x + ancho / 2 + 6} ${arriba + 2} Z`} fill={techo} />
      <path d={`M${x} ${punta} L${x + ancho / 2 + 6} ${arriba + 2} L${x} ${arriba + 2} Z`} fill="#000" opacity=".1" />
      <path d={`M${x} ${punta} v-18`} stroke="#221A33" strokeWidth="2" strokeLinecap="round" />
      <g transform={`translate(${x} ${punta - 18})`}>
        <path className="hv-bandera" style={{ animationDelay: retraso }} d="M0 0 L20 5 L0 10 Z" fill={bandera} />
      </g>
      <path className="hv-ventana" style={{ animationDelay: retraso }} d={`M${x - 5} ${arriba + alto * 0.45} v-9 a5 5 0 0 1 10 0 v9 z`} fill="#FFC93C" />
    </g>
  )
}

// Renglones de cuento en una hoja
function Renglones({ x1, x2, y }) {
  return (
    <g stroke="#d6c8ee" strokeWidth="3" strokeLinecap="round">
      {[0, 1].map((k) => (
        <path key={k} d={`M${x1} ${y + k * 12} H${k === 1 ? x1 + (x2 - x1) * 0.6 : x2}`} />
      ))}
    </g>
  )
}

export default function EscenaFiesta({ className = '' }) {
  const [vuelta, setVuelta] = useState(0)

  return (
    <svg
      key={vuelta}
      viewBox="0 0 420 380"
      className={`${className} cursor-pointer`}
      role="img"
      aria-label="Libro de cuentos que se abre y del que sale un castillo"
      onClick={() => setVuelta((v) => v + 1)}
    >
      <style>{ESTILOS}</style>
      <defs>
        <radialGradient id="hv-fondo" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#EFE7FB" />
        </radialGradient>
        <radialGradient id="hv-magia" cx="50%" cy="60%" r="55%">
          <stop offset="0" stopColor="#FFC93C" stopOpacity=".5" />
          <stop offset="1" stopColor="#FFC93C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hv-hoja-der" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e6dcf5" />
          <stop offset=".18" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fbf7ff" />
        </linearGradient>
        <linearGradient id="hv-hoja-izq" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e6dcf5" />
          <stop offset=".18" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fbf7ff" />
        </linearGradient>
        <linearGradient id="hv-tapa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a4fc7" />
          <stop offset="1" stopColor="#45207F" />
        </linearGradient>
        <linearGradient id="hv-muro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a63cf" />
          <stop offset="1" stopColor="#5B2EA6" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="420" height="380" rx="40" fill="url(#hv-fondo)" />

      {/* cielo */}
      <g className="hv-aparece">
        <ellipse cx="210" cy="190" rx="190" ry="150" fill="url(#hv-magia)" />
        <g transform="translate(22 96)">
          <g className="hv-nube">
            <path d="M0 20 a14 14 0 0 1 14 -14 a18 18 0 0 1 34 -2 a13 13 0 0 1 14 16 z" fill="#ffffff" />
          </g>
        </g>
        <g transform="translate(336 108)">
          <g className="hv-nube" style={{ animationDelay: '-4s' }}>
            <path d="M0 18 a12 12 0 0 1 12 -12 a16 16 0 0 1 30 -2 a11 11 0 0 1 12 14 z" fill="#ffffff" />
          </g>
        </g>
        {ESTRELLAS.map((e, i) => (
          <g key={i} transform={`translate(${e.x} ${e.y})`}>
            <polygon className="hv-brilla" style={{ animationDelay: e.d }} points={estrella(e.r)} fill="#FFC93C" />
          </g>
        ))}
      </g>

      <ellipse cx="210" cy="352" rx="170" ry="12" fill="#5B2EA6" opacity=".14" />

      {/* libro parado, de frente */}
      <g className="hv-libro">
        {/* contratapa con grosor de hojas */}
        <rect x="210" y="128" width="158" height="216" rx="10" fill="#45207F" />
        <rect x="210" y="132" width="150" height="208" rx="6" fill="#f1eafb" />
        <path d="M360 136 V336 M356 136 V336" stroke="#d6c8ee" strokeWidth="1.5" />
        {/* hoja derecha */}
        <rect x="210" y="132" width="146" height="208" rx="5" fill="url(#hv-hoja-der)" />
        <Renglones x1={232} x2={334} y={316} />

        {/* hoja izquierda: el interior de la tapa, aparece al abrir */}
        <g className="hv-hoja-izq">
          <rect x="52" y="128" width="158" height="216" rx="10" fill="#45207F" />
          <rect x="60" y="132" width="150" height="208" rx="6" fill="#f1eafb" />
          <rect x="64" y="132" width="146" height="208" rx="5" fill="url(#hv-hoja-izq)" />
          <text x="137" y="328" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight="800" fontSize="17" fill="#5B2EA6">Había una vez…</text>
        </g>

        {/* lomo */}
        <rect x="204" y="128" width="12" height="216" rx="4" fill="#3a1a6b" />

        {/* castillo que sale de adentro del libro */}
        <g className="hv-sale">
          <g className="hv-flota">
            <Torre x={152} base={290} ancho={26} alto={86} cuerpo="#7d55c4" techo="#FF6F61" bandera="#FFC93C" retraso=".3s" />
            <Torre x={268} base={290} ancho={26} alto={86} cuerpo="#7d55c4" techo="#FF6F61" bandera="#1BB5A6" retraso=".9s" />
            <Torre x={210} base={290} ancho={36} alto={128} cuerpo="#9b78db" techo="#1BB5A6" bandera="#FF6F61" retraso="0s" />
            <rect x="124" y="226" width="172" height="68" rx="6" fill="url(#hv-muro)" />
            {[128, 151, 174, 197, 220, 243, 266].map((x) => <rect key={x} x={x} y="216" width="15" height="14" rx="3" fill="#8a63cf" />)}
            <Torre x={120} base={294} ancho={30} alto={72} cuerpo="#FFC93C" techo="#5B2EA6" bandera="#FF6F61" retraso="1.4s" />
            <Torre x={300} base={294} ancho={30} alto={72} cuerpo="#FFC93C" techo="#5B2EA6" bandera="#FF6F61" retraso=".6s" />
            <path d="M194 294 v-28 a16 16 0 0 1 32 0 v28 z" fill="#45207F" />
            <path d="M210 250 v44" stroke="#FFC93C" strokeOpacity=".5" strokeWidth="2" />
            {[150, 270].map((x, i) => (
              <path key={x} className="hv-ventana" style={{ animationDelay: `${i * 1.3}s` }} d={`M${x - 5} 266 v-11 a5 5 0 0 1 10 0 v11 z`} fill="#FFC93C" />
            ))}
            {/* pasto del pop-up */}
            <path d="M104 296 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 20 0 q10 -10 22 0 v8 h-202 z" fill="#1BB5A6" />
          </g>
        </g>

        {/* tapa: cerrada al principio, se abre como una puerta */}
        <g className="hv-tapa">
          <rect x="210" y="128" width="158" height="216" rx="10" fill="url(#hv-tapa)" />
          <rect x="222" y="140" width="134" height="192" rx="8" fill="none" stroke="#FFC93C" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" />
          <g transform="translate(289 196)">
            <polygon points={estrella(26)} fill="#FFC93C" />
          </g>
          <text x="289" y="262" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight="800" fontSize="22" fill="#ffffff">Había</text>
          <text x="289" y="286" textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight="800" fontSize="22" fill="#ffffff">una Vez</text>
          <rect x="210" y="128" width="10" height="216" fill="#000" opacity=".15" />
        </g>
      </g>

      {/* chispas que salen del libro */}
      {CHISPAS.map((c, i) => (
        <g key={i} transform={`translate(${c.x} 300)`}>
          <polygon className="hv-chispa" style={{ animationDelay: c.d, '--dx': c.dx }} points={estrella(6)} fill={c.c} />
        </g>
      ))}
    </svg>
  )
}
