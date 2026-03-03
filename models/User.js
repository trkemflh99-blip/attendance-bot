const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  totalTime: { type: Number, default: 0 }, // بالثواني
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
