const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ["premium", "freemium"],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: {
      type: String,
      required: true,
      enum: ["INR", "USD", "EUR"],
      default: "USD",
    },
    description: { type: String },
    features: [{ type: String }], // List of features for display
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly", "lifetime"],
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ planType: 1 });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
