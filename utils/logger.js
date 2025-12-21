const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../storage/fileStorage');

async function logModeration(guild, action) {
  try {
    const settings = await getGuildSettings(guild.id);
    
    if (!settings.log_channel_id || !settings.moderation_log_enabled) {
      return;
    }
    
    const logChannel = guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const colors = {
      'warn': 0xFFFF00,
      'mute': 0xFF9900,
      'kick': 0xFF6600,
      'ban': 0xFF0000,
      'unban': 0x00FF00,
      'quarantine': 0x800080,
      'unquarantine': 0x00FFFF,
      'auto_spam_delete': 0xFFCC00,
      'auto_ban_bot': 0xFF0000,
      'auto_ban_webhook': 0xFF0000,
      'auto_kick': 0xFF6600,
      'auto_quarantine': 0x9900FF,
      'lockdown': 0x000000,
      'unlock_lockdown': 0xFFFFFF
    };
    
    const actionNames = {
      'warn': '⚠️ 警告',
      'mute': '🔇 ミュート',
      'kick': '👢 キック',
      'ban': '🔨 BAN',
      'unban': '✅ BAN解除',
      'quarantine': '🔒 隔離',
      'unquarantine': '🔓 隔離解除',
      'auto_spam_delete': '🤖 自動スパム削除',
      'auto_ban_bot': '🤖 自動Bot BAN',
      'auto_ban_webhook': '🔗 自動Webhook BAN',
      'auto_kick': '🤖 自動キック',
      'auto_quarantine': '🤖 自動隔離',
      'lockdown': '🔒 ロックダウン',
      'unlock_lockdown': '🔓 ロックダウン解除'
    };
    
    const embed = new EmbedBuilder()
      .setTitle(actionNames[action.type] || action.type)
      .setColor(colors[action.type] || 0x0099FF)
      .addFields([
        { name: 'ユーザー', value: `<@${action.userId}>`, inline: true },
        { name: 'モデレーター', value: `<@${action.moderatorId}>`, inline: true },
        { name: '理由', value: action.reason || '理由なし', inline: false }
      ])
      .setTimestamp();
    
    if (action.caseNumber) {
      embed.addFields([{ name: 'ケース番号', value: `#${action.caseNumber}`, inline: true }]);
    }
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('ログ記録エラー:', error);
  }
}

async function logAction(guild, actionType, details) {
  try {
    const settings = await getGuildSettings(guild.id);
    
    if (!settings.log_channel_id) {
      return;
    }
    
    const logChannel = guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(details.title || actionType)
      .setDescription(details.description || '')
      .setColor(details.color || 0x0099FF)
      .setTimestamp();
    
    if (details.fields) {
      embed.addFields(details.fields);
    }
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('ログ記録エラー:', error);
  }
}

async function logMessageDelete(message) {
  try {
    const settings = await getGuildSettings(message.guild.id);
    
    if (!settings.message_log_enabled || !settings.log_channel_id) {
      return;
    }
    
    const logChannel = message.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🗑️ メッセージ削除')
      .setColor(0xFF0000)
      .addFields([
        { name: '作成者', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: 'チャンネル', value: `<#${message.channel.id}>`, inline: true },
        { name: 'メッセージID', value: message.id, inline: true }
      ])
      .setTimestamp();
    
    if (message.content) {
      embed.addFields([
        { name: '内容', value: message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content, inline: false }
      ]);
    }
    
    if (message.attachments.size > 0) {
      const attachmentList = message.attachments.map(a => `[${a.name}](${a.url})`).join('\n');
      embed.addFields([
        { name: '添付ファイル', value: attachmentList.substring(0, 1024), inline: false }
      ]);
    }
    
    if (message.embeds.length > 0) {
      embed.addFields([
        { name: 'Embed', value: `${message.embeds.length}個のEmbedが含まれていました`, inline: false }
      ]);
    }
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('メッセージ削除ログエラー:', error);
  }
}

async function logMessageUpdate(oldMessage, newMessage) {
  try {
    if (oldMessage.content === newMessage.content) {
      return;
    }
    
    const settings = await getGuildSettings(newMessage.guild.id);
    
    if (!settings.message_log_enabled || !settings.log_channel_id) {
      return;
    }
    
    const logChannel = newMessage.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('✏️ メッセージ編集')
      .setColor(0xFFA500)
      .addFields([
        { name: '作成者', value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true },
        { name: 'チャンネル', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'メッセージID', value: newMessage.id, inline: true }
      ])
      .setTimestamp();
    
    if (oldMessage.content) {
      embed.addFields([
        { name: '編集前', value: oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1021) + '...' : oldMessage.content, inline: false }
      ]);
    }
    
    if (newMessage.content) {
      embed.addFields([
        { name: '編集後', value: newMessage.content.length > 1024 ? newMessage.content.substring(0, 1021) + '...' : newMessage.content, inline: false }
      ]);
    }
    
    embed.addFields([
      { name: 'リンク', value: `[メッセージへ移動](${newMessage.url})`, inline: false }
    ]);
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('メッセージ編集ログエラー:', error);
  }
}

async function logMemberJoin(member) {
  try {
    const settings = await getGuildSettings(member.guild.id);
    
    if (!settings.log_channel_id || !settings.member_log_enabled) {
      return;
    }
    
    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    
    const embed = new EmbedBuilder()
      .setTitle('📥 メンバー参加')
      .setColor(0x00FF00)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields([
        { name: 'ユーザー', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'ユーザーID', value: member.id, inline: true },
        { name: 'アカウント作成日', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'アカウント年齢', value: `${accountAge}日`, inline: true },
        { name: '現在のメンバー数', value: `${member.guild.memberCount}人`, inline: true }
      ])
      .setTimestamp()
      .setFooter({ text: `Member ID: ${member.id}` });
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('メンバー参加ログエラー:', error);
  }
}

async function logMemberLeave(member) {
  try {
    const settings = await getGuildSettings(member.guild.id);
    
    if (!settings.log_channel_id || !settings.member_log_enabled) {
      return;
    }
    
    const logChannel = member.guild.channels.cache.get(settings.log_channel_id);
    if (!logChannel) {
      return;
    }
    
    const joinedAt = member.joinedTimestamp 
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` 
      : '不明';
    
    const embed = new EmbedBuilder()
      .setTitle('📤 メンバー退出')
      .setColor(0xFF0000)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields([
        { name: 'ユーザー', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'ユーザーID', value: member.id, inline: true },
        { name: '参加日時', value: joinedAt, inline: true },
        { name: '現在のメンバー数', value: `${member.guild.memberCount}人`, inline: true }
      ])
      .setTimestamp()
      .setFooter({ text: `Member ID: ${member.id}` });
    
    if (member.roles && member.roles.cache.size > 1) {
      const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.name)
        .join(', ');
      if (roles) {
        embed.addFields([{ name: '所持していたロール', value: roles, inline: false }]);
      }
    }
    
    await logChannel.send({ embeds: [embed] });
    
  } catch (error) {
    console.error('メンバー退出ログエラー:', error);
  }
}

module.exports = {
  logModeration,
  logAction,
  logMessageDelete,
  logMessageUpdate,
  logMemberJoin,
  logMemberLeave
};
