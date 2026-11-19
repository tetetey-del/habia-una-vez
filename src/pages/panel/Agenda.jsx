import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { hoyAR, sumarDias, aFecha, hora, fechaCorta, diaSemanaCorto, primeraMayuscula, ESTADOS } from '../../lib/formato'
import { Aviso, Cargando, Encabezado } from '../../components/ui'

const SEMANAS = 4

function inicioDeSemana(iso) {
  // lunes de la semana
  const f = aFecha(iso)
  const dia = (f.getDay() + 6) % 7
  return sumarDias(iso, -dia)
}

export default function Agenda() {
  const [desde, setDesde] = useState(() => inicioDeSemana(hoyAR()))
  const hasta = sumarDias(desde, SEMANAS * 7 - 1)

  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [disp, alquileres, turnos] = await Promise.all([
      consulta(supabase.rpc('disponibilidad', { p_desde: desde, p_hasta: hasta })),
      consulta(
        supabase.from('v_alquileres').select('id, codigo, fecha, turno_id, estado, homenajeado, edad, familia, chicos, adultos')
          .gte('fecha', desde).lte('fecha', hasta).not('estado', 'in', '(vencido,cancelado)'),
      ),
      consulta(supabase.from('turnos').select('*').eq('activo', true).order('hora_inicio')),
    ])
    return { disp, alquileres, turnos }
  }, [desde, hasta])

  const dias = useMemo(() => {
    if (!datos) return []
    const mapa = new Map()
    for (const d of datos.disp) {
      if (!mapa.has(d.fecha)) mapa.set(d.fecha, { fecha: d.fecha, celdas: {} })
      mapa.get(d.fecha).celdas[d.turno_id] = { estado: d.estado }
    }
    for (const a of datos.alquileres) {
      const dia = mapa.get(a.fecha)
      if (dia) dia.celdas[a.turno_id] = { ...dia.celdas[a.turno_id], alquiler: a }
    }
    return [...mapa.values()]
  }, [datos])

  const hoy = hoyAR()

  const Celda = ({ fecha, turno, celda }) => {
    const a = celda?.alquiler
    if (a) {
      const e = ESTADOS[a.estado]
      return (
        <Link to={`/panel/alquileres/${a.id}`} className="block h-full rounded-lg bg-white/95 p-2 text-slate-900 shadow transition hover:-translate-y-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${e.punto}`} /> {a.codigo}
          </span>
          <span className="block truncate font-bold">{a.homenajeado} ({a.edad})</span>
          <span className="block truncate text-xs text-slate-500">{a.familia}</span>
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${e.clase}`}>{e.nombre}</span>
        </Link>
      )
    }
    if (celda?.estado === 'mantenimiento') {
      return (
        <span className="flex h-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-amber-300/60 p-2 text-xs font-bold text-amber-200">
          <Wrench className="h-3.5 w-3.5" /> Bloqueado
        </span>
      )
    }
    if (celda?.estado === 'libre') {
      return (
        <Link
          to={`/panel/alquileres/nuevo?fecha=${fecha}&turno=${turno.id}`}
          className="flex h-full min-h-[72px] items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/25 text-xs font-bold text-white/60 transition hover:border-white/60 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Libre
        </Link>
      )
    }
    return <span className="flex h-full min-h-[72px] items-center justify-center text-xs text-white/30">—</span>
  }

  return (
    <div>
      <Encabezado titulo="Agenda" subtitulo={`Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`}>
        <button onClick={() => setDesde(sumarDias(desde, -7))} className="rounded-lg bg-white p-2 ring-1 ring-slate-200" aria-label="Semana anterior"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={() => setDesde(inicioDeSemana(hoyAR()))} className="rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-slate-200">Hoy</button>
        <button onClick={() => setDesde(sumarDias(desde, 7))} className="rounded-lg bg-white p-2 ring-1 ring-slate-200" aria-label="Semana siguiente"><ChevronRight className="h-5 w-5" /></button>
      </Encabezado>

      <div className="mb-3 hidden flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 md:flex">
        {Object.entries(ESTADOS).filter(([k]) => !['vencido', 'cancelado'].includes(k)).map(([k, e]) => (
          <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${e.punto}`} /> {e.nombre}</span>
        ))}
      </div>

      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <>
        {/* Celular: lista compacta por día */}
        <ul className="space-y-2 md:hidden">
          {dias.map((d) => (
            <li key={d.fecha} className={`panel-tarjeta overflow-hidden ${d.fecha === hoy ? 'ring-2 ring-amarillo' : ''}`}>
              <p className="flex items-center justify-between bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                <span>{primeraMayuscula(diaSemanaCorto(d.fecha))} {fechaCorta(d.fecha)}</span>
                {aFecha(d.fecha).getDay() > 0 && aFecha(d.fecha).getDay() < 6 && <span className="text-xs font-semibold text-amarillo">Feriado</span>}
              </p>
              <ul className="divide-y divide-slate-100">
                {datos.turnos.map((t) => {
                  const c = d.celdas[t.id]
                  const a = c?.alquiler
                  const contenido = (
                    <>
                      <span className="num w-12 shrink-0 text-sm font-bold text-slate-500">{hora(t.hora_inicio)}</span>
                      {a ? (
                        <>
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTADOS[a.estado].punto}`} />
                          <span className="min-w-0 flex-1 truncate text-sm"><strong>{a.homenajeado}</strong> · {a.familia}</span>
                          <span className="shrink-0 text-xs font-semibold text-slate-500">{ESTADOS[a.estado].nombre}</span>
                        </>
                      ) : c?.estado === 'libre' ? (
                        <span className="flex-1 text-sm font-semibold text-emerald-700">Libre · cargar</span>
                      ) : c?.estado === 'mantenimiento' ? (
                        <span className="flex flex-1 items-center gap-1 text-sm font-semibold text-amber-700"><Wrench className="h-3.5 w-3.5" /> Bloqueado</span>
                      ) : (
                        <span className="flex-1 text-sm text-slate-300">—</span>
                      )}
                    </>
                  )
                  const destino = a ? `/panel/alquileres/${a.id}` : c?.estado === 'libre' ? `/panel/alquileres/nuevo?fecha=${d.fecha}&turno=${t.id}` : null
                  return (
                    <li key={t.id}>
                      {destino ? (
                        <Link to={destino} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">{contenido}</Link>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2">{contenido}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
        {/* Compu: pizarrón */}
        <div className="pizarron hidden overflow-x-auto rounded-2xl border-8 border-[#7a5a3a] p-3 shadow-inner md:block">
          <table className="w-full min-w-[720px] border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="w-20" />
                {dias.map((d) => (
                  <th key={d.fecha} className={`min-w-[150px] rounded-lg px-2 py-1.5 text-left font-titulo text-white ${d.fecha === hoy ? 'bg-amarillo/90 text-slate-900' : 'bg-white/10'}`}>
                    <span className="block text-sm font-bold">{primeraMayuscula(diaSemanaCorto(d.fecha))} {fechaCorta(d.fecha)}</span>
                    {aFecha(d.fecha).getDay() > 0 && aFecha(d.fecha).getDay() < 6 && <span className="block text-[11px] font-semibold opacity-80">Feriado</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.turnos.map((t) => (
                <tr key={t.id}>
                  <th className="align-top font-titulo text-white">
                    <span className="num block text-lg font-bold">{hora(t.hora_inicio)}</span>
                    <span className="block text-[11px] text-white/60">{t.nombre}</span>
                  </th>
                  {dias.map((d) => (
                    <td key={d.fecha} className="h-24 align-top">
                      <Celda fecha={d.fecha} turno={t} celda={d.celdas[t.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
