import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { pool } from './database';
import dotenv from 'dotenv';

dotenv.config();

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user: User = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value || ''
        };

        // Upsert user to database
        await pool.query(
          `INSERT INTO users (id, email, name, avatar, last_login)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             avatar = EXCLUDED.avatar,
             last_login = NOW()`,
          [user.id, user.email, user.name, user.avatar]
        );

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, avatar FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return done(null, false);
    }
    
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

export default passport;
