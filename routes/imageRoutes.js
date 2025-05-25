import express from "express";
import {
  createImage,
  getImageHistory,
  getImageHistoryDetail,
  getDashboardStats
} from "../controllers/imageController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All image routes are protected
router.use(protect);

// Route to generate a new image
router.post("/generate", createImage);

// Route to get the user's image generation history (paginated)
router.get("/history", getImageHistory);
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getDashboardStats(userId);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// Route to get details of a specific history record
router.get("/history/:id", getImageHistoryDetail);

export default router;

