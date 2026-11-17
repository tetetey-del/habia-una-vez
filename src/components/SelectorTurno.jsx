import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react'
import { supabase, mensajeError } from '../lib/supabase'
import { useCarga } from '../lib/datos'
import { hoyAR, aFecha, isoDe, hora, diaSemanaCorto, primeraMayuscula, sumarDias } from '../lib/formato'
import { Aviso, Cargando, Vacio } from './ui'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function mesDe(iso) {
  const f = aFecha(iso)
  return { anio: f.getFullYear(), mes: f.getMonth() }
}

/**
 * Grilla de disponibilidad por mes: cada día que abre el salón con sus turnos.
 * variante "publico" (familias) o "panel" (equipo).
 */
export default function SelectorTurno({ seleccion, onElegir, variante = 'publico', excluir }) {
  const hoy = hoyAR()
  const [{ anio, mes }, setMes] = useState(() => mesDe(seleccion?.fecha || sumarDias(hoy, 1)))

  const desde = isoDe(new Date(anio, mes, 1, 12))
  const hasta = isoDe(new Date(anio, mes + 1, 0, 12))

  const { datos, error, cargando, recargar } = useCarga(async () => {
    const { data, error: e } = await supabase.rpc('disponibilidad', { p_desde: desde, p_hasta: hasta })
    if (e) throw new Error(mensajeError(e))
    return data
  }, [desde, hasta])

  const dias = useMemo(() => {
    const mapa = new Map()
    for (const t of datos || []) {
      if (!mapa.has(t.fecha)) mapa.set(t.fecha, { fecha: t.fecha, tipo_dia: t.tipo_dia, turnos: [] })
      mapa.get(t.fecha).turnos.push(t)
    }
    return [...mapa.values()].filter((d) => d.fecha > hoy)
  }, [datos, hoy])

  const mesActual = mesDe(hoy)
  const puedeVolver = anio > mesActual.anio || (anio === mesActual.anio && mes > mesActual.mes)
  const cambiarMes = (delta) => setMes(({ anio: a, mes: m }) => {
    const f = new Date(a, m + delta, 1)
    return { anio: f.getFullYear(), mes: f.getMonth() }
  })

  const publico = variante === 'publico'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          disabled={!puedeVolver}
          className={`rounded-full p-2 disabled:opacity-30 ${publico ? 'bg-violeta-claro text-violeta' : 'bg-slate-100 text-slate-700'}`}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className={`text-lg font-bold capitalize ${publico ? 'font-titulo text-violeta' : ''}`}>
          {MESES[mes]} {anio}
        </p>
        <button
          type="button"
          onClick={() => cambiarMes(1)}
          className={`rounded-full p-2 ${publico ? 'bg-violeta-claro text-violeta' : 'bg-slate-100 text-slate-700'}`}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {publico && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs font-semibold text-tinta-suave">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-turquesa" /> Libre</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-tinta/20" /> Ocupado</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amarillo" /> En arreglo</span>
        </div>
      )}

      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando texto="Buscando turnos…" />
      ) : dias.length === 0 ? (
        <Vacio titulo="No quedan días este mes">Probá con el mes siguiente.</Vacio>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {dias.map((d) => (
            <li key={d.fecha} className={publico ? 'tarjeta p-3' : 'panel-tarjeta p-3'}>
              <p className="mb-2 flex items-baseline gap-2">
                <span className={`font-bold ${publico ? 'font-titulo text-lg' : ''}`}>
                  {primeraMayuscula(diaSemanaCorto(d.fecha))} {aFecha(d.fecha).getDate()}
                </span>
                {d.tipo_dia === 'domingo_feriado' && aFecha(d.fecha).getDay() !== 0 && (
                  <span className="rounded-full bg-coral-claro px-2 py-0.5 text-[11px] font-bold text-coral">Feriado</span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {d.turnos.map((t) => {
                  const esExcluido = excluir && excluir.fecha === t.fecha && excluir.turno_id === t.turno_id
                  const libre = t.estado === 'libre' && !esExcluido
                  const elegido = seleccion && seleccion.fecha === t.fecha && seleccion.turno_id === t.turno_id
                  const base = 'flex min-h-[52px] flex-col items-center justify-center rounded-xl text-sm font-bold transition'
                  let clase
                  if (elegido) clase = 'bg-violeta text-white ring-4 ring-violeta/25'
                  else if (libre) clase = publico ? 'bg-turquesa-claro text-teal-900 hover:bg-turquesa hover:text-white' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100'
                  else if (t.estado === 'mantenimiento') clase = 'bg-amarillo-claro text-amber-800 cursor-not-allowed'
                  else clase = 'bg-tinta/5 text-tinta/35 cursor-not-allowed'
                  return (
                    <button
                      key={t.turno_id}
                      type="button"
                      disabled={!libre}
                      onClick={() => onElegir({ fecha: t.fecha, turno_id: t.turno_id, turno: t.turno, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin, tipo_dia: t.tipo_dia })}
                      className={`${base} ${clase}`}
                      aria-label={`${d.fecha} ${hora(t.hora_inicio)} ${libre ? 'libre' : t.estado}`}
                    >
                      <span className="num">{hora(t.hora_inicio)}</span>
                      <span className="text-[11px] font-semibold opacity-80">
                        {elegido ? 'Elegido' : libre ? 'Libre' : t.estado === 'mantenimiento' ? <Wrench className="mx-auto h-3 w-3" /> : 'Ocupado'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
