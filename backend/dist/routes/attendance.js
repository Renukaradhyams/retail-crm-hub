"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const ist_1 = require("../lib/ist");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
/** GET /api/attendance?date=YYYY-MM-DD */
router.get('/', async (req, res) => {
    const date = req.query.date || (0, ist_1.istToday)();
    const [people, shifts, attendance, roster] = await Promise.all([
        (0, db_1.query)('SELECT id, email, full_name, role FROM users WHERE is_active = 1 ORDER BY full_name'),
        (0, db_1.query)('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time'),
        (0, db_1.query)('SELECT * FROM attendance_records WHERE entry_date = ?', [date]),
        (0, db_1.query)('SELECT * FROM roster_entries WHERE entry_date = ?', [date]),
    ]);
    res.json({ people, shifts, attendance, roster });
});
/** POST /api/attendance/upsert */
router.post('/upsert', async (req, res) => {
    const user = req.user;
    const { entry_date, user_id, shift_id, status, check_in, check_out, worked_minutes, remarks } = req.body;
    const existing = await (0, db_1.queryOne)('SELECT id FROM attendance_records WHERE entry_date = ? AND user_id = ?', [entry_date, user_id]);
    if (existing) {
        await (0, db_1.query)('UPDATE attendance_records SET shift_id=COALESCE(?,shift_id), status=COALESCE(?,status), check_in=COALESCE(?,check_in), check_out=COALESCE(?,check_out), worked_minutes=COALESCE(?,worked_minutes), remarks=COALESCE(?,remarks), marked_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [shift_id ?? null, status ?? null, check_in ?? null, check_out ?? null, worked_minutes ?? null, remarks ?? null, user.id, existing.id]);
    }
    else {
        await (0, db_1.query)('INSERT INTO attendance_records (id, entry_date, user_id, shift_id, status, check_in, check_out, worked_minutes, remarks, marked_by) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)', [entry_date, user_id, shift_id ?? null, status ?? 'present', check_in ?? null, check_out ?? null, worked_minutes ?? 0, remarks ?? null, user.id]);
    }
    res.json({ ok: true });
});
/** POST /api/attendance/roster */
router.post('/roster', async (req, res) => {
    const user = req.user;
    const { entry_date, user_id, shift_id, notes } = req.body;
    const existing = await (0, db_1.queryOne)('SELECT id FROM roster_entries WHERE entry_date = ? AND user_id = ?', [entry_date, user_id]);
    if (!shift_id) {
        if (existing)
            await (0, db_1.query)('DELETE FROM roster_entries WHERE id = ?', [existing.id]);
        res.json({ ok: true });
        return;
    }
    if (existing) {
        await (0, db_1.query)('UPDATE roster_entries SET shift_id=?, notes=? WHERE id=?', [shift_id, notes ?? null, existing.id]);
    }
    else {
        await (0, db_1.query)('INSERT INTO roster_entries (id, entry_date, user_id, shift_id, notes, created_by) VALUES (UUID(), ?, ?, ?, ?, ?)', [entry_date, user_id, shift_id, notes ?? null, user.id]);
    }
    res.json({ ok: true });
});
/** Shifts CRUD */
router.get('/shifts', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time');
    res.json(rows);
});
router.post('/shifts', async (req, res) => {
    const { name, start_time, end_time } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO shifts (id, name, start_time, end_time) VALUES (?, ?, ?, ?)', [id, name, start_time, end_time]);
    res.status(201).json({ id });
});
router.delete('/shifts/:id', async (req, res) => {
    await (0, db_1.query)('UPDATE shifts SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});
exports.default = router;
