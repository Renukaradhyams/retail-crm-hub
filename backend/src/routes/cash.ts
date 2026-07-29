import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/db';
import { authenticateJWT } from '../middleware/auth';
import { istToday } from '../lib/ist';

const router = Router();
router.use(authenticateJWT);

/** GET /api/cash?date=YYYY-MM-DD */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const date = (req.query.date as string) || istToday();
  const settlement = await queryOne<{ id: string } & Record<string, unknown>>('SELECT * FROM cash_settlements WHERE entry_date = ?', [date]);
  if (!settlement) { res.json({ settlement: null, rows: [] }); return; }
  const rows = await query('SELECT * FROM cash_counter_reports WHERE settlement_id = ?', [settlement.id]);
  res.json({ settlement, rows });
});

/** POST /api/cash/save */
router.post('/save', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, counters } = req.body as {
    entry_date: string;
    sale_amount: number;
    bills_count: number;
    cash_total: number;
    card_total: number;
    upi_total: number;
    counters: Array<{
      counter_name: string;
      cashier_name?: string;
      bills_count: number;
      sale_amount: number;
      cash_amount: number;
      card_amount: number;
      upi_amount: number;
      staff_discount: number;
      customer_discount: number;
    }>;
  };

  // Upsert the main settlement row
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO cash_settlements (id, entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, submitted_by, submitted_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), sale_amount=VALUES(sale_amount), bills_count=VALUES(bills_count), cash_total=VALUES(cash_total), card_total=VALUES(card_total), upi_total=VALUES(upi_total), submitted_by=VALUES(submitted_by), submitted_by_name=VALUES(submitted_by_name), updated_at=CURRENT_TIMESTAMP`,
    [id, entry_date, sale_amount, bills_count, cash_total, card_total, upi_total, user.id, user.email],
  );

  // Get the actual settlement id (handles both INSERT and UPDATE)
  const settlement = await queryOne<{ id: string }>('SELECT id FROM cash_settlements WHERE entry_date = ?', [entry_date]);
  if (!settlement) { res.status(500).json({ error: 'Failed to find settlement' }); return; }

  // Replace counter reports
  await query('DELETE FROM cash_counter_reports WHERE settlement_id = ?', [settlement.id]);
  for (const c of counters) {
    await query(
      'INSERT INTO cash_counter_reports (id, settlement_id, counter_name, cashier_name, bills_count, sale_amount, cash_amount, card_amount, upi_amount, staff_discount, customer_discount) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [settlement.id, c.counter_name, c.cashier_name ?? null, c.bills_count, c.sale_amount, c.cash_amount, c.card_amount, c.upi_amount, c.staff_discount, c.customer_discount],
    );
  }
  res.json({ ok: true, id: settlement.id });
});

export default router;
