"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const ist_1 = require("../lib/ist");
const router = (0, express_1.Router)();
// ─── PIN VERIFICATION (public, no JWT required) ──────────────────────────────
router.post('/verify-pin', async (req, res) => {
    const { kind, pin } = req.body;
    if (!kind || !pin) {
        res.status(400).json({ error: 'kind and pin required' });
        return;
    }
    const col = kind === 'tv' ? 'tv_pin' : kind === 'cash' ? 'cash_pin' : 'greeter_pin';
    const row = await (0, db_1.query)(`SELECT ${col} AS pin FROM settings WHERE id = 1`).then(r => r[0]);
    res.json({ valid: row?.pin === String(pin) });
});
router.use(auth_1.authenticateJWT);
// ─── SETTINGS ───────────────────────────────────────────────────────────────
router.get('/settings', async (_req, res) => {
    const row = await (0, db_1.queryOne)('SELECT * FROM settings WHERE id = 1');
    res.json(row ?? {});
});
router.put('/settings', (0, auth_1.requireRole)('super_admin', 'admin'), async (req, res) => {
    const { company_name, logo_url, open_hour, close_hour, footfall_grace_minutes, edit_cutoff_hours, der_email, der_whatsapp_note, tv_pin, cash_pin, greeter_pin } = req.body;
    await (0, db_1.query)(`INSERT INTO settings (id, company_name, logo_url, open_hour, close_hour, footfall_grace_minutes, edit_cutoff_hours, der_email, der_whatsapp_note, tv_pin, cash_pin, greeter_pin, setup_complete)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), logo_url=VALUES(logo_url), open_hour=VALUES(open_hour), close_hour=VALUES(close_hour), footfall_grace_minutes=VALUES(footfall_grace_minutes), edit_cutoff_hours=VALUES(edit_cutoff_hours), der_email=VALUES(der_email), der_whatsapp_note=VALUES(der_whatsapp_note), tv_pin=VALUES(tv_pin), cash_pin=VALUES(cash_pin), greeter_pin=VALUES(greeter_pin)`, [company_name, logo_url ?? null, open_hour ?? 10, close_hour ?? 22, footfall_grace_minutes ?? 30, edit_cutoff_hours ?? 3, der_email ?? null, der_whatsapp_note ?? null, tv_pin ?? '9911', cash_pin ?? '1938', greeter_pin ?? '4567']);
    res.json({ ok: true });
});
/** Mark setup complete */
router.post('/settings/complete', (0, auth_1.requireRole)('super_admin', 'admin'), async (_req, res) => {
    await (0, db_1.query)('UPDATE settings SET setup_complete = 1 WHERE id = 1');
    res.json({ ok: true });
});
// ─── SECTIONS ───────────────────────────────────────────────────────────────
router.get('/sections', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM sections WHERE is_active = 1 ORDER BY name');
    res.json(rows);
});
router.post('/sections', (0, auth_1.requireRole)('super_admin', 'admin'), async (req, res) => {
    const { name, section_type, manager } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO sections (id, name, section_type, manager) VALUES (?, ?, ?, ?)', [id, name, section_type ?? 'floor', manager ?? null]);
    res.status(201).json({ id });
});
router.delete('/sections/:id', (0, auth_1.requireRole)('super_admin', 'admin'), async (req, res) => {
    await (0, db_1.query)('UPDATE sections SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});
// ─── FOOTFALL ───────────────────────────────────────────────────────────────
router.get('/footfall', async (req, res) => {
    const date = req.query.date || (0, ist_1.istToday)();
    const rows = await (0, db_1.query)('SELECT * FROM footfall_entries WHERE entry_date = ? ORDER BY slot_hour', [date]);
    res.json(rows);
});
router.post('/footfall/upsert', async (req, res) => {
    const { entry_date, slot_hour, visitors, remarks } = req.body;
    const user = req.user;
    await (0, db_1.query)(`INSERT INTO footfall_entries (id, entry_date, slot_hour, visitors, remarks, submitted_by, submitted_by_name)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE visitors=VALUES(visitors), remarks=VALUES(remarks), submitted_by=VALUES(submitted_by), submitted_by_name=VALUES(submitted_by_name), updated_at=CURRENT_TIMESTAMP`, [entry_date, slot_hour, visitors, remarks ?? null, user.id, user.email]);
    res.json({ ok: true });
});
router.post('/footfall/import', (0, auth_1.requireRole)('crm_manager', 'super_admin', 'admin'), async (req, res) => {
    const { rows } = req.body;
    for (const r of rows) {
        await (0, db_1.query)(`INSERT INTO footfall_entries (id, entry_date, slot_hour, visitors)
       VALUES (UUID(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE visitors=VALUES(visitors)`, [r.entry_date, r.slot_hour, r.visitors]);
    }
    res.json({ imported: rows.length });
});
// ─── DAILY SUMMARIES ─────────────────────────────────────────────────────────
router.get('/daily-summaries', async (req, res) => {
    const { from, to, date } = req.query;
    if (date) {
        const row = await (0, db_1.queryOne)('SELECT * FROM daily_summaries WHERE entry_date = ?', [date]);
        res.json(row ?? null);
        return;
    }
    const rows = await (0, db_1.query)('SELECT * FROM daily_summaries WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date', [from, to]);
    res.json(rows);
});
router.post('/daily-summaries/upsert', async (req, res) => {
    const { entry_date, bills_count } = req.body;
    await (0, db_1.query)(`INSERT INTO daily_summaries (id, entry_date, bills_count) VALUES (UUID(), ?, ?)
     ON DUPLICATE KEY UPDATE bills_count=VALUES(bills_count)`, [entry_date, bills_count]);
    res.json({ ok: true });
});
// ─── FEEDBACK QUESTIONS ──────────────────────────────────────────────────────
router.get('/feedback-questions', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM feedback_questions WHERE is_active = 1 ORDER BY position');
    res.json(rows);
});
router.post('/feedback-questions', (0, auth_1.requireRole)('super_admin', 'admin', 'crm_manager'), async (req, res) => {
    const { question, options, position } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO feedback_questions (id, question, options, position) VALUES (?, ?, ?, ?)', [id, question, JSON.stringify(options), position ?? 0]);
    res.status(201).json({ id });
});
router.delete('/feedback-questions/:id', (0, auth_1.requireRole)('super_admin', 'admin', 'crm_manager'), async (req, res) => {
    await (0, db_1.query)('UPDATE feedback_questions SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});
// ─── FEEDBACK ────────────────────────────────────────────────────────────────
router.get('/feedback', async (req, res) => {
    const { date, from, to } = req.query;
    let sql = 'SELECT * FROM feedback WHERE 1=1';
    const params = [];
    if (date) {
        sql += ' AND entry_date = ?';
        params.push(date);
    }
    if (from && to) {
        sql += ' AND entry_date BETWEEN ? AND ?';
        params.push(from, to);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = await (0, db_1.query)(sql, params);
    res.json(rows);
});
router.post('/feedback', async (req, res) => {
    const { entry_date, customer_name, mobile, dob, section_id, section_name, answers, voice, source, is_negative } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO feedback (id, entry_date, customer_name, mobile, dob, section_id, section_name, answers, voice, source, is_negative) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, entry_date, customer_name, mobile ?? null, dob ?? null, section_id ?? null, section_name ?? null, JSON.stringify(answers ?? []), voice ?? null, source ?? 'qr', is_negative ? 1 : 0]);
    // Auto-create call queue entry for negative feedback
    if (is_negative) {
        await (0, db_1.query)('INSERT INTO call_queue (id, feedback_id, entry_date, customer_name, mobile, section_name, call_type) VALUES (UUID(), ?, ?, ?, ?, ?, ?)', [id, entry_date, customer_name, mobile ?? null, section_name ?? null, 'negative_feedback']);
    }
    res.status(201).json({ id });
});
// ─── CALL QUEUE ──────────────────────────────────────────────────────────────
router.get('/call-queue', async (req, res) => {
    const { date, status, section } = req.query;
    let sql = 'SELECT * FROM call_queue WHERE 1=1';
    const params = [];
    if (date) {
        sql += ' AND entry_date = ?';
        params.push(date);
    }
    if (status) {
        sql += ' AND status = ?';
        params.push(status);
    }
    if (section) {
        sql += ' AND section_name LIKE ?';
        params.push(`%${section}%`);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = await (0, db_1.query)(sql, params);
    res.json(rows);
});
router.patch('/call-queue/:id', async (req, res) => {
    const { status, notes, attempts, escalated, follow_up_date } = req.body;
    await (0, db_1.query)('UPDATE call_queue SET status=COALESCE(?,status), notes=COALESCE(?,notes), attempts=COALESCE(?,attempts), escalated=COALESCE(?,escalated), follow_up_date=COALESCE(?,follow_up_date), updated_at=CURRENT_TIMESTAMP WHERE id=?', [status ?? null, notes ?? null, attempts ?? null, escalated ?? null, follow_up_date ?? null, req.params.id]);
    res.json({ ok: true });
});
// ─── DIVERT REASONS ──────────────────────────────────────────────────────────
router.get('/divert-reasons', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM divert_reasons WHERE is_active = 1');
    res.json(rows);
});
// ─── DIVERTS ─────────────────────────────────────────────────────────────────
router.get('/diverts', async (req, res) => {
    const { status } = req.query;
    let sql = 'SELECT * FROM diverts WHERE 1=1';
    const params = [];
    if (status) {
        const statuses = status.split(',');
        sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const rows = await (0, db_1.query)(sql, params);
    res.json(rows);
});
router.post('/diverts', async (req, res) => {
    const user = req.user;
    const { entry_date, section_id, section_name, product_wanted, quantity, price_range, fabric_occasion, reason_code, customer_name, customer_mobile, expected_delivery } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO diverts (id, entry_date, section_id, section_name, product_wanted, quantity, price_range, fabric_occasion, reason_code, customer_name, customer_mobile, expected_delivery, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, entry_date, section_id ?? null, section_name ?? null, product_wanted, quantity ?? 1, price_range ?? null, fabric_occasion ?? null, reason_code ?? null, customer_name, customer_mobile, expected_delivery ?? null, user.id, user.email]);
    // Initial update log
    await (0, db_1.query)('INSERT INTO divert_updates (id, divert_id, status, note, actor_id, actor_name, actor_role) VALUES (UUID(), ?, ?, ?, ?, ?, ?)', [id, 'open', 'Divert raised', user.id, user.email, user.role]);
    res.status(201).json({ id });
});
router.patch('/diverts/:id', async (req, res) => {
    const user = req.user;
    const { status, pm_notes, note } = req.body;
    await (0, db_1.query)('UPDATE diverts SET status=COALESCE(?,status), pm_notes=COALESCE(?,pm_notes), updated_at=CURRENT_TIMESTAMP WHERE id=?', [status ?? null, pm_notes ?? null, req.params.id]);
    if (status || note) {
        await (0, db_1.query)('INSERT INTO divert_updates (id, divert_id, status, note, actor_id, actor_name, actor_role) VALUES (UUID(), ?, ?, ?, ?, ?, ?)', [req.params.id, status ?? null, note ?? 'Status updated', user.id, user.email, user.role]);
    }
    res.json({ ok: true });
});
router.get('/diverts/:id/updates', async (req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM divert_updates WHERE divert_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
});
// ─── USERS (admin only) ──────────────────────────────────────────────────────
router.get('/users', (0, auth_1.requireRole)('super_admin', 'admin'), async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY full_name');
    res.json(rows);
});
router.post('/users', (0, auth_1.requireRole)('super_admin', 'admin'), async (req, res) => {
    const { email, password, fullName, role } = req.body;
    const dup = await (0, db_1.queryOne)('SELECT id FROM users WHERE email = ?', [email]);
    if (dup) {
        res.status(409).json({ error: 'Email already registered' });
        return;
    }
    const hash = await bcryptjs_1.default.hash(password, 12);
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [id, email, hash, fullName, role]);
    res.status(201).json({ id });
});
router.patch('/users/:id', (0, auth_1.requireRole)('super_admin', 'admin'), async (req, res) => {
    const { fullName, role, is_active, password } = req.body;
    if (password) {
        const hash = await bcryptjs_1.default.hash(password, 12);
        await (0, db_1.query)('UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
    }
    await (0, db_1.query)('UPDATE users SET full_name=COALESCE(?,full_name), role=COALESCE(?,role), is_active=COALESCE(?,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=?', [fullName ?? null, role ?? null, is_active ?? null, req.params.id]);
    res.json({ ok: true });
});
// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard', async (_req, res) => {
    const today = (0, ist_1.istToday)();
    const [footfall, summary, divertCount, feedback, settings] = await Promise.all([
        (0, db_1.query)('SELECT * FROM footfall_entries WHERE entry_date = ? ORDER BY slot_hour', [today]),
        (0, db_1.queryOne)('SELECT bills_count FROM daily_summaries WHERE entry_date = ?', [today]),
        (0, db_1.queryOne)('SELECT COUNT(*) as cnt FROM diverts WHERE status IN (?,?)', ['open', 'sourcing']),
        (0, db_1.query)('SELECT customer_name, voice, answers FROM feedback WHERE entry_date = ? ORDER BY created_at DESC', [today]),
        (0, db_1.queryOne)('SELECT open_hour, close_hour FROM settings WHERE id = 1'),
    ]);
    res.json({
        footfall,
        bills: summary?.bills_count ?? 0,
        openDiverts: divertCount?.cnt ?? 0,
        feedback: feedback.map((r) => ({ ...r, answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers })),
        openHour: settings?.open_hour ?? 10,
        closeHour: settings?.close_hour ?? 22,
    });
});
// ─── REPORTS ─────────────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
    const { from, to } = req.query;
    const [footfall, bills, feedback, diverts] = await Promise.all([
        (0, db_1.query)('SELECT entry_date, slot_hour, visitors FROM footfall_entries WHERE entry_date BETWEEN ? AND ?', [from, to]),
        (0, db_1.query)('SELECT entry_date, bills_count FROM daily_summaries WHERE entry_date BETWEEN ? AND ?', [from, to]),
        (0, db_1.query)('SELECT answers FROM feedback WHERE entry_date BETWEEN ? AND ?', [from, to]),
        (0, db_1.query)('SELECT status FROM diverts WHERE entry_date BETWEEN ? AND ?', [from, to]),
    ]);
    res.json({ footfall, bills, feedback, diverts });
});
exports.default = router;
