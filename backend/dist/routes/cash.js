"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const ist_1 = require("../lib/ist");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
/** GET /api/cash?date=YYYY-MM-DD */
router.get('/', async (req, res) => {
    const date = req.query.date || (0, ist_1.istToday)();
    const settlement = await (0, db_1.queryOne)('SELECT * FROM cash_settlements WHERE entry_date = ?', [date]);
    if (!settlement) {
        res.json({ settlement: null, rows: [] });
        return;
    }
    const rows = await (0, db_1.query)('SELECT * FROM cash_counter_reports WHERE settlement_id = ?', [settlement.id]);
    res.json({ settlement, rows });
});
/** POST /api/cash/save */
router.post('/save', async (req, res) => {
    const user = req.user;
    const { entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, counters } = req.body;
    // Upsert the main settlement row
    const id = crypto.randomUUID();
    await (0, db_1.query)(`INSERT INTO cash_settlements (id, entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, submitted_by, submitted_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), sale_amount=VALUES(sale_amount), bills_count=VALUES(bills_count), cash_total=VALUES(cash_total), card_total=VALUES(card_total), upi_total=VALUES(upi_total), submitted_by=VALUES(submitted_by), submitted_by_name=VALUES(submitted_by_name), updated_at=CURRENT_TIMESTAMP`, [id, entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, user.id, user.email]);
    // Get the actual settlement id (handles both INSERT and UPDATE)
    const settlement = await (0, db_1.queryOne)('SELECT id FROM cash_settlements WHERE entry_date = ?', [entry_date]);
    if (!settlement) {
        res.status(500).json({ error: 'Failed to find settlement' });
        return;
    }
    // Replace counter reports
    await (0, db_1.query)('DELETE FROM cash_counter_reports WHERE settlement_id = ?', [settlement.id]);
    for (const c of counters) {
        await (0, db_1.query)('INSERT INTO cash_counter_reports (id, settlement_id, counter_name, cashier_name, bills_count, sale_amount, cash_amount, card_amount, upi_amount, staff_discount, customer_discount) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [settlement.id, c.counter_name, c.cashier_name ?? null, c.bills_count, c.sale_amount, c.cash_amount, c.card_amount, c.upi_amount, c.staff_discount, c.customer_discount]);
    }
    res.json({ ok: true, id: settlement.id });
});
exports.default = router;
