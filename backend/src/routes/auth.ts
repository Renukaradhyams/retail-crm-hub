import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db';
import { authenticateJWT, signToken } from '../middleware/auth';

const router = Router();

/** POST /api/auth/register — create first super_admin (only works when no users exist) */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().isLength({ min: 2, max: 80 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password, fullName } = req.body as { email: string; password: string; fullName: string };

    // Check if any user already exists
    const existing = await queryOne('SELECT id FROM users LIMIT 1');
    const role = existing ? 'crm_staff' : 'super_admin';

    // Prevent duplicate email
    const dup = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (dup) { res.status(409).json({ error: 'Email already registered' }); return; }

    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    await query(
      'INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email, hash, fullName, role],
    );

    // Initialize settings row if first user
    if (!existing) {
      await query(
        'INSERT IGNORE INTO settings (id, company_name) VALUES (1, "BSC Retail")',
      );
    }

    const token = signToken({ id, email, role });
    res.status(201).json({ token, user: { id, email, fullName, role } });
  },
);

/** POST /api/auth/login */
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { email, password } = req.body as { email: string; password: string };
    const user = await queryOne<{ id: string; email: string; password_hash: string; full_name: string; role: string; is_active: number }>(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    if (!user.is_active) { res.status(403).json({ error: 'Account is disabled' }); return; }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
  },
);

/** GET /api/auth/me — return current user */
router.get('/me', authenticateJWT, async (req: Request, res: Response): Promise<void> => {
  const user = await queryOne<{ id: string; email: string; full_name: string; role: string }>(
    'SELECT id, email, full_name, role FROM users WHERE id = ?',
    [req.user!.id],
  );
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role });
});

/** GET /api/auth/setup-status — check if setup is complete (public) */
router.get('/setup-status', async (_req: Request, res: Response): Promise<void> => {
  const row = await queryOne<{ setup_complete: number }>('SELECT setup_complete FROM settings WHERE id = 1');
  res.json({ setupComplete: row ? Boolean(row.setup_complete) : false });
});

/** POST /api/auth/verify-pin — verify access PINs (tv/cash/greeter) */
router.post('/verify-pin', async (req: Request, res: Response): Promise<void> => {
  const { kind, pin } = req.body as { kind: string; pin: string };
  const col = kind === 'tv' ? 'tv_pin' : kind === 'cash' ? 'cash_pin' : 'greeter_pin';
  const row = await queryOne<Record<string, string>>(`SELECT ${col} FROM settings WHERE id = 1`);
  const valid = row && row[col] === String(pin);
  res.json({ valid: Boolean(valid) });
});

export default router;
