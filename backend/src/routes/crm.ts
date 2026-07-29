import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, transaction } from '../config/db';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { istToday } from '../lib/ist';

const router = Router();
router.use(authenticateJWT);

// ─── SETTINGS ───────────────────────────────────────────────────────────────
router.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  const row = await queryOne('SELECT * FROM settings WHERE id = 1');
  res.json(row ?? {});
});

router.put('/settings', requireRole('super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { company_name, logo_url, open_hour, close_hour, footfall_grace_minutes, edit_cutoff_hours, der_email, der_whatsapp_note, tv_pin, cash_pin, greeter_pin } = req.body;
  await query(
    `INSERT INTO settings (id, company_name, logo_url, open_hour, close_hour, footfall_grace_minutes, edit_cutoff_hours, der_email, der_whatsapp_note, tv_pin, cash_pin, greeter_pin, setup_complete)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), logo_url=VALUES(logo_url), open_hour=VALUES(open_hour), close_hour=VALUES(close_hour), footfall_grace_minutes=VALUES(footfall_grace_minutes), edit_cutoff_hours=VALUES(edit_cutoff_hours), der_email=VALUES(der_email), der_whatsapp_note=VALUES(der_whatsapp_note), tv_pin=VALUES(tv_pin), cash_pin=VALUES(cash_pin), greeter_pin=VALUES(greeter_pin)`,
    [company_name, logo_url ?? null, open_hour ?? 10, close_hour ?? 22, footfall_grace_minutes ?? 30, edit_cutoff_hours ?? 3, der_email ?? null, der_whatsapp_note ?? null, tv_pin ?? '9911', cash_pin ?? '1938', greeter_pin ?? '4567'],
  );
  res.json({ ok: true });
});

/** Mark setup complete */
router.post('/settings/complete', requireRole('super_admin', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  await query('UPDATE settings SET setup_complete = 1 WHERE id = 1');
  res.json({ ok: true });
});

// ─── SECTIONS ───────────────────────────────────────────────────────────────
router.get('/sections', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM sections WHERE is_active = 1 ORDER BY name');
  res.json(rows);
});

router.post('/sections', requireRole('super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { name, section_type, manager } = req.body as { name: string; section_type: string; manager?: string };
  const id = crypto.randomUUID();
  await query('INSERT INTO sections (id, name, section_type, manager) VALUES (?, ?, ?, ?)', [id, name, section_type ?? 'floor', manager ?? null]);
  res.status(201).json({ id });
});

router.delete('/sections/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  await query('UPDATE sections SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── FOOTFALL ───────────────────────────────────────────────────────────────
router.get('/footfall', async (req: Request, res: Response): Promise<void> => {
  const date = (req.query.date as string) || istToday();
  const rows = await query('SELECT * FROM footfall_entries WHERE entry_date = ? ORDER BY slot_hour', [date]);
  res.json(rows);
});

router.post('/footfall/upsert', async (req: Request, res: Response): Promise<void> => {
  const { entry_date, slot_hour, visitors, remarks } = req.body;
  const user = req.user!;
  await query(
    `INSERT INTO footfall_entries (id, entry_date, slot_hour, visitors, remarks, submitted_by, submitted_by_name)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE visitors=VALUES(visitors), remarks=VALUES(remarks), submitted_by=VALUES(submitted_by), submitted_by_name=VALUES(submitted_by_name), updated_at=CURRENT_TIMESTAMP`,
    [entry_date, slot_hour, visitors, remarks ?? null, user.id, user.email],
  );
  res.json({ ok: true });
});

router.post('/footfall/import', requireRole('crm_manager', 'super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { rows } = req.body as { rows: Array<{ entry_date: string; slot_hour: number; visitors: number }> };
  for (const r of rows) {
    await query(
      `INSERT INTO footfall_entries (id, entry_date, slot_hour, visitors)
       VALUES (UUID(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE visitors=VALUES(visitors)`,
      [r.entry_date, r.slot_hour, r.visitors],
    );
  }
  res.json({ imported: rows.length });
});

// ─── DAILY SUMMARIES ─────────────────────────────────────────────────────────
router.get('/daily-summaries', async (req: Request, res: Response): Promise<void> => {
  const { from, to, date } = req.query as Record<string, string>;
  if (date) {
    const row = await queryOne('SELECT * FROM daily_summaries WHERE entry_date = ?', [date]);
    res.json(row ?? null); return;
  }
  const rows = await query('SELECT * FROM daily_summaries WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date', [from, to]);
  res.json(rows);
});

router.post('/daily-summaries/upsert', async (req: Request, res: Response): Promise<void> => {
  const { entry_date, bills_count } = req.body;
  await query(
    `INSERT INTO daily_summaries (id, entry_date, bills_count) VALUES (UUID(), ?, ?)
     ON DUPLICATE KEY UPDATE bills_count=VALUES(bills_count)`,
    [entry_date, bills_count],
  );
  res.json({ ok: true });
});

// ─── FEEDBACK QUESTIONS ──────────────────────────────────────────────────────
router.get('/feedback-questions', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM feedback_questions WHERE is_active = 1 ORDER BY position');
  res.json(rows);
});

