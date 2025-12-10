const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

async function ensureBackupsDir() {
  try {
    await fs.access(BACKUPS_DIR);
  } catch {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
  }
}

async function backupServer(guild, backupName, createdBy, messageLimit = Infinity) {
  try {
    await ensureBackupsDir();
    
    const existingBackups = await listBackups(guild.id, 10000);
    if (existingBackups.success && existingBackups.backups.length > 0) {
      const duplicate = existingBackups.backups.find(b => 
        b.backup_name.toLowerCase() === backupName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: 'この名前のバックアップは既に存在します。別の名前を使用してください。' };
      }
    }
    
    const rolesData = guild.roles.cache.map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
      mentionable: role.mentionable,
      hoist: role.hoist
    }));
    
    const messagesData = [];
    const messageErrors = [];
    const textChannels = guild.channels.cache.filter(ch => ch.isTextBased() && ch.type !== 12);
    
    console.log(`バックアップ: ${textChannels.size}個のテキストチャンネルから全メッセージを取得中...`);
    
    for (const [channelId, channel] of textChannels) {
      try {
        console.log(`  チャンネル "${channel.name}" から全メッセージを取得中...`);
        
        const viewPermission = channel.permissionsFor(guild.members.me)?.has('ViewChannel');
        const readPermission = channel.permissionsFor(guild.members.me)?.has('ReadMessageHistory');
        
        if (!viewPermission || !readPermission) {
          const missingPerms = [];
          if (!viewPermission) missingPerms.push('ViewChannel');
          if (!readPermission) missingPerms.push('ReadMessageHistory');
          console.warn(`  ⚠️ チャンネル "${channel.name}": 権限不足 (${missingPerms.join(', ')})`);
          messageErrors.push({
            channel: channel.name,
            error: `権限不足: ${missingPerms.join(', ')}`
          });
          continue;
        }
        
        let allMessages = [];
        let lastId;
        let totalFetched = 0;
        
        while (totalFetched < messageLimit) {
          const options = { limit: Math.min(100, messageLimit - totalFetched) };
          if (lastId) {
            options.before = lastId;
          }
          
          const messages = await channel.messages.fetch(options);
          
          if (messages.size === 0) break;
          
          allMessages.push(...messages.values());
          totalFetched += messages.size;
          lastId = messages.last().id;
          
          console.log(`    ${totalFetched}件取得済み...`);
          
          if (messages.size < 100) break;
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (allMessages.length === 0) {
          console.log(`  チャンネル "${channel.name}": メッセージなし`);
        } else {
          const channelMessages = allMessages.map(msg => ({
            channel_id: channelId,
            channel_name: channel.name,
            content: msg.content,
            author_username: msg.author.username,
            author_id: msg.author.id,
            author_avatar: msg.author.displayAvatarURL({ dynamic: true, size: 128 }),
            timestamp: msg.createdTimestamp,
            embeds: msg.embeds.map(e => e.toJSON()),
            attachments: msg.attachments.map(a => ({ url: a.url, name: a.name }))
          })).reverse();
          messagesData.push(...channelMessages);
          console.log(`  ✓ チャンネル "${channel.name}": ${allMessages.length}件のメッセージを取得`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        console.error(`  ❌ メッセージ取得エラー (${channel.name}):`, err.message);
        messageErrors.push({
          channel: channel.name,
          error: err.message
        });
      }
    }
    
    console.log(`バックアップ: 合計 ${messagesData.length} 件のメッセージを取得しました`);
    if (messageErrors.length > 0) {
      console.warn(`バックアップ: ${messageErrors.length} 個のチャンネルでエラーが発生しました`);
    }
    
    const channelsData = guild.channels.cache.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
      parentId: channel.parentId,
      permissionOverwrites: channel.permissionOverwrites?.cache.map(po => ({
        id: po.id,
        type: po.type,
        allow: po.allow.bitfield.toString(),
        deny: po.deny.bitfield.toString()
      })) || [],
      topic: channel.topic || null,
      nsfw: channel.nsfw || false,
      rateLimitPerUser: channel.rateLimitPerUser || 0
    }));
    
    const emojisData = [];
    console.log(`バックアップ: ${guild.emojis.cache.size}個の絵文字をダウンロード中...`);
    for (const [emojiId, emoji] of guild.emojis.cache) {
      try {
        const response = await axios.get(emoji.url, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');
        const contentType = response.headers['content-type'] || (emoji.animated ? 'image/gif' : 'image/png');
        emojisData.push({
          id: emoji.id,
          name: emoji.name,
          animated: emoji.animated,
          image: base64Image,
          contentType: contentType,
          roles: emoji.roles?.cache.map(r => r.id) || []
        });
        console.log(`  ✓ 絵文字 "${emoji.name}" をダウンロード (${contentType})`);
      } catch (err) {
        console.warn(`  ⚠️ 絵文字 "${emoji.name}" のダウンロード失敗: ${err.message}`);
      }
    }
    console.log(`バックアップ: ${emojisData.length}個の絵文字を取得しました`);
    
    const guildIconURL = guild.iconURL({ dynamic: true, size: 256 });
    console.log(`バックアップ作成: サーバーアイコンURL = ${guildIconURL || 'null (アイコンなし)'}`);
    
    const backup = {
      id: Date.now().toString(),
      guild_id: guild.id,
      guild_name: guild.name,
      guild_icon: guildIconURL,
      guild_description: guild.description,
      backup_name: backupName,
      message_limit: messageLimit,
      roles_data: rolesData,
      channels_data: channelsData,
      emojis_data: emojisData,
      messages_data: messagesData,
      message_errors: messageErrors,
      created_by: createdBy,
      created_at: new Date().toISOString()
    };
    
    const filename = `${guild.id}_${backup.id}.json`;
    await fs.writeFile(
      path.join(BACKUPS_DIR, filename),
      JSON.stringify(backup, null, 2)
    );
    
    return { 
      success: true, 
      backup, 
      messageCount: messagesData.length,
      channelCount: textChannels.size,
      errorCount: messageErrors.length,
      errors: messageErrors.length > 0 ? messageErrors : null
    };
  } catch (error) {
    console.error('バックアップ作成エラー:', error);
    return { success: false, error: error.message };
  }
}

