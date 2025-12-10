const { PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { getGuildSettings, updateGuildSettings, getAntiSpamSettings, updateAntiSpamSettings, getBannedWords, addBannedWord, removeBannedWord } = require('../storage/fileStorage');
const { createMainSettingsPanel, createServerSettingsPanel, createSpamSettingsPanel, createContentSettingsPanel, createLogSettingsPanel, createSpamLimitsModal, createSetLogChannelModal, createAddBannedWordModal, createRemoveBannedWordModal } = require('./settingsPanel');

async function checkAdminPermission(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ 
      content: '❌ このコマンドを使用する権限がありません。（管理者権限が必要）', 
      ephemeral: true 
    });
    return false;
  }
  return true;
}

async function sendOrUpdatePanel(interaction, panelData) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(panelData);
  } else {
    await interaction.update(panelData);
  }
}

async function handleSettingsCommand(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  
  const panel = await createMainSettingsPanel(interaction.guild.id);
  await interaction.reply({ ...panel, ephemeral: true });
}

const buttonHandlers = {
  'settings_back': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createMainSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_refresh': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createMainSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_server': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_spam': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createSpamSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_content': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createContentSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_logs': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_auto_mod': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { auto_mod_enabled: !settings.auto_mod_enabled });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_antinuke': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { antinuke_enabled: !settings.antinuke_enabled });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_join_raid': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { join_raid_protection: !settings.join_raid_protection });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_webhook': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { webhook_protection: !settings.webhook_protection });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_auto_verify': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { auto_verify_enabled: !settings.auto_verify_enabled });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_app_commands': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { allow_application_commands: !settings.allow_application_commands });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_message_log': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { message_log_enabled: !settings.message_log_enabled });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_raid_mode': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    const newValue = !settings.raid_mode_enabled;
    await updateGuildSettings(interaction.guild.id, { raid_mode_enabled: newValue });
    
    if (settings.log_channel_id) {
      const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
      if (logChannel) {
        await logChannel.send(
          newValue 
            ? `🔒 **レイドモードが有効化されました**\n実行者: <@${interaction.user.id}>\n新規参加者は自動的にキックされ、一般メンバーのメッセージは削除されます。`
            : `🔓 **レイドモードが解除されました**\n実行者: <@${interaction.user.id}>`
        );
      }
    }
    
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_image_spam': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { image_spam_enabled: !settings.image_spam_enabled });
    const panel = await createServerSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'spam_edit_limits': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createSpamLimitsModal();
    await interaction.showModal(modal);
  },
  
  'toggle_timeout': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getAntiSpamSettings(interaction.guild.id);
    await updateAntiSpamSettings(interaction.guild.id, { timeout_enabled: !settings.timeout_enabled });
    const panel = await createSpamSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_random_detection': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getAntiSpamSettings(interaction.guild.id);
    await updateAntiSpamSettings(interaction.guild.id, { random_suffix_detection: !settings.random_suffix_detection });
    const panel = await createSpamSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_link_block': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getAntiSpamSettings(interaction.guild.id);
    await updateAntiSpamSettings(interaction.guild.id, { link_block_enabled: !settings.link_block_enabled });
    const panel = await createSpamSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_link_block_content': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getAntiSpamSettings(interaction.guild.id);
    await updateAntiSpamSettings(interaction.guild.id, { link_block_enabled: !settings.link_block_enabled });
    const panel = await createContentSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_nsfw_block': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getAntiSpamSettings(interaction.guild.id);
    await updateAntiSpamSettings(interaction.guild.id, { nsfw_block_enabled: !settings.nsfw_block_enabled });
    const panel = await createContentSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'banned_words_list': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const words = await getBannedWords(interaction.guild.id);
    
    if (words.length === 0) {
      await interaction.reply({ 
        content: '📋 禁止用語は登録されていません。\n「➕ 禁止用語追加」ボタンから追加できます。', 
        ephemeral: true 
      });
      return;
    }
    
    const chunks = [];
    for (let i = 0; i < words.length; i += 50) {
      chunks.push(words.slice(i, i + 50));
    }
    
    const firstChunk = chunks[0].map((w, i) => `${i + 1}. ${w}`).join('\n');
    await interaction.reply({ 
      content: `📋 **禁止用語一覧** (${words.length}件)\n\n${firstChunk}${chunks.length > 1 ? '\n\n...(続きは次のメッセージ)' : ''}`, 
      ephemeral: true 
    });
    
    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i].map((w, idx) => `${i * 50 + idx + 1}. ${w}`).join('\n');
      await interaction.followUp({ 
        content: chunk, 
        ephemeral: true 
      });
    }
  },
  
  'banned_words_add': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createAddBannedWordModal();
    await interaction.showModal(modal);
  },
  
  'banned_words_remove': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createRemoveBannedWordModal();
    await interaction.showModal(modal);
  },
  
  'set_log_channel': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createSetLogChannelModal();
    await interaction.showModal(modal);
  },
  
  'clear_log_channel': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    await updateGuildSettings(interaction.guild.id, { 
      log_channel_id: null,
      moderation_log_enabled: false,
      message_log_enabled: false,
      member_log_enabled: false,
      timeout_log_enabled: false
    });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, { 
      ...panel,
      content: '✅ ログチャンネルを解除しました。すべてのログ機能が無効化されました。'
    });
  },
  
  'toggle_moderation_log': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { moderation_log_enabled: !settings.moderation_log_enabled });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_message_log_panel': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { message_log_enabled: !settings.message_log_enabled });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_member_log': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { member_log_enabled: !settings.member_log_enabled });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'toggle_timeout_log': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getGuildSettings(interaction.guild.id);
    await updateGuildSettings(interaction.guild.id, { timeout_log_enabled: !settings.timeout_log_enabled });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'settings_broadcast_dm': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const modal = new ModalBuilder()
      .setCustomId('settings_broadcast_dm_modal')
      .setTitle('全員にDM送信');

    const messageInput = new TextInputBuilder()
      .setCustomId('dm_message')
      .setLabel('送信するメッセージ')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('サーバーの全メンバーに送信するメッセージを入力してください')
      .setMaxLength(2000)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

    await interaction.showModal(modal);
  }
};

