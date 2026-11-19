import { useState } from 'react'

// Ilustración propia de la portada: un libro de cuentos que se abre y del que
// sale un castillo. Después quedan banderines al viento, ventanas que se
// encienden, chispas mágicas, estrellas que brillan y nubes que pasan.
// Tocando el dibujo se repite la apertura. Cada pieza se ubica con un <g>
// exterior y se anima en uno interior, así la animación no pisa su posición.
// Si el teléfono pide reducir el movimiento, se muestra el libro ya abierto y quieto.

const ESTILOS = `
.hv-tapa-izq { transform-origin: 100% 50%; transform-box: fill-box; animation: hv-abrir 1s cubic-bezier(.3,.7,.3,1) both; }
.hv-tapa-der { transform-origin: 0% 50%; transform-box: fill-box; animation: hv-abrir 1s cubic-bezier(.3,.7,.3,1) both; }
.hv-sale { transform-origin: 50% 100%; transform-box: fill-box; animation: hv-sale 1.1s cubic-bezier(.2,1.4,.4,1) .9s both; }
.hv-aparece { animation: hv-aparece .8s ease-out 1.6s both; }
.hv-bandera { transform-origin: 0 50%; transform-box: fill-box; animation: hv-bandera 1.8s ease-in-out infinite; }
.hv-brilla { transform-origin: 50% 50%; transform-box: fill-box; animation: hv-brilla 2.6s ease-in-out infinite; }
.hv-chispa { transform-box: fill-box; opacity: 0; animation: hv-chispa 3.6s ease-out infinite; }
.hv-nube { animation: hv-nube 9s ease-in-out infinite; }
.hv-flota { animation: hv-flota 5s ease-in-out 2s infinite; }
.hv-ventana { animation: hv-ventana 3s ease-in-out infinite; }
@keyframes hv-abrir { 0% { transform: scaleX(0) } 100% { transform: scaleX(1) } }
@keyframes hv-sale { 0% { transform: translateY(40px) scaleY(0); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateY(0) scaleY(1); opacity: 1 } }
@keyframes hv-aparece { from { opacity: 0 } to { opacity: 1 } }
@keyframes hv-bandera { 0%,100% { transform: skewY(-6deg) scaleX(1) } 50% { transform: skewY(6deg) scaleX(.85) } }
@keyframes hv-brilla { 0%,100% { transform: scale(.55) rotate(0); opacity: .35 } 50% { transform: scale(1.1) rotate(20deg); opacity: 1 } }
@keyframes hv-chispa { 0% { transform: translate(0,0) scale(.4); opacity: 0 } 15% { opacity: 1 } 100% { transform: translate(var(--dx), -150px) scale(1); opacity: 0 } }
@keyframes hv-nube { 0%,100% { transform: translateX(0) } 50% { transform: translateX(18px) } }
@keyframes hv-flota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes hv-ventana { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .hv-tapa-izq, .hv-tapa-der, .hv-sale, .hv-aparece, .hv-bandera, .hv-brilla, .hv-nube, .hv-flota, .hv-ventana { animation: none; opacity: 1 }
  .hv-chispa { animation: none; opacity: 0 }
}
`

const ESTRELLAS = [
  { x: 56, y: 64, r: 10, d: '0s' }, { x: 362, y: 54, r: 8, d: '.9s' }, { x: 330, y: 140, r: 5, d: '1.6s' },
  { x: 86, y: 160, r: 6, d: '1.2s' }, { x: 388, y: 206, r: 6, d: '.4s' }, { x: 30, y: 224, r: 5, d: '2s' },
  { x: 210, y: 22, r: 7, d: '.6s' },
]

