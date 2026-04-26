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

// ─── INFORME MÉDICO SOAP ────────────────────────────────────────────────────

interface MedicalReportData {
  userName: string;
  period: string;
  generatedAt: string;
  // S — Subjetivo
  sintomasDominantes: string[];
  frecuenciaSintomas: string;
  sintomaDesc: string;
  // O — Objetivo
  avgFatiga: number;
  ejerciciosCompletados: number;
  ejerciciosTotal: number;
  testsVision: number;
  tasaParpadeo: number | null;
  // A — Análisis (generado por IA)
  analisisClinico: string;
  // P — Plan
  recomendaciones: string;
  adherencia: string;
}

const SM = StyleSheet.create({
  page: { padding: 45, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  // Portada
  coverBg:     { backgroundColor: '#1B396B', padding: 45, minHeight: 200 },
  coverTitle:  { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginBottom: 6 },
  coverSub:    { fontSize: 11, color: '#93c5fd', marginBottom: 24 },
  coverInfo:   { fontSize: 9, color: '#bfdbfe', marginBottom: 3 },
  coverDisclaimer: { fontSize: 7.5, color: '#93c5fd', marginTop: 20, fontStyle: 'italic' },
  // SOAP
  soapSection: { marginBottom: 22 },
  soapHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  soapLetter:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1B396B', width: 22 },
  soapTitle:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1B396B' },
  soapSub:     { fontSize: 8, color: '#6b7280' },
  divider:     { borderBottom: '1.5px solid #dbeafe', marginBottom: 14 },
  bodyText:    { fontSize: 8.5, color: '#374151', lineHeight: 1.6 },
  bodyBold:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' },
  metricRow:   { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  metricLabel: { fontSize: 8, color: '#6b7280', width: 160 },
  metricVal:   { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1B396B' },
  bullet:      { fontSize: 8.5, color: '#374151', marginBottom: 3, lineHeight: 1.5 },
  footer:      { position: 'absolute', bottom: 28, left: 45, right: 45, borderTop: '1px solid #e5e7eb', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 6.5, color: '#9ca3af' },
  footerWarn:  { fontSize: 6.5, color: '#d97706', flex: 1, textAlign: 'center' },
  chip:        { backgroundColor: '#eff6ff', borderRadius: 4, padding: '3 7', marginRight: 5, marginBottom: 4 },
  chipText:    { fontSize: 7.5, color: '#1e40af', fontFamily: 'Helvetica-Bold' },
  chipsRow:    { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  aiBox:       { backgroundColor: '#f5f3ff', borderRadius: 6, padding: 10, borderLeft: '3px solid #7c3aed' },
  aiText:      { fontSize: 8.5, color: '#4c1d95', lineHeight: 1.7 },
});

function MedicalReport({ data }: { data: MedicalReportData }) {
  return (
    <Document title={`Informe Médico Therapheye — ${data.period}`} author="Therapheye">
      <Page size="A4" style={SM.page}>

        {/* ── Portada ── */}
        <View style={SM.coverBg}>
          <Text style={SM.coverTitle}>Informe de Salud Visual</Text>
          <Text style={SM.coverSub}>Para consulta con oftalmólogo · Formato SOAP</Text>
          <Text style={SM.coverInfo}>Paciente: {data.userName}</Text>
          <Text style={SM.coverInfo}>Período: {data.period}</Text>
          <Text style={SM.coverInfo}>Fecha de generación: {data.generatedAt}</Text>
          <Text style={SM.coverDisclaimer}>
            Generado por Therapheye IA — No reemplaza diagnóstico médico profesional.
            Este documento es un resumen de datos autorreportados y mediciones automatizadas para facilitar la consulta clínica.
          </Text>
        </View>

        {/* ── S: Subjetivo ── */}
        <View style={[SM.soapSection, { marginTop: 22 }]}>
          <View style={SM.soapHeader}>
            <Text style={SM.soapLetter}>S</Text>
            <View>
              <Text style={SM.soapTitle}>Subjetivo — Síntomas Reportados</Text>
              <Text style={SM.soapSub}>Datos autorreportados por el paciente en cuestionarios de fatiga visual</Text>
            </View>
          </View>
          <View style={SM.divider}/>
          <View style={SM.metricRow}>
            <Text style={SM.metricLabel}>Frecuencia de evaluación:</Text>
            <Text style={SM.metricVal}>{data.frecuenciaSintomas}</Text>
          </View>
          <View style={SM.metricRow}>
            <Text style={SM.metricLabel}>Síntoma dominante principal:</Text>
            <Text style={SM.metricVal}>{data.sintomaDesc}</Text>
          </View>
          <Text style={[SM.bodyBold, { marginTop: 8, marginBottom: 4 }]}>Síntomas reportados frecuentemente:</Text>
          <View style={SM.chipsRow}>
            {data.sintomasDominantes.map((s, i) => (
              <View key={i} style={SM.chip}><Text style={SM.chipText}>{s}</Text></View>
            ))}
          </View>
        </View>

        {/* ── O: Objetivo ── */}
        <View style={SM.soapSection}>
          <View style={SM.soapHeader}>
            <Text style={SM.soapLetter}>O</Text>
            <View>
              <Text style={SM.soapTitle}>Objetivo — Métricas Cuantitativas</Text>
              <Text style={SM.soapSub}>Datos numéricos recopilados por la plataforma Therapheye</Text>
            </View>
          </View>
          <View style={SM.divider}/>
          <View style={SM.metricRow}>
            <Text style={SM.metricLabel}>Puntaje promedio de fatiga visual:</Text>
            <Text style={[SM.metricVal, { color: data.avgFatiga < 40 ? '#16a34a' : data.avgFatiga < 70 ? '#d97706' : '#dc2626' }]}>
              {data.avgFatiga}% ({data.avgFatiga < 40 ? 'Bajo' : data.avgFatiga < 70 ? 'Moderado' : 'Alto'})
            </Text>
          </View>
          <View style={SM.metricRow}>
            <Text style={SM.metricLabel}>Ejercicios oculares completados:</Text>
            <Text style={SM.metricVal}>{data.ejerciciosCompletados} / {data.ejerciciosTotal}</Text>
          </View>
          <View style={SM.metricRow}>
            <Text style={SM.metricLabel}>Tests de agudeza visual realizados:</Text>
            <Text style={SM.metricVal}>{data.testsVision}</Text>
          </View>
          {data.tasaParpadeo !== null && (
            <View style={SM.metricRow}>
              <Text style={SM.metricLabel}>Tasa de parpadeo promedio:</Text>
              <Text style={[SM.metricVal, { color: data.tasaParpadeo < 12 ? '#d97706' : '#16a34a' }]}>
                {data.tasaParpadeo} parpadeos/min {data.tasaParpadeo < 12 ? '(por debajo del rango normal)' : '(rango normal)'}
              </Text>
            </View>
          )}
        </View>

        {/* ── A: Análisis ── */}
        <View style={SM.soapSection}>
          <View style={SM.soapHeader}>
            <Text style={SM.soapLetter}>A</Text>
            <View>
              <Text style={SM.soapTitle}>Análisis — Evaluación Clínica</Text>
              <Text style={SM.soapSub}>Generado por IA (Claude Haiku) · Requiere validación profesional</Text>
            </View>
          </View>
          <View style={SM.divider}/>
          <View style={SM.aiBox}>
            <Text style={SM.aiText}>{data.analisisClinico}</Text>
          </View>
        </View>

        {/* ── P: Plan ── */}
        <View style={SM.soapSection}>
          <View style={SM.soapHeader}>
            <Text style={SM.soapLetter}>P</Text>
            <View>
              <Text style={SM.soapTitle}>Plan — Recomendaciones y Adherencia</Text>
              <Text style={SM.soapSub}>Sugerencias generadas automáticamente según los datos</Text>
            </View>
          </View>
          <View style={SM.divider}/>
          <Text style={[SM.bodyBold, { marginBottom: 4 }]}>Adherencia al programa:</Text>
          <Text style={SM.bodyText}>{data.adherencia}</Text>
          <Text style={[SM.bodyBold, { marginTop: 10, marginBottom: 4 }]}>Recomendaciones para el especialista:</Text>
          <Text style={SM.bodyText}>{data.recomendaciones}</Text>
        </View>

        {/* Footer */}
        <View style={SM.footer} fixed>
          <Text style={SM.footerText}>Therapheye © {new Date().getFullYear()}</Text>
          <Text style={SM.footerWarn}>⚠ Generado por IA — No reemplaza diagnóstico médico profesional</Text>
          <Text style={SM.footerText}>therapheye.netlify.app</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Botón Informe Médico ────────────────────────────────────────────────────

const SINTOMA_LABELS: Record<string, string> = {
  ojo_sano: 'Sin síntomas', enro_leve: 'Enrojecimiento leve', piel_enro: 'Piel periocular enrojecida',
  enro_moderado: 'Enrojecimiento moderado', parpado_caido: 'Ptosis palpebral', enro_grave: 'Hiperemia conjuntival grave',
};

export function MedicalPDFDownloadButton({ userId, userName }: { userId: string | undefined; userName: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!userId || loading) return;
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    setLoading(true);
    try {
      const now = new Date();
      const from30 = new Date(now.getTime() - 30 * 86_400_000);

      const [evals, exs, visions, parpadeos] = await Promise.all([
        sql`SELECT created_at, puntaje_fatiga, sintoma_dominante FROM respuestas_cuestionario WHERE user_id=${userId} AND created_at >= ${from30.toISOString()} ORDER BY created_at DESC`,
        sql`SELECT status FROM historial_ejercicios WHERE user_id=${userId} AND created_at >= ${from30.toISOString()}`,
        sql`SELECT id FROM historial_vision_test WHERE user_id=${userId} AND created_at >= ${from30.toISOString()}`,
        sql`SELECT blinks_per_minute FROM sesiones_parpadeo WHERE user_id=${userId} AND created_at >= ${from30.toISOString()}`.catch(() => []),
      ]);

      const evalList = evals as any[];
      const avgFatiga = evalList.length ? Math.round(evalList.reduce((s: number, r: any) => s + Number(r.puntaje_fatiga), 0) / evalList.length) : 0;
      const exList = exs as any[];
      const completed = exList.filter((r: any) => r.status === 'completed').length;

      // Síntomas dominantes
      const sintomaCount: Record<string, number> = {};
      evalList.forEach((r: any) => { const k = r.sintoma_dominante ?? 'sin_dato'; sintomaCount[k] = (sintomaCount[k] ?? 0) + 1; });
      const sortedSintomas = Object.entries(sintomaCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const sintomasDominantes = sortedSintomas.map(([k]) => SINTOMA_LABELS[k] ?? k);
      const sintomaDesc = sortedSintomas[0] ? (SINTOMA_LABELS[sortedSintomas[0][0]] ?? sortedSintomas[0][0]) : 'No especificado';

      const blinksArr = (parpadeos as any[]).map((r: any) => Number(r.blinks_per_minute)).filter(v => v > 0);
      const tasaParpadeo = blinksArr.length ? Math.round(blinksArr.reduce((a, b) => a + b, 0) / blinksArr.length) : null;

      const totalDias30 = 30;
      const diasActivos = new Set(evalList.map((r: any) => String(r.created_at).slice(0, 10))).size;
      const adherencia = `El paciente registró actividad en ${diasActivos} de los últimos ${totalDias30} días (${Math.round(diasActivos / totalDias30 * 100)}% de adherencia). Completó ${completed} de ${exList.length} ejercicios prescritos (${exList.length > 0 ? Math.round(completed / exList.length * 100) : 0}%).`;

      // Recomendaciones adaptadas
      const recomendaciones = [
        avgFatiga >= 50 ? 'Se recomienda evaluación oftalmológica prioritaria dado el nivel elevado de fatiga visual reportado.' : 'Continuar con el programa de ejercicios preventivos dado el buen control de fatiga.',
        tasaParpadeo !== null && tasaParpadeo < 12 ? `Tasa de parpadeo de ${tasaParpadeo} ppm (por debajo del rango normal 15–20 ppm). Considerar síndrome de ojo seco.` : 'Tasa de parpadeo dentro o sin datos suficientes para evaluación de ojo seco.',
        diasActivos < 10 ? 'Adherencia baja al programa (<33%). Se sugiere reforzar motivación y simplificar rutina de ejercicios.' : 'Buena adherencia al programa de seguimiento digital.',
        'Evaluar necesidad de corrección óptica actualizada si el paciente refiere visión borrosa frecuente.',
      ].join('\n• ');

      // Análisis clínico con IA
      let analisisClinico = 'No disponible (sin clave de API configurada).';
      if (apiKey) {
        const prompt = `Eres un asistente médico de salud visual. Genera un párrafo de análisis clínico formal (máximo 120 palabras, en español, lenguaje médico) basado en estos datos de un paciente:

- Fatiga visual promedio: ${avgFatiga}% (${avgFatiga < 40 ? 'leve' : avgFatiga < 70 ? 'moderada' : 'severa'})
- Síntomas predominantes: ${sintomasDominantes.join(', ') || 'no especificados'}
- Ejercicios completados: ${completed}/${exList.length}
- Tests de visión: ${(visions as any[]).length}
- Tasa de parpadeo: ${tasaParpadeo !== null ? tasaParpadeo + ' ppm' : 'no evaluada'}
- Adherencia: ${diasActivos}/${totalDias30} días activos

Redacta como si fuera la sección A del formato SOAP. Solo el texto del análisis, sin encabezado ni markdown.`;

        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, messages: [{ role: 'user', content: prompt }] }),
          });
          if (res.ok) { const d = await res.json(); analisisClinico = d.content?.[0]?.text ?? analisisClinico; }
        } catch { /* usar fallback */ }
      }

      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const medData: MedicalReportData = {
        userName,
        period: `Últimos 30 días — ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
        generatedAt: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sintomasDominantes: sintomasDominantes.length > 0 ? sintomasDominantes : ['Sin síntomas registrados'],
        frecuenciaSintomas: `${evalList.length} evaluaciones en 30 días (${diasActivos} días distintos)`,
        sintomaDesc,
        avgFatiga,
        ejerciciosCompletados: completed,
        ejerciciosTotal: exList.length,
        testsVision: (visions as any[]).length,
        tasaParpadeo,
        analisisClinico,
        recomendaciones: '• ' + recomendaciones,
        adherencia,
      };

      const blob = await pdf(<MedicalReport data={medData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Therapheye_InformeMedico_${now.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generando informe médico:', e);
      alert('Error al generar el informe. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-xl text-sm font-semibold transition shadow-md"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      {loading ? 'Generando...' : 'Informe para Doctor'}
    </button>
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