const selectMenuHandlers = {
  'spam_preset': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const preset = interaction.values[0];
    
    const presets = {
      strict: {
        max_messages: 3,
        time_window: 5,
        max_mentions: 3,
        max_line_breaks: 5,
        max_message_length: 1000,
        duplicate_message_threshold: 2,
        timeout_enabled: true,
        timeout_duration: 10
      },
      moderate: {
        max_messages: 5,
        time_window: 5,
        max_mentions: 5,
        max_line_breaks: 10,
        max_message_length: 2000,
        duplicate_message_threshold: 3,
        timeout_enabled: true,
        timeout_duration: 5
      },
      lenient: {
        max_messages: 8,
        time_window: 5,
        max_mentions: 8,
        max_line_breaks: 15,
        max_message_length: 3000,
        duplicate_message_threshold: 5,
        timeout_enabled: true,
        timeout_duration: 3
      },
      default: {
        max_messages: 5,
        time_window: 5,
        max_mentions: 5,
        max_line_breaks: 10,
        max_message_length: 2000,
        duplicate_message_threshold: 3,
        link_block_enabled: false,
        nsfw_block_enabled: true,
        timeout_enabled: true,
        timeout_duration: 1,
        random_suffix_detection: true
      }
    };
    
    if (presets[preset]) {
      await updateAntiSpamSettings(interaction.guild.id, presets[preset]);
      const panel = await createSpamSettingsPanel(interaction.guild.id);
      await sendOrUpdatePanel(interaction, { 
        ...panel,
        content: `✅ スパム設定を「${preset === 'strict' ? '厳格' : preset === 'moderate' ? '中程度' : preset === 'lenient' ? '緩やか' : 'デフォルト'}」プリセットに変更しました。`
      });
    }
  }
};

