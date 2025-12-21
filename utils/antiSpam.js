const { updateSpamTracker, getAntiSpamSettings, createModerationCase, getNSFWKeywords, getBannedWords, getGuildSettings } = require('../storage/fileStorage');
const { EmbedBuilder } = require('discord.js');

const nsfwKeywordCache = new Map();

async function checkSpam(message) {
  if (message.author.bot) return false;
  if (message.member.permissions.has('Administrator')) return false;
  
  const settings = await getAntiSpamSettings(message.guild.id);
  const issues = [];
  
  const content = message.content;
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  const lineBreaks = (content.match(/\n/g) || []).length;
  
  if (mentions > settings.max_mentions) {
    issues.push(`メンション乱用（${mentions}件）`);
  }
  
  if (lineBreaks > settings.max_line_breaks) {
    issues.push(`改行乱用（${lineBreaks}行）`);
  }
  
  if (content.length > settings.max_message_length) {
    issues.push(`長文（${content.length}文字）`);
  }
  
  if (settings.link_block_enabled && containsLink(content)) {
    issues.push('外部リンク検出');
  }
  
  if (settings.nsfw_block_enabled && await containsNSFW(content, message.guild.id)) {
    issues.push('NSFW コンテンツ検出');
  }
  
  const bannedWordCheck = await containsBannedWord(content, message.guild.id);
  if (bannedWordCheck.found) {
    issues.push(`禁止用語検出: ${bannedWordCheck.word}`);
  }
  
  if (message.attachments.size > 0 && settings.nsfw_block_enabled) {
    const hasNSFWAttachment = message.attachments.some(att => 
      att.contentType && (att.contentType.startsWith('image/') || att.contentType.startsWith('video/'))
    );
    if (hasNSFWAttachment && await containsNSFW(content, message.guild.id)) {
      issues.push('NSFW メディア検出');
    }
  }
  
  const imageCount = message.attachments.filter(att => 
    att.contentType && att.contentType.startsWith('image/')
  ).size;
  
  const tracker = await updateSpamTracker(message.guild.id, message.author.id, content, imageCount);
  
  if (tracker.message_count > settings.max_messages) {
    issues.push(`連投（${tracker.message_count}件/${settings.time_window}秒）`);
  }
  
  if (tracker.duplicate_count >= settings.duplicate_message_threshold) {
    issues.push(`重複メッセージ（${tracker.duplicate_count}回）`);
  }
  
  if (settings.random_suffix_detection && hasRandomSuffix(content, tracker)) {
    issues.push('ランダム文字列スパム検出');
  }
  
  const selfBotCheck = await detectSelfBot(message, tracker);
  if (selfBotCheck.isSuspicious) {
    issues.push(...selfBotCheck.reasons);
  }
  
  const guildSettings = await require('../storage/fileStorage').getGuildSettings(message.guild.id);
  if (guildSettings.image_spam_enabled && tracker.image_count > settings.image_spam_max_images) {
    issues.push(`画像スパム（${tracker.image_count}枚/${settings.image_spam_time_window}秒）`);
  }
  
  return {
    isSpam: issues.length > 0,
    issues,
    tracker
  };
}

function containsLink(content) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  return urlPattern.test(content);
}

