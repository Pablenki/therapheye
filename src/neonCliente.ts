import { neon } from '@neondatabase/serverless';

// Connection string de Neon desde variable de entorno
const sql = neon(import.meta.env.VITE_NEON_DATABASE_URL);

export { sql };