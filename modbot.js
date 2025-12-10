const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, AuditLogEvent, Events, REST, Routes, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const config = require('./config');

const { initializeStorage, getGuildSettings, getAntiSpamSettings, cleanOldSpamTrackers, updateGuildSettings, updateAntiSpamSettings, getModerationCases, deleteModerationCase, getWarnings, clearWarnings, getNSFWKeywords, addNSFWKeyword, removeNSFWKeyword, getBannedWords, addBannedWord, removeBannedWord, checkCommandSpam, getCommandSpamSettings, updateCommandSpamSettings, getTicketSettings, updateTicketSettings, createTicketChannel, getTicketChannel, closeTicketChannel, getActiveTickets, getNextTicketNumber, getAllowedUsers, addAllowedUser, removeAllowedUser } = require('./storage/fileStorage');
const { checkSpam, handleSpam, refreshNSFWCache } = require('./utils/antiSpam');
const { warnUser, muteUser, kickUser, banUser, unbanUser } = require('./utils/moderation');
const { checkSuspiciousActivity, handleSuspiciousBot, handleSuspiciousWebhook, checkMassJoin, trackJoin } = require('./utils/antinuke');
const { handleNewUserJoin } = require('./utils/newUserRestrictions');
const { addQuarantine, removeQuarantine } = require('./utils/quarantine');
const { backupServer, listBackups, restoreFromBackup } = require('./utils/backup');
const { logModeration, logAction, logMessageDelete, logMessageUpdate, logMemberJoin, logMemberLeave } = require('./utils/logger');
const { handleSettingsCommand, buttonHandlers, selectMenuHandlers, modalHandlers } = require('./utils/settingsPanelController');
const { handleControlPanelCommand, controlPanelButtonHandlers, controlPanelSelectHandlers, controlPanelModalHandlers, handleVerificationChallengeSubmit } = require('./utils/controlPanelController');
const { handleBjStart, handleBjHit, handleBjStand, handleBjBalance, handleBjDaily, handleBjButton } = require('./utils/blackjackCommands');
const { 
  createMainPanel, 
  handleBlackjackButton, 
  handleBetSelect, 
  handleAllInButton, 
  handleAllInConfirm, 
  handleWorkButton, 
  handleShopButton, 
  handleShopBuy, 
  handleInventoryButton, 
  handleDailyButton
} = require('./utils/ajackPanelController');
const {
  checkAdminPermission,
  createSettingsPanel,
  handleWorkSettings,
  handleWorkModal,
  handleShopManagement,
  handleAddItem,
  handleAddItemModal,
  handleRemoveItem,
  handleRemoveItemSelect,
  handleRoleSettings,
  handleRoleModal,
  handleChatSettings,
  handleChatModal,
  handleChatToggle
} = require('./utils/ajackSettingsController');
const { processChatReward } = require('./utils/chatReward');

const TOKEN_3 = config.BOT_TOKEN_3;

let ALLOWED_USERS = new Set();
let client3 = null;

const defaultPrefix = '/';
const guildPrefixes = new Map();

