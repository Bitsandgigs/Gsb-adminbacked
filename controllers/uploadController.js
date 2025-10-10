const { uploadFileToGCS } = require("../services/s3Uploader");

exports.uploadToS3 = async (req, res) => {
  try {
    console.log("Upload request received:");
    console.log("Body:", req.body);
    console.log("File:", req.file);

    const { folder } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }

    if (!folder) {
      return res.status(400).json({ message: "Folder is required" });
    }

    // Validate file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        message:
          "Invalid file type. Only images, videos, and PDFs are allowed.",
      });
    }

    console.log(
      `File validation passed: ${file.originalname}, ${file.mimetype}, ${file.size} bytes`,
    );

    // Validate file size
    const maxSize = file.mimetype.startsWith("image")
      ? 5 * 1024 * 1024 // 5MB for images
      : 100 * 1024 * 1024; // 100MB for videos/PDFs

    if (file.size > maxSize) {
      return res.status(400).json({
        message: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
      });
    }

    // Check AWS configuration
    if (
      !process.env.S3_BUCKET_NAME ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      return res.status(500).json({
        message:
          "AWS S3 configuration is incomplete. Missing environment variables.",
      });
    }

    console.log(`Uploading file to S3 folder: ${folder}`);
    const fileUrl = await uploadFileToGCS(file, folder);

    res.status(200).json({
      message: "File uploaded successfully",
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  } catch (error) {
    console.error("S3 upload error:", error);
    res.status(500).json({
      message: "File upload failed",
      error: error.message,
    });
  }
};
