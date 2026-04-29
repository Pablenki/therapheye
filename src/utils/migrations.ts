// =========================================
// MIGRACIONES CENTRALIZADAS — Therapheye
// Todas las CREATE TABLE / ALTER TABLE en un solo lugar
// Se ejecuta una sola vez al iniciar la app (idempotente)
// =========================================

import { sql } from '../neonCliente';

const MIGRATION_KEY = 'therapheye_migrations_v1';

export async function runMigrations(_userId?: string) {
  // Solo ejecutar una vez por sesión del navegador
  if (sessionStorage.getItem(MIGRATION_KEY)) return;

  try {
    await Promise.all([
      // ── Auth / Sessions ──
      sql`CREATE TABLE IF NOT EXISTS user_sessions (
        user_id TEXT PRIMARY KEY,
        session_token TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        notify_on_login BOOLEAN NOT NULL DEFAULT false,
        onboarding_completed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,

      // ── Cuestionario / Diagnóstico ──
      sql`CREATE TABLE IF NOT EXISTS diagnostico_completo (
        id                  SERIAL PRIMARY KEY,
        user_id             VARCHAR(100) NOT NULL,
        score_final         DECIMAL(5,2) NOT NULL,
        nivel               VARCHAR(20)  NOT NULL,
        valor_imagen        INTEGER NOT NULL,
        valor_cuestionario  INTEGER NOT NULL,
        valor_tiempo        INTEGER NOT NULL,
        valor_ejercicios    INTEGER NOT NULL,
        valor_pruebas       INTEGER NOT NULL,
        aporte_imagen       DECIMAL(5,2),
        aporte_cuestionario DECIMAL(5,2),
        aporte_tiempo       DECIMAL(5,2),
        aporte_ejercicios   DECIMAL(5,2),
        aporte_pruebas      DECIMAL(5,2),
        insights_json       TEXT,
        recomendaciones_json TEXT,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      )`,

      // ── Tests clínicos ──
      sql`CREATE TABLE IF NOT EXISTS contrast_tests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        nivel_final INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS campo_visual_tests (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ojo TEXT NOT NULL,
        total_destellos INT,
        detectados INT,
        tasa_deteccion FLOAT,
        tiempo_reaccion_avg FLOAT,
        resultados_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS test_cromatico (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS test_acomodacion (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ojo TEXT NOT NULL,
        ppa_cm INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS reaccion_visual_tests (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        promedio_ms INTEGER NOT NULL,
        mejor_ms INTEGER NOT NULL,
        tiempos_json TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS historial_lectura_visual (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        eye_tested TEXT NOT NULL,
        nivel_maximo INTEGER NOT NULL,
        score_promedio NUMERIC(5,1) NOT NULL,
        resultados_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // ── Ejercicios / Entrenamiento ──
      sql`CREATE TABLE IF NOT EXISTS vergencia_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ejercicio_id TEXT NOT NULL,
        duracion_seg INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS modo_zen_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        rutina_id TEXT NOT NULL,
        rutina_nombre TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS entrenamiento_mental (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        juego TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        avg_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS minijuegos_scores (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS rutinas_personalizadas (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        objetivo TEXT NOT NULL,
        rutina_json JSONB NOT NULL,
        consejos JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS fatiga_post_ejercicio (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        burning    SMALLINT NOT NULL,
        blur       SMALLINT NOT NULL,
        headache   SMALLINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // ── Monitoreo / Tiempo ──
      sql`CREATE TABLE IF NOT EXISTS sesiones_parpadeo (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ NOT NULL,
        duration_sec INTEGER NOT NULL,
        total_blinks INTEGER NOT NULL,
        avg_blinks_per_min NUMERIC(5,1) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS sesiones_salud_visual (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT        NOT NULL,
        started_at  TIMESTAMPTZ NOT NULL,
        ended_at    TIMESTAMPTZ NOT NULL,
        duration_ms BIGINT      NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        duracion_min INT NOT NULL,
        ronda INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // ── Registros varios ──
      sql`CREATE TABLE IF NOT EXISTS image_capture_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sintoma VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS diario_visual (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        texto TEXT NOT NULL,
        clasificacion TEXT,
        sintomas_detectados JSONB DEFAULT '[]',
        estado_animo_visual TEXT DEFAULT 'regular',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      sql`CREATE TABLE IF NOT EXISTS notas_medicas (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        contenido TEXT NOT NULL,
        fecha TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ]);

    // ALTER TABLEs (secuenciales ya que dependen de las tablas existentes)
    await sql`ALTER TABLE diagnostico_completo
      ALTER COLUMN user_id TYPE VARCHAR(100) USING user_id::VARCHAR`.catch(() => {});
    await sql`ALTER TABLE timer_state ADD COLUMN IF NOT EXISTS source VARCHAR(64)`.catch(() => {});
    await sql`DO $$ BEGIN
      BEGIN ALTER TABLE users ADD COLUMN foto_perfil TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE users ADD COLUMN fecha_nacimiento DATE; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$`.catch(() => {});

    sessionStorage.setItem(MIGRATION_KEY, '1');
  } catch (e) {
    console.error('[Migrations] Error:', e);
  }
}
