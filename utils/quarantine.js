const { getGuildSettings, createModerationCase } = require('../storage/fileStorage');

async function addQuarantine(guild, userId, moderatorId, reason, duration = null) {
  try {
    const settings = await getGuildSettings(guild.id);
    
    if (!settings.quarantine_role_id) {
      return { success: false, error: '隔離ロールが設定されていません' };
    }
    
    const member = await guild.members.fetch(userId);
    const quarantineRole = guild.roles.cache.get(settings.quarantine_role_id);
    
    if (!quarantineRole) {
      return { success: false, error: '隔離ロールが見つかりません' };
    }
    
    await member.roles.add(quarantineRole);
    
    await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'quarantine',
      reason
    );
    
    if (settings.log_channel_id) {
      const logChannel = guild.channels.cache.get(settings.log_channel_id);
      if (logChannel) {
        await logChannel.send(
          `🔒 **ユーザー隔離**\n` +
          `ユーザー: <@${userId}>\n` +
          `モデレーター: <@${moderatorId}>\n` +
          `理由: ${reason}` +
          (duration ? `\n自動解除: ${duration}分後` : '')
        );
      }
    }
    
    try {
      await member.send(
        `🔒 **隔離されました** - ${guild.name}\n\n` +
        `理由: ${reason}\n` +
        (duration ? `期間: ${duration}分\n\n` : '') +
        `隔離中は制限されたチャンネルのみ閲覧できます。`
      );
    } catch (e) {
      console.log('DMを送信できませんでした');
    }
    
    if (duration) {
      setTimeout(async () => {
        try {
          await removeQuarantine(guild, userId, guild.client.user.id, '自動解除（期間満了）');
        } catch (error) {
          console.error('自動解除エラー:', error);
        }
      }, duration * 60 * 1000);
    }
    
    return { success: true, duration };
  } catch (error) {
    console.error('隔離エラー:', error);
    return { success: false, error: error.message };
  }
}

async function removeQuarantine(guild, userId, moderatorId, reason = '解除') {
  try {
    const settings = await getGuildSettings(guild.id);
    
    if (!settings.quarantine_role_id) {
      return { success: false, error: '隔離ロールが設定されていません' };
    }
    
    const member = await guild.members.fetch(userId);
    const quarantineRole = guild.roles.cache.get(settings.quarantine_role_id);
    
    if (!quarantineRole) {
      return { success: false, error: '隔離ロールが見つかりません' };
    }
    
    await member.roles.remove(quarantineRole);
    
    await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'unquarantine',
      reason
    );
    
    if (settings.log_channel_id) {
      const logChannel = guild.channels.cache.get(settings.log_channel_id);
      if (logChannel) {
        await logChannel.send(
          `🔓 **隔離解除**\n` +
          `ユーザー: <@${userId}>\n` +
          `モデレーター: <@${moderatorId}>\n` +
          `理由: ${reason}`
        );
      }
    }
    
    try {
      await member.send(
        `🔓 **隔離が解除されました** - ${guild.name}\n\n` +
        `理由: ${reason}\n` +
        `通常通りサーバーを利用できます。`
      );
    } catch (e) {
      console.log('DMを送信できませんでした');
    }
    
    return { success: true };
  } catch (error) {
    console.error('隔離解除エラー:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  addQuarantine,
  removeQuarantine
};