async function deleteWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 50013) throw error;
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('apanel')
    .setDescription('Bot コントロールパネルを開きます（すべての機能にアクセスできます）'),
  new SlashCommandBuilder()
    .setName('asettings')
    .setDescription('Bot 設定パネルを開きます（スパム対策、コンテンツ管理など）'),
  new SlashCommandBuilder()
    .setName('aban')
    .setDescription('ユーザーをBANします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('BANするユーザー')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('BANの理由')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('akick')
    .setDescription('ユーザーをキックします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('キックするユーザー')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('キックの理由')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('atimeout')
    .setDescription('ユーザーをタイムアウトします')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('タイムアウトするユーザー')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('タイムアウト時間（分）')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('タイムアウトの理由')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('ajack')
    .setDescription('あんこジャック - 仮想通貨ゲームを開始'),
  new SlashCommandBuilder()
    .setName('ajacksetting')
    .setDescription('あんこジャック設定パネル（管理者のみ）'),
  new SlashCommandBuilder()
    .setName('ajackhelp')
    .setDescription('あんこジャックの遊び方ガイド'),
  new SlashCommandBuilder()
    .setName('aid')
    .setDescription('許可ユーザーリストを管理')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('実行するアクション')
        .setRequired(true)
        .addChoices(
          { name: '一覧', value: 'list' },
          { name: '追加', value: 'add' },
          { name: '削除', value: 'remove' }
        ))
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('対象のユーザーID')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('bjstart')
    .setDescription('ブラックジャックを開始')
    .addIntegerOption(option =>
      option.setName('bet')
        .setDescription('ベット額')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('bjhit')
    .setDescription('カードを引く'),
  new SlashCommandBuilder()
    .setName('bjstand')
    .setDescription('スタンド（カードを引かない）'),
  new SlashCommandBuilder()
    .setName('bjbalance')
    .setDescription('残高を確認'),
  new SlashCommandBuilder()
    .setName('bjdaily')
    .setDescription('デイリーボーナスを受け取る')
];

async function registerModCommands() {
  if (!TOKEN_3) return;
  
  const rest = new REST({ version: '10' }).setToken(TOKEN_3);
  
  try {
    console.log('[Bot3-Moderation] スラッシュコマンドを登録しています...');
    await rest.put(
      Routes.applicationCommands(client3.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('[Bot3-Moderation] スラッシュコマンドの登録が完了しました！');
  } catch (error) {
    console.error('[Bot3-Moderation] コマンド登録エラー:', error);
  }
}

async function startModBot() {
  if (!TOKEN_3) {
    console.log('[Bot3-Moderation] トークンが設定されていないためスキップします');
    return { success: false, error: 'No token' };
  }
  
  try {
    await initializeStorage();
    ALLOWED_USERS = await getAllowedUsers();
    console.log(`[Bot3-Moderation] 許可ユーザーを読み込みました: ${ALLOWED_USERS.size}人`);
  } catch (error) {
    console.error('[Bot3-Moderation] ストレージ初期化エラー:', error);
  }
  
  client3 = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildPresences,
    ],
  });
  
  client3.once(Events.ClientReady, async () => {
    console.log(`[Bot3-Moderation] Ready: ${client3.user.tag}`);
    await registerModCommands();
  });
  
  client3.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    try {
      await processChatReward(message);
    } catch (error) {
      console.error('チャット報酬エラー:', error);
    }
    
    const settings = await getGuildSettings(message.guild.id);
    const prefix = settings.prefix || defaultPrefix;
    
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
      switch (command) {
        case 'help':
          await handleHelpCommand(message, '!');
          break;
        case 'settings':
          await handleSettingsCommandOld(message, args);
          break;
        case 'warn':
          await handleWarnCommand(message, args);
          break;
        case 'mute':
          await handleMuteCommand(message, args);
          break;
        case 'kick':
          await handleKickCommand(message, args);
          break;
        case 'ban':
          await handleBanCommand(message, args);
          break;
        case 'unban':
          await handleUnbanCommand(message, args);
          break;
        case 'lock':
          await handleLockCommand(message);
          break;
        case 'unlock':
          await handleUnlockCommand(message);
          break;
        case 'slowmode':
          await handleSlowmodeCommand(message, args);
          break;
        case 'lockdown':
          await handleLockdownCommand(message);
          break;
        case 'quarantine':
          await handleQuarantineCommand(message, args);
          break;
        case 'unquarantine':
          await handleUnquarantineCommand(message, args);
          break;
        case 'cases':
          await handleCasesCommand(message, args);
          break;
        case 'delcase':
          await handleDelcaseCommand(message, args);
          break;
        case 'warnings':
          await handleWarningsCommand(message, args);
          break;
        case 'clearwarnings':
          await handleClearWarningsCommand(message, args);
          break;
        case 'backup':
          await handleBackupCommand(message, args);
          break;
        case 'nsfwkeyword':
          await handleNSFWKeywordCommand(message, args);
          break;
        case 'antispam':
          await handleAntispamCommand(message, args);
          break;
        case 'ankoc':
          await handleAnkocCommand(message, args);
          break;
      }
    } catch (error) {
      console.error('コマンドエラー:', error);
      message.reply('❌ コマンドの実行中にエラーが発生しました。');
    }
  });
  
  client3.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) {
      if (interaction.replied || interaction.deferred) return;
      if (interaction.isChatInputCommand()) {
        return interaction.reply({
          content: '❌ このコマンドはサーバー内でのみ使用できます。',
          ephemeral: true
        });
      }
      return;
    }
    
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }
    
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }
    
    if (interaction.isUserSelectMenu()) {
      await handleUserSelectMenuInteraction(interaction);
      return;
    }
    
    if (interaction.isModalSubmit()) {
      await handleModalSubmitInteraction(interaction);
      return;
    }
    
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    
    try {
      if (commandName === 'apanel') {
        await handleControlPanelCommand(interaction);
      } else if (commandName === 'asettings') {
        await handleSettingsCommand(interaction);
      } else if (commandName === 'aban') {
        await handleAbanSlashCommand(interaction);
      } else if (commandName === 'akick') {
        await handleAkickSlashCommand(interaction);
      } else if (commandName === 'atimeout') {
        await handleAtimeoutSlashCommand(interaction);
      } else if (commandName === 'ajack') {
        await handleAjackSlashCommand(interaction);
      } else if (commandName === 'ajacksetting') {
        await handleAjacksettingSlashCommand(interaction);
      } else if (commandName === 'ajackhelp') {
        await handleAjackhelpSlashCommand(interaction);
      } else if (commandName === 'aid') {
        await handleAidSlashCommand(interaction);
      } else if (commandName === 'bjstart') {
        await handleBjStart(interaction);
      } else if (commandName === 'bjhit') {
        await handleBjHit(interaction);
      } else if (commandName === 'bjstand') {
        await handleBjStand(interaction);
      } else if (commandName === 'bjbalance') {
        await handleBjBalance(interaction);
      } else if (commandName === 'bjdaily') {
        await handleBjDaily(interaction);
      }
    } catch (error) {
      console.error('スラッシュコマンドエラー:', error);
      const errorMessage = '❌ コマンドの実行中にエラーが発生しました。';
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });
  
  return new Promise((resolve) => {
    client3.login(TOKEN_3)
      .then(() => {
        console.log('[Bot3-Moderation] ログイン成功');
        resolve({ success: true });
      })
      .catch(err => {
        console.error('[Bot3-Moderation] ログインエラー:', err);
        resolve({ success: false, error: err.message });
      });
  });
}

