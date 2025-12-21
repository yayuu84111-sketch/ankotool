const fs = require('fs').promises;
const path = require('path');

const STORAGE_DIR = path.join(__dirname);
const GUILD_SETTINGS_FILE = path.join(STORAGE_DIR, 'guild_settings.json');
const SPAM_SETTINGS_FILE = path.join(STORAGE_DIR, 'spam_settings.json');
const NSFW_KEYWORDS_FILE = path.join(STORAGE_DIR, 'nsfw_keywords.json');
const BANNED_WORDS_FILE = path.join(STORAGE_DIR, 'banned_words.json');
const WARNINGS_FILE = path.join(STORAGE_DIR, 'warnings.json');
const MODERATION_CASES_FILE = path.join(STORAGE_DIR, 'moderation_cases.json');
const COMMAND_SPAM_SETTINGS_FILE = path.join(STORAGE_DIR, 'command_spam_settings.json');
const VERIFICATION_SETTINGS_FILE = path.join(STORAGE_DIR, 'verification_settings.json');
const TICKET_SETTINGS_FILE = path.join(STORAGE_DIR, 'ticket_settings.json');
const TICKET_CHANNELS_FILE = path.join(STORAGE_DIR, 'ticket_channels.json');
const ANKO_DOLLAR_FILE = path.join(STORAGE_DIR, 'anko_dollar.json');
const DAILY_CLAIMS_FILE = path.join(STORAGE_DIR, 'daily_claims.json');
const WORK_COOLDOWNS_FILE = path.join(STORAGE_DIR, 'work_cooldowns.json');
const USER_INVENTORIES_FILE = path.join(STORAGE_DIR, 'user_inventories.json');
const SHOP_ITEMS_FILE = path.join(STORAGE_DIR, 'shop_items.json');
const AJACK_SETTINGS_FILE = path.join(STORAGE_DIR, 'ajack_settings.json');
const CHAT_COOLDOWNS_FILE = path.join(STORAGE_DIR, 'chat_cooldowns.json');
const BANK_ACCOUNTS_FILE = path.join(STORAGE_DIR, 'bank_accounts.json');
const STEAL_SETTINGS_FILE = path.join(STORAGE_DIR, 'steal_settings.json');
const STEAL_COOLDOWNS_FILE = path.join(STORAGE_DIR, 'steal_cooldowns.json');
const ALLOWED_USERS_FILE = path.join(STORAGE_DIR, 'allowed_users.json');
const USER_TOKENS_FILE = path.join(STORAGE_DIR, 'user_tokens.json');
const GUILD_MEMBERS_FILE = path.join(STORAGE_DIR, 'guild_members.json');
const USER_CUSTOM_MESSAGES_FILE = path.join(STORAGE_DIR, 'user_custom_messages.json');
const RECORDED_MESSAGES_FILE = path.join(STORAGE_DIR, 'recorded_messages.json');
const LICENSE_SETTINGS_FILE = path.join(STORAGE_DIR, 'license_settings.json');
const ALINK_SETTINGS_FILE = path.join(STORAGE_DIR, 'alink_settings.json');
const AUTOSCAN_STATE_FILE = path.join(STORAGE_DIR, 'autoscan_state.json');
const AUTOSCAN_PANEL_CONFIG_FILE = path.join(STORAGE_DIR, 'autoscan_panel_config.json');
const DISCORD_SETTINGS_FILE = path.join(STORAGE_DIR, 'discord_settings.json');

const guildSettingsCache = new Map();
const spamSettingsCache = new Map();
const nsfwKeywordsCache = new Map();
const bannedWordsCache = new Map();
const warningsCache = new Map();
const moderationCasesCache = new Map();
const spamTrackerCache = new Map();
const commandSpamSettingsCache = new Map();
const commandSpamTrackerCache = new Map();
const verificationSettingsCache = new Map();
const ticketSettingsCache = new Map();
const ticketChannelsCache = new Map();
const ankoDollarCache = new Map();
const dailyClaimsCache = new Map();
const workCooldownsCache = new Map();
const userInventoriesCache = new Map();
const chatCooldownsCache = new Map();
let shopItemsCache = {};
const ajackSettingsCache = new Map();
const bankAccountsCache = new Map();
const stealSettingsCache = new Map();
const stealCooldownsCache = new Map();
let allowedUsersCache = new Set();
let userTokensCache = new Map();
let guildMembersCache = new Map();
let userCustomMessagesCache = new Map();
let recordedMessagesCache = new Map();
let licenseSettingsCache = null;
let alinkSettingsCache = new Map();

let isInitialized = false;
const pendingSaves = new Set();

async function ensureFile(filePath, defaultData = {}) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
  }
}

