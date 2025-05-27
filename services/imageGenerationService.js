import axios from "axios";
import { GoogleGenAI, Modality } from "@google/genai";
import { v2 as cloudinary } from 'cloudinary';
import ProviderConfig from "../models/ProviderConfig.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload buffer to Cloudinary
async function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

// Upload image from URL to Cloudinary
async function uploadUrlToCloudinary(imageUrl) {
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  return uploadBufferToCloudinary(buffer);
}

// Helper to get API keys
const getApiKey = (providerName) => {
  switch (providerName.toLowerCase()) {
    case "stablediffusion":
      return process.env.STABLE_DIFFUSION_API_KEY;
    case "kieai":
      return process.env.KIEAI_API_KEY;
    default:
      return null;
  }
};

const generateWithStableDiffusion = async (prompt, parameters) => {
  const apiKey = getApiKey("stablediffusion");
  if (!apiKey) throw new Error("Clé API Stable Diffusion non configurée.");

  const apiUrl = process.env.STABLE_DIFFUSION_API_URL || "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

  try {
    const response = await axios.post(
      apiUrl,
      {
        text_prompts: [{ text: prompt }],
        cfg_scale: parameters.cfg_scale || 7,
        height: parameters.height || 1024,
        width: parameters.width || 1024,
        steps: parameters.steps || 30,
        samples: 1,
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    // console.log("[DEBUG] Stability AI Response Body:", JSON.stringify(response.data, null, 2));

    const base64Image = response.data.artifacts[0]?.base64;
    if (!base64Image) throw new Error("Aucune donnée base64 trouvée dans la réponse de l'API.");

    const buffer = Buffer.from(base64Image, 'base64');
    const cloudinaryUrl = await uploadBufferToCloudinary(buffer);

    return { imageUrl: cloudinaryUrl };

  } catch (error) {
    console.error("Erreur API Stable Diffusion:", error.response ? error.response.data : error.message);
    throw new Error(`Échec de la génération Stable Diffusion: ${error.message}`);
  }
};

function generateWithKieAI(prompt, parameters = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey("kieai");
    if (!apiKey) return reject(new Error('Clé API KieAI non configurée.'));

    const data = JSON.stringify({
      prompt,
      size: parameters.size || '1:1',
      callBackUrl: parameters.callBackUrl || '',
      isEnhance: parameters.isEnhance || false,
      uploadCn: parameters.uploadCn || false
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://kieai.erweima.ai/api/v1/gpt4o-image/generate',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: data
    };

    axios.request(config)
      .then((response) => {
        const taskId = response.data.data?.taskId;
        if (!taskId) return reject(new Error('Aucun taskId trouvé dans la réponse.'));

        const maxAttempts = 20;
        let attempts = 0;
        const intervalMs = 5000;

        const pollForResult = () => {
          if (attempts >= maxAttempts) {
            return reject(new Error('Nombre maximum de tentatives atteint sans obtenir de résultat.'));
          }

          attempts++;
          const resultConfig = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://kieai.erweima.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`,
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            }
          };

          axios.request(resultConfig)
            .then(async (resultResponse) => {
              const imageUrl = resultResponse.data.data?.response?.resultUrls?.[0];
              if (imageUrl) {
                const cloudinaryUrl = await uploadUrlToCloudinary(imageUrl);
                resolve({ taskId, imageUrl: cloudinaryUrl });
              } else {
                setTimeout(pollForResult, intervalMs);
              }
            })
            .catch((error) => {
              reject(new Error(`Erreur récupération résultat KieAI : ${error.message}`));
            });
        };

        setTimeout(pollForResult, intervalMs);
      })
      .catch((error) => {
        reject(new Error(`Erreur KieAI (génération) : ${error.message}`));
      });
  });
}

