import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { pesos, fechaDeTs, recibo, TIPO_MOVIMIENTO, hoyAR } from '../../lib/formato'
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Vacio } from '../../components/ui'
import { Numero } from '../../components/PanelComun'

const PAGOS = ['sena', 'saldo', 'garantia']

export default function Cobranzas() {
  const hoy = hoyAR()
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [params] = useSearchParams()
  const [tipo, setTipo] = useState(params.get('tipo') || '')
  const [busqueda, setBusqueda] = useState('')
  const [anular, setAnular] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  // Rango en hora argentina (UTC-3)
  const { datos, error, cargando, recargar } = useCarga(
    () =>
      consulta(
        supabase.from('v_movimientos').select('*')
          .gte('creado_en', `${desde}T00:00:00-03:00`).lte('creado_en', `${hasta}T23:59:59-03:00`)
          .order('creado_en', { ascending: false }),
      ),
    [desde, hasta],
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (datos || []).filter((m) => {
      if (tipo === 'pagos' && !PAGOS.includes(m.tipo)) return false
      if (tipo === 'salidas' && m.monto >= 0) return false
      if (tipo === 'anulados' && !m.anulado) return false
      if (q && !`${m.codigo} ${m.familia} ${recibo(m.recibo)}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [datos, tipo, busqueda])

  const totales = useMemo(() => {
    const t = { ingresos: 0, salidas: 0, anulados: 0 }
    for (const m of datos || []) {
      if (m.anulado) t.anulados += 1
      else if (PAGOS.includes(m.tipo)) t.ingresos += Number(m.monto)
      else if (m.tipo === 'devolucion' || m.tipo === 'devolucion_garantia') t.salidas += Number(m.monto)
    }
    return t
  }, [datos])

  const confirmarAnulacion = async () => {
    setEnviando(true)
    setErrorAccion('')
    try {
      await rpc('anular_pago', { p_movimiento: anular.id, p_motivo: motivo })
      setMensaje(`Recibo ${recibo(anular.recibo)} anulado. El saldo de ${anular.codigo} ya está corregido.`)
      setAnular(null)
      recargar()
    } catch (e) {
      setErrorAccion(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <Encabezado titulo="Cobranzas" />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Numero titulo="Cobrado en el período" valor={pesos(totales.ingresos)} tono="violeta" />
        <Numero titulo="Devoluciones" valor={pesos(totales.salidas)} />
        <Numero titulo="Recibos anulados" valor={totales.anulados} tono={totales.anulados ? 'alerta' : 'neutro'} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Campo etiqueta="Desde"><input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo etiqueta="Hasta"><input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Campo etiqueta="Mostrar">
          <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todo</option>
            <option value="pagos">Solo pagos con recibo</option>
            <option value="salidas">Devoluciones y compensaciones</option>
            <option value="anulados">Anulados</option>
          </select>
        </Campo>
        <label className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, familia o recibo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
      </div>

      {mensaje && <Aviso tipo="exito" className="mb-3">{mensaje}</Aviso>}
      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : filtrados.length === 0 ? (
        <Vacio titulo="No hay movimientos en ese período" />
      ) : (
        <div className="panel-tarjeta overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Recibo</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Alquiler</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Medio</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((m) => (
                <tr key={m.id} className={m.anulado ? 'bg-red-50/40 text-slate-400' : ''}>
                  <td className="num px-3 py-2 font-bold">{recibo(m.recibo) || '—'}</td>
                  <td className="num px-3 py-2">{fechaDeTs(m.creado_en)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/panel/alquileres/${m.alquiler_id}`} className="font-semibold hover:underline">{m.codigo}</Link>
                    <span className="block text-xs text-slate-500">{m.familia}</span>
                  </td>
                  <td className="px-3 py-2">
                    {TIPO_MOVIMIENTO[m.tipo]}
                    {m.anulado && <span className="ml-1 rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700">ANULADO</span>}
                    {m.anulado && <span className="block text-xs">{m.motivo_anulacion}</span>}
                  </td>
                  <td className="px-3 py-2">{m.medio || ''}</td>
                  <td className={`num px-3 py-2 text-right font-semibold ${m.anulado ? 'line-through' : m.monto < 0 ? 'text-red-600' : ''}`}>{pesos(m.monto)}</td>
                  <td className="px-3 py-2 text-right">
                    {m.recibo && !m.anulado && (
                      <button onClick={() => { setAnular(m); setMotivo(''); setErrorAccion('') }} className="text-xs font-bold text-red-600 hover:underline">Anular</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal abierto={Boolean(anular)} onCerrar={() => setAnular(null)} titulo={`Anular recibo ${recibo(anular?.recibo)}`}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{anular?.codigo} · {anular?.familia} · {pesos(anular?.monto)}</p>
          <Campo etiqueta="Motivo"><input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: se cargó dos veces" /></Campo>
          {errorAccion && <Aviso tipo="error" onActualizar={() => { setAnular(null); recargar() }}>{errorAccion}</Aviso>}
          <Boton variante="peligro" className="w-full" cargando={enviando} disabled={!motivo.trim()} onClick={confirmarAnulacion}>Anular</Boton>
        </div>
      </Modal>
    </div>
  )
}
