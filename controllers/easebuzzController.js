const crypto = require("crypto");
const axios = require("axios"); // Added for API calls
const Payment = require("../models/Payment");
const User = require("../models/User");

// Easebuzz configuration
const EASEBUZZ_CONFIG = {
  MERCHANT_KEY: process.env.EASEBUZZ_MERCHANT_KEY,
  SALT: process.env.EASEBUZZ_SALT,
  ENV: process.env.EASEBUZZ_ENV || "test",
  BASE_URL:
    process.env.EASEBUZZ_ENV === "prod"
      ? "https://pay.easebuzz.in/"
      : "https://testpay.easebuzz.in/",
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3000/",
};

// Generate hash for payment request
const generateHash = (data, salt) => {
  const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${salt}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
};

// Verify hash for response
const verifyHash = (data, salt) => {
  const hashString = `${salt}|${data.status}||||||||||${data.udf5}|${data.udf4}|${data.udf3}|${data.udf2}|${data.udf1}|${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${data.key}`;
  const generatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");
  return generatedHash === data.hash;
};

// Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const {
      userId,
      amount,
      subscriptionType,
      description,
      successUrl,
      failureUrl,
      productinfo = "GSB Subscription",
    } = req.body;

    // Validate required fields
    if (!userId || !amount || !subscriptionType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, amount, subscriptionType",
      });
    }
    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate unique transaction ID
    const txnid = `GSB${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

    // Create payment record with pending status
    const payment = new Payment({
      user: userId,
      amount: parseFloat(amount),
      paymentMethod: "easebuzz",
      transactionId: txnid,
      subscriptionType,
      source: "app",
      paymentType: "subscription",
      description: description || `${subscriptionType} subscription`,
      status: "pending",
    });

    await payment.save();

    // Prepare payment data for Easebuzz
    const paymentData = {
      key: EASEBUZZ_CONFIG.MERCHANT_KEY,
      txnid,
      amount: parseFloat(amount).toFixed(2),
      productinfo,
      firstname: user.fullName || "Customer",
      email: user.email || `${user.phoneNumber}@gsb.com`,
      phone: user.phoneNumber,
      surl: successUrl || `${process.env.BACKEND_URL}/api/easebuzz/success`,
      furl: failureUrl || `${process.env.BACKEND_URL}/api/easebuzz/failure`,
      udf1: userId,
      udf2: subscriptionType,
      udf3: "app",
      udf4: payment._id.toString(),
      udf5: "",
    };

    // Generate hash
    paymentData.hash = generateHash(paymentData, EASEBUZZ_CONFIG.SALT);

    // Make server-to-server request to Easebuzz
    try {
      const response = await axios.post(
        `${EASEBUZZ_CONFIG.BASE_URL}payment/initiate`,
        paymentData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (response.data.status === 1) {
        res.status(200).json({
          success: true,
          paymentUrl: response.data.data, // Easebuzz returns payment URL
          paymentData,
          transactionId: txnid,
          paymentId: payment._id,
        });
      } else {
        throw new Error(response.data.msg || "Failed to initiate payment");
      }
    } catch (apiError) {
      console.error("Easebuzz API error:", apiError);
      await Payment.findByIdAndUpdate(payment._id, {
        status: "failed",
        failureReason: apiError.message,
      });
      res.status(500).json({
        success: false,
        message: "Failed to initiate payment with Easebuzz",
        error: apiError.message,
      });
    }
  } catch (error) {
    console.error("Easebuzz initiate payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message,
    });
  }
};

// Handle payment success callback
exports.handleSuccess = async (req, res) => {
  try {
    const paymentResponse = req.body;
    console.log("Payment success callback:", paymentResponse);

    // Verify hash
    if (!verifyHash(paymentResponse, EASEBUZZ_CONFIG.SALT)) {
      console.error("Hash verification failed");
      return res.status(400).json({
        success: false,
        message: "Hash verification failed",
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      transactionId: paymentResponse.txnid,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Update payment status
    if (paymentResponse.status === "success") {
      payment.status = "completed";
      payment.easebuzzPaymentId = paymentResponse.easepayid;
      payment.bankRefNum = paymentResponse.bank_ref_num;
      payment.paymentMode = paymentResponse.mode;
      await payment.save();

      // Update user subscription
      await User.findByIdAndUpdate(
        payment.user,
        { subscribed: true },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: "Payment successful",
        payment: payment,
        transactionId: paymentResponse.txnid,
      });
    } else {
      payment.status = "failed";
      payment.failureReason = paymentResponse.error_Message || "Payment failed";
      await payment.save();

      res.status(400).json({
        success: false,
        message: "Payment failed",
        error: paymentResponse.error_Message,
      });
    }
  } catch (error) {
    console.error("Payment success handler error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing payment callback",
      error: error.message,
    });
  }
};

// Handle payment failure callback
exports.handleFailure = async (req, res) => {
  try {
    const paymentResponse = req.body;
    console.log("Payment failure callback:", paymentResponse);

    // Find payment record
    const payment = await Payment.findOne({
      transactionId: paymentResponse.txnid,
    });

    if (payment) {
      payment.status = "failed";
      payment.failureReason = paymentResponse.error_Message || "Payment failed";
      await payment.save();
    }

    res.status(200).json({
      success: false,
      message: "Payment failed",
      transactionId: paymentResponse.txnid,
      error: paymentResponse.error_Message,
    });
  } catch (error) {
    console.error("Payment failure handler error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing payment failure",
      error: error.message,
    });
  }
};

// Check payment status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Find payment in database
    const payment = await Payment.findOne({
      transactionId: transactionId,
    }).populate("user", "fullName phoneNumber email");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      payment: {
        transactionId: payment.transactionId,
        amount: payment.amount,
        status: payment.status,
        subscriptionType: payment.subscriptionType,
        paymentDate: payment.paymentDate,
        user: payment.user,
        easebuzzPaymentId: payment.easebuzzPaymentId,
        bankRefNum: payment.bankRefNum,
        paymentMode: payment.paymentMode,
      },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking payment status",
      error: error.message,
    });
  }
};

// Get all Easebuzz payments
exports.getAllEasebuzzPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { paymentMethod: "easebuzz" };
    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate("user", "fullName phoneNumber email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get Easebuzz payments error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Refund payment
exports.refundPayment = async (req, res) => {
  try {
    const { transactionId, refundAmount, refundReason } = req.body;

    if (!transactionId || !refundAmount) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID and refund amount are required",
      });
    }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only refund completed payments",
      });
    }

    if (refundAmount > payment.amount) {
      return res.status(400).json({
        success: false,
        message: "Refund amount cannot exceed payment amount",
      });
    }

    // Call Easebuzz refund API
    const refundData = {
      key: EASEBUZZ_CONFIG.MERCHANT_KEY,
      txnid: transactionId,
      refund_amount: refundAmount.toFixed(2),
      email: payment.user.email || `${payment.user.phoneNumber}@gsb.com`,
      phone: payment.user.phoneNumber,
    };
    refundData.hash = crypto
      .createHash("sha512")
      .update(
        `${refundData.key}|${refundData.txnid}|${refundData.refund_amount}|${refundData.email}|${refundData.phone}||||||${EASEBUZZ_CONFIG.SALT}`
      )
      .digest("hex");

    try {
      const response = await axios.post(
        `${EASEBUZZ_CONFIG.BASE_URL}v1/refunds`,
        refundData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (response.data.status === 1) {
        payment.status = "refunded";
        payment.refundAmount = refundAmount;
        payment.refundReason = refundReason || "Refund requested";
        payment.refundDate = new Date();
        await payment.save();

        res.status(200).json({
          success: true,
          message: "Refund processed successfully",
          payment,
        });
      } else {
        throw new Error(response.data.msg || "Refund failed");
      }
    } catch (apiError) {
      console.error("Easebuzz refund API error:", apiError);
      res.status(500).json({
        success: false,
        message: "Failed to process refund with Easebuzz",
        error: apiError.message,
      });
    }
  } catch (error) {
    console.error("Refund payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
      error: error.message,
    });
  }
};
// const crypto = require("crypto");
// const Payment = require("../models/Payment");
// const User = require("../models/User");
// const axios = require("axios");

// // Easebuzz configuration
// const EASEBUZZ_CONFIG = {
//   MERCHANT_KEY: process.env.EASEBUZZ_MERCHANT_KEY,
//   SALT: process.env.EASEBUZZ_SALT,
//   ENV: process.env.EASEBUZZ_ENV || "test", // 'test' or 'prod'
//   BASE_URL:
//     process.env.EASEBUZZ_ENV === "prod"
//       ? "https://pay.easebuzz.in/"
//       : "https://testpay.easebuzz.in/",
//   BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3000/",
// };

// // Generate hash for payment request
// const generateHash = (data, salt) => {
//   const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${salt}`;
//   return crypto.createHash("sha512").update(hashString).digest("hex");
// };