async function safeReadJSON(filePath, defaultData = {}) {
  try {
    await ensureFile(filePath, defaultData);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ ファイル読み込みエラー (${path.basename(filePath)}):`, error.message);
    return defaultData;
  }
}

async function safeWriteJSON(filePath, data) {
  try {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
  } catch (error) {
    console.error(`❌ ファイル書き込みエラー (${path.basename(filePath)}):`, error.message);
    throw error;
  }
}

async function debouncedSave(filePath, getData, cacheKey) {
  if (pendingSaves.has(cacheKey)) {
    return;
  }
  
  pendingSaves.add(cacheKey);
  
  setTimeout(async () => {
    try {
      const data = getData();
      await safeWriteJSON(filePath, data);
    } catch (error) {
      console.error(`保存失敗 (${cacheKey}):`, error);
    } finally {
      pendingSaves.delete(cacheKey);
    }
  }, 2000);
}

async function initializeStorage() {
  if (isInitialized) return;
  
  console.log('📁 ファイルストレージを初期化中...');
  
  try {
    const [guildSettings, spamSettings, nsfwKeywords, bannedWords, warnings, moderationCases, commandSpamSettings, verificationSettings, ticketSettings, ticketChannels, ankoDollar, dailyClaims, workCooldowns, userInventories, shopItems, ajackSettings, chatCooldowns, bankAccounts, stealSettings, stealCooldowns, allowedUsers, userTokens, guildMembers, userCustomMessages, recordedMessages] = await Promise.all([
      safeReadJSON(GUILD_SETTINGS_FILE, {}),
      safeReadJSON(SPAM_SETTINGS_FILE, {}),
      safeReadJSON(NSFW_KEYWORDS_FILE, {}),
      safeReadJSON(BANNED_WORDS_FILE, {}),
      safeReadJSON(WARNINGS_FILE, {}),
      safeReadJSON(MODERATION_CASES_FILE, {}),
      safeReadJSON(COMMAND_SPAM_SETTINGS_FILE, {}),
      safeReadJSON(VERIFICATION_SETTINGS_FILE, {}),
      safeReadJSON(TICKET_SETTINGS_FILE, {}),
      safeReadJSON(TICKET_CHANNELS_FILE, {}),
      safeReadJSON(ANKO_DOLLAR_FILE, {}),
      safeReadJSON(DAILY_CLAIMS_FILE, {}),
      safeReadJSON(WORK_COOLDOWNS_FILE, {}),
      safeReadJSON(USER_INVENTORIES_FILE, {}),
      safeReadJSON(SHOP_ITEMS_FILE, {
        items: {
          'lucky_charm': { name: 'ラッキーチャーム', price: 500, description: '幸運を呼ぶアイテム', emoji: '🍀' },
          'golden_coin': { name: 'ゴールドコイン', price: 1000, description: '価値のあるコイン', emoji: '💰' },
          'mystery_box': { name: 'ミステリーボックス', price: 2000, description: '何が入っているかお楽しみ', emoji: '🎁' }
        }
      }),
      safeReadJSON(AJACK_SETTINGS_FILE, {}),
      safeReadJSON(CHAT_COOLDOWNS_FILE, {}),
      safeReadJSON(BANK_ACCOUNTS_FILE, {}),
      safeReadJSON(STEAL_SETTINGS_FILE, {}),
      safeReadJSON(STEAL_COOLDOWNS_FILE, {}),
      safeReadJSON(ALLOWED_USERS_FILE, {
        users: [
          '1355868833419759788',
          '1430321584601567364',
          '1397134657744797768',
          '1305355269374738474',
          '1422489752590090392',
          '1356873836532076554',
          '1176363895850553404',
          '1426484549457547314',
          '1440485053300998215',
          '1343465442177585245',
          'free',
          '1416121924144206034',
          '1263172966913540218',
          '872438430313893899',
          '1370019263703941221'
        ]
      }),
      safeReadJSON(USER_TOKENS_FILE, {}),
      safeReadJSON(GUILD_MEMBERS_FILE, {}),
      safeReadJSON(USER_CUSTOM_MESSAGES_FILE, {}),
      safeReadJSON(RECORDED_MESSAGES_FILE, {})
    ]);
    
    for (const [key, value] of Object.entries(guildSettings)) {
      guildSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(spamSettings)) {
      spamSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(nsfwKeywords)) {
      nsfwKeywordsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(bannedWords)) {
      bannedWordsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(warnings)) {
      warningsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(moderationCases)) {
      moderationCasesCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(commandSpamSettings)) {
      commandSpamSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(verificationSettings)) {
      verificationSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(ticketSettings)) {
      ticketSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(ticketChannels)) {
      ticketChannelsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(ankoDollar)) {
      ankoDollarCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(dailyClaims)) {
      dailyClaimsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(workCooldowns)) {
      workCooldownsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(userInventories)) {
      userInventoriesCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(chatCooldowns)) {
      chatCooldownsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(ajackSettings)) {
      ajackSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(bankAccounts)) {
      bankAccountsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(stealSettings)) {
      stealSettingsCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(stealCooldowns)) {
      stealCooldownsCache.set(key, value);
    }
    
    if (allowedUsers && allowedUsers.users && Array.isArray(allowedUsers.users)) {
      allowedUsersCache = new Set(allowedUsers.users);
    }
    
    for (const [key, value] of Object.entries(userTokens)) {
      userTokensCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(guildMembers)) {
      guildMembersCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(userCustomMessages)) {
      userCustomMessagesCache.set(key, value);
    }
    
    for (const [key, value] of Object.entries(recordedMessages)) {
      recordedMessagesCache.set(key, value);
    }
    
    shopItemsCache = shopItems;
    
    isInitialized = true;
    console.log('✅ ファイルストレージの初期化完了');
    
    cleanExpiredRecordedMessages();
  } catch (error) {
    console.error('❌ ストレージ初期化エラー:', error);
    isInitialized = true;
  }
}

async function getGuildSettings(guildId) {
  await initializeStorage();
  
  if (!guildSettingsCache.has(guildId)) {
    const defaults = {
      prefix: '!',
      auto_mod_enabled: true,
      join_raid_protection: true,
      antinuke_enabled: true,
      allow_application_commands: false,
      message_log_enabled: false,
      moderation_log_enabled: false,
      member_log_enabled: false,
      timeout_log_enabled: false,
      log_channel_id: null,
      raid_mode_enabled: false,
      image_spam_enabled: true
    };
    guildSettingsCache.set(guildId, defaults);
    
    debouncedSave(GUILD_SETTINGS_FILE, () => {
      const obj = {};
      for (const [k, v] of guildSettingsCache) obj[k] = v;
      return obj;
    }, 'guild_settings');
  }
  
  return guildSettingsCache.get(guildId);
}

async function updateGuildSettings(guildId, settings) {
  await initializeStorage();
  
  const current = guildSettingsCache.get(guildId) || {};
  const updated = { ...current, ...settings };
  guildSettingsCache.set(guildId, updated);
  
  debouncedSave(GUILD_SETTINGS_FILE, () => {
    const obj = {};
    for (const [k, v] of guildSettingsCache) obj[k] = v;
    return obj;
  }, 'guild_settings');
  
  return updated;
}

async function getAntiSpamSettings(guildId) {
  await initializeStorage();
  
  const defaults = {
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
    random_suffix_detection: true,
    image_spam_max_images: 5,
    image_spam_time_window: 10
  };
  
  if (!spamSettingsCache.has(guildId)) {
    spamSettingsCache.set(guildId, { ...defaults });
    
    debouncedSave(SPAM_SETTINGS_FILE, () => {
      const obj = {};
      for (const [k, v] of spamSettingsCache) obj[k] = v;
      return obj;
    }, 'spam_settings');
  } else {
    const current = spamSettingsCache.get(guildId);
    const merged = { ...defaults, ...current };
    spamSettingsCache.set(guildId, merged);
  }
  
  return spamSettingsCache.get(guildId);
}

async function updateAntiSpamSettings(guildId, settings) {
  await initializeStorage();
  
  const current = spamSettingsCache.get(guildId) || {};
  const updated = { ...current, ...settings };
  spamSettingsCache.set(guildId, updated);
  
  debouncedSave(SPAM_SETTINGS_FILE, () => {
    const obj = {};
    for (const [k, v] of spamSettingsCache) obj[k] = v;
    return obj;
  }, 'spam_settings');
  
  return updated;
}

async function getNSFWKeywords(guildId) {
  await initializeStorage();
  return nsfwKeywordsCache.get(guildId) || [];
}

async function addNSFWKeyword(guildId, keyword) {
  await initializeStorage();
  
  const keywords = nsfwKeywordsCache.get(guildId) || [];
  const lowerKeyword = keyword.toLowerCase();
  
  if (keywords.includes(lowerKeyword)) {
    return null;
  }
  
  keywords.push(lowerKeyword);
  nsfwKeywordsCache.set(guildId, keywords);
  
  debouncedSave(NSFW_KEYWORDS_FILE, () => {
    const obj = {};
    for (const [k, v] of nsfwKeywordsCache) obj[k] = v;
    return obj;
  }, 'nsfw_keywords');
  
  return { keyword: lowerKeyword };
}

async function removeNSFWKeyword(guildId, keyword) {
  await initializeStorage();
  
  const keywords = nsfwKeywordsCache.get(guildId) || [];
  const lowerKeyword = keyword.toLowerCase();
  const index = keywords.indexOf(lowerKeyword);
  
  if (index === -1) {
    return null;
  }
  
  keywords.splice(index, 1);
  nsfwKeywordsCache.set(guildId, keywords);
  
  debouncedSave(NSFW_KEYWORDS_FILE, () => {
    const obj = {};
    for (const [k, v] of nsfwKeywordsCache) obj[k] = v;
    return obj;
  }, 'nsfw_keywords');
  
  return { keyword: lowerKeyword };
}

async function getBannedWords(guildId) {
  await initializeStorage();
  return bannedWordsCache.get(guildId) || [];
}

async function addBannedWord(guildId, word) {
  await initializeStorage();
  
  const words = bannedWordsCache.get(guildId) || [];
  const lowerWord = word.toLowerCase();
  
  if (words.includes(lowerWord)) {
    return null;
  }
  
  words.push(lowerWord);
  bannedWordsCache.set(guildId, words);
  
  debouncedSave(BANNED_WORDS_FILE, () => {
    const obj = {};
    for (const [k, v] of bannedWordsCache) obj[k] = v;
    return obj;
  }, 'banned_words');
  
  return { word: lowerWord };
}

async function removeBannedWord(guildId, word) {
  await initializeStorage();
  
  const words = bannedWordsCache.get(guildId) || [];
  const lowerWord = word.toLowerCase();
  const index = words.indexOf(lowerWord);
  
  if (index === -1) {
    return null;
  }
  
  words.splice(index, 1);
  bannedWordsCache.set(guildId, words);
  
  debouncedSave(BANNED_WORDS_FILE, () => {
    const obj = {};
    for (const [k, v] of bannedWordsCache) obj[k] = v;
    return obj;
  }, 'banned_words');
  
  return { word: lowerWord };
}

async function updateSpamTracker(guildId, userId, messageContent, imageCount = 0) {
  const settings = await getAntiSpamSettings(guildId);
  const key = `${guildId}_${userId}`;
  const now = Date.now();
  const timeWindow = settings.time_window * 1000;
  
  const tracker = spamTrackerCache.get(key);
  
  if (!tracker || now - tracker.first_message_at > timeWindow) {
    const newTracker = {
      guild_id: guildId,
      user_id: userId,
      first_message_at: now,
      last_message_at: now,
      last_message: messageContent,
      message_count: 1,
      duplicate_count: 0,
      image_count: imageCount,
      recent_messages: [messageContent]
    };
    spamTrackerCache.set(key, newTracker);
    return { message_count: 1, duplicate_count: 0, image_count: imageCount, recent_messages: [messageContent], first_message_at: now, last_message_at: now };
  }
  
  const isDuplicate = tracker.last_message === messageContent;
  
  tracker.message_count += 1;
  tracker.duplicate_count += isDuplicate ? 1 : 0;
  tracker.image_count = (tracker.image_count || 0) + imageCount;
  tracker.last_message = messageContent;
  tracker.last_message_at = now;
  
  if (!tracker.recent_messages) {
    tracker.recent_messages = [];
  }
  tracker.recent_messages.push(messageContent);
  if (tracker.recent_messages.length > 10) {
    tracker.recent_messages.shift();
  }
  
  return {
    message_count: tracker.message_count,
    duplicate_count: tracker.duplicate_count,
    image_count: tracker.image_count,
    recent_messages: tracker.recent_messages,
    first_message_at: tracker.first_message_at,
    last_message_at: tracker.last_message_at
  };
}

function cleanOldSpamTrackers() {
  const now = Date.now();
  const maxAge = 60000;
  
  for (const [key, tracker] of spamTrackerCache) {
    if (now - tracker.last_message_at > maxAge) {
      spamTrackerCache.delete(key);
    }
  }
}

async function addWarning(guildId, userId, moderatorId, reason) {
  await initializeStorage();
  
  const key = `${guildId}_${userId}`;
  const warnings = warningsCache.get(key) || [];
  
  const warning = {
    id: Date.now().toString(),
    guild_id: guildId,
    user_id: userId,
    moderator_id: moderatorId,
    reason: reason,
    created_at: new Date().toISOString()
  };
  
  warnings.push(warning);
  warningsCache.set(key, warnings);
  
  debouncedSave(WARNINGS_FILE, () => {
    const obj = {};
    for (const [k, v] of warningsCache) obj[k] = v;
    return obj;
  }, 'warnings');
  
  return warning;
}

async function getWarningCount(guildId, userId) {
  await initializeStorage();
  const key = `${guildId}_${userId}`;
  const warnings = warningsCache.get(key) || [];
  return warnings.length;
}

async function getWarnings(guildId, userId) {
  await initializeStorage();
  const key = `${guildId}_${userId}`;
  return warningsCache.get(key) || [];
}

async function clearWarnings(guildId, userId) {
  await initializeStorage();
  const key = `${guildId}_${userId}`;
  const warnings = warningsCache.get(key) || [];
  const count = warnings.length;
  warningsCache.delete(key);
  
  debouncedSave(WARNINGS_FILE, () => {
    const obj = {};
    for (const [k, v] of warningsCache) obj[k] = v;
    return obj;
  }, 'warnings');
  
  return count;
}

const maxCaseNumbers = new Map();

async function createModerationCase(guildId, userId, moderatorId, actionType, reason, expiresAt = null) {
  await initializeStorage();
  
  const cases = moderationCasesCache.get(guildId) || [];
  
  let maxCaseNum = maxCaseNumbers.get(guildId) || 0;
  if (maxCaseNum === 0 && cases.length > 0) {
    maxCaseNum = Math.max(...cases.map(c => c.case_number));
  }
  const caseNumber = maxCaseNum + 1;
  maxCaseNumbers.set(guildId, caseNumber);
  
  const moderationCase = {
    id: Date.now().toString(),
    guild_id: guildId,
    case_number: caseNumber,
    user_id: userId,
    moderator_id: moderatorId,
    action_type: actionType,
    reason: reason,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  };
  
  cases.push(moderationCase);
  moderationCasesCache.set(guildId, cases);
  
  debouncedSave(MODERATION_CASES_FILE, () => {
    const obj = {};
    for (const [k, v] of moderationCasesCache) obj[k] = v;
    return obj;
  }, 'moderation_cases');
  
  return moderationCase;
}

async function getModerationCases(guildId, limit = 10) {
  await initializeStorage();
  const cases = moderationCasesCache.get(guildId) || [];
  return cases.slice(-limit).reverse();
}

async function deleteModerationCase(guildId, caseNumber) {
  await initializeStorage();
  
  const cases = moderationCasesCache.get(guildId) || [];
  const index = cases.findIndex(c => c.case_number === caseNumber);
  
  if (index === -1) {
    return null;
  }
  
  const deletedCase = cases[index];
  cases.splice(index, 1);
  moderationCasesCache.set(guildId, cases);
  
  debouncedSave(MODERATION_CASES_FILE, () => {
    const obj = {};
    for (const [k, v] of moderationCasesCache) obj[k] = v;
    return obj;
  }, 'moderation_cases');
  
  return deletedCase;
}

async function getCommandSpamSettings(guildId) {
  await initializeStorage();
  
  const defaults = {
    enabled: true,
    max_commands: 5,
    time_window: 10,
    timeout_duration: 5,
    exclude_admins: true
  };
  
  if (!commandSpamSettingsCache.has(guildId)) {
    commandSpamSettingsCache.set(guildId, { ...defaults });
    
    debouncedSave(COMMAND_SPAM_SETTINGS_FILE, () => {
      const obj = {};
      for (const [k, v] of commandSpamSettingsCache) obj[k] = v;
      return obj;
    }, 'command_spam_settings');
  }
  
  return commandSpamSettingsCache.get(guildId);
}

async function updateCommandSpamSettings(guildId, settings) {
  await initializeStorage();
  
  const current = commandSpamSettingsCache.get(guildId) || {};
  const updated = { ...current, ...settings };
  commandSpamSettingsCache.set(guildId, updated);
  
  debouncedSave(COMMAND_SPAM_SETTINGS_FILE, () => {
    const obj = {};
    for (const [k, v] of commandSpamSettingsCache) obj[k] = v;
    return obj;
  }, 'command_spam_settings');
  
  return updated;
}

async function trackCommandExecution(guildId, userId, commandName) {
  const key = `${guildId}-${userId}`;
  const now = Date.now();
  
  if (!commandSpamTrackerCache.has(key)) {
    commandSpamTrackerCache.set(key, []);
  }
  
  const executions = commandSpamTrackerCache.get(key);
  executions.push({ commandName, timestamp: now });
  
  const settings = await getCommandSpamSettings(guildId);
  const timeWindow = settings.time_window * 1000;
  
  const recentExecutions = executions.filter(e => now - e.timestamp < timeWindow);
  commandSpamTrackerCache.set(key, recentExecutions);
  
  return {
    count: recentExecutions.length,
    commands: recentExecutions
  };
}

async function checkCommandSpam(guildId, userId, commandName) {
  const tracker = await trackCommandExecution(guildId, userId, commandName);
  const settings = await getCommandSpamSettings(guildId);
  
  if (!settings.enabled) {
    return { isSpam: false, count: tracker.count };
  }
  
  const isSpam = tracker.count >= settings.max_commands;
  
  return {
    isSpam,
    count: tracker.count,
    maxCommands: settings.max_commands,
    timeWindow: settings.time_window,
    timeoutDuration: settings.timeout_duration
  };
}

function cleanOldCommandSpamTrackers() {
  const now = Date.now();
  const maxAge = 60000;
  
  for (const [key, executions] of commandSpamTrackerCache.entries()) {
    const recent = executions.filter(e => now - e.timestamp < maxAge);
    if (recent.length === 0) {
      commandSpamTrackerCache.delete(key);
    } else {
      commandSpamTrackerCache.set(key, recent);
    }
  }
}

setInterval(cleanOldSpamTrackers, 30000);
setInterval(cleanOldCommandSpamTrackers, 30000);

process.on('SIGTERM', async () => {
  console.log('シャットダウン中... データを保存しています...');
  
  await Promise.all([
    safeWriteJSON(GUILD_SETTINGS_FILE, Object.fromEntries(guildSettingsCache)),
    safeWriteJSON(SPAM_SETTINGS_FILE, Object.fromEntries(spamSettingsCache)),
    safeWriteJSON(NSFW_KEYWORDS_FILE, Object.fromEntries(nsfwKeywordsCache)),
    safeWriteJSON(BANNED_WORDS_FILE, Object.fromEntries(bannedWordsCache)),
    safeWriteJSON(WARNINGS_FILE, Object.fromEntries(warningsCache)),
    safeWriteJSON(MODERATION_CASES_FILE, Object.fromEntries(moderationCasesCache)),
    safeWriteJSON(COMMAND_SPAM_SETTINGS_FILE, Object.fromEntries(commandSpamSettingsCache)),
    safeWriteJSON(VERIFICATION_SETTINGS_FILE, Object.fromEntries(verificationSettingsCache)),
    safeWriteJSON(TICKET_SETTINGS_FILE, Object.fromEntries(ticketSettingsCache)),
    safeWriteJSON(TICKET_CHANNELS_FILE, Object.fromEntries(ticketChannelsCache)),
    safeWriteJSON(ANKO_DOLLAR_FILE, Object.fromEntries(ankoDollarCache)),
    safeWriteJSON(DAILY_CLAIMS_FILE, Object.fromEntries(dailyClaimsCache)),
    safeWriteJSON(BANK_ACCOUNTS_FILE, Object.fromEntries(bankAccountsCache)),
    safeWriteJSON(STEAL_SETTINGS_FILE, Object.fromEntries(stealSettingsCache)),
    safeWriteJSON(STEAL_COOLDOWNS_FILE, Object.fromEntries(stealCooldownsCache))
  ]);
  
  console.log('✅ データ保存完了');
  process.exit(0);
});

async function getVerificationSettings(guildId) {
  if (!verificationSettingsCache.has(guildId)) {
    verificationSettingsCache.set(guildId, {
      enabled: false,
      role_id: null
    });
  }
  return verificationSettingsCache.get(guildId);
}

async function updateVerificationSettings(guildId, settings) {
  const current = await getVerificationSettings(guildId);
  const updated = { ...current, ...settings };
  verificationSettingsCache.set(guildId, updated);
  
  await debouncedSave(
    VERIFICATION_SETTINGS_FILE,
    () => Object.fromEntries(verificationSettingsCache),
    `verification-${guildId}`
  );
  
  return updated;
}

async function getTicketSettings(guildId) {
  if (!ticketSettingsCache.has(guildId)) {
    ticketSettingsCache.set(guildId, {
      enabled: false,
      staff_role_id: null,
      button_message_id: null,
      button_channel_id: null,
      is_paid: false,
      required_item_id: null,
      panel_title: '🎫 サポートチケット',
      panel_description: 'サポートが必要ですか？下のボタンを押して専用のチケットチャンネルを作成してください。',
      welcome_message: 'こんにちは {user}さん！\n\nサポートスタッフがすぐに対応します。\n問題を詳しく説明してください。'
    });
  }
  const settings = ticketSettingsCache.get(guildId);
  
  if (settings.is_paid === undefined) settings.is_paid = false;
  if (settings.required_item_id === undefined) settings.required_item_id = null;
  if (!settings.panel_title) settings.panel_title = '🎫 サポートチケット';
  if (!settings.panel_description) settings.panel_description = 'サポートが必要ですか？下のボタンを押して専用のチケットチャンネルを作成してください。';
  if (!settings.welcome_message) settings.welcome_message = 'こんにちは {user}さん！\n\nサポートスタッフがすぐに対応します。\n問題を詳しく説明してください。';
  
  return settings;
}

async function updateTicketSettings(guildId, settings) {
  const current = await getTicketSettings(guildId);
  const updated = { ...current, ...settings };
  ticketSettingsCache.set(guildId, updated);
  
  await debouncedSave(
    TICKET_SETTINGS_FILE,
    () => Object.fromEntries(ticketSettingsCache),
    `ticket-settings-${guildId}`
  );
  
  return updated;
}

async function createTicketChannel(guildId, channelId, userId, ticketNumber) {
  const key = `${guildId}-${channelId}`;
  const ticketData = {
    guild_id: guildId,
    channel_id: channelId,
    user_id: userId,
    ticket_number: ticketNumber,
    created_at: Date.now(),
    closed: false
  };
  
  ticketChannelsCache.set(key, ticketData);
  
  await debouncedSave(
    TICKET_CHANNELS_FILE,
    () => Object.fromEntries(ticketChannelsCache),
    `ticket-channel-${key}`
  );
  
  return ticketData;
}

async function getTicketChannel(guildId, channelId) {
  const key = `${guildId}-${channelId}`;
  return ticketChannelsCache.get(key) || null;
}

async function closeTicketChannel(guildId, channelId) {
  const key = `${guildId}-${channelId}`;
  const ticket = ticketChannelsCache.get(key);
  
  if (ticket) {
    ticket.closed = true;
    ticket.closed_at = Date.now();
    ticketChannelsCache.set(key, ticket);
    
    await debouncedSave(
      TICKET_CHANNELS_FILE,
      () => Object.fromEntries(ticketChannelsCache),
      `ticket-channel-${key}`
    );
  }
  
  return ticket;
}

async function getActiveTickets(guildId) {
  const tickets = [];
  for (const [key, ticket] of ticketChannelsCache.entries()) {
    if (ticket.guild_id === guildId && !ticket.closed) {
      tickets.push(ticket);
    }
  }
  return tickets;
}

async function getNextTicketNumber(guildId) {
  const tickets = [];
  for (const [key, ticket] of ticketChannelsCache.entries()) {
    if (ticket.guild_id === guildId) {
      tickets.push(ticket.ticket_number);
    }
  }
  return tickets.length > 0 ? Math.max(...tickets) + 1 : 1;
}

async function getAnkoDollarBalance(userId) {
  await initializeStorage();
  return ankoDollarCache.get(userId) ?? null;
}

async function updateAnkoDollarBalance(userId, balance) {
  await initializeStorage();
  ankoDollarCache.set(userId, balance);
  
  await debouncedSave(
    ANKO_DOLLAR_FILE,
    () => Object.fromEntries(ankoDollarCache),
    `anko-dollar-${userId}`
  );
}

async function getLastDaily(userId) {
  await initializeStorage();
  return dailyClaimsCache.get(userId) || null;
}

async function updateLastDaily(userId, timestamp) {
  await initializeStorage();
  dailyClaimsCache.set(userId, timestamp);
  
  await debouncedSave(
    DAILY_CLAIMS_FILE,
    () => Object.fromEntries(dailyClaimsCache),
    `daily-claim-${userId}`
  );
}

async function getWorkCooldown(userId) {
  await initializeStorage();
  return workCooldownsCache.get(userId) || null;
}

async function updateWorkCooldown(userId, timestamp) {
  await initializeStorage();
  workCooldownsCache.set(userId, timestamp);
  
  await debouncedSave(
    WORK_COOLDOWNS_FILE,
    () => Object.fromEntries(workCooldownsCache),
    `work-cooldown-${userId}`
  );
}

async function getUserInventory(userId) {
  await initializeStorage();
  return userInventoriesCache.get(userId) || null;
}

async function updateUserInventory(userId, inventory) {
  await initializeStorage();
  userInventoriesCache.set(userId, inventory);
  
  await debouncedSave(
    USER_INVENTORIES_FILE,
    () => Object.fromEntries(userInventoriesCache),
    `inventory-${userId}`
  );
}

async function getShopItems() {
  await initializeStorage();
  return shopItemsCache.items || {};
}

async function updateShopItems(items) {
  await initializeStorage();
  shopItemsCache.items = items;
  
  await debouncedSave(
    SHOP_ITEMS_FILE,
    () => shopItemsCache,
    'shop-items'
  );
}

async function getAjackSettings(guildId) {
  await initializeStorage();
  
  const defaults = {
    workRewardMin: 50,
    workRewardMax: 150,
    workCooldown: 30 * 60 * 1000,
    enableLegacyCommands: false,
    purchaseRoleId: null,
    rolePrice: 100000,
    chatRewardEnabled: true,
    chatRewardMin: 1,
    chatRewardMax: 5,
    chatRewardCooldown: 60000,
    stealSuccessRate: 50,
    stealPercentage: 10,
    stealFailurePenalty: 100,
    stealCooldown: 60 * 60 * 1000,
    dailyBonus: 100,
    gachaEnabled: true,
    gachaPrice: 500,
    gachaButtonLabel: '🎰 ガチャ',
    gachaDescription: '運試しガチャ！',
    gachaPools: []
  };
  
  if (!ajackSettingsCache.has(guildId)) {
    ajackSettingsCache.set(guildId, defaults);
    
    debouncedSave(AJACK_SETTINGS_FILE, () => {
      const obj = {};
      for (const [k, v] of ajackSettingsCache) obj[k] = v;
      return obj;
    }, 'ajack-settings');
  } else {
    const current = ajackSettingsCache.get(guildId);
    const merged = { ...defaults, ...current };
    if (JSON.stringify(current) !== JSON.stringify(merged)) {
      ajackSettingsCache.set(guildId, merged);
    }
  }
  
  return ajackSettingsCache.get(guildId);
}

async function updateAjackSettings(guildId, settings) {
  await initializeStorage();
  
  const current = ajackSettingsCache.get(guildId) || {};
  const updated = { ...current, ...settings };
  ajackSettingsCache.set(guildId, updated);
  
  await debouncedSave(
    AJACK_SETTINGS_FILE,
    () => {
      const obj = {};
      for (const [k, v] of ajackSettingsCache) obj[k] = v;
      return obj;
    },
    'ajack-settings'
  );
}

async function getChatCooldown(guildId, userId) {
  await initializeStorage();
  const key = `${guildId}:${userId}`;
  return chatCooldownsCache.get(key) || null;
}

async function updateChatCooldown(guildId, userId, timestamp) {
  await initializeStorage();
  const key = `${guildId}:${userId}`;
  chatCooldownsCache.set(key, timestamp);
  
  await debouncedSave(
    CHAT_COOLDOWNS_FILE,
    () => Object.fromEntries(chatCooldownsCache),
    'chat-cooldowns'
  );
}

async function getBankBalance(userId) {
  await initializeStorage();
  return bankAccountsCache.get(userId) || 0;
}

async function updateBankBalance(userId, balance) {
  await initializeStorage();
  bankAccountsCache.set(userId, balance);
  
  await debouncedSave(
    BANK_ACCOUNTS_FILE,
    () => Object.fromEntries(bankAccountsCache),
    `bank-${userId}`
  );
}

async function getAllUsersBalances() {
  await initializeStorage();
  const usersMap = new Map();
  
  for (const [userId, walletBalance] of ankoDollarCache.entries()) {
    const bankBalance = bankAccountsCache.get(userId) || 0;
    const totalBalance = walletBalance + bankBalance;
    usersMap.set(userId, {
      wallet: walletBalance,
      bank: bankBalance,
      total: totalBalance
    });
  }
  
  for (const [userId, bankBalance] of bankAccountsCache.entries()) {
    if (!usersMap.has(userId)) {
      const walletBalance = ankoDollarCache.get(userId) ?? 0;
      const totalBalance = walletBalance + bankBalance;
      usersMap.set(userId, {
        wallet: walletBalance,
        bank: bankBalance,
        total: totalBalance
      });
    }
  }
  
  return usersMap;
}

async function getStealCooldown(guildId, userId) {
  await initializeStorage();
  const key = `${guildId}:${userId}`;
  return stealCooldownsCache.get(key) || null;
}

async function updateStealCooldown(guildId, userId, timestamp) {
  await initializeStorage();
  const key = `${guildId}:${userId}`;
  stealCooldownsCache.set(key, timestamp);
  
  await debouncedSave(
    STEAL_COOLDOWNS_FILE,
    () => Object.fromEntries(stealCooldownsCache),
    'steal-cooldowns'
  );
}

async function getAllowedUsers() {
  await initializeStorage();
  return allowedUsersCache;
}

async function addAllowedUser(userId) {
  await initializeStorage();
  allowedUsersCache.add(userId);
  
  await debouncedSave(
    ALLOWED_USERS_FILE,
    () => ({ users: Array.from(allowedUsersCache) }),
    'allowed-users'
  );
  
  return true;
}

async function removeAllowedUser(userId) {
  await initializeStorage();
  const result = allowedUsersCache.delete(userId);
  
  if (result) {
    await debouncedSave(
      ALLOWED_USERS_FILE,
      () => ({ users: Array.from(allowedUsersCache) }),
      'allowed-users'
    );
  }
  
  return result;
}

async function getUserToken(userId) {
  await initializeStorage();
  return userTokensCache.get(userId) || null;
}

async function setUserToken(userId, token) {
  await initializeStorage();
  userTokensCache.set(userId, token);
  
  debouncedSave(USER_TOKENS_FILE, () => {
    const obj = {};
    for (const [k, v] of userTokensCache) obj[k] = v;
    return obj;
  }, 'user_tokens');
  
  return true;
}

async function removeUserToken(userId) {
  await initializeStorage();
  const result = userTokensCache.delete(userId);
  
  if (result) {
    debouncedSave(USER_TOKENS_FILE, () => {
      const obj = {};
      for (const [k, v] of userTokensCache) obj[k] = v;
      return obj;
    }, 'user_tokens');
  }
  
  return result;
}

async function getGuildMembers(guildId) {
  await initializeStorage();
  return guildMembersCache.get(guildId) || [];
}

async function setGuildMembers(guildId, memberIds) {
  await initializeStorage();
  guildMembersCache.set(guildId, memberIds);
  
  debouncedSave(GUILD_MEMBERS_FILE, () => {
    const obj = {};
    for (const [k, v] of guildMembersCache) obj[k] = v;
    return obj;
  }, 'guild_members');
  
  return true;
}

async function getUserCustomMessages(userId) {
  await initializeStorage();
  return userCustomMessagesCache.get(userId) || [];
}

async function addUserCustomMessage(userId, message, title = null) {
  await initializeStorage();
  
  const messages = userCustomMessagesCache.get(userId) || [];
  const newMessage = {
    id: Date.now().toString(),
    content: message,
    title: title,
    createdAt: new Date().toISOString()
  };
  
  messages.push(newMessage);
  userCustomMessagesCache.set(userId, messages);
  
  debouncedSave(USER_CUSTOM_MESSAGES_FILE, () => {
    const obj = {};
    for (const [k, v] of userCustomMessagesCache) obj[k] = v;
    return obj;
  }, 'user_custom_messages');
  
  return newMessage;
}

async function deleteUserCustomMessage(userId, messageId) {
  await initializeStorage();
  
  const messages = userCustomMessagesCache.get(userId) || [];
  const index = messages.findIndex(m => m.id === messageId);
  
  if (index === -1) {
    return null;
  }
  
  const deletedMessage = messages[index];
  messages.splice(index, 1);
  userCustomMessagesCache.set(userId, messages);
  
  debouncedSave(USER_CUSTOM_MESSAGES_FILE, () => {
    const obj = {};
    for (const [k, v] of userCustomMessagesCache) obj[k] = v;
    return obj;
  }, 'user_custom_messages');
  
  return deletedMessage;
}

async function getUserCustomMessageById(userId, messageId) {
  await initializeStorage();
  
  const messages = userCustomMessagesCache.get(userId) || [];
  return messages.find(m => m.id === messageId) || null;
}

async function getUserCustomMessageByTitle(userId, title) {
  await initializeStorage();
  
  const messages = userCustomMessagesCache.get(userId) || [];
  return messages.find(m => m.title && m.title.toLowerCase() === title.toLowerCase()) || null;
}

async function getUserCustomMessageByIdOrTitle(userId, identifier) {
  await initializeStorage();
  
  const messages = userCustomMessagesCache.get(userId) || [];
  const byId = messages.find(m => m.id === identifier);
  if (byId) return byId;
  
  const byTitle = messages.find(m => m.title && m.title.toLowerCase() === identifier.toLowerCase());
  return byTitle || null;
}

const RECORDED_MESSAGES_EXPIRY_MS = 60 * 60 * 1000;

function cleanExpiredRecordedMessages() {
  if (!isInitialized) return 0;
  
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of recordedMessagesCache.entries()) {
    if (!value || typeof value !== 'object') {
      recordedMessagesCache.delete(key);
      cleaned++;
      continue;
    }
    
    if (!value.createdAt || typeof value.createdAt !== 'number') {
      continue;
    }
    
    if (now - value.createdAt > RECORDED_MESSAGES_EXPIRY_MS) {
      recordedMessagesCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 期限切れの記録メッセージを ${cleaned} 件削除しました`);
    saveRecordedMessagesToFile();
  }
  
  return cleaned;
}

