const Video = require("../models/Video");
const VideoCategory = require("../models/VideoCategory");
const { uploadFileToGCS, deleteFileFromGCS } = require("../services/s3Uploader");

exports.uploadVideo = async (req, res) => {
  try {
    const { title, description, categoryId, accessLevel, youtubeLink } =
      req.body;
    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    console.log("Upload request received:");
    console.log("Body:", req.body);
    console.log("Video File:", videoFile);
    console.log("Thumbnail File:", thumbnailFile);

    // Validate inputs
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }
    if (!videoFile && !youtubeLink) {
      return res
        .status(400)
        .json({ message: "Either video file or YouTube link is required" });
    }

    // Validate categoryId
    const category = await VideoCategory.findOne({ categoryId });
    if (!category) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Upload files to S3
    let videoUrl = null;
    let thumbnailUrl = null;
    try {
      videoUrl = videoFile ? await uploadFileToGCS(videoFile, "videos") : null;
      thumbnailUrl = thumbnailFile
        ? await uploadFileToGCS(thumbnailFile, "thumbnails")
        : null;
    } catch (uploadError) {
      return res.status(500).json({
        message: "Failed to upload files",
        error: uploadError.message,
      });
    }

    const videoDoc = await Video.create({
      title,
      description: description || "",
      category: category._id,
      accessLevel: accessLevel || "Free",
      videoUrl,
      thumbnailUrl,
      youtubeLink,
    });

    // Populate category in response
    const populatedVideo = await Video.findById(videoDoc._id).populate(
      "category",
      "categoryId name description"
    );

    res.status(201).json({
      message: "Video uploaded successfully",
      video: populatedVideo,
    });
  } catch (error) {
    // Clean up S3 files if creation fails
    if (videoUrl) await deleteFileFromGCS(videoUrl);
    if (thumbnailUrl) await deleteFileFromGCS(thumbnailUrl);
    res
      .status(500)
      .json({ message: "Failed to upload video", error: error.message });
  }
};

exports.getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find()
      .populate("category", "categoryId name description")
      .sort({ createdAt: -1 });
    res.status(200).json({
      message: "Videos fetched successfully",
      count: videos.length,
      videos,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch videos", error: error.message });
  }
};

exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, categoryId, accessLevel, youtubeLink } =
      req.body;
    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    // Validate categoryId if provided
    let category = null;
    if (categoryId) {
      category = await VideoCategory.findOne({ categoryId });
      if (!category) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
    }

    // Fetch existing video
    const existingVideo = await Video.findById(id);
    if (!existingVideo) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Upload new files and clean up old ones
    let videoUrl = existingVideo.videoUrl;
    let thumbnailUrl = existingVideo.thumbnailUrl;
    try {
      if (videoFile) {
        videoUrl = await uploadFileToGCS(videoFile, "videos");
        if (existingVideo.videoUrl && !existingVideo.youtubeLink) {
          await deleteFileFromGCS(existingVideo.videoUrl);
        }
      }
      if (thumbnailFile) {
        thumbnailUrl = await uploadFileToGCS(thumbnailFile, "thumbnails");
        if (existingVideo.thumbnailUrl) {
          await deleteFileFromGCS(existingVideo.thumbnailUrl);
        }
      }
    } catch (uploadError) {
      return res.status(500).json({
        message: "Failed to upload files",
        error: uploadError.message,
      });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (categoryId) updateData.category = category._id;
    if (accessLevel) updateData.accessLevel = accessLevel;
    if (videoUrl) updateData.videoUrl = videoUrl;
    if (thumbnailUrl) updateData.thumbnailUrl = thumbnailUrl;
    if (youtubeLink !== undefined) updateData.youtubeLink = youtubeLink;

    const video = await Video.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("category", "categoryId name description");

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    res.status(200).json({
      message: "Video updated successfully",
      video,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update video", error: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    console.log("Deleting video:", video);

    // return res.status(200).json({ message: "Reached delete endpoint", data: video });

    // Delete S3 files
    if (video.videoUrl && !video.youtubeLink) {
      await deleteFileFromGCS(video.videoUrl);
    }
    if (video.thumbnailUrl) {
      await deleteFileFromGCS(video.thumbnailUrl);
    }

    await Video.deleteOne({ _id: id });

    res.status(200).json({ message: "Video deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete video", error: error.message });
  }
};
