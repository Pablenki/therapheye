import { useState, useEffect } from 'react'
import { ArrowLeft, Eye, ScanEye, Loader2, RefreshCw, BarChart2, AlertCircle, CheckCircle2, Navigation } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { sql } from '../neonCliente'

type DiagPage = 'image-capture' | 'questionnaire' | 'visual-health' | 'exercises' | 'vision-test'
type Props = { onBack: () => void; onNavigate?: (page: DiagPage) => void }

// ─── Mapas de conversión ──────────────────────────────────────────────────────
const SINTOMA_VALOR: Record<string, number> = {
  ojo_sano: 0, enro_leve: 25, piel_enro: 35,
  enro_moderado: 50, parpado_caido: 70, enro_grave: 90,
}

const getValorTiempo = (ms: number): number => {
  const h = ms / 3600000
  if (h < 2) return 10
  if (h < 4) return 30
  if (h < 6) return 60
  if (h < 8) return 80
  return 100
}

const getValorEjercicios = (n: number): number => {
  if (n <= 0) return 100
  if (n === 1) return 80
  if (n === 2) return 60
  if (n === 3) return 40
  if (n === 4) return 20
  return 0
}

const getNivel = (score: number): string => {
  if (score <= 30) return 'Bajo'
  if (score <= 60) return 'Moderado'
  if (score <= 80) return 'Alto'
  return 'Muy alto'
}

