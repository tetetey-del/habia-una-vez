import { pesos, fechaLarga, hora } from './formato'

// ---------- WhatsApp: se comparte el texto armado (no hay integración real) ----------
export function enlaceWhatsApp(celular, texto) {
  const digitos = String(celular || '').replace(/\D/g, '')
  // Celulares argentinos: 54 9 + área + número
  let numero = ''
  if (digitos.length >= 10) {
    numero = digitos.startsWith('54') ? digitos : `549${digitos.replace(/^0/, '').replace(/^15/, '')}`
  }
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(texto)}`
}

export function textoAvisoRiesgo(a, enlacePortal) {
  return [
    `¡Hola ${a.familia.split(' ')[0]}! Te escribimos de Había una Vez por el cumple de ${a.homenajeado} (${fechaLarga(a.fecha)}, ${hora(a.hora_inicio)} h).`,
    'Uno de nuestros juegos principales quedó fuera de servicio y queremos que elijas qué te queda mejor:',
    '• Pasar la fiesta a otro turno libre, sin costo.',
    '• Mantener tu fecha con una compensación del 15 % del combo.',
    bloqueadoTexto(a),
    `Podés elegir desde tu portal: ${enlacePortal}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function bloqueadoTexto(a) {
  return a.bloqueado
    ? 'Por un cierre del salón esa fecha no se puede mantener: necesitamos pasarte a otro turno (si no encontramos uno, te devolvemos todo lo pagado).'
    : ''
}

export function textoSaldo(a) {
  return `¡Hola ${a.familia.split(' ')[0]}! Te recordamos que para el cumple de ${a.homenajeado} (${fechaLarga(a.fecha)}) queda un saldo de ${pesos(a.saldo)}. Cualquier duda, escribinos.`
}

export function textoConfirmacion(a) {
  return `¡Hola ${a.familia.split(' ')[0]}! Te confirmamos el turno ${a.codigo} para el cumple de ${a.homenajeado}: ${fechaLarga(a.fecha)} de ${hora(a.hora_inicio)} a ${hora(a.hora_fin)} h. ¡Los esperamos!`
}

// ---------- Calendario .ics ----------
// Argentina no tiene horario de verano: UTC-3 todo el año.
function utc(fecha, horaTexto, restarMin = 0) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = String(horaTexto).split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, h + 3, min - restarMin))
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function descargarIcs(a) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Había una Vez//Turnos//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${a.codigo}@habiaunavez`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${utc(a.fecha, a.hora_inicio)}`,
    `DTEND:${utc(a.fecha, a.hora_fin)}`,
    `SUMMARY:Cumple de ${a.homenajeado} en Había una Vez`,
    `DESCRIPTION:Turno ${a.codigo}. Ingreso 10 minutos antes del inicio.`,
    'LOCATION:Salón Había una Vez',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mañana es la fiesta',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  descargar(blob, `turno-${a.codigo}.ics`)
}

// ---------- CSV ----------
export function descargarCsv(nombre, columnas, filas) {
  const escapar = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const contenido = [columnas.map((c) => escapar(c.titulo)).join(';'), ...filas.map((f) => columnas.map((c) => escapar(c.valor(f))).join(';'))].join('\r\n')
  // BOM para que Excel respete los acentos
  descargar(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }), nombre)
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
