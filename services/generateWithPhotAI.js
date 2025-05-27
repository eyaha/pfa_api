import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

      const imageUrl = statusResponse.data?.data?.output_urls?.[0];
      if (imageUrl) {
        // console.log(`✅ Image Phot.AI récupérée : ${imageUrl}`);

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
