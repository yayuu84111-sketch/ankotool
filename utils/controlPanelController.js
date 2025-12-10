const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { 
  createMainControlPanel, 
  createModerationPanel, 
  createMessageManagementPanel, 
  createHistoryPanel, 
  createServerManagementPanel,
  createWarnModal,
  createMuteModal,
  createKickModal,
  createBanModal,
  createUnbanModal,
  createQuarantineModal,
  createUnquarantineModal,
  createDeleteKeywordModal,
  createGetWarningsModal,
  createClearWarningsModal,
  createDeleteCaseModal,
  createBackupCreateModal,
  createBackupRestoreModal,
  createBackupDeleteModal,
  createSlowmodeModal,
  createServerConfigPanel,
  createRolePermissionsPanel,
  createRoleDetailPanel,
  createVerificationPanel,
  createVerificationChallengeModal,
  createVerificationConfigModal,
  createPublicVerificationPanel,
  createTicketPanel,
  createPublicTicketPanel,
  createTicketConfigModal,
  createTicketConfigAdvancedModal
} = require('./controlPanels');
const { createMainSettingsPanel } = require('./settingsPanel');
const { warnUser, muteUser, kickUser, banUser, unbanUser } = require('./moderation');
const { addQuarantine, removeQuarantine } = require('./quarantine');
const { getModerationCases, deleteModerationCase, getWarnings, clearWarnings, getVerificationSettings, updateVerificationSettings, getTicketSettings, updateTicketSettings, createTicketChannel, getTicketChannel, closeTicketChannel, getActiveTickets, getNextTicketNumber, getShopItems } = require('../storage/fileStorage');
const { backupServer, listBackups, restoreFromBackup, deleteBackup } = require('./backup');
const { getInventory, removeItemFromInventory } = require('./ankoDollar');