router.post('/feedback-questions', requireRole('super_admin', 'admin', 'crm_manager'), async (req: Request, res: Response): Promise<void> => {
  const { question, options, position } = req.body;
  const id = crypto.randomUUID();
  await query('INSERT INTO feedback_questions (id, question, options, position) VALUES (?, ?, ?, ?)', [id, question, JSON.stringify(options), position ?? 0]);
  res.status(201).json({ id });
});

router.delete('/feedback-questions/:id', requireRole('super_admin', 'admin', 'crm_manager'), async (req: Request, res: Response): Promise<void> => {
  await query('UPDATE feedback_questions SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── FEEDBACK ────────────────────────────────────────────────────────────────
router.get('/feedback', async (req: Request, res: Response): Promise<void> => {
  const { date, from, to } = req.query as Record<string, string>;
  let sql = 'SELECT * FROM feedback WHERE 1=1';
  const params: unknown[] = [];
  if (date) { sql += ' AND entry_date = ?'; params.push(date); }
  if (from && to) { sql += ' AND entry_date BETWEEN ? AND ?'; params.push(from, to); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = await query(sql, params);
  res.json(rows);
});

router.post('/feedback', async (req: Request, res: Response): Promise<void> => {
  const { entry_date, customer_name, mobile, dob, section_id, section_name, answers, voice, source, is_negative } = req.body;
  const id = crypto.randomUUID();
  await query(
    'INSERT INTO feedback (id, entry_date, customer_name, mobile, dob, section_id, section_name, answers, voice, source, is_negative) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, entry_date, customer_name, mobile ?? null, dob ?? null, section_id ?? null, section_name ?? null, JSON.stringify(answers ?? []), voice ?? null, source ?? 'qr', is_negative ? 1 : 0],
  );
  // Auto-create call queue entry for negative feedback
  if (is_negative) {
    await query(
      'INSERT INTO call_queue (id, feedback_id, entry_date, customer_name, mobile, section_name, call_type) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
      [id, entry_date, customer_name, mobile ?? null, section_name ?? null, 'negative_feedback'],
    );
  }
  res.status(201).json({ id });
});

// ─── CALL QUEUE ──────────────────────────────────────────────────────────────
router.get('/call-queue', async (req: Request, res: Response): Promise<void> => {
  const { date, status, section } = req.query as Record<string, string>;
  let sql = 'SELECT * FROM call_queue WHERE 1=1';
  const params: unknown[] = [];
  if (date) { sql += ' AND entry_date = ?'; params.push(date); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (section) { sql += ' AND section_name LIKE ?'; params.push(`%${section}%`); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = await query(sql, params);
  res.json(rows);
});

router.patch('/call-queue/:id', async (req: Request, res: Response): Promise<void> => {
  const { status, notes, attempts, escalated, follow_up_date } = req.body;
  await query(
    'UPDATE call_queue SET status=COALESCE(?,status), notes=COALESCE(?,notes), attempts=COALESCE(?,attempts), escalated=COALESCE(?,escalated), follow_up_date=COALESCE(?,follow_up_date), updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status ?? null, notes ?? null, attempts ?? null, escalated ?? null, follow_up_date ?? null, req.params.id],
  );
  res.json({ ok: true });
});

// ─── DIVERT REASONS ──────────────────────────────────────────────────────────
router.get('/divert-reasons', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM divert_reasons WHERE is_active = 1');
  res.json(rows);
});

// ─── DIVERTS ─────────────────────────────────────────────────────────────────
router.get('/diverts', async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query as Record<string, string>;
  let sql = 'SELECT * FROM diverts WHERE 1=1';
  const params: unknown[] = [];
  if (status) {
    const statuses = status.split(',');
    sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = await query(sql, params);
  res.json(rows);
});

router.post('/diverts', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { entry_date, section_id, section_name, product_wanted, quantity, price_range, fabric_occasion, reason_code, customer_name, customer_mobile, expected_delivery } = req.body;
  const id = crypto.randomUUID();
  await query(
    'INSERT INTO diverts (id, entry_date, section_id, section_name, product_wanted, quantity, price_range, fabric_occasion, reason_code, customer_name, customer_mobile, expected_delivery, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, entry_date, section_id ?? null, section_name ?? null, product_wanted, quantity ?? 1, price_range ?? null, fabric_occasion ?? null, reason_code ?? null, customer_name, customer_mobile, expected_delivery ?? null, user.id, user.email],
  );
  // Initial update log
  await query(
    'INSERT INTO divert_updates (id, divert_id, status, note, actor_id, actor_name, actor_role) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
    [id, 'open', 'Divert raised', user.id, user.email, user.role],
  );
  res.status(201).json({ id });
});

router.patch('/diverts/:id', async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { status, pm_notes, note } = req.body;
  await query('UPDATE diverts SET status=COALESCE(?,status), pm_notes=COALESCE(?,pm_notes), updated_at=CURRENT_TIMESTAMP WHERE id=?', [status ?? null, pm_notes ?? null, req.params.id]);
  if (status || note) {
    await query('INSERT INTO divert_updates (id, divert_id, status, note, actor_id, actor_name, actor_role) VALUES (UUID(), ?, ?, ?, ?, ?, ?)', [req.params.id, status ?? null, note ?? 'Status updated', user.id, user.email, user.role]);
  }
  res.json({ ok: true });
});

router.get('/diverts/:id/updates', async (req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT * FROM divert_updates WHERE divert_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(rows);
});

// ─── USERS (admin only) ──────────────────────────────────────────────────────
router.get('/users', requireRole('super_admin', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  const rows = await query('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY full_name');
  res.json(rows);
});

router.post('/users', requireRole('super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { email, password, fullName, role } = req.body as { email: string; password: string; fullName: string; role: string };
  const dup = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (dup) { res.status(409).json({ error: 'Email already registered' }); return; }
  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  await query('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)', [id, email, hash, fullName, role]);
  res.status(201).json({ id });
});

router.patch('/users/:id', requireRole('super_admin', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { fullName, role, is_active, password } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password as string, 12);
    await query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
  }
  await query('UPDATE users SET full_name=COALESCE(?,full_name), role=COALESCE(?,role), is_active=COALESCE(?,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=?', [fullName ?? null, role ?? null, is_active ?? null, req.params.id]);
  res.json({ ok: true });
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  const today = istToday();
  const [footfall, summary, divertCount, feedback, settings] = await Promise.all([
    query('SELECT * FROM footfall_entries WHERE entry_date = ? ORDER BY slot_hour', [today]),
    queryOne<{ bills_count: number }>('SELECT bills_count FROM daily_summaries WHERE entry_date = ?', [today]),
    queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM diverts WHERE status IN (?,?)', ['open', 'sourcing']),
    query<{ customer_name: string; voice: string | null; answers: string }>('SELECT customer_name, voice, answers FROM feedback WHERE entry_date = ? ORDER BY created_at DESC', [today]),
    queryOne<{ open_hour: number; close_hour: number }>('SELECT open_hour, close_hour FROM settings WHERE id = 1'),
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
router.get('/reports', async (req: Request, res: Response): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;
  const [footfall, bills, feedback, diverts] = await Promise.all([
    query('SELECT entry_date, slot_hour, visitors FROM footfall_entries WHERE entry_date BETWEEN ? AND ?', [from, to]),
    query('SELECT entry_date, bills_count FROM daily_summaries WHERE entry_date BETWEEN ? AND ?', [from, to]),
    query('SELECT answers FROM feedback WHERE entry_date BETWEEN ? AND ?', [from, to]),
    query('SELECT status FROM diverts WHERE entry_date BETWEEN ? AND ?', [from, to]),
  ]);
  res.json({ footfall, bills, feedback, diverts });
});

export default router;
