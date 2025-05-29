import ProviderConfig from "../models/ProviderConfig.js";
import { checkProviderStatus } from "../services/imageGenerationService.js";

// @desc    Get all provider configurations
// @route   GET /api/providers
// @access  Private (potentially Admin only in future)
export const getAllProviderConfigs = async (req, res) => {
  try {
    const providers = await ProviderConfig.find({}).select("-apiKeyEnvVar"); // Exclude sensitive info
    res.json({ message: "Configurations des fournisseurs récupérées", data: providers });
  } catch (error) {
    console.error("Erreur lors de la récupération des configurations fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// @desc    Get a single provider configuration by name
// @route   GET /api/providers/:name
// @access  Private (potentially Admin only in future)
export const getProviderConfigByName = async (req, res) => {
  try {
    const provider = await ProviderConfig.findOne({ name: req.params.name }).select("-apiKeyEnvVar");
    if (!provider) {
      return res.status(404).json({ message: "Configuration fournisseur non trouvée" });
    }
    res.json({ message: "Configuration fournisseur récupérée", data: provider });
  } catch (error) {
    console.error("Erreur lors de la récupération de la configuration fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// @desc    Check the status of a specific provider
// @route   GET /api/providers/:name/status
// @access  Private
export const checkSingleProviderStatus = async (req, res) => {
    try {
        const providerName = req.params.name;
        const status = await checkProviderStatus(providerName);
        res.json({ message: `Statut pour ${providerName}`, data: status });
    } catch (error) {
        console.error(`Erreur lors de la vérification du statut pour ${req.params.name}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la vérification du statut", error: error.message });
    }
};
// @desc    Update provider API key
// @route   PATCH /api/providers/:name/api-key
// @access  Private (Admin only recommandé)
export const updateProviderApiKey = async (req, res) => {
  const { name } = req.params;
  const { newApiKey } = req.body;

  if (!newApiKey) {
    return res.status(400).json({ message: "La nouvelle clé API est requise." });
  }

  try {
    const provider = await ProviderConfig.findOne({ name });
    
    if (!provider) {
      return res.status(404).json({ message: "Fournisseur non trouvé." });
    }
    
    provider.apiKeyEnvVarValue = newApiKey; // ou apiKey selon ton modèle
    console.log("provider", provider.apiKeyEnvVarValue);
    await provider.save();
    console.log("provider" , provider);

    res.json({ message: "Clé API mise à jour avec succès." });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la clé API:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// NOTE: Add, Update, Delete routes would typically require Admin privileges
// and are omitted here for simplicity, but would follow a similar pattern.
/*
// @desc    Add a new provider configuration
// @route   POST /api/providers
// @access  Admin
export const addProviderConfig = async (req, res) => { ... };

// @desc    Update a provider configuration
// @route   PUT /api/providers/:name
// @access  Admin
export const updateProviderConfig = async (req, res) => { ... };

// @desc    Delete a provider configuration
// @route   DELETE /api/providers/:name
// @access  Admin
export const deleteProviderConfig = async (req, res) => { ... };
*/

