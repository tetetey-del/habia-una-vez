import { useMemo, useState } from 'react'
import { RotateCcw, Trash2, Plus } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga, olvidarCatalogo } from '../../lib/datos'
import { pesos, fechaCorta, hoyAR, hora, TIPO_DIA } from '../../lib/formato'
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal } from '../../components/ui'

export default function Configuracion() {
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const [precios, combos, adicionales, config, turnos, feriados] = await Promise.all([
      consulta(supabase.from('precios').select('*').order('vigente_desde', { ascending: false }).order('id', { ascending: false })),
      consulta(supabase.from('combos').select('*').order('orden')),
      consulta(supabase.from('adicionales').select('*').order('orden')),
      consulta(supabase.from('configuracion').select('*').order('clave')),
      consulta(supabase.from('turnos').select('*').order('hora_inicio')),
      consulta(supabase.from('feriados').select('*').order('fecha')),
    ])
    return { precios, combos, adicionales, config, turnos, feriados }
  })
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  const hecho = (texto) => {
    setMensaje(texto)
    setErrorAccion('')
    olvidarCatalogo()
    recargar()
  }
  const intentar = async (fn, texto) => {
    setErrorAccion('')
    setMensaje('')
    try {
      await fn()
      hecho(texto)
    } catch (e) {
      setErrorAccion(e.message)
    }
  }

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>

  return (
    <div className="space-y-6">
      <Encabezado titulo="Configuración" subtitulo="Precios, reglas y horarios del salón. Los valores cargados son de prueba." />
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      {errorAccion && <Aviso tipo="error" onActualizar={() => { setErrorAccion(''); recargar() }}>{errorAccion}</Aviso>}

      <Precios datos={datos} intentar={intentar} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Parametros config={datos.config} intentar={intentar} />
        <Turnos turnos={datos.turnos} intentar={intentar} />
        <Feriados feriados={datos.feriados} intentar={intentar} />
        <Adicionales adicionales={datos.adicionales} intentar={intentar} />
      </div>
      <Reinicio onListo={hecho} />
    </div>
  )
}

