import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarHeart, PartyPopper, Clock, ArrowRight, Pencil } from 'lucide-react'
import { useCatalogo } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { supabase, rpc } from '../../lib/supabase'
import { fechaLarga, hora, pesos, fechaHora, primeraMayuscula } from '../../lib/formato'
import SelectorTurno from '../../components/SelectorTurno'
import { FormularioFiesta, Desglose, useCotizacion, ErroresCotizacion } from '../../components/Cotizador'
import { Aviso, Boton, Campo, Cargando } from '../../components/ui'

const BORRADOR = 'hv_pedido_borrador'

export default function ArmarFiesta() {
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const { catalogo, error: errorCatalogo, recargar } = useCatalogo()
  const { perfil } = useSesion()

  const fecha = params.get('fecha') || ''
  const turnoId = Number(params.get('turno')) || null

  const [valor, setValor] = useState({ combo_id: null, chicos: 30, adultos: 20, adicionales: [], quiere_garantia: false })
  const [datos, setDatos] = useState({ homenajeado: '', edad: '', nombre: '', celular: '' })
  const [eligiendo, setEligiendo] = useState(!fecha || !turnoId)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [turnoOcupado, setTurnoOcupado] = useState(false)
  const [listo, setListo] = useState(null)
  const [recarga, setRecarga] = useState(0)

  // Combo por defecto
  useEffect(() => {
    if (catalogo && !valor.combo_id) setValor((v) => ({ ...v, combo_id: catalogo.combos[0]?.id }))
  }, [catalogo, valor.combo_id])

  // Recupera lo que la familia cargó antes de ingresar
  useEffect(() => {
    const guardado = sessionStorage.getItem(BORRADOR)
    if (!guardado) return
    try {
      const b = JSON.parse(guardado)
      if (b.fecha === fecha && b.turno === turnoId) {
        setValor(b.valor)
        setDatos(b.datos)
      }
    } catch {
      /* borrador inválido */
    }
  }, [fecha, turnoId])

  // Datos de la familia que ya tiene cuenta
  useEffect(() => {
    if (perfil?.rol !== 'familia') return
    supabase
      .from('familias')
      .select('nombre, celular')
      .eq('user_id', perfil.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDatos((d) => ({ ...d, nombre: d.nombre || data.nombre, celular: d.celular || data.celular }))
      })
  }, [perfil])

  const turno = useMemo(() => catalogo?.turnos.find((t) => t.id === turnoId), [catalogo, turnoId])
  const { cot, error: errorCot } = useCotizacion({ fecha, turno_id: turnoId, ...valor })

  const elegirTurno = (t) => {
    setParams({ fecha: t.fecha, turno: String(t.turno_id) })
    setEligiendo(false)
    setTurnoOcupado(false)
    setError('')
  }

  const faltantes = []
  if (!datos.homenajeado.trim()) faltantes.push('el nombre de quien cumple')
  if (!datos.edad) faltantes.push('la edad')
  if (!datos.nombre.trim()) faltantes.push('tu nombre')
  if (!datos.celular.trim()) faltantes.push('tu celular')

  const pedir = async () => {
    setError('')
    if (faltantes.length) {
      setError(`Completá ${faltantes.join(', ')}.`)
      return
    }
    if (!perfil) {
      sessionStorage.setItem(BORRADOR, JSON.stringify({ fecha, turno: turnoId, valor, datos }))
      navegar(`/ingresar?volver=${encodeURIComponent(`/armar?fecha=${fecha}&turno=${turnoId}`)}&motivo=pedido`)
      return
    }
    setEnviando(true)
    try {
      const r = await rpc('crear_pedido', {
        p: { fecha, turno_id: turnoId, ...valor, homenajeado: datos.homenajeado, edad: Number(datos.edad), nombre: datos.nombre, celular: datos.celular },
      })
      sessionStorage.removeItem(BORRADOR)
      setListo({ ...r, sena: cot?.sena })
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e.message)
      if (/ocupó|no está disponible/.test(e.message)) setTurnoOcupado(true)
    } finally {
      setEnviando(false)
    }
  }

  if (errorCatalogo) return <div className="mx-auto max-w-3xl px-4 py-6"><Aviso tipo="error" onActualizar={recargar}>{errorCatalogo}</Aviso></div>
  if (!catalogo) return <Cargando />

  if (listo) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <span className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amarillo">
          <PartyPopper className="h-10 w-10 text-violeta" />
        </span>
        <h1 className="text-3xl font-extrabold text-violeta">¡Te guardamos el turno por 48 horas!</h1>
        <p className="mt-2 text-lg">
          Cumple de <strong>{datos.homenajeado}</strong> · {fechaLarga(fecha)} a las {hora(turno?.hora_inicio)} h
        </p>
        <div className="tarjeta mt-6 p-5 text-left">
          <p className="flex items-center gap-2 font-bold"><Clock className="h-5 w-5 text-coral" /> Señá antes del {fechaHora(listo.vence_en)} h</p>
          <p className="mt-2 text-tinta-suave">
            La seña es de <strong className="text-tinta">{pesos(listo.sena)}</strong>. Pagala en el salón o por transferencia: cuando la registremos te avisamos para que aceptes el contrato y el turno quede firme.
          </p>
          <p className="mt-3 text-sm text-tinta-suave">Código de tu pedido: <strong className="text-tinta">{listo.codigo}</strong></p>
        </div>
        <Link to={`/mis-fiestas/${listo.id}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violeta px-6 py-3 font-bold text-white">
          Ver mi fiesta <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    )
  }

  const esEquipo = perfil && perfil.rol !== 'familia'
  const hayErroresCot = (cot?.errores || []).length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-3xl font-extrabold text-violeta sm:text-4xl">Armá tu fiesta</h1>
      <p className="mb-5 text-tinta-suave">El total se recalcula con cada cambio.</p>

      {esEquipo && (
        <Aviso tipo="info" className="mb-4">
          Estás con un usuario del equipo. Para cargar un alquiler usá <Link to="/panel/alquileres/nuevo" className="font-bold underline">Nuevo alquiler</Link> en el panel.
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Fecha */}
          <section className="tarjeta p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-titulo text-xl font-bold">
                <CalendarHeart className="h-5 w-5 text-turquesa" />
                {eligiendo || !turno ? 'Elegí tu fecha' : `${primeraMayuscula(fechaLarga(fecha))}, ${hora(turno.hora_inicio)} a ${hora(turno.hora_fin)} h`}
              </h2>
              {!eligiendo && turno && (
                <button onClick={() => setEligiendo(true)} className="flex items-center gap-1 text-sm font-bold text-violeta">
                  <Pencil className="h-4 w-4" /> Cambiar
                </button>
              )}
            </div>
            {(eligiendo || !turno) && (
              <div className="mt-4">
                <SelectorTurno key={recarga} seleccion={fecha && turnoId ? { fecha, turno_id: turnoId } : null} onElegir={elegirTurno} />
              </div>
            )}
          </section>

          {/* Quién cumple */}
          <section className="tarjeta space-y-4 p-4">
            <h2 className="font-titulo text-xl font-bold">¿Quién cumple?</h2>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Campo etiqueta="Nombre">
                <input className="campo" value={datos.homenajeado} onChange={(e) => setDatos({ ...datos, homenajeado: e.target.value })} placeholder="Ej.: Sofía" autoComplete="off" />
              </Campo>
              <Campo etiqueta="Edad">
                <input className="campo num" type="number" inputMode="numeric" min={1} max={17} value={datos.edad} onChange={(e) => setDatos({ ...datos, edad: e.target.value })} placeholder="9" />
              </Campo>
            </div>
          </section>

          <section className="tarjeta p-4">
            <FormularioFiesta valor={valor} onCambiar={setValor} catalogo={catalogo} cot={cot} />
          </section>

          {/* Contacto */}
          <section className="tarjeta space-y-4 p-4">
            <h2 className="font-titulo text-xl font-bold">Tus datos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Tu nombre y apellido">
                <input className="campo" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} autoComplete="name" />
              </Campo>
              <Campo etiqueta="Celular" ayuda="Te escribimos por WhatsApp.">
                <input className="campo" type="tel" inputMode="tel" value={datos.celular} onChange={(e) => setDatos({ ...datos, celular: e.target.value })} placeholder="11 5555-5555" autoComplete="tel" />
              </Campo>
            </div>
          </section>
        </div>

        {/* Resumen */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="tarjeta space-y-4 p-4">
            <h2 className="font-titulo text-xl font-bold">Tu presupuesto</h2>
            {cot ? <Desglose d={cot} /> : <Cargando texto="Calculando…" />}
            <ErroresCotizacion cot={cot} error={errorCot} />
            {error && <Aviso tipo="error">{error}</Aviso>}
            {turnoOcupado ? (
              <Boton variante="amarillo" className="w-full" onClick={() => { setEligiendo(true); setRecarga((k) => k + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Elegir otro turno
              </Boton>
            ) : (
              <Boton tamano="lg" className="w-full" onClick={pedir} cargando={enviando} disabled={!turno || hayErroresCot || esEquipo}>
                Pedir turno
              </Boton>
            )}
            {!perfil && <p className="text-center text-xs text-tinta-suave">Te vamos a pedir que ingreses o crees tu cuenta para guardar el turno.</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}
