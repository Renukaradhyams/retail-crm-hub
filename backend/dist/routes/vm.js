"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const ist_1 = require("../lib/ist");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
/** GET /api/vm/points */
router.get('/points', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM vm_checklist_points WHERE is_active = 1 ORDER BY position');
    res.json(rows);
});
router.post('/points', (0, auth_1.requireRole)('super_admin', 'admin', 'crm_manager'), async (req, res) => {
    const { title, description, section, position } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO vm_checklist_points (id, title, description, section, position) VALUES (?, ?, ?, ?, ?)', [id, title, description ?? null, section ?? null, position ?? 0]);
    res.status(201).json({ id });
});
router.delete('/points/:id', (0, auth_1.requireRole)('super_admin', 'admin', 'crm_manager'), async (req, res) => {
    await (0, db_1.query)('UPDATE vm_checklist_points SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});
/** GET /api/vm/submissions */
router.get('/submissions', async (_req, res) => {
    const rows = await (0, db_1.query)('SELECT * FROM vm_submissions ORDER BY created_at DESC LIMIT 30');
    res.json(rows);
});
/** POST /api/vm/submit */
router.post('/submit', async (req, res) => {
    const user = req.user;
    const { entry_date, shift, floor, score_percent, entries } = req.body;
    const id = crypto.randomUUID();
    await (0, db_1.query)('INSERT INTO vm_submissions (id, entry_date, shift, floor, score_percent, submitted_by, submitted_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, entry_date || (0, ist_1.istToday)(), shift, floor, score_percent, user.id, user.email]);
    for (const e of entries) {
        await (0, db_1.query)('INSERT INTO vm_submission_entries (id, submission_id, point_id, point_title, score, remarks, photo_url) VALUES (UUID(), ?, ?, ?, ?, ?, ?)', [id, e.point_id, e.point_title, e.score, e.remarks ?? null, e.photo_url ?? null]);
    }
    res.status(201).json({ id, score_percent });
});
exports.default = router;
