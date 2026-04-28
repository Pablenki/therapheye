// =========================================
// DIARIO VISUAL — Therapheye
// El usuario escribe notas diarias sobre sus ojos.
// Claude las clasifica y extrae síntomas recurrentes.
// =========================================

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, Send, Loader2, Tag, TrendingUp, Search, Trash2, ChevronDown } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql, localISOString } from '../neonCliente';

interface Props { onBack: () => void }

interface EntradaDiario {
  id?: number;
  fecha: string;
  texto: string;
  clasificacion?: string;
  sintomas_detectados?: string[];
  estado_animo_visual?: 'bueno' | 'regular' | 'malo';
  created_at?: string;
}

interface SintomaFrecuente {
  sintoma: string;
  frecuencia: number;
}

const SYSTEM_PROMPT = `Eres un asistente de salud visual. Analiza la nota diaria del usuario sobre el estado de sus ojos.

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "clasificacion": "descripción de 1 oración del estado visual del día",
  "sintomas_detectados": ["sintoma1", "sintoma2"],
  "estado_animo_visual": "bueno|regular|malo"
}

- "sintomas_detectados": lista de síntomas específicos mencionados (máx 5). Si no hay síntomas, usa [].
- "estado_animo_visual": "bueno" si el usuario está bien, "regular" si tiene molestias leves, "malo" si tiene problemas significativos.
- "clasificacion": frase concisa que describe el estado visual del día.

Ejemplos de síntomas: "ojo seco", "fatiga visual", "dolor de cabeza", "visión borrosa", "picazón", "sensibilidad a la luz", "ojo rojo".`;

const ESTADO_COLOR: Record<string, string> = {
  bueno: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  regular: 'text-amber-600 bg-amber-50 border-amber-200',
  malo: 'text-red-600 bg-red-50 border-red-200',
};
const ESTADO_EMOJI: Record<string, string> = { bueno: '😊', regular: '😐', malo: '😟' };
const ESTADO_LABEL: Record<string, string> = { bueno: 'Bien', regular: 'Regular', malo: 'Mal' };

