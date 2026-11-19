import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { supabase, rpc, nuevaClave } from '../lib/supabase'
import { consulta } from '../lib/datos'
import { pesos, MEDIOS, PRIORIDAD } from '../lib/formato'
import { enlaceWhatsApp } from '../lib/compartir'
import { Aviso, Boton, Campo, Modal, Cargando } from './ui'

export function BotonWhatsApp({ celular, texto, children = 'WhatsApp', className = '' }) {
  return (
    <a
      href={enlaceWhatsApp(celular, texto)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white hover:brightness-95 ${className}`}
    >
      <MessageCircle className="h-4 w-4" /> {children}
    </a>
  )
}

/** Registrar seña, saldo o garantía. La clave evita cobrar dos veces si se toca dos veces. */
export function ModalPago({ abierto, onCerrar, alquiler, tipo, cuenta, onListo }) {
  const sugerido = useMemo(() => {
    if (tipo === 'sena') return alquiler.sena_requerida
    if (tipo === 'garantia') return cuenta?.garantia_monto
    return Number(cuenta?.saldo || 0) + Number(cuenta?.recargo_si_paga_hoy || 0)
  }, [tipo, alquiler, cuenta])
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState(MEDIOS[0])
  const [clave, setClave] = useState(nuevaClave())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (abierto) {
      setMonto(String(Math.round(sugerido || 0)))
      setClave(nuevaClave())
      setError('')
    }
  }, [abierto, sugerido])

  const titulos = { sena: 'Registrar seña', saldo: 'Registrar pago de saldo', garantia: 'Cobrar garantía' }

  const confirmar = async () => {
    setEnviando(true)
    setError('')
    try {
      const r =
        tipo === 'sena'
          ? await rpc('registrar_sena', { p_alquiler: alquiler.id, p_monto: Number(monto), p_medio: medio, p_clave: clave })
          : await rpc('registrar_pago', { p_alquiler: alquiler.id, p_tipo: tipo, p_monto: Number(monto), p_medio: medio, p_clave: clave })
      onListo(`Pago registrado. Recibo ${String(r.recibo).padStart(4, '0')}.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulos[tipo]}>
      <div className="space-y-4">
        {tipo === 'sena' && <p className="text-sm text-slate-600">Seña mínima: <strong>{pesos(alquiler.sena_requerida)}</strong>. Al registrarla el precio queda congelado.</p>}
        {tipo === 'saldo' && Number(cuenta?.recargo_si_paga_hoy) > 0 && (
          <Aviso tipo="alerta">El plazo venció: se suma un recargo de {pesos(cuenta.recargo_si_paga_hoy)} ({Number(cuenta.recargo_pct)} %).</Aviso>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Monto">
            <input className="campo num" type="number" inputMode="numeric" min={1} value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Campo>
          <Campo etiqueta="Medio">
            <select className="campo" value={medio} onChange={(e) => setMedio(e.target.value)}>
              {MEDIOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Campo>
        </div>
        {error && <Aviso tipo="error" onActualizar={() => onListo('')}>{error}</Aviso>}
        <Boton className="w-full" variante="oscuro" cargando={enviando} disabled={!Number(monto)} onClick={confirmar}>
          Registrar {pesos(monto)}
        </Boton>
      </div>
    </Modal>
  )
}

/** Reportar un problema en un juego o sector */
export function ModalReportar({ abierto, onCerrar, onListo, juegoId, alquilerId, puedeCerrarSalon = false }) {
  const [juegos, setJuegos] = useState(null)
  const [f, setF] = useState({ juego: '', prioridad: 'media', titulo: '', descripcion: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setError('')
    setF({ juego: juegoId ? String(juegoId) : '', prioridad: 'media', titulo: '', descripcion: '' })
    consulta(supabase.from('juegos').select('id, nombre, principal').order('orden')).then(setJuegos).catch((e) => setError(e.message))
  }, [abierto, juegoId])

  const juego = juegos?.find((j) => String(j.id) === f.juego)
  const critica = f.prioridad === 'critica' || f.prioridad === 'cierre_salon'

  const enviar = async () => {
    setEnviando(true)
    setError('')
    try {
      const r = await rpc('crear_orden', {
        p_juego: Number(f.juego),
        p_prioridad: f.prioridad,
        p_titulo: f.titulo,
        p_descripcion: f.descripcion,
        p_alquiler: alquilerId || null,
      })
      onListo(
        `Orden #${r.numero} abierta.` +
          (r.afectados > 0 ? ` ${r.afectados} ${r.afectados === 1 ? 'alquiler quedó' : 'alquileres quedaron'} en riesgo y administración ya lo ve.` : ''),
        r,
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const prioridades = ['baja', 'media', 'critica', ...(puedeCerrarSalon ? ['cierre_salon'] : [])]

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Reportar un problema">
      {!juegos && !error ? (
        <Cargando />
      ) : (
        <div className="space-y-4">
          <Campo etiqueta="Juego o sector">
            <select className="campo" value={f.juego} onChange={(e) => setF({ ...f, juego: e.target.value })}>
              <option value="">Elegí…</option>
              {(juegos || []).map((j) => (
                <option key={j.id} value={j.id}>{j.nombre}{j.principal ? ' (principal)' : ''}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="¿Qué pasa?">
            <input className="campo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej.: hace un ruido raro" />
          </Campo>
          <Campo etiqueta="Detalle (opcional)">
            <textarea className="campo" rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          </Campo>
          <fieldset>
            <legend className="etiqueta">Prioridad</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {prioridades.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setF({ ...f, prioridad: p })}
                  className={`rounded-lg px-2 py-2 text-sm font-bold ring-1 ${f.prioridad === p ? PRIORIDAD[p].clase + ' ring-2' : 'bg-white text-slate-700 ring-slate-200'}`}
                >
                  {PRIORIDAD[p].nombre}
                </button>
              ))}
            </div>
          </fieldset>
          {critica && juego?.principal && (
            <Aviso tipo="alerta">
              Es un juego principal: los alquileres de los próximos 14 días van a pasar a «En riesgo» y esas fechas dejan de ofrecerse.
            </Aviso>
          )}
          {f.prioridad === 'cierre_salon' && (
            <Aviso tipo="alerta">Cierre del salón: los turnos de los próximos 14 días quedan bloqueados y el traslado es obligatorio.</Aviso>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton className="w-full" variante={critica ? 'peligro' : 'oscuro'} cargando={enviando} disabled={!f.juego || !f.titulo.trim()} onClick={enviar}>
            Abrir orden
          </Boton>
        </div>
      )}
    </Modal>
  )
}

/** Tarjeta de número grande para el tablero */
export function Numero({ titulo, valor, detalle, tono = 'neutro', onClick }) {
  const tonos = {
    neutro: 'bg-white ring-slate-200',
    alerta: 'bg-amber-50 ring-amber-300',
    peligro: 'bg-red-50 ring-red-300',
    exito: 'bg-emerald-50 ring-emerald-300',
    violeta: 'bg-violeta text-white ring-violeta',
  }
  const Etiqueta = onClick ? 'button' : 'div'
  const largo = String(valor).length
  return (
    <Etiqueta onClick={onClick} className={`min-w-0 overflow-hidden rounded-xl p-3 text-left ring-1 sm:p-4 ${tonos[tono]} ${onClick ? 'transition hover:shadow-md' : ''}`}>
      <p className={`text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-xs ${tono === 'violeta' ? 'text-white/80' : 'text-slate-500'}`}>{titulo}</p>
      <p className={`num mt-1 whitespace-nowrap font-extrabold leading-tight ${largo > 9 ? 'text-lg sm:text-2xl xl:text-3xl' : largo > 6 ? 'text-xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>{valor}</p>
      {detalle && <p className={`mt-1 text-xs ${tono === 'violeta' ? 'text-white/80' : 'text-slate-500'}`}>{detalle}</p>}
    </Etiqueta>
  )
}

/** Pestañas de la sección Mantenimiento */
export function PestanasMantenimiento({ actual }) {
  const pestañas = [
    { a: '/panel/juegos', texto: 'Juegos y sectores', clave: 'juegos' },
    { a: '/panel/ordenes', texto: 'Órdenes', clave: 'ordenes' },
  ]
  return (
    <div className="mb-5 flex rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:inline-flex">
      {pestañas.map((p) => (
        <Link
          key={p.clave}
          to={p.a}
          className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-bold sm:flex-none ${actual === p.clave ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {p.texto}
        </Link>
      ))}
    </div>
  )
}