const getNivelColor = (score: number) => {
  if (score <= 30) return { text: 'text-green-600',  bg: 'bg-green-100',  border: 'border-green-400',  ring: 'ring-green-400'  }
  if (score <= 60) return { text: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-400', ring: 'ring-yellow-400' }
  if (score <= 80) return { text: 'text-red-600',    bg: 'bg-red-100',    border: 'border-red-400',    ring: 'ring-red-400'    }
  return              { text: 'text-red-800',    bg: 'bg-red-200',    border: 'border-red-600',    ring: 'ring-red-600'    }
}

interface DiagnosticoGuardado {
  id: string
  score_final: number
  nivel: string
  valor_imagen: number
  valor_cuestionario: number
  valor_tiempo: number
  valor_ejercicios: number
  valor_pruebas: number
  aporte_imagen: number
  aporte_cuestionario: number
  aporte_tiempo: number
  aporte_ejercicios: number
  aporte_pruebas: number
  insights_json: string[]
  recomendaciones_json: string[]
  created_at: string
}

// ─── Generar texto inteligente ────────────────────────────────────────────────
const generarTextoInteligente = (d: DiagnosticoGuardado): string => {
  const nivel = getNivel(d.score_final)
  const factores = [
    { nombre: 'la captura de imagen', aporte: d.aporte_imagen },
    { nombre: 'el cuestionario de síntomas', aporte: d.aporte_cuestionario },
    { nombre: 'el tiempo en pantalla', aporte: d.aporte_tiempo },
    { nombre: 'los ejercicios visuales', aporte: d.aporte_ejercicios },
    { nombre: 'las pruebas de visión', aporte: d.aporte_pruebas },
  ].sort((a, b) => b.aporte - a.aporte)

  const top = factores[0].nombre
  const segundo = factores[1].nombre

  let texto = `Tu nivel de fatiga visual es ${nivel.toLowerCase()} (${d.score_final.toFixed(1)}/100). `
  if (d.score_final <= 30) {
    texto += `Tus ojos se encuentran en buen estado. Continúa con tus hábitos saludables y mantén descansos regulares.`
  } else if (d.score_final <= 60) {
    texto += `Se detecta fatiga moderada. Los principales factores que contribuyen son ${top} y ${segundo}. Se recomienda atención en estos aspectos para prevenir mayor deterioro.`
  } else if (d.score_final <= 80) {
    texto += `Nivel de fatiga alto. El factor más relevante es ${top}. Es importante tomar medidas correctivas pronto para proteger tu salud visual.`
  } else {
    texto += `Nivel de fatiga muy alto. Tu salud visual requiere atención inmediata. El mayor impacto proviene de ${top}. Considera consultar con un especialista.`
  }
  return texto
}

const generarInsights = (d: Omit<DiagnosticoGuardado, 'insights_json' | 'recomendaciones_json' | 'created_at' | 'id'>): string[] => {
  const factores = [
    { nombre: 'Captura de imagen',   aporte: d.aporte_imagen,       valor: d.valor_imagen       },
    { nombre: 'Cuestionario',        aporte: d.aporte_cuestionario,  valor: d.valor_cuestionario },
    { nombre: 'Tiempo en pantalla',  aporte: d.aporte_tiempo,        valor: d.valor_tiempo       },
    { nombre: 'Ejercicios visuales', aporte: d.aporte_ejercicios,    valor: d.valor_ejercicios   },
    { nombre: 'Pruebas de visión',   aporte: d.aporte_pruebas,       valor: d.valor_pruebas      },
  ].sort((a, b) => b.aporte - a.aporte)

  const insights: string[] = []
  insights.push(`Factor principal: ${factores[0].nombre} con ${factores[0].aporte.toFixed(1)} puntos de impacto.`)
  if (d.valor_tiempo >= 80) insights.push('Llevas muchas horas frente a pantallas hoy — esto eleva significativamente la fatiga.')
  if (d.valor_ejercicios >= 80) insights.push('Realizar muy pocos ejercicios oculares incrementa el riesgo de fatiga acumulada.')
  if (d.valor_imagen >= 50) insights.push('La imagen del ojo muestra signos visibles de fatiga o irritación.')
  if (d.valor_cuestionario >= 60) insights.push('El cuestionario refleja síntomas subjetivos importantes de fatiga visual.')
  if (d.valor_pruebas >= 50) insights.push('Se detectaron errores en las pruebas de visión que contribuyen al diagnóstico.')
  return insights.slice(0, 3)
}

const generarRecomendaciones = (d: Omit<DiagnosticoGuardado, 'insights_json' | 'recomendaciones_json' | 'created_at' | 'id'>): string[] => {
  const recs: string[] = []
  if (d.valor_tiempo >= 60) recs.push('Aplica la regla 20-20-20: cada 20 minutos, mira a 20 pies por 20 segundos.')
  if (d.valor_ejercicios >= 60) recs.push('Realiza ejercicios oculares diarios como palming, enfoque cercano-lejano y círculos.')
  if (d.valor_imagen >= 35) recs.push('Mantén buena hidratación y evita frotarte los ojos para reducir el enrojecimiento.')
  if (d.valor_cuestionario >= 50) recs.push('Ajusta el brillo y la posición de la pantalla para reducir el esfuerzo visual.')
  if (d.valor_pruebas >= 30) recs.push('Considera hacerte una revisión oftalmológica si los errores en la prueba de visión persisten.')
  recs.push('Duerme al menos 7-8 horas para permitir la recuperación ocular completa.')
  return recs.slice(0, 4)
}

// ─── Texto explicativo por factor ────────────────────────────────────────────
const explicacionFactor = (label: string, valor: number): string => {
  switch (label) {
    case 'Captura de imagen':
      if (valor === 0) return 'Tu imagen mostró ojos saludables, sin signos de irritación ni enrojecimiento.';
      if (valor <= 25) return 'Se detectó leve enrojecimiento ocular. Puede ser cansancio normal al final del día.';
      if (valor <= 35) return 'Irritación leve en párpado o piel alrededor del ojo. Podría ser alergia o frotamiento.';
      if (valor <= 50) return 'Enrojecimiento moderado detectado. Indicador claro de fatiga visual acumulada.';
      if (valor <= 70) return 'Párpado caído visible en la imagen. Señal de fatiga muscular ocular importante.';
      return 'Enrojecimiento grave en el ojo. Requiere atención, evita seguir frente a pantallas.';
    case 'Cuestionario':
      if (valor <= 20) return 'Reportaste muy pocos síntomas. Tus ojos se sienten bien según tu propia evaluación.';
      if (valor <= 40) return 'Síntomas leves: ligero cansancio o visión borrosa puntual. Nivel manejable.';
      if (valor <= 60) return 'Síntomas moderados: molestias que afectan tu comodidad visual de manera regular.';
      if (valor <= 80) return 'Síntomas significativos: dolor, visión doble o fatiga constante reportados.';
      return 'Síntomas severos en el cuestionario. Muy alta carga de fatiga visual subjetiva.';
    case 'Tiempo en pantalla':
      if (valor <= 10) return 'Menos de 2 horas frente a pantallas hoy. Exposición muy controlada y saludable.';
      if (valor <= 30) return 'Entre 2 y 4 horas en pantalla. Moderado y dentro de un rango razonable.';
      if (valor <= 60) return 'Entre 4 y 6 horas en pantalla. Ya genera acumulación de fatiga visual.';
      if (valor <= 80) return 'Entre 6 y 8 horas. Nivel elevado que requiere pausas activas y la regla 20-20-20.';
      return 'Más de 8 horas frente a pantallas. El principal factor de riesgo en tu diagnóstico.';
    case 'Ejercicios visuales':
      if (valor <= 0) return '5 o más ejercicios completados. ¡Excelente rutina! Los ejercicios compensan la fatiga.';
      if (valor <= 20) return '4 ejercicios realizados. Buena práctica; uno más daría mayor protección.';
      if (valor <= 40) return '3 ejercicios completados. Ayuda, pero aumentar la frecuencia reduciría la fatiga.';
      if (valor <= 60) return 'Solo 2 ejercicios hoy. La regularidad en la rutina visual es clave para mejorar.';
      if (valor <= 80) return 'Un único ejercicio. La baja frecuencia incrementa directamente el riesgo de fatiga.';
      return 'Sin ejercicios oculares hoy. La ausencia de práctica contribuye al puntaje de fatiga.';
    case 'Pruebas de visión':
      if (valor <= 0) return 'Pasaste todos los niveles del test. Agudeza visual excelente, sin errores.';
      if (valor <= 20) return 'Alcanzaste un nivel alto de agudeza. Visión por encima del promedio general.';
      if (valor <= 40) return 'Buena agudeza visual con algunos errores en los niveles más exigentes.';
      if (valor <= 60) return 'Agudeza visual media. Considera revisión si los errores persisten con frecuencia.';
      if (valor <= 80) return 'Dificultad en varios niveles del test. Podría indicar necesidad de corrección óptica.';
      return 'Errores frecuentes en el test de visión. Se recomienda evaluación oftalmológica.';
    default: return '';
  }
};

// ─── Barra horizontal de impacto ─────────────────────────────────────────────
const FactorBar = ({ label, aporte, maxAporte, color, valor, peso }: {
  label: string; aporte: number; maxAporte: number; color: string; valor: number; peso: number;
}) => {
  const pct = maxAporte > 0 ? Math.round((aporte / maxAporte) * 100) : 0
  const explicacion = explicacionFactor(label, valor)
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{valor}/100 · {peso}%</span>
          <span className="text-sm font-bold text-gray-800">{aporte.toFixed(1)} pts</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden mb-1.5">
        <div
          className={`h-3.5 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 leading-snug">{explicacion}</p>
    </div>
  )
}

// ─── Score circular ───────────────────────────────────────────────────────────
const ScoreCircle = ({ score }: { score: number }) => {
  const colors = getNivelColor(score)
  const nivel  = getNivel(score)
  const radius = 54
  const circ   = 2 * Math.PI * radius
  const dash   = (score / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke={score <= 30 ? '#16a34a' : score <= 60 ? '#ca8a04' : score <= 80 ? '#dc2626' : '#7f1d1d'}
            strokeWidth="12" strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${colors.text}`}>{score.toFixed(0)}</span>
          <span className="text-xs text-gray-400 font-medium">/ 100</span>
        </div>
      </div>
      <div className={`mt-3 px-4 py-1.5 rounded-full text-sm font-bold border ${colors.text} ${colors.bg} ${colors.border}`}>
        {nivel}
      </div>
    </div>
  )
}