function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function calculateEntropy(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

function hasRandomSuffix(content, tracker) {
  if (!content || content.length < 10) return false;
  
  const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const specialCharPattern = /[!@#$%^&*()_+=\[\]{};':"\\|,.<>/?~`]{3,}/;
  
  const trimmedContent = content.trim();
  const lastChars = trimmedContent.slice(-20);
  
  if (emojiPattern.test(lastChars) || specialCharPattern.test(lastChars)) {
    const entropy = calculateEntropy(lastChars);
    if (entropy > 3.5) {
      if (!tracker.recent_messages || tracker.recent_messages.length < 2) return false;
      
      let similarCount = 0;
      for (const recentMsg of tracker.recent_messages) {
        const recentTrimmed = recentMsg.trim();
        const similarity = 1 - (levenshteinDistance(trimmedContent.slice(0, -20), recentTrimmed.slice(0, -20)) / Math.max(trimmedContent.length, recentTrimmed.length));
        
        if (similarity > 0.8 && trimmedContent !== recentTrimmed) {
          similarCount++;
        }
      }
      
      return similarCount >= 1;
    }
  }
  
  const words = content.trim().split(/\s+/);
  if (words.length < 2) return false;
  
  const lastWord = words[words.length - 1];
  
  if (lastWord.length < 3 || lastWord.length > 30) return false;
  
  const randomPattern = /^[a-zA-Z0-9]{3,30}$/;
  if (!randomPattern.test(lastWord) && !emojiPattern.test(lastWord)) return false;
  
  const hasUpperAndLower = /[a-z]/.test(lastWord) && /[A-Z]/.test(lastWord);
  const hasLettersAndNumbers = /[a-zA-Z]/.test(lastWord) && /[0-9]/.test(lastWord);
  const noVowelPattern = !/[aeiouAEIOU]{2,}/.test(lastWord);
  const hasEmoji = emojiPattern.test(lastWord);
  const entropy = calculateEntropy(lastWord);
  
  const randomness = hasUpperAndLower || hasLettersAndNumbers || noVowelPattern || hasEmoji || entropy > 3.0;
  
  if (!randomness) return false;
  
  const baseMessage = words.slice(0, -1).join(' ');
  
  if (!tracker.recent_messages || tracker.recent_messages.length < 2) return false;
  
  let similarCount = 0;
  for (const recentMsg of tracker.recent_messages) {
    const recentWords = recentMsg.trim().split(/\s+/);
    if (recentWords.length < 2) continue;
    
    const recentBase = recentWords.slice(0, -1).join(' ');
    const recentLast = recentWords[recentWords.length - 1];
    
    const baseSimilarity = 1 - (levenshteinDistance(baseMessage, recentBase) / Math.max(baseMessage.length, recentBase.length));
    
    if (baseSimilarity > 0.85 && lastWord !== recentLast) {
      const isRecentLastRandom = randomPattern.test(recentLast) && 
        (recentLast.length >= 3 && recentLast.length <= 30);
      if (isRecentLastRandom) {
        similarCount++;
      }
    }
  }
  
  return similarCount >= 1;
}

const defaultNSFWKeywords = [
  'nsfw', 'porn', 'xxx', 'sex', 'nude', 'hentai', 'エロ', 'アダルト',
  '18禁', 'r18', 'エッチ', 'av', 'adult', '裸', 'セックス',
  'おっぱい', 'ちんこ', 'まんこ', 'フェラ', 'セフレ', '出会い系'
];

async function loadNSFWKeywords(guildId) {
  try {
    const customKeywords = await getNSFWKeywords(guildId);
    const allKeywords = [...defaultNSFWKeywords, ...customKeywords];
    nsfwKeywordCache.set(guildId, allKeywords);
    return allKeywords;
  } catch (error) {
    console.error('NSFWキーワード読み込みエラー:', error);
    return defaultNSFWKeywords;
  }
}

async function containsNSFW(content, guildId) {
  let keywords = nsfwKeywordCache.get(guildId);
  
  if (!keywords) {
    keywords = await loadNSFWKeywords(guildId);
  }
  
  const lowerContent = content.toLowerCase();
  return keywords.some(keyword => lowerContent.includes(keyword));
}

async function containsBannedWord(content, guildId) {
  try {
    const bannedWords = await getBannedWords(guildId);
    
    if (bannedWords.length === 0) {
      return { found: false };
    }
    
    const lowerContent = content.toLowerCase();
    
    for (const word of bannedWords) {
      if (lowerContent.includes(word)) {
        return { found: true, word: word };
      }
    }
    
    return { found: false };
  } catch (error) {
    console.error('禁止用語チェックエラー:', error);
    return { found: false };
  }
}

function refreshNSFWCache(guildId) {
  nsfwKeywordCache.delete(guildId);
}

async function detectSelfBot(message, tracker) {
  const reasons = [];
  let suspicionScore = 0;
  
  const accountAge = Date.now() - message.author.createdTimestamp;
  const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);
  
  if (accountAgeDays < 30 && tracker.message_count > 3) {
    reasons.push('新規アカウントによる連投');
    suspicionScore += 2;
  }
  
  if (accountAgeDays < 7 && tracker.message_count > 2) {
    reasons.push('極めて新しいアカウントからの投稿');
    suspicionScore += 3;
  }
  
  if (tracker.message_count >= 4) {
    const avgInterval = (tracker.last_message_at - tracker.first_message_at) / tracker.message_count;
    if (avgInterval < 500) {
      reasons.push('非人間的な速度での投稿（セルフボット疑惑）');
      suspicionScore += 4;
    }
  }
  
  const username = message.author.username.toLowerCase();
  const suspiciousPatterns = [
    /[a-z]{3,}\d{4,}/,
    /^user\d+$/,
    /^[a-z]+_\d+$/,
    /^discord_?user/i,
    /^bot_?/i,
    /qr\.?code/i,
    /nitro/i,
    /free/i,
    /gift/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(username))) {
    suspicionScore += 1;
  }
  
  if (!message.member.avatar && accountAgeDays < 14 && tracker.message_count > 2) {
    reasons.push('デフォルトアバターでの連投');
    suspicionScore += 1;
  }
  
  return {
    isSuspicious: suspicionScore >= 3,
    reasons,
    score: suspicionScore
  };
}

