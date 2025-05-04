import express from "express";
import {
  getUserPreferences,
  updateUserPreferences,
} from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All user routes require authentication
router.use(protect);

// Route to get and update user preferences
router
  .route("/preferences")
  .get(getUserPreferences)
  .put(updateUserPreferences);

// Add other user-related routes here if needed (e.g., update profile, delete account)

export default router;