export default function DiarioVisual({ onBack }: Props) {
  const { user } = useUser();
  const [entradas, setEntradas] = useState<EntradaDiario[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEntradas, setLoadingEntradas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [sintomasFrecuentes, setSintomasFrecuentes] = useState<SintomaFrecuente[]>([]);
  const [filtroSintoma, setFiltroSintoma] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inicializarYCargar(); }, [user?.id]);

  const inicializarYCargar = async () => {
    if (!user?.id) return;
    setLoadingEntradas(true);
    try {
      await cargarEntradas();
    } catch (e) {
      console.error('Error init diario:', e);
    } finally {
      setLoadingEntradas(false);
    }
  };

  const cargarEntradas = async () => {
    if (!user?.id) return;
    const rows = await sql`
      SELECT id, texto, clasificacion, sintomas_detectados, estado_animo_visual, created_at
      FROM diario_visual
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 60
    `;
    const parsed: EntradaDiario[] = rows.map((r: any) => ({
      id: r.id,
      fecha: r.created_at,
      texto: r.texto,
      clasificacion: r.clasificacion,
      sintomas_detectados: typeof r.sintomas_detectados === 'string'
        ? JSON.parse(r.sintomas_detectados) : (r.sintomas_detectados ?? []),
      estado_animo_visual: r.estado_animo_visual,
      created_at: r.created_at,
    }));
    setEntradas(parsed);
    calcularSintomasFrecuentes(parsed);
  };

  const calcularSintomasFrecuentes = (data: EntradaDiario[]) => {
    const mapa: Record<string, number> = {};
    data.forEach(e => {
      (e.sintomas_detectados ?? []).forEach(s => {
        mapa[s] = (mapa[s] ?? 0) + 1;
      });
    });
    const lista = Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([sintoma, frecuencia]) => ({ sintoma, frecuencia }));
    setSintomasFrecuentes(lista);
  };

  const guardarEntrada = async () => {
    if (!texto.trim() || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Llamar a Claude para clasificar
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: texto }],
        }),
      });

      let clasificacion = '';
      let sintomas: string[] = [];
      let estado: string = 'regular';

      if (resp.ok) {
        const data = await resp.json();
        const raw = data.content[0].text;
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          clasificacion = parsed.clasificacion ?? '';
          sintomas = Array.isArray(parsed.sintomas_detectados) ? parsed.sintomas_detectados : [];
          estado = parsed.estado_animo_visual ?? 'regular';
        }
      }

      await sql`
        INSERT INTO diario_visual (user_id, texto, clasificacion, sintomas_detectados, estado_animo_visual, created_at)
        VALUES (${user.id}, ${texto}, ${clasificacion}, ${JSON.stringify(sintomas)}, ${estado}, ${localISOString()})
      `;
      setTexto('');
      await cargarEntradas();
    } catch (e: any) {
      setError('Error al guardar la entrada');
    } finally {
      setLoading(false);
    }
  };

  const eliminarEntrada = async (id: number) => {
    try {
      await sql`DELETE FROM diario_visual WHERE id = ${id} AND user_id = ${user!.id}`;
      await cargarEntradas();
    } catch (e) {
      console.error('Error al eliminar:', e);
    }
  };

  const entradasFiltradas = entradas.filter(e => {
    const matchBusqueda = !busqueda || e.texto.toLowerCase().includes(busqueda.toLowerCase()) ||
      (e.clasificacion ?? '').toLowerCase().includes(busqueda.toLowerCase());
    const matchSintoma = !filtroSintoma || (e.sintomas_detectados ?? []).includes(filtroSintoma);
    return matchBusqueda && matchSintoma;
  });

  const hoyStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const yaEscribioHoy = entradas.some(e => {
    if (!e.created_at) return false;
    const d = new Date(e.created_at);
    const hoy = new Date();
    return d.toDateString() === hoy.toDateString();
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Diario Visual</h1>
            <p className="text-xs text-gray-500 capitalize">{hoyStr}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Nueva entrada */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {yaEscribioHoy && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-3">
              <span>✓</span> Ya escribiste una entrada hoy. Puedes agregar otra si lo deseas.
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={4}
            placeholder="¿Cómo se sintieron tus ojos hoy? Describe cualquier molestia, fatiga, o si te fue bien..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <button
            onClick={guardarEntrada}
            disabled={loading || !texto.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl py-2.5 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Analizando con IA...' : 'Guardar entrada'}
          </button>
        </div>

        {/* Síntomas frecuentes */}
        {sintomasFrecuentes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-500" />
              Síntomas más frecuentes
            </h3>
            <div className="flex flex-wrap gap-2">
              {sintomasFrecuentes.map(({ sintoma, frecuencia }) => (
                <button
                  key={sintoma}
                  onClick={() => setFiltroSintoma(filtroSintoma === sintoma ? null : sintoma)}
                  className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition ${
                    filtroSintoma === sintoma
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  {sintoma}
                  <span className={`font-bold ${filtroSintoma === sintoma ? 'text-teal-100' : 'text-teal-600'}`}>
                    ×{frecuencia}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Búsqueda */}
        {entradas.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en el diario..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
        )}

        {/* Entradas */}
        {loadingEntradas ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
          </div>
        ) : entradasFiltradas.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{entradas.length === 0 ? 'Escribe tu primera entrada del diario' : 'No hay entradas que coincidan'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entradasFiltradas.map(entrada => {
              const fecha = entrada.created_at ? new Date(entrada.created_at) : new Date();
              const esHoy = fecha.toDateString() === new Date().toDateString();
              const expanded = expandedId === entrada.id;
              return (
                <div key={entrada.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entrada.estado_animo_visual && (
                          <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium ${ESTADO_COLOR[entrada.estado_animo_visual]}`}>
                            {ESTADO_EMOJI[entrada.estado_animo_visual]} {ESTADO_LABEL[entrada.estado_animo_visual]}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {esHoy ? 'Hoy' : fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          {' · '}{fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedId(expanded ? null : (entrada.id ?? null))}
                          className="p-1 text-gray-400 hover:text-gray-600 transition"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button
                          onClick={() => entrada.id && eliminarEntrada(entrada.id)}
                          className="p-1 text-gray-300 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {entrada.clasificacion && (
                      <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-1.5 mt-2 leading-relaxed">
                        {entrada.clasificacion}
                      </p>
                    )}

                    {(entrada.sintomas_detectados ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entrada.sintomas_detectados!.map(s => (
                          <span key={s} className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {expanded && (
                    <div className="px-4 pb-3 border-t border-gray-50">
                      <p className="text-sm text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">{entrada.texto}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
