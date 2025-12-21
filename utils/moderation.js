const { createModerationCase, addWarning, getWarningCount } = require('../storage/fileStorage');
const { logModeration } = require('./logger');

async function warnUser(guild, userId, moderatorId, reason) {
  try {
    const member = await guild.members.fetch(userId);
    
    await addWarning(guild.id, userId, moderatorId, reason);
    const count = await getWarningCount(guild.id, userId);
    
    const caseData = await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'warn',
      reason
    );
    
    await logModeration(guild, {
      type: 'warn',
      userId: userId,
      moderatorId: moderatorId,
      reason: reason || '理由なし',
      caseNumber: caseData?.caseNumber
    });
    
    try {
      await member.send(
        `⚠️ **警告を受けました** - ${guild.name}\n\n` +
        `理由: ${reason}\n` +
        `警告数: ${count}回`
      );
    } catch (e) {
      console.log('DMを送信できませんでした');
    }
    
    return { success: true, warningCount: count };
  } catch (error) {
    console.error('警告エラー:', error);
    return { success: false, error: error.message };
  }
}

async function muteUser(guild, userId, moderatorId, reason, duration) {
  try {
    const member = await guild.members.fetch(userId);
    
    const timeout = duration ? Date.now() + duration : null;
    await member.timeout(duration, reason);
    
    const caseData = await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'mute',
      reason,
      timeout
    );
    
    await logModeration(guild, {
      type: 'mute',
      userId: userId,
      moderatorId: moderatorId,
      reason: reason || '理由なし',
      caseNumber: caseData?.caseNumber
    });
    
    return { success: true, duration };
  } catch (error) {
    console.error('ミュートエラー:', error);
    return { success: false, error: error.message };
  }
}

async function kickUser(guild, userId, moderatorId, reason) {
  try {
    const member = await guild.members.fetch(userId);
    
    try {
      await member.send(
        `👢 **キックされました** - ${guild.name}\n\n` +
        `理由: ${reason}`
      );
    } catch (e) {}
    
    await member.kick(reason);
    
    const caseData = await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'kick',
      reason
    );
    
    await logModeration(guild, {
      type: 'kick',
      userId: userId,
      moderatorId: moderatorId,
      reason: reason || '理由なし',
      caseNumber: caseData?.caseNumber
    });
    
    return { success: true };
  } catch (error) {
    console.error('キックエラー:', error);
    return { success: false, error: error.message };
  }
}

async function banUser(guild, userId, moderatorId, reason, deleteMessageDays = 1) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (member) {
      try {
        await member.send(
          `🔨 **BANされました** - ${guild.name}\n\n` +
          `理由: ${reason}`
        );
      } catch (e) {}
    }
    
    await guild.bans.create(userId, {
      reason,
      deleteMessageDays
    });
    
    const caseData = await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'ban',
      reason
    );
    
    await logModeration(guild, {
      type: 'ban',
      userId: userId,
      moderatorId: moderatorId,
      reason: reason || '理由なし',
      caseNumber: caseData?.caseNumber
    });
    
    return { success: true };
  } catch (error) {
    console.error('BANエラー:', error);
    return { success: false, error: error.message };
  }
}

async function unbanUser(guild, userId, moderatorId, reason) {
  try {
    await guild.bans.remove(userId, reason);
    
    const caseData = await createModerationCase(
      guild.id,
      userId,
      moderatorId,
      'unban',
      reason
    );
    
    await logModeration(guild, {
      type: 'unban',
      userId: userId,
      moderatorId: moderatorId,
      reason: reason || '理由なし',
      caseNumber: caseData?.caseNumber
    });
    
    return { success: true };
  } catch (error) {
    console.error('BAN解除エラー:', error);
    return { success: false, error: error.message };
  }
}

async function quarantineUser(guild, userId, quarantineRoleId) {
  try {
    const member = await guild.members.fetch(userId);
    
    const currentRoles = member.roles.cache.filter(r => r.id !== guild.id);
    await member.roles.remove(currentRoles);
    
    await member.roles.add(quarantineRoleId);
    
    return { success: true, removedRoles: currentRoles.map(r => r.id) };
  } catch (error) {
    console.error('隔離エラー:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  warnUser,
  muteUser,
  kickUser,
  banUser,
  unbanUser,
  quarantineUser
};
