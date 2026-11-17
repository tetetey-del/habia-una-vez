import { useState } from 'react'
import { Phone, Play, Flag, Wrench, Check, Users, Clock } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { hora, fechaLarga, CHECKLIST, hoyAR } from '../../lib/formato'
import { Aviso, Boton, Cargando, EstadoAlquiler, Modal, Campo, Vacio } from '../../components/ui'
import { ModalReportar } from '../../components/PanelComun'

export default function HojaTurno() {
  const { perfil } = useSesion()
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const jornada = await rpc('jornada_coordinacion')
    const [alquileres, adicionales] = await Promise.all([
      consulta(supabase.from('v_alquileres').select('*').eq('fecha', jornada).not('estado', 'in', '(vencido,cancelado)').order('hora_inicio')),
      consulta(supabase.from('alquiler_adicionales').select('alquiler_id, adicionales(nombre, codigo)')),
    ])
    return { jornada, alquileres, adicionales }
  })
  const [mensaje, setMensaje] = useState('')
  const [reportar, setReportar] = useState(null)

  if (cargando && !datos) return <Cargando />
  if (error) return <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>

  const { jornada, alquileres, adicionales } = datos
  const esHoy = jornada === hoyAR()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Hoja del turno</h1>
      <p className="mb-4 text-slate-500">
        {esHoy ? 'Hoy, ' : 'Próxima jornada: '}
        {fechaLarga(jornada)}
      </p>
      {mensaje && <Aviso tipo="exito" className="mb-4">{mensaje}</Aviso>}
      {alquileres.length === 0 ? (
        <Vacio titulo="No hay turnos cargados" icono={Users}>Cuando haya un evento, aparece acá.</Vacio>
      ) : (
        <div className="space-y-4">
          {alquileres.map((a) => (
            <TarjetaTurno
              key={a.id}
              a={a}
              adicionales={adicionales.filter((x) => x.alquiler_id === a.id).map((x) => x.adicionales)}
              onCambio={(texto) => { setMensaje(texto); recargar() }}
              onReportar={() => setReportar(a)}
            />
          ))}
        </div>
      )}
      <ModalReportar
        abierto={Boolean(reportar)}
        alquilerId={reportar?.id}
        puedeCerrarSalon={perfil?.rol === 'admin'}
        onCerrar={() => setReportar(null)}
        onListo={(texto) => { setReportar(null); setMensaje(texto); recargar() }}
      />
    </div>
  )
}

