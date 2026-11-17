import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react'
import { supabase, rpc } from '../../lib/supabase'
import { consulta, useCarga } from '../../lib/datos'
import { fechaHora } from '../../lib/formato'
import { Aviso, Boton, Cargando } from '../../components/ui'

export default function Contrato() {
  const { id } = useParams()
  const [acepto, setAcepto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const { datos, error: errorCarga, cargando, recargar } = useCarga(async () => {
    const [alquiler, contratos] = await Promise.all([
      consulta(supabase.from('alquileres').select('id, codigo, estado').eq('id', id).maybeSingle()),
      consulta(supabase.from('contratos').select('*').eq('alquiler_id', id).order('version', { ascending: false })),
    ])
    if (!alquiler) throw new Error('No encontramos ese alquiler.')
    const firmado = contratos[0] || null
    const borrador = !firmado && alquiler.estado === 'senado' ? await rpc('vista_contrato', { p_alquiler: id }) : null
    return { alquiler, firmado, borrador }
  }, [id])

  const aceptar = async () => {
    setEnviando(true)
    setError('')
    try {
      await rpc('aceptar_contrato', { p_alquiler: id })
      await recargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (cargando && !datos) return <Cargando />
  if (errorCarga) return <div className="mx-auto max-w-2xl px-4 py-6"><Aviso tipo="error" onActualizar={recargar}>{errorCarga}</Aviso></div>

  const { alquiler, firmado, borrador } = datos
  const texto = firmado?.texto || borrador

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <Link to={`/mis-fiestas/${id}`} className="no-imprimir inline-flex items-center gap-1 text-sm font-bold text-violeta">
        <ArrowLeft className="h-4 w-4" /> Volver a mi fiesta
      </Link>
      <h1 className="text-3xl font-extrabold text-violeta">Contrato</h1>

      {!texto && (
        <Aviso tipo="info">El contrato se habilita cuando administración registra la seña.</Aviso>
      )}

      {firmado && (
        <Aviso tipo="exito" titulo="Contrato aceptado">
          Aceptado por {firmado.aceptado_por_nombre} el {fechaHora(firmado.aceptado_en)} h. Esta versión quedó guardada y no cambia.
        </Aviso>
      )}

      {texto && (
        <article className="tarjeta whitespace-pre-line p-5 text-[15px] leading-relaxed">{texto}</article>
      )}

      {borrador && (
        <div className="no-imprimir tarjeta space-y-4 p-5">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-violeta" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <span>Leí el contrato y estoy de acuerdo con las condiciones.</span>
          </label>
          {error && <Aviso tipo="error" onActualizar={recargar}>{error}</Aviso>}
          <Boton tamano="lg" className="w-full" icono={ShieldCheck} disabled={!acepto} cargando={enviando} onClick={aceptar}>
            Acepto el contrato
          </Boton>
        </div>
      )}

      {firmado && (
        <Boton variante="secundario" icono={Printer} className="no-imprimir w-full" onClick={() => window.print()}>
          Imprimir o guardar en PDF
        </Boton>
      )}
      <p className="sr-only">{alquiler.codigo}</p>
    </div>
  )
}
