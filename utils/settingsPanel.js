const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getGuildSettings, getAntiSpamSettings, updateGuildSettings, updateAntiSpamSettings, getBannedWords, addBannedWord, removeBannedWord, getNSFWKeywords, addNSFWKeyword, removeNSFWKeyword, getCommandSpamSettings, updateCommandSpamSettings } = require('../storage/fileStorage');

async function createMainSettingsPanel(guildId) {
  const settings = await getGuildSettings(guildId);
  const antiSpam = await getAntiSpamSettings(guildId);
  const cmdSpam = await getCommandSpamSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('⚙️ サーバー設定パネル')
    .setDescription('ボタンをクリックして各カテゴリの設定を管理できます')
    .setColor(0x5865F2)
    .addFields(
      { 
        name: '🛡️ サーバー設定', 
        value: `自動モデレーション: ${settings.auto_mod_enabled ? '✅' : '❌'}\nAntinuke: ${settings.antinuke_enabled ? '✅' : '❌'}\nJoin Raid対策: ${settings.join_raid_protection ? '✅' : '❌'}`,
        inline: true 
      },
      { 
        name: '🚫 スパム対策', 
        value: `連投上限: ${antiSpam.max_messages}件/${antiSpam.time_window}秒\nメンション: ${antiSpam.max_mentions}件\nタイムアウト: ${antiSpam.timeout_enabled ? '✅' : '❌'}`,
        inline: true 
      },
      { 
        name: '📝 コンテンツ管理', 
        value: `禁止用語検出: ✅\nNSFWブロック: ${antiSpam.nsfw_block_enabled ? '✅' : '❌'}\nリンクブロック: ${antiSpam.link_block_enabled ? '✅' : '❌'}`,
        inline: true 
      }
    )
    .setFooter({ text: '各ボタンをクリックして詳細設定を行えます' })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('settings_server')
        .setLabel('🛡️ サーバー設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_spam')
        .setLabel('🚫 スパム対策')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_content')
        .setLabel('📝 コンテンツ管理')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('settings_logs')
        .setLabel('📋 ログ設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_broadcast_dm')
        .setLabel('📢 全員にDM')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('settings_refresh')
        .setLabel('🔄 更新')
        .setStyle(ButtonStyle.Success)
    );

  return { embeds: [embed], components: [row1, row2] };
}

