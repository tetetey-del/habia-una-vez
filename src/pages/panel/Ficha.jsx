import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarArrowDown, CalendarClock, XCircle, FileText, ShieldCheck, Lock, Ban, Check, Phone } from 'lucide-react'
import { useAlquiler, desgloseDe } from '../../lib/alquiler'
import { useCarga } from '../../lib/datos'
import { rpc } from '../../lib/supabase'
import { pesos, fechaHora, fechaDeTs, recibo, TIPO_MOVIMIENTO, CHECKLIST, diasEntre, hoyAR, fechaLarga } from '../../lib/formato'
import { descargarIcs, textoAvisoRiesgo, textoSaldo, textoConfirmacion } from '../../lib/compartir'
import { Desglose } from '../../components/Cotizador'
import { ModalReprogramar, ModalCompensacion, ModalCancelar, horarioDe } from '../../components/AccionesAlquiler'
import { ModalPago, BotonWhatsApp } from '../../components/PanelComun'
import { Aviso, Boton, Cargando, EstadoAlquiler, Modal, Campo } from '../../components/ui'

export default function Ficha() {
  const { id } = useParams()
  const { datos, error, cargando, recargar } = useAlquiler(id)
  const cuenta = useCarga(() => rpc('estado_de_cuenta', { p_alquiler: id }), [id])
  const [modal, setModal] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [anular, setAnular] = useState(null)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [cierre, setCierre] = useState({ retener: '0', motivo: '' })

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>

  const { alquiler: a, adicionales, movimientos, contratos, eventos } = datos
  const c = cuenta.datos
  const { ingreso, texto: horario } = horarioDe(a, adicionales)
  const dias = diasEntre(hoyAR(), a.fecha)
  const activo = ['pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado'].includes(a.estado)
  const admiteSaldo = ['senado', 'contrato_aceptado', 'en_riesgo', 'en_curso', 'realizado'].includes(a.estado) && c && Number(c.saldo) > 0
  const garantiaCobrada = c && Number(c.garantia_pagada) + Number(c.garantia_devuelta) > 0
  const portal = `${window.location.origin}/mis-fiestas`

  const actualizarTodo = () => {
    recargar()
    cuenta.recargar()
  }
  const listo = (texto) => {
    setModal(null)
    setMensaje(texto)
    setErrorAccion('')
    actualizarTodo()
  }
  const ejecutar = async (fn, exito) => {
    setTrabajando(true)
    setErrorAccion('')
    setMensaje('')
    try {
      await fn()
      setMensaje(exito)
      actualizarTodo()
    } catch (e) {
      setErrorAccion(e.message)
    } finally {
      setTrabajando(false)
    }
  }

  const textoWhatsApp =
    a.estado === 'en_riesgo' ? textoAvisoRiesgo(a, portal) : c && Number(c.saldo) > 0 && a.estado !== 'pre_reserva' ? textoSaldo({ ...a, saldo: c.saldo }) : textoConfirmacion(a)

  return (
    <div>
      <Link to="/panel/alquileres" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Alquileres
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-500">{a.codigo} <EstadoAlquiler estado={a.estado} grande /></p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Cumple de {a.homenajeado} ({a.edad})</h1>
          <p className="text-slate-600">{horario} · ingreso {ingreso} h</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
            <span className="font-semibold">{a.familia}</span>
            <a href={`tel:${a.celular}`} className="flex items-center gap-1 text-slate-500 hover:underline"><Phone className="h-3.5 w-3.5" /> {a.celular}</a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonWhatsApp celular={a.celular} texto={textoWhatsApp}>
            {a.estado === 'en_riesgo' ? 'Avisar a la familia' : 'Escribir'}
          </BotonWhatsApp>
          <Boton variante="secundario" tamano="sm" icono={CalendarArrowDown} onClick={() => descargarIcs(a)}>Calendario</Boton>
        </div>
      </header>

      {mensaje && <Aviso tipo="exito" className="mb-4">{mensaje}</Aviso>}
      {errorAccion && <Aviso tipo="error" className="mb-4" onActualizar={() => { setErrorAccion(''); actualizarTodo() }}>{errorAccion}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Próximo paso */}
          <section className="panel-tarjeta p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Próximo paso</h2>
            {a.estado === 'pre_reserva' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>Pre-reserva hasta el <strong>{fechaHora(a.vence_en)} h</strong>. Seña mínima {pesos(a.sena_requerida)}.</p>
                <Boton variante="oscuro" onClick={() => setModal('sena')}>Registrar seña</Boton>
              </div>
            )}
            {a.estado === 'senado' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>Falta que la familia acepte el contrato desde su portal.</p>
                <Boton variante="secundario" icono={ShieldCheck} cargando={trabajando} onClick={() => ejecutar(() => rpc('aceptar_contrato', { p_alquiler: a.id }), 'Contrato aceptado en nombre de la familia.')}>
                  Aceptar en su nombre
                </Boton>
              </div>
            )}
            {a.estado === 'contrato_aceptado' && <p>Turno firme. Falta cobrar el saldo antes del {c ? fechaLarga(c.vence_saldo) : '…'}.</p>}
            {a.estado === 'saldo_pagado' && (
              <p>Todo listo para la fiesta. {dias === 0 ? <Link to="/panel/hoja" className="font-bold underline">Ir a la hoja del turno</Link> : `Faltan ${dias} días.`}</p>
            )}
            {a.estado === 'en_curso' && <p>La fiesta está en curso. <Link to="/panel/hoja" className="font-bold underline">Ver la hoja del turno</Link></p>}
            {a.estado === 'realizado' && (
              <div className="space-y-3">
                {a.dano_reportado ? (
                  <Aviso tipo="alerta" titulo="Coordinación reportó un daño">{a.dano_reportado}</Aviso>
                ) : (
                  <p>La fiesta terminó sin daños reportados.</p>
                )}
                {garantiaCobrada && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo etiqueta={`Retener de la garantía (máx. ${pesos(Number(c.garantia_pagada) + Number(c.garantia_devuelta))})`}>
                      <input className="campo num" type="number" min={0} value={cierre.retener} onChange={(e) => setCierre({ ...cierre, retener: e.target.value })} />
                    </Campo>
                    <Campo etiqueta="Motivo de la retención">
                      <input className="campo" value={cierre.motivo} onChange={(e) => setCierre({ ...cierre, motivo: e.target.value })} placeholder="Solo si retenés algo" />
                    </Campo>
                  </div>
                )}
                <Boton
                  variante="oscuro"
                  icono={Lock}
                  cargando={trabajando}
                  onClick={() =>
                    ejecutar(async () => {
                      const r = await rpc('cerrar_alquiler', { p_alquiler: a.id, p_retener: Number(cierre.retener) || 0, p_motivo: cierre.motivo })
                      if (r.preventivas > 0) setTimeout(() => setMensaje(`Alquiler cerrado. Se sumó un evento a cada juego y ${r.preventivas === 1 ? 'se creó 1 orden preventiva' : `se crearon ${r.preventivas} órdenes preventivas`} por frecuencia.`), 0)
                    }, 'Alquiler cerrado. Se sumó un evento al contador de cada juego.')
                  }
                >
                  Cerrar alquiler
                </Boton>
              </div>
            )}
            {a.estado === 'en_riesgo' && (
              <div className="space-y-3">
                <p>
                  {a.bloqueado
                    ? 'Cierre del salón: el traslado es obligatorio. Si no hay acuerdo, cancelá por causa del salón (devuelve el 100 %).'
                    : 'Un juego principal quedó fuera de servicio. La familia elige desde su portal, o lo resolvés acá con ella.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Boton variante="oscuro" icono={CalendarClock} onClick={() => setModal('reprogramar')}>Trasladar sin costo</Boton>
                  {!a.bloqueado && <Boton variante="secundario" onClick={() => setModal('compensacion')}>Mantener con compensación</Boton>}
                  {a.bloqueado && <Boton variante="peligro" icono={Ban} onClick={() => setModal('cancelar')}>Cancelar por el salón</Boton>}
                </div>
              </div>
            )}
            {a.estado === 'cerrado' && (
              <p>
                Cerrado el {fechaDeTs(a.cerrado_en)}.
                {Number(a.garantia_retenida) > 0 && ` Se retuvieron ${pesos(a.garantia_retenida)} de la garantía: ${a.motivo_retencion}.`}
              </p>
            )}
            {a.estado === 'cancelado' && <p>Cancelado {a.cancelado_por === 'salon' ? 'por el salón' : 'por la familia'} el {fechaDeTs(a.cancelado_en)}: {a.motivo_cancelacion}</p>}
            {a.estado === 'vencido' && <p>La pre-reserva venció sin seña y el turno se liberó.</p>}
          </section>

          {/* Cuenta */}
          <section className="panel-tarjeta p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Cobranzas</h2>
              <div className="flex flex-wrap gap-2">
                {admiteSaldo && <Boton tamano="sm" variante="oscuro" onClick={() => setModal('saldo')}>Registrar saldo</Boton>}
                {!garantiaCobrada && ['senado', 'contrato_aceptado', 'saldo_pagado', 'en_curso', 'realizado', 'en_riesgo'].includes(a.estado) && (
                  <Boton tamano="sm" variante="secundario" onClick={() => setModal('garantia')}>Cobrar garantía</Boton>
                )}
              </div>
            </div>
            {c && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Pagado</p>
                  <p className="num text-lg font-bold">{pesos(c.pagado)}</p>
                </div>
                {Number(c.recargos) !== 0 && (
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Recargos</p>
                    <p className="num text-lg font-bold">{pesos(c.recargos)}</p>
                  </div>
                )}
                {Number(c.compensaciones) !== 0 && (
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs text-slate-500">Compensación</p>
                    <p className="num text-lg font-bold">{pesos(c.compensaciones)}</p>
                  </div>
                )}
                {!['cancelado', 'vencido'].includes(a.estado) && (
                  <div className={`rounded-lg p-2 ${Number(c.saldo) > 0 ? (c.saldo_vencido ? 'bg-red-50' : 'bg-amber-50') : 'bg-emerald-50'}`}>
                    <p className="text-xs text-slate-500">Saldo{c.saldo_vencido && Number(c.saldo) > 0 ? ' (fuera de plazo)' : ''}</p>
                    <p className="num text-lg font-bold">{pesos(c.saldo)}</p>
                  </div>
                )}
              </div>
            )}
            {movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay movimientos.</p>
            ) : (
              <>
              <ul className="divide-y divide-slate-100 text-sm md:hidden">
                {movimientos.map((m) => (
                  <li key={m.id} className={`flex items-start justify-between gap-3 py-2 ${m.anulado ? 'text-slate-400' : ''}`}>
                    <span className="min-w-0">
                      <span className="font-semibold">{TIPO_MOVIMIENTO[m.tipo]}</span>
                      {m.anulado && <span className="ml-1 rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700">ANULADO</span>}
                      <span className="block text-xs text-slate-500">
                        {m.recibo ? `Recibo ${recibo(m.recibo)} · ` : ''}{fechaDeTs(m.creado_en)}{m.medio ? ` · ${m.medio}` : ''}
                      </span>
                      {m.anulado && <span className="block text-xs">{m.motivo_anulacion}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`num block font-semibold ${m.anulado ? 'line-through' : ''}`}>{pesos(m.monto)}</span>
                      {m.recibo && !m.anulado && !['cancelado', 'cerrado'].includes(a.estado) && (
                        <button onClick={() => { setAnular(m); setMotivoAnular('') }} className="text-xs font-bold text-red-600">Anular</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr><th className="py-1">Recibo</th><th>Fecha</th><th>Concepto</th><th>Medio</th><th className="text-right">Monto</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimientos.map((m) => (
                      <tr key={m.id} className={m.anulado ? 'text-slate-400' : ''}>
                        <td className="num py-2 font-bold">{recibo(m.recibo) || '—'}</td>
                        <td className="num">{fechaDeTs(m.creado_en)}</td>
                        <td>
                          {TIPO_MOVIMIENTO[m.tipo]}
                          {m.anulado && <span className="ml-1 rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700">ANULADO</span>}
                          <span className="block text-xs text-slate-400">{m.anulado ? m.motivo_anulacion : m.detalle}</span>
                        </td>
                        <td>{m.medio || ''}</td>
                        <td className={`num text-right font-semibold ${m.anulado ? 'line-through' : ''}`}>{pesos(m.monto)}</td>
                        <td className="pl-2 text-right">
                          {m.recibo && !m.anulado && !['cancelado', 'cerrado'].includes(a.estado) && (
                            <button onClick={() => { setAnular(m); setMotivoAnular('') }} className="text-xs font-bold text-red-600 hover:underline">Anular</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </section>

          <section className="panel-tarjeta p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Desglose del precio</h2>
            <Desglose d={desgloseDe(a, adicionales)} variante="panel" mostrarSena={a.estado === 'pre_reserva'} />
            <p className="mt-2 text-xs text-slate-500">Cotizado el {fechaDeTs(a.cotizado_en + 'T12:00')}. {a.senado_en ? 'Precio congelado con la seña.' : ''}</p>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel-tarjeta p-4 text-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Datos</h2>
            <p><strong>{a.chicos}</strong> chicos y <strong>{a.adultos}</strong> adultos</p>
            {a.motivo_excedente && <p className="mt-1 text-slate-600">Tope superado: {a.motivo_excedente}</p>}
            <p className="mt-1">{a.quiere_garantia ? 'Con garantía por roturas' : 'Sin garantía'}</p>
            {a.reprogramaciones > 0 && <p className="mt-1">Ya usó la reprogramación sin cargo.</p>}
            {a.notas && <p className="mt-1 text-slate-600">Notas: {a.notas}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {activo && a.reprogramaciones === 0 && dias > 15 && (
                <Boton tamano="sm" variante="secundario" icono={CalendarClock} onClick={() => setModal('reprogramar')}>Reprogramar</Boton>
              )}
              {(activo || a.estado === 'en_riesgo') && !a.bloqueado && (
                <Boton tamano="sm" variante="secundario" icono={XCircle} onClick={() => setModal('cancelar')}>Cancelar</Boton>
              )}
            </div>
          </section>

          <section className="panel-tarjeta p-4 text-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Contrato</h2>
            {contratos[0] ? (
              <>
                <p>Aceptado por {contratos[0].aceptado_por_nombre} el {fechaHora(contratos[0].aceptado_en)} h (versión {contratos[0].version}).</p>
                <Boton tamano="sm" variante="secundario" icono={FileText} className="mt-2" onClick={() => setModal('contrato')}>Ver versión congelada</Boton>
              </>
            ) : (
              <p className="text-slate-500">Sin contrato aceptado.</p>
            )}
          </section>

          {(a.iniciado_en || Object.keys(a.hoja?.checklist || {}).length > 0) && (
            <section className="panel-tarjeta p-4 text-sm">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Hoja del turno</h2>
              <ul className="space-y-1">
                {CHECKLIST.map((it) => (
                  <li key={it.clave} className={`flex items-center gap-2 ${a.hoja?.checklist?.[it.clave] ? '' : 'text-slate-400'}`}>
                    <Check className={`h-4 w-4 ${a.hoja?.checklist?.[it.clave] ? 'text-emerald-600' : 'opacity-30'}`} /> {it.texto}
                  </li>
                ))}
              </ul>
              {a.hoja?.notas && <p className="mt-2 text-slate-600">“{a.hoja.notas}”</p>}
            </section>
          )}

          <section className="panel-tarjeta p-4 text-sm">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Historial</h2>
            <ol className="space-y-2 border-l-2 border-slate-100 pl-3">
              {eventos.map((e) => (
                <li key={e.id}>
                  <p className="num text-xs text-slate-400">{fechaHora(e.creado_en)}</p>
                  <p>{e.texto}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <ModalPago abierto={['sena', 'saldo', 'garantia'].includes(modal)} tipo={modal} onCerrar={() => setModal(null)} alquiler={a} cuenta={c} onListo={listo} />
      <ModalReprogramar abierto={modal === 'reprogramar'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} variante="panel" />
      <ModalCompensacion abierto={modal === 'compensacion'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} />
      <ModalCancelar abierto={modal === 'cancelar'} onCerrar={() => setModal(null)} alquiler={a} onListo={listo} esAdmin />
      <Modal abierto={modal === 'contrato'} onCerrar={() => setModal(null)} titulo="Contrato aceptado" ancho="max-w-2xl">
        <p className="whitespace-pre-line text-sm leading-relaxed">{contratos[0]?.texto}</p>
      </Modal>
      <Modal abierto={Boolean(anular)} onCerrar={() => setAnular(null)} titulo={`Anular recibo ${recibo(anular?.recibo)}`}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">El recibo queda visible como anulado y el saldo se corrige. No se borra nada.</p>
          <Campo etiqueta="Motivo">
            <input className="campo" value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} placeholder="Ej.: transferencia rechazada" />
          </Campo>
          <Boton
            variante="peligro"
            className="w-full"
            cargando={trabajando}
            disabled={!motivoAnular.trim()}
            onClick={async () => {
              const m = anular
              setAnular(null)
              await ejecutar(() => rpc('anular_pago', { p_movimiento: m.id, p_motivo: motivoAnular }), `Recibo ${recibo(m.recibo)} anulado. El saldo ya está corregido.`)
            }}
          >
            Anular pago de {pesos(anular?.monto)}
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
