import { sql } from './neonCliente';

async function testConnection() {
  try {
    console.log('🔍 Probando conexión a Neon...');
    
    // Consulta simple para probar
    const result = await sql`SELECT NOW() as current_time`;
    
    console.log('✅ Conexión exitosa!');
    console.log('Hora del servidor:', result[0].current_time);
    
    // Probar que las tablas existen
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('📊 Tablas encontradas:', tables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
}

testConnection();