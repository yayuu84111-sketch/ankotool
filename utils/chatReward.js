const { addBalance } = require('./ankoDollar');
const { getAjackSettings, getChatCooldown, updateChatCooldown } = require('../storage/fileStorage');

async function processChatReward(guildId, userId) {
  const settings = await getAjackSettings(guildId);
  
  if (!settings.chatRewardEnabled) {
    return { success: false, error: 'disabled' };
  }

  const lastClaim = await getChatCooldown(guildId, userId);
  const now = Date.now();

  if (lastClaim && (now - lastClaim) < settings.chatRewardCooldown) {
    return { success: false, error: 'on_cooldown' };
  }

  const reward = Math.floor(Math.random() * (settings.chatRewardMax - settings.chatRewardMin + 1)) + settings.chatRewardMin;
  
  await updateChatCooldown(guildId, userId, now);
  const newBalance = await addBalance(userId, reward);

  return {
    success: true,
    reward,
    newBalance
  };
}

module.exports = {
  processChatReward
};
