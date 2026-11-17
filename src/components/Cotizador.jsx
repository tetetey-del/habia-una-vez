import { useEffect, useRef, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { supabase, mensajeError } from '../lib/supabase'
import { pesos, TIPO_DIA } from '../lib/formato'
import { Contador, Aviso } from './ui'

// Recalcula el total en la base cada vez que cambia algo (misma regla que al guardar)
export function useCotizacion({ fecha, turno_id, combo_id, chicos, adultos, adicionales }) {
  const [cot, setCot] = useState(null)
  const [error, setError] = useState('')
  const [calculando, setCalculando] = useState(false)
  const ultimo = useRef(0)
  const clave = JSON.stringify([fecha, turno_id, combo_id, chicos, adultos, [...(adicionales || [])].sort()])

  useEffect(() => {
    if (!combo_id) return
    const id = ++ultimo.current
    setCalculando(true)
    const t = setTimeout(async () => {
      const { data, error: e } = await supabase.rpc('cotizar', {
        p_fecha: fecha || null,
        p_turno_id: turno_id || null,
        p_combo_id: combo_id,
        p_chicos: chicos,
        p_adultos: adultos,
        p_adicionales: adicionales || [],
      })
      if (id !== ultimo.current) return
      setCalculando(false)
      if (e) setError(mensajeError(e))
      else {
        setError('')
        setCot(data)
      }
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return { cot, error, calculando }
}

/** Desglose del precio: se usa igual en el pedido y en la ficha */
export function Desglose({ d, variante = 'publico', mostrarSena = true }) {
  if (!d) return null
  const publico = variante === 'publico'
  const fila = 'flex items-baseline justify-between gap-3 py-1'
  return (
    <div className={publico ? '' : 'text-sm'}>
      <div className={fila}>
        <span>
          {d.combo}
          {d.tipo_dia && <span className="block text-xs text-tinta-suave">{TIPO_DIA[d.tipo_dia]}</span>}
        </span>
        <span className="num font-semibold">{pesos(d.precio_combo)}</span>
      </div>
      {Number(d.personas_extra) > 0 && (
        <div className={fila}>
          <span>
            {d.personas_extra} {Number(d.personas_extra) === 1 ? 'persona extra' : 'personas extra'}
            <span className="block text-xs text-tinta-suave">{pesos(d.precio_persona_extra)} c/u</span>
          </span>
          <span className="num font-semibold">{pesos(d.monto_personas_extra)}</span>
        </div>
      )}
      {(d.adicionales || []).map((a) => (
        <div key={a.id || a.nombre} className={fila}>
          <span>{a.nombre}</span>
          <span className="num font-semibold">{pesos(a.precio)}</span>
        </div>
      ))}
      <div className={`mt-2 flex items-baseline justify-between gap-3 border-t pt-2 ${publico ? 'border-violeta/15' : 'border-slate-200'}`}>
        <span className="font-bold">Total</span>
        <span className={`num font-extrabold ${publico ? 'font-titulo text-2xl text-violeta' : 'text-lg'}`}>{pesos(d.total)}</span>
      </div>
      {mostrarSena && (
        <div className={`${fila} text-sm`}>
          <span className="text-tinta-suave">Seña para confirmar (30 %)</span>
          <span className="num font-bold">{pesos(d.sena ?? d.sena_requerida)}</span>
        </div>
      )}
    </div>
  )
}

/** Elección de combo, personas y adicionales */
export function FormularioFiesta({ valor, onCambiar, catalogo, cot, variante = 'publico', esAdmin = false }) {
  const publico = variante === 'publico'
  const tope = esAdmin ? Number(catalogo.capacidad) + 5 : Number(catalogo.capacidad)
  const personas = valor.chicos + valor.adultos
  const decoracionPermitida = cot ? cot.decoracion_permitida : true
  const cambiar = (campo, v) => onCambiar({ ...valor, [campo]: v })
  const alternarAdicional = (id) => {
    const tiene = valor.adicionales.includes(id)
    cambiar('adicionales', tiene ? valor.adicionales.filter((x) => x !== id) : [...valor.adicionales, id])
  }
  const tipo = cot?.tipo_dia

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className={`mb-2 font-bold ${publico ? 'font-titulo text-xl' : 'text-sm uppercase tracking-wide text-slate-500'}`}>Elegí el combo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalogo.combos.map((c) => {
            const activo = valor.combo_id === c.id
            const precio = tipo === 'domingo_feriado' ? c.precio_domingo_feriado : c.precio_sabado
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => cambiar('combo_id', c.id)}
                className={`relative rounded-2xl border-2 p-4 text-left transition ${activo ? 'border-violeta bg-violeta-claro' : 'border-tinta/10 bg-white hover:border-violeta/40'}`}
                aria-pressed={activo}
              >
                {activo && <Check className="absolute right-3 top-3 h-5 w-5 text-violeta" />}
                <p className="pr-6 font-bold">{c.nombre}</p>
                <p className="num mt-1 text-lg font-extrabold text-violeta">{pesos(precio)}</p>
                <p className="mt-1 text-xs text-tinta-suave">{c.descripcion}</p>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={`mb-1 font-bold ${publico ? 'font-titulo text-xl' : 'text-sm uppercase tracking-wide text-slate-500'}`}>¿Cuántos vienen?</legend>
        <p className="mb-3 text-sm text-tinta-suave">
          Entran {catalogo.capacidad} personas en total. Pueden ser {catalogo.chicos_referencia} chicos y {catalogo.adultos_referencia} adultos, o intercambiarlos.
        </p>
        <div className="flex flex-wrap gap-6">
          <div>
            <span className="etiqueta">Chicos</span>
            <Contador etiqueta="chicos" valor={valor.chicos} min={1} max={tope - valor.adultos} onCambiar={(v) => cambiar('chicos', v)} />
          </div>
          <div>
            <span className="etiqueta">Adultos</span>
            <Contador etiqueta="adultos" valor={valor.adultos} min={0} max={tope - valor.chicos} onCambiar={(v) => cambiar('adultos', v)} />
          </div>
        </div>
        <p className={`num mt-2 text-sm font-bold ${personas > catalogo.capacidad ? 'text-coral' : 'text-tinta-suave'}`}>
          {personas} de {catalogo.capacidad} personas
        </p>
        {esAdmin && personas > catalogo.capacidad && (
          <label className="mt-3 block">
            <span className="etiqueta">Motivo para pasar el tope (obligatorio)</span>
            <input className="campo" value={valor.motivo_excedente || ''} onChange={(e) => cambiar('motivo_excedente', e.target.value)} placeholder="Ej.: familia numerosa, lo autoriza la dueña" />
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend className={`mb-2 font-bold ${publico ? 'font-titulo text-xl' : 'text-sm uppercase tracking-wide text-slate-500'}`}>
          Sumá adicionales <span className="text-sm font-normal text-tinta-suave">(opcional)</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalogo.adicionales.map((a) => {
            const activo = valor.adicionales.includes(a.id)
            const bloqueado = a.codigo === 'decoracion' && !decoracionPermitida
            return (
              <button
                type="button"
                key={a.id}
                disabled={bloqueado}
                onClick={() => alternarAdicional(a.id)}
                aria-pressed={activo}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${activo ? 'border-violeta bg-violeta-claro' : 'border-tinta/10 bg-white hover:border-violeta/40'}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${activo ? 'border-violeta bg-violeta text-white' : 'border-tinta/25'}`}>
                  {activo && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{a.nombre}</span>
                    <span className="num shrink-0 text-sm font-bold text-violeta">{pesos(a.precio)}</span>
                  </span>
                  <span className="block text-xs text-tinta-suave">
                    {bloqueado ? 'No disponible en este turno: el anterior termina muy cerca.' : a.descripcion}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl bg-amarillo-claro p-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-violeta" checked={valor.quiere_garantia} onChange={(e) => cambiar('quiere_garantia', e.target.checked)} />
        <span className="text-sm">
          <span className="flex items-center gap-1 font-bold"><Sparkles className="h-4 w-4" /> Garantía por roturas (opcional)</span>
          Dejás {pesos(catalogo.garantia_monto)} aparte y te los devolvemos al cerrar la fiesta si no hubo daños.
        </span>
      </label>
    </div>
  )
}

export function ErroresCotizacion({ cot, error }) {
  if (error) return <Aviso tipo="error">{error}</Aviso>
  if (!cot) return null
  return (
    <>
      {(cot.errores || []).map((e) => <Aviso key={e} tipo="error">{e}</Aviso>)}
      {(cot.avisos || []).map((e) => <Aviso key={e} tipo="alerta">{e}</Aviso>)}
    </>
  )
}
