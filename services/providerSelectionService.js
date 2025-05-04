import ProviderConfig from "../models/ProviderConfig.js";
import { checkProviderStatus } from "./imageGenerationService.js";

/**
 * Selects the best available image generation provider based on user preferences,
 * provider status (active, free tier), and availability.
 *
 * @param {object} userPreferences - User preferences { preferredProvider: string, prioritizeFree: boolean }
 * @param {Array<string>} attemptedProviders - List of providers already attempted for this request.
 * @returns {Promise<object|null>} The selected provider config object or null if none found.
 */
export const selectProvider = async (userPreferences, attemptedProviders = []) => {
  const { preferredProvider = "auto", prioritizeFree = true } = userPreferences;

  try {
    // 1. Get all potentially active providers from DB
    const availableProviders = await ProviderConfig.find({ isActive: true }).sort({ name: 1 }); // Sort for consistent order

    if (!availableProviders || availableProviders.length === 0) {
      console.warn("Aucun fournisseur actif trouvé dans la configuration.");
      return null;
    }

    let candidates = [];

    // 2. Check status for each provider (filter out already attempted)
    for (const provider of availableProviders) {
      if (attemptedProviders.includes(provider.name)) {
        continue; // Skip already tried providers
      }
      const status = await checkProviderStatus(provider.name);
      if (status.isActive) {
        candidates.push({ ...provider.toObject(), ...status }); // Combine config and status
      }
    }

    if (candidates.length === 0) {
      console.log("Aucun fournisseur actif et non tenté trouvé après vérification du statut.");
      return null;
    }

    // 3. Apply selection logic

    // 3a. Try preferred provider first if specified and available
    if (preferredProvider !== "auto") {
      console.log(`Tentative de fournisseur préféré (${preferredProvider})...`);
      
      const preferred = candidates.find(p => p.name === preferredProvider);
      if (preferred) {
        // Check if it meets the free tier preference
        if (prioritizeFree && !preferred.isFreeTier) {
          // Preferred is not free, but user wants free. Look for other free options first.
          console.log(`Fournisseur préféré (${preferredProvider}) n'est pas gratuit, recherche d'alternatives gratuites.`);
        } else {
          console.log(`Sélection du fournisseur préféré : ${preferredProvider}`);
          return preferred; // Select preferred if it's free or user doesn't prioritize free
        }
      }
    }

    // 3b. Filter based on prioritizeFree
    let potentialSelection = [];
    if (prioritizeFree) {
      potentialSelection = candidates.filter(p => p.isFreeTier);
      // If no free options, consider paid ones
      if (potentialSelection.length === 0) {
        console.log("Aucun fournisseur gratuit disponible, prise en compte des fournisseurs payants.");
        potentialSelection = candidates; // All remaining active candidates
      }
    } else {
      potentialSelection = candidates; // User doesn't prioritize free, consider all active
    }

    // 3c. Select the first available candidate from the filtered list
    if (potentialSelection.length > 0) {
      // Simple strategy: pick the first one. Could be randomized or based on other metrics later.
      const selected = potentialSelection[0];
      console.log(`Sélection du fournisseur basé sur les préférences/disponibilité : ${selected.name}`);
      return selected;
    } else {
      console.log("Aucun fournisseur approprié trouvé après application des filtres.");
      return null;
    }

  } catch (error) {
    console.error("Erreur lors de la sélection du fournisseur:", error);
    return null; // Return null on error to indicate failure
  }
};

