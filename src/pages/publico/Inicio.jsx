import { Link } from 'react-router-dom'
import { CalendarHeart, PartyPopper, HandCoins, Check, Minus, ArrowRight } from 'lucide-react'
import { useCatalogo } from '../../lib/datos'
import { pesos } from '../../lib/formato'
import EscenaFiesta from '../../components/EscenaFiesta'
import { Aviso, Cargando } from '../../components/ui'

const PASOS = [
  { icono: CalendarHeart, titulo: 'Elegí tu fecha', texto: 'Mirá qué turnos quedan libres y tocá el que te gusta.', color: 'bg-turquesa' },
  { icono: PartyPopper, titulo: 'Armá tu fiesta', texto: 'Combo, invitados y adicionales.', color: 'bg-coral' },
  { icono: HandCoins, titulo: 'Señá y listo', texto: 'Te guardamos el turno por 48 h hasta que señes el 30 %.', color: 'bg-amarillo' },
]

export default function Inicio() {
  const { catalogo, error, recargar } = useCatalogo()

  return (
    <div>
      {/* Portada */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amarillo/40" aria-hidden="true" />
        <div className="absolute -left-16 top-40 h-40 w-40 rounded-full bg-turquesa/20" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-5xl items-center gap-6 px-4 pb-10 pt-8 sm:grid-cols-2 sm:pt-14">
          <div>
            <h1 className="text-4xl font-extrabold text-violeta sm:text-5xl">
              Había una vez<br />
              <span className="text-tinta">un cumple inolvidable</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-tinta-suave">
              Castillos, pelotero, toro mecánico y coordinadoras para que cuiden a los chicos. ¡Un solo cumple por turno para que puedan disfrutar mejor!
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/fechas" className="inline-flex items-center gap-2 rounded-2xl bg-violeta px-6 py-3.5 text-lg font-bold text-white shadow-globo transition hover:bg-violeta-oscuro">
                Elegí tu fecha <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/mis-fiestas" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-bold text-violeta ring-2 ring-violeta/20">
                Ver mi fiesta
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <EscenaFiesta className="w-full" />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-5 text-center text-3xl font-extrabold">¿Cómo funciona?</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {PASOS.map(({ icono: Icono, titulo, texto, color }, i) => (
            <li key={titulo} className="tarjeta relative p-5">
              <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${color} text-white`}>
                <Icono className="h-6 w-6" />
              </span>
              <span className="absolute right-4 top-3 font-titulo text-4xl font-extrabold text-violeta/10">{i + 1}</span>
              <h3 className="text-xl font-bold">{titulo}</h3>
              <p className="text-tinta-suave">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {error && (
        <div className="mx-auto max-w-5xl px-4">
          <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>
        </div>
      )}

      {!catalogo && !error && <Cargando />}

      {catalogo && (
        <>
          {/* Combos */}
          <section className="mx-auto max-w-5xl px-4 py-8">
            <h2 className="text-3xl font-extrabold">Nuestros combos</h2>
            <p className="mb-5 text-tinta-suave">
              Para {catalogo.chicos_referencia} chicos y {catalogo.adultos_referencia} adultos. Turnos de 2 horas y media.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {catalogo.combos.map((c, i) => (
                <article key={c.id} className={`overflow-hidden rounded-3xl ${i === 0 ? 'bg-white ring-2 ring-violeta/15' : 'bg-violeta text-white'}`}>
                  <div className="p-5">
                    <h3 className="text-2xl font-extrabold">{c.nombre}</h3>
                    <p className={i === 0 ? 'text-tinta-suave' : 'text-white/80'}>{c.descripcion}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className={`rounded-2xl p-3 ${i === 0 ? 'bg-violeta-claro' : 'bg-white/10'}`}>
                        <p className="text-xs font-bold uppercase opacity-70">Sábados</p>
                        <p className="num font-titulo text-2xl font-extrabold">{pesos(c.precio_sabado)}</p>
                      </div>
                      <div className={`rounded-2xl p-3 ${i === 0 ? 'bg-amarillo-claro' : 'bg-amarillo text-tinta'}`}>
                        <p className="text-xs font-bold uppercase opacity-70">Domingos y feriados</p>
                        <p className="num font-titulo text-2xl font-extrabold">{pesos(c.precio_domingo_feriado)}</p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {c.incluye.map((x) => (
                        <li key={x} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-turquesa" /> {x}</li>
                      ))}
                      {c.no_incluye.length > 0 && (
                        <li className={`flex gap-2 ${i === 0 ? 'text-tinta-suave' : 'text-white/70'}`}>
                          <Minus className="h-4 w-4 shrink-0" /> No incluye: {c.no_incluye.join(', ').toLowerCase()}
                        </li>
                      )}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-3 text-sm text-tinta-suave">
              Torta, piñata, show y más los sumás al armar tu fiesta. Cada persona extra, con autorización, suma {pesos(catalogo.persona_extra)}.
            </p>
          </section>

          {/* Juegos */}
          <section className="mx-auto max-w-5xl px-4 py-8">
            <h2 className="mb-4 text-3xl font-extrabold">Juegos y espacios</h2>
            <ul className="flex flex-wrap gap-2">
              {catalogo.juegos.map((j) => (
                <li
                  key={j.nombre}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${j.tipo === 'juego' ? 'bg-turquesa-claro text-teal-900' : 'bg-coral-claro text-coral'}`}
                >
                  {j.nombre}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Cierre */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-amarillo p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">¿Ya tenés la fecha en mente?</h2>
            <p>Fijate si está libre y pedí el turno en dos minutos.</p>
          </div>
          <Link to="/fechas" className="inline-flex items-center gap-2 rounded-2xl bg-violeta px-6 py-3 font-bold text-white">
            Ver fechas libres <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