function Precios({ datos, intentar }) {
  const hoy = hoyAR()
  const conceptos = useMemo(() => {
    const lista = []
    for (const c of datos.combos) for (const t of ['sabado', 'domingo_feriado']) lista.push({ clave: `combo:${c.id}:${t}`, nombre: `${c.nombre} · ${TIPO_DIA[t]}`, filtro: (p) => p.concepto === 'combo' && p.combo_id === c.id && p.tipo_dia === t, fila: { concepto: 'combo', combo_id: c.id, tipo_dia: t } })
    for (const a of datos.adicionales) lista.push({ clave: `adicional:${a.id}`, nombre: a.nombre, filtro: (p) => p.concepto === 'adicional' && p.adicional_id === a.id, fila: { concepto: 'adicional', adicional_id: a.id } })
    lista.push({ clave: 'persona_extra', nombre: 'Persona excedente', filtro: (p) => p.concepto === 'persona_extra', fila: { concepto: 'persona_extra' } })
    return lista.map((c) => {
      const historial = datos.precios.filter(c.filtro)
      const vigente = historial.find((p) => p.vigente_desde <= hoy)
      const proximo = [...historial].reverse().find((p) => p.vigente_desde > hoy)
      return { ...c, vigente, proximo }
    })
  }, [datos, hoy])

  const [nuevo, setNuevo] = useState(null)
  const [f, setF] = useState({ monto: '', desde: '' })

  return (
    <section className="panel-tarjeta p-4">
      <h2 className="font-bold">Precios</h2>
      <p className="mb-3 text-sm text-slate-500">Un precio nuevo rige para las cotizaciones hechas desde su fecha de vigencia. Los alquileres ya cotizados conservan su importe.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Concepto</th><th className="text-right">Vigente</th><th className="text-right">Próximo cambio</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {conceptos.map((c) => (
              <tr key={c.clave}>
                <td className="py-2">{c.nombre}</td>
                <td className="num text-right font-bold">{c.vigente ? pesos(c.vigente.monto) : '—'}</td>
                <td className="num text-right text-slate-600">{c.proximo ? `${pesos(c.proximo.monto)} desde ${fechaCorta(c.proximo.vigente_desde)}` : '—'}</td>
                <td className="pl-2 text-right">
                  <button className="text-xs font-bold text-violeta hover:underline" onClick={() => { setNuevo(c); setF({ monto: '', desde: hoy }) }}>Nueva tarifa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal abierto={Boolean(nuevo)} onCerrar={() => setNuevo(null)} titulo={`Nueva tarifa: ${nuevo?.nombre || ''}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto"><input className="campo num" type="number" min={0} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></Campo>
            <Campo etiqueta="Vigente desde"><input className="campo" type="date" min={hoy} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Campo>
          </div>
          <p className="text-xs text-slate-500">No modifica ningún alquiler ya cotizado ni señado.</p>
          <Boton
            variante="oscuro"
            className="w-full"
            disabled={!f.monto || !f.desde}
            onClick={async () => {
              const c = nuevo
              setNuevo(null)
              await intentar(() => consulta(supabase.from('precios').insert({ ...c.fila, monto: Number(f.monto), vigente_desde: f.desde })), `Tarifa de ${c.nombre} cargada desde el ${fechaCorta(f.desde)}.`)
            }}
          >
            Guardar tarifa
          </Boton>
        </div>
      </Modal>
    </section>
  )
}

function Parametros({ config, intentar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(config.map((c) => [c.clave, String(c.valor)])))
  return (
    <section className="panel-tarjeta p-4">
      <h2 className="mb-3 font-bold">Reglas</h2>
      <ul className="space-y-2">
        {config.map((c) => (
          <li key={c.clave} className="flex items-center justify-between gap-3">
            <span className="text-sm">{c.descripcion}</span>
            <span className="flex items-center gap-2">
              <input className="campo num w-24 py-1.5 text-right" type="number" value={valores[c.clave]} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} aria-label={c.descripcion} />
              <button
                className="text-xs font-bold text-violeta disabled:opacity-30"
                disabled={String(c.valor) === valores[c.clave] || valores[c.clave] === ''}
                onClick={() => intentar(() => consulta(supabase.from('configuracion').update({ valor: Number(valores[c.clave]) }).eq('clave', c.clave)), 'Regla actualizada.')}
              >
                Guardar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Turnos({ turnos, intentar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(turnos.map((t) => [t.id, { inicio: hora(t.hora_inicio), fin: hora(t.hora_fin) }])))
  return (
    <section className="panel-tarjeta p-4">
      <h2 className="font-bold">Horarios de turnos</h2>
      <p className="mb-3 text-sm text-slate-500">La media hora extra para decorar solo se ofrece si el turno anterior termina al menos una hora antes.</p>
      <ul className="space-y-2">
        {turnos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-sm font-semibold">{t.nombre}</span>
            <input type="time" className="campo w-28 py-1.5" value={valores[t.id].inicio} onChange={(e) => setValores({ ...valores, [t.id]: { ...valores[t.id], inicio: e.target.value } })} aria-label={`Inicio ${t.nombre}`} />
            <span className="text-slate-400">a</span>
            <input type="time" className="campo w-28 py-1.5" value={valores[t.id].fin} onChange={(e) => setValores({ ...valores, [t.id]: { ...valores[t.id], fin: e.target.value } })} aria-label={`Fin ${t.nombre}`} />
            <button
              className="text-xs font-bold text-violeta disabled:opacity-30"
              disabled={valores[t.id].inicio === hora(t.hora_inicio) && valores[t.id].fin === hora(t.hora_fin)}
              onClick={() => intentar(() => consulta(supabase.from('turnos').update({ hora_inicio: valores[t.id].inicio, hora_fin: valores[t.id].fin }).eq('id', t.id)), `Horario de ${t.nombre} actualizado.`)}
            >
              Guardar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Feriados({ feriados, intentar }) {
  const [f, setF] = useState({ fecha: '', nombre: '' })
  const hoy = hoyAR()
  return (
    <section className="panel-tarjeta p-4">
      <h2 className="mb-3 font-bold">Feriados</h2>
      <ul className="mb-3 max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
        {feriados.filter((x) => x.fecha >= hoy).map((x) => (
          <li key={x.fecha} className="flex items-center justify-between py-1.5">
            <span><span className="num font-semibold">{fechaCorta(x.fecha)}/{x.fecha.slice(2, 4)}</span> · {x.nombre}</span>
            <button aria-label={`Quitar ${x.nombre}`} onClick={() => intentar(() => consulta(supabase.from('feriados').delete().eq('fecha', x.fecha)), 'Feriado quitado.')} className="p-1 text-slate-400 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input type="date" className="campo w-40 py-1.5" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} aria-label="Fecha del feriado" />
        <input className="campo flex-1 py-1.5" placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Boton tamano="sm" variante="oscuro" icono={Plus} disabled={!f.fecha || !f.nombre.trim()} onClick={() => intentar(async () => { await consulta(supabase.from('feriados').insert({ fecha: f.fecha, nombre: f.nombre.trim() })); setF({ fecha: '', nombre: '' }) }, 'Feriado agregado.')}>
          Agregar
        </Boton>
      </div>
    </section>
  )
}

function Adicionales({ adicionales, intentar }) {
  return (
    <section className="panel-tarjeta p-4">
      <h2 className="mb-3 font-bold">Adicionales que se ofrecen</h2>
      <ul className="space-y-2">
        {adicionales.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{a.nombre}</span>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={a.activo} onChange={(e) => intentar(() => consulta(supabase.from('adicionales').update({ activo: e.target.checked }).eq('id', a.id)), `${a.nombre}: ${e.target.checked ? 'se ofrece' : 'ya no se ofrece'}.`)} />
              {a.activo ? 'Activo' : 'Pausado'}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Reinicio({ onListo }) {
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  return (
    <section className="panel-tarjeta flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
      <div>
        <h2 className="font-bold">Datos de ejemplo</h2>
        <p className="text-sm text-slate-500">Vuelve a cargar los 30 alquileres, 24 pagos, 8 órdenes y la configuración inicial, con fechas a partir de hoy.</p>
      </div>
      <Boton variante="secundario" icono={RotateCcw} onClick={() => setAbierto(true)}>Reiniciar datos de ejemplo</Boton>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Reiniciar datos de ejemplo">
        <div className="space-y-3">
          <p className="text-sm">Se borran todos los alquileres, pagos, órdenes y cambios de configuración, y se vuelven a cargar los de ejemplo. Las cuentas de prueba se mantienen.</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton
            variante="peligro"
            className="w-full"
            cargando={enviando}
            onClick={async () => {
              setEnviando(true)
              setError('')
              try {
                await rpc('reiniciar_demo')
                setAbierto(false)
                onListo('Listo: los datos de ejemplo se cargaron de nuevo.')
              } catch (e) {
                setError(e.message)
              } finally {
                setEnviando(false)
              }
            }}
          >
            Sí, reiniciar
          </Boton>
        </div>
      </Modal>
    </section>
  )
}
