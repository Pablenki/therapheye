// =========================================
// EVOLUCIÓN DE TESTS CLÍNICOS — Therapheye
// Gráficas de progresión temporal por tipo de test
// =========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, Contrast, Crosshair, FlaskConical, Focus, Zap, Grid3x3 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sql } from '../neonCliente';

interface Props { onBack: () => void; }

interface TestPoint {
  fecha: string;
  value: number;
  label: string;
}

interface TestSeries {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  unit: string;
  points: TestPoint[];
  higherIsBetter: boolean;
}

// ── Mini line chart SVG ─────────────────────────────────────────────────────
function MiniChart({ points, color, higherIsBetter }: { points: TestPoint[]; color: string; higherIsBetter: boolean }) {
  if (points.length < 2) {
    return <div className="h-28 flex items-center justify-center text-gray-300 text-xs">Necesitas al menos 2 tests</div>;
  }

  const W = 320, H = 120;
  const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const vals = points.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const toX = (i: number) => PAD.left + (i / (points.length - 1)) * cW;
  const toY = (v: number) => PAD.top + cH - ((v - minV) / range) * cH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.value)}`).join(' ');
  const areaPath = linePath + ` L ${toX(points.length - 1)} ${PAD.top + cH} L ${toX(0)} ${PAD.top + cH} Z`;

  // Trend
  const first = vals[0], last = vals[vals.length - 1];
  const improving = higherIsBetter ? last > first : last < first;
  const stable = Math.abs(last - first) < range * 0.1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD.top + cH * (1 - pct);
          const val = Math.round(minV + range * pct);
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{val}</text>
            </g>
          );
        })}
        {/* Area */}
        <path d={areaPath} fill={`url(#grad-${color})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3.5" fill="white" stroke={color} strokeWidth="2" />
        ))}
        {/* Date labels for first and last */}
        <text x={toX(0)} y={H - 4} textAnchor="start" fontSize="8" fill="#9ca3af">
          {new Date(points[0].fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
        </text>
        <text x={toX(points.length - 1)} y={H - 4} textAnchor="end" fontSize="8" fill="#9ca3af">
          {new Date(points[points.length - 1].fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
        </text>
      </svg>
      <div className={`flex items-center gap-1.5 mt-1 text-xs font-semibold ${stable ? 'text-gray-400' : improving ? 'text-emerald-600' : 'text-red-500'}`}>
        {stable ? <Minus className="w-3 h-3" /> : improving ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {stable ? 'Estable' : improving ? 'Mejorando' : 'Revisar tendencia'}
        <span className="text-gray-400 font-normal ml-1">({points.length} tests)</span>
      </div>
    </div>
  );
}

export default function EvolucionTests({ onBack }: Props) {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<TestSeries[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      const results: TestSeries[] = [];

      // 1. Test de visión (agudeza)
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, mejor_nivel, agudeza
          FROM historial_vision_test
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'vision', name: 'Agudeza visual', icon: Eye, color: '#6366f1',
            unit: 'nivel', higherIsBetter: true,
            points: (rows as any[]).map(r => ({
              fecha: r.fecha, value: Number(r.mejor_nivel), label: r.agudeza ?? '',
            })),
          });
        }
      } catch { /* noop */ }

      // 2. Test de contraste
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, nivel_maximo, sensibilidad
          FROM contrast_tests
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'contraste', name: 'Sensibilidad al contraste', icon: Contrast, color: '#0d9488',
            unit: 'nivel', higherIsBetter: true,
            points: (rows as any[]).map(r => ({
              fecha: r.fecha, value: Number(r.nivel_maximo ?? r.sensibilidad ?? 0), label: `Nivel ${r.nivel_maximo}`,
            })),
          });
        }
      } catch { /* noop */ }

      // 3. Campo visual
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, puntos_detectados, total_puntos
          FROM campo_visual_tests
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'campo', name: 'Campo visual', icon: Crosshair, color: '#8b5cf6',
            unit: '%', higherIsBetter: true,
            points: (rows as any[]).map(r => {
              const total = Number(r.total_puntos) || 40;
              const detected = Number(r.puntos_detectados) || 0;
              return { fecha: r.fecha, value: Math.round((detected / total) * 100), label: `${detected}/${total}` };
            }),
          });
        }
      } catch { /* noop */ }

      // 4. Test cromático
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, aciertos, total_placas
          FROM test_cromatico
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'cromatico', name: 'Visión cromática', icon: FlaskConical, color: '#ec4899',
            unit: '%', higherIsBetter: true,
            points: (rows as any[]).map(r => {
              const total = Number(r.total_placas) || 1;
              return { fecha: r.fecha, value: Math.round((Number(r.aciertos) / total) * 100), label: `${r.aciertos}/${total}` };
            }),
          });
        }
      } catch { /* noop */ }

      // 5. Test acomodación (PPA — punto próximo, menor es mejor)
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, distancia_cm
          FROM test_acomodacion
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'acomodacion', name: 'Acomodación (PPA)', icon: Focus, color: '#f59e0b',
            unit: 'cm', higherIsBetter: false,
            points: (rows as any[]).map(r => ({
              fecha: r.fecha, value: Number(r.distancia_cm), label: `${r.distancia_cm} cm`,
            })),
          });
        }
      } catch { /* noop */ }

      // 6. Reacción visual (menor es mejor)
      try {
        const rows = await sql`
          SELECT DATE(created_at) as fecha, promedio_ms
          FROM reaccion_visual_tests
          WHERE user_id = ${user.id}
          ORDER BY created_at ASC
          LIMIT 50
        `;
        if ((rows as any[]).length > 0) {
          results.push({
            id: 'reaccion', name: 'Reacción visual', icon: Zap, color: '#ef4444',
            unit: 'ms', higherIsBetter: false,
            points: (rows as any[]).map(r => ({
              fecha: r.fecha, value: Number(r.promedio_ms), label: `${r.promedio_ms} ms`,
            })),
          });
        }
      } catch { /* noop */ }

      setSeries(results);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Evolución de Tests</h1>
          <p className="text-xs text-gray-400">Progresión temporal de tus pruebas clínicas</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl skeleton" />)}
          </div>
        )}

        {!loading && series.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Aún no hay datos</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Realiza tests clínicos (visión, contraste, campo visual, etc.) para ver tu evolución aquí.
            </p>
          </div>
        )}

        {!loading && series.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}18` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: s.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.points.length} resultados · Unidad: {s.unit}</p>
                </div>
                {s.points.length >= 2 && (
                  <div className="text-right">
                    <p className="text-lg font-black" style={{ color: s.color }}>
                      {s.points[s.points.length - 1].value}
                    </p>
                    <p className="text-[10px] text-gray-400">último</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <MiniChart points={s.points} color={s.color} higherIsBetter={s.higherIsBetter} />
              </div>
            </div>
          );
        })}

        {!loading && series.length > 0 && (
          <p className="text-xs text-gray-400 text-center pb-4">
            Los datos se muestran en orden cronológico. Realiza tests regularmente para ver tendencias significativas.
          </p>
        )}
      </div>
    </div>
  );
}
