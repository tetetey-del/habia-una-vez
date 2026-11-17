import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const Contexto = createContext(null)

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (s) => {
    if (!s) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('perfiles').select('id, rol, nombre').eq('id', s.user.id).maybeSingle()
    setPerfil(data || { id: s.user.id, rol: 'familia', nombre: '' })
  }, [])

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSesion(data.session)
      await cargarPerfil(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      // Se difiere para no bloquear el callback de auth
      setTimeout(() => cargarPerfil(s), 0)
    })
    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  const salir = async () => {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  return <Contexto.Provider value={{ sesion, perfil, cargando, salir }}>{children}</Contexto.Provider>
}

export const useSesion = () => useContext(Contexto)

export function rutaInicioDe(rol) {
  if (rol === 'admin') return '/panel'
  if (rol === 'coordinacion') return '/panel/hoja'
  if (rol === 'mantenimiento') return '/panel/juegos'
  return '/mis-fiestas'
}
