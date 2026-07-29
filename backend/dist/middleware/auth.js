"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.requireRole = requireRole;
exports.authenticateTV = authenticateTV;
exports.authenticateCash = authenticateCash;
exports.authenticateGreeter = authenticateGreeter;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const JWT_SECRET = process.env.JWT_SECRET || 'bsc_retail_crm_secret';
/** Verify Bearer JWT token — attaches req.user */
function authenticateJWT(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }
    const token = auth.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
/** Check that req.user.role is one of the allowed roles (super_admin always passes) */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthenticated' });
            return;
        }
        if (req.user.role === 'super_admin' || req.user.role === 'admin') {
            next();
            return;
        }
        if (roles.includes(req.user.role)) {
            next();
            return;
        }
        res.status(403).json({ error: 'Insufficient permissions' });
    };
}
/** TV PIN header gate — x-tv-pin: <pin> */
async function authenticateTV(req, res, next) {
    const pin = req.headers['x-tv-pin'];
    if (!pin) {
        res.status(401).json({ error: 'TV PIN required' });
        return;
    }
    const row = await (0, db_1.queryOne)('SELECT tv_pin FROM settings WHERE id = 1');
    if (!row || row.tv_pin !== pin) {
        res.status(401).json({ error: 'Invalid TV PIN' });
        return;
    }
    next();
}
/** Cash PIN header gate — x-cash-pin: <pin> */
async function authenticateCash(req, res, next) {
    const pin = req.headers['x-cash-pin'];
    if (!pin) {
        res.status(401).json({ error: 'Cash PIN required' });
        return;
    }
    const row = await (0, db_1.queryOne)('SELECT cash_pin FROM settings WHERE id = 1');
    if (!row || row.cash_pin !== pin) {
        res.status(401).json({ error: 'Invalid Cash PIN' });
        return;
    }
    next();
}
/** Greeter PIN gate — x-greeter-pin: <pin> */
async function authenticateGreeter(req, res, next) {
    const pin = req.headers['x-greeter-pin'];
    if (!pin) {
        res.status(401).json({ error: 'Greeter PIN required' });
        return;
    }
    const row = await (0, db_1.queryOne)('SELECT greeter_pin FROM settings WHERE id = 1');
    if (!row || row.greeter_pin !== pin) {
        res.status(401).json({ error: 'Invalid Greeter PIN' });
        return;
    }
    next();
}
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
