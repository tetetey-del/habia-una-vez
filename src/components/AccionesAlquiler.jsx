import { useEffect, useState } from 'react'
import { rpc, supabase } from '../lib/supabase'
import { pesos, fechaLarga, hora, primeraMayuscula } from '../lib/formato'
import SelectorTurno from './SelectorTurno'
import { Aviso, Boton, Campo, Modal, Cargando } from './ui'

/** Reprogramar (una vez, con más de 15 días) o trasladar un alquiler en riesgo */
export function ModalReprogramar({ abierto, onCerrar, alquiler, onListo, variante = 'publico' }) {
  const [eleccion, setEleccion] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const traslado = alquiler.estado === 'en_riesgo'

  useEffect(() => {
    if (abierto) {
      setEleccion(null)
      setError('')
    }
  }, [abierto])

  const confirmar = async () => {
    setEnviando(true)
    setError('')
    try {
      await rpc('reprogramar_alquiler', { p_alquiler: alquiler.id, p_fecha: eleccion.fecha, p_turno: eleccion.turno_id })
      onListo(traslado ? '¡Listo! Pasamos tu fiesta al nuevo turno, sin costo.' : '¡Listo! Reprogramamos tu fiesta.')
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={traslado ? 'Elegí otro turno sin costo' : 'Cambiar la fecha'} ancho="max-w-3xl">
      <p className="mb-4 text-sm text-tinta-suave">
        {traslado
          ? 'Tu fiesta mantiene el mismo precio y todo lo que ya pagaste.'
          : 'Tenés una reprogramación sin cargo. El precio queda igual.'}
      </p>
      <SelectorTurno variante={variante} seleccion={eleccion} onElegir={setEleccion} excluir={{ fecha: alquiler.fecha, turno_id: alquiler.turno_id }} />
      <div className="sticky bottom-0 mt-4 space-y-3 bg-white pt-3">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton className="w-full" disabled={!eleccion} cargando={enviando} onClick={confirmar}>
          {eleccion ? `Pasar al ${fechaLarga(eleccion.fecha)}, ${hora(eleccion.hora_inicio)} h` : 'Elegí un turno libre'}
        </Boton>
      </div>
    </Modal>
  )
}

/** Seguir en la fecha con compensación */
export function ModalCompensacion({ abierto, onCerrar, alquiler, onListo }) {
  const [pct, setPct] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!abierto) return
    setError('')
    supabase.from('configuracion').select('valor').eq('clave', 'compensacion_pct').maybeSingle().then(({ data }) => setPct(Number(data?.valor ?? 15)))
  }, [abierto])
  const monto = pct === null ? null : Math.round((alquiler.precio_combo * pct) / 100)
  const confirmar = async () => {
    setEnviando(true)
    setError('')
    try {
      await rpc('aceptar_compensacion', { p_alquiler: alquiler.id })
      onListo('¡Listo! Seguimos en tu fecha y descontamos la compensación de tu saldo.')
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Seguir en mi fecha">
      {monto === null ? (
        <Cargando />
      ) : (
        <div className="space-y-4">
          <p>
            Mantenés el {fechaLarga(alquiler.fecha)} y te descontamos <strong>{pesos(monto)}</strong> ({pct} % del combo) porque uno de los juegos principales no va a estar disponible.
          </p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton className="w-full" cargando={enviando} onClick={confirmar}>Acepto la compensación</Boton>
        </div>
      )}
    </Modal>
  )
}

/** Cancelación con el cálculo de devolución antes de confirmar */
export function ModalCancelar({ abierto, onCerrar, alquiler, onListo, esAdmin = false }) {
  const [porSalon, setPorSalon] = useState(false)
  const [calculo, setCalculo] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setError('')
    setCalculo(null)
    rpc('calcular_cancelacion', { p_alquiler: alquiler.id, p_por_salon: porSalon })
      .then(setCalculo)
      .catch((e) => setError(e.message))
  }, [abierto, porSalon, alquiler.id])

  const confirmar = async () => {
    setEnviando(true)
    setError('')
    try {
      const r = await rpc('cancelar_alquiler', { p_alquiler: alquiler.id, p_motivo: motivo, p_por_salon: porSalon })
      onListo(Number(r.devolucion) > 0 ? `Alquiler cancelado. Devolución registrada: ${pesos(r.devolucion)}.` : 'Alquiler cancelado.')
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={esAdmin ? 'Cancelar alquiler' : 'Cancelar mi fiesta'}>
      <div className="space-y-4">
        {esAdmin && !alquiler.bloqueado && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={porSalon} onChange={(e) => setPorSalon(e.target.checked)} />
            Cancela el salón (devuelve el 100 % de lo cobrado)
          </label>
        )}
        {!calculo && !error ? (
          <Cargando texto="Calculando la devolución…" />
        ) : calculo ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              {calculo.por_salon
                ? 'Cancelación por causa del salón.'
                : `Faltan ${calculo.dias} días para la fiesta.`}{' '}
              Se devuelve el <strong>{calculo.porcentaje} %</strong> de lo cobrado ({pesos(calculo.cobrado)}).
            </p>
            <p className="mt-1 text-base font-bold">Devolución: {pesos(calculo.devolucion)}</p>
            {Number(calculo.garantia) > 0 && <p className="mt-1">La garantía de {pesos(calculo.garantia)} se devuelve completa.</p>}
          </div>
        ) : null}
        <Campo etiqueta="Motivo">
          <textarea className="campo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={esAdmin ? 'Ej.: la familia avisó por teléfono' : 'Contanos qué pasó'} />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton variante="peligro" className="w-full" cargando={enviando} disabled={!calculo || !motivo.trim()} onClick={confirmar}>
          Confirmar cancelación
        </Boton>
      </div>
    </Modal>
  )
}

export function horarioDe(a, adicionales) {
  const deco = (adicionales || []).some((x) => x.codigo === 'decoracion')
  const [h, m] = String(a.hora_inicio).split(':').map(Number)
  const ingresoMin = h * 60 + m - 10 - (deco ? 30 : 0)
  const ingreso = `${String(Math.floor(ingresoMin / 60)).padStart(2, '0')}:${String(ingresoMin % 60).padStart(2, '0')}`
  return { ingreso, texto: `${primeraMayuscula(fechaLarga(a.fecha))} · ${hora(a.hora_inicio)} a ${hora(a.hora_fin)} h` }
}
