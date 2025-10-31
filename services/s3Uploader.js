const { v4: uuidv4 } = require("uuid");
const path = require("path");
const bucket = require("../utils/GCSClient");

/**
 * Upload any file to Google Cloud Storage with folder and content-type support.
 * @param {Object} file - File object from multer (memoryStorage)
 * @param {string} folder - Folder name inside GCS bucket. Default is 'uploads'
 * @returns {string} - Public URL of the uploaded file
 */
const uploadFileToGCS = async (file, folder = "uploads") => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload");
  }

  console.log("bucket details:", bucket.name);

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const uniqueFileName = `${folder}/${uuidv4()}${fileExtension}`;

  const contentType = file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")
    ? file.mimetype
    : "application/octet-stream";

  console.log(
    `Uploading file to GCS: ${uniqueFileName} with ContentType: ${contentType}, Size: ${file.buffer.length} bytes`
  );

  const blob = bucket.file(uniqueFileName);
  const blobStream = blob.createWriteStream({
    resumable: false,
    contentType,
    predefinedAcl: "publicRead", // Make file public
  });

  

  return new Promise((resolve, reject) => {
    blobStream
      .on("finish", async () => {
        try {
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
          console.log(`Upload successful: ${uniqueFileName}`);
          console.log(`Generated URL: ${publicUrl}`);
          resolve(publicUrl);
        } catch (err) {
          console.error("GCS URL Error:", err);
          reject(err);
        }
      })
      .on("error", (err) => {
        console.error("GCS Upload Error:", err);
        reject(new Error(`Failed to upload file to GCS: ${err.message}`));
      })
      .end(file.buffer);
  });
};

/**
 * Delete file from Google Cloud Storage
 * @param {string} fileUrl - Public URL of the file to delete
 */
const deleteFileFromGCS = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    const url = new URL(fileUrl);

    // Remove leading `/bucket-name/` from path
    const fullPath = decodeURIComponent(url.pathname.slice(1));
    const key = fullPath.replace(`${bucket.name}/`, "");

    console.log("Deleting:", key);
    await bucket.file(key).delete();

    console.log("Deleted successfully");
  } catch (err) {
    console.error("GCS Delete Error:", err);
    throw new Error(`Failed to delete: ${err.message}`);
  }
};


module.exports = { uploadFileToGCS, deleteFileFromGCS };
