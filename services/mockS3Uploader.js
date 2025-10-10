const { v4: uuidv4 } = require("uuid");
const path = require("path");

/**
 * Mock GCS uploader for development environment
 * Returns demo URLs instead of actually uploading to Google Cloud Storage
 */
const uploadFileToGCS = async (file, folder = "uploads") => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload");
  }

  const fileExtension = path.extname(file.originalname);
  const uniqueFileName = `${folder}/${uuidv4()}${fileExtension}`;

  console.log(`Mock GCS Upload: ${uniqueFileName} (${file.size} bytes)`);

  // Simulate upload delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return a demo URL matching GCS structure
  const demoUrl = `https://storage.googleapis.com/demo-gcs-bucket/${uniqueFileName}`;
  console.log(`Mock upload successful: ${demoUrl}`);

  return demoUrl;
};



const deleteFileFromGCS = async (fileUrl) => {
  if (!fileUrl) {
    console.log("No file URL provided for deletion; skipping.");
    return;
  }

  console.log(`Mock deleting file from GCS: ${fileUrl}`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  console.log(`Mock deletion successful: ${fileUrl}`);
};

module.exports = { uploadFileToGCS, deleteFileFromGCS };
