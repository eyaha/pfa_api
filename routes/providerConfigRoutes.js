import express from "express";
import {
  getAllProviderConfigs,
  getProviderConfigByName,
  checkSingleProviderStatus,
  // Import admin-only functions if/when implemented
} from "../controllers/providerConfigController.js";
import { protect } from "../middlewares/authMiddleware.js";
// import { admin } from "../middleware/authMiddleware.js"; // Optional: for admin-only routes

const router = express.Router();

// Apply protect middleware to all provider config routes for now
// Consider using admin middleware for routes that modify configs later
router.use(protect);

// Route to get all provider configurations
router.get("/", getAllProviderConfigs);

// Route to get a single provider configuration by name
router.get("/:name", getProviderConfigByName);

// Route to check the status of a specific provider
router.get("/:name/status", checkSingleProviderStatus);

// Admin-only routes (Example structure)
// router.post("/", protect, admin, addProviderConfig);
// router.put("/:name", protect, admin, updateProviderConfig);
// router.delete("/:name", protect, admin, deleteProviderConfig);

export default router;

