import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Wrench, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { diasEntre, hoyAR, fechaDeTs } from '../../lib/formato'
import { Aviso, Boton, Cargando, Encabezado, EstadoJuego, Modal, Campo } from '../../components/ui'
import { ModalReportar, PestanasMantenimiento } from '../../components/PanelComun'

function avance(j) {
  if (!j.frecuencia_tipo) return null
  if (j.frecuencia_tipo === 'eventos') return { actual: j.contador, total: j.frecuencia_valor, texto: `${j.contador} de ${j.frecuencia_valor} eventos` }
  const dias = j.ultima_revision ? diasEntre(j.ultima_revision, hoyAR()) : j.frecuencia_valor
  return { actual: Math.min(dias, j.frecuencia_valor), total: j.frecuencia_valor, texto: `${dias} de ${j.frecuencia_valor} días` }
}

export default function Juegos() {
  const { perfil } = useSesion()
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [juegos, abiertas] = await Promise.all([
      consulta(supabase.from('juegos').select('*').order('orden')),
      consulta(supabase.from('ordenes').select('id, juego_id, prioridad').not('estado', 'in', '(resuelta,verificada)')),
    ])
    return { juegos, abiertas }
  })
  const [reportar, setReportar] = useState(null)
  const [editar, setEditar] = useState(null)
  const [mensaje, setMensaje] = useState('')

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>

  return (
    <div>
      <Encabezado titulo="Mantenimiento" />
      <PestanasMantenimiento actual="juegos" />
      {mensaje && <Aviso tipo="exito" className="mb-4">{mensaje}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {datos.juegos.map((j) => {
          const av = avance(j)
          const pct = av ? Math.min(100, Math.round((av.actual / av.total) * 100)) : 0
          const abiertas = datos.abiertas.filter((o) => o.juego_id === j.id).length
          return (
            <article key={j.id} className="panel-tarjeta flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-1.5 font-bold">
                    {j.nombre}
                    {j.principal && <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-label="Juego principal" />}
                  </h2>
                  <p className="text-xs text-slate-500">{j.tipo === 'juego' ? 'Juego' : 'Sector de servicio'}{j.principal ? ' · principal' : ''}</p>
                </div>
                <EstadoJuego estado={j.estado} />
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{j.descripcion}</p>
              {av ? (
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Próxima preventiva</span>
                    <span className="num">{av.texto}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {j.ultima_revision && <p className="mt-1 text-xs text-slate-400">Última revisión: {fechaDeTs(j.ultima_revision + 'T12:00')}</p>}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">Sin mantenimiento programado.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Boton tamano="sm" variante="secundario" icono={Wrench} onClick={() => setReportar(j)}>Reportar</Boton>
                {abiertas > 0 && (
                  <Link to={`/panel/ordenes?juego=${j.id}`} className="rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
                    {abiertas} {abiertas === 1 ? 'orden abierta' : 'órdenes abiertas'}
                  </Link>
                )}
                <Boton tamano="sm" variante="fantasma" icono={Pencil} onClick={() => setEditar(j)}>Editar</Boton>
              </div>
            </article>
          )
        })}
      </div>

      <ModalReportar
        abierto={Boolean(reportar)}
        juegoId={reportar?.id}
        puedeCerrarSalon={perfil?.rol === 'admin'}
        onCerrar={() => setReportar(null)}
        onListo={(texto) => { setReportar(null); setMensaje(texto); recargar() }}
      />
      {editar && (
        <EditarJuego
          juego={editar}
          esAdmin={perfil?.rol === 'admin'}
          onCerrar={() => setEditar(null)}
          onListo={(texto) => { setEditar(null); setMensaje(texto); recargar() }}
        />
      )}
    </div>
  )
}

function EditarJuego({ juego, esAdmin, onCerrar, onListo }) {
  const [f, setF] = useState({
    descripcion: juego.descripcion,
    principal: juego.principal,
    frecuencia_tipo: juego.frecuencia_tipo || '',
    frecuencia_valor: juego.frecuencia_valor || '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const guardar = async () => {
    setEnviando(true)
    setError('')
    try {
      const cambios = {
        descripcion: f.descripcion,
        frecuencia_tipo: f.frecuencia_tipo || null,
        frecuencia_valor: f.frecuencia_tipo ? Number(f.frecuencia_valor) || null : null,
      }
      if (esAdmin) cambios.principal = f.principal
      await consulta(supabase.from('juegos').update(cambios).eq('id', juego.id))
      onListo(`${juego.nombre} actualizado.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Editar ${juego.nombre}`}>
      <div className="space-y-3">
        <Campo etiqueta="Descripción"><input className="campo" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Frecuencia">
            <select className="campo" value={f.frecuencia_tipo} onChange={(e) => setF({ ...f, frecuencia_tipo: e.target.value })}>
              <option value="">Sin programar</option>
              <option value="eventos">Cada X eventos</option>
              <option value="dias">Cada X días</option>
            </select>
          </Campo>
          <Campo etiqueta="Cantidad">
            <input className="campo num" type="number" min={1} disabled={!f.frecuencia_tipo} value={f.frecuencia_valor} onChange={(e) => setF({ ...f, frecuencia_valor: e.target.value })} />
          </Campo>
        </div>
        {esAdmin && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={f.principal} onChange={(e) => setF({ ...f, principal: e.target.checked })} />
            Juego principal (una orden crítica pone en riesgo los alquileres)
          </label>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton variante="oscuro" className="w-full" cargando={enviando} onClick={guardar}>Guardar</Boton>
      </div>
    </Modal>
  )
}
