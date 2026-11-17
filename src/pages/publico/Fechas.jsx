import { useNavigate } from 'react-router-dom'
import SelectorTurno from '../../components/SelectorTurno'

export default function Fechas() {
  const navegar = useNavigate()
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-extrabold text-violeta sm:text-4xl">Elegí tu fecha</h1>
      <p className="mb-5 text-tinta-suave">Tocá un turno libre y armamos tu fiesta. Te lo guardamos por 48 horas mientras señás.</p>
      <SelectorTurno onElegir={(t) => navegar(`/armar?fecha=${t.fecha}&turno=${t.turno_id}`)} />
    </div>
  )
}
