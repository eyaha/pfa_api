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

  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Fonction pour envoyer des logs en temps réel
  const sendLog = (step, data = {}) => {
    const logData = {
      step,
      timestamp: new Date().toISOString(),
      ...data
    };
    res.write(`data: ${JSON.stringify(logData)}\n\n`);
  };

  let history = null;
  const attemptedProviders = [];
  let lastError = null;
  let success = false;

  try {
    sendLog('start', { message: '🚀 Début de la génération d\'image', prompt });

    const user = await User.findById(userId);
    if (!user) {
      sendLog('error', { message: 'Utilisateur non trouvé' });
      res.write(`data: ${JSON.stringify({ step: 'end', success: false })}\n\n`);
      return res.end();
    }

    sendLog('user_found', { message: '👤 Utilisateur trouvé', userId });

    const userPreferences = user.preferences;
    const preferredProvider = userPreferences?.preferredProvider || null;
    let providerTransitions = [];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      sendLog('provider_selection', { 
        message: `🔍 Sélection du fournisseur (tentative ${attempt + 1}/${MAX_RETRIES})`,
        attempt: attempt + 1 
      });

      const selectedProviderConfig = await selectProvider(
        userPreferences,
        attemptedProviders
      );

      if (!selectedProviderConfig) {
        lastError = new Error("Aucun fournisseur approprié disponible après tentatives.");
        sendLog('no_provider', { 
          message: `⛔ Aucun fournisseur disponible après ${attempt + 1} tentatives`,
          attemptedProviders 
        });
        break;
      }

      const selectedProviderName = selectedProviderConfig.name;
      attemptedProviders.push(selectedProviderName);
      providerTransitions.push(`Tentative ${attempt + 1}: ${selectedProviderName}`);

      sendLog('provider_selected', { 
        message: `🎯 Fournisseur sélectionné: ${selectedProviderName}`,
        provider: selectedProviderName,
        attempt: attempt + 1
      });

      if (!history) {
        history = new ImageHistory({
          user: userId,
          prompt,
          parameters,
          providerUsed: selectedProviderName,
          status: "pending",
        });
        await history.save();
        
        sendLog('history_created', { 
          message: `📝 Historique créé`,
          historyId: history._id,
          prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
        });
      } else {
        history.providerUsed = selectedProviderName;
        history.status = "pending";
        history.errorMessage = null;
        await history.save();
        
        sendLog('history_updated', { 
          message: `📝 Historique mis à jour pour ${selectedProviderName}`,
          provider: selectedProviderName 
        });
      }

      sendLog('generation_start', { 
        message: `🎨 Début de la génération avec ${selectedProviderName}`,
        provider: selectedProviderName,
        attempt: attempt + 1
      });

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

        sendLog('generation_success', { 
          message: `✅ Image générée avec succès!`,
          provider: selectedProviderName,
          imageUrl: result.imageUrl,
          historyId: history._id
        });

        success = true;
        
        // Envoi du résultat final
        res.write(`data: ${JSON.stringify({
          step: 'end',
          success: true,
          data: {
            message: `Image générée avec succès en utilisant ${selectedProviderName}`,
            data: history,
            providerTransitions,
            preferredProvider,
            providerUsed: selectedProviderName,
            historyId: history._id,
          }
        })}\n\n`);
        
        return res.end();
        
      } catch (generationError) {
        console.error(`Échec avec ${selectedProviderName}:`, generationError.message);
        lastError = generationError;
        history.status = "failed";
        history.errorMessage = generationError.message;
        await history.save();

        sendLog('generation_failed', { 
          message: `❌ Échec avec ${selectedProviderName}`,
          provider: selectedProviderName,
          error: generationError.message,
          attempt: attempt + 1
        });

        // Si ce n'est pas la dernière tentative, on continue
        if (attempt < MAX_RETRIES - 1) {
          sendLog('retry', { 
            message: `🔄 Préparation de la tentative suivante...`,
            nextAttempt: attempt + 2
          });
        }
      }
    }

    if (!success) {
      const finalMessage = `Échec après ${attemptedProviders.length} tentative(s).`;
      sendLog('final_failure', { 
        message: `⛔ ${finalMessage}`,
        attemptedProviders,
        error: lastError?.message || "Tous les fournisseurs ont échoué."
      });

      res.write(`data: ${JSON.stringify({
        step: 'end',
        success: false,
        error: {
          message: finalMessage,
          error: lastError?.message || "Tous les fournisseurs ont échoué.",
          attemptedProviders,
          historyId: history ? history._id : null,
          preferredProvider,
        }
      })}\n\n`);
      
      res.end();
    }
  } catch (error) {
    console.error("Erreur inattendue:", error);
    
    sendLog('unexpected_error', { 
      message: `💥 Erreur serveur inattendue`,
      error: error.message
    });

    if (history && history.status === "pending") {
      history.status = "failed";
      history.errorMessage = "Erreur serveur inattendue.";
      try {
        await history.save();
      } catch (saveError) {
        console.error("Erreur lors de la sauvegarde du statut échoué:", saveError);
      }
    }
    
    res.write(`data: ${JSON.stringify({
      step: 'end',
      success: false,
      error: { 
        message: "Erreur serveur interne", 
        error: error.message 
      }
    })}\n\n`);
    
    res.end();
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
export const deleteImageHistory = async (req, res) => {
  const { id } = req.params;

  try {
    const history = await ImageHistory.findById(id);
    if (!history) {
      return res.status(404).json({ message: "Historique non trouvé" });
    }

    // Facultatif : tu peux vérifier que l'utilisateur est le propriétaire
    if (history.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await ImageHistory.findByIdAndDelete(id);
    res.status(200).json({ message: "Historique supprimé avec succès" });
  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
export const regenerateImage = async (req, res) => {
  const { id } = req.params;

  try {
    const history = await ImageHistory.findById(id);
    if (!history) {
      return res.status(404).json({ message: "Historique non trouvé" });
    }

    await logStep(id, "🔁 Régénération demandée");

    const result = await generateImage(history.providerUsed, history.prompt, history.parameters);

    history.imageUrl = result.imageUrl;
    history.status = "completed";
    history.createdAt = new Date();
    await history.save();

    await logStep(id, "✅ Image régénérée avec succès");

    return res.status(200).json({
      message: "Image régénérée",
      data: history,
    });
  } catch (error) {
    console.error("Erreur régénération:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
// Need to import mongoose for ObjectId validation
import mongoose from "mongoose";
import User from "../models/userModel.js";import { logStep } from "../models/GenerationLog.js";

