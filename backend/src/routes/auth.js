const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000')
);

router.get('/session', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, image: req.user.image } });
});

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});

module.exports = router;