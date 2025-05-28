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

    const userPreferences = user.preferences;
    const preferredProvider = userPreferences?.preferredProvider || null;
    let providerTransitions = [];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const selectedProviderConfig = await selectProvider(
        userPreferences,
        attemptedProviders
      );

      if (!selectedProviderConfig) {
        lastError = new Error("Aucun fournisseur approprié disponible après tentatives.");
        await logStep(history?._id, `⛔ Aucun fournisseur disponible après ${attempt} tentatives.`);
        break;
      }

      const selectedProviderName = selectedProviderConfig.name;
      attemptedProviders.push(selectedProviderName);
      providerTransitions.push(`Tentative ${attempt + 1}: ${selectedProviderName}`);

      if (!history) {
        history = new ImageHistory({
          user: userId,
          prompt,
          parameters,
          providerUsed: selectedProviderName,
          status: "pending",
        });
        await history.save();
        await logStep(history._id, `📥 Génération demandée avec prompt: "${prompt}"`);
      } else {
        history.providerUsed = selectedProviderName;
        history.status = "pending";
        history.errorMessage = null;
        await history.save();
      }

      await logStep(history._id, `🔄 Tentative ${attempt + 1} avec ${selectedProviderName}`);

      try {
        const result = await generateImage(
          selectedProviderName,
          prompt,
          parameters
        );

        history.imageUrl = result.imageUrl;
        history.status = "completed";
        await history.save();

        await ProviderConfig.updateOne(
          { name: selectedProviderName },
          { $inc: { usageCount: 1 } }
        );

        await logStep(history._id, `✅ Image générée avec ${selectedProviderName}`);

        success = true;
        return res.status(201).json({
          message: `Image générée avec succès en utilisant ${selectedProviderName}`,
          data: history,
          providerTransitions,
          preferredProvider,
          providerUsed: selectedProviderName,
          historyId: history._id,
        });
      } catch (generationError) {
        console.error(`Échec avec ${selectedProviderName}:`, generationError.message);
        lastError = generationError;
        history.status = "failed";
        history.errorMessage = generationError.message;
        await history.save();

        await logStep(history._id, `❌ Échec avec ${selectedProviderName}: ${generationError.message}`);
      }
    }

    if (!success) {
      const finalMessage = `Échec après ${attemptedProviders.length} tentative(s).`;
      await logStep(history?._id, `⛔ Fin de la génération: ${finalMessage}`);
      return res.status(500).json({
        message: finalMessage,
        error: lastError?.message || "Tous les fournisseurs ont échoué.",
        attemptedProviders,
        historyId: history ? history._id : null,
        preferredProvider,
      });
    }
  } catch (error) {
    console.error("Erreur inattendue:", error);
    if (history && history.status === "pending") {
      history.status = "failed";
      history.errorMessage = "Erreur serveur inattendue.";
      try {
        await history.save();
        await logStep(history._id, `❌ Erreur serveur inattendue: ${error.message}`);
      } catch (saveError) {
        console.error("Erreur lors de la sauvegarde du statut échoué:", saveError);
      }
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
      ImageHistory.countDocuments({ user: userId }),
    ]);

    res.json({
      message: "Historique récupéré avec succès",
      data: history,
      totalPages: Math.ceil(totalCount / options.limit),
      currentPage: options.page,
      totalCount: totalCount,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error);
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la récupération de l'historique",
        error: error.message,
      });
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
      return res
        .status(404)
        .json({
          message:
            "Enregistrement d'historique non trouvé ou accès non autorisé",
        });
    }

    res.json({
      message: "Détail de l'historique récupéré avec succès",
      data: record,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du détail de l'historique:",
      error
    );
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

export const getDashboardStats = async (userId) => {
  const history = await ImageHistory.find({ user: userId });
  const providers = await ProviderConfig.find();

  const totalImages = history.length;

  const providerUsage = {};
  history.forEach((item) => {
    const provider = item.providerUsed || "unknown";
    providerUsage[provider] = (providerUsage[provider] || 0) + 1;
  });

  const formattedProviders = providers.map((p) => {
    const usageCount = p.usageCount || 0;

    // Détermine le quota max depuis quotaLimit (requests OU credits)
    const maxDailyRequests =
      p.quotaLimit?.requests ?? p.quotaLimit?.credits ?? 100;

    const requestsRemaining = Math.max(maxDailyRequests - usageCount, 0);

    return {
      id: p.name,
      name: p.displayName,
      isActive: p.isActive,
      isAvailable: requestsRemaining > 0,
      requestsRemaining,
      maxDailyRequests,
      usageCount,
    };
  });

  return {
    totalImages,
    history,
    providers: formattedProviders,
    providerUsage,
  };
};

// Need to import mongoose for ObjectId validation
import mongoose from "mongoose";
import User from "../models/userModel.js";import { logStep } from "../models/GenerationLog.js";

