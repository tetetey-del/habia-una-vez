import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { pesos, hora, fechaHora, primeraMayuscula, diaSemanaCorto, fechaCorta, hoyAR, sumarDias } from '../../lib/formato'
import { textoAvisoRiesgo } from '../../lib/compartir'
import { Aviso, Cargando, Encabezado, EstadoAlquiler, Vacio } from '../../components/ui'
import { Numero, BotonWhatsApp } from '../../components/PanelComun'

export default function Tablero() {
  const navegar = useNavigate()
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const t = await rpc('tablero')
    const hoy = hoyAR()
    const [proximos, riesgo, porVencer] = await Promise.all([
      consulta(
        supabase.from('v_alquileres').select('id, codigo, fecha, hora_inicio, estado, familia, homenajeado, saldo')
          .gte('fecha', hoy).lte('fecha', sumarDias(hoy, 7)).not('estado', 'in', '(vencido,cancelado)').order('fecha').order('hora_inicio'),
      ),
      consulta(supabase.from('v_alquileres').select('*').eq('estado', 'en_riesgo').order('fecha')),
      consulta(supabase.from('v_alquileres').select('id, codigo, familia, celular, homenajeado, fecha, vence_en, sena_requerida').eq('estado', 'pre_reserva').order('vence_en').limit(5)),
    ])
    return { t, proximos, riesgo, porVencer }
  })

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>
  const { t, proximos, riesgo, porVencer } = datos
  const portal = `${window.location.origin}/mis-fiestas`

  return (
    <div>
      <Encabezado titulo="Tablero" subtitulo={primeraMayuscula(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero titulo="Turnos próximos 7 días" valor={t.proximos_7} onClick={() => navegar('/panel/agenda')} />
        <Numero titulo="En riesgo" valor={t.en_riesgo} tono={t.en_riesgo > 0 ? 'peligro' : 'neutro'} detalle="Por mantenimiento" />
        <Numero titulo="Pre-reservas" valor={t.pre_reservas} tono={t.por_vencer > 0 ? 'alerta' : 'neutro'} detalle={`${t.por_vencer} ${t.por_vencer === 1 ? 'vence' : 'vencen'} en menos de 12 h`} onClick={() => navegar('/panel/alquileres?estado=pre_reserva')} />
        <Numero titulo="Por cerrar" valor={t.por_cerrar} detalle="Realizados sin cerrar" onClick={() => navegar('/panel/alquileres?estado=realizado')} />
        <Numero titulo="Ingresos del mes" valor={pesos(t.ingresos_mes)} tono="violeta" onClick={() => navegar('/panel/informes')} />
        <Numero titulo="Saldos a cobrar" valor={pesos(t.deuda_total)} detalle={`${t.saldos_vencidos} fuera de plazo`} tono={t.saldos_vencidos > 0 ? 'alerta' : 'neutro'} />
        <Numero titulo="Órdenes abiertas" valor={t.ordenes_abiertas} detalle={`${t.ordenes_criticas} ${t.ordenes_criticas === 1 ? 'crítica' : 'críticas'}`} tono={t.ordenes_criticas > 0 ? 'peligro' : 'neutro'} onClick={() => navegar('/panel/ordenes')} />
      </div>

      {riesgo.length > 0 && (
        <section className="mt-6 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-red-800"><AlertTriangle className="h-5 w-5" /> Familias a avisar</h2>
          <ul className="space-y-2">
            {riesgo.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 ring-1 ring-red-100">
                <Link to={`/panel/alquileres/${a.id}`} className="min-w-0">
                  <p className="font-bold">{a.codigo} · {a.familia}</p>
                  <p className="text-sm text-slate-500">
                    {primeraMayuscula(diaSemanaCorto(a.fecha))} {fechaCorta(a.fecha)} · {hora(a.hora_inicio)} h{a.bloqueado ? ' · Cierre del salón' : ''}
                  </p>
                </Link>
                <BotonWhatsApp celular={a.celular} texto={textoAvisoRiesgo(a, portal)}>Avisar</BotonWhatsApp>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel-tarjeta p-4">
          <h2 className="mb-3 font-bold">Próximos turnos</h2>
          {proximos.length === 0 ? (
            <Vacio titulo="Sin turnos en los próximos 7 días" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {proximos.map((a) => (
                <li key={a.id}>
                  <Link to={`/panel/alquileres/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                    <span className="flex items-center gap-3">
                      <span className="num w-20 text-sm font-bold text-slate-500">{primeraMayuscula(diaSemanaCorto(a.fecha))} {hora(a.hora_inicio)}</span>
                      <span>
                        <span className="block font-semibold">{a.homenajeado}</span>
                        <span className="block text-xs text-slate-500">{a.familia}</span>
                      </span>
                    </span>
                    <EstadoAlquiler estado={a.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-tarjeta p-4">
          <h2 className="mb-3 font-bold">Pre-reservas que vencen primero</h2>
          {porVencer.length === 0 ? (
            <Vacio titulo="No hay pre-reservas esperando seña" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {porVencer.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link to={`/panel/alquileres/${a.id}`} className="min-w-0">
                    <span className="block font-semibold">{a.codigo} · {a.familia}</span>
                    <span className="block text-xs text-slate-500">Vence {fechaHora(a.vence_en)} h · seña {pesos(a.sena_requerida)}</span>
                  </Link>
                  <BotonWhatsApp
                    celular={a.celular}
                    texto={`¡Hola ${a.familia.split(' ')[0]}! Te recordamos que el turno para el cumple de ${a.homenajeado} está guardado hasta el ${fechaHora(a.vence_en)} h. La seña es de ${pesos(a.sena_requerida)}.`}
                  >
                    Recordar
                  </BotonWhatsApp>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
