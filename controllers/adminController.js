const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

// In-memory admin storage (replace with database model if needed)
let admins = [];

// Create super admin user
exports.createSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check if super admin already exists
    const existingAdmin = admins.find((admin) => admin.email === email);
    if (existingAdmin) {
      return res.status(400).json({
        message: "Super admin with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create super admin
    const superAdmin = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      role: "super-admin",
      createdAt: new Date(),
    };

    admins.push(superAdmin);

    res.status(201).json({
      message: "Super admin created successfully",
      data: {
        id: superAdmin.id,
        email: superAdmin.email,
        role: superAdmin.role,
        createdAt: superAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating super admin:", error);
    res.status(500).json({
      message: "Failed to create super admin",
      error: error.message,
    });
  }
};

// Admin login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Admin login attempt:", email);
    console.log("Admins in memory:", typeof password);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email });
    console.log("Found admin:", admin);
    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check password
    const isValidPassword = await bcrypt.compare(password, hashedPassword);


    if (!isValidPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" },
    );

    console.log("users details", admin.id, admin.email, admin.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// Get all admins (for debugging)
exports.getAllAdmins = async (req, res) => {
  try {
    const adminList = admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    }));

    res.status(200).json({
      message: "Admins retrieved successfully",
      data: adminList,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};
