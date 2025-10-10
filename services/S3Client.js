// const {
//   S3Client,
//   PutObjectCommand,
//   GetObjectCommand,
// } = require("@aws-sdk/client-s3");
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
// const fs = require('fs').promises;
// const path = require('path');
// const dotenv = require("dotenv");
// dotenv.config();

// const s3Client = new S3Client({
//   region: process.env.S3_REGION,
//   credentials: {
//     accessKeyId: process.env.S3_ACCESS_KEY,
//     secretAccessKey: process.env.S3_SECRET_KEY,
//   },
// });

// // Supported content types and their corresponding placeholder files
// const SUPPORTED_CONTENT_TYPES = ["image/jpeg", "image/png", "video/mp4"];
// const PLACEHOLDER_FILES = {
//   'image/jpeg': '../placeholder/thumbnail_pic.png',
//   'video/mp4': '../placeholder/placeholder_video.mp4'
// };

// async function uploadPlaceholderFile(filename, contentType) {
//   try {
//     const placeholderRelativePath = PLACEHOLDER_FILES[contentType];
//     if (!placeholderRelativePath) {
//       throw new Error(`No placeholder file available for content type: ${contentType}`);
//     }

//     // Resolve the absolute path relative to the current file's directory
//     const placeholderPath = path.resolve(__dirname, placeholderRelativePath);

//     // Check if file exists before attempting to read
//     try {
//       await fs.access(placeholderPath);
//     } catch (error) {
//       console.error(`Placeholder file not found at: ${placeholderPath}`);
//       throw new Error(`Placeholder file not found: ${placeholderPath}`);
//     }

//     const fileContent = await fs.readFile(placeholderPath);

//     const uploadCommand = new PutObjectCommand({
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: filename,
//       Body: fileContent,
//       ContentType: contentType
//     });

//     await s3Client.send(uploadCommand);
//     console.log(`Successfully uploaded placeholder file for ${filename}`);
//   } catch (error) {
//     console.error(`Error uploading placeholder file: ${error.message}`);
//     throw error;
//   }
// }

// async function generateUploadURL(userId, contentType, filename) {
//   // Handle both image/jpeg and image/png with the same placeholder
//   const normalizedContentType = contentType === 'image/png' ? 'image/jpeg' : contentType;

//   // Validate content type
//   if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) {
//     console.error(`Unsupported content type detected: ${contentType}`);
//     throw new Error("Unsupported content type for placeholder file.");
//   }

//   // Log inputs for debugging
//   console.log("Generating presigned URL with:");
//   console.log("User ID:", userId);
//   console.log("Content Type:", contentType);
//   console.log("Filename:", filename);

//   try {
//     // Upload placeholder file first
//     await uploadPlaceholderFile(filename, normalizedContentType);

//     const command = new PutObjectCommand({
//       Bucket: process.env.S3_BUCKET_NAME,
//       Key: filename,
//       ContentType: contentType,
//       ResponseContentType: contentType,
//       ResponseContentDisposition: "inline",
//     });

//     // Generate a presigned URL with a 1-hour expiration time
//     const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
//     console.log("Generated Presigned URL:", uploadUrl);
//     return uploadUrl;
//   } catch (error) {
//     console.error("Error generating presigned URL:", error);
//     throw error;
//   }
// }

// async function generatePublicViewURL(userId, filename) {
//   const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${filename}`;
//   console.log("Generated Public View URL:", url);
//   return url;
// }

// module.exports = {
//   generateUploadURL,
//   generatePublicViewURL,
// };


// s3Client.js

const { Storage } = require("@google-cloud/storage");
const path = require("path");

const storage = new Storage({
  keyFilename: path.join(__dirname, "../gcs-key.json"), // Service Account key
  projectId: process.env.GCP_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

module.exports = bucket;