function saveRecordedMessagesToFile() {
  debouncedSave(RECORDED_MESSAGES_FILE, () => {
    const obj = {};
    for (const [k, v] of recordedMessagesCache) obj[k] = v;
    return obj;
  }, 'recorded_messages');
}

setInterval(cleanExpiredRecordedMessages, 10 * 60 * 1000);

async function saveRecordedMessages(storageKey, data) {
  await initializeStorage();
  
  if (!data || !data.messages || !Array.isArray(data.messages)) {
    throw new Error('Invalid recorded messages data');
  }
  
  const record = {
    messages: data.messages,
    createdAt: Date.now()
  };
  
  recordedMessagesCache.set(storageKey, record);
  saveRecordedMessagesToFile();
  
  return record;
}

async function getRecordedMessages(storageKey) {
  await initializeStorage();
  
  const data = recordedMessagesCache.get(storageKey);
  if (!data) return null;
  
  if (!data.messages || !Array.isArray(data.messages)) {
    recordedMessagesCache.delete(storageKey);
    saveRecordedMessagesToFile();
    return null;
  }
  
  if (data.createdAt && typeof data.createdAt === 'number' && Date.now() - data.createdAt > RECORDED_MESSAGES_EXPIRY_MS) {
    recordedMessagesCache.delete(storageKey);
    saveRecordedMessagesToFile();
    return null;
  }
  
  return data;
}

