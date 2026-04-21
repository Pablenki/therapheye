/**
 * seed-fake-data.mjs
 * Inyecta datos artificiales para VnV en todos los módulos excepto diagnostico_completo.
 * Cuentas: luispabloherrerabarb@gmail.com y jose3627567@gmail.com
 * Ejecutar: node seed-fake-data.mjs
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_V7S0FsDyOZtI@ep-purple-lake-af84yqd7-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

// ── Helpers ────────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Devuelve un objeto Date N días antes de hoy, con hora aleatoria. */
function daysAgo(n, hourMin = 8, hourMax = 22) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(hourMin, hourMax), rand(0, 59), rand(0, 59), 0);
  return d;
}

/** Formatea como ISO con offset -06:00 (CST) */
function toCST(date) {
  const pad = (n, l = 2) => n.toString().padStart(l, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}-06:00`;
}

/** Devuelve 'YYYY-MM-DD' de un Date */
function toDateStr(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ── Constantes de dominio ──────────────────────────────────────────────────────

const EJERCICIOS = ['palming', 'focus', 'rule202020', 'circles', 'nearFar'];
const SINTOMAS_IMAGEN = ['ojo_sano', 'enro_leve', 'piel_enro', 'enro_moderado', 'parpado_caido', 'enro_grave'];
const SINTOMAS_CUESTIONARIO = ['visual', 'comfort', 'pain', 'fatigue'];
const AGUDEZAS = [
  { nivel: 1, acuity: '20/200' },
  { nivel: 2, acuity: '20/160' },
  { nivel: 3, acuity: '20/100' },
  { nivel: 4, acuity: '20/70'  },
  { nivel: 5, acuity: '20/50'  },
  { nivel: 6, acuity: '20/40'  },
  { nivel: 7, acuity: '20/30'  },
  { nivel: 8, acuity: '20/25'  },
  { nivel: 9, acuity: '20/20'  },
  { nivel: 10, acuity: '20/15' },
];

/** Genera respuestas ficticias del cuestionario (10 preguntas, valores 0-3) */
function genRespuestas() {
  const resp = {};
  for (let i = 0; i < 10; i++) resp[i] = rand(0, 3);
  return resp;
}

/** Calcula puntaje de fatiga igual que la app (0-100) */
function calcPuntaje(respuestas) {
  const total = Object.values(respuestas).reduce((a, b) => a + b, 0);
  return Math.round((total / (10 * 3)) * 100);
}

/** Genera resultados_json para vision test */
function genResultadosVision(bestLevel) {
  return Array.from({ length: bestLevel }, (_, i) => ({
    level: i + 1,
    canRead: true,
    letters: ['E', 'F', 'P', 'L', 'O'],
    userInput: ['E', 'F', 'P', 'L', 'O'],
  }));
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function main() {
  const emails = ['luispabloherrerabarb@gmail.com', 'jose3627567@gmail.com'];

  // 1. Obtener IDs de usuario
  const userRows = await sql`
    SELECT id, email FROM users WHERE email = ANY(${emails})
  `;

  if (userRows.length === 0) {
    console.error('❌ No se encontraron usuarios con esos correos. Verifica que estén registrados.');
    process.exit(1);
  }

  console.log(`✅ Usuarios encontrados: ${userRows.map(u => `${u.email} (id=${u.id})`).join(', ')}`);

  // Limpiar datos previos de seed para evitar duplicados
  for (const userRow of userRows) {
    const uid = userRow.id;
    console.log(`\n🧹 Limpiando datos previos de ${userRow.email}...`);
    await sql`DELETE FROM historial_ejercicios    WHERE user_id = ${uid}`;
    await sql`DELETE FROM respuestas_cuestionario WHERE user_id = ${uid}`;
    await sql`DELETE FROM historial_vision_test   WHERE user_id = ${uid}`;
    await sql`DELETE FROM sesiones_salud_visual   WHERE user_id = ${uid}`;
    await sql`DELETE FROM timer_state             WHERE user_id = ${uid}`;
    await sql`DELETE FROM image_capture_history   WHERE user_id = ${uid}`.catch(() => {});
    console.log(`  ✓ Tablas limpiadas`);
  }

  for (const userRow of userRows) {
    const userId = userRow.id;
    console.log(`\n━━ Inyectando datos para ${userRow.email} (id=${userId}) ━━`);

    // ── Distribución de días: 60 días hacia atrás, con más actividad reciente
    // Generamos ~35 "días de actividad" seleccionados al azar
    const todayOffset = 0;
    const allDayOffsets = Array.from({ length: 60 }, (_, i) => i + 1); // 1..60 días atrás
    // Pesos: días más recientes son más probables
    const selectedDays = [];
    while (selectedDays.length < 35) {
      const d = pick(allDayOffsets);
      if (!selectedDays.includes(d)) selectedDays.push(d);
    }
    selectedDays.sort((a, b) => b - a); // más antiguo primero

    // ── 1. historial_ejercicios  (1-3 ejercicios por día seleccionado) ──────────
    let exCount = 0;
    for (const dayOffset of selectedDays) {
      const numEx = rand(1, 3);
      for (let j = 0; j < numEx; j++) {
        const tipo = pick(EJERCICIOS);
        const duracion = rand(30, 300);
        const status = Math.random() > 0.15 ? 'completed' : 'incomplete';
        const ts = toCST(daysAgo(dayOffset));
        await sql`
          INSERT INTO historial_ejercicios (user_id, tipo_ejercicio, duracion, status, created_at)
          VALUES (${userId}, ${tipo}, ${duracion}, ${status}, ${ts})
        `;
        exCount++;
      }
    }
    console.log(`  ✓ historial_ejercicios: ${exCount} registros`);

    // ── 2. respuestas_cuestionario  (1 por cada 2-3 días seleccionados) ─────────
    let qCount = 0;
    const qDays = selectedDays.filter((_, i) => i % rand(1, 2) === 0);
    for (const dayOffset of qDays) {
      const respuestas = genRespuestas();
      const puntaje = calcPuntaje(respuestas);
      const sintoma = pick(SINTOMAS_CUESTIONARIO);
      const ts = toCST(daysAgo(dayOffset, 12, 20));
      await sql`
        INSERT INTO respuestas_cuestionario (user_id, respuestas_json, puntaje_fatiga, sintoma_dominante, created_at)
        VALUES (${userId}, ${JSON.stringify(respuestas)}, ${puntaje}, ${sintoma}, ${ts})
      `;
      qCount++;
    }
    console.log(`  ✓ respuestas_cuestionario: ${qCount} registros`);

    // ── 3. historial_vision_test  (1 cada 4-6 días) ───────────────────────────
    let vtCount = 0;
    const vtDays = selectedDays.filter((_, i) => i % rand(3, 5) === 0);
    for (const dayOffset of vtDays) {
      const agudezaObj = pick(AGUDEZAS);
      const distancia = rand(40, 65);
      const resultados = genResultadosVision(agudezaObj.nivel);
      const ts = toCST(daysAgo(dayOffset, 10, 18));
      await sql`
        INSERT INTO historial_vision_test (user_id, mejor_nivel, agudeza, distancia_cm, resultados_json, created_at)
        VALUES (${userId}, ${agudezaObj.nivel}, ${agudezaObj.acuity}, ${distancia}, ${JSON.stringify(resultados)}, ${ts})
      `;
      vtCount++;
    }
    console.log(`  ✓ historial_vision_test: ${vtCount} registros`);

    // ── 4. sesiones_salud_visual  (1-2 sesiones en días seleccionados) ──────────
    let svCount = 0;
    for (const dayOffset of selectedDays) {
      const numSessions = rand(1, 2);
      for (let j = 0; j < numSessions; j++) {
        const startDate = daysAgo(dayOffset, 9, 17);
        const durationMs = rand(15, 120) * 60 * 1000; // 15-120 min en ms
        const endDate = new Date(startDate.getTime() + durationMs);
        const startTs = toCST(startDate);
        const endTs = toCST(endDate);
        await sql`
          INSERT INTO sesiones_salud_visual (user_id, started_at, ended_at, duration_ms, created_at)
          VALUES (${userId}, ${startTs}, ${endTs}, ${durationMs}, NOW())
        `;
        svCount++;
      }
    }
    console.log(`  ✓ sesiones_salud_visual: ${svCount} registros`);

    // ── 5. timer_state  (1 por día — ON CONFLICT UPDATE) ─────────────────────
    // last_start_ts y session_start_ts son BIGINT (epoch ms)
    let tsCount = 0;
    for (const dayOffset of selectedDays) {
      const d = daysAgo(dayOffset);
      const fecha = toDateStr(d);
      const accumulatedMs = rand(30, 480) * 60 * 1000; // 30-480 min
      const startEpochMs = d.getTime() - accumulatedMs;
      await sql`
        INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, updated_at)
        VALUES (${userId}, ${fecha}, ${accumulatedMs}, false, ${startEpochMs}, ${startEpochMs}, ${20 * 60 * 1000}, true, NOW())
        ON CONFLICT (user_id, fecha)
        DO UPDATE SET
          accumulated_ms   = EXCLUDED.accumulated_ms,
          is_running       = false,
          last_start_ts    = EXCLUDED.last_start_ts,
          session_start_ts = EXCLUDED.session_start_ts,
          next_break_at_ms = EXCLUDED.next_break_at_ms,
          finalized        = true,
          updated_at       = NOW()
      `;
      tsCount++;
    }
    console.log(`  ✓ timer_state: ${tsCount} registros`);

    // ── 6. image_capture_history  (1-2 capturas por semana aprox.) ───────────
    // Crear tabla si no existe
    await sql`
      CREATE TABLE IF NOT EXISTS image_capture_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        sintoma VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    let icCount = 0;
    const icDays = selectedDays.filter((_, i) => i % rand(2, 4) === 0);
    for (const dayOffset of icDays) {
      const sintoma = pick(SINTOMAS_IMAGEN);
      const ts = toCST(daysAgo(dayOffset, 11, 19));
      await sql`
        INSERT INTO image_capture_history (user_id, sintoma, created_at)
        VALUES (${userId}, ${sintoma}, ${ts})
      `.catch(async () => {
        // Si created_at no existe como columna, insertar sin ella
        await sql`
          INSERT INTO image_capture_history (user_id, sintoma)
          VALUES (${userId}, ${sintoma})
        `;
      });
      icCount++;
    }
    console.log(`  ✓ image_capture_history: ${icCount} registros`);
  }

  console.log('\n🎉 Seed completado exitosamente.');
}

main().catch((err) => {
  console.error('❌ Error durante el seed:', err);
  process.exit(1);
});
