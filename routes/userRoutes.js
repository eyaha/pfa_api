import express from "express";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import { deleteUser, getAllUsers, getImagesByUser } from "../controllers/adminController.js";
import ImageHistory from "../models/ImageHistory.js";

const router = express.Router();

// All user routes require authentication
router.use(protect);

// Route to get and update user preferences
router
  .route("/preferences")
  .get(getUserPreferences)
  .put(updateUserPreferences);
  router.get("/admin/users", isAdmin, getAllUsers);
router.delete("/admin/users/:id", isAdmin, deleteUser);
// Add other user-related routes here if needed (e.g., update profile, delete account)
router.get("/admin/users/:userId/image-count", isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const count = await ImageHistory.countDocuments({ user: userId });
    console.log("count", count);
    
    res.status(200).json({ count });
  } catch (err) {
    console.error("Erreur récupération du nombre d’images :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
export default router;

