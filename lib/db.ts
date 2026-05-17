/**
 * lib/db.ts
 * SQL Server connection pool — singleton pattern.
 * Supports both Windows Auth (msnodesqlv8) and SQL Auth (default tedious driver).
 *
 * Set in .env.local:
 *   DB_TRUSTED_CONNECTION=true  → Windows Auth (cần msnodesqlv8)
 *   DB_TRUSTED_CONNECTION=false → SQL Auth (DB_USER + DB_PASSWORD)
 */

import sql from 'mssql';

const server   = process.env.DB_SERVER   || 'localhost\\SQLEXPRESS';
const database  = process.env.DB_NAME     || 'RestaurantManagement';
const port      = parseInt(process.env.DB_PORT || '1433', 10);

/**
 * Build config theo authentication mode.
 * Với Windows Auth trên SQLEXPRESS, dùng driver msnodesqlv8.
 * Với SQL Auth, dùng driver mặc định (tedious — không cần cài thêm).
 */
function buildConfig(): sql.config {
  // SQL Server Authentication (tedious — không cần cài thêm)
  return {
    server: server.includes('\\') ? server.split('\\')[0] : server,
    database,
    port,
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
      },
    },
    options: {
      instanceName: server.includes('\\') ? server.split('\\')[1] : undefined,
      trustServerCertificate: true,
      enableArithAbort: true,
      encrypt: false,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };
}

const config = buildConfig();

/* ── Singleton pool ───────────────────────────────────────── */
declare global {
  // eslint-disable-next-line no-var
  var _mssqlPool: sql.ConnectionPool | undefined;
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (global._mssqlPool && global._mssqlPool.connected) {
    return global._mssqlPool;
  }

  const pool = new sql.ConnectionPool(config);

  pool.on('error', (err: Error) => {
    console.error('[DB Pool Error]', err.message);
    global._mssqlPool = undefined;
  });

  await pool.connect();
  global._mssqlPool = pool;
  console.log(`[DB] ✓ Connected to ${server}/${database} (SQL Auth)`);
  return pool;
}

export { getPool, sql };
