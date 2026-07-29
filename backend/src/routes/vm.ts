import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/db';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { istToday } from '../lib/ist';

const router = Router();
router.use(authenticateJWT);

/** GET /api/vm/points */
router.get('/points', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM vm_checklist_points WHERE is_active = 1 ORDER BY position');
  res.json(rows);
});

router.post('/points', requireRole('super_admin', 'admin', 'crm_manager'), async (req: Request, res: Response): Promise<void> => {
  const { title, description, section, position } = req.body;
  const id = crypto.randomUUID();
  await query('INSERT INTO vm_checklist_points (id, title, description, section, position) VALUES (?, ?, ?, ?, ?)', [id, title, description ?? null, section ?? null, position ?? 0]);
  res.status(201).json({ id });
});

router.delete('/points/:id', requireRole('super_admin', 'admin', 'crm_manager'), async (req: Request, res: Response): Promise<void> => {
  await query('UPDATE vm_checklist_points SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/** GET /api/vm/submissions */
router.get('/submissions', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM vm_submissions ORDER BY created_at DESC LIMIT 30');
  res.json(rows);
});

/** POST /api/vm/submit */
router.post('/submit', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { entry_date, shift, floor, score_percent, entries } = req.body as {
    entry_date: string;
    shift: string;
    floor: string;
    score_percent: number;
    entries: Array<{ point_id: string; point_title: string; score: string; remarks?: string; photo_url?: string }>;
  };

  const id = crypto.randomUUID();
  await query(
    'INSERT INTO vm_submissions (id, entry_date, shift, floor, score_percent, submitted_by, submitted_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, entry_date || istToday(), shift, floor, score_percent, user.id, user.email],
  );

  for (const e of entries) {
    await query(
      'INSERT INTO vm_submission_entries (id, submission_id, point_id, point_title, score, remarks, photo_url) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
      [id, e.point_id, e.point_title, e.score, e.remarks ?? null, e.photo_url ?? null],
    );
  }
  res.status(201).json({ id, score_percent });
});

export default router;
