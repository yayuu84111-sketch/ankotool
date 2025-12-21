const { createModerationCase } = require('../storage/fileStorage');

const actionTracker = new Map();

async function checkSuspiciousActivity(guild, userId, actionType) {
  const key = `${guild.id}-${userId}`;
  const now = Date.now();
  const timeWindow = 10000;
  
  if (!actionTracker.has(key)) {
    actionTracker.set(key, []);
  }
  
  const actions = actionTracker.get(key);
  const recentActions = actions.filter(a => now - a.timestamp < timeWindow);
  
  recentActions.push({ type: actionType, timestamp: now });
  actionTracker.set(key, recentActions);
  
  const thresholds = {
    'channel_delete': 3,
    'role_delete': 3,
    'member_ban': 5,
    'member_kick': 5,
    'channel_create': 10,
    'role_create': 10,
    'webhook_create': 3,
    'webhook_delete': 5
  };
  
  const count = recentActions.filter(a => a.type === actionType).length;
  
  if (count >= (thresholds[actionType] || 5)) {
    return {
      suspicious: true,
      actionType,
      count,
      timeWindow: timeWindow / 1000
    };
  }
  
  return { suspicious: false };
}

async function handleSuspiciousBot(guild, botId, action) {
  try {
    const bot = await guild.members.fetch(botId);
    
    await bot.ban({
      reason: `Antinuke: 疑わしいBot活動検出 - ${action.actionType} (${action.count}回/${action.timeWindow}秒)`
    });
    
    await createModerationCase(
      guild.id,
      botId,
      guild.client.user.id,
      'auto_ban_bot',
      `Antinuke: ${action.actionType} を ${action.count}回実行`
    );
    
    return { success: true, banned: true };
  } catch (error) {
    console.error('Bot BAN エラー:', error);
    return { success: false, error: error.message };
  }
}

async function checkMassJoin(guild) {
  const now = Date.now();
  const timeWindow = 60000;
  
  const key = `join-${guild.id}`;
  if (!actionTracker.has(key)) {
    actionTracker.set(key, []);
  }
  
  const joins = actionTracker.get(key);
  const recentJoins = joins.filter(j => now - j < timeWindow);
  
  if (recentJoins.length >= 10) {
    return {
      isRaid: true,
      joinCount: recentJoins.length,
      timeWindow: timeWindow / 1000
    };
  }
  
  return { isRaid: false };
}

function trackJoin(guildId) {
  const key = `join-${guildId}`;
  if (!actionTracker.has(key)) {
    actionTracker.set(key, []);
  }
  
  const joins = actionTracker.get(key);
  joins.push(Date.now());
  actionTracker.set(key, joins);
}

function cleanupTracker() {
  const now = Date.now();
  const maxAge = 300000;
  
  for (const [key, value] of actionTracker.entries()) {
    if (Array.isArray(value)) {
      const filtered = value.filter(v => 
        typeof v === 'number' ? now - v < maxAge : now - v.timestamp < maxAge
      );
      
      if (filtered.length === 0) {
        actionTracker.delete(key);
      } else {
        actionTracker.set(key, filtered);
      }
    }
  }
}

async function handleSuspiciousWebhook(guild, webhook, executorId) {
  try {
    await webhook.delete('Antinuke: 疑わしいWebhook活動検出');
    
    const executor = await guild.members.fetch(executorId).catch(() => null);
    if (executor && executor.bannable) {
      await executor.ban({
        reason: 'Antinuke: 疑わしいWebhook作成/削除活動'
      });
      
      await createModerationCase(
        guild.id,
        executorId,
        guild.client.user.id,
        'auto_ban_webhook',
        'Antinuke: 疑わしいWebhook作成/削除活動を検出'
      );
    }
    
    return { success: true, deleted: true, banned: executor ? true : false };
  } catch (error) {
    console.error('Webhook処理エラー:', error);
    return { success: false, error: error.message };
  }
}

setInterval(cleanupTracker, 60000);

module.exports = {
  checkSuspiciousActivity,
  handleSuspiciousBot,
  handleSuspiciousWebhook,
  checkMassJoin,
  trackJoin
};
