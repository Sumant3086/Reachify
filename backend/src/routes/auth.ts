import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', (err: any, user: any) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return res.redirect(process.env.FRONTEND_URL + '?error=oauth_failed');
      }
      if (!user) {
        console.error('Google OAuth: no user returned');
        return res.redirect(process.env.FRONTEND_URL + '?error=no_user');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Session login error:', loginErr);
          return res.redirect(process.env.FRONTEND_URL + '?error=session_failed');
        }
        res.redirect(process.env.FRONTEND_URL + '/dashboard');
      });
    })(req, res, next);
  }
);

router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});

export default router;
