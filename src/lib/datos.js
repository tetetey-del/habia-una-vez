import { useCallback, useEffect, useState } from 'react'
import { supabase, mensajeError } from './supabase'

let catalogoCache = null

export function useCatalogo() {
  const [catalogo, setCatalogo] = useState(catalogoCache)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('catalogo_publico')
    if (e) setError(mensajeError(e))
    else {
      catalogoCache = data
      setCatalogo(data)
    }
  }, [])
  useEffect(() => {
    if (!catalogoCache) cargar()
  }, [cargar])
  return { catalogo, error, recargar: cargar }
}

export function olvidarCatalogo() {
  catalogoCache = null
}

// Hook genérico para cargar datos con recarga manual
export function useCarga(funcion, dependencias = []) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setDatos(await funcion())
    } catch (e) {
      setError(e.message || 'No pudimos cargar los datos.')
    } finally {
      setCargando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)
  useEffect(() => {
    cargar()
  }, [cargar])
  return { datos, error, cargando, recargar: cargar, setDatos }
}

// Consulta a una tabla/vista con manejo de error legible
export async function consulta(promesa) {
  const { data, error } = await promesa
  if (error) throw new Error(mensajeError(error))
  return data
}