async function deleteRecordedMessages(storageKey) {
  await initializeStorage();
  
  const deleted = recordedMessagesCache.has(storageKey);
  recordedMessagesCache.delete(storageKey);
  
  if (deleted) {
    saveRecordedMessagesToFile();
  }
  
  return deleted;
}

async function getAllRecordedMessagesKeys() {
  await initializeStorage();
  cleanExpiredRecordedMessages();
  return Array.from(recordedMessagesCache.keys());
}

// ========== License Settings Functions ==========

const DEFAULT_LICENSE_SETTINGS = {
  requireLicense: false,
  adminPasswordHash: null,
  licenseKeys: {}
};

async function loadLicenseSettings() {
  if (licenseSettingsCache) return licenseSettingsCache;
  licenseSettingsCache = await safeReadJSON(LICENSE_SETTINGS_FILE, DEFAULT_LICENSE_SETTINGS);
  return licenseSettingsCache;
}

async function saveLicenseSettings() {
  if (!licenseSettingsCache) return;
  await safeWriteJSON(LICENSE_SETTINGS_FILE, licenseSettingsCache);
}

async function getLicenseSettings() {
  return await loadLicenseSettings();
}

async function setRequireLicense(enabled) {
  await loadLicenseSettings();
  licenseSettingsCache.requireLicense = enabled;
  await saveLicenseSettings();
  return licenseSettingsCache;
}

