# Había una Vez · Turnos de cumpleaños

Sistema para un salón de fiestas infantiles: las familias eligen fecha y piden el turno desde el celular, administración registra señas y saldos, la familia acepta el contrato en pantalla, coordinación lleva la hoja del turno y mantenimiento maneja juegos y órdenes. Una rotura crítica en un juego principal pone en riesgo los alquileres de los próximos 14 días y la familia elige cómo seguir.

**Stack:** React 18 + Vite, Tailwind CSS, Supabase (Postgres, Auth y RLS).

---

## Cómo arrancarlo

1. **Proyecto de Supabase.** Creá un proyecto gratuito y, en el SQL Editor, ejecutá en orden los archivos de `supabase/migrations/`:

   | Archivo | Qué hace |
   |---|---|
   | `0001_esquema.sql` | Tablas, tipos, índice único de fecha + turno, alta de usuarios con rol «familia» |
   | `0002_reglas_de_negocio.sql` | Funciones de negocio: pedido, seña, pagos, anulación, cancelación, reprogramación, riesgo, mantenimiento, cierre, informes |
   | `0003_seguridad_rls.sql` | RLS en todas las tablas, vistas, permisos y tarea programada (pg_cron) |
   | `0004_contrato_reutilizable.sql` | Generación del contrato congelado |
   | `0005_datos_de_ejemplo.sql` | Usuarios de prueba, catálogo y datos sintéticos (`reiniciar_demo()`) |
   | `0006_vista_contrato.sql` | Vista previa del contrato antes de aceptarlo |
   | `0007_permisos_por_columna.sql` | Edición directa limitada a las columnas permitidas |
| `0008_reinicio_desde_la_app.sql` | Corrige el botón «Reiniciar datos de ejemplo» |
| `0009_mensaje_neutro_mantenimiento.sql` | Las familias ven «No disponible» en vez del motivo |

2. **Auth.** En *Authentication → Sign In / Providers → Email*, desactivá **Confirm email**: así una familia que crea su cuenta entra al instante (no se envían correos).

3. **Variables.** Copiá `.env.example` como `.env` y completá la URL y la clave pública (*Project Settings → API*). Nunca uses la clave `service_role` en el navegador.

4. **App.**
   ```bash
   npm install
   npm run dev      # http://localhost:5173
   npm run build    # producción en dist/
   ```
   En Vercel: importá el repositorio, cargá las dos variables de `.env.example` y desplegá. `vercel.json` ya redirige las rutas a la SPA.

## Cuentas de prueba

Contraseña de todas: `HabiaUnaVez2026`. También están en la pantalla **Ingresar → Cuentas de prueba de la demo**.

| Rol | Correo | Entra a |
|---|---|---|
| Administración | `admin@habiaunavez.test` | Panel completo |
| Coordinación | `coordinacion@habiaunavez.test` | Hoja del turno (día de trabajo) |
| Mantenimiento | `mantenimiento@habiaunavez.test` | Juegos y órdenes |
| Familia | `familia@habiaunavez.test` | Portal de Lucía Fernández (3 fiestas) |

Cada cuenta tiene un solo rol, guardado en `perfiles`. Toda cuenta creada desde el formulario público nace como **familia** (lo asigna la base, no el formulario).

## Pantallas

**Familias (celular primero):** Inicio · Elegí tu fecha · Armá tu fiesta (cotización en vivo) · Ingresar / crear cuenta · Mis fiestas · Mi fiesta (cuenta, riesgo, reprogramar, cancelar, .ics) · Contrato.

**Equipo:** Tablero · Agenda (pizarrón) · Alquileres · Nuevo alquiler · Ficha del alquiler · Cobranzas · Hoja del turno · Juegos · Órdenes · Parte de taller · Informes (CSV) · Configuración.

## Dónde está cada cosa

```
src/
  lib/          supabase.js (cliente y errores), formato.js (estados, pesos, fechas),
                compartir.js (WhatsApp, .ics, CSV), sesion.jsx, datos.js, alquiler.js
  components/   ui.jsx, SelectorTurno, Cotizador, AccionesAlquiler, PanelComun, Logo
  layouts/      LayoutPublico (familias), LayoutPanel (equipo)
  pages/        publico/, familia/, panel/
supabase/migrations/   esquema, reglas, RLS y datos de ejemplo
```

## Reglas y dónde se aplican

Todo lo que toca cupo, saldo o estado se resuelve **en una función de la base** que valida el estado actual, rechaza sin cambios parciales y devuelve un mensaje en castellano que la pantalla muestra con el botón «Actualizar datos».

