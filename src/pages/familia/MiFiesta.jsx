import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarArrowDown, FilePen, CalendarClock, XCircle, AlertTriangle, Clock, Receipt } from 'lucide-react'
import { useAlquiler, desgloseDe } from '../../lib/alquiler'
import { useCarga } from '../../lib/datos'
import { rpc } from '../../lib/supabase'
import { pesos, fechaLarga, fechaHora, fechaDeTs, recibo, TIPO_MOVIMIENTO, diasEntre, hoyAR } from '../../lib/formato'
import { descargarIcs } from '../../lib/compartir'
import { Desglose } from '../../components/Cotizador'
import { ModalReprogramar, ModalCompensacion, ModalCancelar, horarioDe } from '../../components/AccionesAlquiler'
import { Aviso, Boton, Cargando, EstadoAlquiler } from '../../components/ui'

export default function MiFiesta() {
  const { id } = useParams()
  const { datos, error, cargando, recargar } = useAlquiler(id)
  const cuenta = useCarga(() => rpc('estado_de_cuenta', { p_alquiler: id }), [id])
  const [modal, setModal] = useState(null)
  const [mensaje, setMensaje] = useState('')

  if (cargando && !datos) return <Cargando />
  if (error) return <div className="mx-auto max-w-2xl px-4 py-6"><Aviso tipo="error" onActualizar={recargar}>{error}</Aviso></div>

  const { alquiler: a, adicionales, movimientos, contratos } = datos
  const c = cuenta.datos
  const { ingreso, texto: horario } = horarioDe(a, adicionales)
  const dias = diasEntre(hoyAR(), a.fecha)
  const activo = ['pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado'].includes(a.estado)
  const puedeReprogramar = activo && a.reprogramaciones === 0 && dias > 15
  const puedeCancelar = activo || a.estado === 'en_riesgo'
  const pagos = movimientos

  const listo = (texto) => {
    setModal(null)
    setMensaje(texto)
    recargar()
    cuenta.recargar()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <Link to="/mis-fiestas" className="inline-flex items-center gap-1 text-sm font-bold text-violeta">
        <ArrowLeft className="h-4 w-4" /> Mis fiestas
      </Link>

      {/* Encabezado */}
      <header className="relative overflow-hidden rounded-3xl bg-violeta p-5 text-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amarillo/30" aria-hidden="true" />
        <p className="text-sm font-bold text-amarillo">{a.codigo}</p>
        <h1 className="text-3xl font-extrabold">Cumple de {a.homenajeado}</h1>
        <p className="text-white/90">{a.edad} años · {a.chicos} chicos y {a.adultos} adultos</p>
        <p className="mt-3 font-bold">{horario}</p>
        <p className="text-sm text-white/80">Ingreso desde las {ingreso} h</p>
        <div className="mt-3"><EstadoAlquiler estado={a.estado} familia grande /></div>
      </header>

      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}

      {/* Qué sigue */}
      {a.estado === 'en_riesgo' && (
        <section className="rounded-3xl bg-coral-claro p-5 ring-2 ring-coral">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-coral"><AlertTriangle className="h-6 w-6" /> Necesitamos que elijas</h2>
          <p className="mt-1">
            {a.bloqueado
              ? 'El salón va a estar cerrado por un arreglo. Elegí otro turno sin costo; si ninguno te sirve, te devolvemos todo lo pagado.'
              : 'Uno de los juegos principales quedó fuera de servicio. Podés pasar la fiesta a otro turno libre sin costo o quedarte en tu fecha con una compensación.'}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Boton onClick={() => setModal('reprogramar')} icono={CalendarClock}>Elegir otro turno</Boton>
            {a.bloqueado ? (
              <Boton variante="secundario" onClick={() => setModal('cancelar')}>Prefiero cancelar</Boton>
            ) : (
              <Boton variante="amarillo" onClick={() => setModal('compensacion')}>Seguir en mi fecha</Boton>
            )}
          </div>
        </section>
      )}
      {a.estado === 'pre_reserva' && (
        <Aviso tipo="alerta" titulo={`Te guardamos el turno hasta el ${fechaHora(a.vence_en)} h`}>
          Para confirmarlo, señá {pesos(a.sena_requerida)} en el salón o por transferencia. Si no llega la seña, el turno se libera solo.
        </Aviso>
      )}
      {a.estado === 'senado' && (
        <section className="flex flex-col gap-3 rounded-3xl bg-amarillo p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold">¡Recibimos tu seña!</h2>
            <p>Leé y aceptá el contrato para que el turno quede firme.</p>
          </div>
          <Link to={`/mis-fiestas/${a.id}/contrato`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violeta px-5 py-3 font-bold text-white">
            <FilePen className="h-5 w-5" /> Ver contrato
          </Link>
        </section>
      )}

      {/* Cuenta */}
      {c && !['vencido'].includes(a.estado) && (
        <section className="tarjeta p-5">
          <h2 className="mb-3 font-titulo text-xl font-bold">Tu cuenta</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-turquesa-claro p-3">
              <dt className="text-xs font-bold uppercase text-teal-800">Pagado</dt>
              <dd className="num font-titulo text-2xl font-extrabold text-teal-900">{pesos(c.pagado)}</dd>
            </div>
            <div className={`rounded-2xl p-3 ${c.saldo > 0 ? 'bg-amarillo-claro' : 'bg-violeta-claro'}`}>
              <dt className="text-xs font-bold uppercase text-tinta-suave">{a.estado === 'cancelado' ? 'Sin cobrar' : 'Saldo'}</dt>
              <dd className="num font-titulo text-2xl font-extrabold">{pesos(Math.max(0, c.saldo))}</dd>
            </div>
          </dl>
          {c.saldo > 0 && !['cancelado', 'pre_reserva'].includes(a.estado) && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-coral" />
              {c.saldo_vencido
                ? `El plazo venció el ${fechaLarga(c.vence_saldo)}: al pagarlo se suma un recargo de ${pesos(c.recargo_si_paga_hoy)}.`
                : `Pagalo hasta el ${fechaLarga(c.vence_saldo)}. Después se suma un recargo del ${Number(c.recargo_pct)} %.`}
            </p>
          )}
          {pagos.length > 0 && (
            <ul className="mt-4 divide-y divide-tinta/5 text-sm">
              {pagos.map((m) => (
                <li key={m.id} className={`flex items-center justify-between gap-3 py-2 ${m.anulado ? 'opacity-50' : ''}`}>
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-tinta-suave" />
                    <span>
                      <span className="font-semibold">{TIPO_MOVIMIENTO[m.tipo]}</span>
                      <span className="block text-xs text-tinta-suave">
                        {fechaDeTs(m.creado_en)}{m.recibo ? ` · Recibo ${recibo(m.recibo)}` : ''}{m.anulado ? ' · Anulado' : ''}
                      </span>
                    </span>
                  </span>
                  <span className={`num font-bold ${m.anulado ? 'line-through' : ''} ${m.monto < 0 ? 'text-coral' : ''}`}>{pesos(m.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Detalle */}
      <section className="tarjeta p-5">
        <h2 className="mb-2 font-titulo text-xl font-bold">Tu fiesta</h2>
        <Desglose d={desgloseDe(a, adicionales)} mostrarSena={a.estado === 'pre_reserva'} />
        {a.quiere_garantia && <p className="mt-2 text-sm text-tinta-suave">Con garantía por roturas aparte.</p>}
      </section>

      {/* Acciones */}
      {!['vencido', 'cancelado'].includes(a.estado) && (
        <section className="grid gap-2 sm:grid-cols-2">
          <Boton variante="secundario" icono={CalendarArrowDown} onClick={() => descargarIcs(a)}>Agregar al calendario</Boton>
          {contratos.length > 0 && (
            <Link to={`/mis-fiestas/${a.id}/contrato`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold ring-1 ring-tinta/15">
              <FilePen className="h-4 w-4" /> Ver contrato firmado
            </Link>
          )}
          {puedeReprogramar && <Boton variante="secundario" icono={CalendarClock} onClick={() => setModal('reprogramar')}>Cambiar la fecha</Boton>}
          {puedeCancelar && a.estado !== 'en_riesgo' && (
            <Boton variante="fantasma" icono={XCircle} onClick={() => setModal('cancelar')}>Cancelar la fiesta</Boton>
          )}
        </section>
      )}
      {activo && !puedeReprogramar && a.reprogramaciones === 0 && (
        <p className="text-center text-xs text-tinta-suave">Los cambios de fecha sin cargo se piden con más de 15 días de anticipación.</p>
      )}

      <ModalReprogramar abierto={modal === 'reprogramar'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} />
      <ModalCompensacion abierto={modal === 'compensacion'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} />
      <ModalCancelar abierto={modal === 'cancelar'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} />
    </div>
  )
}