async function handleButtonInteraction(interaction) {
  try {
    if (interaction.customId.startsWith('bj_')) {
      await handleBjButton(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('ajack_')) {
      await handleAjackButtonInteraction(interaction);
      return;
    }
    
    let handler = buttonHandlers[interaction.customId] || controlPanelButtonHandlers[interaction.customId];
    
    if (handler) {
      await handler(interaction);
    }
  } catch (error) {
    console.error('ボタンインタラクションエラー:', error);
    const errorMessage = '❌ 操作中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleAjackButtonInteraction(interaction) {
  const customId = interaction.customId;
  
  if (customId === 'ajack_blackjack') {
    await handleBlackjackButton(interaction);
  } else if (customId === 'ajack_allin') {
    await handleAllInButton(interaction);
  } else if (customId === 'ajack_allin_confirm') {
    await handleAllInConfirm(interaction);
  } else if (customId === 'ajack_allin_cancel') {
    await interaction.update({ content: '❌ キャンセルしました。', components: [], embeds: [] });
  } else if (customId === 'ajack_work') {
    await handleWorkButton(interaction);
  } else if (customId === 'ajack_shop') {
    await handleShopButton(interaction);
  } else if (customId === 'ajack_inventory') {
    await handleInventoryButton(interaction);
  } else if (customId === 'ajack_daily') {
    await handleDailyButton(interaction);
  } else if (customId === 'ajack_setting_work') {
    await handleWorkSettings(interaction);
  } else if (customId === 'ajack_setting_shop') {
    await handleShopManagement(interaction);
  } else if (customId === 'ajack_setting_role') {
    await handleRoleSettings(interaction);
  } else if (customId === 'ajack_setting_chat') {
    await handleChatSettings(interaction);
  } else if (customId === 'ajack_shop_add') {
    await handleAddItem(interaction);
  } else if (customId === 'ajack_shop_remove') {
    await handleRemoveItem(interaction);
  }
}

async function handleSelectMenuInteraction(interaction) {
  try {
    if (interaction.customId.startsWith('ajack_')) {
      const customId = interaction.customId;
      if (customId === 'ajack_bj_bet') {
        await handleBetSelect(interaction);
      } else if (customId === 'ajack_shop_buy') {
        await handleShopBuy(interaction);
      } else if (customId === 'ajack_shop_remove_select') {
        await handleRemoveItemSelect(interaction);
      }
      return;
    }
    
    const handler = selectMenuHandlers[interaction.customId] || controlPanelSelectHandlers[interaction.customId];
    if (handler) {
      await handler(interaction);
    }
  } catch (error) {
    console.error('セレクトメニューエラー:', error);
    const errorMessage = '❌ 操作中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleUserSelectMenuInteraction(interaction) {
  try {
    const handler = selectMenuHandlers[interaction.customId] || controlPanelSelectHandlers[interaction.customId];
    if (handler) {
      await handler(interaction);
    }
  } catch (error) {
    console.error('ユーザーセレクトメニューエラー:', error);
    const errorMessage = '❌ 操作中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleModalSubmitInteraction(interaction) {
  try {
    if (interaction.customId.startsWith('ajack_')) {
      const customId = interaction.customId.split(':')[0];
      if (customId === 'ajack_work_modal') {
        await handleWorkModal(interaction);
      } else if (customId === 'ajack_add_item_modal') {
        await handleAddItemModal(interaction);
      } else if (customId === 'ajack_role_modal') {
        await handleRoleModal(interaction);
      } else if (customId === 'ajack_chat_modal') {
        await handleChatModal(interaction);
      }
      return;
    }
    
    let handler = modalHandlers[interaction.customId] || controlPanelModalHandlers[interaction.customId];
    
    if (!handler && interaction.customId.startsWith('modal_verification_')) {
      handler = handleVerificationChallengeSubmit;
    }
    
    if (handler) {
      await handler(interaction);
    }
  } catch (error) {
    console.error('モーダルエラー:', error);
    const errorMessage = '❌ 操作中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleAbanSlashCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({
      content: '❌ このコマンドを使用するには「メンバーをBAN」権限が必要です。',
      ephemeral: true
    });
  }
  
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || '理由なし';
  
  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    await banUser(interaction.guild, member, interaction.user, reason);
    await interaction.reply({
      content: `✅ ${targetUser.tag} をBANしました。\n理由: ${reason}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('BAN エラー:', error);
    await interaction.reply({
      content: `❌ BANの実行中にエラーが発生しました: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleAkickSlashCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({
      content: '❌ このコマンドを使用するには「メンバーをキック」権限が必要です。',
      ephemeral: true
    });
  }
  
  const targetUser = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || '理由なし';
  
  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    await kickUser(interaction.guild, member, interaction.user, reason);
    await interaction.reply({
      content: `✅ ${targetUser.tag} をキックしました。\n理由: ${reason}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('キック エラー:', error);
    await interaction.reply({
      content: `❌ キックの実行中にエラーが発生しました: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleAtimeoutSlashCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ このコマンドを使用するには「メンバーをタイムアウト」権限が必要です。',
      ephemeral: true
    });
  }
  
  const targetUser = interaction.options.getUser('user');
  const duration = interaction.options.getInteger('duration') || 60;
  const reason = interaction.options.getString('reason') || '理由なし';
  
  try {
    const member = await interaction.guild.members.fetch(targetUser.id);
    await muteUser(interaction.guild, member, interaction.user, duration, reason);
    await interaction.reply({
      content: `✅ ${targetUser.tag} を${duration}分間タイムアウトしました。\n理由: ${reason}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('タイムアウト エラー:', error);
    await interaction.reply({
      content: `❌ タイムアウトの実行中にエラーが発生しました: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleAjackSlashCommand(interaction) {
  const { getAjackSettings } = require('./storage/fileStorage');
  const settings = await getAjackSettings(interaction.guild.id);
  
  if (settings.allowedChannelId && interaction.channel.id !== settings.allowedChannelId) {
    return interaction.reply({
      content: `❌ このコマンドは <#${settings.allowedChannelId}> でのみ使用できます。`,
      ephemeral: true
    });
  }
  
  const panel = await createMainPanel(interaction.user.id, interaction.guild.id);
  await interaction.reply({ ...panel, ephemeral: true });
}

async function handleAjacksettingSlashCommand(interaction) {
  if (!await checkAdminPermission(interaction)) return;
  const panel = await createSettingsPanel(interaction.guild.id);
  await interaction.reply({ ...panel, ephemeral: true });
}

async function handleAjackhelpSlashCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎰 あんこジャック - 遊び方ガイド')
    .setColor(0x5865F2)
    .setDescription('**小学生でもわかる！あんこジャックの遊び方**\n\nあんこジャックは、あんこドルという通貨を使って遊ぶゲームです！')
    .addFields(
      { name: '💰 あんこドルって何？', value: 'このサーバーで使えるお金だよ！ブラックジャックで増やしたり、働いたり、デイリーボーナスでもらえるよ！', inline: false },
      { name: '🎴 ブラックジャックのルール', value: '**目標**: カードの合計を21に近づける！\n**ルール**:\n・数字カードはそのままの数\n・絵札（J,Q,K）は10\n・エース（A）は1か11\n・21を超えたら負け！\n・ディーラーより21に近ければ勝ち！', inline: false },
      { name: '💼 お金を稼ぐ方法', value: '**働く**: `/ajack`→💼ボタンで報酬ゲット！\n**デイリー**: 毎日もらえるボーナス！\n**チャット**: お話しするだけでお金がもらえるよ！\n**ブラックジャック**: 勝てば倍になるよ！', inline: false },
      { name: '🛒 ショップ', value: 'あんこドルでアイテムが買えるよ！買ったアイテムはインベントリに入るよ！', inline: false },
      { name: '🏦 銀行', value: 'お金を預けておくと盗まれないよ！安全に保管しよう！', inline: false }
    )
    .setFooter({ text: '/ajack でメインパネルを開いて遊ぼう！' })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAidSlashCommand(interaction) {
  if (!ALLOWED_USERS.has(interaction.user.id)) {
    return interaction.reply({
      content: '❌ このコマンドを使用する権限がありません。',
      ephemeral: true
    });
  }
  
  const action = interaction.options.getString('action');
  const userId = interaction.options.getString('user_id');
  
  if (action === 'list') {
    const userArray = Array.from(ALLOWED_USERS);
    const userList = userArray.length > 0 
      ? userArray.map((id, index) => `${index + 1}. \`${id}\``).join('\n')
      : 'なし';
    
    const embed = new EmbedBuilder()
      .setTitle('📋 Bot許可ユーザーリスト')
      .setColor(0x5865F2)
      .setDescription(userList)
      .addFields(
        { name: '📊 合計', value: `${ALLOWED_USERS.size} 人`, inline: true }
      )
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (!userId) {
    return interaction.reply({
      content: '❌ ユーザーIDを指定してください。',
      ephemeral: true
    });
  }
  
  const trimmedUserId = userId.trim();
  
  if (!/^\d{17,20}$/.test(trimmedUserId)) {
    return interaction.reply({
      content: '❌ 無効なユーザーIDです。',
      ephemeral: true
    });
  }
  
  if (action === 'add') {
    if (ALLOWED_USERS.has(trimmedUserId)) {
      return interaction.reply({
        content: `❌ ユーザーID \`${trimmedUserId}\` は既に許可リストに含まれています。`,
        ephemeral: true
      });
    }
    
    ALLOWED_USERS.add(trimmedUserId);
    await addAllowedUser(trimmedUserId);
    
    return interaction.reply({
      content: `✅ ユーザーID \`${trimmedUserId}\` を許可リストに追加しました。`,
      ephemeral: true
    });
  } else if (action === 'remove') {
    if (!ALLOWED_USERS.has(trimmedUserId)) {
      return interaction.reply({
        content: `❌ ユーザーID \`${trimmedUserId}\` は許可リストに含まれていません。`,
        ephemeral: true
      });
    }
    
    ALLOWED_USERS.delete(trimmedUserId);
    await removeAllowedUser(trimmedUserId);
    
    return interaction.reply({
      content: `✅ ユーザーID \`${trimmedUserId}\` を許可リストから削除しました。`,
      ephemeral: true
    });
  }
}

async function handleHelpCommand(message, prefix) {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ 荒らし対策Bot - コマンド一覧')
    .setColor(0x5865F2)
    .setDescription('日本人向けの包括的な荒らし対策Botです。')
    .addFields(
      {
        name: '⚖️ モデレーション',
        value:
          `\`${prefix}warn @ユーザー [理由]\` - 警告\n` +
          `\`${prefix}mute @ユーザー [分] [理由]\` - ミュート\n` +
          `\`${prefix}kick @ユーザー [理由]\` - キック\n` +
          `\`${prefix}ban @ユーザー [理由]\` - BAN`
      },
      {
        name: '🔒 チャンネル管理',
        value:
          `\`${prefix}lock\` - チャンネルロック\n` +
          `\`${prefix}unlock\` - ロック解除\n` +
          `\`${prefix}slowmode <秒>\` - スローモード設定`
      }
    )
    .setFooter({ text: '一部のコマンドには管理者権限が必要です' })
    .setTimestamp();
  
  message.reply({ embeds: [embed] });
}

async function handleSettingsCommandOld(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const settings = await getGuildSettings(message.guild.id);
  const antiSpam = await getAntiSpamSettings(message.guild.id);
  
  const embed = new EmbedBuilder()
    .setTitle('🛡️ サーバー設定')
    .setColor(0x5865F2)
    .addFields(
      { name: 'プレフィックス', value: settings.prefix || defaultPrefix, inline: true },
      { name: '自動モデレーション', value: settings.auto_mod_enabled ? '✅ 有効' : '❌ 無効', inline: true }
    )
    .setTimestamp();
  
  message.reply({ embeds: [embed] });
}

async function handleWarnCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ 警告するユーザーをメンションしてください。');
  }
  
  const reason = args.slice(1).join(' ') || '理由なし';
  const result = await warnUser(message.guild, user.id, message.author.id, reason);
  
  if (result.success) {
    message.reply(`⚠️ <@${user.id}> に警告を発行しました。（警告数: ${result.warningCount}回）\n理由: ${reason}`);
  } else {
    message.reply(`❌ 警告の発行に失敗しました: ${result.error}`);
  }
}

async function handleMuteCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ ミュートするユーザーをメンションしてください。');
  }
  
  const durationArg = args[1];
  const duration = durationArg && !isNaN(durationArg) ? parseInt(durationArg) * 60 * 1000 : 60 * 60 * 1000;
  const reason = args.slice(durationArg && !isNaN(durationArg) ? 2 : 1).join(' ') || '理由なし';
  
  const result = await muteUser(message.guild, user.id, message.author.id, reason, duration);
  
  if (result.success) {
    const minutes = Math.floor(duration / 60000);
    message.reply(`🔇 <@${user.id}> をミュートしました。（${minutes}分間）\n理由: ${reason}`);
  } else {
    message.reply(`❌ ミュートに失敗しました: ${result.error}`);
  }
}

async function handleKickCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ キックするユーザーをメンションしてください。');
  }
  
  const reason = args.slice(1).join(' ') || '理由なし';
  const result = await kickUser(message.guild, user.id, message.author.id, reason);
  
  if (result.success) {
    message.reply(`👢 <@${user.id}> をキックしました。\n理由: ${reason}`);
  } else {
    message.reply(`❌ キックに失敗しました: ${result.error}`);
  }
}

async function handleBanCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ BANするユーザーをメンションしてください。');
  }
  
  const reason = args.slice(1).join(' ') || '理由なし';
  const result = await banUser(message.guild, user.id, message.author.id, reason);
  
  if (result.success) {
    message.reply(`🔨 <@${user.id}> をBANしました。\n理由: ${reason}`);
  } else {
    message.reply(`❌ BANに失敗しました: ${result.error}`);
  }
}

