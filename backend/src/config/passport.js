const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('../db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
    if (rows.length > 0) return done(null, rows[0]);
    const newUser = await pool.query(
      'INSERT INTO users (google_id, name, email, image) VALUES ($1, $2, $3, $4) RETURNING *',
      [profile.id, profile.displayName, profile.emails[0].value, profile.photos[0]?.value || '']
    );
    return done(null, newUser.rows[0]);
  } catch (err) { return done(err); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0]);
  } catch (err) { done(err); }
});