const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  guildId: String,
  logChannel: String,
  systemEnabled: { type: Boolean, default: true },
  loginEnabled: { type: Boolean, default: true },
  panelMessageId: String,
  panelChannelId: String,
  roleRewards: [
    {
      hours: Number,
      roleId: String
    }
  ]
});

module.exports = mongoose.model("Config", configSchema);
