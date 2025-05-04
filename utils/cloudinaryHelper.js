import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer (from base64) to Cloudinary.
 * @param {Buffer} buffer
 * @returns {Promise<string>} - Cloudinary secure URL
 */
export async function uploadBufferToCloudinary(buffer) {
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

/**
 * Upload an image from an existing URL (like KieAI) to Cloudinary.
 * @param {string} imageUrl
 * @returns {Promise<string>} - Cloudinary secure URL
 */
export async function uploadUrlToCloudinary(imageUrl) {
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  return uploadBufferToCloudinary(buffer);
}
