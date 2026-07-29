import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/db';
import { authenticateJWT } from '../middleware/auth';
import { istToday } from '../lib/ist';

const router = Router();
router.use(authenticateJWT);

/** GET /api/attendance?date=YYYY-MM-DD */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const date = (req.query.date as string) || istToday();
  const [people, shifts, attendance, roster] = await Promise.all([
    query('SELECT id, email, full_name, role FROM users WHERE is_active = 1 ORDER BY full_name'),
    query('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time'),
    query('SELECT * FROM attendance_records WHERE entry_date = ?', [date]),
    query('SELECT * FROM roster_entries WHERE entry_date = ?', [date]),
  ]);
  res.json({ people, shifts, attendance, roster });
});

/** POST /api/attendance/upsert */
router.post('/upsert', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { entry_date, user_id, shift_id, status, check_in, check_out, worked_minutes, remarks } = req.body;
  const existing = await queryOne<{ id: string }>('SELECT id FROM attendance_records WHERE entry_date = ? AND user_id = ?', [entry_date, user_id]);
  if (existing) {
    await query(
      'UPDATE attendance_records SET shift_id=COALESCE(?,shift_id), status=COALESCE(?,status), check_in=COALESCE(?,check_in), check_out=COALESCE(?,check_out), worked_minutes=COALESCE(?,worked_minutes), remarks=COALESCE(?,remarks), marked_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [shift_id ?? null, status ?? null, check_in ?? null, check_out ?? null, worked_minutes ?? null, remarks ?? null, user.id, existing.id],
    );
  } else {
    await query(
      'INSERT INTO attendance_records (id, entry_date, user_id, shift_id, status, check_in, check_out, worked_minutes, remarks, marked_by) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [entry_date, user_id, shift_id ?? null, status ?? 'present', check_in ?? null, check_out ?? null, worked_minutes ?? 0, remarks ?? null, user.id],
    );
  }
  res.json({ ok: true });
});

/** POST /api/attendance/roster */
router.post('/roster', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { entry_date, user_id, shift_id, notes } = req.body;
  const existing = await queryOne<{ id: string }>('SELECT id FROM roster_entries WHERE entry_date = ? AND user_id = ?', [entry_date, user_id]);
  if (!shift_id) {
    if (existing) await query('DELETE FROM roster_entries WHERE id = ?', [existing.id]);
    res.json({ ok: true }); return;
  }
  if (existing) {
    await query('UPDATE roster_entries SET shift_id=?, notes=? WHERE id=?', [shift_id, notes ?? null, existing.id]);
  } else {
    await query('INSERT INTO roster_entries (id, entry_date, user_id, shift_id, notes, created_by) VALUES (UUID(), ?, ?, ?, ?, ?)', [entry_date, user_id, shift_id, notes ?? null, user.id]);
  }
  res.json({ ok: true });
});

/** Shifts CRUD */
router.get('/shifts', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time');
  res.json(rows);
});

router.post('/shifts', async (req: Request, res: Response): Promise<void> => {
  const { name, start_time, end_time } = req.body;
  const id = crypto.randomUUID();
  await query('INSERT INTO shifts (id, name, start_time, end_time) VALUES (?, ?, ?, ?)', [id, name, start_time, end_time]);
  res.status(201).json({ id });
});

router.delete('/shifts/:id', async (req: Request, res: Response): Promise<void> => {
  await query('UPDATE shifts SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
