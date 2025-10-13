// utils/uploadToCloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file buffer (PDF or image) to Cloudinary inside iicf/fullName/
 * @param {Buffer} buffer - file buffer
 * @param {string} filename - original filename (e.g. "passport.pdf" or "passport.jpg")
 * @param {string} fullName - folder name like "John_Doe"
 */
export const uploadBufferToCloudinary = async (buffer, filename, fullName) => {
  return new Promise((resolve, reject) => {
    const ext = filename.split('.').pop().toLowerCase();
    const isPDF = ext === 'pdf';

    const publicId = `iicf/${fullName}/${filename.replace(/\.[^/.]+$/, '')}`;

    const uploadOptions = {
      public_id: publicId,
      folder: `iicf/${fullName}`,
      format: ext,
      resource_type: isPDF ? 'raw' : 'image', // PDF = raw, others = image
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary Upload Error:', error);
          return reject(error);
        }
        console.log('✅ Uploaded to Cloudinary:', result.secure_url);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
