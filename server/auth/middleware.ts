import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not set. Auth features will not work.');
}

const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseServiceKey || 'missing-key'
);

export { supabase };

// Augment express Request to carry user info after auth
declare global {
  namespace Express {
    interface Request {
      supabaseUser?: {
        id: string;
        email?: string;
      };
    }
  }
}

/**
 * Middleware that validates a Supabase JWT from the Authorization header.
 * On success, sets req.supabaseUser = { id, email }.
 */
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.supabaseUser = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

/**
 * Optional auth middleware — populates req.supabaseUser if a valid JWT
 * is present, but does NOT reject the request if the token is missing
 * or invalid. Use on routes that work for both anonymous and logged-in users.
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.supabaseUser = {
        id: user.id,
        email: user.email,
      };
    }
  } catch {
    // Silently continue — user stays anonymous
  }
  next();
};
