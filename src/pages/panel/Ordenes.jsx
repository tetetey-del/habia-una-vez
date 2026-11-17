import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { pesos, fechaDeTs } from '../../lib/formato'
import { Aviso, Boton, Cargando, Encabezado, EstadoOrden, Prioridad, Vacio } from '../../components/ui'
import { ModalReportar } from '../../components/PanelComun'

const FILTROS = { abiertas: 'Abiertas', resueltas: 'Para verificar', todas: 'Todas' }
const PESO = { cierre_salon: 0, critica: 1, media: 2, baja: 3 }

export default function Ordenes() {
  const { perfil } = useSesion()
  const [params, setParams] = useSearchParams()
  const juego = params.get('juego')
  const [filtro, setFiltro] = useState('abiertas')
  const [nueva, setNueva] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const { datos, error, cargando, recargar } = useCarga(() => consulta(supabase.from('v_ordenes').select('*').order('creado_en', { ascending: false })))

  const lista = useMemo(() => {
    let l = datos || []
    if (juego) l = l.filter((o) => String(o.juego_id) === juego)
    if (filtro === 'abiertas') l = l.filter((o) => !['resuelta', 'verificada'].includes(o.estado))
    if (filtro === 'resueltas') l = l.filter((o) => o.estado === 'resuelta')
    if (filtro === 'abiertas') l = [...l].sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad])
    return l
  }, [datos, filtro, juego])

  const soloLectura = perfil?.rol === 'coordinacion'

  return (
    <div>
      <Encabezado titulo="Órdenes de mantenimiento" subtitulo={soloLectura ? 'Las órdenes que reportaste.' : 'Partes de taller de juegos y sectores.'}>
        <Boton variante="oscuro" icono={Plus} onClick={() => setNueva(true)}>Nueva orden</Boton>
      </Encabezado>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {Object.entries(FILTROS).map(([k, v]) => (
            <button key={k} onClick={() => setFiltro(k)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${filtro === k ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{v}</button>
          ))}
        </div>
        {juego && (
          <button onClick={() => setParams({})} className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold">
            Solo {datos?.find((o) => String(o.juego_id) === juego)?.juego || 'un juego'} ✕
          </button>
        )}
      </div>

      {mensaje && <Aviso tipo="exito" className="mb-4">{mensaje}</Aviso>}
      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio titulo="No hay órdenes en esta vista" />
      ) : (
        <ul className="space-y-2">
          {lista.map((o) => (
            <li key={o.id}>
              <Link
                to={`/panel/ordenes/${o.id}`}
                className={`panel-tarjeta flex flex-wrap items-center justify-between gap-3 p-3 hover:shadow ${['critica', 'cierre_salon'].includes(o.prioridad) && !['resuelta', 'verificada'].includes(o.estado) ? 'border-l-4 border-l-red-600' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500">
                    #{String(o.numero).padStart(3, '0')} · {o.juego} · {o.tipo === 'preventiva' ? 'Preventiva' : 'Correctiva'} · {fechaDeTs(o.creado_en)}
                  </p>
                  <p className="font-bold">{o.titulo}</p>
                  {o.afectados > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> {o.afectados} {o.afectados === 1 ? 'alquiler en riesgo' : 'alquileres en riesgo'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {Number(o.costo) > 0 && <span className="num text-sm font-semibold text-slate-600">{pesos(o.costo)}</span>}
                  <Prioridad prioridad={o.prioridad} />
                  <EstadoOrden estado={o.estado} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ModalReportar
        abierto={nueva}
        juegoId={juego ? Number(juego) : undefined}
        puedeCerrarSalon={perfil?.rol === 'admin'}
        onCerrar={() => setNueva(false)}
        onListo={(texto) => { setNueva(false); setMensaje(texto); recargar() }}
      />
    </div>
  )
}
