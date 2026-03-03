const User = require("../models/User");
const { getWeekStart, getMonthStart } = require("./timeUtils");

async function getOverallTop(guildId) {
  return await User.find({ guildId })
    .sort({ totalTime: -1 })
    .limit(10);
}

async function getWeeklyTop(guildId) {
  const weekStart = getWeekStart();
  return await User.find({
    guildId,
    createdAt: { $gte: weekStart }
  })
    .sort({ totalTime: -1 })
    .limit(10);
}

async function getMonthlyTop(guildId) {
  const monthStart = getMonthStart();
  return await User.find({
    guildId,
    createdAt: { $gte: monthStart }
  })
    .sort({ totalTime: -1 })
    .limit(10);
}

module.exports = {
  getOverallTop,
  getWeeklyTop,
  getMonthlyTop
};