// // Verify hash for response
// const verifyHash = (data, salt) => {
//   const hashString = `${salt}|${data.status}||||||||||${data.udf5}|${data.udf4}|${data.udf3}|${data.udf2}|${data.udf1}|${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${data.key}`;
//   const generatedHash = crypto
//     .createHash("sha512")
//     .update(hashString)
//     .digest("hex");
//   return generatedHash === data.hash;
// };

// // Initiate payment

// exports.initiatePayment = async (req, res) => {
//   try {
//     const {
//       userId,
//       amount,
//       subscriptionType,
//       description,
//       successUrl,
//       failureUrl,
//       productinfo = "GSB Subscription",
//     } = req.body;

//     // Validate required fields
//     if (!userId || !amount || !subscriptionType) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: userId, amount, subscriptionType",
//       });
//     }
//     if (amount <= 0) {
//       return res.status(400).json({ message: "Amount must be positive" });
//     }

//     // Get user details
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Generate unique transaction ID
//     const txnid = `GSB${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

//     // Create payment record with pending status
//     const payment = new Payment({
//       user: userId,
//       amount: parseFloat(amount),
//       paymentMethod: "easebuzz",
//       transactionId: txnid,
//       subscriptionType,
//       source: "app",
//       paymentType: "subscription",
//       description: description || `${subscriptionType} subscription`,
//       status: "pending",
//     });