async function createServerSettingsPanel(guildId) {
  const settings = await getGuildSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('🛡️ サーバー設定')
    .setDescription('各機能のオン/オフを切り替えられます')
    .setColor(0x5865F2)
    .addFields(
      { name: '自動モデレーション', value: settings.auto_mod_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'Antinuke', value: settings.antinuke_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'Join Raid対策', value: settings.join_raid_protection ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'Webhook保護', value: settings.webhook_protection ? '✅ 有効' : '❌ 無効', inline: true },
      { name: '自動認証', value: settings.auto_verify_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: '最小アカウント年齢', value: `${settings.min_account_age || 0}日`, inline: true },
      { name: 'メッセージログ', value: settings.message_log_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'レイドモード', value: settings.raid_mode_enabled ? '🔒 有効' : '❌ 無効', inline: true },
      { name: '画像スパム対策', value: settings.image_spam_enabled ? '✅ 有効' : '❌ 無効', inline: true }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_auto_mod')
        .setLabel(settings.auto_mod_enabled ? '❌ 自動モデレーション無効化' : '✅ 自動モデレーション有効化')
        .setStyle(settings.auto_mod_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_antinuke')
        .setLabel(settings.antinuke_enabled ? '❌ Antinuke無効化' : '✅ Antinuke有効化')
        .setStyle(settings.antinuke_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_join_raid')
        .setLabel(settings.join_raid_protection ? '❌ Join Raid対策無効化' : '✅ Join Raid対策有効化')
        .setStyle(settings.join_raid_protection ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_webhook')
        .setLabel(settings.webhook_protection ? '❌ Webhook保護無効化' : '✅ Webhook保護有効化')
        .setStyle(settings.webhook_protection ? ButtonStyle.Danger : ButtonStyle.Success)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_auto_verify')
        .setLabel(settings.auto_verify_enabled ? '❌ 自動認証無効化' : '✅ 自動認証有効化')
        .setStyle(settings.auto_verify_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_message_log')
        .setLabel(settings.message_log_enabled ? '❌ メッセージログ無効化' : '✅ メッセージログ有効化')
        .setStyle(settings.message_log_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_raid_mode')
        .setLabel(settings.raid_mode_enabled ? '🔓 レイドモード解除' : '🔒 レイドモード有効化')
        .setStyle(settings.raid_mode_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_image_spam')
        .setLabel(settings.image_spam_enabled ? '❌ 画像スパム対策無効化' : '✅ 画像スパム対策有効化')
        .setStyle(settings.image_spam_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

  const row5 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('◀️ 戻る')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row1, row2, row3, row4, row5] };
}

async function createSpamSettingsPanel(guildId) {
  const settings = await getAntiSpamSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('🚫 スパム対策設定')
    .setDescription('スパム検出の各種設定を管理できます')
    .setColor(0xFF6B6B)
    .addFields(
      { name: '連投制限', value: `${settings.max_messages}件/${settings.time_window}秒`, inline: true },
      { name: 'メンション上限', value: `${settings.max_mentions}件`, inline: true },
      { name: '改行上限', value: `${settings.max_line_breaks}行`, inline: true },
      { name: '重複メッセージ閾値', value: `${settings.duplicate_message_threshold}回`, inline: true },
      { name: 'メッセージ最大長', value: `${settings.max_message_length}文字`, inline: true },
      { name: 'タイムアウト', value: settings.timeout_enabled ? `✅ 有効 (${settings.timeout_duration}分)` : '❌ 無効', inline: true },
      { name: 'ランダム文字列検出', value: settings.random_suffix_detection ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'リンクブロック', value: settings.link_block_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'NSFWブロック', value: settings.nsfw_block_enabled ? '✅ 有効' : '❌ 無効', inline: true }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('spam_preset')
        .setPlaceholder('プリセットを選択')
        .addOptions([
          {
            label: '厳格',
            description: '最も厳しいスパム対策',
            value: 'strict',
            emoji: '🔴'
          },
          {
            label: '中程度',
            description: 'バランスの取れた設定',
            value: 'moderate',
            emoji: '🟡'
          },
          {
            label: '緩やか',
            description: '比較的緩い設定',
            value: 'lenient',
            emoji: '🟢'
          },
          {
            label: 'デフォルト',
            description: '初期設定に戻す',
            value: 'default',
            emoji: '⚪'
          }
        ])
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('spam_edit_limits')
        .setLabel('📊 制限値を編集')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('toggle_timeout')
        .setLabel(settings.timeout_enabled ? '❌ タイムアウト無効化' : '✅ タイムアウト有効化')
        .setStyle(settings.timeout_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_random_detection')
        .setLabel(settings.random_suffix_detection ? '❌ ランダム検出無効化' : '✅ ランダム検出有効化')
        .setStyle(settings.random_suffix_detection ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_link_block')
        .setLabel(settings.link_block_enabled ? '❌ リンクブロック無効化' : '✅ リンクブロック有効化')
        .setStyle(settings.link_block_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('◀️ 戻る')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function createContentSettingsPanel(guildId) {
  const settings = await getAntiSpamSettings(guildId);
  const bannedWords = await getBannedWords(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('🔒 禁止用語管理')
    .setDescription('サーバーで使用を禁止する単語やフレーズを管理できます')
    .setColor(0x4CAF50)
    .addFields(
      { name: '登録済み禁止用語', value: bannedWords.length > 0 ? `${bannedWords.length}件` : 'なし', inline: true },
      { name: 'NSFWブロック', value: settings.nsfw_block_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'リンクブロック', value: settings.link_block_enabled ? '✅ 有効' : '❌ 無効', inline: true }
    )
    .setFooter({ text: '禁止用語を含むメッセージは自動的に削除されます' })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('banned_words_list')
        .setLabel('📋 禁止用語一覧')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('banned_words_add')
        .setLabel('➕ 禁止用語追加')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('banned_words_remove')
        .setLabel('➖ 禁止用語削除')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_nsfw_block')
        .setLabel(settings.nsfw_block_enabled ? '❌ NSFWブロック無効化' : '✅ NSFWブロック有効化')
        .setStyle(settings.nsfw_block_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('toggle_link_block_content')
        .setLabel(settings.link_block_enabled ? '❌ リンクブロック無効化' : '✅ リンクブロック有効化')
        .setStyle(settings.link_block_enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('◀️ 戻る')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row1, row2] };
}

function createSpamLimitsModal() {
  const modal = new ModalBuilder()
    .setCustomId('spam_limits_modal')
    .setTitle('スパム制限値の設定');

  const messagesInput = new TextInputBuilder()
    .setCustomId('max_messages')
    .setLabel('連投上限（メッセージ数）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 5')
    .setRequired(true);

  const timeWindowInput = new TextInputBuilder()
    .setCustomId('time_window')
    .setLabel('時間窓（秒）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 5')
    .setRequired(true);

  const mentionsInput = new TextInputBuilder()
    .setCustomId('max_mentions')
    .setLabel('メンション上限')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 5')
    .setRequired(true);

  const lineBreaksInput = new TextInputBuilder()
    .setCustomId('max_line_breaks')
    .setLabel('改行上限')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 10')
    .setRequired(true);

  const duplicateInput = new TextInputBuilder()
    .setCustomId('duplicate_threshold')
    .setLabel('重複メッセージ閾値')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 3')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(messagesInput),
    new ActionRowBuilder().addComponents(timeWindowInput),
    new ActionRowBuilder().addComponents(mentionsInput),
    new ActionRowBuilder().addComponents(lineBreaksInput),
    new ActionRowBuilder().addComponents(duplicateInput)
  );

  return modal;
}

async function createLogSettingsPanel(guildId) {
  const settings = await getGuildSettings(guildId);
  
  const logChannelText = settings.log_channel_id 
    ? `<#${settings.log_channel_id}>` 
    : '未設定';
  
  const embed = new EmbedBuilder()
    .setTitle('📋 ログ設定')
    .setDescription('各種ログの記録設定を管理できます')
    .setColor(0x9B59B6)
    .addFields(
      { name: 'ログチャンネル', value: logChannelText, inline: false },
      { name: 'モデレーションログ', value: settings.moderation_log_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'メッセージログ', value: settings.message_log_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'メンバーログ', value: settings.member_log_enabled ? '✅ 有効' : '❌ 無効', inline: true },
      { name: 'タイムアウトログ', value: settings.timeout_log_enabled ? '✅ 有効' : '❌ 無効', inline: true }
    )
    .setFooter({ text: 'ログチャンネルを設定してから各ログを有効化してください' })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('set_log_channel')
        .setLabel('📌 ログチャンネル設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('clear_log_channel')
        .setLabel('🗑️ ログチャンネル解除')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!settings.log_channel_id)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_moderation_log')
        .setLabel(settings.moderation_log_enabled ? '❌ モデレーションログ無効化' : '✅ モデレーションログ有効化')
        .setStyle(settings.moderation_log_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!settings.log_channel_id),
      new ButtonBuilder()
        .setCustomId('toggle_message_log_panel')
        .setLabel(settings.message_log_enabled ? '❌ メッセージログ無効化' : '✅ メッセージログ有効化')
        .setStyle(settings.message_log_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!settings.log_channel_id)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_member_log')
        .setLabel(settings.member_log_enabled ? '❌ メンバーログ無効化' : '✅ メンバーログ有効化')
        .setStyle(settings.member_log_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!settings.log_channel_id),
      new ButtonBuilder()
        .setCustomId('toggle_timeout_log')
        .setLabel(settings.timeout_log_enabled ? '❌ タイムアウトログ無効化' : '✅ タイムアウトログ有効化')
        .setStyle(settings.timeout_log_enabled ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(!settings.log_channel_id)
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('◀️ 戻る')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function createSetLogChannelModal() {
  const modal = new ModalBuilder()
    .setCustomId('set_log_channel_modal')
    .setTitle('ログチャンネルの設定');

  const channelInput = new TextInputBuilder()
    .setCustomId('log_channel_id')
    .setLabel('ログチャンネルID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('チャンネルIDを入力 (例: 1234567890123456)')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput)
  );

  return modal;
}

function createAddBannedWordModal() {
  const modal = new ModalBuilder()
    .setCustomId('add_banned_word_modal')
    .setTitle('禁止用語の追加');

  const wordInput = new TextInputBuilder()
    .setCustomId('banned_word')
    .setLabel('追加する禁止用語')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('禁止したい単語やフレーズを入力')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(wordInput)
  );

  return modal;
}

function createRemoveBannedWordModal() {
  const modal = new ModalBuilder()
    .setCustomId('remove_banned_word_modal')
    .setTitle('禁止用語の削除');

  const wordInput = new TextInputBuilder()
    .setCustomId('banned_word')
    .setLabel('削除する禁止用語')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('削除したい単語やフレーズを入力')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(wordInput)
  );

  return modal;
}

module.exports = {
  createMainSettingsPanel,
  createServerSettingsPanel,
  createSpamSettingsPanel,
  createContentSettingsPanel,
  createLogSettingsPanel,
  createSpamLimitsModal,
  createSetLogChannelModal,
  createAddBannedWordModal,
  createRemoveBannedWordModal
};
