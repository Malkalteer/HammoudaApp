const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true, default: 1 },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", SettingSchema);
