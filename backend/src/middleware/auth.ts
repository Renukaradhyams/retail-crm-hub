import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../config/db';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'bsc_retail_crm_secret';

/** Verify Bearer JWT token — attaches req.user */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Check that req.user.role is one of the allowed roles (super_admin always passes) */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Unauthenticated' }); return; }
    if (req.user.role === 'super_admin' || req.user.role === 'admin') { next(); return; }
    if (roles.includes(req.user.role)) { next(); return; }
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/** TV PIN header gate — x-tv-pin: <pin> */
export async function authenticateTV(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pin = req.headers['x-tv-pin'] as string | undefined;
  if (!pin) { res.status(401).json({ error: 'TV PIN required' }); return; }
  const row = await queryOne<{ tv_pin: string }>('SELECT tv_pin FROM settings WHERE id = 1');
  if (!row || row.tv_pin !== pin) { res.status(401).json({ error: 'Invalid TV PIN' }); return; }
  next();
}

/** Cash PIN header gate — x-cash-pin: <pin> */
export async function authenticateCash(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pin = req.headers['x-cash-pin'] as string | undefined;
  if (!pin) { res.status(401).json({ error: 'Cash PIN required' }); return; }
  const row = await queryOne<{ cash_pin: string }>('SELECT cash_pin FROM settings WHERE id = 1');
  if (!row || row.cash_pin !== pin) { res.status(401).json({ error: 'Invalid Cash PIN' }); return; }
  next();
}

/** Greeter PIN gate — x-greeter-pin: <pin> */
export async function authenticateGreeter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pin = req.headers['x-greeter-pin'] as string | undefined;
  if (!pin) { res.status(401).json({ error: 'Greeter PIN required' }); return; }
  const row = await queryOne<{ greeter_pin: string }>('SELECT greeter_pin FROM settings WHERE id = 1');
  if (!row || row.greeter_pin !== pin) { res.status(401).json({ error: 'Invalid Greeter PIN' }); return; }
  next();
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