//     await payment.save();

//     // Prepare payment data for Easebuzz
//     const paymentData = {
//       key: EASEBUZZ_CONFIG.MERCHANT_KEY,
//       txnid,
//       amount: parseFloat(amount).toFixed(2),
//       productinfo,
//       firstname: user.fullName || "Customer",
//       email: user.email || `${user.phoneNumber}@gsb.com`,
//       phone: user.phoneNumber,
//       surl: successUrl || `${process.env.BACKEND_URL}/api/easebuzz/success`,
//       furl: failureUrl || `${process.env.BACKEND_URL}/api/easebuzz/failure`,
//       udf1: userId,
//       udf2: subscriptionType,
//       udf3: "app",
//       udf4: payment._id.toString(),
//       udf5: "",
//     };

//     // Generate hash
//     paymentData.hash = generateHash(paymentData, EASEBUZZ_CONFIG.SALT);

//     // Make server-to-server request to Easebuzz
//     try {
//       const response = await axios.post(
//         `${EASEBUZZ_CONFIG.BASE_URL}payment/initiate`,
//         paymentData,
//         { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//       );

//       if (response.data.status === 1) {
//         res.status(200).json({
//           success: true,
//           paymentUrl: response.data.data, // Easebuzz returns payment URL
//           paymentData,
//           transactionId: txnid,
//           paymentId: payment._id,
//         });
//       } else {
//         throw new Error(response.data.msg || "Failed to initiate payment");
//       }
//     } catch (apiError) {
//       console.error("Easebuzz API error:", apiError);
//       await Payment.findByIdAndUpdate(payment._id, {
//         status: "failed",
//         failureReason: apiError.message,
//       });
//       res.status(500).json({
//         success: false,
//         message: "Failed to initiate payment with Easebuzz",
//         error: apiError.message,
//       });
//     }
//   } catch (error) {
//     console.error("Easebuzz initiate payment error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to initiate payment",
//       error: error.message,
//     });
//   }
// };
// // Handle payment success callback
// exports.handleSuccess = async (req, res) => {
//   try {
//     const paymentResponse = req.body;
//     console.log("Payment success callback:", paymentResponse);

//     // Verify hash
//     if (!verifyHash(paymentResponse, EASEBUZZ_CONFIG.SALT)) {
//       console.error("Hash verification failed");
//       return res.status(400).json({
//         success: false,
//         message: "Hash verification failed",
//       });
//     }

//     // Find payment record
//     const payment = await Payment.findOne({
//       transactionId: paymentResponse.txnid,
//     });

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment record not found",
//       });
//     }

//     // Update payment status
//     if (paymentResponse.status === "success") {
//       payment.status = "completed";
//       payment.easebuzzPaymentId = paymentResponse.easepayid;
//       payment.bankRefNum = paymentResponse.bank_ref_num;
//       payment.paymentMode = paymentResponse.mode;
//       await payment.save();

//       // Update user subscription
//       await User.findByIdAndUpdate(
//         payment.user,
//         { subscribed: true },
//         { new: true }
//       );

//       res.status(200).json({
//         success: true,
//         message: "Payment successful",
//         payment: payment,
//         transactionId: paymentResponse.txnid,
//       });
//     } else {
//       payment.status = "failed";
//       payment.failureReason = paymentResponse.error_Message || "Payment failed";
//       await payment.save();

//       res.status(400).json({
//         success: false,
//         message: "Payment failed",
//         error: paymentResponse.error_Message,
//       });
//     }
//   } catch (error) {
//     console.error("Payment success handler error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error processing payment callback",
//       error: error.message,
//     });
//   }
// };

