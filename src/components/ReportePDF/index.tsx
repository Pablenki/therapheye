// =========================================
// REPORTE PDF MENSUAL — Therapheye
// Usa @react-pdf/renderer para generar PDF descargable
// =========================================

import { useState } from 'react';
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { FileText, Loader2 } from 'lucide-react';
import { sql } from '../../neonCliente';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface ReportData {
  userName: string;
  period: string;
  generatedAt: string;
  // Fatiga
  evaluaciones: { fecha: string; puntaje: number; nivel: string; sintoma: string }[];
  avgFatiga: number;
  // Visión
  visionTests: { fecha: string; nivel: number; agudeza: string }[];
  // Ejercicios
  ejercicios: { fecha: string; nombre: string; duracion: string; estado: string }[];
  ejerciciosCompletados: number;
  // Capturas
  capturas: { fecha: string; diagnostico: string }[];
}

// ─── Estilos PDF ────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#fafafa' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #1B396B' },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1B396B' },
  logoSub: { fontSize: 9, color: '#6366f1', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1B396B' },
  headerDate: { fontSize: 8, color: '#6b7280', marginTop: 3 },
  // Resumen
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  summaryCard: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1B396B' },
  summaryLabel: { fontSize: 7.5, color: '#6b7280', textAlign: 'center', marginTop: 2 },
  // Secciones
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1B396B', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e0e7ff' },
  // Tabla
  tableHeader: { flexDirection: 'row', backgroundColor: '#1B396B', borderRadius: 4, padding: '5 8', marginBottom: 2 },
  tableHeaderCell: { color: '#ffffff', fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', padding: '4 8', borderRadius: 3 },
  tableRowEven: { backgroundColor: '#f1f5f9' },
  tableCell: { fontSize: 7.5, color: '#374151' },
  // Colores de fatiga
  low: { color: '#16a34a' },
  mid: { color: '#d97706' },
  high: { color: '#dc2626' },
  // Footer
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, borderTop: '1px solid #e5e7eb', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
  footerWarning: { fontSize: 7, color: '#d97706', flex: 1, textAlign: 'center' },
  noData: { fontSize: 8, color: '#9ca3af', fontStyle: 'italic', padding: '6 0' },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function fatigaStyle(puntaje: number) {
  if (puntaje < 40) return S.low;
  if (puntaje < 70) return S.mid;
  return S.high;
}

// ─── Documento PDF ──────────────────────────────────────────────────────────

function TherapeyeReport({ data }: { data: ReportData }) {
  const totalTests = data.visionTests.length;
  const totalEjC = data.ejerciciosCompletados;
  const totalEjT = data.ejercicios.length;

  return (
    <Document title={`Reporte Therapheye - ${data.period}`} author="Therapheye">
      <Page size="A4" style={S.page}>
        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <Text style={S.logo}>👁 Therapheye</Text>
            <Text style={S.logoSub}>Plataforma de Salud Visual</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerTitle}>Reporte de Salud Visual</Text>
            <Text style={S.headerDate}>Paciente: {data.userName}</Text>
            <Text style={S.headerDate}>Período: {data.period}</Text>
            <Text style={S.headerDate}>Generado: {data.generatedAt}</Text>
          </View>
        </View>

        {/* ── Resumen ── */}
        <View style={S.summaryRow}>
          <View style={S.summaryCard}>
            <Text style={S.summaryNum}>{data.evaluaciones.length}</Text>
            <Text style={S.summaryLabel}>Evaluaciones{'\n'}de fatiga</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={[S.summaryNum, fatigaStyle(data.avgFatiga)]}>{data.avgFatiga}%</Text>
            <Text style={S.summaryLabel}>Fatiga{'\n'}promedio</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryNum}>{totalTests}</Text>
            <Text style={S.summaryLabel}>Tests de{'\n'}visión</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryNum}>{totalEjC}/{totalEjT}</Text>
            <Text style={S.summaryLabel}>Ejercicios{'\n'}completados</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryNum}>{data.capturas.length}</Text>
            <Text style={S.summaryLabel}>Capturas{'\n'}de imagen</Text>
          </View>
        </View>

        {/* ── Evaluaciones de Fatiga ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>1. Evaluaciones de Fatiga Visual</Text>
          {data.evaluaciones.length === 0 ? (
            <Text style={S.noData}>Sin evaluaciones en este período</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { width: '22%' }]}>Fecha</Text>
                <Text style={[S.tableHeaderCell, { width: '16%' }]}>Puntaje</Text>
                <Text style={[S.tableHeaderCell, { width: '22%' }]}>Nivel</Text>
                <Text style={[S.tableHeaderCell, { flex: 1 }]}>Síntoma dominante</Text>
              </View>
              {data.evaluaciones.slice(0, 15).map((ev, i) => (
                <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowEven : {}]}>
                  <Text style={[S.tableCell, { width: '22%' }]}>{ev.fecha}</Text>
                  <Text style={[S.tableCell, { width: '16%' }, fatigaStyle(ev.puntaje)]}>{ev.puntaje}%</Text>
                  <Text style={[S.tableCell, { width: '22%' }]}>{ev.nivel}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{ev.sintoma || '—'}</Text>
                </View>
              ))}
              {data.evaluaciones.length > 15 && (
                <Text style={[S.noData, { marginTop: 4 }]}>... y {data.evaluaciones.length - 15} evaluaciones más</Text>
              )}
            </>
          )}
        </View>

        {/* ── Tests de Visión ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>2. Tests de Agudeza Visual</Text>
          {data.visionTests.length === 0 ? (
            <Text style={S.noData}>Sin tests de visión en este período</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { width: '35%' }]}>Fecha</Text>
                <Text style={[S.tableHeaderCell, { width: '25%' }]}>Mejor nivel</Text>
                <Text style={[S.tableHeaderCell, { flex: 1 }]}>Agudeza (escala Snellen)</Text>
              </View>
              {data.visionTests.map((v, i) => (
                <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowEven : {}]}>
                  <Text style={[S.tableCell, { width: '35%' }]}>{v.fecha}</Text>
                  <Text style={[S.tableCell, { width: '25%' }]}>Nivel {v.nivel}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{v.agudeza}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Ejercicios ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>3. Ejercicios Oculares</Text>
          {data.ejercicios.length === 0 ? (
            <Text style={S.noData}>Sin ejercicios en este período</Text>
          ) : (
            <>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { width: '28%' }]}>Fecha</Text>
                <Text style={[S.tableHeaderCell, { width: '34%' }]}>Ejercicio</Text>
                <Text style={[S.tableHeaderCell, { width: '18%' }]}>Duración</Text>
                <Text style={[S.tableHeaderCell, { flex: 1 }]}>Estado</Text>
              </View>
              {data.ejercicios.slice(0, 15).map((e, i) => (
                <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowEven : {}]}>
                  <Text style={[S.tableCell, { width: '28%' }]}>{e.fecha}</Text>
                  <Text style={[S.tableCell, { width: '34%' }]}>{e.nombre}</Text>
                  <Text style={[S.tableCell, { width: '18%' }]}>{e.duracion}</Text>
                  <Text style={[S.tableCell, { flex: 1 }, e.estado === 'Completado' ? S.low : S.mid]}>{e.estado}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Capturas / Diagnósticos ── */}
        {data.capturas.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>4. Capturas de Imagen / Diagnósticos</Text>
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderCell, { width: '35%' }]}>Fecha</Text>
              <Text style={[S.tableHeaderCell, { flex: 1 }]}>Diagnóstico</Text>
            </View>
            {data.capturas.map((c, i) => (
              <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowEven : {}]}>
                <Text style={[S.tableCell, { width: '35%' }]}>{c.fecha}</Text>
                <Text style={[S.tableCell, { flex: 1 }]}>{c.diagnostico}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Therapheye © {new Date().getFullYear()}</Text>
          <Text style={S.footerWarning}>⚠ Este reporte es informativo y no reemplaza el diagnóstico de un profesional de la salud visual.</Text>
          <Text style={S.footerText}>therapheye.netlify.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Botón de Descarga ───────────────────────────────────────────────────────

interface DownloadBtnProps {
  userId: string | undefined;
  userName: string;
  lang: 'es' | 'en';
}

const SINTOMA_ES: Record<string, string> = {
  ojo_sano: 'Ojo sano', enro_leve: 'Enrojecimiento leve', piel_enro: 'Piel enrojecida',
  enro_moderado: 'Enrojecimiento moderado', parpado_caido: 'Párpado caído', enro_grave: 'Enrojecimiento grave',
};

const EXERCISE_ES: Record<string, string> = {
  palming: 'Palming', focus: 'Enfoque cercano-lejano', rule202020: 'Regla 20-20-20',
  circles: 'Círculos oculares', nearFar: 'Simulación cerca/lejos',
  '20-20-20': 'Regla 20-20-20', 'near-far': 'Simulación cerca/lejos',
};

function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PDFDownloadButton({ userId, userName, lang }: DownloadBtnProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);

      const [evals, exs, visions, caps] = await Promise.all([
        sql`SELECT created_at, puntaje_fatiga, sintoma_dominante FROM respuestas_cuestionario
            WHERE user_id = ${userId} AND created_at >= ${from.toISOString()} ORDER BY created_at DESC`,
        sql`SELECT created_at, tipo_ejercicio, duracion, status FROM historial_ejercicios
            WHERE user_id = ${userId} AND created_at >= ${from.toISOString()} ORDER BY created_at DESC LIMIT 100`,
        sql`SELECT created_at, mejor_nivel, agudeza FROM historial_vision_test
            WHERE user_id = ${userId} AND created_at >= ${from.toISOString()} ORDER BY created_at DESC`,
        sql`SELECT created_at, sintoma FROM image_capture_history
            WHERE user_id = ${userId} AND created_at >= ${from.toISOString()} ORDER BY created_at DESC`,
      ]);

      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      const fatigaList = (evals as any[]).map(e => {
        const p = Number(e.puntaje_fatiga);
        return {
          fecha: fmtDate(new Date(e.created_at)),
          puntaje: p,
          nivel: p < 40 ? 'Bajo' : p < 70 ? 'Moderado' : 'Alto',
          sintoma: SINTOMA_ES[e.sintoma_dominante] ?? e.sintoma_dominante ?? '—',
        };
      });

      const avgFatiga = fatigaList.length
        ? Math.round(fatigaList.reduce((s, e) => s + e.puntaje, 0) / fatigaList.length)
        : 0;

      const data: ReportData = {
        userName,
        period: periodLabel,
        generatedAt: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        evaluaciones: fatigaList,
        avgFatiga,
        visionTests: (visions as any[]).map(v => ({
          fecha: fmtDate(new Date(v.created_at)),
          nivel: Number(v.mejor_nivel),
          agudeza: v.agudeza ?? 'N/A',
        })),
        ejercicios: (exs as any[]).map(e => ({
          fecha: fmtDate(new Date(e.created_at)),
          nombre: EXERCISE_ES[e.tipo_ejercicio] ?? e.tipo_ejercicio,
          duracion: fmtDur(Number(e.duracion)),
          estado: e.status === 'completed' ? 'Completado' : 'Incompleto',
        })),
        ejerciciosCompletados: (exs as any[]).filter(e => e.status === 'completed').length,
        capturas: (caps as any[]).map(c => ({
          fecha: fmtDate(new Date(c.created_at)),
          diagnostico: SINTOMA_ES[c.sintoma] ?? c.sintoma ?? 'Desconocido',
        })),
      };

      const blob = await pdf(<TherapeyeReport data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Therapheye_Reporte_${periodLabel.replace(' ', '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generando PDF:', e);
      alert('Error al generar el reporte. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition shadow-md"
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <FileText className="w-4 h-4" />}
      {loading
        ? (lang === 'es' ? 'Generando...' : 'Generating...')
        : (lang === 'es' ? 'Reporte PDF' : 'PDF Report')}
    </button>
  );
}