export async function generateWithGemini(prompt, parameters = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Clé API Gemini non configurée.");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates[0].content.parts;

    for (const part of parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        const cloudinaryUrl = await uploadBufferToCloudinary(buffer);
        return { imageUrl: cloudinaryUrl };
      }
    }

    throw new Error("Aucune image générée par Gemini.");

  } catch (error) {
    console.error("❌ Erreur Gemini :", error.message);
    throw new Error(`Erreur Gemini : ${error.message}`);
  }
}
export async function generateWithPhotAI(prompt, parameters = {}) {
  const apiKey = process.env.PHOTAI_API_KEY;
  if (!apiKey) {
    throw new Error("Clé API Phot.AI non configurée.");
  }

  const url = "https://prodapi.phot.ai/external/api/v3/user_activity/create-art";

  try {
    // Étape 1 : Créer la génération
    const createResponse = await axios.post(
      url,
      {
        prompt,
        guidance_scale: parameters.guidance_scale || 7.5,
        num_outputs: parameters.num_outputs || 1,
        aspect_ratio: parameters.aspect_ratio || "1:1",
        studio_options: {
          style: parameters.style || ["cinematic"],
        },
      },
      {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const orderId = createResponse.data?.data?.order_id;
    if (!orderId) {
      throw new Error("Aucun order_id retourné par Phot.AI.");
    }
    console.log(`✅ Phot.AI order_id : ${orderId}`);

    // Étape 2 : Polling pour récupérer le résultat
    const maxAttempts = 20;
    let attempts = 0;
    const intervalMs = 5000; // 5 secondes

    const pollForResult = async () => {
      if (attempts >= maxAttempts) {
        throw new Error("Nombre maximum de tentatives atteint sans résultat Phot.AI.");
      }
      attempts++;
      console.log(`⏳ Tentative ${attempts}/${maxAttempts} pour récupérer le résultat Phot.AI...`);

      const statusResponse = await axios.get(
        `https://prodapi.phot.ai/external/api/v1/user_activity/order-status?order_id=${orderId}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        }
      );

      const imageUrl = statusResponse.data?.output_urls?.[0];
      if (imageUrl) {
        console.log(`✅ Image Phot.AI récupérée : ${imageUrl}`);

        // Étape 3 : Upload Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
          folder: "generated_images",
        });

        console.log("✅ Image uploadée sur Cloudinary :", uploadResponse.secure_url);
        return { orderId, imageUrl: uploadResponse.secure_url };
      } else {
        console.log("⚠️ Image non prête, nouvelle tentative dans 5 secondes...");
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        return pollForResult();
      }
    };

    return await pollForResult();
  } catch (error) {
    console.error("❌ Erreur generateWithPhotAI :", error.response ? error.response.data : error.message);
    throw new Error(`Erreur PhotAI : ${error.message}`);
  }
}
// Main entry point
export const generateImage = async (provider, prompt, parameters) => {
  switch (provider.toLowerCase()) {
    case "stablediffusion":
      return generateWithStableDiffusion(prompt, parameters);
    case "gemini":
      return generateWithGemini(prompt, parameters);
    case "kieai":
      return generateWithKieAI(prompt, parameters);
    case "photai":
      return generateWithPhotAI(prompt, parameters);
    default:
      throw new Error(`Fournisseur non supporté: ${provider}`);
  }
};

// Check provider status
export const checkProviderStatus = async (providerName) => {
  console.log(`Vérification du statut pour ${providerName}...`);
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const config = await ProviderConfig.findOne({ name: providerName.toLowerCase() });
    if (!config) {
      return { isActive: false, isFreeTier: false, message: "Configuration non trouvée." };
    }

    let isActive = config.isActive;
    let isFreeTier = config.isFreeTier;
    let usage = config.usageCount || 0;
    let limit = config.quotaLimit ? (config.quotaLimit.requests || Infinity) : Infinity;

    if (usage >= limit) {
      isFreeTier = false;
    }

    await ProviderConfig.updateOne({ name: providerName.toLowerCase() }, { lastChecked: new Date() });

    return {
      isActive,
      isFreeTier,
      usageCount: usage,
      quotaLimit: limit,
      message: isActive ? "Actif" : "Inactif",
    };
  } catch (error) {
    return { isActive: false, isFreeTier: false, message: `Erreur: ${error.message}` };
  }
};
