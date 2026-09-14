const mongoose = require("mongoose");

const StocktakeRequestSchema = new mongoose.Schema(
  {
    items: [
      {
        subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscriber", required: true },
        currentReading: { type: Number, required: true },
      },
    ],
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StocktakeRequest", StocktakeRequestSchema);
