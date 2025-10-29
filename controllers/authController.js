const User = require("../models/User");
const client = require("../config/twilio");
const { uploadFileToS3 } = require("../services/s3Uploader");

exports.signUp = async (req, res) => {
  const { fullName, phoneNumber } = req.body;
  console.log("➡️ SignUp attempt:", { fullName, phoneNumber });

  if (!fullName || !phoneNumber) {
    console.log("❌ Missing required fields");
    return res
      .status(400)
      .json({ error: "Full name and phone number are required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes from now

  try {
    // Check if phone number already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      console.log("❌ Phone number already registered");
      return res.status(400).json({ error: "Phone number already registered" });
    }

    // Create new user (unverified)
    const user = new User({
      fullName,
      phoneNumber,
      otp,
      otpExpiresAt,
      verified: false,
      firstTimeLogin: true,
      onboardingStage: "otp_verified",
    });

    await user.save();
    console.log("💾 New user saved with OTP:", otp);

    // Send OTP via Twilio
    const twilioResponse = await client.messages.create({
      body: `Your GSB Pathy signup verification code is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber,
    });
    console.log("📤 Twilio message sent:", twilioResponse.sid);

    res.status(200).json({
      message: "OTP sent for signup",
      userId: user._id,
      phoneNumber,
    });
  } catch (error) {
    console.error("❌ Error during signup:", error);
    res
      .status(500)
      .json({ error: "Failed to send signup OTP", debug: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { fullName, phoneNumber } = req.body;
  console.log("➡️ Login attempt:", { fullName, phoneNumber });

  if (!fullName || !phoneNumber) {
    console.log("❌ Missing required fields");
    return res
      .status(400)
      .json({ error: "Full name and phone number are required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes from now

  try {
    // Check if user exists
    const user = await User.findOne({ phoneNumber, fullName });
    if (!user) {
      console.log("❌ User not found");
      return res
        .status(404)
        .json({ error: "User not found. Please sign up first." });
    }

    // Update OTP
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    console.log("💾 User updated with OTP:", otp);

    // Send OTP via Twilio
    const twilioResponse = await client.messages.create({
      body: `Your GSB Pathy login verification code is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber,
    });
    console.log("📤 Twilio message sent:", twilioResponse.sid);

    res.status(200).json({
      message: "OTP sent for login",
      userId: user._id,
      phoneNumber,
    });
  } catch (error) {
    console.error("❌ Error during login:", error);
    res
      .status(500)
      .json({ error: "Failed to send login OTP", debug: error.message });
  }
};

exports.verifyOTP = async (req, res) => {
  const { userId, phoneNumber, otp } = req.body;
  console.log("➡️ OTP verification attempt:", { userId, phoneNumber, otp });

  if (!userId || !phoneNumber || !otp) {
    console.log("❌ Missing required fields");
    return res
      .status(400)
      .json({ error: "User ID, phone number, and OTP are required" });
  }

  try {
    const user = await User.findOne({ _id: userId, phoneNumber });
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }
    
    if (user.otp !== otp || user.otpExpiresAt < new Date()) {
      console.log("❌ Invalid or expired OTP");
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark user as verified for signup
    if (!user.verified) {
      user.verified = true;
    }

    // Clear OTP after verification
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();
    console.log("💾 OTP verified, user updated");

    // Determine next step based on onboarding stage
    let nextStep =
      user.onboardingStage === "completed"
        ? "home"
        : user.onboardingStage === "otp_verified"
        ? "age"
        : "height_weight";

    // If onboarding is complete, reset firstTimeLogin
    if (user.onboardingStage === "height_weight_added") {
      user.onboardingStage = "completed";
      user.firstTimeLogin = false;
      await user.save();
    }

    res.status(200).json({
      message:
        user.verified && user.firstTimeLogin
          ? "Signup OTP verified, proceed to next step"
          : "Login successful",
      nextStep,
      user: {
        _id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        age: user.age,
        weight: user.weight,
        height: user.height,
        goal: user.goal,
        photo: user.photo,
        score: user.score,
        flag: user.flag,
        verified: user.verified,
        onboardingStage: user.onboardingStage,
      },
    });
  } catch (error) {
    console.error("❌ Error during OTP verification:", error);
    res
      .status(500)
      .json({ error: "OTP verification failed", debug: error.message });
  }
};

exports.submitAge = async (req, res) => {
  const { userId, age } = req.body;
  console.log("➡️ Submitting age:", { userId, age });

  if (!userId || !age) {
    console.log("❌ Missing required fields");
    return res.status(400).json({ error: "User ID and age are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    if (user.onboardingStage !== "otp_verified") {
      console.log("❌ Invalid onboarding stage");
      return res
        .status(400)
        .json({
          error:
            "Invalid onboarding stage. Age already submitted or not ready.",
        });
    }

    user.age = Number(age);
    user.onboardingStage = "age_added";
    await user.save();
    console.log("💾 Age updated, next step: height_weight");

    res.status(200).json({
      message: "Age submitted successfully",
      nextStep: "height_weight",
      user: {
        _id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        age: user.age,
        onboardingStage: user.onboardingStage,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting age:", error);
    res
      .status(500)
      .json({ error: "Failed to submit age", debug: error.message });
  }
};

exports.submitHeightWeight = async (req, res) => {
  const { userId, height, weight } = req.body;
  console.log("➡️ Submitting height/weight:", { userId, height, weight });

  if (!userId || !height || !weight) {
    console.log("❌ Missing required fields");
    return res
      .status(400)
      .json({ error: "User ID, height, and weight are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    if (user.onboardingStage !== "age_added") {
      console.log("❌ Invalid onboarding stage");
      return res
        .status(400)
        .json({
          error: "Invalid onboarding stage. Age must be submitted first.",
        });
    }

    user.height = Number(height);
    user.weight = Number(weight);
    user.onboardingStage = "height_weight_added";
    await user.save();
    console.log("💾 Height/weight updated, next step: home");

    res.status(200).json({
      message: "Height and weight submitted successfully",
      nextStep: "home",
      user: {
        _id: user._id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        age: user.age,
        height: user.height,
        weight: user.weight,
        onboardingStage: user.onboardingStage,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting height/weight:", error);
    res
      .status(500)
      .json({ error: "Failed to submit height/weight", debug: error.message });
  }
};

// Keep loginAdmin unchanged
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt:", email, password);
  console.log(
    "Expected:",
    process.env.SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_PASSWORD
  );

  try {
    if (
      email === process.env.SUPER_ADMIN_EMAIL &&
      password === process.env.SUPER_ADMIN_PASSWORD
    ) {
      const admin = await Admin.findOne({ email });
      console.log("Creating token for super admin...", admin);
      const token = jwt.sign(
        { email, role: "super-admin" },
        process.env.JWT_SECRET || "default-secret",
        { expiresIn: "1d" }
      );
      console.log("Token created successfully:", token ? "YES" : "NO");
      return res.status(200).json({ token });
    }

    console.log("Checking team member login...");
    const user = await TeamMember.findOne({ email });
    console.log("Team member found:", !!user);
    if (!user || user.password !== password) {
      console.log("Team member login failed - no user or wrong password");
      return res.status(401).json({ message: "Invalid email or password" });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
// const User = require("../models/User");
// const client = require("../config/twilio");
// const { uploadFileToS3 } = require("../services/s3Uploader");

// exports.signUp = async (req, res) => {
//   const { fullName, phoneNumber, age, weight, height, goal } = req.body;
//   console.log("➡️ SignUp attempt:", { fullName, phoneNumber });

//   if (!fullName || !phoneNumber) {
//     console.log("❌ Missing required fields");
//     return res
//       .status(400)
//       .json({ error: "Full name and phone number are required" });
//   }

//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   const otpExpiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes from now

//   try {
//     // Check if phone number already exists
//     const existingUser = await User.findOne({ phoneNumber });
//     if (existingUser) {
//       console.log("❌ Phone number already registered");
//       return res.status(400).json({ error: "Phone number already registered" });
//     }

//     // Handle photo upload if provided
//     let photoUrl = null;
//     if (req.file) {
//       console.log("📷 Uploading photo for new user");
//       photoUrl = await uploadFileToS3(req.file, "users");
//     }

//     // Create new user (unverified)
//     const user = new User({
//       fullName,
//       phoneNumber,
//       age: age ? Number(age) : undefined,
//       weight: weight ? Number(weight) : undefined,
//       height: height ? Number(height) : undefined,
//       goal,
//       photo: photoUrl,
//       otp,
//       otpExpiresAt,
//       verified: false,
//       firstTimeLogin: true,
//     });

//     await user.save();
//     console.log("💾 New user saved with OTP:", otp);

//     // Send OTP via Twilio
//     const twilioResponse = await client.messages.create({
//       body: `Your GSB Pathy signup verification code is ${otp}`,
//       from: process.env.TWILIO_PHONE,
//       to: phoneNumber,
//     });
//     console.log("📤 Twilio message sent:", twilioResponse.sid);

//     res.status(200).json({
//       message: "OTP sent for signup",
//       userId: user._id,
//       phoneNumber,
//     });
//   } catch (error) {
//     console.error("❌ Error during signup:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send signup OTP", debug: error.message });
//   }
// };

// exports.loginUser = async (req, res) => {
//   const { phoneNumber } = req.body;
//   console.log("➡️ Login attempt:", { phoneNumber });

//   if (!phoneNumber) {
//     console.log("❌ Missing phone number");
//     return res.status(400).json({ error: "Phone number is required" });
//   }

//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   const otpExpiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes from now

//   try {
//     // Check if user exists
//     const user = await User.findOne({ phoneNumber });
//     if (!user) {
//       console.log("❌ User not found");
//       return res
//         .status(404)
//         .json({ error: "User not found. Please sign up first." });
//     }

//     // Update OTP
//     user.otp = otp;
//     user.otpExpiresAt = otpExpiresAt;
//     await user.save();
//     console.log("💾 User updated with OTP:", otp);

//     // Send OTP via Twilio
//     const twilioResponse = await client.messages.create({
//       body: `Your GSB Pathy login verification code is ${otp}`,
//       from: process.env.TWILIO_PHONE,
//       to: phoneNumber,
//     });
//     console.log("📤 Twilio message sent:", twilioResponse.sid);

//     res.status(200).json({
//       message: "OTP sent for login",
//       userId: user._id,
//       phoneNumber,
//     });
//   } catch (error) {
//     console.error("❌ Error during login:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send login OTP", debug: error.message });
//   }
// };

// exports.verifyOTP = async (req, res) => {
//   const { userId, phoneNumber, otp } = req.body;
//   console.log("➡️ OTP verification attempt:", { userId, phoneNumber, otp });

//   if (!userId || !phoneNumber || !otp) {
//     console.log("❌ Missing required fields");
//     return res
//       .status(400)
//       .json({ error: "User ID, phone number, and OTP are required" });
//   }

//   try {
//     const user = await User.findOne({ _id: userId, phoneNumber });
//     if (!user) {
//       console.log("❌ User not found");
//       return res.status(404).json({ error: "User not found" });
//     }

//     if (user.otp !== otp || user.otpExpiresAt < new Date()) {
//       console.log("❌ Invalid or expired OTP");
//       return res.status(400).json({ error: "Invalid or expired OTP" });
//     }

//     // Mark user as verified for signup
//     if (!user.verified) {
//       user.verified = true;
//     }

//     // Clear OTP after verification
//     user.otp = null;
//     user.otpExpiresAt = null;
//     await user.save();
//     console.log("💾 OTP verified, user updated");

//     // Return user data
//     res.status(200).json({
//       message: user.verified
//         ? "Signup completed successfully"
//         : "Login successful",
//       isFirstTimeLogin: user.firstTimeLogin, // Include in response
//       user: {
//         _id: user._id,
//         fullName: user.fullName,
//         phoneNumber: user.phoneNumber,
//         age: user.age,
//         weight: user.weight,
//         height: user.height,
//         goal: user.goal,
//         photo: user.photo,
//         score: user.score,
//         flag: user.flag,
//         verified: user.verified,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error during OTP verification:", error);
//     res
//       .status(500)
//       .json({ error: "OTP verification failed", debug: error.message });
//   }
// };

// // Keep existing loginAdmin function unchanged
// exports.loginAdmin = async (req, res) => {
//   const { email, password } = req.body;
//   console.log("Login attempt:", email, password);
//   console.log("Expected:", SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
//   console.log("Email match:", email === SUPER_ADMIN_EMAIL);
//   console.log("Password match:", password === SUPER_ADMIN_PASSWORD);

//   try {
//     if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
//       const admin = await Admin.find({ email });
//       console.log("Creating token for super admin...", admin);
//       const token = jwt.sign(
//         { email, role: "super-admin" },
//         process.env.JWT_SECRET || "default-secret",
//         { expiresIn: "1d" }
//       );
//       console.log("Token created successfully:", token ? "YES" : "NO");
//       console.log(
//         "Sending response with token:",
//         token.substring(0, 20) + "..."
//       );
//       return res.status(200).json({ token });
//     }

//     console.log("Checking team member login...");
//     const user = await TeamMember.findOne({ email });
//     console.log("Team member found:", !!user);
//     if (!user || user.password !== password) {
//       console.log("Team member login failed - no user or wrong password");
//       return res.status(401).json({ message: "Invalid email or password" });
//     }
//     return res.status(200).json({ user });
//   } catch (err) {
//     console.error("Server Error:", err);
//     res.status(500).json({ message: "Server Error", error: err.message });
//   }
// };


exports.sendOTP = async (req, res) => {
  const { fullName, phoneNumber } = req.body;

  console.log("➡️ Received request to send OTP");
  console.log("📨 Request Body:", req.body);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes from now

  try {
    let user = await User.findOne({ phoneNumber });

    console.log("🔍 User found:", user);

    if (!user) {
      console.log("🆕 Creating new user");
      user = new User({ fullName, phoneNumber, otp, otpExpiresAt });
    } else {
      console.log("🔁 Updating existing user's OTP");
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
    }

    await user.save();
    console.log("💾 User saved with OTP:", otp);

    // Sending the OTP via Twilio
    const twilioResponse = await client.messages.create({
      body: `Your GSB Pathy verification code is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber,
    });

    console.log("📤 Twilio message sent:", twilioResponse.sid);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("❌ Error occurred while sending OTP:", error);

    // Respond with detailed error for development (limit in production)
    res.status(500).json({ error: "Failed to send OTP", debug: error.message });
  }
};