async function handleSpam(message, issues) {
  try {
    const settings = await getAntiSpamSettings(message.guild.id);
    const guildSettings = await getGuildSettings(message.guild.id);
    await message.delete();
    
    if (settings.timeout_enabled && settings.timeout_duration > 0) {
      try {
        const member = await message.guild.members.fetch(message.author.id);
        const timeoutDuration = settings.timeout_duration * 60 * 1000;
        
        if (isNaN(timeoutDuration) || timeoutDuration <= 0) {
          console.error(`タイムアウト設定エラー: 不正な値 timeout_duration=${settings.timeout_duration}`);
          throw new Error('Invalid timeout duration');
        }
        
        try {
          const messagesToDelete = await message.channel.messages.fetch({ limit: 100 });
          const userMessages = messagesToDelete.filter(msg => msg.author.id === message.author.id);
          await Promise.all(userMessages.map(msg => msg.delete().catch(() => {})));
        } catch (deleteError) {
          console.error('メッセージ一括削除エラー:', deleteError);
        }
        
        await member.timeout(timeoutDuration, `自動スパム検出: ${issues.join(', ')}`);
        
        const minutes = settings.timeout_duration;
        
        await createModerationCase(
          message.guild.id,
          message.author.id,
          message.client.user.id,
          'auto_spam_timeout',
          `自動スパム検出でタイムアウト（${minutes}分）: ${issues.join(', ')}`
        );
        
        if (guildSettings.timeout_log_enabled && guildSettings.log_channel_id) {
          try {
            const logChannel = await message.guild.channels.fetch(guildSettings.log_channel_id);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setTitle('🔇 タイムアウト実行')
                .setColor(0xFFA500)
                .addFields(
                  { name: 'ユーザー', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
                  { name: '期間', value: `${minutes}分`, inline: true },
                  { name: 'チャンネル', value: `<#${message.channel.id}>`, inline: true },
                  { name: '理由', value: `自動スパム検出\n${issues.map(i => `• ${i}`).join('\n')}`, inline: false }
                )
                .setTimestamp();
              
              await logChannel.send({ embeds: [logEmbed] });
            }
          } catch (logError) {
            console.error('タイムアウトログ送信エラー:', logError);
          }
        }
      } catch (error) {
        console.error(`タイムアウト適用エラー (Guild: ${message.guild.id}, User: ${message.author.id}):`, error.message);
        await createModerationCase(
          message.guild.id,
          message.author.id,
          message.client.user.id,
          'auto_spam_delete',
          `自動スパム検出（タイムアウト失敗）: ${issues.join(', ')}`
        );
      }
    } else {
      await createModerationCase(
        message.guild.id,
        message.author.id,
        message.client.user.id,
        'auto_spam_delete',
        `自動スパム検出: ${issues.join(', ')}`
      );
    }
    
    return true;
  } catch (error) {
    console.error('スパム処理エラー:', error);
    return false;
  }
}

module.exports = {
  checkSpam,
  handleSpam,
  containsLink,
  containsNSFW,
  containsBannedWord,
  loadNSFWKeywords,
  refreshNSFWCache
};
