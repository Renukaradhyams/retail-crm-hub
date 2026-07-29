"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.transaction = transaction;
exports.queryOne = queryOne;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = promise_1.default.createPool({
    host: 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'u510366842_retail_crmbsc',
    password: process.env.DB_PASSWORD || 'Btpldvg@2026',
    database: process.env.DB_NAME || 'u510366842_retail_crm',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
});
/** Run a single parameterized query */
async function query(sql, params) {
    const [rows] = await exports.pool.execute(sql, params);
    return rows;
}
/** Run multiple queries atomically */
async function transaction(callback) {
    const conn = await exports.pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;
    }
    catch (err) {
        await conn.rollback();
        throw err;
    }
    finally {
        conn.release();
    }
}
/** Run a single parameterized query returning first row or null */
async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows[0] ?? null;
}
