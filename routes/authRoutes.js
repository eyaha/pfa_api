import express from 'express';
import { getEmailByCode, login, logout, refresh, register, requestPasswordReset, resetPassword, verifyResetCode } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/request-reset-code', requestPasswordReset);
router.post('/verify-code', verifyResetCode);       // → Vérifie et retourne tempToken
router.post('/confirm-reset', resetPassword);
router.get('/get-user-email/:code', getEmailByCode);
// Route protégée
router.get('/me', protect, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

export default router;