
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
  const allowedProviders = ['auto', 'stablediffusion', 'kieai', 'gemini', 'photai'];

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    if (preferredProvider && !allowedProviders.includes(preferredProvider)) {
      return res.status(400).json({
        message: `Fournisseur préféré invalide. Choisissez parmi : ${allowedProviders.join(", ")}`,
      });
    }

    if (prioritizeFree !== undefined && typeof prioritizeFree !== 'boolean') {
      return res.status(400).json({ message: "prioritizeFree doit être un booléen." });
    }

    if (preferredProvider !== undefined) user.preferences.preferredProvider = preferredProvider;
    if (prioritizeFree !== undefined) user.preferences.prioritizeFree = prioritizeFree;

    await user.save();
console.log("succes");

    res.json({
      message: "Préférences utilisateur mises à jour avec succès",
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Erreur mise à jour préférences:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};


