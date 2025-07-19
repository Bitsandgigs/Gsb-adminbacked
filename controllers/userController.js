const User = require("../models/User");
const DailyUpdate = require("../models/DailyUpdate");
const { uploadFileToS3 } = require("../services/s3Uploader");

const multer = require("multer");

exports.updateUser = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    const { id } = req.params;
    const { fullName, phoneNumber, age, weight, height, goal } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (age) updateData.age = Number(age);
    if (weight) updateData.weight = Number(weight);
    if (height) updateData.height = Number(height);
    if (goal) updateData.goal = goal;

    if (req.file) {
      updateData.photo = await uploadFileToS3(req.file, "users");
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${error.message}` });
    }
    res.status(400).json({ error: error.message });
  }
};

// Keep other functions unchanged
exports.calculateUserScore = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyUpdates = await DailyUpdate.find({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo },
    }).sort({ createdAt: 1 });

    if (dailyUpdates.length === 0) {
      user.score = 0;
      user.flag = "red";
    } else {
      const daysWithUpdates = new Set();
      dailyUpdates.forEach((update) => {
        const date = update.createdAt.toDateString();
        daysWithUpdates.add(date);
      });

      const consistencyScore = (daysWithUpdates.size / 30) * 100;

      let flag = "red";
      if (consistencyScore >= 80) {
        flag = "green";
      } else if (consistencyScore >= 50) {
        flag = "yellow";
      }

      user.score = Math.round(consistencyScore);
      user.flag = flag;
    }

    user.lastScoreUpdate = new Date();
    await user.save();

    return { score: user.score, flag: user.flag };
  } catch (error) {
    console.error("Error calculating user score:", error);
    return null;
  }
};

exports.getUserWithScore = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await exports.calculateUserScore(id);
    const updatedUser = await User.findById(id);

    res.status(200).json({ user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllUsersWithScores = async (req, res) => {
  try {
    const users = await User.find().select("-otp -otpExpiresAt");

    for (let user of users) {
      await exports.calculateUserScore(user._id);
    }

    const updatedUsers = await User.find().select("-otp -otpExpiresAt");
    res.status(200).json({ users: updatedUsers });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.allGreenFlags = async (req, res) => {
  try {
    const { flagAsk } = req.body;
    const users = await User.find({ flag: flagAsk });
    res.status(200).json({ count: users.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.changeFlag = async (req, res) => {
  emirates = await User.findByIdAndUpdate(
    req.params.id,
    { flag: req.body.flag },
    { new: true, runValidators: true }
  );
  if (!emirates) {
    return res.status(404).json({ error: "User not found" });
  }
  res
    .status(200)
    .json({ message: "User flag updated successfully", user: emirates });
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-otp -otpExpiresAt");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// const User = require("../models/User");
// const DailyUpdate = require("../models/DailyUpdate");
// const { uploadFileToS3 } = require("../services/s3Uploader");

// const multer = require("multer");
// exports.createUser = async (req, res) => {
//   try {
//     console.log("Create user - Request body:", req.body);
//     console.log("Create user - Request file:", req.file);
//     const { fullName, phoneNumber, age, weight, height, goal } = req.body;

//     photoUrl = await uploadFileToS3(req.file, "users");

//     const user = new User({
//       fullName,
//       phoneNumber,
//       age,
//       weight,
//       height,
//       goal,
//       photo: photoUrl,
//     });
//     await user.save();
//     res.status(201).json({ message: "User created successfully", user });
//   } catch (error) {
//     if (error instanceof multer.MulterError) {
//       return res.status(400).json({ error: `Multer error: ${error.message}` });
//     }
//     res.status(400).json({ error: error.message });
//   }
// };

// exports.updateUser = async (req, res) => {
//   try {
//     console.log("Request body:", req.body); // Debug
//     console.log("Request file:", req.file); // Debug
//     const { id } = req.params;
//     const { fullName, phoneNumber, age, weight, height, goal } = req.body;

//     const updateData = {};
//     if (fullName) updateData.fullName = fullName;
//     if (phoneNumber) updateData.phoneNumber = phoneNumber;
//     if (age) updateData.age = Number(age);
//     if (weight) updateData.weight = Number(weight);
//     if (height) updateData.height = Number(height);
//     if (goal) updateData.goal = goal;

//     if (req.file) {
//       updateData.photo = await uploadFileToS3(req.file, "users");
//     }

//     const user = await User.findByIdAndUpdate(
//       id,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     res.status(200).json({ message: "User updated successfully", user });
//   } catch (error) {
//     if (error instanceof multer.MulterError) {
//       return res.status(400).json({ error: `Multer error: ${error.message}` });
//     }
//     res.status(400).json({ error: error.message });
//   }
// };

// // Calculate user score based on daily updates consistency
// exports.calculateUserScore = async (userId) => {
//   try {
//     const user = await User.findById(userId);
//     if (!user) return null;

//     // Get daily updates from last 30 days
//     const thirtyDaysAgo = new Date();
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//     const dailyUpdates = await DailyUpdate.find({
//       user: userId,
//       createdAt: { $gte: thirtyDaysAgo },
//     }).sort({ createdAt: 1 });

//     if (dailyUpdates.length === 0) {
//       user.score = 0;
//       user.flag = "red";
//     } else {
//       // Calculate consistency score
//       const daysWithUpdates = new Set();
//       dailyUpdates.forEach((update) => {
//         const date = update.createdAt.toDateString();
//         daysWithUpdates.add(date);
//       });

//       const consistencyScore = (daysWithUpdates.size / 30) * 100;

//       // Assign flag based on score
//       let flag = "red";
//       if (consistencyScore >= 80) {
//         flag = "green";
//       } else if (consistencyScore >= 50) {
//         flag = "yellow";
//       }

//       user.score = Math.round(consistencyScore);
//       user.flag = flag;
//     }

//     user.lastScoreUpdate = new Date();
//     await user.save();

//     return { score: user.score, flag: user.flag };
//   } catch (error) {
//     console.error("Error calculating user score:", error);
//     return null;
//   }
// };

// // Get user with calculated score
// exports.getUserWithScore = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = await User.findById(id);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Calculate updated score
//     await exports.calculateUserScore(id);
//     const updatedUser = await User.findById(id);

//     res.status(200).json({ user: updatedUser });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// // Get all users with their scores
// exports.getAllUsersWithScores = async (req, res) => {
//   try {
//     const users = await User.find().select("-otp -otpExpiresAt");

//     // Update scores for all users
//     for (let user of users) {
//       await exports.calculateUserScore(user._id);
//     }

//     const updatedUsers = await User.find().select("-otp -otpExpiresAt");
//     res.status(200).json({ users: updatedUsers });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// exports.deleteUser = async (req, res) => {
//   try {
//     const user = await User.findByIdAndDelete(req.params.id);
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }
//     res.status(200).json({ message: "User deleted successfully" });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// exports.allGreenFlags = async (req, res) => {
//   try {
//     const { flagAsk } = req.body;
//     const users = await User.find({ flag: flagAsk });
//     res.status(200).json({ count: users.length });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// exports.changeFlag = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { flag } = req.body;
//     const users = await User.findByIdAndUpdate(
//       id,
//       { flag: flag },
//       { new: true, runValidators: true }
//     );
//     if (!users) {
//       return res.status(404).json({ error: "User not found" });
//     }
//     res
//       .status(200)
//       .json({ message: "User flag updated successfully", user: users });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// exports.getUserById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = await User.findById(id).select("-otp -otpExpiresAt");
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }
//     res.status(200).json({ user });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };
