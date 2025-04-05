import express from 'express';
import { verifyAccessToken } from '../middlewares/auth.middleware.js';
import { login, logout, refresh, register } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Route protégée
router.get('/me', verifyAccessToken, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

export default router;