async function listBackups(guildId, limit = 10, showAllServers = false) {
  try {
    await ensureBackupsDir();
    
    const files = await fs.readdir(BACKUPS_DIR);
    const guildBackups = showAllServers 
      ? files.filter(f => f.endsWith('.json'))
      : files.filter(f => f.startsWith(`${guildId}_`) && f.endsWith('.json'));
    
    const backups = [];
    for (const file of guildBackups) {
      try {
        const content = await fs.readFile(path.join(BACKUPS_DIR, file), 'utf-8');
        backups.push(JSON.parse(content));
      } catch (err) {
        console.error(`バックアップファイル読み込みエラー (${file}):`, err);
      }
    }
    
    backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return { success: true, backups: backups.slice(0, limit) };
  } catch (error) {
    console.error('バックアップ取得エラー:', error);
    return { success: false, error: error.message };
  }
}

async function restoreFromBackup(guild, backupIdOrName, progressCallback) {
  try {
    await ensureBackupsDir();
    
    let backup;
    let filePath;
    
    const filenameById = `${guild.id}_${backupIdOrName}.json`;
    const filePathById = path.join(BACKUPS_DIR, filenameById);
    
    try {
      const content = await fs.readFile(filePathById, 'utf-8');
      backup = JSON.parse(content);
      filePath = filePathById;
    } catch (err) {
      const allBackups = await listBackups(guild.id, 100, true);
      if (allBackups.success && allBackups.backups.length > 0) {
        const matchedBackup = allBackups.backups.find(b => 
          b.backup_name.toLowerCase() === backupIdOrName.toLowerCase() ||
          b.id === backupIdOrName
        );
        
        if (matchedBackup) {
          const matchedFilePath = path.join(BACKUPS_DIR, `${matchedBackup.guild_id}_${matchedBackup.id}.json`);
          const content = await fs.readFile(matchedFilePath, 'utf-8');
          backup = JSON.parse(content);
          filePath = matchedFilePath;
        }
      }
      
      if (!backup) {
        return { success: false, error: 'バックアップが見つかりません。IDまたは名前を確認してください。' };
      }
    }
    
    if (backup.guild_icon) {
      try {
        const response = await axios.get(backup.guild_icon, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        await guild.setIcon(buffer);
        console.log('サーバーアイコンを復元しました');
      } catch (err) {
        console.warn('サーバーアイコン復元エラー:', err.message);
      }
    }
    
    if (backup.guild_name && backup.guild_name !== guild.name) {
      try {
        await guild.setName(backup.guild_name);
        console.log(`サーバー名を復元しました: ${backup.guild_name}`);
      } catch (err) {
        console.warn('サーバー名復元エラー:', err.message);
      }
    }
    
    const errors = [];
    let rolesCreated = 0;
    let channelsCreated = 0;
    let channelsDeleted = 0;
    let rolesDeleted = 0;
    const roleIdMap = {};
    
    console.log('既存のチャンネルを削除中...');
    const channelsToDelete = guild.channels.cache.filter(ch => ch.deletable);
    for (const [id, channel] of channelsToDelete) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        await channel.delete('バックアップ復元のため既存チャンネルを削除');
        channelsDeleted++;
      } catch (err) {
        errors.push(`チャンネル削除失敗 (${channel.name}): ${err.message}`);
      }
    }
    console.log(`${channelsDeleted}個のチャンネルを削除しました`);
    
    console.log('既存のロールを削除中...');
    const rolesToDelete = guild.roles.cache.filter(role => 
      role.name !== '@everyone' && 
      !role.managed && 
      role.deletable
    );
    for (const [id, role] of rolesToDelete) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        await role.delete('バックアップ復元のため既存ロールを削除');
        rolesDeleted++;
      } catch (err) {
        errors.push(`ロール削除失敗 (${role.name}): ${err.message}`);
      }
    }
    console.log(`${rolesDeleted}個のロールを削除しました`);
    
    const rolesData = backup.roles_data.sort((a, b) => b.position - a.position);
    
    for (const roleData of rolesData) {
      if (roleData.name === '@everyone') {
        roleIdMap[roleData.id] = guild.roles.everyone.id;
        continue;
      }
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const newRole = await guild.roles.create({
          name: roleData.name,
          color: roleData.color || 0,
          permissions: roleData.permissions,
          hoist: roleData.hoist,
          mentionable: roleData.mentionable,
          reason: 'バックアップからの復元'
        });
        
        roleIdMap[roleData.id] = newRole.id;
        rolesCreated++;
      } catch (err) {
        errors.push(`ロール作成失敗 (${roleData.name}): ${err.message}`);
      }
    }
    
    if (progressCallback) {
      await progressCallback('ロール作成完了、チャンネルを作成中...');
    }
    
    const channelIdMap = {};
    
    const categories = backup.channels_data
      .filter(c => c.type === 4)
      .sort((a, b) => a.position - b.position);
    const otherChannels = backup.channels_data
      .filter(c => c.type !== 4)
      .sort((a, b) => a.position - b.position);
    
    for (const channelData of categories) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const permissionOverwrites = channelData.permissionOverwrites?.map(po => ({
          id: roleIdMap[po.id] || po.id,
          type: po.type,
          allow: po.allow,
          deny: po.deny
        })).filter(po => guild.roles.cache.has(po.id) || guild.members.cache.has(po.id)) || [];
        
        const newChannel = await guild.channels.create({
          name: channelData.name,
          type: channelData.type,
          position: channelData.position,
          permissionOverwrites: permissionOverwrites,
          reason: 'バックアップからの復元'
        });
        
        channelIdMap[channelData.id] = newChannel.id;
        channelsCreated++;
      } catch (err) {
        errors.push(`カテゴリ作成失敗 (${channelData.name}): ${err.message}`);
      }
    }
    
    for (const channelData of otherChannels) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const permissionOverwrites = channelData.permissionOverwrites?.map(po => ({
          id: roleIdMap[po.id] || po.id,
          type: po.type,
          allow: po.allow,
          deny: po.deny
        })).filter(po => guild.roles.cache.has(po.id) || guild.members.cache.has(po.id)) || [];
        
        const createOptions = {
          name: channelData.name,
          type: channelData.type,
          position: channelData.position,
          permissionOverwrites: permissionOverwrites,
          reason: 'バックアップからの復元'
        };
        
        if (channelData.parentId && channelIdMap[channelData.parentId]) {
          createOptions.parent = channelIdMap[channelData.parentId];
        }
        
        if (channelData.topic) {
          createOptions.topic = channelData.topic;
        }
        
        if (channelData.nsfw !== undefined) {
          createOptions.nsfw = channelData.nsfw;
        }
        
        if (channelData.rateLimitPerUser) {
          createOptions.rateLimitPerUser = channelData.rateLimitPerUser;
        }
        
        const newChannel = await guild.channels.create(createOptions);
        channelIdMap[channelData.id] = newChannel.id;
        channelsCreated++;
      } catch (err) {
        errors.push(`チャンネル作成失敗 (${channelData.name}): ${err.message}`);
      }
    }
    
    if (progressCallback) {
      await progressCallback('チャンネル作成完了、絵文字を復元中...');
    }
    
    let emojisCreated = 0;
    if (backup.emojis_data && backup.emojis_data.length > 0) {
      console.log('既存の絵文字IDを記録中...');
      const existingEmojiIds = new Set(guild.emojis.cache.map(e => e.id));
      
      console.log('絵文字を復元中...');
      const createdEmojis = [];
      
      for (const emojiData of backup.emojis_data) {
        try {
          let imageBuffer;
          let extension = 'png';
          
          if (emojiData.image) {
            imageBuffer = Buffer.from(emojiData.image, 'base64');
            if (emojiData.contentType) {
              if (emojiData.contentType.includes('gif')) {
                extension = 'gif';
              } else if (emojiData.contentType.includes('png')) {
                extension = 'png';
              } else if (emojiData.contentType.includes('jpeg') || emojiData.contentType.includes('jpg')) {
                extension = 'jpg';
              }
            } else if (emojiData.animated) {
              extension = 'gif';
            }
          } else if (emojiData.url) {
            try {
              const response = await axios.get(emojiData.url, { responseType: 'arraybuffer' });
              imageBuffer = Buffer.from(response.data);
              const contentType = response.headers['content-type'];
              if (contentType?.includes('gif')) {
                extension = 'gif';
              }
            } catch (downloadErr) {
              console.warn(`絵文字URLのダウンロード失敗 (${emojiData.name}): ${downloadErr.message}`);
              errors.push(`絵文字作成失敗 (${emojiData.name}): URLダウンロードエラー`);
              continue;
            }
          } else {
            console.warn(`絵文字データが不完全 (${emojiData.name}): imageもurlも存在しません`);
            errors.push(`絵文字作成失敗 (${emojiData.name}): データ不完全`);
            continue;
          }
          
          const emojiCreateOptions = {
            name: emojiData.name,
            attachment: {
              name: `${emojiData.name}.${extension}`,
              attachment: imageBuffer
            },
            reason: 'バックアップからの復元'
          };
          
          if (emojiData.roles && emojiData.roles.length > 0) {
            const mappedRoles = emojiData.roles
              .map(oldId => roleIdMap[oldId])
              .filter(newId => newId && guild.roles.cache.has(newId));
            if (mappedRoles.length > 0) {
              emojiCreateOptions.roles = mappedRoles;
            }
          }
          
          const createdEmoji = await guild.emojis.create(emojiCreateOptions);
          createdEmojis.push(createdEmoji.id);
          emojisCreated++;
          console.log(`✓ 絵文字 "${emojiData.name}" を復元 (.${extension})`);
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          errors.push(`絵文字作成失敗 (${emojiData.name}): ${err.message}`);
          console.warn(`絵文字作成失敗 (${emojiData.name}):`, err.message);
        }
      }
      
      if (createdEmojis.length > 0) {
        console.log('既存の絵文字を削除中（新しい絵文字作成後）...');
        await guild.emojis.fetch();
        const emojisToDelete = guild.emojis.cache.filter(emoji => 
          emoji.deletable && 
          existingEmojiIds.has(emoji.id) && 
          !createdEmojis.includes(emoji.id)
        );
        for (const [id, emoji] of emojisToDelete) {
          try {
            await emoji.delete('バックアップ復元のため既存絵文字を削除');
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.warn(`絵文字削除失敗 (${emoji.name}): ${err.message}`);
          }
        }
      }
    }
    
    if (progressCallback) {
      await progressCallback('絵文字復元完了、メッセージを復元中...');
    }
    
    let messagesRestored = 0;
    if (backup.messages_data && backup.messages_data.length > 0) {
      const messagesByChannel = {};
      backup.messages_data.forEach(msg => {
        if (!messagesByChannel[msg.channel_id]) {
          messagesByChannel[msg.channel_id] = [];
        }
        messagesByChannel[msg.channel_id].push(msg);
      });
      
      const totalMessages = backup.messages_data.length;
      let processedMessages = 0;
      const progressLock = { value: 0 };
      
      const channelRestoreTasks = Object.entries(messagesByChannel).map(async ([oldChannelId, messages]) => {
        const newChannelId = channelIdMap[oldChannelId];
        if (!newChannelId) {
          processedMessages += messages.length;
          return 0;
        }
        
        const channel = guild.channels.cache.get(newChannelId);
        if (!channel || !channel.isTextBased()) {
          processedMessages += messages.length;
          return 0;
        }
        
        let webhook = null;
        try {
          const webhooks = await channel.fetchWebhooks();
          webhook = webhooks.find(wh => wh.name === 'Backup Restore');
          
          if (!webhook) {
            webhook = await channel.createWebhook({
              name: 'Backup Restore',
              reason: 'メッセージ復元用'
            });
          }
        } catch (err) {
          console.warn(`Webhook作成エラー (${channel.name}):`, err.message);
          processedMessages += messages.length;
          return 0;
        }
        
        let channelMessagesRestored = 0;
        
        for (const msgData of messages) {
          const payload = {
            content: msgData.content || (msgData.attachments && msgData.attachments.length > 0 ? `[添付ファイル: ${msgData.attachments.map(a => a.name).join(', ')}]` : null),
            username: msgData.author_username,
            embeds: msgData.embeds || [],
            allowedMentions: { parse: [] }
          };
          
          if (msgData.author_avatar) {
            payload.avatarURL = msgData.author_avatar;
          }
          
          if (msgData.attachments && msgData.attachments.length > 0) {
            const attachmentLinks = msgData.attachments.map(a => a.url).join('\n');
            if (payload.content) {
              payload.content += `\n${attachmentLinks}`;
            } else {
              payload.content = attachmentLinks;
            }
          }
          
          try {
            await webhook.send(payload);
            channelMessagesRestored++;
            
            progressLock.value++;
            if (progressLock.value % 50 === 0 && progressCallback) {
              await progressCallback(`メッセージ復元中... (${progressLock.value}/${totalMessages})`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            if (err.code === 429) {
              const retryAfter = err.retry_after || 1;
              console.warn(`レート制限: ${retryAfter}秒待機 (チャンネル: ${channel.name})`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              try {
                await webhook.send(payload);
                channelMessagesRestored++;
                progressLock.value++;
              } catch (retryErr) {
                console.warn(`メッセージ復元エラー (リトライ後):`, retryErr.message);
                progressLock.value++;
              }
            } else {
              console.warn(`メッセージ復元エラー:`, err.message);
              progressLock.value++;
            }
          }
        }
        
        return channelMessagesRestored;
      });
      
      const results = await Promise.all(channelRestoreTasks);
      messagesRestored = results.reduce((sum, count) => sum + count, 0);
    }
    
    return {
      success: true,
      rolesCreated,
      channelsCreated,
      rolesDeleted,
      channelsDeleted,
      emojisCreated,
      messagesRestored,
      backupName: backup.backup_name,
      backupGuildName: backup.guild_name,
      errors: errors.length > 0 ? errors : null
    };
  } catch (error) {
    console.error('バックアップ復元エラー:', error);
    return { success: false, error: error.message };
  }
}

async function deleteBackup(guildId, backupIdOrName) {
  try {
    await ensureBackupsDir();
    
    let filePath;
    
    const filenameById = `${guildId}_${backupIdOrName}.json`;
    const filePathById = path.join(BACKUPS_DIR, filenameById);
    
    try {
      await fs.access(filePathById);
      filePath = filePathById;
    } catch (err) {
      const allBackups = await listBackups(guildId, 100, false);
      if (allBackups.success && allBackups.backups.length > 0) {
        const matchedBackup = allBackups.backups.find(b => 
          b.backup_name.toLowerCase() === backupIdOrName.toLowerCase() ||
          b.id === backupIdOrName
        );
        
        if (matchedBackup) {
          filePath = path.join(BACKUPS_DIR, `${matchedBackup.guild_id}_${matchedBackup.id}.json`);
        }
      }
      
      if (!filePath) {
        return { success: false, error: 'バックアップが見つかりません。IDまたは名前を確認してください。' };
      }
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const backup = JSON.parse(content);
    
    if (backup.guild_id !== guildId) {
      return { success: false, error: 'このバックアップは別のサーバーのものです。削除できるのは自分のサーバーのバックアップのみです。' };
    }
    
    await fs.unlink(filePath);
    
    console.log(`バックアップを削除しました: ${backup.backup_name} (ID: ${backup.id})`);
    
    return { 
      success: true, 
      deletedBackup: {
        id: backup.id,
        name: backup.backup_name,
        createdAt: backup.created_at,
        guildName: backup.guild_name
      }
    };
  } catch (error) {
    console.error('バックアップ削除エラー:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  backupServer,
  listBackups,
  restoreFromBackup,
  deleteBackup
};
