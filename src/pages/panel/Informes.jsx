import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { rpc } from '../../lib/supabase'
import { useCarga } from '../../lib/datos'
import { pesos, fechaCorta, hoyAR, TIPO_MOVIMIENTO, ORDEN_ESTADOS, aFecha, isoDe } from '../../lib/formato'
import { descargarCsv } from '../../lib/compartir'
import { Aviso, Boton, Campo, Cargando, Encabezado, EstadoAlquiler, Vacio } from '../../components/ui'
import { Numero } from '../../components/PanelComun'

function mesDe(iso) {
  const f = aFecha(iso)
  return { desde: isoDe(new Date(f.getFullYear(), f.getMonth(), 1, 12)), hasta: isoDe(new Date(f.getFullYear(), f.getMonth() + 1, 0, 12)) }
}

export default function Informes() {
  const navegar = useNavigate()
  const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const [rango, setRango] = useState(() => mesDe(hoyAR()))
  const { datos, error, cargando, recargar } = useCarga(() => rpc('informe', { p_desde: rango.desde, p_hasta: rango.hasta }), [rango.desde, rango.hasta])

  const mover = (meses) => {
    const f = aFecha(rango.desde)
    setRango(mesDe(isoDe(new Date(f.getFullYear(), f.getMonth() + meses, 1, 12))))
  }

  const bajarCsv = () =>
    descargarCsv(
      `ingresos-${rango.desde}-a-${rango.hasta}.csv`,
      [
        { titulo: 'Recibo', valor: (p) => p.recibo },
        { titulo: 'Fecha', valor: (p) => p.fecha },
        { titulo: 'Alquiler', valor: (p) => p.alquiler },
        { titulo: 'Familia', valor: (p) => p.familia },
        { titulo: 'Concepto', valor: (p) => TIPO_MOVIMIENTO[p.tipo] },
        { titulo: 'Medio', valor: (p) => p.medio },
        { titulo: 'Monto', valor: (p) => Number(p.monto).toFixed(2) },
      ],
      datos.pagos,
    )

  const salidas = datos ? Number(datos.por_tipo?.devolucion || 0) + Number(datos.por_tipo?.devolucion_garantia || 0) : 0
  const deuda = datos ? datos.deudas.reduce((s, d) => s + Number(d.saldo), 0) : 0

  return (
    <div>
      <Encabezado titulo="Informes" subtitulo="Ingresos, deudas y mantenimiento del período.">
        <Boton variante="secundario" onClick={() => mover(-1)}>Mes anterior</Boton>
        <Boton variante="secundario" onClick={() => mover(1)}>Mes siguiente</Boton>
      </Encabezado>

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <Campo etiqueta="Desde"><input type="date" className="campo" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} /></Campo>
        <Campo etiqueta="Hasta"><input type="date" className="campo" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} /></Campo>
      </div>

      {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
      {cargando && !datos ? (
        <Cargando />
      ) : datos && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero titulo="Ingresos" valor={pesos(datos.ingresos)} detalle={`${datos.pagos.length} pagos no anulados`} tono="violeta" onClick={() => ir('inf-pagos')} />
            <Numero titulo="Devoluciones" valor={pesos(salidas)} detalle={datos.anulados.cantidad > 0 ? `${datos.anulados.cantidad} recibos anulados aparte` : 'Sin anulaciones'} onClick={() => navegar('/panel/cobranzas?tipo=salidas')} />
            <Numero titulo="Deudas al día de hoy" valor={pesos(deuda)} detalle={`${datos.deudas.length} alquileres con saldo`} tono={deuda > 0 ? 'alerta' : 'neutro'} onClick={() => ir('inf-deudas')} />
            <Numero titulo="Costo de mantenimiento" valor={pesos(datos.mantenimiento.costo)} detalle={`${datos.mantenimiento.ordenes} órdenes del período`} onClick={() => ir('inf-mantenimiento')} />
          </div>

          <section id="inf-pagos" className="panel-tarjeta scroll-mt-20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Pagos del período</h2>
              <Boton tamano="sm" variante="oscuro" icono={Download} disabled={datos.pagos.length === 0} onClick={bajarCsv}>Descargar CSV</Boton>
            </div>
            {datos.pagos.length === 0 ? (
              <Vacio titulo="No hubo pagos en este período" />
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1">Recibo</th><th>Fecha</th><th>Alquiler</th><th>Familia</th><th>Concepto</th><th className="text-right">Monto</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datos.pagos.map((p) => (
                      <tr key={p.recibo}>
                        <td className="num py-1.5 font-bold">{p.recibo}</td>
                        <td className="num">{fechaCorta(p.fecha)}</td>
                        <td>{p.alquiler}</td>
                        <td>{p.familia}</td>
                        <td>{TIPO_MOVIMIENTO[p.tipo]}</td>
                        <td className="num text-right font-semibold">{pesos(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold"><td colSpan={5} className="py-2">Total</td><td className="num text-right">{pesos(datos.ingresos)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section id="inf-deudas" className="panel-tarjeta scroll-mt-20 p-4">
              <h2 className="mb-3 font-bold">Saldos pendientes</h2>
              {datos.deudas.length === 0 ? (
                <Vacio titulo="No hay saldos pendientes" />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {datos.deudas.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                      <Link to={`/panel/alquileres/${d.id}`} className="hover:underline">
                        <span className="font-semibold">{d.alquiler}</span> · {d.familia}
                        <span className="block text-xs text-slate-500">{fechaCorta(d.fecha)}{d.vencido ? ' · fuera de plazo' : ''}</span>
                      </Link>
                      <span className={`num font-bold ${d.vencido ? 'text-red-600' : ''}`}>{pesos(d.saldo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="inf-mantenimiento" className="panel-tarjeta scroll-mt-20 p-4">
              <h2 className="mb-3 font-bold">Mantenimiento por juego</h2>
              {datos.mantenimiento.por_juego.length === 0 ? (
                <Vacio titulo="Sin órdenes en el período" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {datos.mantenimiento.por_juego.map((j) => {
                    const max = Math.max(...datos.mantenimiento.por_juego.map((x) => Number(x.costo)), 1)
                    return (
                      <li key={j.juego}>
                        <div className="flex justify-between"><span>{j.juego} <span className="text-slate-400">({j.ordenes})</span></span><span className="num font-semibold">{pesos(j.costo)}</span></div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-700" style={{ width: `${(Number(j.costo) / max) * 100}%` }} /></div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="panel-tarjeta p-4">
            <h2 className="mb-3 font-bold">Alquileres con fecha en el período</h2>
            <div className="flex flex-wrap gap-2">
              {ORDEN_ESTADOS.filter((e) => datos.alquileres[e]).map((e) => (
                <span key={e} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
                  <EstadoAlquiler estado={e} /> <span className="num font-bold">{datos.alquileres[e]}</span>
                </span>
              ))}
              {Object.keys(datos.alquileres).length === 0 && <p className="text-sm text-slate-500">Ninguno.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

