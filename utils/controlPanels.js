const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { getModerationCases, getWarnings, getVerificationSettings, getTicketSettings, getActiveTickets } = require('../storage/fileStorage');

async function createMainControlPanel(guildId) {
  const embed = new EmbedBuilder()
    .setTitle('🎛️ Bot コントロールパネル')
    .setDescription('各カテゴリのボタンをクリックして、Bot のすべての機能にアクセスできます\n\n⚙️ **Bot設定**: `/asettings` コマンドで設定パネルを開けます')
    .setColor(0x5865F2)
    .addFields(
      { 
        name: '🛡️ モデレーション', 
        value: '警告、ミュート、キック、BAN、隔離などのモデレーション機能',
        inline: false
      },
      { 
        name: '📝 メッセージ管理', 
        value: 'キーワードでメッセージを削除',
        inline: false
      },
      { 
        name: '📊 履歴管理', 
        value: 'モデレーション履歴と警告履歴の確認・管理',
        inline: false
      },
      { 
        name: '🔧 サーバー管理', 
        value: 'バックアップ、サーバー設定、チャンネルロック',
        inline: false
      },
      { 
        name: '✅ 足し算認証', 
        value: '簡単な足し算でユーザーにロールを付与',
        inline: false
      },
      { 
        name: '🎫 チケットシステム', 
        value: 'ボタンでユーザー専用のプライベートチャンネルを作成',
        inline: false
      }
    )
    .setFooter({ text: 'すべての機能をパネルから簡単に操作できます' })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_moderation')
        .setLabel('🛡️ モデレーション')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_messages')
        .setLabel('📝 メッセージ管理')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_history')
        .setLabel('📊 履歴管理')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_server')
        .setLabel('🔧 サーバー管理')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_verification')
        .setLabel('✅ 足し算認証')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_ticket')
        .setLabel('🎫 チケット')
        .setStyle(ButtonStyle.Success)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_help')
        .setLabel('❓ ヘルプ')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function createModerationPanel(guildId) {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ モデレーションパネル')
    .setDescription('ユーザーに対するモデレーション操作を実行できます')
    .setColor(0xFF6B6B)
    .addFields(
      { name: '⚠️ 警告', value: 'ユーザーに警告を与えます', inline: true },
      { name: '🔇 ミュート', value: 'ユーザーを一時的にミュートします', inline: true },
      { name: '👢 キック', value: 'ユーザーをサーバーからキックします', inline: true },
      { name: '🔨 BAN', value: 'ユーザーをサーバーからBANします', inline: true },
      { name: '🔓 UNBAN', value: 'BANされたユーザーを解除します', inline: true },
      { name: '🔒 隔離', value: 'ユーザーを隔離状態にします', inline: true },
      { name: '🔓 隔離解除', value: '隔離状態を解除します', inline: true }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('mod_warn')
        .setLabel('⚠️ 警告')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mod_mute')
        .setLabel('🔇 ミュート')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mod_kick')
        .setLabel('👢 キック')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('mod_ban')
        .setLabel('🔨 BAN')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('mod_unban')
        .setLabel('🔓 UNBAN')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('mod_quarantine')
        .setLabel('🔒 隔離')
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('mod_unquarantine')
        .setLabel('🔓 隔離解除')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function createMessageManagementPanel(guildId) {
  const embed = new EmbedBuilder()
    .setTitle('📝 メッセージ管理パネル')
    .setDescription('メッセージの削除操作を実行できます')
    .setColor(0x4CAF50)
    .addFields(
      { 
        name: '🗑️ キーワード削除', 
        value: '特定のキーワードを含むメッセージを削除します\nチャンネル内またはサーバー全体から検索可能',
        inline: false
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('msg_delete_keyword')
        .setLabel('🗑️ キーワードで削除')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1] };
}

async function createHistoryPanel(guildId) {
  const cases = await getModerationCases(guildId);
  const recentCasesCount = Math.min(cases.length, 10);
  
  const embed = new EmbedBuilder()
    .setTitle('📊 履歴管理パネル')
    .setDescription('モデレーション履歴と警告履歴を管理できます')
    .setColor(0x9B59B6)
    .addFields(
      { 
        name: '📋 モデレーション履歴', 
        value: `直近 ${recentCasesCount} 件のケースを表示\n合計: ${cases.length} 件`,
        inline: true
      },
      { 
        name: '⚠️ 警告履歴', 
        value: 'ユーザーごとの警告履歴を表示',
        inline: true
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('history_cases')
        .setLabel('📋 ケース一覧')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('history_warnings')
        .setLabel('⚠️ 警告履歴')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('history_delete_case')
        .setLabel('🗑️ ケース削除')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('history_clear_warnings')
        .setLabel('🧹 警告クリア')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row2] };
}

async function createServerManagementPanel(guildId) {
  const embed = new EmbedBuilder()
    .setTitle('🔧 サーバー管理パネル')
    .setDescription('サーバーの設定とバックアップを管理できます')
    .setColor(0xF39C12)
    .addFields(
      { name: '💾 バックアップ', value: 'サーバーのロールとチャンネル構成をバックアップ', inline: true },
      { name: '🔒 チャンネルロック', value: 'チャンネルをロック/解除', inline: true },
      { name: '⏱️ スローモード', value: 'チャンネルのスローモードを設定', inline: true },
      { name: '🚨 ロックダウン', value: 'サーバー全体をロックダウン', inline: true },
      { name: '🛡️ サーバー設定', value: 'Discord のセキュリティ設定を変更', inline: true },
      { name: '👥 ロール権限管理', value: 'ロールのアプリコマンド使用権限を管理', inline: true }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_backup_create')
        .setLabel('💾 バックアップ作成')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('server_backup_list')
        .setLabel('📋 バックアップ一覧')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_backup_restore')
        .setLabel('♻️ バックアップ復元')
        .setStyle(ButtonStyle.Danger)
    );
  
  const row1b = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_backup_delete')
        .setLabel('🗑️ バックアップ削除')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_lock')
        .setLabel('🔒 ロック')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_unlock')
        .setLabel('🔓 解除')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_slowmode')
        .setLabel('⏱️ スローモード')
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_lockdown')
        .setLabel('🚨 ロックダウン')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('server_config')
        .setLabel('🛡️ サーバー設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_role_permissions')
        .setLabel('👥 ロール権限')
        .setStyle(ButtonStyle.Primary)
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row1b, row2, row3, row4] };
}

function createWarnModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_warn')
    .setTitle('ユーザーに警告');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('警告の理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createMuteModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_mute')
    .setTitle('ユーザーをミュート');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('ミュート時間（分）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 60（デフォルト: 60分）')
    .setRequired(false);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('ミュートの理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createKickModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_kick')
    .setTitle('ユーザーをキック');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('キックの理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createBanModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_ban')
    .setTitle('ユーザーをBAN');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('BANの理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createUnbanModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_unban')
    .setTitle('ユーザーのBANを解除');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザーID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 123456789012345678')
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('BAN解除の理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createQuarantineModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_quarantine')
    .setTitle('ユーザーを隔離');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('隔離時間（分）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 60（デフォルト: 60分）')
    .setRequired(false);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('隔離の理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createUnquarantineModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_unquarantine')
    .setTitle('ユーザーの隔離を解除');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('隔離解除の理由')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('理由を入力してください（任意）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

function createDeleteKeywordModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_delete_keyword')
    .setTitle('キーワードでメッセージを削除');

  const keywordInput = new TextInputBuilder()
    .setCustomId('keyword')
    .setLabel('削除したいキーワード')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('削除したいキーワードを入力')
    .setRequired(true);

  const limitInput = new TextInputBuilder()
    .setCustomId('limit')
    .setLabel('検索する件数')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1000（デフォルト: 1000）')
    .setRequired(false);

  const serverWideInput = new TextInputBuilder()
    .setCustomId('server_wide')
    .setLabel('サーバー全体から検索？（yes/no）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes でサーバー全体、no でこのチャンネルのみ')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(keywordInput),
    new ActionRowBuilder().addComponents(limitInput),
    new ActionRowBuilder().addComponents(serverWideInput)
  );

  return modal;
}

function createGetWarningsModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_get_warnings')
    .setTitle('ユーザーの警告履歴を表示');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput)
  );

  return modal;
}

function createClearWarningsModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_clear_warnings')
    .setTitle('ユーザーの警告をクリア');

  const userInput = new TextInputBuilder()
    .setCustomId('user')
    .setLabel('ユーザー（@メンションまたはユーザーID）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: @ユーザー名 または 123456789012345678')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput)
  );

  return modal;
}

function createDeleteCaseModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_delete_case')
    .setTitle('ケースを削除');

  const caseInput = new TextInputBuilder()
    .setCustomId('case_number')
    .setLabel('削除するケース番号')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 5')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(caseInput)
  );

  return modal;
}

function createBackupCreateModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_backup_create')
    .setTitle('バックアップを作成');

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('バックアップの名前')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 2025-01-backup')
    .setRequired(true);

  const messageLimitInput = new TextInputBuilder()
    .setCustomId('message_limit')
    .setLabel('チャンネル毎のメッセージ数（空欄で無制限）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('無制限（または数値を入力）')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(messageLimitInput)
  );

  return modal;
}

function createBackupRestoreModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_backup_restore')
    .setTitle('バックアップを復元');

  const idInput = new TextInputBuilder()
    .setCustomId('backup_id')
    .setLabel('復元するバックアップのID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('バックアップIDを入力')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(idInput)
  );

  return modal;
}

function createBackupDeleteModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_backup_delete')
    .setTitle('バックアップを削除');

  const idInput = new TextInputBuilder()
    .setCustomId('backup_id')
    .setLabel('削除するバックアップのIDまたは名前')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('バックアップIDまたは名前を入力')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(idInput)
  );

  return modal;
}

function createSlowmodeModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_slowmode')
    .setTitle('スローモードを設定');

  const secondsInput = new TextInputBuilder()
    .setCustomId('seconds')
    .setLabel('スローモードの秒数（0で解除）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 10（0で解除）')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(secondsInput)
  );

  return modal;
}

async function createVerificationPanel(guildId) {
  const settings = await getVerificationSettings(guildId);
  
  const embed = new EmbedBuilder()
    .setTitle('✅ 足し算認証パネル')
    .setDescription('簡単な足し算をクリアしたユーザーにロールを付与します')
    .setColor(0x00FF00)
    .addFields(
      { 
        name: '⚙️ 現在の設定', 
        value: `有効: ${settings.enabled ? '✅ はい' : '❌ いいえ'}\n付与ロール: ${settings.role_id ? `<@&${settings.role_id}>` : '未設定'}`,
        inline: false
      },
      { 
        name: '📤 認証パネルを送信', 
        value: '設定後、このボタンで認証パネルをチャンネルに送信できます',
        inline: false
      },
      { 
        name: '🧮 テスト・設定', 
        value: '管理者用の機能です',
        inline: false
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verification_send_panel')
        .setLabel('📤 認証パネルを送信')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('verification_test')
        .setLabel('🧮 テストする')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verification_config')
        .setLabel('⚙️ 設定')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row2] };
}

