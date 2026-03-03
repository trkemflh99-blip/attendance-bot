const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  startTime: Date,
  paused: { type: Boolean, default: false },
  pauseTime: Date
});

module.exports = mongoose.model("Session", sessionSchema);
