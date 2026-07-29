"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/** POST /api/auth/register — create first super_admin (only works when no users exist) */
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('fullName').trim().isLength({ min: 2, max: 80 }),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password, fullName } = req.body;
    // Check if any user already exists
    const existing = await (0, db_1.queryOne)('SELECT id FROM users LIMIT 1');
    const role = existing ? 'crm_staff' : 'super_admin';
    // Prevent duplicate email
    const dup = await (0, db_1.queryOne)('SELECT id FROM users WHERE email = ?', [email]);
    if (dup) {
        res.status(409).json({ error: 'Email already registered' });
        return;
    }
    const hash = await bcryptjs_1.default.hash(password, 12);
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [id, email, hash, fullName, role]);
    // Initialize settings row if first user
    if (!existing) {
        await (0, db_1.query)('INSERT IGNORE INTO settings (id, company_name) VALUES (1, "BSC Retail")');
    }
    const token = (0, auth_1.signToken)({ id, email, role });
    res.status(201).json({ token, user: { id, email, fullName, role } });
});
/** POST /api/auth/login */
router.post('/login', [(0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').notEmpty()], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password } = req.body;
    const user = await (0, db_1.queryOne)('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    if (!user.is_active) {
        res.status(403).json({ error: 'Account is disabled' });
        return;
    }
    const ok = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!ok) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const token = (0, auth_1.signToken)({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
});
/** GET /api/auth/me — return current user */
router.get('/me', auth_1.authenticateJWT, async (req, res) => {
    const user = await (0, db_1.queryOne)('SELECT id, email, full_name, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role });
});
/** GET /api/auth/setup-status — check if setup is complete (public) */
router.get('/setup-status', async (_req, res) => {
    const row = await (0, db_1.queryOne)('SELECT setup_complete FROM settings WHERE id = 1');
    res.json({ setupComplete: row ? Boolean(row.setup_complete) : false });
});
/** POST /api/auth/verify-pin — verify access PINs (tv/cash/greeter) */
router.post('/verify-pin', async (req, res) => {
    const { kind, pin } = req.body;
    const col = kind === 'tv' ? 'tv_pin' : kind === 'cash' ? 'cash_pin' : 'greeter_pin';
    const row = await (0, db_1.queryOne)(`SELECT ${col} FROM settings WHERE id = 1`);
    const valid = row && row[col] === String(pin);
    res.json({ valid: Boolean(valid) });
});
exports.default = router;
