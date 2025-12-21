const { getGuildSettings, createModerationCase } = require('../storage/fileStorage');

async function checkNewUser(member) {
  const settings = await getGuildSettings(member.guild.id);
  
  if (!settings.join_raid_protection) {
    return { restricted: false };
  }
  
  const accountAge = Date.now() - member.user.createdTimestamp;
  const minAgeMs = settings.min_account_age * 24 * 60 * 60 * 1000;
  
  if (accountAge < minAgeMs) {
    return {
      restricted: true,
      reason: 'アカウントが新しすぎます',
      accountAgeDays: Math.floor(accountAge / (24 * 60 * 60 * 1000)),
      requiredDays: settings.min_account_age
    };
  }
  
  return { restricted: false };
}

async function handleNewUserJoin(member) {
  const settings = await getGuildSettings(member.guild.id);
  
  const newUserCheck = await checkNewUser(member);
  
  if (newUserCheck.restricted) {
    if (settings.quarantine_role_id) {
      try {
        const quarantineRole = member.guild.roles.cache.get(settings.quarantine_role_id);
        if (quarantineRole) {
          await member.roles.add(quarantineRole);
          
          await createModerationCase(
            member.guild.id,
            member.id,
            member.client.user.id,
            'auto_quarantine',
            `新規アカウント制限: アカウント年齢${newUserCheck.accountAgeDays}日 (必要: ${newUserCheck.requiredDays}日)`
          );
          
          if (settings.log_channel_id) {
            const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
            if (logChannel) {
              await logChannel.send(
                `⚠️ **新規ユーザー自動隔離**\n` +
                `ユーザー: <@${member.id}> (${member.user.tag})\n` +
                `理由: ${newUserCheck.reason}\n` +
                `アカウント年齢: ${newUserCheck.accountAgeDays}日 / 必要: ${newUserCheck.requiredDays}日`
              );
            }
          }
          
          try {
            await member.send(
              `⚠️ **${member.guild.name}へようこそ**\n\n` +
              `あなたのアカウントは新規のため、一時的に制限されています。\n` +
              `アカウント年齢: ${newUserCheck.accountAgeDays}日\n` +
              `必要な年齢: ${newUserCheck.requiredDays}日\n\n` +
              `モデレーターが確認した後、制限が解除される場合があります。`
            );
          } catch (e) {
            console.log('DMを送信できませんでした');
          }
          
          return { quarantined: true };
        }
      } catch (error) {
        console.error('隔離ロール付与エラー:', error);
      }
    } else {
      try {
        await member.kick(`新規アカウント制限: アカウント年齢${newUserCheck.accountAgeDays}日`);
        
        await createModerationCase(
          member.guild.id,
          member.id,
          member.client.user.id,
          'auto_kick',
          `新規アカウント制限: アカウント年齢${newUserCheck.accountAgeDays}日 (必要: ${newUserCheck.requiredDays}日)`
        );
        
        if (settings.log_channel_id) {
          const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
          if (logChannel) {
            await logChannel.send(
              `🚫 **新規ユーザー自動キック**\n` +
              `ユーザー: ${member.user.tag} (${member.id})\n` +
              `理由: ${newUserCheck.reason}\n` +
              `アカウント年齢: ${newUserCheck.accountAgeDays}日 / 必要: ${newUserCheck.requiredDays}日`
            );
          }
        }
        
        return { kicked: true };
      } catch (error) {
        console.error('新規ユーザーキックエラー:', error);
      }
    }
  }
  
  if (settings.auto_verify_enabled && settings.verified_role_id && !newUserCheck.restricted) {
    try {
      const verifiedRole = member.guild.roles.cache.get(settings.verified_role_id);
      if (verifiedRole) {
        await member.roles.add(verifiedRole);
        
        if (settings.log_channel_id) {
          const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
          if (logChannel) {
            await logChannel.send(
              `✅ **認証ロール自動付与**\n` +
              `ユーザー: <@${member.id}> (${member.user.tag})`
            );
          }
        }
      }
    } catch (error) {
      console.error('認証ロール付与エラー:', error);
    }
  }
  
  return { success: true };
}

module.exports = {
  checkNewUser,
  handleNewUserJoin
};