// // Handle payment failure callback
// exports.handleFailure = async (req, res) => {
//   try {
//     const paymentResponse = req.body;
//     console.log("Payment failure callback:", paymentResponse);

//     // Find payment record
//     const payment = await Payment.findOne({
//       transactionId: paymentResponse.txnid,
//     });

//     if (payment) {
//       payment.status = "failed";
//       payment.failureReason = paymentResponse.error_Message || "Payment failed";
//       await payment.save();
//     }

//     res.status(200).json({
//       success: false,
//       message: "Payment failed",
//       transactionId: paymentResponse.txnid,
//       error: paymentResponse.error_Message,
//     });
//   } catch (error) {
//     console.error("Payment failure handler error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error processing payment failure",
//       error: error.message,
//     });
//   }
// };

// // Check payment status
// exports.checkPaymentStatus = async (req, res) => {
//   try {
//     const { transactionId } = req.params;

//     if (!transactionId) {
//       return res.status(400).json({
//         success: false,
//         message: "Transaction ID is required",
//       });
//     }

//     // Find payment in database
//     const payment = await Payment.findOne({
//       transactionId: transactionId,
//     }).populate("user", "fullName phoneNumber email");

//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       payment: {
//         transactionId: payment.transactionId,
//         amount: payment.amount,
//         status: payment.status,
//         subscriptionType: payment.subscriptionType,
//         paymentDate: payment.paymentDate,
//         user: payment.user,
//         easebuzzPaymentId: payment.easebuzzPaymentId,
//         bankRefNum: payment.bankRefNum,
//         paymentMode: payment.paymentMode,
//       },
//     });
//   } catch (error) {
//     console.error("Check payment status error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error checking payment status",
//       error: error.message,
//     });
//   }
// };

// // Get all Easebuzz payments
// exports.getAllEasebuzzPayments = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, status } = req.query;

//     const query = { paymentMethod: "easebuzz" };
//     if (status) {
//       query.status = status;
//     }

//     const payments = await Payment.find(query)
//       .populate("user", "fullName phoneNumber email")
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit);

//     const total = await Payment.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       payments,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//       total,
//     });
//   } catch (error) {
//     console.error("Get Easebuzz payments error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching payments",
//       error: error.message,
//     });
//   }
// };

// // Refund payment (requires manual implementation based on Easebuzz refund API)
// exports.refundPayment = async (req, res) => {
//   try {
//     const { transactionId, refundAmount, refundReason } = req.body;

//     if (!transactionId || !refundAmount) {
//       return res.status(400).json({
//         success: false,
//         message: "Transaction ID and refund amount are required",
//       });
//     }

//     const payment = await Payment.findOne({ transactionId });
//     if (!payment) {
//       return res.status(404).json({
//         success: false,
//         message: "Payment not found",
//       });
//     }

//     if (payment.status !== "completed") {
//       return res.status(400).json({
//         success: false,
//         message: "Can only refund completed payments",
//       });
//     }

//     if (refundAmount > payment.amount) {
//       return res.status(400).json({
//         success: false,
//         message: "Refund amount cannot exceed payment amount",
//       });
//     }

//     // Call Easebuzz refund API
//     const refundData = {
//       key: EASEBUZZ_CONFIG.MERCHANT_KEY,
//       txnid: transactionId,
//       refund_amount: refundAmount.toFixed(2),
//       email: payment.user.email || `${payment.user.phoneNumber}@gsb.com`,
//       phone: payment.user.phoneNumber,
//     };
//     refundData.hash = crypto
//       .createHash("sha512")
//       .update(
//         `${refundData.key}|${refundData.txnid}|${refundData.refund_amount}|${refundData.email}|${refundData.phone}||||||${EASEBUZZ_CONFIG.SALT}`
//       )
//       .digest("hex");

//     try {
//       const response = await axios.post(
//         `${EASEBUZZ_CONFIG.BASE_URL}v1/refunds`,
//         refundData,
//         { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//       );

//       if (response.data.status === 1) {
//         payment.status = "refunded";
//         payment.refundAmount = refundAmount;
//         payment.refundReason = refundReason || "Refund requested";
//         payment.refundDate = new Date();
//         await payment.save();

//         res.status(200).json({
//           success: true,
//           message: "Refund processed successfully",
//           payment,
//         });
//       } else {
//         throw new Error(response.data.msg || "Refund failed");
//       }
//     } catch (apiError) {
//       console.error("Easebuzz refund API error:", apiError);
//       res.status(500).json({
//         success: false,
//         message: "Failed to process refund with Easebuzz",
//         error: apiError.message,
//       });
//     }
//   } catch (error) {
//     console.error("Refund payment error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error processing refund",
//       error: error.message,
//     });
//   }
// };
