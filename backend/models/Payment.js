const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    cycle: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", required: true },
    subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "Subscriber", required: true },
    subscriberId: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidByName: { type: String, default: "" },
    paidByUsername: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
