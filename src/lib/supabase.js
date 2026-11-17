import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configurado = Boolean(url && clave)

// La sesión se guarda en sessionStorage: se cierra al cerrar la pestaña.
export const supabase = createClient(url || 'https://sin-configurar.supabase.co', clave || 'sin-clave', {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Traduce cualquier error a un mensaje para la pantalla.
// Las reglas de la base ya devuelven textos en castellano con qué pasó y qué hacer.
export function mensajeError(error) {
  if (!error) return ''
  const texto = error.message || String(error)
  if (/Failed to fetch|NetworkError|network/i.test(texto)) {
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
  }
  if (/Invalid login credentials/i.test(texto)) return 'El correo o la contraseña no coinciden.'
  if (/User already registered/i.test(texto)) return 'Ya hay una cuenta con ese correo. Ingresá con tu contraseña.'
  if (/Password should be at least/i.test(texto)) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (/Email not confirmed/i.test(texto)) return 'Tu cuenta todavía no está confirmada.'
  if (/rate limit/i.test(texto)) return 'Hubo demasiados intentos seguidos. Esperá un minuto y probá de nuevo.'
  if (/JWT|token/i.test(texto)) return 'Tu sesión venció. Ingresá de nuevo.'
  if (error.code === '42501' || /permission denied/i.test(texto)) return 'Tu usuario no tiene permiso para hacer esto.'
  if (error.code === '23505') return 'Ese turno se ocupó recién, elegí otro.'
  return texto
}

// Llama a una función de la base y lanza un Error con mensaje legible.
export async function rpc(nombre, parametros) {
  const { data, error } = await supabase.rpc(nombre, parametros)
  if (error) throw new Error(mensajeError(error))
  return data
}

export function nuevaClave() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
