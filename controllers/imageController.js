import {
  generateImage,
  // checkProviderStatus, // No longer needed directly here
} from "../services/imageGenerationService.js";
import { selectProvider } from "../services/providerSelectionService.js";
import ImageHistory from "../models/ImageHistory.js";
import ProviderConfig from "../models/ProviderConfig.js";

const MAX_RETRIES = 4; // Maximum number of providers to try

// @desc    Generate an image using the best available provider with fallback
// @route   POST /api/images/generate
// @access  Private

export const createImage = async (req, res) => {
  const { prompt, parameters = {} } = req.body;
  const userId = req.user.id;

  if (!prompt) {
    return res.status(400).json({ message: "Le prompt est requis" });
  }

  let history = null;
  const attemptedProviders = [];
  let lastError = null;
  let success = false;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    console.log("userPreferences",user);
    const userPreferences = user.preferences;
    let providerTransitions = [];
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // 1. Select Provider
      const selectedProviderConfig = await selectProvider(userPreferences, attemptedProviders);

      if (!selectedProviderConfig) {
        lastError = new Error("Aucun fournisseur approprié disponible après tentatives.");
        console.log(lastError.message);
        break; // Exit loop if no provider can be selected
      }

      const selectedProviderName = selectedProviderConfig.name;
      attemptedProviders.push(selectedProviderName);
      providerTransitions.push(`Tentative ${attempt + 1}: ${selectedProviderName}`);
      console.log(`Tentative ${attempt + 1}/${MAX_RETRIES}: Essai avec le fournisseur ${selectedProviderName}`);

      // 2. Create/Update History Record
      if (!history) {
        // Create on first attempt
        history = new ImageHistory({
          user: userId,
          prompt,
          parameters,
          providerUsed: selectedProviderName,
          status: "pending",
        });
      } else {
        // Update provider on retry
        history.providerUsed = selectedProviderName;
        history.status = "pending";
        history.errorMessage = null; // Clear previous error
      }
      await history.save();

      // 3. Attempt Generation
      try {
        const result = await generateImage(selectedProviderName, prompt, parameters);

        // 4. Handle Success
        history.imageUrl = result.imageUrl;
        history.status = "completed";
        // history.cost = result.cost; // Optional cost tracking
        await history.save();

        // Increment usage count (consider moving this to generateImage service)
        await ProviderConfig.updateOne({ name: selectedProviderName }, { $inc: { usageCount: 1 } });

        success = true;
        res.status(201).json({
          message: `Image générée avec succès en utilisant ${selectedProviderName}`,
          data: history,
          providerTransitions
        });
        break; // Exit loop on success

      } catch (generationError) {
        // 5. Handle Generation Failure
        console.error(`Échec de la génération avec ${selectedProviderName}:`, generationError.message);
        lastError = generationError; // Store the error from this attempt
        history.status = "failed";
        history.errorMessage = generationError.message;
        await history.save();

        // Continue loop to try the next provider
        console.log("Tentative avec le prochain fournisseur disponible...");
      }
    }

    // 6. Handle Final Failure (if loop finishes without success)
    if (!success) {
      const finalMessage = `Échec de la génération d'image après avoir essayé ${attemptedProviders.length} fournisseur(s).`;
      console.error(finalMessage, lastError ? lastError.message : "Aucun fournisseur n'a pu être sélectionné.");
      res.status(500).json({
        message: finalMessage,
        error: lastError ? lastError.message : "Aucun fournisseur disponible ou tous ont échoué.",
        attemptedProviders: attemptedProviders,
        historyId: history ? history._id : null, // Provide history ID for reference
      });
    }

  } catch (error) {
    // Handle errors outside the generation loop (e.g., finding user, saving history initially)
    console.error("Erreur inattendue dans le contrôleur createImage:", error);
    // Ensure history status reflects failure if applicable
    if (history && history.status === "pending") {
      history.status = "failed";
      history.errorMessage = "Erreur serveur inattendue avant la tentative de génération.";
      try { await history.save(); } catch (saveError) { console.error("Échec de la mise à jour de l'historique après une erreur:", saveError); }
    }
    res.status(500).json({ message: "Erreur serveur interne", error: error.message });
  }
};

// @desc    Get image generation history for the logged-in user
// @route   GET /api/images/history
// @access  Private
export const getImageHistory = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query; // Add pagination

  try {
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 }, // Sort by newest first
    };

    // Find history for the specific user with pagination
    const historyQuery = ImageHistory.find({ user: userId })
                                      .sort(options.sort)
                                      .skip((options.page - 1) * options.limit)
                                      .limit(options.limit);
                                      // .populate({ path: 'user', select: 'username' }); // Populate user if needed

    const [history, totalCount] = await Promise.all([
        historyQuery.exec(),
        ImageHistory.countDocuments({ user: userId })
    ]);

    res.json({
      message: "Historique récupéré avec succès",
      data: history,
      totalPages: Math.ceil(totalCount / options.limit),
      currentPage: options.page,
      totalCount: totalCount
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération de l'historique", error: error.message });
  }
};

// @desc    Get details of a specific image generation record
// @route   GET /api/images/history/:id
// @access  Private
export const getImageHistoryDetail = async (req, res) => {
  const userId = req.user.id;
  const historyId = req.params.id;

  try {
    // Ensure the ID is valid before querying
    if (!mongoose.Types.ObjectId.isValid(historyId)) {
        return res.status(400).json({ message: "ID d'historique invalide" });
    }

    const record = await ImageHistory.findOne({ _id: historyId, user: userId });

    if (!record) {
      return res.status(404).json({ message: "Enregistrement d'historique non trouvé ou accès non autorisé" });
    }

    res.json({ 
      message: "Détail de l'historique récupéré avec succès", 
      data: record 
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du détail de l'historique:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// Need to import mongoose for ObjectId validation
import mongoose from 'mongoose';
import User from "../models/userModel.js";

