
// @desc    Get user preferences
// @route   GET /api/users/preferences

import User from "../models/userModel.js";

// @access  Private
export const getUserPreferences = async (req, res) => {
  try {
    // req.user is populated by the protect middleware
    const user = await User.findById(req.user.id).select("preferences");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({
      message: "Préférences utilisateur récupérées avec succès",
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des préférences:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
export const updateUserPreferences = async (req, res) => {
  const { preferredProvider, prioritizeFree } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Validate inputs (basic validation)
    const allowedProviders = ["stablediffusion", "auto"];
    if (preferredProvider !== undefined && !allowedProviders.includes(preferredProvider)) {
        return res.status(400).json({ message: `Fournisseur préféré invalide. Doit être l'un de : ${allowedProviders.join(", ")}` });
    }
    if (prioritizeFree !== undefined && typeof prioritizeFree !== "boolean") {
        return res.status(400).json({ message: "prioritizeFree doit être un booléen." });
    }

    // Update preferences
    if (preferredProvider !== undefined) {
      user.preferences.preferredProvider = preferredProvider;
    }
    if (prioritizeFree !== undefined) {
      user.preferences.prioritizeFree = prioritizeFree;
    }

    const updatedUser = await user.save();

    res.json({
      message: "Préférences utilisateur mises à jour avec succès",
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des préférences:", error);
    // Handle potential validation errors from Mongoose
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: "Erreur de validation", errors: error.errors });
    }
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