async function setAdminPasswordHash(hash) {
  await loadLicenseSettings();
  licenseSettingsCache.adminPasswordHash = hash;
  await saveLicenseSettings();
  return true;
}

async function getAdminPasswordHash() {
  await loadLicenseSettings();
  return licenseSettingsCache.adminPasswordHash;
}

async function createLicenseKey(issuedTo = '') {
  await loadLicenseSettings();
  const crypto = require('crypto');
  const key = crypto.randomBytes(16).toString('hex');
  licenseSettingsCache.licenseKeys[key] = {
    issuedTo: issuedTo,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revoked: false,
    boundToSessionId: null
  };
  await saveLicenseSettings();
  return key;
}

async function validateLicenseKey(key, sessionId) {
  await loadLicenseSettings();
  const keyData = licenseSettingsCache.licenseKeys[key];
  if (!keyData) return { valid: false, reason: 'not_found' };
  if (keyData.revoked) return { valid: false, reason: 'revoked' };
  
  if (keyData.boundToSessionId && keyData.boundToSessionId !== sessionId) {
    return { valid: false, reason: 'already_bound', message: 'このキーは既に他のユーザーが使用中です' };
  }
  
  if (!keyData.boundToSessionId && sessionId) {
    keyData.boundToSessionId = sessionId;
  }
  
  keyData.lastUsedAt = new Date().toISOString();
  await saveLicenseSettings();
  return { valid: true, keyData };
}

