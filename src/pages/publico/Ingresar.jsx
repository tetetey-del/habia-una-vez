import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, mensajeError } from '../../lib/supabase'
import { useSesion, rutaInicioDe } from '../../lib/sesion'
import { Aviso, Boton, Campo } from '../../components/ui'
import { Isotipo } from '../../components/Logo'

const CUENTAS_DEMO = [
  { rol: 'Familia', email: 'familia@habiaunavez.test' },
  { rol: 'Administración', email: 'admin@habiaunavez.test' },
  { rol: 'Coordinación', email: 'coordinacion@habiaunavez.test' },
  { rol: 'Mantenimiento', email: 'mantenimiento@habiaunavez.test' },
]
const CLAVE_DEMO = 'HabiaUnaVez2026'

export default function Ingresar() {
  const [params] = useSearchParams()
  const volver = params.get('volver')
  const vieneDePedido = params.get('motivo') === 'pedido'
  const navegar = useNavigate()
  const { perfil } = useSesion()

  const [modo, setModo] = useState(vieneDePedido ? 'registro' : 'ingreso')
  const [f, setF] = useState({ email: '', clave: '', nombre: '', celular: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  // Ya con sesión: a donde corresponda
  useEffect(() => {
    if (!perfil) return
    if (volver && (perfil.rol === 'familia' || volver.startsWith('/panel'))) navegar(volver, { replace: true })
    else navegar(rutaInicioDe(perfil.rol), { replace: true })
  }, [perfil, volver, navegar])

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      if (modo === 'ingreso') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.clave })
        if (err) throw err
      } else {
        if (!f.nombre.trim() || !f.celular.trim()) throw new Error('Completá tu nombre y tu celular.')
        // El rol no se elige: la base asigna «familia» a toda cuenta nueva.
        const { data, error: err } = await supabase.auth.signUp({
          email: f.email.trim(),
          password: f.clave,
          options: { data: { nombre: f.nombre.trim(), celular: f.celular.trim() } },
        })
        if (err) throw err
        if (!data.session) setAviso('Creamos tu cuenta. Ingresá con tu correo y tu contraseña.')
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const pestaña = (m, texto) => (
    <button
      type="button"
      onClick={() => { setModo(m); setError('') }}
      className={`flex-1 rounded-xl py-2 font-bold transition ${modo === m ? 'bg-white text-violeta shadow-suave' : 'text-tinta-suave'}`}
    >
      {texto}
    </button>
  )

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-5 flex flex-col items-center text-center">
        <Isotipo className="mb-2 h-14 w-14" />
        <h1 className="text-3xl font-extrabold text-violeta">{modo === 'ingreso' ? '¡Hola de nuevo!' : 'Creá tu cuenta'}</h1>
        <p className="text-tinta-suave">
          {vieneDePedido ? 'Necesitamos tu cuenta para guardarte el turno.' : 'Desde tu cuenta seguís tu fiesta, el saldo y el contrato.'}
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl bg-violeta-claro p-1">
        {pestaña('ingreso', 'Ingresar')}
        {pestaña('registro', 'Crear cuenta')}
      </div>

      <form onSubmit={enviar} className="tarjeta space-y-4 p-5">
        {modo === 'registro' && (
          <>
            <Campo etiqueta="Nombre y apellido">
              <input className="campo" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoComplete="name" required />
            </Campo>
            <Campo etiqueta="Celular">
              <input className="campo" type="tel" inputMode="tel" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} autoComplete="tel" placeholder="11 5555-5555" required />
            </Campo>
          </>
        )}
        <Campo etiqueta="Correo">
          <input className="campo" type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required />
        </Campo>
        <Campo etiqueta="Contraseña" ayuda={modo === 'registro' ? 'Al menos 6 caracteres.' : undefined}>
          <input
            className="campo"
            type="password"
            value={f.clave}
            onChange={(e) => setF({ ...f, clave: e.target.value })}
            autoComplete={modo === 'ingreso' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        <Boton type="submit" tamano="lg" className="w-full" cargando={enviando}>
          {modo === 'ingreso' ? 'Ingresar' : 'Crear cuenta'}
        </Boton>
      </form>

      <details className="mt-6 rounded-2xl bg-white/60 p-4 text-sm ring-1 ring-tinta/10">
        <summary className="cursor-pointer font-bold text-violeta">Cuentas de prueba de la demo</summary>
        <p className="mt-2 text-tinta-suave">Todas usan la contraseña <code className="font-bold text-tinta">{CLAVE_DEMO}</code>.</p>
        <ul className="mt-2 grid gap-2">
          {CUENTAS_DEMO.map((c) => (
            <li key={c.email}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-tinta/10 hover:ring-violeta"
                onClick={() => { setModo('ingreso'); setF({ ...f, email: c.email, clave: CLAVE_DEMO }) }}
              >
                <span className="font-bold">{c.rol}</span>
                <span className="truncate text-xs text-tinta-suave">{c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
