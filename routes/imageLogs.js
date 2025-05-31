// routes/imageLogs.js
import express from 'express';
import GenerationLog from '../models/GenerationLog.js';

const router = express.Router();

router.get('/image-logs/:historyId', async (req, res) => {
  try {
    const logs = await GenerationLog.find({ historyId: req.params.historyId }).sort({ timestamp: 1 });
    res.json({ logs });
  } catch (err) {
    console.error("Error fetching image logs:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