// ─── Módulo principal ─────────────────────────────────────────────────────────
// Mapa: nombre del faltante → página a la que navegar
const FALTANTE_PAGE: Record<string, DiagPage> = {
  'Captura de imagen (hoy)': 'image-capture',
  'Cuestionario (hoy)': 'questionnaire',
  'Tiempo en pantalla (hoy)': 'visual-health',
  'Ejercicios visuales (hoy)': 'exercises',
  'Prueba de visión (hoy)': 'vision-test',
}

const FALTANTE_ICON: Record<string, string> = {
  'Captura de imagen (hoy)': '📷',
  'Cuestionario (hoy)': '📋',
  'Tiempo en pantalla (hoy)': '⏱️',
  'Ejercicios visuales (hoy)': '🏃',
  'Prueba de visión (hoy)': '👁️',
}

const DiagnosticoCompleto = ({ onBack, onNavigate }: Props) => {
  const { user } = useUser()
  const [loading, setLoading]         = useState(true)
  const [generando, setGenerando]     = useState(false)
  const [diagnostico, setDiagnostico] = useState<DiagnosticoGuardado | null>(null)
  const [historialDiag, setHistorialDiag] = useState<DiagnosticoGuardado[]>([])
  const [faltantes, setFaltantes]     = useState<string[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [progreso, setProgreso]       = useState(0)

  // Crear tablas e intentar cargar diagnóstico existente
  useEffect(() => {
    if (!user?.id) return
    const init = async () => {
      try {
        const rows = await sql`
          SELECT * FROM diagnostico_completo
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 5
        `.catch(() => [])

        if (rows && rows.length > 0) {
          const parseDiag = (r: any): DiagnosticoGuardado => ({
            id:                   String(r.id),
            score_final:          Number(r.score_final),
            nivel:                r.nivel,
            valor_imagen:         Number(r.valor_imagen),
            valor_cuestionario:   Number(r.valor_cuestionario),
            valor_tiempo:         Number(r.valor_tiempo),
            valor_ejercicios:     Number(r.valor_ejercicios),
            valor_pruebas:        Number(r.valor_pruebas),
            aporte_imagen:        Number(r.aporte_imagen),
            aporte_cuestionario:  Number(r.aporte_cuestionario),
            aporte_tiempo:        Number(r.aporte_tiempo),
            aporte_ejercicios:    Number(r.aporte_ejercicios),
            aporte_pruebas:       Number(r.aporte_pruebas),
            insights_json:        JSON.parse(r.insights_json || '[]'),
            recomendaciones_json: JSON.parse(r.recomendaciones_json || '[]'),
            created_at:           r.created_at,
          })
          const parsed = rows.map(parseDiag)
          setHistorialDiag(parsed)
          setDiagnostico(parsed[0])
        }
      } catch (e) {
        console.error('[DiagnosticoCompleto] init error:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [user?.id])

  const validarYGenerar = async () => {
    if (!user?.id) return
    setError(null)
    setFaltantes([])

    // Validar que existan datos del DÍA DE HOY en todos los módulos
    const missing: string[] = []
    const today = new Date().toISOString().slice(0, 10) // "2026-05-04"
    const [imgRows, cuestionarioRows, timerRows, ejerciciosRows, visionRows] = await Promise.all([
      sql`SELECT sintoma FROM image_capture_history WHERE user_id = ${user.id} AND DATE(created_at AT TIME ZONE 'America/Mexico_City') = ${today} LIMIT 1`.catch(() => []),
      sql`SELECT puntaje_fatiga FROM respuestas_cuestionario WHERE user_id = ${user.id} AND DATE(created_at AT TIME ZONE 'America/Mexico_City') = ${today} LIMIT 1`.catch(() => []),
      sql`SELECT accumulated_ms FROM timer_state WHERE user_id = ${user.id} AND fecha = ${today} ORDER BY fecha DESC LIMIT 1`.catch(() => []),
      sql`SELECT COUNT(*) as total FROM historial_ejercicios WHERE user_id = ${user.id} AND status = 'completed' AND DATE(created_at AT TIME ZONE 'America/Mexico_City') = ${today}`.catch(() => [{ total: 0 }]),
      sql`SELECT mejor_nivel, resultados_json FROM historial_vision_test WHERE user_id = ${user.id} AND DATE(created_at AT TIME ZONE 'America/Mexico_City') = ${today} ORDER BY created_at DESC LIMIT 1`.catch(() => []),
    ])

    if (!imgRows || imgRows.length === 0)         missing.push('Captura de imagen (hoy)')
    if (!cuestionarioRows || cuestionarioRows.length === 0) missing.push('Cuestionario (hoy)')
    if (!timerRows || timerRows.length === 0)     missing.push('Tiempo en pantalla (hoy)')
    if (!ejerciciosRows || ejerciciosRows.length === 0 || Number(ejerciciosRows[0]?.total) === 0) missing.push('Ejercicios visuales (hoy)')
    if (!visionRows || visionRows.length === 0)   missing.push('Prueba de visión (hoy)')

    if (missing.length > 0) {
      setFaltantes(missing)
      return
    }

    // Animación de carga ~5 segundos
    setGenerando(true)
    setProgreso(0)
    const interval = setInterval(() => {
      setProgreso(p => {
        if (p >= 95) { clearInterval(interval); return 95 }
        return p + 4
      })
    }, 200)

    await new Promise(r => setTimeout(r, 5000))
    clearInterval(interval)
    setProgreso(100)

    try {
      // Calcular valores
      const valorImagen       = SINTOMA_VALOR[imgRows[0].sintoma as string] ?? 0
      const valorCuestionario = Number(cuestionarioRows[0].puntaje_fatiga)
      const valorTiempo       = getValorTiempo(Number(timerRows[0].accumulated_ms ?? 0))
      const valorEjercicios   = getValorEjercicios(Number(ejerciciosRows[0]?.total ?? 0))

      // Usar mejor_nivel inversamente: nivel 10 = 0% fatiga, nivel 0 = 100% fatiga
      // Esto es más preciso que contar errores (que no reflejan dónde falló el usuario)
      const mejorNivel = Number(visionRows[0].mejor_nivel ?? 0)
      const valorPruebas = Math.max(0, (10 - mejorNivel) * 10)

      // Aportes reales
      const aporteImagen       = (valorImagen       / 100) * 30
      const aporteCuestionario = (valorCuestionario / 100) * 25
      const aporteTiempo       = (valorTiempo       / 100) * 20
      const aporteEjercicios   = (valorEjercicios   / 100) * 15
      const aportePruebas      = (valorPruebas      / 100) * 10

      const scoreFinal = aporteImagen + aporteCuestionario + aporteTiempo + aporteEjercicios + aportePruebas
      const nivel      = getNivel(scoreFinal)

      const datos = { score_final: scoreFinal, nivel, valor_imagen: valorImagen, valor_cuestionario: valorCuestionario, valor_tiempo: valorTiempo, valor_ejercicios: valorEjercicios, valor_pruebas: valorPruebas, aporte_imagen: aporteImagen, aporte_cuestionario: aporteCuestionario, aporte_tiempo: aporteTiempo, aporte_ejercicios: aporteEjercicios, aporte_pruebas: aportePruebas }
      const insights      = generarInsights(datos)
      const recomendaciones = generarRecomendaciones(datos)

      // Guardar en BD (upsert: un registro por usuario, siempre actualizar)
      await sql`
        INSERT INTO diagnostico_completo
          (user_id, score_final, nivel, valor_imagen, valor_cuestionario, valor_tiempo, valor_ejercicios, valor_pruebas, aporte_imagen, aporte_cuestionario, aporte_tiempo, aporte_ejercicios, aporte_pruebas, insights_json, recomendaciones_json)
        VALUES
          (${user.id}, ${scoreFinal}, ${nivel}, ${valorImagen}, ${valorCuestionario}, ${valorTiempo}, ${valorEjercicios}, ${valorPruebas}, ${aporteImagen}, ${aporteCuestionario}, ${aporteTiempo}, ${aporteEjercicios}, ${aportePruebas}, ${JSON.stringify(insights)}, ${JSON.stringify(recomendaciones)})
      `

      // Recargar el diagnóstico recién guardado
      const rows = await sql`
        SELECT * FROM diagnostico_completo WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1
      `
      const r = rows[0]
      setDiagnostico({
        id:                   String(r.id),
        score_final:          Number(r.score_final),
        nivel:                r.nivel,
        valor_imagen:         Number(r.valor_imagen),
        valor_cuestionario:   Number(r.valor_cuestionario),
        valor_tiempo:         Number(r.valor_tiempo),
        valor_ejercicios:     Number(r.valor_ejercicios),
        valor_pruebas:        Number(r.valor_pruebas),
        aporte_imagen:        Number(r.aporte_imagen),
        aporte_cuestionario:  Number(r.aporte_cuestionario),
        aporte_tiempo:        Number(r.aporte_tiempo),
        aporte_ejercicios:    Number(r.aporte_ejercicios),
        aporte_pruebas:       Number(r.aporte_pruebas),
        insights_json:        JSON.parse(r.insights_json || '[]'),
        recomendaciones_json: JSON.parse(r.recomendaciones_json || '[]'),
        created_at:           r.created_at,
      })
    } catch (e) {
      setError('Ocurrió un error al generar el diagnóstico. Inténtalo de nuevo.')
      console.error('[DiagnosticoCompleto] error generando:', e)
    } finally {
      setGenerando(false)
      setProgreso(0)
    }
  }

  // ── Loading inicial ──
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando diagnóstico...</p>
        </div>
      </div>
    )
  }

  const FACTORES_BAR = diagnostico ? [
    { label: 'Captura de imagen',   aporte: diagnostico.aporte_imagen,       color: 'bg-red-500',    valor: diagnostico.valor_imagen,       peso: 30 },
    { label: 'Cuestionario',        aporte: diagnostico.aporte_cuestionario,  color: 'bg-blue-500',   valor: diagnostico.valor_cuestionario,  peso: 25 },
    { label: 'Tiempo en pantalla',  aporte: diagnostico.aporte_tiempo,        color: 'bg-orange-500', valor: diagnostico.valor_tiempo,        peso: 20 },
    { label: 'Ejercicios visuales', aporte: diagnostico.aporte_ejercicios,    color: 'bg-green-500',  valor: diagnostico.valor_ejercicios,    peso: 15 },
    { label: 'Pruebas de visión',   aporte: diagnostico.aporte_pruebas,       color: 'bg-teal-500',   valor: diagnostico.valor_pruebas,       peso: 10 },
  ] : []
  const maxAporte = FACTORES_BAR.length ? Math.max(...FACTORES_BAR.map(f => f.aporte), 1) : 1

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Therapheye</h1>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Volver</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24">
        {/* Título */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-violet-600 rounded-xl">
            <ScanEye className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Diagnóstico completo</h2>
            <p className="text-gray-500 text-sm">Análisis integral de tu salud visual</p>
          </div>
        </div>

        {/* Pantalla inicial sin diagnóstico */}
        {!diagnostico && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <p className="text-gray-700 font-medium mb-6">Se analizarán los datos de los siguientes módulos:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                { icon: '📷', label: 'Captura de imagen',   desc: 'Análisis ocular por IA' },
                { icon: '📋', label: 'Cuestionario',        desc: 'Síntomas reportados' },
                { icon: '⏱️', label: 'Tiempo en pantalla',  desc: 'Horas de exposición' },
                { icon: '🏃', label: 'Ejercicios visuales', desc: 'Ejercicios completados' },
                { icon: '👁️', label: 'Prueba de visión',    desc: 'Agudeza visual' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-4 bg-violet-50 rounded-xl border border-violet-100">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Faltantes con botones de navegación */}
            {faltantes.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">
                    Falta completar {faltantes.length} módulo{faltantes.length > 1 ? 's' : ''} de hoy:
                  </p>
                </div>
                <div className="space-y-2">
                  {faltantes.map(f => (
                    <div key={f} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                      <span className="text-sm text-amber-800 flex items-center gap-2">
                        <span>{FALTANTE_ICON[f] ?? '📌'}</span>
                        <span>{f.replace(' (hoy)', '')}</span>
                      </span>
                      {onNavigate && FALTANTE_PAGE[f] && (
                        <button
                          onClick={() => onNavigate(FALTANTE_PAGE[f])}
                          className="flex items-center gap-1 text-xs bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 transition font-medium"
                        >
                          <Navigation className="w-3 h-3" />
                          Ir ahora
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}

            {/* Botón generar */}
            <button
              onClick={validarYGenerar}
              disabled={generando}
              className="w-full flex items-center justify-center gap-3 py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generando ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Analizando... {progreso}%</span>
                </>
              ) : (
                <>
                  <BarChart2 className="w-6 h-6" />
                  <span>Generar diagnóstico</span>
                </>
              )}
            </button>

            {/* Barra de progreso */}
            {generando && (
              <div className="mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-violet-500 rounded-full transition-all duration-200"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Resultado del diagnóstico */}
        {diagnostico && (
          <>
            {/* Score principal */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              {/* Última vez realizado */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span>🕐</span>
                  Último diagnóstico:{' '}
                  <span className="font-semibold text-gray-600">
                    {new Date(diagnostico.created_at).toLocaleString('es-MX', {
                      dateStyle: 'medium', timeStyle: 'short'
                    })}
                  </span>
                </p>
                {historialDiag.length > 1 && (
                  <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                    {historialDiag.length} diagnósticos
                  </span>
                )}
              </div>
              {/* Mini historial de scores */}
              {historialDiag.length > 1 && (
                <div className="mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Historial de calificaciones</p>
                  <div className="flex items-end gap-2 overflow-x-auto pb-1">
                    {[...historialDiag].reverse().map((h, i) => {
                      const colors = getNivelColor(h.score_final)
                      const isLatest = i === historialDiag.length - 1
                      return (
                        <div key={h.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                          <span className={`text-[10px] font-bold ${colors.text}`}>{Math.round(h.score_final)}</span>
                          <div
                            className={`w-6 rounded-t transition-all ${colors.bg} border ${colors.border} ${isLatest ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
                            style={{ height: `${Math.max(8, h.score_final * 0.4)}px` }}
                            title={new Date(h.created_at).toLocaleDateString('es-MX')}
                          />
                          <span className="text-[8px] text-gray-400">
                            {new Date(h.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <ScoreCircle score={diagnostico.score_final} />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">Resultado general</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Imagen',    val: diagnostico.valor_imagen,       color: 'text-red-600'    },
                      { label: 'Cuestion.', val: diagnostico.valor_cuestionario,  color: 'text-blue-600'   },
                      { label: 'Tiempo',    val: diagnostico.valor_tiempo,        color: 'text-orange-600' },
                      { label: 'Ejercicios',val: diagnostico.valor_ejercicios,    color: 'text-green-600'  },
                      { label: 'Visión',    val: diagnostico.valor_pruebas,       color: 'text-teal-600'   },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className={`text-lg font-black ${item.color}`}>{item.val}<span className="text-xs font-normal text-gray-400">/100</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfica de barras — aporte real */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 className="w-5 h-5 text-violet-600" />
                <h3 className="text-xl font-bold text-gray-800">Impacto real por factor</h3>
              </div>
              {FACTORES_BAR.map(f => (
                <FactorBar key={f.label} label={f.label} aporte={f.aporte} maxAporte={maxAporte} color={f.color} valor={f.valor} peso={f.peso} />
              ))}
              <p className="text-xs text-gray-400 mt-4">Las barras muestran el aporte ponderado de cada factor al score total (máx. 100 pts).</p>
            </div>

            {/* Texto inteligente */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Interpretación</h3>
              <p className="text-gray-700 leading-relaxed">{generarTextoInteligente(diagnostico)}</p>
            </div>

            {/* Insights + Recomendaciones */}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              {/* Insights */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🔍</span>
                  <h3 className="text-lg font-bold text-gray-800">Insights clave</h3>
                </div>
                <ul className="space-y-3">
                  {diagnostico.insights_json.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recomendaciones */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">💡</span>
                  <h3 className="text-lg font-bold text-gray-800">Recomendaciones</h3>
                </div>
                <ul className="space-y-3">
                  {diagnostico.recomendaciones_json.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Aviso legal */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-amber-800">
                ⚕️ <strong>Este resultado es una estimación y no sustituye la evaluación de un profesional.</strong>
              </p>
            </div>

            {/* Botón actualizar */}
            <button
              onClick={validarYGenerar}
              disabled={generando}
              className="w-full flex items-center justify-center gap-3 py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed mb-4"
            >
              {generando ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Actualizando... {progreso}%</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-6 h-6" />
                  <span>Actualizar diagnóstico</span>
                </>
              )}
            </button>

            {/* Barra de progreso al actualizar */}
            {generando && (
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-4">
                <div
                  className="h-2 bg-violet-500 rounded-full transition-all duration-200"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            )}

            {/* Faltantes al actualizar */}
            {faltantes.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">Faltan datos en:</p>
                  <ul className="text-sm text-amber-700 space-y-0.5">
                    {faltantes.map(f => <li key={f}>• {f}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default DiagnosticoCompleto