async function checkLicenseSession(key, sessionId) {
  await loadLicenseSettings();
  const keyData = licenseSettingsCache.licenseKeys[key];
  if (!keyData) return { valid: false, reason: 'not_found' };
  if (keyData.revoked) return { valid: false, reason: 'revoked' };
  if (!keyData.boundToSessionId) return { valid: false, reason: 'not_bound' };
  if (keyData.boundToSessionId !== sessionId) return { valid: false, reason: 'wrong_session' };
  return { valid: true, keyData };
}

async function unbindLicenseKey(key) {
  await loadLicenseSettings();
  if (!licenseSettingsCache.licenseKeys[key]) return false;
  licenseSettingsCache.licenseKeys[key].boundToSessionId = null;
  await saveLicenseSettings();
  return true;
}

async function revokeLicenseKey(key) {
  await loadLicenseSettings();
  if (!licenseSettingsCache.licenseKeys[key]) return false;
  licenseSettingsCache.licenseKeys[key].revoked = true;
  await saveLicenseSettings();
  return true;
}

async function deleteLicenseKey(key) {
  await loadLicenseSettings();
  if (!licenseSettingsCache.licenseKeys[key]) return false;
  delete licenseSettingsCache.licenseKeys[key];
  await saveLicenseSettings();
  return true;
}