- **Un evento por turno:** índice único `alquileres_turno_unico (fecha, turno_id)` para todo estado salvo Vencido y Cancelado. El segundo pedido recibe «Ese turno se ocupó recién, elegí otro».
- **Vencimiento a las 48 h:** `vencer_prereservas()` corre al abrir el panel, al consultar disponibilidad y cada 10 minutos con pg_cron.
- **Precio:** `cotizar()` calcula combo según tipo de día + personas excedentes + adicionales; la misma función se usa en vivo y al guardar. El importe queda guardado en el alquiler y se congela con la seña. Los precios tienen vigencia (`precios.vigente_desde`): un cambio solo afecta cotizaciones nuevas.
- **Capacidad:** 50 personas; administración puede llegar a 55 cargando el motivo.
- **Media hora para decorar:** solo si el turno anterior termina al menos una hora antes (`decoracion_permitida()`), validado aunque cambien los horarios.
- **Cobranzas:** los movimientos nunca se borran (un trigger lo impide); el saldo se calcula desde ellos. Anular deja el recibo visible como anulado y corrige el saldo. Recibos correlativos desde 0001.
- **Recargo:** 8 % sobre el saldo si se paga después de los 7 días previos.
- **Cancelación:** devolución sobre lo efectivamente cobrado: más de 30 días 100 %, de 30 a 15 días 50 %, menos de 15 días 0 %; por causa del salón siempre 100 %. Genera un movimiento negativo.
- **Reprogramación:** una sola, sin cargo, con más de 15 días.
- **Mantenimiento:** cerrar un alquiler suma 1 al contador de cada juego medido por eventos; al llegar a la frecuencia se crea la orden preventiva. La cocina se revisa por días. Verificar una preventiva vuelve el contador a cero.
- **Riesgo:** una orden crítica sobre un juego principal (o un cierre del salón) pasa a «En riesgo» los alquileres de los próximos 14 días guardando su estado anterior, y esas fechas dejan de ofrecerse (al público le aparecen como «No disponible», sin mencionar el arreglo). La familia elige trasladarse sin costo o quedarse con una compensación del 15 % del combo (movimiento negativo); ambas opciones devuelven el estado anterior. Con cierre del salón el traslado es obligatorio.
- **Idempotencia:** la seña y los pagos llevan una clave única; repetir la confirmación no vuelve a cobrar.
- **RLS:** familia solo ve sus alquileres, pagos y contratos; coordinación ve los turnos de su día de trabajo; mantenimiento ve juegos y órdenes; administración ve todo. El público anónimo solo usa `disponibilidad()`, `catalogo_publico()` y `cotizar()`, que exponen únicamente los campos necesarios.

## Qué está simulado

| Servicio | Cómo funciona en la demo |
|---|---|
| Pagos | No hay pasarela. Administración registra a mano seña, saldo y garantía con el medio (efectivo, transferencia, tarjeta). |
| WhatsApp | Los botones abren `wa.me` con el texto ya armado; no hay integración ni envío automático. |
| Correos y SMS | No se envía nada. El registro entra sin confirmación por correo. |
| Calendario | El turno se descarga como archivo `.ics`. |
| Firma del contrato | La familia marca «Acepto» y se guarda una versión congelada con fecha y nombre. |

Los nombres, celulares y datos de los chicos son sintéticos. Los precios, frecuencias y porcentajes son de prueba y se editan en **Configuración**.

## Datos de ejemplo

- 30 alquileres en los 10 estados, con fechas relativas a hoy (pasados, este fin de semana y próximos).
- 24 pagos con recibos 0001 a 0024, 8 órdenes con costos de $12.000 a $180.000, 12 fichas de juegos y sectores.
- El pelotero tiene una orden crítica abierta: el alquiler de Lucía de este sábado está **En riesgo** para probar el portal.
- El toro mecánico está en 9 de 10 eventos: al cerrar uno de los alquileres «Realizado» se crea su preventiva.

### Reiniciar los datos de ejemplo

- Desde la app: **Configuración → Reiniciar datos de ejemplo** (administración).
- Desde Supabase: `select public.reiniciar_demo();` en el SQL Editor.

Vuelve a cargar todo con fechas a partir del día en que se ejecuta. Las cuentas de prueba se mantienen.

## Caso del briefing, paso a paso

1. Con la cuenta de familia, **Elegí tu fecha** → un turno libre → cargá cumpleañera de 9 años → **Pedir turno**: queda en pre-reserva por 48 h.
2. Con administración, abrí el alquiler → **Registrar seña** (repetir la confirmación no cobra dos veces).
3. Con la familia, **Ver contrato** → **Acepto el contrato**: el turno pasa a firme.
4. Con coordinación, **Hoja del turno → Reportar un juego** → Toro mecánico, prioridad Crítica: los alquileres de los próximos 14 días pasan a «En riesgo» y esas fechas aparecen bloqueadas.
5. Con administración, el tablero muestra **Familias a avisar** con el botón de WhatsApp. Con la familia, **Elegir otro turno** o **Seguir en mi fecha**: el alquiler vuelve a su estado anterior.
6. **Informes** muestra ingresos, deudas y costo de mantenimiento; el CSV trae las mismas filas que la tabla de pagos.
