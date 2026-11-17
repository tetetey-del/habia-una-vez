import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { pesos, fechaHora, fechaCorta, hora, ORDEN_ESTADO, PRIORIDAD } from '../../lib/formato'
import { textoAvisoRiesgo } from '../../lib/compartir'
import { Aviso, Boton, Cargando, Campo, EstadoAlquiler } from '../../components/ui'
import { BotonWhatsApp } from '../../components/PanelComun'

const SIGUIENTES = {
  abierta: ['en_curso', 'esperando_repuesto', 'resuelta'],
  en_curso: ['esperando_repuesto', 'resuelta'],
  esperando_repuesto: ['en_curso', 'resuelta'],
  resuelta: ['verificada', 'en_curso'],
  verificada: [],
}

export default function Orden() {
  const { id } = useParams()
  const { perfil } = useSesion()
  const esAdmin = perfil?.rol === 'admin'
  const puedeEditar = ['admin', 'mantenimiento'].includes(perfil?.rol)

  const { datos, error, cargando, recargar } = useCarga(async () => {
    const orden = await consulta(supabase.from('v_ordenes').select('*').eq('id', id).maybeSingle())
    if (!orden) throw new Error('No encontramos esa orden.')
    const [eventos, afectados] = await Promise.all([
      puedeEditar ? consulta(supabase.from('eventos').select('*').eq('orden_id', id).is('alquiler_id', null).order('creado_en')) : [],
      esAdmin ? consulta(supabase.from('v_alquileres').select('*').eq('orden_riesgo_id', id).order('fecha')) : [],
    ])
    return { orden, eventos, afectados }
  }, [id, puedeEditar, esAdmin])

  const [f, setF] = useState({ costo: '', repuesto: '', nota: '' })
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>
  const { orden: o, eventos, afectados } = datos

  const correr = async (fn, texto) => {
    setTrabajando(true)
    setErrorAccion('')
    setMensaje('')
    try {
      const r = await fn()
      setMensaje(typeof texto === 'function' ? texto(r) : texto)
      setF({ costo: '', repuesto: '', nota: '' })
      recargar()
    } catch (e) {
      setErrorAccion(e.message)
    } finally {
      setTrabajando(false)
    }
  }

  const actualizar = (estado) =>
    correr(
      () => rpc('actualizar_orden', {
        p_orden: o.id,
        p_estado: estado,
        p_costo: f.costo === '' ? null : Number(f.costo),
        p_repuesto: f.repuesto || null,
        p_nota: f.nota || null,
      }),
      (r) => `Orden ${ORDEN_ESTADO[estado].nombre.toLowerCase()}.${r.liberados > 0 ? ` ${r.liberados} alquiler(es) volvieron a su estado anterior.` : ''}`,
    )

  const Fila = ({ n, etiqueta, children }) => (
    <div className="grid grid-cols-[32px_140px_1fr] items-baseline gap-2 border-b border-dashed border-slate-300 py-2">
      <span className="num text-xs font-bold text-slate-400">{n}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <span className="font-semibold">{children}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/panel/ordenes" className="no-imprimir mb-3 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Órdenes
      </Link>

      {mensaje && <Aviso tipo="exito" className="mb-3">{mensaje}</Aviso>}
      {errorAccion && <Aviso tipo="error" className="mb-3" onActualizar={() => { setErrorAccion(''); recargar() }}>{errorAccion}</Aviso>}

      {/* Parte de taller */}
      <article className="parte relative overflow-hidden rounded-lg border-2 border-slate-800 bg-[#fffdf6] shadow">
        <header className="flex items-center justify-between border-b-2 border-slate-800 bg-slate-800 px-4 py-2 text-white">
          <span className="font-mono text-sm font-bold uppercase tracking-widest">Parte de taller</span>
          <span className="font-mono text-2xl font-bold">N.º {String(o.numero).padStart(4, '0')}</span>
        </header>
        <div className={`absolute right-4 top-14 rotate-[-8deg] rounded border-4 px-3 py-1 font-mono text-lg font-black uppercase opacity-80 ${
          o.estado === 'verificada' ? 'border-slate-500 text-slate-500' : o.estado === 'resuelta' ? 'border-emerald-600 text-emerald-600' : 'border-red-600 text-red-600'
        }`}>
          {ORDEN_ESTADO[o.estado].nombre}
        </div>
        <div className="px-4 py-3">
          <Fila n="01" etiqueta="Juego / sector">{o.juego}{o.principal ? ' ★ principal' : ''}</Fila>
          <Fila n="02" etiqueta="Tipo">{o.tipo === 'preventiva' ? 'Preventiva' : 'Correctiva'}</Fila>
          <Fila n="03" etiqueta="Prioridad">
            <span className={`rounded px-2 py-0.5 text-sm ring-1 ring-inset ${PRIORIDAD[o.prioridad].clase}`}>{PRIORIDAD[o.prioridad].nombre}</span>
          </Fila>
          <Fila n="04" etiqueta="Falla">{o.titulo}</Fila>
          <Fila n="05" etiqueta="Detalle">{o.descripcion || '—'}</Fila>
          <Fila n="06" etiqueta="Reportó">{o.reportada_por_nombre} · {fechaHora(o.creado_en)} h</Fila>
          <Fila n="07" etiqueta="Repuesto">{o.repuesto || '—'}</Fila>
          <Fila n="08" etiqueta="Costo">{pesos(o.costo)}</Fila>
          {o.resuelta_en && <Fila n="09" etiqueta="Resuelta">{fechaHora(o.resuelta_en)} h</Fila>}
          {o.verificada_en && <Fila n="10" etiqueta="Verificada">{fechaHora(o.verificada_en)} h</Fila>}
          {o.notas && (
            <div className="py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notas del taller</p>
              <p className="whitespace-pre-line font-mono text-sm">{o.notas}</p>
            </div>
          )}
        </div>
      </article>

      {/* Alquileres afectados */}
      {esAdmin && afectados.length > 0 && (
        <section className="mt-5 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
          <h2 className="mb-2 font-bold text-red-800">Alquileres en riesgo por esta orden</h2>
          <ul className="space-y-2">
            {afectados.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                <Link to={`/panel/alquileres/${a.id}`}>
                  <span className="block font-bold">{a.codigo} · {a.familia}</span>
                  <span className="block text-sm text-slate-500">{fechaCorta(a.fecha)} · {hora(a.hora_inicio)} h · antes: {a.estado_previo?.replace('_', ' ')}</span>
                </Link>
                <span className="flex items-center gap-2">
                  <EstadoAlquiler estado={a.estado} />
                  <BotonWhatsApp celular={a.celular} texto={textoAvisoRiesgo(a, `${window.location.origin}/mis-fiestas`)}>Avisar</BotonWhatsApp>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Acciones */}
      {puedeEditar && o.estado !== 'verificada' && (
        <section className="no-imprimir panel-tarjeta mt-5 space-y-4 p-4">
          <h2 className="font-bold">Actualizar el parte</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Costo total"><input className="campo num" type="number" min={0} placeholder={String(o.costo)} value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} /></Campo>
            <Campo etiqueta="Repuesto"><input className="campo" placeholder={o.repuesto || 'Ej.: correa'} value={f.repuesto} onChange={(e) => setF({ ...f, repuesto: e.target.value })} /></Campo>
          </div>
          <Campo etiqueta="Nota"><input className="campo" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Qué se hizo" /></Campo>
          <div className="flex flex-wrap gap-2">
            {SIGUIENTES[o.estado].map((e) => (
              <Boton key={e} variante={e === 'resuelta' || e === 'verificada' ? 'oscuro' : 'secundario'} cargando={trabajando} onClick={() => actualizar(e)}>
                Pasar a «{ORDEN_ESTADO[e].nombre}»
              </Boton>
            ))}
            {(f.costo !== '' || f.repuesto || f.nota) && (
              <Boton variante="fantasma" cargando={trabajando} onClick={() => actualizar(o.estado)}>Guardar sin cambiar estado</Boton>
            )}
          </div>
          {esAdmin && !['resuelta'].includes(o.estado) && (
            <div className="border-t border-slate-100 pt-3">
              <p className="etiqueta">Cambiar prioridad</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRIORIDAD).filter(([k]) => k !== o.prioridad).map(([k, p]) => (
                  <button
                    key={k}
                    disabled={trabajando}
                    onClick={() => correr(() => rpc('cambiar_prioridad_orden', { p_orden: o.id, p_prioridad: k }), (r) => `Prioridad: ${p.nombre}.${r.afectados > 0 ? ` ${r.afectados} alquiler(es) pasaron a «En riesgo».` : ''}`)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${p.clase}`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {eventos.length > 0 && (
        <section className="panel-tarjeta mt-5 p-4 text-sm">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Historial</h2>
          <ol className="space-y-1.5">
            {eventos.map((e) => (
              <li key={e.id}><span className="num text-xs text-slate-400">{fechaHora(e.creado_en)}</span> · {e.texto}</li>
            ))}
          </ol>
        </section>
      )}

      <Boton variante="secundario" icono={Printer} className="no-imprimir mt-5" onClick={() => window.print()}>Imprimir parte</Boton>
    </div>
  )
}