async function checkAdminPermission(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ 
      content: '❌ このコマンドを使用する権限がありません。（管理者権限が必要）', 
      flags: MessageFlags.Ephemeral 
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

async function handleControlPanelCommand(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  
  const panel = await createMainControlPanel(interaction.guild.id);
  await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
}

function extractUserId(userInput) {
  const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  if (/^\d+$/.test(userInput)) {
    return userInput;
  }
  return null;
}

const controlPanelButtonHandlers = {
  'panel_back': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createMainControlPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_moderation': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createModerationPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_messages': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createMessageManagementPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_history': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createHistoryPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_server': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createServerManagementPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_settings': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createMainSettingsPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_verification': async (interaction) => {
    const panel = await createVerificationPanel(interaction.guild.id);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'panel_help': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const helpEmbed = {
      embeds: [{
        title: '❓ ヘルプ - Bot コントロールパネル',
        description: 'このBotのすべての機能をパネルから操作できます',
        color: 0x3498DB,
        fields: [
          {
            name: '🛡️ モデレーション',
            value: '• **警告**: ユーザーに警告を与えます\n• **ミュート**: 一時的にユーザーをミュート\n• **キック**: ユーザーをサーバーから追放\n• **BAN**: ユーザーを永久追放\n• **UNBAN**: BANを解除\n• **隔離**: ユーザーを隔離状態に\n• **隔離解除**: 隔離を解除',
            inline: false
          },
          {
            name: '📝 メッセージ管理',
            value: '• **キーワード削除**: 特定のキーワードを含むメッセージを一括削除\n• チャンネル内またはサーバー全体から検索可能',
            inline: false
          },
          {
            name: '📊 履歴管理',
            value: '• **ケース一覧**: モデレーション履歴を表示\n• **警告履歴**: ユーザーの警告履歴を確認\n• **ケース削除**: 特定のケースを削除\n• **警告クリア**: ユーザーの警告をクリア',
            inline: false
          },
          {
            name: '🔧 サーバー管理',
            value: '• **バックアップ**: サーバー構成のバックアップ作成・復元\n• **ロック/解除**: チャンネルのロック管理\n• **スローモード**: チャンネルのスローモード設定\n• **ロックダウン**: サーバー全体をロックダウン\n• **サーバー設定**: Discord のセキュリティ設定変更',
            inline: false
          },
          {
            name: '✅ 足し算認証',
            value: '• **認証チャレンジ**: 簡単な足し算でユーザーにロールを付与\n• **テスト**: 足し算チャレンジを試すことができます\n• **設定**: 機能の有効/無効とロールの設定',
            inline: false
          },
          {
            name: '⚙️ Bot 設定',
            value: '• 自動モデレーション設定\n• スパム対策設定\n• コンテンツ管理（禁止用語、NSFW）\n• Antinuke 設定\n• その他の自動機能',
            inline: false
          },
          {
            name: '🤖 自動機能',
            value: '• スパム検知・自動削除\n• NSFW/リンクブロック\n• Join Raid 対策\n• 新規アカウント制限\n• Antinuke（Bot/Webhook保護）',
            inline: false
          }
        ],
        footer: { text: 'すべての操作は管理者権限が必要です' },
        timestamp: new Date().toISOString()
      }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: '◀️ メインメニュー',
              custom_id: 'panel_back'
            }
          ]
        }
      ]
    };
    
    await sendOrUpdatePanel(interaction, helpEmbed);
  },
  
  'verification_send_panel': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const settings = await getVerificationSettings(interaction.guild.id);
    
    if (!settings.enabled) {
      await interaction.reply({
        content: '❌ 足し算認証を有効にしてから送信してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (!settings.role_id) {
      await interaction.reply({
        content: '❌ 付与するロールを設定してから送信してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const publicPanel = createPublicVerificationPanel(settings);
    
    await interaction.channel.send(publicPanel);
    
    await interaction.reply({
      content: '✅ 認証パネルをこのチャンネルに送信しました。',
      flags: MessageFlags.Ephemeral
    });
  },
  
  'verification_start': async (interaction) => {
    const settings = await getVerificationSettings(interaction.guild.id);
    
    if (!settings.enabled) {
      await interaction.reply({
        content: '❌ 足し算認証は現在無効になっています。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (!settings.role_id) {
      await interaction.reply({
        content: '❌ 付与するロールが設定されていません。管理者に連絡してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const member = interaction.member;
    if (member.roles.cache.has(settings.role_id)) {
      await interaction.reply({
        content: '✅ あなたは既にこのロールを持っています。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const modal = createVerificationChallengeModal(num1, num2);
    await interaction.showModal(modal);
  },
  
  'verification_test': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const modal = createVerificationChallengeModal(num1, num2);
    await interaction.showModal(modal);
  },
  
  'verification_config': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createVerificationConfigModal();
    await interaction.showModal(modal);
  },
  
  'panel_ticket': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createTicketPanel(interaction.guild);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'ticket_send_panel': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const settings = await getTicketSettings(interaction.guild.id);
    
    if (!settings.enabled) {
      await interaction.reply({
        content: '❌ チケットシステムを有効にしてから送信してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const publicPanel = createPublicTicketPanel(settings);
    
    await interaction.channel.send(publicPanel);
    
    await interaction.reply({
      content: '✅ チケット作成パネルをこのチャンネルに送信しました。\n\n💡 チケットはこのチャンネルと同じカテゴリに作成されます。',
      flags: MessageFlags.Ephemeral
    });
  },
  
  'ticket_list': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const tickets = await getActiveTickets(interaction.guild.id);
    
    if (tickets.length === 0) {
      await interaction.reply({
        content: '📋 現在、アクティブなチケットはありません。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const ticketList = tickets.map((ticket, index) => {
      return `${index + 1}. <#${ticket.channel_id}> - <@${ticket.user_id}> (チケット#${ticket.ticket_number})`;
    }).join('\n');
    
    await interaction.reply({
      embeds: [{
        title: '📋 アクティブチケット一覧',
        description: ticketList,
        color: 0x9B59B6,
        footer: { text: `合計: ${tickets.length} 件` }
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'ticket_config': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getTicketSettings(interaction.guild.id);
    const modal = createTicketConfigModal(settings);
    await interaction.showModal(modal);
  },
  
  'ticket_config_advanced': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const settings = await getTicketSettings(interaction.guild.id);
    const modal = createTicketConfigAdvancedModal(settings);
    await interaction.showModal(modal);
  },
  
  'ticket_create': async (interaction) => {
    const settings = await getTicketSettings(interaction.guild.id);
    
    if (!settings.enabled) {
      await interaction.reply({
        content: '❌ チケットシステムは現在無効です。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    if (settings.is_paid && settings.required_item_id) {
      const inventory = await getInventory(interaction.user.id);
      const itemCount = inventory[settings.required_item_id] || 0;
      
      if (itemCount <= 0) {
        const shopItems = await getShopItems();
        const requiredItem = shopItems[settings.required_item_id];
        const itemName = requiredItem ? requiredItem.name : settings.required_item_id;
        
        await interaction.reply({
          content: `❌ チケットを作成するには「${itemName}」が必要です。\n\nショップで購入してください。（\`/ajack\` コマンドを使用）`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
    
    const activeTickets = await getActiveTickets(interaction.guild.id);
    const userHasTicket = activeTickets.find(t => t.user_id === interaction.user.id);
    
    if (userHasTicket) {
      await interaction.reply({
        content: '❌ あなたは既にチケットを開いています: <#' + userHasTicket.channel_id + '>',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const buttonChannel = interaction.channel;
    const category = buttonChannel.parent;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const ticketNumber = await getNextTicketNumber(interaction.guild.id);
      const channelName = `ticket-${ticketNumber}`;
      
      const permissionOverwrites = [
        {
          id: interaction.guild.id,
          deny: ['ViewChannel']
        },
        {
          id: interaction.user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        },
        {
          id: interaction.client.user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
        }
      ];
      
      if (settings.staff_role_id) {
        permissionOverwrites.push({
          id: settings.staff_role_id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
      }
      
      const { ChannelType } = require('discord.js');
      
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category ? category.id : null,
        permissionOverwrites: permissionOverwrites
      });
      
      await createTicketChannel(interaction.guild.id, ticketChannel.id, interaction.user.id, ticketNumber);
      
      if (settings.is_paid && settings.required_item_id) {
        await removeItemFromInventory(interaction.user.id, settings.required_item_id, 1);
      }
      
      const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
      
      const welcomeMessage = settings.welcome_message || 'こんにちは {user}さん！\n\nサポートスタッフがすぐに対応します。\n問題を詳しく説明してください。';
      const formattedWelcomeMessage = welcomeMessage.replace('{user}', `<@${interaction.user.id}>`);
      
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 チケット #${ticketNumber}`)
        .setDescription(formattedWelcomeMessage)
        .setColor(0x00FF00)
        .setTimestamp();
      
      const closeButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('🔒 チケットを閉じる')
            .setStyle(ButtonStyle.Danger)
        );
      
      await ticketChannel.send({
        content: `<@${interaction.user.id}>${settings.staff_role_id ? ` <@&${settings.staff_role_id}>` : ''}`,
        embeds: [welcomeEmbed],
        components: [closeButton]
      });
      
      let confirmMessage = `✅ チケットを作成しました: ${ticketChannel}`;
      if (settings.is_paid && settings.required_item_id) {
        const shopItems = await getShopItems();
        const requiredItem = shopItems[settings.required_item_id];
        const itemName = requiredItem ? requiredItem.name : settings.required_item_id;
        confirmMessage += `\n\n💰 「${itemName}」を1つ消費しました。`;
      }
      
      await interaction.editReply({
        content: confirmMessage
      });
    } catch (error) {
      console.error('チケット作成エラー:', error);
      await interaction.editReply({
        content: '❌ チケットの作成に失敗しました。管理者に連絡してください。'
      });
    }
  },
  
  'ticket_close': async (interaction) => {
    const ticket = await getTicketChannel(interaction.guild.id, interaction.channel.id);
    
    if (!ticket) {
      await interaction.reply({
        content: '❌ このチャンネルはチケットではありません。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const isOwner = ticket.user_id === interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = await getTicketSettings(interaction.guild.id);
    const hasStaffRole = settings.staff_role_id && interaction.member.roles.cache.has(settings.staff_role_id);
    
    if (!isOwner && !isAdmin && !hasStaffRole) {
      await interaction.reply({
        content: '❌ このチケットを閉じる権限がありません。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    await interaction.reply({
      content: `🔒 このチケットは <@${interaction.user.id}> によって閉じられました。\n5秒後にチャンネルを削除します...`
    });
    
    await closeTicketChannel(interaction.guild.id, interaction.channel.id);
    
    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (error) {
        console.error('チケットチャンネル削除エラー:', error);
      }
    }, 5000);
  },
  
  'mod_warn': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createWarnModal();
    await interaction.showModal(modal);
  },
  
  'mod_mute': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createMuteModal();
    await interaction.showModal(modal);
  },
  
  'mod_kick': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createKickModal();
    await interaction.showModal(modal);
  },
  
  'mod_ban': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createBanModal();
    await interaction.showModal(modal);
  },
  
  'mod_unban': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createUnbanModal();
    await interaction.showModal(modal);
  },
  
  'mod_quarantine': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createQuarantineModal();
    await interaction.showModal(modal);
  },
  
  'mod_unquarantine': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createUnquarantineModal();
    await interaction.showModal(modal);
  },
  
  'msg_delete_keyword': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createDeleteKeywordModal();
    await interaction.showModal(modal);
  },
  
  'history_cases': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const cases = await getModerationCases(interaction.guild.id);
    const limit = 10;
    const recentCases = cases.slice(-limit).reverse();
    
    if (recentCases.length === 0) {
      await interaction.reply({
        content: '📋 モデレーション履歴はまだありません。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const caseList = recentCases.map(c => 
      `**ケース #${c.case_number}** - ${c.action}\n` +
      `対象: <@${c.user_id}> | 実行者: <@${c.moderator_id}>\n` +
      `理由: ${c.reason || 'なし'} | 日時: <t:${Math.floor(new Date(c.timestamp).getTime() / 1000)}:R>`
    ).join('\n\n');
    
    await interaction.reply({
      embeds: [{
        title: '📋 モデレーション履歴',
        description: `直近 ${recentCases.length} 件のケース（合計: ${cases.length} 件）\n\n${caseList}`,
        color: 0x9B59B6,
        footer: { text: `合計 ${cases.length} 件のケース` },
        timestamp: new Date().toISOString()
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'history_warnings': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createGetWarningsModal();
    await interaction.showModal(modal);
  },
  
  'history_delete_case': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createDeleteCaseModal();
    await interaction.showModal(modal);
  },
  
  'history_clear_warnings': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createClearWarningsModal();
    await interaction.showModal(modal);
  },
  
  'server_backup_create': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createBackupCreateModal();
    await interaction.showModal(modal);
  },
  
  'server_backup_list': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const result = await listBackups(interaction.guild.id, 10, false);
    
    if (!result.success) {
      await interaction.editReply({
        content: `❌ バックアップ一覧の取得に失敗しました。\nエラー: ${result.error}`
      });
      return;
    }
    
    if (!result.backups || result.backups.length === 0) {
      await interaction.editReply({
        content: '📋 このサーバーのバックアップはまだ作成されていません。\n\n💡 ヒント: 他のサーバーのバックアップを復元する場合は、「♻️ バックアップ復元」ボタンから直接バックアップIDを入力してください。'
      });
      return;
    }
    
    const backupList = result.backups.map((b, i) => 
      `${i + 1}. **${b.backup_name}**\n` +
      `   🆔 ID: \`${b.id}\`\n` +
      `   📅 作成日時: <t:${Math.floor(new Date(b.created_at).getTime() / 1000)}:R>\n` +
      `   📊 ロール: ${b.roles_data?.length || 0}個、チャンネル: ${b.channels_data?.length || 0}個、メッセージ: ${b.messages_data?.length || 0}件`
    ).join('\n\n');
    
    await interaction.editReply({
      content: `📋 **このサーバーのバックアップ一覧**\n\n${backupList}\n\n💡 ヒント: 他のサーバーのバックアップを復元する場合は、「♻️ バックアップ復元」ボタンから直接バックアップIDを入力してください。`
    });
  },
  
  'server_backup_restore': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createBackupRestoreModal();
    await interaction.showModal(modal);
  },
  
  'server_backup_delete': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createBackupDeleteModal();
    await interaction.showModal(modal);
  },
  
  'server_lock': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });
      
      await interaction.reply({
        content: `🔒 ${interaction.channel} をロックしました。`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('チャンネルロックエラー:', error);
      await interaction.reply({
        content: '❌ チャンネルのロックに失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'server_unlock': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null
      });
      
      await interaction.reply({
        content: `🔓 ${interaction.channel} のロックを解除しました。`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('チャンネルロック解除エラー:', error);
      await interaction.reply({
        content: '❌ チャンネルのロック解除に失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'server_slowmode': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const modal = createSlowmodeModal();
    await interaction.showModal(modal);
  },
  
  'server_lockdown': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
      let locked = 0;
      
      for (const [, channel] of channels) {
        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false
          });
          locked++;
        } catch (err) {
          console.error(`チャンネル ${channel.name} のロックエラー:`, err);
        }
      }
      
      await interaction.editReply({
        content: `🚨 サーバーをロックダウンしました。${locked}個のチャンネルをロックしました。`
      });
    } catch (error) {
      console.error('ロックダウンエラー:', error);
      await interaction.editReply({
        content: '❌ ロックダウンに失敗しました。'
      });
    }
  },
  
  'server_config': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = createServerConfigPanel();
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'server_role_permissions': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    const panel = await createRolePermissionsPanel(interaction.guild);
    await sendOrUpdatePanel(interaction, panel);
  },
  
  'server_config_view': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const guild = interaction.guild;
    const verificationLevels = {
      0: '検証なし',
      1: '低（メール認証）',
      2: '中（登録5分以上）',
      3: '高（メンバー10分以上）',
      4: '最高（電話認証）'
    };
    
    const contentFilterLevels = {
      0: 'フィルターなし',
      1: 'ロールなしをスキャン',
      2: '全メンバーをスキャン'
    };
    
    const notificationLevels = {
      0: '全メッセージ通知',
      1: 'メンションのみ通知'
    };
    
    await interaction.reply({
      embeds: [{
        title: '🛡️ 現在のサーバーセキュリティ設定',
        fields: [
          { name: '検証レベル', value: verificationLevels[guild.verificationLevel] || '不明', inline: true },
          { name: 'コンテンツフィルター', value: contentFilterLevels[guild.explicitContentFilter] || '不明', inline: true },
          { name: 'デフォルト通知', value: notificationLevels[guild.defaultMessageNotifications] || '不明', inline: true }
        ],
        color: 0x5865F2,
        timestamp: new Date().toISOString()
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'server_config_verification': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.reply({
      content: '🔐 検証レベルを選択してください:',
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: 'select_verification_level',
          placeholder: '検証レベルを選択',
          options: [
            { label: '検証なし', value: '0', description: '制限なし' },
            { label: '低（メール認証）', value: '1', description: 'Discord登録時にメール認証が必要' },
            { label: '中（登録5分以上）', value: '2', description: 'Discord登録から5分以上経過' },
            { label: '高（メンバー10分以上）', value: '3', description: 'サーバー参加から10分以上経過' },
            { label: '最高（電話認証）', value: '4', description: '電話番号認証が必要' }
          ]
        }]
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'server_config_filter': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.reply({
      content: '🔞 コンテンツフィルターを選択してください:',
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: 'select_content_filter',
          placeholder: 'コンテンツフィルターを選択',
          options: [
            { label: 'フィルターなし', value: '0', description: 'スキャンしない' },
            { label: 'ロールなしをスキャン', value: '1', description: 'ロールのないメンバーのみ' },
            { label: '全メンバーをスキャン', value: '2', description: 'すべてのメンバー' }
          ]
        }]
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'server_config_notifications': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.reply({
      content: '🔔 デフォルト通知設定を選択してください:',
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: 'select_notification_level',
          placeholder: '通知設定を選択',
          options: [
            { label: '全メッセージ通知', value: '0', description: 'すべてのメッセージで通知' },
            { label: 'メンションのみ通知', value: '1', description: 'メンション時のみ通知' }
          ]
        }]
      }],
      flags: MessageFlags.Ephemeral
    });
  }
};

const controlPanelSelectHandlers = {
  'select_verification_level': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const level = parseInt(interaction.values[0]);
    
    try {
      await interaction.guild.setVerificationLevel(level);
      
      const levelNames = ['検証なし', '低（メール認証）', '中（登録5分以上）', '高（メンバー10分以上）', '最高（電話認証）'];
      
      await interaction.update({
        content: `✅ 検証レベルを「${levelNames[level]}」に変更しました。`,
        components: []
      });
    } catch (error) {
      console.error('検証レベル変更エラー:', error);
      await interaction.update({
        content: '❌ 検証レベルの変更に失敗しました。',
        components: []
      });
    }
  },
  
  'select_content_filter': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const level = parseInt(interaction.values[0]);
    
    try {
      await interaction.guild.setExplicitContentFilter(level);
      
      const levelNames = ['フィルターなし', 'ロールなしをスキャン', '全メンバーをスキャン'];
      
      await interaction.update({
        content: `✅ コンテンツフィルターを「${levelNames[level]}」に変更しました。`,
        components: []
      });
    } catch (error) {
      console.error('コンテンツフィルター変更エラー:', error);
      await interaction.update({
        content: '❌ コンテンツフィルターの変更に失敗しました。',
        components: []
      });
    }
  },
  
  'select_notification_level': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const level = parseInt(interaction.values[0]);
    
    try {
      await interaction.guild.setDefaultMessageNotifications(level);
      
      const levelNames = ['全メッセージ通知', 'メンションのみ通知'];
      
      await interaction.update({
        content: `✅ デフォルト通知設定を「${levelNames[level]}」に変更しました。`,
        components: []
      });
    } catch (error) {
      console.error('通知設定変更エラー:', error);
      await interaction.update({
        content: '❌ 通知設定の変更に失敗しました。',
        components: []
      });
    }
  },
  
  'role_permissions_select': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const roleId = interaction.values[0];
    const panel = await createRoleDetailPanel(interaction.guild, roleId);
    await sendOrUpdatePanel(interaction, panel);
  }
};

const controlPanelModalHandlers = {
  'modal_warn': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await warnUser(interaction.guild, member, interaction.user, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('警告エラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、警告に失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_mute': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const durationInput = interaction.fields.getTextInputValue('duration');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const duration = durationInput ? parseInt(durationInput) : 60;
    if (isNaN(duration) || duration <= 0) {
      await interaction.reply({
        content: '❌ 無効な時間です。正の整数を入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await muteUser(interaction.guild, member, interaction.user, duration, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('ミュートエラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、ミュートに失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_kick': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await kickUser(interaction.guild, member, interaction.user, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('キックエラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、キックに失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_ban': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await banUser(interaction.guild, member, interaction.user, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('BANエラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、BANに失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_unban': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーIDです。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const result = await unbanUser(interaction.guild, userId, interaction.user, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('UNBAN エラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、UNBANに失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_quarantine': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const durationInput = interaction.fields.getTextInputValue('duration');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const duration = durationInput ? parseInt(durationInput) : 60;
    if (isNaN(duration) || duration <= 0) {
      await interaction.reply({
        content: '❌ 無効な時間です。正の整数を入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await addQuarantine(interaction.guild, member, interaction.user, duration, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('隔離エラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、隔離に失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_unquarantine': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason') || '理由なし';
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      const member = await interaction.guild.members.fetch(userId);
      const result = await removeQuarantine(interaction.guild, member, interaction.user, reason);
      
      await interaction.reply({
        content: result,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('隔離解除エラー:', error);
      await interaction.reply({
        content: '❌ ユーザーが見つからないか、隔離解除に失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_delete_keyword': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const keyword = interaction.fields.getTextInputValue('keyword');
    const limitInput = interaction.fields.getTextInputValue('limit');
    const serverWideInput = interaction.fields.getTextInputValue('server_wide');
    
    const limit = limitInput ? parseInt(limitInput) : 1000;
    const serverWide = serverWideInput?.toLowerCase() === 'yes';
    
    if (isNaN(limit) || limit <= 0 || limit > 50000) {
      await interaction.editReply({
        content: '❌ 無効な件数です。1〜50000の範囲で入力してください。'
      });
      return;
    }
    
    const deleteMessagesWithThrottle = async (messages) => {
      const messagesArray = Array.from(messages.values());
      let deleted = 0;
      let failed = 0;
      
      for (let i = 0; i < messagesArray.length; i += 3) {
        const batch = messagesArray.slice(i, i + 3);
        const results = await Promise.allSettled(
          batch.map(msg => msg.delete())
        );
        
        results.forEach(r => {
          if (r.status === 'fulfilled') deleted++;
          else failed++;
        });
        
        if (i + 3 < messagesArray.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      if (failed > 0) {
        console.warn(`メッセージ削除: ${deleted}件成功, ${failed}件失敗`);
      }
      
      return deleted;
    };
    
    try {
      let deletedCount = 0;
      
      if (serverWide) {
        const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
        
        for (const [, channel] of channels) {
          try {
            let lastId;
            let remaining = limit - deletedCount;
            
            while (remaining > 0 && deletedCount < limit) {
              const fetchOptions = { limit: Math.min(100, remaining) };
              if (lastId) fetchOptions.before = lastId;
              
              const messages = await channel.messages.fetch(fetchOptions);
              if (messages.size === 0) break;
              
              const toDelete = messages.filter(msg => 
                msg.content.toLowerCase().includes(keyword.toLowerCase())
              );
              
              if (toDelete.size > 0) {
                const deleted = await deleteMessagesWithThrottle(toDelete);
                deletedCount += deleted;
              }
              
              lastId = messages.last().id;
              remaining = limit - deletedCount;
              
              if (messages.size < 100) break;
            }
          } catch (err) {
            console.error(`チャンネル ${channel.name} のエラー:`, err);
          }
        }
      } else {
        let lastId;
        let remaining = limit;
        
        while (remaining > 0 && deletedCount < limit) {
          const fetchOptions = { limit: Math.min(100, remaining) };
          if (lastId) fetchOptions.before = lastId;
          
          const messages = await interaction.channel.messages.fetch(fetchOptions);
          if (messages.size === 0) break;
          
          const toDelete = messages.filter(msg => 
            msg.content.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (toDelete.size > 0) {
            const deleted = await deleteMessagesWithThrottle(toDelete);
            deletedCount += deleted;
          }
          
          lastId = messages.last().id;
          remaining = limit - deletedCount;
          
          if (messages.size < 100) break;
        }
      }
      
      await interaction.editReply({
        content: `✅ キーワード「${keyword}」を含む ${deletedCount} 件のメッセージを削除しました。`
      });
    } catch (error) {
      console.error('メッセージ削除エラー:', error);
      await interaction.editReply({
        content: '❌ メッセージの削除に失敗しました。'
      });
    }
  },
  
  'modal_get_warnings': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const warnings = await getWarnings(interaction.guild.id, userId);
    
    if (warnings.length === 0) {
      await interaction.reply({
        content: `<@${userId}> の警告履歴はありません。`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const warningList = warnings.map((w, i) => 
      `${i + 1}. ${w.reason || '理由なし'}\n` +
      `   実行者: <@${w.moderator_id}> | 日時: <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>`
    ).join('\n\n');
    
    await interaction.reply({
      embeds: [{
        title: `⚠️ <@${userId}> の警告履歴`,
        description: `合計 ${warnings.length} 件の警告\n\n${warningList}`,
        color: 0xFF6B6B,
        timestamp: new Date().toISOString()
      }],
      flags: MessageFlags.Ephemeral
    });
  },
  
  'modal_clear_warnings': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const userInput = interaction.fields.getTextInputValue('user');
    
    const userId = extractUserId(userInput);
    if (!userId) {
      await interaction.reply({
        content: '❌ 無効なユーザーです。@メンションまたはユーザーIDを入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    await clearWarnings(interaction.guild.id, userId);
    
    await interaction.reply({
      content: `✅ <@${userId}> の警告履歴をクリアしました。`,
      flags: MessageFlags.Ephemeral
    });
  },
  
  'modal_delete_case': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const caseNumberInput = interaction.fields.getTextInputValue('case_number');
    const caseNumber = parseInt(caseNumberInput);
    
    if (isNaN(caseNumber) || caseNumber <= 0) {
      await interaction.reply({
        content: '❌ 無効なケース番号です。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    const result = await deleteModerationCase(interaction.guild.id, caseNumber);
    
    if (result) {
      await interaction.reply({
        content: `✅ ケース #${caseNumber} を削除しました。`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: `❌ ケース #${caseNumber} が見つかりませんでした。`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
  
  'modal_backup_create': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const name = interaction.fields.getTextInputValue('name');
    const messageLimitInput = interaction.fields.getTextInputValue('message_limit');
    
    let messageLimit = Infinity;
    if (messageLimitInput && messageLimitInput.trim() !== '') {
      const parsed = parseInt(messageLimitInput);
      if (!isNaN(parsed) && parsed > 0) {
        messageLimit = parsed;
      } else {
        await interaction.editReply({
          content: '❌ メッセージ数は1以上の数値を指定してください。'
        });
        return;
      }
    }
    
    const result = await backupServer(interaction.guild, name, interaction.user.id, messageLimit);
    
    if (result.success) {
      const limitText = messageLimit === Infinity ? '無制限' : `${messageLimit}件まで`;
      const emojiCount = result.backup.emojis_data ? result.backup.emojis_data.length : 0;
      await interaction.editReply({
        content: `✅ バックアップを作成しました。\n📦 バックアップ名: ${name}\n🆔 バックアップID: ${result.backup.id}\n💬 メッセージ: ${result.messageCount}件（チャンネル毎: ${limitText}）\n😀 絵文字: ${emojiCount}個`
      });
    } else {
      await interaction.editReply({
        content: `❌ バックアップの作成に失敗しました。\nエラー: ${result.error}`
      });
    }
  },
  
  'modal_backup_restore': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const backupId = interaction.fields.getTextInputValue('backup_id');
    
    const progressCallback = async (status) => {
      try {
        await interaction.editReply({ content: `🔄 復元中: ${status}` });
      } catch (err) {
        console.warn('進捗更新エラー:', err.message);
      }
    };
    
    const result = await restoreFromBackup(interaction.guild, backupId, progressCallback);
    
    if (result.success) {
      let message = `✅ バックアップから復元しました。\n`;
      message += `📦 バックアップ名: ${result.backupName}\n`;
      message += `🏠 元のサーバー: ${result.backupGuildName}\n\n`;
      message += `🔄 ロール作成: ${result.rolesCreated}個\n`;
      message += `🔄 チャンネル作成: ${result.channelsCreated}個\n`;
      message += `🗑️ ロール削除: ${result.rolesDeleted}個\n`;
      message += `🗑️ チャンネル削除: ${result.channelsDeleted}個`;
      
      if (result.emojisCreated) {
        message += `\n😀 絵文字復元: ${result.emojisCreated}個`;
      }
      
      if (result.messagesRestored) {
        message += `\n💬 メッセージ復元: ${result.messagesRestored}件`;
      }
      
      if (result.errors && result.errors.length > 0) {
        message += `\n\n⚠️ エラー:\n${result.errors.slice(0, 5).join('\n')}`;
        if (result.errors.length > 5) {
          message += `\n...他 ${result.errors.length - 5}件のエラー`;
        }
      }
      
      await interaction.editReply({ content: message });
    } else {
      await interaction.editReply({
        content: `❌ バックアップの復元に失敗しました。\nエラー: ${result.error}`
      });
    }
  },
  
  'modal_backup_delete': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const backupId = interaction.fields.getTextInputValue('backup_id');
    
    const result = await deleteBackup(interaction.guild.id, backupId);
    
    if (result.success) {
      await interaction.editReply({
        content: `✅ バックアップを削除しました。\n\n` +
                 `🗑️ 削除したバックアップ:\n` +
                 `   名前: ${result.deletedBackup.name}\n` +
                 `   ID: ${result.deletedBackup.id}\n` +
                 `   作成日時: <t:${Math.floor(new Date(result.deletedBackup.createdAt).getTime() / 1000)}:R>`
      });
    } else {
      await interaction.editReply({
        content: `❌ バックアップの削除に失敗しました。\nエラー: ${result.error}`
      });
    }
  },
  
  'modal_slowmode': async (interaction) => {
    if (!await checkAdminPermission(interaction)) return;
    
    const secondsInput = interaction.fields.getTextInputValue('seconds');
    const seconds = parseInt(secondsInput);
    
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      await interaction.reply({
        content: '❌ 無効な秒数です。0〜21600の範囲で入力してください。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      
      if (seconds === 0) {
        await interaction.reply({
          content: `✅ ${interaction.channel} のスローモードを解除しました。`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `✅ ${interaction.channel} のスローモードを ${seconds} 秒に設定しました。`,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error('スローモード設定エラー:', error);
      await interaction.reply({
        content: '❌ スローモードの設定に失敗しました。',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

async function handleVerificationChallengeSubmit(interaction) {
  const customId = interaction.customId;
  const match = customId.match(/^modal_verification_(\d+)_(\d+)$/);
  
  if (!match) {
    await interaction.reply({
      content: '❌ エラーが発生しました。',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  const num1 = parseInt(match[1]);
  const num2 = parseInt(match[2]);
  const correctAnswer = num1 + num2;
  
  const userAnswer = interaction.fields.getTextInputValue('answer');
  const userAnswerNum = parseInt(userAnswer);
  
  if (userAnswerNum === correctAnswer) {
    const settings = await getVerificationSettings(interaction.guild.id);
    
    if (settings.enabled && settings.role_id) {
      try {
        const role = interaction.guild.roles.cache.get(settings.role_id);
        if (!role) {
          await interaction.reply({
            content: '✅ 正解です！しかし、指定されたロールが見つかりませんでした。',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const botMember = await interaction.guild.members.fetchMe();
        const botTopRole = botMember.roles.highest;

        console.log('=== ロール付与デバッグ情報 ===');
        console.log(`対象ロール: ${role.name} (ID: ${role.id}, 位置: ${role.position})`);
        console.log(`Botの最上位ロール: ${botTopRole.name} (ID: ${botTopRole.id}, 位置: ${botTopRole.position})`);
        console.log(`Bot権限 - MANAGE_ROLES: ${botMember.permissions.has('ManageRoles')}`);
        console.log(`ロール編集可能: ${role.editable}`);
        console.log(`ロール位置比較: Bot(${botTopRole.position}) > 対象(${role.position}) = ${botTopRole.position > role.position}`);

        if (!botMember.permissions.has('ManageRoles')) {
          await interaction.reply({
            content: '✅ 正解です！しかし、Botに「ロールを管理」権限がありません。サーバー設定を確認してください。',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        if (!role.editable) {
          await interaction.reply({
            content: `✅ 正解です！しかし、Botのロール（位置: ${botTopRole.position}）が対象ロール「${role.name}」（位置: ${role.position}）より下位のため、ロールを付与できません。\n\nサーバー設定でBotのロールを「${role.name}」より上に移動してください。`,
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.member.roles.add(role);
        await interaction.reply({
          content: `✅ 正解です！ロール <@&${settings.role_id}> を付与しました。`,
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        console.error('ロール付与エラー:', error);
        console.error('エラー詳細:', {
          code: error.code,
          message: error.message,
          status: error.status
        });
        await interaction.reply({
          content: `✅ 正解です！しかし、ロールの付与に失敗しました。\nエラー: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    } else {
      await interaction.reply({
        content: '✅ 正解です！（テストモード：ロールは設定されていません）',
        flags: MessageFlags.Ephemeral
      });
    }
  } else {
    await interaction.reply({
      content: `❌ 不正解です。正解は ${correctAnswer} でした。`,
      flags: MessageFlags.Ephemeral
    });
  }
}

async function handleVerificationConfigSubmit(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  
  const enabledInput = interaction.fields.getTextInputValue('enabled').toLowerCase();
  const roleIdInput = interaction.fields.getTextInputValue('role_id');
  
  const enabled = enabledInput === 'yes' || enabledInput === 'はい';
  
  const settings = {
    enabled: enabled
  };
  
  if (roleIdInput && roleIdInput.trim() !== '') {
    let roleId = roleIdInput.trim();
    roleId = roleId.replace(/<@&(\d+)>/, '$1');
    roleId = roleId.replace(/[<@&>]/g, '');
    settings.role_id = roleId;
  }
  
  await updateVerificationSettings(interaction.guild.id, settings);
  
  await interaction.reply({
    content: `✅ 足し算認証の設定を更新しました。\n有効: ${enabled ? 'はい' : 'いいえ'}\nロールID: ${settings.role_id || '未設定'}`,
    flags: MessageFlags.Ephemeral
  });
}

controlPanelModalHandlers['modal_verification_config'] = handleVerificationConfigSubmit;

async function handleTicketConfigSubmit(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  
  const enabledInput = interaction.fields.getTextInputValue('enabled').toLowerCase();
  const staffRoleIdInput = interaction.fields.getTextInputValue('staff_role_id');
  
  const enabled = enabledInput === 'yes' || enabledInput === 'はい';
  
  const settings = {
    enabled: enabled
  };
  
  if (staffRoleIdInput && staffRoleIdInput.trim() !== '') {
    let staffRoleId = staffRoleIdInput.trim();
    staffRoleId = staffRoleId.replace(/<@&(\d+)>/, '$1');
    staffRoleId = staffRoleId.replace(/[<@&>]/g, '');
    
    const role = interaction.guild.roles.cache.get(staffRoleId);
    if (!role) {
      await interaction.reply({
        content: '❌ 指定されたスタッフロールが見つかりません。',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    settings.staff_role_id = staffRoleId;
  }
  
  await updateTicketSettings(interaction.guild.id, settings);
  
  await interaction.reply({
    content: `✅ チケットシステムの設定を更新しました。\n有効: ${enabled ? 'はい' : 'いいえ'}\nスタッフロール: ${settings.staff_role_id ? 'あり' : '管理者のみ'}`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleTicketConfigAdvancedSubmit(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  
  const isPaidInput = interaction.fields.getTextInputValue('is_paid').toLowerCase();
  const requiredItemIdInput = interaction.fields.getTextInputValue('required_item_id');
  const panelTitleInput = interaction.fields.getTextInputValue('panel_title');
  const panelDescInput = interaction.fields.getTextInputValue('panel_description');
  const welcomeMsgInput = interaction.fields.getTextInputValue('welcome_message');
  
  const isPaid = isPaidInput === 'yes' || isPaidInput === 'はい';
  
  const settings = {
    is_paid: isPaid
  };
  
  if (requiredItemIdInput && requiredItemIdInput.trim() !== '') {
    const { getShopItems } = require('../storage/fileStorage');
    const items = await getShopItems();
    const inputValue = requiredItemIdInput.trim();
    
    let itemId = inputValue;
    if (!items[inputValue]) {
      const foundItem = Object.entries(items).find(([id, item]) => {
        if (item.name === inputValue) return true;
        const nameWithoutLeadingEmoji = item.name.replace(/^[\p{Emoji}\s]+/u, '');
        return nameWithoutLeadingEmoji === inputValue;
      });
      
      if (foundItem) {
        itemId = foundItem[0];
      } else {
        await interaction.reply({
          content: `❌ 指定されたアイテムが見つかりません。\n入力値: **${inputValue}**\nアイテムIDまたはアイテム名（絵文字なし）を入力してください。`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }
    
    settings.required_item_id = itemId;
  } else {
    settings.required_item_id = null;
  }
  
  if (panelTitleInput && panelTitleInput.trim() !== '') {
    settings.panel_title = panelTitleInput.trim();
  }
  
  if (panelDescInput && panelDescInput.trim() !== '') {
    settings.panel_description = panelDescInput.trim();
  }
  
  if (welcomeMsgInput && welcomeMsgInput.trim() !== '') {
    settings.welcome_message = welcomeMsgInput.trim();
  }
  
  await updateTicketSettings(interaction.guild.id, settings);
  
  await interaction.reply({
    content: '✅ チケット詳細設定を更新しました。',
    flags: MessageFlags.Ephemeral
  });
}

controlPanelModalHandlers['modal_ticket_config'] = handleTicketConfigSubmit;
controlPanelModalHandlers['modal_ticket_config_advanced'] = handleTicketConfigAdvancedSubmit;

module.exports = {
  handleControlPanelCommand,
  controlPanelButtonHandlers,
  controlPanelSelectHandlers,
  controlPanelModalHandlers,
  handleVerificationChallengeSubmit
};