async function handleUnbanCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const userId = args[0];
  if (!userId) {
    return message.reply('❌ BAN解除するユーザーIDを指定してください。');
  }
  
  const reason = args.slice(1).join(' ') || '理由なし';
  const result = await unbanUser(message.guild, userId, message.author.id, reason);
  
  if (result.success) {
    message.reply(`✅ <@${userId}> のBANを解除しました。\n理由: ${reason}`);
  } else {
    message.reply(`❌ BAN解除に失敗しました: ${result.error}`);
  }
}

async function handleLockCommand(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    message.reply('🔒 このチャンネルをロックしました。');
  } catch (error) {
    message.reply('❌ チャンネルのロックに失敗しました。');
  }
}

async function handleUnlockCommand(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null
    });
    message.reply('🔓 このチャンネルのロックを解除しました。');
  } catch (error) {
    message.reply('❌ チャンネルのロック解除に失敗しました。');
  }
}

async function handleSlowmodeCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const seconds = parseInt(args[0]);
  if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
    return message.reply('❌ 0〜21600秒の間で指定してください。');
  }
  
  try {
    await message.channel.setRateLimitPerUser(seconds);
    if (seconds === 0) {
      message.reply('⏱️ スローモードを解除しました。');
    } else {
      message.reply(`⏱️ スローモードを${seconds}秒に設定しました。`);
    }
  } catch (error) {
    message.reply('❌ スローモードの設定に失敗しました。');
  }
}

