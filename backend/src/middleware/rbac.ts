import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// User roles
export enum Role {
  FREE = 'free',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin'
}

// Permissions for each role
export const ROLE_PERMISSIONS = {
  [Role.FREE]: {
    maxEmailsPerMonth: 1000,
    maxEmailsPerHour: 50,
    canAccessAnalytics: true,
    canAccessTemplates: true,
    canAccessAPI: false,
    canAccessWebhooks: false,
    canBulkSend: false,
    maxUsersPerAccount: 1,
    canAccessPrioritySupport: false
  },
  [Role.PROFESSIONAL]: {
    maxEmailsPerMonth: 50000,
    maxEmailsPerHour: 500,
    canAccessAnalytics: true,
    canAccessTemplates: true,
    canAccessAPI: true,
    canAccessWebhooks: true,
    canBulkSend: true,
    maxUsersPerAccount: 5,
    canAccessPrioritySupport: true
  },
  [Role.ENTERPRISE]: {
    maxEmailsPerMonth: -1, // Unlimited
    maxEmailsPerHour: -1, // Unlimited
    canAccessAnalytics: true,
    canAccessTemplates: true,
    canAccessAPI: true,
    canAccessWebhooks: true,
    canBulkSend: true,
    maxUsersPerAccount: -1, // Unlimited
    canAccessPrioritySupport: true,
    canAccessDedicatedSupport: true,
    canWhiteLabel: true
  },
  [Role.ADMIN]: {
    maxEmailsPerMonth: -1,
    maxEmailsPerHour: -1,
    canAccessAnalytics: true,
    canAccessTemplates: true,
    canAccessAPI: true,
    canAccessWebhooks: true,
    canBulkSend: true,
    maxUsersPerAccount: -1,
    canAccessPrioritySupport: true,
    canAccessDedicatedSupport: true,
    canWhiteLabel: true,
    canManageUsers: true,
    canViewAllData: true
  }
};

// Map subscription plans to roles
export function planToRole(plan: string): Role {
  switch (plan) {
    case 'starter':
      return Role.FREE;
    case 'professional':
      return Role.PROFESSIONAL;
    case 'enterprise':
      return Role.ENTERPRISE;
    default:
      return Role.FREE;
  }
}

// Check if user has permission
export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions && (permissions as any)[permission] === true;
}

// Get user's current role from subscription
export async function getUserRole(userId: string, pool: any): Promise<Role> {
  try {
    const result = await pool.query(
      'SELECT plan FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [userId, 'active']
    );

    if (result.rows.length === 0) {
      return Role.FREE;
    }

    return planToRole(result.rows[0].plan);
  } catch (err) {
    logger.error({ error: (err as Error).message, userId }, 'Failed to get user role');
    return Role.FREE;
  }
}

// Middleware to check if user has required role
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as any;
      const { pool } = await import('../config/database');
      const userRole = await getUserRole(user.id, pool);

      if (!allowedRoles.includes(userRole)) {
        logger.warn({ 
          userId: user.id, 
          userRole, 
          requiredRoles: allowedRoles 
        }, 'Access denied - insufficient permissions');

        return res.status(403).json({ 
          error: 'Access denied',
          message: `This feature requires ${allowedRoles.join(' or ')} plan`,
          currentPlan: userRole,
          upgradeUrl: '/pricing'
        });
      }

      // Attach role to request for later use
      (req as any).userRole = userRole;
      next();
    } catch (err: any) {
      logger.error({ error: err.message }, 'RBAC middleware error');
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

// Middleware to check specific permission
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = req.user as any;
      const { pool } = await import('../config/database');
      const userRole = await getUserRole(user.id, pool);

      if (!hasPermission(userRole, permission)) {
        logger.warn({ 
          userId: user.id, 
          userRole, 
          permission 
        }, 'Access denied - missing permission');

        return res.status(403).json({ 
          error: 'Access denied',
          message: `This feature is not available in your current plan`,
          currentPlan: userRole,
          upgradeUrl: '/pricing'
        });
      }

      (req as any).userRole = userRole;
      next();
    } catch (err: any) {
      logger.error({ error: err.message }, 'Permission check error');
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

// Middleware to enforce email limits
export async function checkEmailLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = req.user as any;
    const { pool } = await import('../config/database');
    const userRole = await getUserRole(user.id, pool);
    const permissions = ROLE_PERMISSIONS[userRole];

    // Check monthly limit
    if (permissions.maxEmailsPerMonth !== -1) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const result = await pool.query(
        `SELECT COUNT(*) as count FROM emails 
         WHERE user_id = $1 AND created_at >= $2 AND status IN ('sent', 'scheduled')`,
        [user.id, monthStart]
      );

      const emailsSentThisMonth = parseInt(result.rows[0].count);

      if (emailsSentThisMonth >= permissions.maxEmailsPerMonth) {
        return res.status(403).json({
          error: 'Monthly email limit reached',
          limit: permissions.maxEmailsPerMonth,
          used: emailsSentThisMonth,
          message: 'Upgrade your plan to send more emails',
          upgradeUrl: '/pricing'
        });
      }
    }

    // Check hourly limit
    if (permissions.maxEmailsPerHour !== -1) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await pool.query(
        `SELECT COUNT(*) as count FROM emails 
         WHERE user_id = $1 AND created_at >= $2 AND status IN ('sent', 'scheduled')`,
        [user.id, hourAgo]
      );

      const emailsSentThisHour = parseInt(result.rows[0].count);

      if (emailsSentThisHour >= permissions.maxEmailsPerHour) {
        return res.status(429).json({
          error: 'Hourly email limit reached',
          limit: permissions.maxEmailsPerHour,
          used: emailsSentThisHour,
          message: 'Please wait before sending more emails or upgrade your plan',
          retryAfter: 3600
        });
      }
    }

    (req as any).userRole = userRole;
    next();
  } catch (err: any) {
    logger.error({ error: err.message }, 'Email limit check error');
    res.status(500).json({ error: 'Limit check failed' });
  }
}