async function getAllLicenseKeys() {
  await loadLicenseSettings();
  return licenseSettingsCache.licenseKeys;
}

async function reactivateLicenseKey(key) {
  await loadLicenseSettings();
  if (!licenseSettingsCache.licenseKeys[key]) return false;
  licenseSettingsCache.licenseKeys[key].revoked = false;
  await saveLicenseSettings();
  return true;
}

// Camera Channel Settings
const CAMERA_SETTINGS_FILE = path.join(STORAGE_DIR, 'camera_settings.json');
let cameraSettingsCache = { channelId: null, guildId: null };

async function loadCameraSettings() {
  try {
    const data = await fs.readFile(CAMERA_SETTINGS_FILE, 'utf8');
    cameraSettingsCache = JSON.parse(data);
  } catch {
    cameraSettingsCache = { channelId: null, guildId: null };
    await saveCameraSettings();
  }
}

async function saveCameraSettings() {
  await fs.writeFile(CAMERA_SETTINGS_FILE, JSON.stringify(cameraSettingsCache, null, 2));
}

async function setCameraChannel(channelId, guildId) {
  await loadCameraSettings();
  cameraSettingsCache = { channelId, guildId };
  await saveCameraSettings();
}

async function getCameraChannel() {
  await loadCameraSettings();
  return cameraSettingsCache;
}

