// ---------- Dinero ----------
const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const pesos = (n) => formatoPesos.format(Math.round(Number(n || 0)))

// ---------- Fechas (todo en hora de Argentina) ----------
const ZONA = 'America/Argentina/Buenos_Aires'

export function hoyAR() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return partes // AAAA-MM-DD
}

export function aFecha(iso) {
  // '2026-11-21' → Date local al mediodía (evita corrimientos de zona)
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d, 12)
}

export function sumarDias(iso, dias) {
  const f = aFecha(iso)
  f.setDate(f.getDate() + dias)
  return isoDe(f)
}

export function isoDe(fecha) {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export function diasEntre(desdeIso, hastaIso) {
  return Math.round((aFecha(hastaIso) - aFecha(desdeIso)) / 86400000)
}

export const fechaLarga = (iso) =>
  aFecha(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

export const fechaLargaAnio = (iso) =>
  aFecha(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const fechaCorta = (iso) => aFecha(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

export const diaSemanaCorto = (iso) =>
  aFecha(iso).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')

export const fechaHora = (ts) =>
  ts
    ? new Date(ts).toLocaleString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

export const fechaDeTs = (ts) =>
  ts ? new Date(ts).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: '2-digit' }) : ''

export const hora = (t) => (t ? String(t).slice(0, 5) : '')

export const recibo = (n) => (n ? String(n).padStart(4, '0') : '')

export function primeraMayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : ''
}

// ---------- Estados del alquiler ----------
// panel: colores bien distintos para leer el tablero de un vistazo
export const ESTADOS = {
  pre_reserva: { nombre: 'Pre-reserva', familia: 'Esperando la seña', clase: 'bg-amber-100 text-amber-900 ring-amber-300', punto: 'bg-amber-400' },
  senado: { nombre: 'Señado', familia: 'Seña recibida', clase: 'bg-sky-100 text-sky-900 ring-sky-300', punto: 'bg-sky-500' },
  contrato_aceptado: { nombre: 'Contrato aceptado', familia: 'Turno firme', clase: 'bg-indigo-100 text-indigo-900 ring-indigo-300', punto: 'bg-indigo-500' },
  saldo_pagado: { nombre: 'Saldo pagado', familia: 'Todo pago', clase: 'bg-emerald-100 text-emerald-900 ring-emerald-300', punto: 'bg-emerald-500' },
  en_curso: { nombre: 'En curso', familia: '¡Es hoy!', clase: 'bg-teal-500 text-white ring-teal-600', punto: 'bg-teal-500' },
  realizado: { nombre: 'Realizado', familia: 'Fiesta realizada', clase: 'bg-violet-100 text-violet-900 ring-violet-300', punto: 'bg-violet-500' },
  cerrado: { nombre: 'Cerrado', familia: 'Cerrado', clase: 'bg-slate-200 text-slate-700 ring-slate-300', punto: 'bg-slate-400' },
  en_riesgo: { nombre: 'En riesgo', familia: 'Necesitamos que elijas', clase: 'bg-red-600 text-white ring-red-700', punto: 'bg-red-600' },
  vencido: { nombre: 'Vencido', familia: 'Venció', clase: 'bg-stone-100 text-stone-500 ring-stone-200 line-through', punto: 'bg-stone-300' },
  cancelado: { nombre: 'Cancelado', familia: 'Cancelado', clase: 'bg-rose-50 text-rose-700 ring-rose-200', punto: 'bg-rose-300' },
}

export const ORDEN_ESTADOS = ['pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado', 'en_curso', 'realizado', 'cerrado', 'en_riesgo', 'vencido', 'cancelado']

// Estados que todavía ocupan el turno
export const OCUPAN = ['pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado', 'en_curso', 'realizado', 'cerrado', 'en_riesgo']

// ---------- Órdenes de mantenimiento ----------
export const ORDEN_ESTADO = {
  abierta: { nombre: 'Abierta', clase: 'bg-amber-100 text-amber-900 ring-amber-300' },
  en_curso: { nombre: 'En curso', clase: 'bg-sky-100 text-sky-900 ring-sky-300' },
  esperando_repuesto: { nombre: 'Esperando repuesto', clase: 'bg-orange-100 text-orange-900 ring-orange-300' },
  resuelta: { nombre: 'Resuelta', clase: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
  verificada: { nombre: 'Verificada', clase: 'bg-slate-200 text-slate-700 ring-slate-300' },
}

export const PRIORIDAD = {
  baja: { nombre: 'Baja', clase: 'bg-slate-100 text-slate-700 ring-slate-300' },
  media: { nombre: 'Media', clase: 'bg-yellow-100 text-yellow-900 ring-yellow-300' },
  critica: { nombre: 'Crítica', clase: 'bg-red-600 text-white ring-red-700' },
  cierre_salon: { nombre: 'Cierre del salón', clase: 'bg-black text-white ring-black' },
}

export const JUEGO_ESTADO = {
  operativo: { nombre: 'Operativo', clase: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
  en_reparacion: { nombre: 'En reparación', clase: 'bg-amber-100 text-amber-900 ring-amber-300' },
  fuera_de_servicio: { nombre: 'Fuera de servicio', clase: 'bg-red-600 text-white ring-red-700' },
}

export const TIPO_MOVIMIENTO = {
  sena: 'Seña',
  saldo: 'Saldo',
  garantia: 'Garantía',
  recargo: 'Recargo',
  compensacion: 'Compensación',
  devolucion: 'Devolución',
  devolucion_garantia: 'Devolución de garantía',
}

export const MEDIOS = ['Efectivo', 'Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito']

export const TIPO_DIA = { sabado: 'Sábado', domingo_feriado: 'Domingo o feriado' }

export const ROLES = {
  admin: 'Administración',
  coordinacion: 'Coordinación',
  mantenimiento: 'Mantenimiento',
  familia: 'Familia',
}

export const CHECKLIST = [
  { clave: 'recibir', texto: 'Recibir a la familia y mostrar el salón' },
  { clave: 'juegos_inicio', texto: 'Revisar juegos antes de abrir' },
  { clave: 'conteo', texto: 'Contar chicos y adultos al ingreso' },
  { clave: 'torta', texto: 'Ubicar torta, piñata y adicionales' },
  { clave: 'cocina', texto: 'Dejar la cocina limpia' },
  { clave: 'juegos_cierre', texto: 'Revisar juegos al cierre' },
]
