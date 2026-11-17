import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarHeart, PartyPopper, LogIn, LayoutDashboard, LogOut } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useSesion, rutaInicioDe } from '../lib/sesion'

export default function LayoutPublico() {
  const { perfil, salir } = useSesion()
  const navegar = useNavigate()
  const esEquipo = perfil && perfil.rol !== 'familia'

  const enlace = ({ isActive }) =>
    `flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${isActive ? 'bg-violeta text-white' : 'text-tinta hover:bg-violeta/10'}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-violeta/10 bg-fondo/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/" aria-label="Inicio">
            <Logo subtitulo={false} />
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/fechas" className={enlace}>
              <CalendarHeart className="h-4 w-4" />
              <span className="hidden sm:inline">Fechas</span>
            </NavLink>
            {perfil ? (
              <>
                <NavLink to={rutaInicioDe(perfil.rol)} className={enlace}>
                  {esEquipo ? <LayoutDashboard className="h-4 w-4" /> : <PartyPopper className="h-4 w-4" />}
                  <span className="hidden sm:inline">{esEquipo ? 'Panel' : 'Mis fiestas'}</span>
                </NavLink>
                <button
                  onClick={async () => {
                    await salir()
                    navegar('/')
                  }}
                  className="rounded-full p-2 text-tinta-suave hover:bg-violeta/10"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <NavLink to="/ingresar" className={enlace}>
                <LogIn className="h-4 w-4" />
                <span>Ingresar</span>
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-12 bg-violeta text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo claro />
          <p className="text-sm text-white/80">Cumpleaños los sábados, domingos y feriados</p>
          <Link to="/ingresar" className="text-sm font-bold text-amarillo underline-offset-2 hover:underline">
            Acceso del equipo
          </Link>
        </div>
      </footer>
    </div>
  )
}
