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

  // Ordre de priorité défini pour les fournisseurs
  const providerPriorityOrder = ["stablediffusion", "kieai", "photai", "gemini"];

  /**
   * Fonction utilitaire pour trier les fournisseurs selon l'ordre de priorité
   * @param {Array} providers - Liste des fournisseurs à trier
   * @returns {Array} Liste des fournisseurs triés
   */
  const sortProvidersByPriority = (providers) => {
    return providers.sort((a, b) => {
      const indexA = providerPriorityOrder.indexOf(a.name);
      const indexB = providerPriorityOrder.indexOf(b.name);

      // Si un fournisseur n'est pas dans la liste de priorité, le placer à la fin
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  };

  try {
    // 1. Get all potentially active providers from DB
    const availableProviders = await ProviderConfig.find({ isActive: true });

    if (!availableProviders || availableProviders.length === 0) {
      console.warn("Aucun fournisseur actif trouvé dans la configuration.");
      return null;
    }

    // Trier les fournisseurs selon l'ordre de priorité défini
    const sortedProviders = sortProvidersByPriority(availableProviders);

    let candidates = [];

    // 2. Check status for each provider (filter out already attempted)
    for (const provider of sortedProviders) {
      if (attemptedProviders.includes(provider.name)) {
        continue; // Skip already tried providers
      }

      const status = await checkProviderStatus(provider.name);

      // Calcule requestsRemaining depuis usage et quota
      const usageCount = provider.usageCount || 0;
      const maxDailyRequests = provider.quotaLimit?.requests ?? provider.quotaLimit?.credits ?? 100;
      const requestsRemaining = Math.max(maxDailyRequests - usageCount, 0);

      // Condition spéciale pour gemini : toujours disponible (pas de limite)
      let isAvailable;
      if (provider.name === "gemini") {
        isAvailable = true;
      } else {
        isAvailable = requestsRemaining > 0;
      }

      // Ajout de la disponibilité dans le status
      status.isAvailable = isAvailable;

      // Ajouter seulement si actif ET disponible
      if (status.isActive && status.isAvailable) {
        candidates.push({ ...provider.toObject(), ...status });
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
        if (prioritizeFree && !preferred.isFreeTier) {
          console.log(`Fournisseur préféré (${preferredProvider}) n'est pas gratuit, recherche d'alternatives gratuites.`);
        } else {
          console.log(`Sélection du fournisseur préféré : ${preferredProvider}`);
          return preferred;
        }
      }
    }

    // 3b. Filter based on prioritizeFree
    let potentialSelection = [];
    if (prioritizeFree) {
      potentialSelection = candidates.filter(p => p.isFreeTier);
      if (potentialSelection.length === 0) {
        console.log("Aucun fournisseur gratuit disponible, prise en compte des fournisseurs payants.");
        potentialSelection = candidates;
      }
    } else {
      potentialSelection = candidates;
    }

    // 3c. Select the first available candidate from the filtered list (already sorted)
    if (potentialSelection.length > 0) {
      const selected = potentialSelection[0];
      console.log(`Sélection du fournisseur basé sur les préférences/disponibilité : ${selected.name}`);
      return selected;
    } else {
      console.log("Aucun fournisseur approprié trouvé après application des filtres.");
      return null;
    }

  } catch (error) {
    console.error("Erreur lors de la sélection du fournisseur:", error);
    return null;
  }
};
