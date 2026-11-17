import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProveedorSesion, useSesion, rutaInicioDe } from './lib/sesion'
import { configurado } from './lib/supabase'
import { Cargando, Aviso } from './components/ui'
import LayoutPublico from './layouts/LayoutPublico'
import LayoutPanel from './layouts/LayoutPanel'

import Inicio from './pages/publico/Inicio'
import Fechas from './pages/publico/Fechas'
import ArmarFiesta from './pages/publico/ArmarFiesta'
import Ingresar from './pages/publico/Ingresar'
import MisFiestas from './pages/familia/MisFiestas'
import MiFiesta from './pages/familia/MiFiesta'
import Contrato from './pages/familia/Contrato'

const Tablero = lazy(() => import('./pages/panel/Tablero'))
const Agenda = lazy(() => import('./pages/panel/Agenda'))
const Alquileres = lazy(() => import('./pages/panel/Alquileres'))
const NuevoAlquiler = lazy(() => import('./pages/panel/NuevoAlquiler'))
const Ficha = lazy(() => import('./pages/panel/Ficha'))
const Cobranzas = lazy(() => import('./pages/panel/Cobranzas'))
const HojaTurno = lazy(() => import('./pages/panel/HojaTurno'))
const Juegos = lazy(() => import('./pages/panel/Juegos'))
const Ordenes = lazy(() => import('./pages/panel/Ordenes'))
const Orden = lazy(() => import('./pages/panel/Orden'))
const Informes = lazy(() => import('./pages/panel/Informes'))
const Configuracion = lazy(() => import('./pages/panel/Configuracion'))

function SoloFamilia({ children }) {
  const { perfil, cargando } = useSesion()
  if (cargando) return <Cargando />
  if (!perfil) return <Navigate to={`/ingresar?volver=${encodeURIComponent(window.location.pathname)}`} replace />
  if (perfil.rol !== 'familia') return <Navigate to={rutaInicioDe(perfil.rol)} replace />
  return children
}

function SoloRol({ roles, children }) {
  const { perfil } = useSesion()
  if (perfil && !roles.includes(perfil.rol)) return <Navigate to={rutaInicioDe(perfil.rol)} replace />
  return children
}

function SinConfigurar() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Aviso tipo="alerta" titulo="Falta configurar Supabase">
        Copiá <code>.env.example</code> como <code>.env</code>, completá la URL y la clave pública de tu proyecto y reiniciá la app.
      </Aviso>
    </div>
  )
}

export default function App() {
  if (!configurado) return <SinConfigurar />
  const admin = ['admin']
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <Routes>
          <Route element={<LayoutPublico />}>
            <Route index element={<Inicio />} />
            <Route path="fechas" element={<Fechas />} />
            <Route path="armar" element={<ArmarFiesta />} />
            <Route path="ingresar" element={<Ingresar />} />
            <Route path="mis-fiestas" element={<SoloFamilia><MisFiestas /></SoloFamilia>} />
            <Route path="mis-fiestas/:id" element={<SoloFamilia><MiFiesta /></SoloFamilia>} />
            <Route path="mis-fiestas/:id/contrato" element={<SoloFamilia><Contrato /></SoloFamilia>} />
          </Route>
          <Route path="panel" element={<LayoutPanel />}>
            <Route index element={<SoloRol roles={admin}><Tablero /></SoloRol>} />
            <Route path="agenda" element={<SoloRol roles={admin}><Agenda /></SoloRol>} />
            <Route path="alquileres" element={<SoloRol roles={admin}><Alquileres /></SoloRol>} />
            <Route path="alquileres/nuevo" element={<SoloRol roles={admin}><NuevoAlquiler /></SoloRol>} />
            <Route path="alquileres/:id" element={<SoloRol roles={admin}><Ficha /></SoloRol>} />
            <Route path="cobranzas" element={<SoloRol roles={admin}><Cobranzas /></SoloRol>} />
            <Route path="hoja" element={<SoloRol roles={['admin', 'coordinacion']}><HojaTurno /></SoloRol>} />
            <Route path="juegos" element={<SoloRol roles={['admin', 'mantenimiento']}><Juegos /></SoloRol>} />
            <Route path="ordenes" element={<SoloRol roles={['admin', 'mantenimiento', 'coordinacion']}><Ordenes /></SoloRol>} />
            <Route path="ordenes/:id" element={<SoloRol roles={['admin', 'mantenimiento', 'coordinacion']}><Orden /></SoloRol>} />
            <Route path="informes" element={<SoloRol roles={admin}><Informes /></SoloRol>} />
            <Route path="configuracion" element={<SoloRol roles={admin}><Configuracion /></SoloRol>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProveedorSesion>
  )
}
