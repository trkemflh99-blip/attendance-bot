const Config = require("../models/Config");

async function checkAndAssignRoles(member, totalSeconds) {
  const config = await Config.findOne({ guildId: member.guild.id });
  if (!config || !config.roleRewards.length) return;

  const hours = totalSeconds / 3600;

  for (const reward of config.roleRewards) {
    if (hours >= reward.hours) {
      const role = member.guild.roles.cache.get(reward.roleId);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }
    }
  }
}

module.exports = {
  checkAndAssignRoles
};