function TarjetaTurno({ a, adicionales, onCambio, onReportar }) {
  const [hoja, setHoja] = useState(() => ({ checklist: a.hoja?.checklist || {}, notas: a.hoja?.notas || '' }))
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [finalizar, setFinalizar] = useState(false)
  const [dano, setDano] = useState('')
  const editable = ['saldo_pagado', 'en_curso'].includes(a.estado)
  const deco = adicionales.some((x) => x.codigo === 'decoracion')
  const [h, m] = String(a.hora_inicio).split(':').map(Number)
  const ingresoMin = h * 60 + m - 10 - (deco ? 30 : 0)
  const ingreso = `${String(Math.floor(ingresoMin / 60)).padStart(2, '0')}:${String(ingresoMin % 60).padStart(2, '0')}`

  const correr = async (fn, texto) => {
    setTrabajando(true)
    setError('')
    try {
      await fn()
      onCambio(texto)
    } catch (e) {
      setError(e.message)
    } finally {
      setTrabajando(false)
    }
  }

  const marcar = async (clave) => {
    const nueva = { ...hoja, checklist: { ...hoja.checklist, [clave]: !hoja.checklist[clave] } }
    setHoja(nueva)
    try {
      await rpc('guardar_hoja', { p_alquiler: a.id, p_hoja: nueva })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <article className={`overflow-hidden rounded-2xl bg-white ring-1 ${a.estado === 'en_curso' ? 'ring-2 ring-teal-500' : a.estado === 'en_riesgo' ? 'ring-2 ring-red-500' : 'ring-slate-200'}`}>
      <header className="flex items-start justify-between gap-3 bg-slate-900 p-4 text-white">
        <div>
          <p className="num text-3xl font-extrabold">{hora(a.hora_inicio)}<span className="text-lg text-white/60"> a {hora(a.hora_fin)}</span></p>
          <p className="flex items-center gap-1 text-sm text-white/70"><Clock className="h-3.5 w-3.5" /> Ingreso {ingreso} h{deco ? ' (con decoración)' : ''}</p>
        </div>
        <EstadoAlquiler estado={a.estado} grande />
      </header>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xl font-bold">{a.homenajeado} · {a.edad} años</p>
          <p className="text-slate-600">{a.chicos} chicos y {a.adultos} adultos · {a.combo}</p>
          <a href={`tel:${a.celular}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-violeta">
            <Phone className="h-4 w-4" /> {a.familia} · {a.celular}
          </a>
          {adicionales.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {adicionales.map((x) => <li key={x.codigo} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{x.nombre}</li>)}
            </ul>
          )}
          {a.notas && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">{a.notas}</p>}
        </div>

        {a.estado === 'en_riesgo' && <Aviso tipo="error">Este turno está en riesgo por mantenimiento. Consultá con administración antes de empezar.</Aviso>}
        {['senado', 'contrato_aceptado'].includes(a.estado) && <Aviso tipo="alerta">Falta que administración registre el saldo.</Aviso>}

        {editable && (
          <ul className="space-y-1.5">
            {CHECKLIST.map((it) => {
              const hecho = Boolean(hoja.checklist[it.clave])
              return (
                <li key={it.clave}>
                  <button
                    onClick={() => marcar(it.clave)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold transition ${hecho ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50'}`}
                    aria-pressed={hecho}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${hecho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {hecho && <Check className="h-4 w-4" />}
                    </span>
                    {it.texto}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {editable && (
          <Campo etiqueta="Notas del turno">
            <textarea
              className="campo"
              rows={2}
              value={hoja.notas}
              onChange={(e) => setHoja({ ...hoja, notas: e.target.value })}
              onBlur={() => rpc('guardar_hoja', { p_alquiler: a.id, p_hoja: hoja }).catch((e) => setError(e.message))}
              placeholder="Lo que administración tenga que saber"
            />
          </Campo>
        )}

        {a.dano_reportado && <Aviso tipo="alerta" titulo="Daño reportado">{a.dano_reportado}</Aviso>}
        {error && <Aviso tipo="error" onActualizar={() => onCambio('')}>{error}</Aviso>}

        <div className="grid grid-cols-2 gap-2">
          {a.estado === 'saldo_pagado' && (
            <Boton variante="turquesa" tamano="lg" icono={Play} className="col-span-2" cargando={trabajando} onClick={() => correr(() => rpc('iniciar_turno', { p_alquiler: a.id }), `Turno de ${a.homenajeado} iniciado.`)}>
              Empezar turno
            </Boton>
          )}
          {a.estado === 'en_curso' && (
            <Boton variante="oscuro" tamano="lg" icono={Flag} className="col-span-2" onClick={() => setFinalizar(true)}>
              Terminar turno
            </Boton>
          )}
          <Boton variante="secundario" icono={Wrench} className="col-span-2" onClick={onReportar}>
            Reportar un juego
          </Boton>
        </div>
      </div>

      <Modal abierto={finalizar} onCerrar={() => setFinalizar(false)} titulo="Terminar turno">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Si algo se rompió por uso de la fiesta, contalo acá: administración decide si se retiene parte de la garantía.</p>
          <Campo etiqueta="Daños causados en el turno (dejalo vacío si no hubo)">
            <textarea className="campo" rows={3} value={dano} onChange={(e) => setDano(e.target.value)} placeholder="Ej.: se rompió una paleta del tejo" />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Boton
            variante="oscuro"
            className="w-full"
            cargando={trabajando}
            onClick={() => correr(async () => {
              await rpc('finalizar_turno', { p_alquiler: a.id, p_hoja: hoja, p_dano: dano })
              setFinalizar(false)
            }, `Turno de ${a.homenajeado} terminado${dano.trim() ? ' con daño reportado' : ''}.`)}
          >
            {dano.trim() ? 'Terminar y reportar el daño' : 'Terminar sin daños'}
          </Boton>
        </div>
      </Modal>
    </article>
  )
}

