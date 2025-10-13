const mongoose = require("mongoose");
const PDF = require("../models/PDF");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { Storage } = require("@google-cloud/storage");

// Initialize GCS Client
const storage = new Storage({
  projectId: "sublime-night-474607-f8", // same as your GCP project ID
  keyFilename: './gcs-key.json' // path to service account JSON
});
const bucket = storage.bucket('gsbpathy-media');



exports.uploadDietPlan = async (req, res) => {
  console.log("GCS Bucket initialized:", bucket.name);
  try {
    const { title, description } = req.body;
    const pdfFile = req.files?.pdfFile?.[0];
    const thumbnail = req.files?.thumbnail?.[0];

    if (!pdfFile) return res.status(400).json({ message: "PDF file missing" });

    // Generate unique file names
    const pdfKey = `diet-plans/${Date.now()}-${uuidv4()}-${pdfFile.originalname}`;
    const thumbKey = thumbnail
      ? `thumbnails/${Date.now()}-${uuidv4()}-${thumbnail.originalname}`
      : null;

    // 📤 Upload PDF to GCS
    const pdfBlob = bucket.file(pdfKey);
    await pdfBlob.save(pdfFile.buffer, {
      contentType: pdfFile.mimetype,
      public: true, // make it publicly accessible
    });

    // 📤 Upload thumbnail (if exists)
    if (thumbnail) {
      const thumbBlob = bucket.file(thumbKey);
      await thumbBlob.save(thumbnail.buffer, {
        contentType: thumbnail.mimetype,
        public: true,
      });
    }

    // 📄 Construct public URLs
    const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${pdfKey}`;
    const thumbnailUrl = thumbKey
      ? `https://storage.googleapis.com/${bucket.name}/${thumbKey}`
      : null;

    // 💾 Save to MongoDB
    await PDF.create({
      title,
      description,
      pdfUrl,
      thumbnailUrl,
    });

    res.status(200).json({
      message: "Upload successful",
      title,
      description,
      pdfUrl,
      thumbnailUrl,
    });
  } catch (err) {
    console.error("GCS upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

// 🧾 Fetch all diet plans
exports.getAllDietPlans = async (req, res) => {
  try {
    const plans = await PDF.find()
      .sort({ createdAt: -1 })
      .select("title description pdfUrl thumbnailUrl");

    res.status(200).json({
      message: "Success",
      count: plans.length,
      data: plans,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ message: "Failed to fetch diet plans", error: err.message });
  }
};

// ❌ Delete PDF + Thumbnail from GCS
exports.deletePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPDF = await PDF.findByIdAndDelete(id);

    if (!deletedPDF) {
      return res.status(404).json({ message: "PDF not found" });
    }

    const pdfKey = new URL(deletedPDF.pdfUrl).pathname.substring(1);
    const thumbKey = deletedPDF.thumbnailUrl
      ? new URL(deletedPDF.thumbnailUrl).pathname.substring(1)
      : null;

    // Delete files from GCS
    await bucket.file(pdfKey).delete().catch(() => {});
    if (thumbKey) await bucket.file(thumbKey).delete().catch(() => {});

    res.status(200).json({ message: "PDF deleted successfully", pdf: deletedPDF });
  } catch (error) {
    console.error("Error deleting PDF:", error);
    res.status(500).json({ message: "Failed to delete PDF", error: error.message });
  }
};
