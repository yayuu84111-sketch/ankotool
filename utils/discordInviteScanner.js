const axios = require('axios');

// Discord invite link patterns - accepts both https://discord.gg/X and discord.gg/X formats
// Supports: https://discord.gg/code, discord.gg/code, with codes containing letters, numbers, hyphens, and underscores
const DISCORD_INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/([a-zA-Z0-9\-_]+)/gi;

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Get Discord headers for authenticated requests
function getDiscordHeaders(token) {
  const superProperties = {
    os: "Windows",
    browser: "Chrome",
    device: "",
    system_locale: "ja",
    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    browser_version: "120.0.0.0",
    os_version: "10",
    release_channel: "stable",
    client_build_number: 251236,
  };

  return {
    'Authorization': token,
    'Content-Type': 'application/json',
    'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
    'X-Discord-Locale': 'ja',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
}

// Extract invite links from message content - accepts both https://discord.gg/X and discord.gg/X formats
function extractInviteLinks(content) {
  if (!content) return [];
  
  const normalizedLinks = [];
  const uniqueCodes = new Set();
  let match;
  
  // Use exec to get all matches with captured groups
  const regex = new RegExp(DISCORD_INVITE_REGEX.source, DISCORD_INVITE_REGEX.flags);
  
  // Debug log
  console.log(`[ExtractInvites] Processing content: "${content}"`);
  
  while ((match = regex.exec(content)) !== null) {
    const code = match[1]; // Get the captured group (invite code)
    console.log(`[ExtractInvites] Found match: full="${match[0]}", code="${code}"`);
    if (code && !uniqueCodes.has(code)) {
      uniqueCodes.add(code);
      normalizedLinks.push(`https://discord.gg/${code}`);
    }
  }
  
  console.log(`[ExtractInvites] Extracted ${normalizedLinks.length} links: ${JSON.stringify(normalizedLinks)}`);
  return normalizedLinks;
}

// Get all channels from a guild
async function getGuildChannels(guildId, token) {
  try {
    const response = await axios.get(
      `${DISCORD_API_BASE}/guilds/${guildId}/channels`,
      { headers: getDiscordHeaders(token) }
    );
    
    // Filter to only text channels
    return response.data.filter(ch => ch.type === 0);
  } catch (error) {
    console.error(`[DiscordScanner] Failed to get channels for guild ${guildId}:`, error.response?.status);
    return [];
  }
}

// Get messages from a channel with date range filter
async function getChannelMessages(guildId, channelId, token, daysAgo = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    
    const allMessages = [];
    let lastMessageId = null;
    const maxIterations = 50; // Limit iterations to avoid rate limiting
    let iterations = 0;
    
    while (iterations < maxIterations) {
      let url = `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=100`;
      if (lastMessageId) {
        url += `&before=${lastMessageId}`;
      }
      
      try {
        const response = await axios.get(url, { headers: getDiscordHeaders(token) });
        
        if (response.data.length === 0) break;
        
        for (const msg of response.data) {
          const msgDate = new Date(msg.timestamp);
          if (msgDate < cutoffDate) {
            return allMessages; // Reached date limit
          }
          allMessages.push(msg);
        }
        
        lastMessageId = response.data[response.data.length - 1].id;
        iterations++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after']) || 1;
          console.log(`[DiscordScanner] Rate limited, waiting ${retryAfter}s`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        break;
      }
    }
    
    return allMessages;
  } catch (error) {
    console.error(`[DiscordScanner] Error getting messages from ${channelId}:`, error.message);
    return [];
  }
}

// Scan all channels in a guild for invite links
async function scanGuildForInvites(guildId, token, daysAgo = 7, channels = null) {
  console.log(`[DiscordScanner] Scanning guild ${guildId} for invites (${daysAgo} days ago)`);
  
  try {
    // Get all channels if not specified
    let allChannels = await getGuildChannels(guildId, token);
    let targetChannels = allChannels;
    
    // If channels parameter is provided, filter by channel IDs
    if (channels && Array.isArray(channels) && channels.length > 0) {
      const channelIds = new Set(channels);
      targetChannels = allChannels.filter(ch => channelIds.has(ch.id));
      console.log(`[DiscordScanner] Filtering to ${targetChannels.length} selected channels`);
    }
    
    if (targetChannels.length === 0) {
      console.log(`[DiscordScanner] No text channels found in guild ${guildId}`);
      return { invites: [], channelCount: 0, messageCount: 0 };
    }
    
    const allInvites = new Map(); // Map to store unique invites with metadata
    let totalMessages = 0;
    
    for (const channel of targetChannels) {
      console.log(`[DiscordScanner] Scanning channel ${channel.name} (${channel.id})`);
      
      const messages = await getChannelMessages(guildId, channel.id, token, daysAgo);
      totalMessages += messages.length;
      
      for (const msg of messages) {
        const invites = extractInviteLinks(msg.content);
        
        for (const inviteUrl of invites) {
          if (!allInvites.has(inviteUrl)) {
            allInvites.set(inviteUrl, {
              url: inviteUrl,
              firstFound: msg.timestamp,
              channel: channel.name,
              author: msg.author?.username || 'Unknown',
              count: 1
            });
          } else {
            // Update count if found again
            const existing = allInvites.get(inviteUrl);
            existing.count++;
          }
        }
      }
      
      // Add small delay between channels
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[DiscordScanner] Found ${allInvites.size} unique invites in guild ${guildId}`);
    
    return {
      success: true,
      guildId,
      invites: Array.from(allInvites.values()),
      channelCount: targetChannels.length,
      messageCount: totalMessages,
      daysScanned: daysAgo
    };
  } catch (error) {
    console.error(`[DiscordScanner] Error scanning guild ${guildId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Validate invite
async function validateInvite(inviteCode, token) {
  try {
    const response = await axios.get(
      `${DISCORD_API_BASE}/invites/${inviteCode}`,
      { headers: getDiscordHeaders(token) }
    );
    return response.data;
  } catch (error) {
    return null;
  }
}

module.exports = {
  scanGuildForInvites,
  getGuildChannels,
  getChannelMessages,
  extractInviteLinks,
  validateInvite,
  getDiscordHeaders
};