async function handleLockdownCommand(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  message.reply('🔒 サーバーロックダウン機能は準備中です。');
}

async function handleQuarantineCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ 隔離するユーザーをメンションしてください。');
  }
  
  const durationArg = args[1];
  const duration = durationArg && !isNaN(durationArg) ? parseInt(durationArg) : null;
  const reason = args.slice(duration ? 2 : 1).join(' ') || '理由なし';
  
  const result = await addQuarantine(message.guild, user.id, message.author.id, reason, duration);
  
  if (result.success) {
    const durationText = duration ? `（${duration}分間）` : '';
    message.reply(`🔒 <@${user.id}> を隔離しました${durationText}。\n理由: ${reason}`);
  } else {
    message.reply(`❌ 隔離に失敗しました: ${result.error}`);
  }
}

async function handleUnquarantineCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ 隔離解除するユーザーをメンションしてください。');
  }
  
  const reason = args.slice(1).join(' ') || '手動解除';
  const result = await removeQuarantine(message.guild, user.id, message.author.id, reason);
  
  if (result.success) {
    message.reply(`🔓 <@${user.id}> の隔離を解除しました。\n理由: ${reason}`);
  } else {
    message.reply(`❌ 隔離解除に失敗しました: ${result.error}`);
  }
}

async function handleCasesCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const limit = parseInt(args[0]) || 10;
  const cases = await getModerationCases(message.guild.id, Math.min(limit, 50));
  
  if (cases.length === 0) {
    return message.reply('📋 モデレーション履歴はありません。');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📋 モデレーション履歴')
    .setColor(0x5865F2)
    .setDescription(
      cases.slice(0, 10).map(c => 
        `**#${c.case_number}** - ${c.action_type}\n` +
        `ユーザー: <@${c.user_id}> | 理由: ${c.reason || '理由なし'}`
      ).join('\n\n')
    )
    .setFooter({ text: `合計 ${cases.length} 件` })
    .setTimestamp();
  
  message.reply({ embeds: [embed] });
}

