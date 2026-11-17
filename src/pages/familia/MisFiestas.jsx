import { Link } from 'react-router-dom'
import { PartyPopper, ChevronRight, CalendarPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { fechaLarga, hora, hoyAR, primeraMayuscula } from '../../lib/formato'
import { Aviso, Cargando, EstadoAlquiler, Vacio } from '../../components/ui'

// Qué tiene que hacer la familia según el estado
function pendiente(a) {
  if (a.estado === 'en_riesgo') return 'Elegí cómo seguimos'
  if (a.estado === 'pre_reserva') return 'Falta la seña'
  if (a.estado === 'senado') return 'Aceptá el contrato'
  if (a.estado === 'contrato_aceptado' && a.saldo > 0) return 'Queda saldo por pagar'
  return ''
}

export default function MisFiestas() {
  const { datos, error, cargando, recargar } = useCarga(() =>
    consulta(supabase.from('v_alquileres').select('id, codigo, fecha, hora_inicio, hora_fin, estado, homenajeado, edad, saldo').order('fecha')),
  )
  const hoy = hoyAR()
  const proximas = (datos || []).filter((a) => a.fecha >= hoy && !['vencido', 'cancelado', 'cerrado'].includes(a.estado))
  const anteriores = (datos || []).filter((a) => !proximas.includes(a)).reverse()

  const Tarjeta = ({ a }) => {
    const tarea = pendiente(a)
    return (
      <Link to={`/mis-fiestas/${a.id}`} className={`tarjeta flex items-center gap-3 p-4 transition hover:shadow-globo ${a.estado === 'en_riesgo' ? 'ring-2 ring-coral' : ''}`}>
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-violeta-claro text-violeta">
          <span className="font-titulo text-2xl font-extrabold leading-none">{Number(a.fecha.slice(8, 10))}</span>
          <span className="text-[11px] font-bold uppercase">{new Date(a.fecha + 'T12:00').toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-titulo text-lg font-bold">Cumple de {a.homenajeado}</span>
          <span className="block text-sm text-tinta-suave">{primeraMayuscula(fechaLarga(a.fecha))} · {hora(a.hora_inicio)} h</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <EstadoAlquiler estado={a.estado} familia />
            {tarea && <span className="text-xs font-bold text-coral">{tarea}</span>}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-tinta-suave" />
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-violeta">Mis fiestas</h1>
        <Link to="/fechas" className="inline-flex items-center gap-1.5 rounded-xl bg-amarillo px-3 py-2 text-sm font-bold">
          <CalendarPlus className="h-4 w-4" /> Nueva
        </Link>
      </div>
      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : datos?.length === 0 ? (
        <Vacio titulo="Todavía no tenés fiestas" icono={PartyPopper}>
          <Link to="/fechas" className="font-bold text-violeta underline">Elegí tu fecha</Link> y armamos la primera.
        </Vacio>
      ) : (
        <>
          {proximas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-tinta-suave">Próximas</h2>
              {proximas.map((a) => <Tarjeta key={a.id} a={a} />)}
            </section>
          )}
          {anteriores.length > 0 && (
            <section className="mt-8 space-y-3">
              <h2 className="text-lg font-bold text-tinta-suave">Anteriores</h2>
              {anteriores.map((a) => <Tarjeta key={a.id} a={a} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}
