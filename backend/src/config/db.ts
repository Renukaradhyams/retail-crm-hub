import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
  host:     '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'u510366842_retail_crm',
  password: process.env.DB_PASSWORD || 'Btpldvg@2026',
  database: process.env.DB_NAME     || 'u510366842_retail_crm',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
});

/** Run a single parameterized query */
export async function query<T = unknown>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

/** Run multiple queries atomically */
export async function transaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Run a single parameterized query returning first row or null */
export async function queryOne<T = unknown>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
