import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("[LiveShow DB] DATABASE_URL not found - live show features will be disabled");
    return null;
  }

  if (!pool) {
    const isProduction = process.env.NODE_ENV === "production";
    const dbHost = databaseUrl.includes('@') ? databaseUrl.split('@')[1]?.split('/')[0] : 'unknown';
    console.log(`[LiveShow DB] Connecting to database (production: ${isProduction}, host: ${dbHost})`);
    
    pool = new Pool({ 
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('neon.tech') || isProduction ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    
    pool.on('error', (err) => {
      console.error('[LiveShow DB] Pool error:', err.message);
      pool = null;
      db = null;
    });

    pool.on('connect', () => {
      console.log('[LiveShow DB] Connection established');
    });
  }

  if (!db) {
    db = drizzle(pool, { schema });
  }

  return db;
}

export { pool };