const CHISPAS = [
  { x: 150, dx: '-30px', d: '2s', c: '#FFC93C' }, { x: 180, dx: '-12px', d: '3.2s', c: '#ffffff' },
  { x: 205, dx: '6px', d: '2.5s', c: '#FFC93C' }, { x: 232, dx: '22px', d: '4s', c: '#1BB5A6' },
  { x: 262, dx: '34px', d: '2.9s', c: '#FFC93C' }, { x: 168, dx: '-40px', d: '4.6s', c: '#FF6F61' },
  { x: 250, dx: '40px', d: '5s', c: '#ffffff' },
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

// Torre con techo cónico, banderín y ventana
function Torre({ x, base, ancho, alto, cuerpo, techo, bandera, retraso }) {
  const arriba = base - alto
  const punta = arriba - ancho * 1.25
  return (
    <g>
      <rect x={x - ancho / 2} y={arriba} width={ancho} height={alto} rx="4" fill={cuerpo} />
      <rect x={x - ancho / 2} y={arriba} width={ancho * 0.28} height={alto} fill="#ffffff" opacity=".18" />
      <path d={`M${x - ancho / 2 - 6} ${arriba + 2} L${x} ${punta} L${x + ancho / 2 + 6} ${arriba + 2} Z`} fill={techo} />
      <path d={`M${x} ${punta} L${x + ancho / 2 + 6} ${arriba + 2} L${x} ${arriba + 2} Z`} fill="#000" opacity=".1" />
      <path d={`M${x} ${punta} v-20`} stroke="#221A33" strokeWidth="2" strokeLinecap="round" />
      <g transform={`translate(${x} ${punta - 20})`}>
        <path className="hv-bandera" style={{ animationDelay: retraso }} d="M0 0 L22 5 L0 11 Z" fill={bandera} />
      </g>
      <path className="hv-ventana" style={{ animationDelay: retraso }} d={`M${x - 6} ${arriba + alto * 0.42} v-10 a6 6 0 0 1 12 0 v10 z`} fill="#FFC93C" />
    </g>
  )
}

export default function EscenaFiesta({ className = '' }) {
  // Cambiar la clave vuelve a montar el dibujo y repite la apertura
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
        <radialGradient id="hv-magia" cx="50%" cy="80%" r="60%">
          <stop offset="0" stopColor="#FFC93C" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFC93C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hv-pagina-izq" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e9e1f5" />
          <stop offset=".25" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fbf7ff" />
        </linearGradient>
        <linearGradient id="hv-pagina-der" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9e1f5" />
          <stop offset=".25" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fbf7ff" />
        </linearGradient>
        <linearGradient id="hv-muro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a63cf" />
          <stop offset="1" stopColor="#5B2EA6" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="420" height="380" rx="40" fill="url(#hv-fondo)" />

      {/* cielo: nubes y estrellas */}
      <g className="hv-aparece">
        <g transform="translate(46 112)">
          <g className="hv-nube">
            <path d="M0 20 a14 14 0 0 1 14 -14 a18 18 0 0 1 34 -2 a13 13 0 0 1 14 16 z" fill="#ffffff" />
          </g>
        </g>
        <g transform="translate(302 92)">
          <g className="hv-nube" style={{ animationDelay: '-4s' }}>
            <path d="M0 18 a12 12 0 0 1 12 -12 a16 16 0 0 1 30 -2 a11 11 0 0 1 12 14 z" fill="#ffffff" />
          </g>
        </g>
        {ESTRELLAS.map((e, i) => (
          <g key={i} transform={`translate(${e.x} ${e.y})`}>
            <polygon className="hv-brilla" style={{ animationDelay: e.d }} points={estrella(e.r)} fill="#FFC93C" />
          </g>
        ))}
        <ellipse cx="210" cy="250" rx="170" ry="120" fill="url(#hv-magia)" />
      </g>

      {/* castillo que sale del libro */}
      <g className="hv-sale">
        <g className="hv-flota">
          <Torre x={150} base={262} ancho={30} alto={96} cuerpo="#7d55c4" techo="#FF6F61" bandera="#FFC93C" retraso=".3s" />
          <Torre x={270} base={262} ancho={30} alto={96} cuerpo="#7d55c4" techo="#FF6F61" bandera="#1BB5A6" retraso=".9s" />
          <Torre x={210} base={262} ancho={40} alto={140} cuerpo="#9b78db" techo="#1BB5A6" bandera="#FF6F61" retraso="0s" />
          <rect x="120" y="198" width="180" height="70" rx="6" fill="url(#hv-muro)" />
          {[124, 148, 172, 196, 220, 244, 268].map((x) => <rect key={x} x={x} y="188" width="16" height="14" rx="3" fill="#8a63cf" />)}
          <Torre x={116} base={268} ancho={34} alto={80} cuerpo="#FFC93C" techo="#5B2EA6" bandera="#FF6F61" retraso="1.4s" />
          <Torre x={304} base={268} ancho={34} alto={80} cuerpo="#FFC93C" techo="#5B2EA6" bandera="#FF6F61" retraso=".6s" />
          <path d="M192 268 v-30 a18 18 0 0 1 36 0 v30 z" fill="#45207F" />
          <path d="M210 220 v48" stroke="#FFC93C" strokeOpacity=".5" strokeWidth="2" />
          <circle cx="203" cy="250" r="2" fill="#FFC93C" />
          <circle cx="217" cy="250" r="2" fill="#FFC93C" />
          {[146, 274].map((x, i) => (
            <path key={x} className="hv-ventana" style={{ animationDelay: `${i * 1.3}s` }} d={`M${x - 6} 240 v-12 a6 6 0 0 1 12 0 v12 z`} fill="#FFC93C" />
          ))}
        </g>
      </g>

      {/* chispas que suben del libro */}
      {CHISPAS.map((c, i) => (
        <g key={i} transform={`translate(${c.x} 272)`}>
          <polygon className="hv-chispa" style={{ animationDelay: c.d, '--dx': c.dx }} points={estrella(6)} fill={c.c} />
        </g>
      ))}

      {/* libro: se abre desde el lomo */}
      <ellipse cx="210" cy="346" rx="176" ry="14" fill="#5B2EA6" opacity=".14" />
      <g className="hv-tapa-izq">
        <path d="M22 286 Q110 262 206 288 L206 344 Q110 318 22 342 Z" fill="#5B2EA6" />
        <path d="M30 276 Q116 250 208 278 L208 336 Q116 308 30 332 Z" fill="url(#hv-pagina-izq)" />
        <path d="M30 332 Q116 308 208 336 M30 327 Q116 303 208 331" stroke="#d9cdef" strokeWidth="1.5" fill="none" />
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={`M58 ${292 + k * 9} Q118 ${274 + k * 9} ${178 - (k === 3 ? 40 : 0)} ${290 + k * 9}`} stroke="#cbbbe6" strokeWidth="3" strokeLinecap="round" fill="none" />
        ))}
      </g>
      <g className="hv-tapa-der">
        <path d="M398 286 Q310 262 214 288 L214 344 Q310 318 398 342 Z" fill="#5B2EA6" />
        <path d="M390 276 Q304 250 212 278 L212 336 Q304 308 390 332 Z" fill="url(#hv-pagina-der)" />
        <path d="M390 332 Q304 308 212 336 M390 327 Q304 303 212 331" stroke="#d9cdef" strokeWidth="1.5" fill="none" />
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={`M362 ${292 + k * 9} Q302 ${274 + k * 9} ${242 + (k === 3 ? 40 : 0)} ${290 + k * 9}`} stroke="#cbbbe6" strokeWidth="3" strokeLinecap="round" fill="none" />
        ))}
      </g>
      <path d="M206 280 Q210 284 214 280 L214 340 Q210 344 206 340 Z" fill="#45207F" />
    </svg>
  )
}