async function handleDelcaseCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const caseNumber = parseInt(args[0]);
  if (!caseNumber) {
    return message.reply('❌ ケース番号を指定してください。');
  }
  
  const result = await deleteModerationCase(message.guild.id, caseNumber);
  
  if (result) {
    message.reply(`✅ ケース #${caseNumber} を削除しました。`);
  } else {
    message.reply(`❌ ケース #${caseNumber} が見つかりませんでした。`);
  }
}

async function handleWarningsCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ ユーザーをメンションしてください。');
  }
  
  const warnings = await getWarnings(message.guild.id, user.id);
  
  if (warnings.length === 0) {
    return message.reply(`<@${user.id}> には警告履歴がありません。`);
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ ${user.tag} の警告履歴`)
    .setColor(0xFFFF00)
    .setDescription(
      warnings.slice(0, 10).map((w, i) => 
        `**${i + 1}.** ${w.reason || '理由なし'}`
      ).join('\n')
    )
    .setFooter({ text: `合計 ${warnings.length} 件の警告` })
    .setTimestamp();
  
  message.reply({ embeds: [embed] });
}

async function handleClearWarningsCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply('❌ ユーザーをメンションしてください。');
  }
  
  const count = await clearWarnings(message.guild.id, user.id);
  message.reply(`✅ <@${user.id}> の警告を ${count} 件クリアしました。`);
}

async function handleBackupCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const subcommand = args[0]?.toLowerCase();
  
  if (subcommand === 'create') {
    const backupName = args.slice(1).join(' ') || `Backup ${new Date().toLocaleString('ja-JP')}`;
    const result = await backupServer(message.guild, backupName, message.author.id, 100);
    
    if (result.success) {
      message.reply(`✅ バックアップを作成しました: ${backupName}`);
    } else {
      message.reply(`❌ バックアップ作成に失敗しました: ${result.error}`);
    }
  } else if (subcommand === 'list') {
    const result = await listBackups(message.guild.id, 10);
    
    if (result.success && result.backups.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('💾 サーバーバックアップ一覧')
        .setColor(0x5865F2)
        .setDescription(
          result.backups.map(b => 
            `**ID: ${b.id}** - ${b.backup_name}`
          ).join('\n')
        )
        .setTimestamp();
      
      message.reply({ embeds: [embed] });
    } else {
      message.reply('📋 バックアップがありません。');
    }
  } else {
    message.reply('❌ サブコマンドを指定してください。\n`!backup create [名前]` または `!backup list`');
  }
}

async function handleNSFWKeywordCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const subcommand = args[0]?.toLowerCase();
  
  if (subcommand === 'add') {
    const keyword = args.slice(1).join(' ');
    if (!keyword) {
      return message.reply('❌ 追加するキーワードを指定してください。');
    }
    
    const result = await addNSFWKeyword(message.guild.id, keyword);
    if (result) {
      refreshNSFWCache(message.guild.id);
      message.reply(`✅ NSFWキーワードを追加しました: ${keyword}`);
    } else {
      message.reply(`⚠️ キーワードは既に登録されています: ${keyword}`);
    }
  } else if (subcommand === 'remove') {
    const keyword = args.slice(1).join(' ');
    if (!keyword) {
      return message.reply('❌ 削除するキーワードを指定してください。');
    }
    
    const result = await removeNSFWKeyword(message.guild.id, keyword);
    if (result) {
      refreshNSFWCache(message.guild.id);
      message.reply(`✅ NSFWキーワードを削除しました: ${keyword}`);
    } else {
      message.reply(`❌ キーワードが見つかりません: ${keyword}`);
    }
  } else if (subcommand === 'list') {
    const keywords = await getNSFWKeywords(message.guild.id);
    
    if (keywords.length === 0) {
      return message.reply('📋 カスタムNSFWキーワードは登録されていません。');
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🔞 カスタムNSFWキーワード一覧')
      .setColor(0xFF0000)
      .setDescription(keywords.map((k, i) => `${i + 1}. ${k}`).join('\n'))
      .setFooter({ text: `合計 ${keywords.length} 件` })
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  } else {
    message.reply('❌ サブコマンドを指定してください。\n`!nsfwkeyword add/remove/list`');
  }
}

async function handleAntispamCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply('❌ このコマンドを使用する権限がありません。');
  }
  
  const subcommand = args[0]?.toLowerCase();
  
  if (subcommand === 'timeout') {
    const action = args[1]?.toLowerCase();
    
    if (action === 'on') {
      let duration = 5;
      if (args[2]) {
        const parsedDuration = parseInt(args[2]);
        if (!isNaN(parsedDuration) && parsedDuration > 0) {
          duration = parsedDuration;
        }
      }
      
      await updateAntiSpamSettings(message.guild.id, { 
        timeout_enabled: true,
        timeout_duration: duration
      });
      message.reply(`✅ スパム検出時のタイムアウトを有効化しました（${duration}分）`);
    } else if (action === 'off') {
      await updateAntiSpamSettings(message.guild.id, { timeout_enabled: false });
      message.reply('✅ スパム検出時のタイムアウトを無効化しました');
    } else {
      message.reply('❌ `!antispam timeout on [分数]` または `!antispam timeout off`');
    }
  } else {
    message.reply('❌ `!antispam timeout on/off`');
  }
}

async function handleAnkocCommand(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply('❌ ボットがこのチャンネルでメッセージを管理する権限がありません。');
  }
  
  if (args.length === 0) {
    return message.reply('❌ 削除したいキーワードを指定してください。');
  }
  
  const keyword = args.join(' ');
  await message.delete().catch(() => {});
  
  const searchMsg = await message.channel.send(`🔍 「${keyword}」を含むメッセージを検索しています...`);
  
  try {
    const messagesToDelete = [];
    let lastMessageId = null;
    let fetchedMessages;
    let totalFetched = 0;
    const maxMessages = 1000;
    
    do {
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }
      
      fetchedMessages = await message.channel.messages.fetch(options);
      totalFetched += fetchedMessages.size;
      
      for (const [id, msg] of fetchedMessages) {
        if (msg.content.includes(keyword)) {
          messagesToDelete.push(msg);
        }
      }
      
      if (fetchedMessages.size > 0) {
        lastMessageId = fetchedMessages.last().id;
      }
    } while (fetchedMessages.size === 100 && totalFetched < maxMessages);
    
    if (messagesToDelete.length === 0) {
      return searchMsg.edit(`❌ 「${keyword}」を含むメッセージが見つかりませんでした。`);
    }
    
    await searchMsg.edit(`**${messagesToDelete.length}件** 見つかりました。削除中...`);
    
    let deletedCount = 0;
    for (const msg of messagesToDelete) {
      try {
        await msg.delete();
        deletedCount++;
      } catch (error) {
        console.error('メッセージ削除エラー:', error);
      }
    }
    
    await searchMsg.edit(`✅ ${deletedCount}件のメッセージを削除しました。`);
    
    setTimeout(async () => {
      try {
        await searchMsg.delete().catch(() => {});
      } catch (error) {}
    }, 10000);
    
  } catch (error) {
    console.error('ankocコマンドエラー:', error);
    message.channel.send('❌ エラーが発生しました。');
  }
}

module.exports = { startModBot };

if (require.main === module) {
    startModBot().then(result => {
        if (result.success) {
            console.log('[modbot.js] Moderation bot started successfully');
        } else {
            console.log('[modbot.js] Moderation bot skipped or failed:', result.error);
        }
    });
}
