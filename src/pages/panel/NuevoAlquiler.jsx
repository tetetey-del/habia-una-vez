import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, rpc } from '../../lib/supabase'
import { useCatalogo, consulta, useCarga } from '../../lib/datos'
import { fechaLarga, hora, primeraMayuscula } from '../../lib/formato'
import SelectorTurno from '../../components/SelectorTurno'
import { FormularioFiesta, Desglose, useCotizacion, ErroresCotizacion } from '../../components/Cotizador'
import { Aviso, Boton, Campo, Cargando, Encabezado } from '../../components/ui'

export default function NuevoAlquiler() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { catalogo, error: errorCatalogo } = useCatalogo()
  const familias = useCarga(() => consulta(supabase.from('familias').select('id, nombre, celular').order('nombre')))

  const [turno, setTurno] = useState(params.get('fecha') ? { fecha: params.get('fecha'), turno_id: Number(params.get('turno')) } : null)
  const [valor, setValor] = useState({ combo_id: null, chicos: 30, adultos: 20, adicionales: [], quiere_garantia: false, motivo_excedente: '' })
  const [familia, setFamilia] = useState({ id: '', nombre: '', celular: '', email: '' })
  const [modoFamilia, setModoFamilia] = useState('nueva')
  const [datos, setDatos] = useState({ homenajeado: '', edad: '', notas: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (catalogo && !valor.combo_id) setValor((v) => ({ ...v, combo_id: catalogo.combos[0]?.id }))
  }, [catalogo, valor.combo_id])

  const datosTurno = useMemo(() => catalogo?.turnos.find((t) => t.id === turno?.turno_id), [catalogo, turno])
  const { cot, error: errorCot } = useCotizacion({ fecha: turno?.fecha, turno_id: turno?.turno_id, ...valor })

  const crear = async () => {
    setEnviando(true)
    setError('')
    try {
      const p = {
        fecha: turno.fecha,
        turno_id: turno.turno_id,
        ...valor,
        homenajeado: datos.homenajeado,
        edad: Number(datos.edad) || null,
        notas: datos.notas,
        ...(modoFamilia === 'existente' ? { familia_id: familia.id } : { nombre: familia.nombre, celular: familia.celular, email: familia.email }),
      }
      const r = await rpc('crear_pedido', { p })
      navegar(`/panel/alquileres/${r.id}`, { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (errorCatalogo) return <Aviso tipo="error">{errorCatalogo}</Aviso>
  if (!catalogo) return <Cargando />

  return (
    <div>
      <Encabezado titulo="Nuevo alquiler" subtitulo="Queda como pre-reserva hasta que registres la seña." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="panel-tarjeta p-4">
            <h2 className="mb-3 font-bold">
              {turno && datosTurno ? `${primeraMayuscula(fechaLarga(turno.fecha))} · ${hora(datosTurno.hora_inicio)} a ${hora(datosTurno.hora_fin)}` : 'Fecha y turno'}
            </h2>
            <SelectorTurno key={recarga} variante="panel" seleccion={turno} onElegir={setTurno} />
          </section>

          <section className="panel-tarjeta space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Familia</h2>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
                {['nueva', 'existente'].map((m) => (
                  <button key={m} onClick={() => setModoFamilia(m)} className={`rounded-md px-3 py-1 font-bold ${modoFamilia === m ? 'bg-white shadow' : 'text-slate-500'}`}>
                    {m === 'nueva' ? 'Nueva' : 'Ya registrada'}
                  </button>
                ))}
              </div>
            </div>
            {modoFamilia === 'existente' ? (
              <Campo etiqueta="Elegí la familia">
                <select className="campo" value={familia.id} onChange={(e) => setFamilia({ ...familia, id: e.target.value })}>
                  <option value="">Elegí…</option>
                  {(familias.datos || []).map((f) => <option key={f.id} value={f.id}>{f.nombre} · {f.celular}</option>)}
                </select>
              </Campo>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Nombre y apellido"><input className="campo" value={familia.nombre} onChange={(e) => setFamilia({ ...familia, nombre: e.target.value })} /></Campo>
                <Campo etiqueta="Celular"><input className="campo" type="tel" value={familia.celular} onChange={(e) => setFamilia({ ...familia, celular: e.target.value })} /></Campo>
                <Campo etiqueta="Correo (opcional)"><input className="campo" type="email" value={familia.email} onChange={(e) => setFamilia({ ...familia, email: e.target.value })} /></Campo>
              </div>
            )}
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Campo etiqueta="Cumpleañero/a"><input className="campo" value={datos.homenajeado} onChange={(e) => setDatos({ ...datos, homenajeado: e.target.value })} /></Campo>
              <Campo etiqueta="Edad"><input className="campo num" type="number" min={1} max={17} value={datos.edad} onChange={(e) => setDatos({ ...datos, edad: e.target.value })} /></Campo>
            </div>
            <Campo etiqueta="Notas internas (opcional)">
              <input className="campo" value={datos.notas} onChange={(e) => setDatos({ ...datos, notas: e.target.value })} placeholder="Ej.: llegan con decoración propia" />
            </Campo>
          </section>

          <section className="panel-tarjeta p-4">
            <FormularioFiesta valor={valor} onCambiar={setValor} catalogo={catalogo} cot={cot} variante="panel" esAdmin />
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="panel-tarjeta space-y-4 p-4">
            <h2 className="font-bold">Cotización</h2>
            {cot ? <Desglose d={cot} variante="panel" /> : <Cargando texto="Calculando…" />}
            <ErroresCotizacion cot={cot} error={errorCot} />
            {error && <Aviso tipo="error" onActualizar={() => { setTurno(null); setError(''); setRecarga((k) => k + 1) }}>{error}</Aviso>}
            <Boton variante="oscuro" className="w-full" cargando={enviando} disabled={!turno || (cot?.errores || []).length > 0} onClick={crear}>
              Crear pre-reserva
            </Boton>
          </div>
        </aside>
      </div>
    </div>
  )
}