const modalHandlers = {
  'spam_limits_modal': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const maxMessages = parseInt(interaction.fields.getTextInputValue('max_messages'));
    const timeWindow = parseInt(interaction.fields.getTextInputValue('time_window'));
    const maxMentions = parseInt(interaction.fields.getTextInputValue('max_mentions'));
    const maxLineBreaks = parseInt(interaction.fields.getTextInputValue('max_line_breaks'));
    const duplicateThreshold = parseInt(interaction.fields.getTextInputValue('duplicate_threshold'));
    
    if (isNaN(maxMessages) || isNaN(timeWindow) || isNaN(maxMentions) || 
        isNaN(maxLineBreaks) || isNaN(duplicateThreshold)) {
      await interaction.reply({ 
        content: '❌ 無効な値が入力されました。全て数値で入力してください。', 
        ephemeral: true 
      });
      return;
    }
    
    await updateAntiSpamSettings(interaction.guild.id, {
      max_messages: maxMessages,
      time_window: timeWindow,
      max_mentions: maxMentions,
      max_line_breaks: maxLineBreaks,
      duplicate_message_threshold: duplicateThreshold
    });
    
    const panel = await createSpamSettingsPanel(interaction.guild.id);
    await interaction.reply({ 
      ...panel, 
      content: '✅ スパム制限値を更新しました。',
      ephemeral: true 
    });
  },
  
  'add_banned_word_modal': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const word = interaction.fields.getTextInputValue('banned_word').trim();
    
    if (!word) {
      await interaction.reply({ 
        content: '❌ 禁止用語を入力してください。', 
        ephemeral: true 
      });
      return;
    }
    
    const result = await addBannedWord(interaction.guild.id, word);
    
    if (result) {
      const panel = await createContentSettingsPanel(interaction.guild.id);
      await interaction.reply({ 
        ...panel,
        content: `✅ 禁止用語を追加しました: ${word}`,
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `⚠️ この用語は既に登録されています: ${word}`, 
        ephemeral: true 
      });
    }
  },
  
  'remove_banned_word_modal': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const word = interaction.fields.getTextInputValue('banned_word').trim();
    
    if (!word) {
      await interaction.reply({ 
        content: '❌ 禁止用語を入力してください。', 
        ephemeral: true 
      });
      return;
    }
    
    const result = await removeBannedWord(interaction.guild.id, word);
    
    if (result) {
      const panel = await createContentSettingsPanel(interaction.guild.id);
      await interaction.reply({ 
        ...panel,
        content: `✅ 禁止用語を削除しました: ${word}`,
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: `❌ 禁止用語が見つかりません: ${word}`, 
        ephemeral: true 
      });
    }
  },
  
  'set_log_channel_modal': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const channelId = interaction.fields.getTextInputValue('log_channel_id').trim();
    
    if (!channelId) {
      await interaction.reply({ 
        content: '❌ チャンネルIDを入力してください。', 
        ephemeral: true 
      });
      return;
    }
    
    const channel = interaction.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await interaction.reply({ 
        content: '❌ チャンネルが見つかりません。正しいチャンネルIDを入力してください。', 
        ephemeral: true 
      });
      return;
    }
    
    if (channel.type !== ChannelType.GuildText) {
      await interaction.reply({ 
        content: '❌ テキストチャンネルを指定してください。', 
        ephemeral: true 
      });
      return;
    }
    
    await updateGuildSettings(interaction.guild.id, { log_channel_id: channelId });
    const panel = await createLogSettingsPanel(interaction.guild.id);
    await interaction.reply({ 
      ...panel,
      content: `✅ ログチャンネルを <#${channelId}> に設定しました。各ログを有効化できるようになりました。`,
      ephemeral: true 
    });
  },
  
  'settings_broadcast_dm_modal': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const message = interaction.fields.getTextInputValue('dm_message');

    try {
      await interaction.guild.members.fetch();
      
      const members = interaction.guild.members.cache.filter(member => !member.user.bot);
      const totalMembers = members.size;
      
      let successCount = 0;
      let failCount = 0;
      const failedUsers = [];
      const startTime = Date.now();
      let canUpdateInteraction = true;

      try {
        await interaction.editReply({
          content: `📢 DM送信を開始します...\n対象: ${totalMembers}人のメンバー`
        });
      } catch (err) {
        console.warn('初期メッセージ更新失敗:', err.message);
        canUpdateInteraction = false;
      }

      for (const [userId, member] of members) {
        try {
          await member.send(message);
          successCount++;
        } catch (err) {
          failCount++;
          failedUsers.push(member.user.tag);
          console.warn(`DM送信失敗: ${member.user.tag} - ${err.message}`);
        }
        
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        if (elapsedMinutes > 14) {
          canUpdateInteraction = false;
        }
        
        if (canUpdateInteraction && (successCount + failCount) % 10 === 0) {
          try {
            await interaction.editReply({
              content: `📢 DM送信中... (${successCount + failCount}/${totalMembers})\n✅ 成功: ${successCount} | ❌ 失敗: ${failCount}`
            });
          } catch (err) {
            console.warn('進捗更新失敗（インタラクションタイムアウト）:', err.message);
            canUpdateInteraction = false;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const embed = new EmbedBuilder()
        .setTitle('📢 DM送信完了')
        .setColor(successCount > 0 ? 0x00FF00 : 0xFF0000)
        .addFields(
          { name: '📊 送信結果', value: `✅ 成功: ${successCount}人\n❌ 失敗: ${failCount}人`, inline: false },
          { name: '📝 送信メッセージ', value: message.length > 100 ? message.substring(0, 100) + '...' : message, inline: false }
        )
        .setTimestamp();

      if (failedUsers.length > 0 && failedUsers.length <= 20) {
        embed.addFields({
          name: '❌ DM送信失敗ユーザー',
          value: failedUsers.slice(0, 20).join(', ')
        });
      }

      try {
        await interaction.editReply({
          content: null,
          embeds: [embed]
        });
      } catch (err) {
        console.error('最終メッセージ更新失敗:', err.message);
        try {
          await interaction.followUp({
            content: `✅ DM送信完了: ${successCount}人成功、${failCount}人失敗`,
            ephemeral: true
          });
        } catch (followUpErr) {
          console.error('フォローアップメッセージ送信失敗:', followUpErr.message);
        }
      }
    } catch (error) {
      console.error('DM送信エラー:', error);
      try {
        await interaction.editReply({
          content: '❌ DM送信処理中にエラーが発生しました。'
        });
      } catch (err) {
        console.error('エラーメッセージ更新失敗:', err.message);
      }
    }
  }
};

module.exports = {
  handleSettingsCommand,
  buttonHandlers,
  selectMenuHandlers,
  modalHandlers
};
