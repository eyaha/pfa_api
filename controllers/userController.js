// @desc    Get user preferences
// @route   GET /api/users/preferences

import User from "../models/userModel.js";

// @access  Private
export const getUserPreferences = async (req, res) => {
  try {
    // req.user is populated by the protect middleware
    const user = await User.findById(req.user.id).select("preferences");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "User preferences retrieved successfully",
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Error retrieving preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
export const updateUserPreferences = async (req, res) => {
  const { preferredProvider, prioritizeFree } = req.body;
  const allowedProviders = ['auto', 'stablediffusion', 'kieai', 'gemini', 'photai'];
  console.log("preferredProvider:", preferredProvider);

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (preferredProvider && !allowedProviders.includes(preferredProvider)) {
      return res.status(400).json({
        message: `Invalid preferred provider. Choose from: ${allowedProviders.join(", ")}`,
      });
    }

    if (prioritizeFree !== undefined && typeof prioritizeFree !== 'boolean') {
      return res.status(400).json({ message: "prioritizeFree must be a boolean." });
    }

    if (preferredProvider !== undefined) user.preferences.preferredProvider = preferredProvider;
    if (prioritizeFree !== undefined) user.preferences.prioritizeFree = prioritizeFree;

    await user.save();
    res.json({
      message: "User preferences updated successfully",
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
