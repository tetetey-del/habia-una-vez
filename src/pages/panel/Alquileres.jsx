import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { pesos, hora, fechaCorta, diaSemanaCorto, primeraMayuscula, ESTADOS, ORDEN_ESTADOS, hoyAR } from '../../lib/formato'
import { Aviso, Cargando, Encabezado, EstadoAlquiler, Vacio } from '../../components/ui'

const PERIODOS = { proximos: 'Próximos', pasados: 'Pasados', todos: 'Todos' }

export default function Alquileres() {
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') || ''
  const periodo = params.get('periodo') || (estado ? 'todos' : 'proximos')
  const [busqueda, setBusqueda] = useState('')

  const { datos, error, cargando, recargar } = useCarga(() =>
    consulta(
      supabase.from('v_alquileres')
        .select('id, codigo, fecha, hora_inicio, estado, familia, celular, homenajeado, edad, combo, total, saldo')
        .order('fecha').order('hora_inicio'),
    ),
  )

  const hoy = hoyAR()
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let lista = (datos || []).filter((a) => {
      if (estado && a.estado !== estado) return false
      if (periodo === 'proximos' && a.fecha < hoy) return false
      if (periodo === 'pasados' && a.fecha >= hoy) return false
      if (q && !`${a.codigo} ${a.familia} ${a.homenajeado}`.toLowerCase().includes(q)) return false
      return true
    })
    if (periodo === 'pasados') lista = [...lista].reverse()
    return lista
  }, [datos, estado, periodo, busqueda, hoy])

  const conteo = useMemo(() => {
    const c = {}
    for (const a of datos || []) c[a.estado] = (c[a.estado] || 0) + 1
    return c
  }, [datos])

  const poner = (clave, valor) => {
    const p = new URLSearchParams(params)
    if (valor) p.set(clave, valor)
    else p.delete(clave)
    setParams(p, { replace: true })
  }

  const saldoVisible = (a) => !['cancelado', 'vencido', 'pre_reserva'].includes(a.estado) && a.saldo > 0

  return (
    <div>
      <Encabezado titulo="Alquileres" subtitulo={`${filtrados.length} de ${datos?.length || 0}`}>
        <Link to="/panel/alquileres/nuevo" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </Encabezado>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="campo pl-9" placeholder="Buscar por código, familia o cumpleañero" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {Object.entries(PERIODOS).map(([k, v]) => (
              <button key={k} onClick={() => poner('periodo', k)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${periodo === k ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{v}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => poner('estado', '')} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${!estado ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200'}`}>Todos</button>
          {ORDEN_ESTADOS.map((e) => (
            <button key={e} onClick={() => poner('estado', estado === e ? '' : e)} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${estado === e ? ESTADOS[e].clase : 'bg-white text-slate-600 ring-slate-200'}`}>
              {ESTADOS[e].nombre} <span className="opacity-60">{conteo[e] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : filtrados.length === 0 ? (
        <Vacio titulo="No hay alquileres con esos filtros" />
      ) : (
        <>
          {/* Celular */}
          <ul className="space-y-2 md:hidden">
            {filtrados.map((a) => (
              <li key={a.id}>
                <Link to={`/panel/alquileres/${a.id}`} className="panel-tarjeta block p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">{a.codigo} · {primeraMayuscula(diaSemanaCorto(a.fecha))} {fechaCorta(a.fecha)} {hora(a.hora_inicio)}</span>
                    <EstadoAlquiler estado={a.estado} />
                  </div>
                  <p className="mt-1 font-bold">{a.homenajeado} ({a.edad}) · {a.familia}</p>
                  {saldoVisible(a) && <p className="num text-sm text-slate-500">Saldo {pesos(a.saldo)}</p>}
                </Link>
              </li>
            ))}
          </ul>
          {/* Escritorio */}
          <div className="panel-tarjeta hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Cumpleañero</th>
                  <th className="px-3 py-2">Familia</th>
                  <th className="px-3 py-2">Combo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold"><Link to={`/panel/alquileres/${a.id}`} className="hover:underline">{a.codigo}</Link></td>
                    <td className="num px-3 py-2">{primeraMayuscula(diaSemanaCorto(a.fecha))} {fechaCorta(a.fecha)} · {hora(a.hora_inicio)}</td>
                    <td className="px-3 py-2">{a.homenajeado} ({a.edad})</td>
                    <td className="px-3 py-2">{a.familia}</td>
                    <td className="px-3 py-2 text-slate-500">{a.combo}</td>
                    <td className="px-3 py-2"><EstadoAlquiler estado={a.estado} /></td>
                    <td className="num px-3 py-2 text-right">{pesos(a.total)}</td>
                    <td className="num px-3 py-2 text-right font-semibold">{saldoVisible(a) ? pesos(a.saldo) : '—'}</td>
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