function createVerificationChallengeModal(num1, num2) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_verification_${num1}_${num2}`)
    .setTitle('足し算チャレンジ');

  const answerInput = new TextInputBuilder()
    .setCustomId('answer')
    .setLabel(`${num1} + ${num2} = ?`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('答えを入力してください')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(answerInput)
  );

  return modal;
}

function createVerificationConfigModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_verification_config')
    .setTitle('足し算認証の設定');

  const enabledInput = new TextInputBuilder()
    .setCustomId('enabled')
    .setLabel('有効にする（yes/no）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes または no')
    .setRequired(true);

  const roleInput = new TextInputBuilder()
    .setCustomId('role_id')
    .setLabel('付与するロールID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ロールIDを入力')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(enabledInput),
    new ActionRowBuilder().addComponents(roleInput)
  );

  return modal;
}

function createServerConfigPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ サーバーセキュリティ設定')
    .setDescription('Discord のセキュリティ設定を変更できます')
    .setColor(0x5865F2)
    .addFields(
      { name: '📋 現在の設定を表示', value: 'サーバーのセキュリティ設定を確認', inline: false },
      { name: '🔐 検証レベル', value: 'サーバーの検証レベルを変更', inline: true },
      { name: '🔞 コンテンツフィルター', value: '不適切なコンテンツのフィルタリング設定', inline: true },
      { name: '🔔 通知設定', value: 'デフォルトの通知設定を変更', inline: true }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_config_view')
        .setLabel('📋 現在の設定')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_config_verification')
        .setLabel('🔐 検証レベル')
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('server_config_filter')
        .setLabel('🔞 コンテンツフィルター')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('server_config_notifications')
        .setLabel('🔔 通知設定')
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_server')
        .setLabel('◀️ サーバー管理')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function createRolePermissionsPanel(guild) {
  const { PermissionFlagsBits } = require('discord.js');
  
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return {
      embeds: [{
        title: '❌ 権限不足',
        description: 'Botに「ロールの管理」権限がありません。\nサーバー設定でBotに権限を付与してください。',
        color: 0xFF0000
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('panel_server')
            .setLabel('◀️ サーバー管理')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    };
  }

  const roles = guild.roles.cache
    .filter(role => {
      if (role.managed) return false;
      if (role.permissions.has(PermissionFlagsBits.Administrator)) return false;
      if (role.id === guild.id) return true;
      if (role.position >= botMember.roles.highest.position) return false;
      if (!role.editable) return false;
      return true;
    })
    .sort((a, b) => b.position - a.position)
    .first(25);

  if (roles.length === 0) {
    return {
      embeds: [{
        title: '👥 ロール権限管理',
        description: '❌ 編集可能なロールがありません。\n\n管理者権限を持つロール、Botより上位のロール、または管理されたロールは編集できません。',
        color: 0xF39C12
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('panel_server')
            .setLabel('◀️ サーバー管理')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    };
  }

  const options = roles.map(role => {
    const hasPermission = role.permissions.has(PermissionFlagsBits.UseApplicationCommands);
    return {
      label: role.name,
      value: role.id,
      description: `アプリコマンド: ${hasPermission ? '✅ 許可' : '❌ 拒否'}`,
      emoji: hasPermission ? '✅' : '❌'
    };
  });

  const embed = new EmbedBuilder()
    .setTitle('👥 ロール権限管理')
    .setDescription('ロールを選択して、アプリコマンド（スラッシュコマンド）の使用権限を管理できます\n\n**注意**: 管理者権限を持つロールは編集できません')
    .setColor(0xF39C12)
    .addFields({
      name: '編集可能なロール',
      value: `${roles.length} 個のロールが編集可能です`,
      inline: false
    })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('role_permissions_select')
    .setPlaceholder('ロールを選択してください')
    .addOptions(options);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_server')
      .setLabel('◀️ サーバー管理')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function createRoleDetailPanel(guild, roleId) {
  const { PermissionFlagsBits } = require('discord.js');
  
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    return {
      embeds: [{
        title: '❌ エラー',
        description: 'ロールが見つかりません。',
        color: 0xFF0000
      }],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('server_role_permissions')
            .setLabel('◀️ ロール一覧')
            .setStyle(ButtonStyle.Primary)
        )
      ]
    };
  }

  const hasPermission = role.permissions.has(PermissionFlagsBits.UseApplicationCommands);
  const memberCount = role.members.size;

  const embed = new EmbedBuilder()
    .setTitle(`👥 ロール詳細: ${role.name}`)
    .setDescription('このロールのアプリコマンド使用権限を管理できます')
    .setColor(role.color || 0xF39C12)
    .addFields(
      { name: 'ロールID', value: role.id, inline: true },
      { name: 'メンバー数', value: `${memberCount} 人`, inline: true },
      { name: '位置', value: `${role.position}`, inline: true },
      { 
        name: '現在の設定', 
        value: hasPermission 
          ? '✅ アプリコマンドの使用が **許可** されています' 
          : '❌ アプリコマンドの使用が **拒否** されています',
        inline: false
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`role_toggle_${roleId}`)
      .setLabel(hasPermission ? '❌ 使用を拒否する' : '✅ 使用を許可する')
      .setStyle(hasPermission ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('server_role_permissions')
      .setLabel('◀️ ロール一覧')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function createPublicVerificationPanel(settings) {
  const embed = new EmbedBuilder()
    .setTitle('✅ 認証パネル')
    .setDescription('以下のボタンを押して足し算チャレンジに挑戦し、ロールを取得してください！')
    .setColor(0x00FF00)
    .addFields(
      { 
        name: '📋 説明', 
        value: '簡単な足し算問題に正解すると、自動的にロールが付与されます。',
        inline: false
      },
      { 
        name: '🎯 付与されるロール', 
        value: settings.role_id ? `<@&${settings.role_id}>` : '未設定',
        inline: false
      }
    )
    .setFooter({ text: 'ボタンを押して認証を開始してください' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('verification_start')
        .setLabel('🎯 認証を受ける')
        .setStyle(ButtonStyle.Success)
    );

  return { embeds: [embed], components: [row] };
}

async function createTicketPanel(guild) {
  const settings = await getTicketSettings(guild.id);
  const activeTickets = await getActiveTickets(guild.id);
  
  const staffRole = settings.staff_role_id ? guild.roles.cache.get(settings.staff_role_id) : null;
  
  const embed = new EmbedBuilder()
    .setTitle('🎫 チケットシステム')
    .setDescription('ユーザーがボタンを押すことで専用のプライベートチャンネルを作成できます\n\n💡 チケットはボタンを押したチャンネルと同じカテゴリに作成されます')
    .setColor(0x9B59B6)
    .addFields(
      { 
        name: '⚙️ 現在の設定', 
        value: `有効: ${settings.enabled ? '✅ はい' : '❌ いいえ'}\nスタッフロール: ${staffRole ? staffRole.name : '管理者のみ'}`,
        inline: false
      },
      { 
        name: '📊 アクティブチケット', 
        value: `現在のチケット数: ${activeTickets.length} 個`,
        inline: false
      },
      { 
        name: '📤 チケット作成ボタンを送信', 
        value: '有効にした後、このボタンでチケット作成パネルをチャンネルに送信できます',
        inline: false
      }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_send_panel')
        .setLabel('📤 チケット作成ボタンを送信')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!settings.enabled),
      new ButtonBuilder()
        .setCustomId('ticket_list')
        .setLabel('📋 アクティブチケット一覧')
        .setStyle(ButtonStyle.Primary)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_config')
        .setLabel('⚙️ 基本設定')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_config_advanced')
        .setLabel('🎨 詳細設定')
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('panel_back')
        .setLabel('◀️ メインメニュー')
        .setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function createPublicTicketPanel(settings = {}) {
  const title = settings.panel_title || '🎫 サポートチケット';
  const description = settings.panel_description || 'サポートが必要ですか？下のボタンを押して専用のチケットチャンネルを作成してください。';
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x9B59B6)
    .addFields(
      { 
        name: '📋 使い方', 
        value: 'ボタンを押すと、あなた専用のプライベートチャンネルが作成されます。\nそこでスタッフとやり取りができます。',
        inline: false
      },
      { 
        name: '⚠️ 注意', 
        value: '既にチケットを開いている場合は、新しいチケットを作成できません。',
        inline: false
      }
    )
    .setFooter({ text: 'ボタンを押してチケットを作成' })
    .setTimestamp();
  
  if (settings.is_paid && settings.required_item_id) {
    embed.addFields({
      name: '💰 有料チケット',
      value: `このチケットを作成するには、アイテム「${settings.required_item_id}」が必要です。\nチケット作成時にアイテムが消費されます。`,
      inline: false
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('🎫 チケットを作成')
        .setStyle(ButtonStyle.Success)
    );

  return { embeds: [embed], components: [row] };
}

function createTicketConfigModal(settings) {
  const modal = new ModalBuilder()
    .setCustomId('modal_ticket_config')
    .setTitle('チケット基本設定');

  const enabledInput = new TextInputBuilder()
    .setCustomId('enabled')
    .setLabel('有効にしますか？ (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes または no')
    .setValue(settings.enabled ? 'yes' : 'no')
    .setRequired(true);

  const staffRoleInput = new TextInputBuilder()
    .setCustomId('staff_role_id')
    .setLabel('スタッフロールID（任意）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('未入力の場合は管理者のみ')
    .setValue(settings.staff_role_id || '')
    .setRequired(false);

  const row1 = new ActionRowBuilder().addComponents(enabledInput);
  const row2 = new ActionRowBuilder().addComponents(staffRoleInput);

  modal.addComponents(row1, row2);

  return modal;
}

function createTicketConfigAdvancedModal(settings) {
  const modal = new ModalBuilder()
    .setCustomId('modal_ticket_config_advanced')
    .setTitle('チケット詳細設定');

  const isPaidInput = new TextInputBuilder()
    .setCustomId('is_paid')
    .setLabel('有料チケットにしますか？ (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes または no')
    .setValue(settings.is_paid ? 'yes' : 'no')
    .setRequired(true);

  const requiredItemInput = new TextInputBuilder()
    .setCustomId('required_item_id')
    .setLabel('必要アイテムIDまたは名前（有料の場合のみ）')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: ticket_item または チケット')
    .setValue(settings.required_item_id || '')
    .setRequired(false);

  const panelTitleInput = new TextInputBuilder()
    .setCustomId('panel_title')
    .setLabel('パネルタイトル')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('🎫 サポートチケット')
    .setValue(settings.panel_title || '')
    .setRequired(false);

  const panelDescInput = new TextInputBuilder()
    .setCustomId('panel_description')
    .setLabel('パネル説明')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('サポートが必要ですか？...')
    .setValue(settings.panel_description || '')
    .setRequired(false);

  const welcomeMsgInput = new TextInputBuilder()
    .setCustomId('welcome_message')
    .setLabel('ウェルカムメッセージ（{user}で置換）')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('こんにちは {user}さん！...')
    .setValue(settings.welcome_message || '')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(isPaidInput),
    new ActionRowBuilder().addComponents(requiredItemInput),
    new ActionRowBuilder().addComponents(panelTitleInput),
    new ActionRowBuilder().addComponents(panelDescInput),
    new ActionRowBuilder().addComponents(welcomeMsgInput)
  );

  return modal;
}

module.exports = {
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
};
