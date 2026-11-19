import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, ListChecks, Wallet, ClipboardList, Wrench, ClipboardCheck,
  ChartColumn, Settings, LogOut, Menu, X, Plus,
} from 'lucide-react'
import { Isotipo } from '../components/Logo'
import { useSesion } from '../lib/sesion'
import { ROLES } from '../lib/formato'
import { supabase } from '../lib/supabase'
import { Cargando } from '../components/ui'

const MENU = [
  { a: '/panel', texto: 'Tablero', icono: LayoutDashboard, roles: ['admin'], fin: true },
  { a: '/panel/agenda', texto: 'Agenda', icono: CalendarDays, roles: ['admin'] },
  { a: '/panel/alquileres', texto: 'Alquileres', icono: ListChecks, roles: ['admin'] },
  { a: '/panel/cobranzas', texto: 'Cobranzas', icono: Wallet, roles: ['admin'] },
  { a: '/panel/hoja', texto: 'Hoja del turno', icono: ClipboardCheck, roles: ['admin', 'coordinacion'] },
  { a: '/panel/juegos', texto: 'Mantenimiento', icono: Wrench, roles: ['admin', 'mantenimiento'], tambien: '/panel/ordenes' },
  { a: '/panel/ordenes', texto: 'Mis reportes', icono: ClipboardList, roles: ['coordinacion'] },
  { a: '/panel/informes', texto: 'Informes', icono: ChartColumn, roles: ['admin'] },
  { a: '/panel/configuracion', texto: 'Configuración', icono: Settings, roles: ['admin'] },
]

export default function LayoutPanel() {
  const { perfil, cargando, salir } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const navegar = useNavigate()
  const { pathname } = useLocation()

  // Al abrir el panel se vencen las pre-reservas y se generan las preventivas por días
  useEffect(() => {
    if (perfil && perfil.rol !== 'familia') supabase.rpc('abrir_panel').then(() => {})
  }, [perfil])

  if (cargando) return <Cargando />
  if (!perfil) return <Navigate to="/ingresar?volver=/panel" replace />
  if (perfil.rol === 'familia') return <Navigate to="/mis-fiestas" replace />

  const items = MENU.filter((m) => m.roles.includes(perfil.rol))
  const enlace = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-violeta text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`

  const navegacion = (
    <nav className="flex flex-col gap-1">
      {perfil.rol === 'admin' && (
        <NavLink to="/panel/alquileres/nuevo" onClick={() => setAbierto(false)} className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-amarillo px-3 py-2 text-sm font-bold text-tinta">
          <Plus className="h-4 w-4" /> Nuevo alquiler
        </NavLink>
      )}
      {items.map(({ a, texto, icono: Icono, fin, tambien }) => (
        <NavLink key={a} to={a} end={fin} className={(e) => enlace({ isActive: e.isActive || (tambien && pathname.startsWith(tambien)) })} onClick={() => setAbierto(false)}>
          <Icono className="h-4 w-4" /> {texto}
        </NavLink>
      ))}
    </nav>
  )

  const pie = (
    <div className="border-t border-white/10 pt-3">
      <p className="truncate px-3 text-xs text-slate-400">{ROLES[perfil.rol]}</p>
      <button
        onClick={async () => {
          await salir()
          navegar('/ingresar')
        }}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 font-texto text-slate-900">
      {/* Barra superior en celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-2.5 lg:hidden">
        <span className="flex items-center gap-2 text-white">
          <Isotipo className="h-7 w-7" />
          <span className="font-titulo text-lg font-bold">Panel</span>
        </span>
        <button onClick={() => setAbierto(true)} className="rounded-lg p-2 text-white" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAbierto(false)}>
          <aside className="flex h-full w-72 flex-col gap-4 bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white">
              <span className="flex items-center gap-2">
                <Isotipo className="h-8 w-8" />
                <span className="font-titulo text-lg font-bold">Había una Vez</span>
              </span>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navegacion}</div>
            {pie}
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 bg-slate-900 p-4 lg:flex">
          <span className="flex items-center gap-2 text-white">
            <Isotipo className="h-9 w-9" />
            <span className="font-titulo text-lg font-bold leading-none">
              Había una Vez
              <span className="block font-texto text-xs font-semibold text-slate-400">Panel de trabajo</span>
            </span>
          </span>
          <div className="flex-1 overflow-y-auto">{navegacion}</div>
          {pie}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<Cargando />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
