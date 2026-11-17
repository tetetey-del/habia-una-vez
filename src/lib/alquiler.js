import { supabase } from './supabase'
import { consulta, useCarga } from './datos'

// Todo lo de un alquiler en una sola carga (la RLS decide qué ve cada rol)
export function useAlquiler(id) {
  return useCarga(async () => {
    const [alquiler, adicionales, movimientos, contratos, eventos] = await Promise.all([
      consulta(supabase.from('v_alquileres').select('*').eq('id', id).maybeSingle()),
      consulta(supabase.from('alquiler_adicionales').select('precio, adicionales(id, nombre, codigo, orden)').eq('alquiler_id', id)),
      consulta(supabase.from('movimientos').select('*').eq('alquiler_id', id).order('creado_en')),
      consulta(supabase.from('contratos').select('*').eq('alquiler_id', id).order('version', { ascending: false })),
      consulta(supabase.from('eventos').select('*').eq('alquiler_id', id).order('creado_en', { ascending: false })),
    ])
    if (!alquiler) throw new Error('No encontramos ese alquiler.')
    const adic = (adicionales || [])
      .map((x) => ({ id: x.adicionales.id, nombre: x.adicionales.nombre, codigo: x.adicionales.codigo, orden: x.adicionales.orden, precio: x.precio }))
      .sort((a, b) => a.orden - b.orden)
    return { alquiler, adicionales: adic, movimientos, contratos, eventos }
  }, [id])
}

// Normaliza un alquiler guardado al formato del desglose del cotizador
export function desgloseDe(a, adicionales) {
  return {
    combo: a.combo,
    tipo_dia: a.tipo_dia,
    precio_combo: a.precio_combo,
    personas_extra: a.personas_extra,
    precio_persona_extra: a.precio_persona_extra,
    monto_personas_extra: a.monto_personas_extra,
    adicionales,
    total: a.total,
    sena_requerida: a.sena_requerida,
  }
}

export const ACTIVOS = ['pre_reserva', 'senado', 'contrato_aceptado', 'saldo_pagado', 'en_riesgo']
