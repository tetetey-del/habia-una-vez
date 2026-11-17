import { useEffect } from 'react'
import { X, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react'
import { ESTADOS, ORDEN_ESTADO, PRIORIDAD, JUEGO_ESTADO } from '../lib/formato'

// ---------- Botones ----------
const VARIANTES = {
  primario: 'bg-violeta text-white hover:bg-violeta-oscuro shadow-sm',
  amarillo: 'bg-amarillo text-tinta hover:brightness-95 shadow-sm',
  secundario: 'bg-white text-tinta ring-1 ring-tinta/15 hover:bg-tinta/5',
  peligro: 'bg-red-600 text-white hover:bg-red-700',
  turquesa: 'bg-turquesa text-white hover:brightness-95',
  fantasma: 'text-violeta hover:bg-violeta/10',
  oscuro: 'bg-slate-900 text-white hover:bg-slate-800',
}

export function Boton({ variante = 'primario', tamano = 'md', cargando, icono: Icono, className = '', children, ...props }) {
  const tamanos = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5', lg: 'px-6 py-3.5 text-lg' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${tamanos[tamano]} ${className}`}
      disabled={cargando || props.disabled}
      {...props}
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : Icono ? <Icono className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}

// ---------- Chips de estado ----------
function Chip({ clase, children, grande }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full font-bold ring-1 ring-inset ${grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'} ${clase}`}>
      {children}
    </span>
  )
}

export const EstadoAlquiler = ({ estado, familia, grande }) => {
  const e = ESTADOS[estado] || { nombre: estado, clase: 'bg-slate-100' }
  return <Chip clase={e.clase} grande={grande}>{familia ? e.familia : e.nombre}</Chip>
}
export const EstadoOrden = ({ estado }) => <Chip clase={ORDEN_ESTADO[estado]?.clase}>{ORDEN_ESTADO[estado]?.nombre || estado}</Chip>
export const Prioridad = ({ prioridad }) => <Chip clase={PRIORIDAD[prioridad]?.clase}>{PRIORIDAD[prioridad]?.nombre || prioridad}</Chip>
export const EstadoJuego = ({ estado }) => <Chip clase={JUEGO_ESTADO[estado]?.clase}>{JUEGO_ESTADO[estado]?.nombre || estado}</Chip>

// ---------- Avisos ----------
const AVISOS = {
  error: { clase: 'bg-red-50 text-red-900 ring-red-200', icono: AlertTriangle },
  exito: { clase: 'bg-emerald-50 text-emerald-900 ring-emerald-200', icono: CheckCircle2 },
  info: { clase: 'bg-violeta-claro text-violeta-oscuro ring-violeta/20', icono: Info },
  alerta: { clase: 'bg-amber-50 text-amber-900 ring-amber-200', icono: AlertTriangle },
}

export function Aviso({ tipo = 'info', titulo, children, onActualizar, className = '' }) {
  const { clase, icono: Icono } = AVISOS[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl p-3 ring-1 ${clase} ${className}`}>
      <Icono className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {titulo && <p className="font-bold">{titulo}</p>}
        {children && <div>{children}</div>}
        {onActualizar && (
          <button onClick={onActualizar} className="mt-2 inline-flex items-center gap-1 font-bold underline underline-offset-2">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar datos
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierto) return
    const tecla = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-lg p-1 text-tinta-suave hover:bg-tinta/5" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Estados de carga ----------
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-tinta-suave">
      <Loader2 className="h-5 w-5 animate-spin" /> {texto}
    </div>
  )
}

export function Vacio({ titulo, children, icono: Icono }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tinta/10 px-6 py-10 text-center">
      {Icono && <Icono className="h-8 w-8 text-tinta-suave/60" />}
      <p className="font-bold">{titulo}</p>
      {children && <div className="text-sm text-tinta-suave">{children}</div>}
    </div>
  )
}

// ---------- Formularios ----------
export function Campo({ etiqueta, ayuda, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {etiqueta && <span className="etiqueta">{etiqueta}</span>}
      {children}
      {ayuda && !error && <span className="mt-1 block text-xs text-tinta-suave">{ayuda}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-red-700">{error}</span>}
    </label>
  )
}

export function Contador({ valor, onCambiar, min = 0, max = 99, etiqueta }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onCambiar(Math.max(min, valor - 1))}
        className="h-11 w-11 rounded-xl bg-violeta-claro text-2xl font-bold text-violeta disabled:opacity-40"
        disabled={valor <= min}
        aria-label={`Restar ${etiqueta}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="campo num w-16 text-center text-lg font-bold"
        value={valor}
        min={min}
        max={max}
        aria-label={etiqueta}
        onChange={(e) => onCambiar(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
      <button
        type="button"
        onClick={() => onCambiar(Math.min(max, valor + 1))}
        className="h-11 w-11 rounded-xl bg-violeta-claro text-2xl font-bold text-violeta disabled:opacity-40"
        disabled={valor >= max}
        aria-label={`Sumar ${etiqueta}`}
      >
        +
      </button>
    </div>
  )
}

// ---------- Panel: encabezado de página ----------
export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

// Fila de dato etiqueta/valor
export function Dato({ etiqueta, children, fuerte }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-slate-500">{etiqueta}</dt>
      <dd className={`num text-right ${fuerte ? 'text-lg font-extrabold' : 'font-semibold'}`}>{children}</dd>
    </div>
  )
}