module.exports = {
  initializeStorage,
  getGuildSettings,
  updateGuildSettings,
  getAntiSpamSettings,
  updateAntiSpamSettings,
  getNSFWKeywords,
  addNSFWKeyword,
  removeNSFWKeyword,
  getBannedWords,
  addBannedWord,
  removeBannedWord,
  updateSpamTracker,
  cleanOldSpamTrackers,
  addWarning,
  getWarningCount,
  getWarnings,
  clearWarnings,
  createModerationCase,
  getModerationCases,
  deleteModerationCase,
  getCommandSpamSettings,
  updateCommandSpamSettings,
  checkCommandSpam,
  getVerificationSettings,
  updateVerificationSettings,
  getTicketSettings,
  updateTicketSettings,
  createTicketChannel,
  getTicketChannel,
  closeTicketChannel,
  getActiveTickets,
  getNextTicketNumber,
  getAnkoDollarBalance,
  updateAnkoDollarBalance,
  getLastDaily,
  updateLastDaily,
  getWorkCooldown,
  updateWorkCooldown,
  getUserInventory,
  updateUserInventory,
  getShopItems,
  updateShopItems,
  getAjackSettings,
  updateAjackSettings,
  getChatCooldown,
  updateChatCooldown,
  getBankBalance,
  updateBankBalance,
  getAllUsersBalances,
  getStealCooldown,
  updateStealCooldown,
  getAllowedUsers,
  addAllowedUser,
  removeAllowedUser,
  getUserToken,
  setUserToken,
  removeUserToken,
  getGuildMembers,
  setGuildMembers,
  getUserCustomMessages,
  addUserCustomMessage,
  deleteUserCustomMessage,
  getUserCustomMessageById,
  getUserCustomMessageByTitle,
  getUserCustomMessageByIdOrTitle,
  saveRecordedMessages,
  getRecordedMessages,
  deleteRecordedMessages,
  getAllRecordedMessagesKeys,
  getLicenseSettings,
  setRequireLicense,
  setAdminPasswordHash,
  getAdminPasswordHash,
  createLicenseKey,
  validateLicenseKey,
  checkLicenseSession,
  unbindLicenseKey,
  revokeLicenseKey,
  deleteLicenseKey,
  getAllLicenseKeys,
  reactivateLicenseKey,
  getAlinkSettings,
  updateAlinkSettings,
  getAllAlinkSettings,
  getAutoScanState,
  updateAutoScanState,
  setAutoScanEnabled,
  addAutoScanSentInvite,
  getAutoScanSentInvites,
  getAutoScanPanelConfig,
  updateAutoScanPanelConfig,
  getDiscordSettings,
  updateDiscordSettings,
  setCameraChannel,
  getCameraChannel
};

async function getAlinkSettings(guildId) {
  if (alinkSettingsCache.has(guildId)) {
    return alinkSettingsCache.get(guildId);
  }
  
  const allSettings = await safeReadJSON(ALINK_SETTINGS_FILE, {});
  const settings = allSettings[guildId] || {
    enabled: false,
    channelId: null,
    searchQuery: 'discord.gg',
    interval: 5,
    xUsername: null,
    xPassword: null,
    lastCheck: null,
    postedLinks: [],
    japaneseOnly: false,
    requireKeywords: [],
    excludeKeywords: []
  };
  
  alinkSettingsCache.set(guildId, settings);
  return settings;
}

async function updateAlinkSettings(guildId, settings) {
  alinkSettingsCache.set(guildId, settings);
  
  const allSettings = await safeReadJSON(ALINK_SETTINGS_FILE, {});
  allSettings[guildId] = settings;
  await safeWriteJSON(ALINK_SETTINGS_FILE, allSettings);
}

async function getAllAlinkSettings() {
  const allSettings = await safeReadJSON(ALINK_SETTINGS_FILE, {});
  return allSettings;
}

// Auto-scan state management
async function getAutoScanState() {
  const state = await safeReadJSON(AUTOSCAN_STATE_FILE, {
    enabled: false,
    targetChannelId: null,
    sentToChannels: {},
    startTime: null,
    runCount: 0,
    lastScannedInvites: [],
    totalUniqueLinks: 0
  });
  return state;
}

async function updateAutoScanState(state) {
  await safeWriteJSON(AUTOSCAN_STATE_FILE, state);
}

async function setAutoScanEnabled(enabled, targetChannelId = null) {
  const state = await getAutoScanState();
  state.enabled = enabled;
  if (enabled) {
    state.targetChannelId = targetChannelId;
    state.startTime = Date.now();
  }
  await updateAutoScanState(state);
  return state;
}

async function addAutoScanSentInvite(channelId, inviteUrl) {
  const state = await getAutoScanState();
  if (!state.sentToChannels[channelId]) {
    state.sentToChannels[channelId] = [];
  }
  if (!state.sentToChannels[channelId].includes(inviteUrl)) {
    state.sentToChannels[channelId].push(inviteUrl);
  }
  await updateAutoScanState(state);
}

async function getAutoScanSentInvites(channelId) {
  const state = await getAutoScanState();
  return state.sentToChannels[channelId] || [];
}

// Autoscan panel config (for admin panel settings)
async function getAutoScanPanelConfig() {
  return await safeReadJSON(AUTOSCAN_PANEL_CONFIG_FILE, {
    guildIds: [],
    userToken: '',
    channelIds: [],
    sendTargetChannelId: '',
    enabled: false
  });
}

async function updateAutoScanPanelConfig(config) {
  await safeWriteJSON(AUTOSCAN_PANEL_CONFIG_FILE, config);
}

// Discord settings (shared admin panel settings)
async function getDiscordSettings() {
  return await safeReadJSON(DISCORD_SETTINGS_FILE, {
    discordGuildId: '',
    discordUserToken: '',
    discordDaysAgo: 7,
    sendTargetChannelId: '',
    selectedChannels: [],
    selectedChannelInfo: [],
    availableChannels: []
  });
}

async function updateDiscordSettings(settings) {
  await safeWriteJSON(DISCORD_SETTINGS_FILE, settings);
}
