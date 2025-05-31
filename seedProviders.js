import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProviderConfig from './models/ProviderConfig.js';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connecté: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Erreur de connexion MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const seedProviders = async () => {
  await connectDB();

  try {
    // Clear existing data (optional)
    await ProviderConfig.deleteMany({});
    console.log('Anciennes configurations de fournisseurs supprimées.');

    const providersToSeed = [
      {
        name: 'stablediffusion',
        displayName: 'Stable Diffusion',
        apiBaseUrl: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        apiKeyEnvVar: 'STABLE_DIFFUSION_API_KEY',
        isFreeTier: true,
        isActive: true,
        quotaLimit: { credits: 27 },
        costPerRequest: 0.9,
        costUnit: 'credits',
      },
      {
        name: 'kieai',
        displayName: 'GPT4o',
        apiBaseUrl: 'https://kieai.erweima.ai/api/v1/gpt4o-image',
        apiKeyEnvVar: 'KIEAI_API_KEY',
        isFreeTier: true,
        isActive: true,
        quotaLimit: { credits: 8 }, // Ajoute un quota fictif si besoin
        costPerRequest: 6, // Si gratuit pour l’instant
        costUnit: 'credits',
      },
      {
        name: 'gemini',
        displayName: 'Gemini',
        apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', // Note : endpoint indicatif, car Gemini utilise SDK
        apiKeyEnvVar: 'GEMINI_API_KEY',
        isFreeTier: true,
        isActive: true,
        quotaLimit: null, // Exemple : 60 requêtes/min en free tier
        costPerRequest: 0, // Gratuit jusqu’au quota
        costUnit: 'USD',
      },
      {
        name: 'photai',
        displayName: 'Phot.AI',
        apiBaseUrl: 'https://prodapi.phot.ai', // endpoint principal
        apiKeyEnvVar: 'PHOTAI_API_KEY',
        isFreeTier: true,
        isActive: true,
        quotaLimit: { requests: 25 }, // exemple fictif
        costPerRequest: 1, // gratuit sur quota
        costUnit: 'credits',
      }
    ];

    await ProviderConfig.insertMany(providersToSeed);
    console.log('Configurations de fournisseurs initiales insérées avec succès.');

  } catch (error) {
    console.error('Erreur lors de l\'initialisation des fournisseurs:', error);
  } finally {
    mongoose.connection.close();
    console.log('Connexion MongoDB fermée.');
  }
};

seedProviders();
