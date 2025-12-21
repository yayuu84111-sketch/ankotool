const WebSocket = require('ws');
const axios = require('axios');

const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

class DiscordGateway {
    constructor(token) {
        this.token = token;
        this.ws = null;
        this.heartbeatInterval = null;
        this.sequence = null;
        this.sessionId = null;
        this.members = new Map();
        this.resolveMembers = null;
        this.rejectMembers = null;
        this.memberListComplete = false;
        this.rangesRequested = new Set();
        this.rangesReceived = new Set();
        this.pendingRanges = new Set();
        this.totalMemberCount = 0;
        this.onlineCount = 0;
        this.timeout = null;
        this.lastUpdateTime = 0;
        this.noNewDataTimeout = null;
    }

    async fetchMembers(guildId, channelId, maxMembers = 1000) {
        return new Promise((resolve, reject) => {
            this.resolveMembers = resolve;
            this.rejectMembers = reject;
            this.guildId = guildId;
            this.channelId = channelId;
            this.maxMembers = maxMembers;
            this.members.clear();
            this.rangesRequested.clear();
            this.memberListComplete = false;

            this.timeout = setTimeout(() => {
                this.cleanup();
                resolve({
                    success: true,
                    members: Array.from(this.members.values()),
                    count: this.members.size,
                    totalMemberCount: this.totalMemberCount,
                    onlineCount: this.onlineCount,
                    note: 'Timeout reached, returning collected members'
                });
            }, 30000);

            this.connect();
        });
    }

    connect() {
        this.ws = new WebSocket(DISCORD_GATEWAY_URL);

        this.ws.on('open', () => {
            console.log('Gateway connected');
        });

        this.ws.on('message', (data) => {
            this.handleMessage(JSON.parse(data.toString()));
        });

        this.ws.on('error', (error) => {
            console.error('Gateway error:', error);
            this.cleanup();
            if (this.rejectMembers) {
                this.rejectMembers(new Error('Gateway connection error'));
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log('Gateway closed:', code, reason?.toString());
            this.cleanup();
        });
    }

    handleMessage(message) {
        const { op, t, d, s } = message;

        if (s) this.sequence = s;

        switch (op) {
            case 10:
                this.handleHello(d);
                break;
            case 11:
                break;
            case 0:
                this.handleDispatch(t, d);
                break;
        }
    }

    handleHello(data) {
        const interval = data.heartbeat_interval;
        this.startHeartbeat(interval);
        this.identify();
    }

    startHeartbeat(interval) {
        this.heartbeatInterval = setInterval(() => {
            this.send({ op: 1, d: this.sequence });
        }, interval);
    }

    identify() {
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
            release_channel: "stable",
            client_build_number: 251236
        };

        this.send({
            op: 2,
            d: {
                token: this.token,
                capabilities: 16381,
                properties: superProperties,
                presence: {
                    status: "online",
                    since: 0,
                    activities: [],
                    afk: false
                },
                compress: false,
                client_state: {
                    guild_versions: {},
                    highest_last_message_id: "0",
                    read_state_version: 0,
                    user_guild_settings_version: -1,
                    user_settings_version: -1,
                    private_channels_version: "0"
                }
            }
        });
    }

    handleDispatch(eventType, data) {
        switch (eventType) {
            case 'READY':
                console.log('Gateway READY, session:', data.session_id);
                this.sessionId = data.session_id;
                setTimeout(() => {
                    this.requestMembers();
                }, 500);
                break;

            case 'GUILD_MEMBER_LIST_UPDATE':
                this.handleMemberListUpdate(data);
                break;
        }
    }

    requestMembers() {
        const initialRanges = [[0, 99], [100, 199], [200, 299]];
        
        console.log(`Requesting member ranges for guild ${this.guildId}, channel ${this.channelId}`);

        for (const range of initialRanges) {
            const rangeKey = `${range[0]}-${range[1]}`;
            this.rangesRequested.add(rangeKey);
            this.pendingRanges.add(rangeKey);
        }

        this.send({
            op: 14,
            d: {
                guild_id: this.guildId,
                typing: true,
                threads: false,
                activities: true,
                members: [],
                channels: {
                    [this.channelId]: initialRanges
                }
            }
        });

        this.startNoNewDataTimer();
    }

    startNoNewDataTimer() {
        if (this.noNewDataTimeout) {
            clearTimeout(this.noNewDataTimeout);
        }
        this.noNewDataTimeout = setTimeout(() => {
            console.log('No new data received for 5 seconds, finishing collection');
            this.finishCollection();
        }, 5000);
    }

    requestMoreMembers(startRange) {
        const ranges = [];
        for (let i = 0; i < 3; i++) {
            const start = startRange + (i * 100);
            const end = start + 99;
            if (start >= this.totalMemberCount && this.totalMemberCount > 0) {
                break;
            }
            const rangeKey = `${start}-${end}`;
            if (!this.rangesRequested.has(rangeKey)) {
                ranges.push([start, end]);
                this.rangesRequested.add(rangeKey);
                this.pendingRanges.add(rangeKey);
            }
        }

        if (ranges.length > 0) {
            console.log(`Requesting more members: ranges ${JSON.stringify(ranges)}`);
            this.send({
                op: 14,
                d: {
                    guild_id: this.guildId,
                    typing: true,
                    threads: false,
                    activities: true,
                    members: [],
                    channels: {
                        [this.channelId]: ranges
                    }
                }
            });
        }
    }

    handleMemberListUpdate(data) {
        if (data.guild_id !== this.guildId) return;

        this.lastUpdateTime = Date.now();
        this.startNoNewDataTimer();

        this.totalMemberCount = data.member_count || this.totalMemberCount;
        this.onlineCount = data.online_count || this.onlineCount;

        console.log(`Member list update: ${data.member_count} total, ${data.online_count} online`);

        let newMembersAdded = false;

        if (data.ops) {
            for (const op of data.ops) {
                if (op.op === 'SYNC' && op.items) {
                    if (op.range) {
                        const rangeKey = `${op.range[0]}-${op.range[1]}`;
                        this.rangesReceived.add(rangeKey);
                        this.pendingRanges.delete(rangeKey);
                    }

                    for (const item of op.items) {
                        if (item.member && item.member.user) {
                            const user = item.member.user;
                            if (!user.bot && !this.members.has(user.id)) {
                                this.members.set(user.id, {
                                    id: user.id,
                                    username: user.username,
                                    discriminator: user.discriminator || '0',
                                    nickname: item.member.nick || null,
                                    avatar: user.avatar
                                });
                                newMembersAdded = true;
                            }
                        }
                    }
                }
            }
        }

        console.log(`Collected ${this.members.size} members so far (total: ${this.totalMemberCount})`);

        if (this.members.size >= this.maxMembers) {
            console.log('Reached max members limit');
            this.finishCollection();
            return;
        }

        if (this.totalMemberCount > 0 && this.members.size >= this.totalMemberCount) {
            console.log('Collected all members');
            this.finishCollection();
            return;
        }

        if (newMembersAdded && this.members.size < this.maxMembers) {
            const highestReceived = Math.max(...Array.from(this.rangesReceived).map(r => parseInt(r.split('-')[1])), 0);
            const nextStart = highestReceived + 1;
            
            if (nextStart < this.totalMemberCount && nextStart < this.maxMembers) {
                const nextRangeKey = `${nextStart}-${nextStart + 99}`;
                if (!this.rangesRequested.has(nextRangeKey)) {
                    setTimeout(() => {
                        this.requestMoreMembers(nextStart);
                    }, 300);
                }
            }
        }
    }

    finishCollection() {
        if (this.memberListComplete) return;
        this.memberListComplete = true;

        console.log(`Finished collecting ${this.members.size} members`);
        
        this.cleanup();
        
        if (this.resolveMembers) {
            this.resolveMembers({
                success: true,
                members: Array.from(this.members.values()),
                count: this.members.size,
                totalMemberCount: this.totalMemberCount,
                onlineCount: this.onlineCount,
                note: `Found ${this.members.size} members through Gateway member list`
            });
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    cleanup() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.noNewDataTimeout) {
            clearTimeout(this.noNewDataTimeout);
            this.noNewDataTimeout = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.ws) {
            try {
                this.ws.close();
            } catch (e) {}
            this.ws = null;
        }
    }
}

async function fetchMembersViaGateway(token, guildId, channelId, maxMembers = 1000) {
    const gateway = new DiscordGateway(token);
    return await gateway.fetchMembers(guildId, channelId, maxMembers);
}

class ButtonClickGateway {
    constructor(token) {
        this.token = token;
        this.ws = null;
        this.heartbeatInterval = null;
        this.sequence = null;
        this.sessionId = null;
        this.resolveButton = null;
        this.rejectButton = null;
        this.timeout = null;
        this.targetChannelId = null;
        this.targetApplicationId = null;
        this.capturedButton = null;
        this.commandSent = false;
    }

    async executeAndClick(channelId, guildId, applicationId, commandId, commandVersion, options, clickCount, clickDelayMs, delayClick = false) {
        return new Promise((resolve, reject) => {
            this.resolveButton = resolve;
            this.rejectButton = reject;
            this.targetChannelId = channelId;
            this.targetApplicationId = applicationId;
            this.guildId = guildId;
            this.commandId = commandId;
            this.commandVersion = commandVersion;
            this.options = options || [];
            this.clickCount = clickCount || 1;
            this.clickDelayMs = clickDelayMs || 500;
            this.capturedButton = null;
            this.delayClick = delayClick || false;

            this.timeout = setTimeout(() => {
                this.cleanup();
                resolve({
                    success: false,
                    error: 'Timeout waiting for button message'
                });
            }, 15000);

            this.connect();
        });
    }

    connect() {
        this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

        this.ws.on('open', () => {
            console.log('ButtonClickGateway connected');
        });

        this.ws.on('message', (data) => {
            this.handleMessage(JSON.parse(data.toString()));
        });

        this.ws.on('error', (error) => {
            console.error('ButtonClickGateway error:', error);
            this.cleanup();
            if (this.rejectButton) {
                this.rejectButton(new Error('Gateway connection error'));
            }
        });

        this.ws.on('close', () => {
            this.cleanup();
        });
    }

    handleMessage(message) {
        const { op, t, d, s } = message;
        if (s) this.sequence = s;

        switch (op) {
            case 10:
                this.handleHello(d);
                break;
            case 11:
                break;
            case 0:
                this.handleDispatch(t, d);
                break;
        }
    }

    handleHello(data) {
        this.startHeartbeat(data.heartbeat_interval);
        this.identify();
    }

    startHeartbeat(interval) {
        this.heartbeatInterval = setInterval(() => {
            this.send({ op: 1, d: this.sequence });
        }, interval);
    }

    identify() {
        this.send({
            op: 2,
            d: {
                token: this.token,
                capabilities: 16381,
                properties: {
                    os: "Windows",
                    browser: "Chrome",
                    device: "",
                    system_locale: "ja",
                    browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    browser_version: "120.0.0.0",
                    os_version: "10",
                    release_channel: "stable",
                    client_build_number: 251236
                },
                presence: { status: "online", since: 0, activities: [], afk: false },
                compress: false,
                client_state: {
                    guild_versions: {},
                    highest_last_message_id: "0",
                    read_state_version: 0,
                    user_guild_settings_version: -1,
                    user_settings_version: -1,
                    private_channels_version: "0"
                }
            }
        });
    }

    handleDispatch(eventType, data) {
        console.log(`ButtonClickGateway event: ${eventType}`);
        
        switch (eventType) {
            case 'READY':
                console.log('ButtonClickGateway READY');
                this.sessionId = data.session_id;
                setTimeout(() => this.subscribeToGuild(), 500);
                break;

            case 'GUILD_MEMBER_LIST_UPDATE':
                if (!this.commandSent) {
                    this.commandSent = true;
                    setTimeout(() => this.executeCommand(), 300);
                }
                break;

            case 'MESSAGE_CREATE':
                this.handleMessageCreate(data);
                break;

            case 'INTERACTION_SUCCESS':
                console.log('INTERACTION_SUCCESS:', JSON.stringify(data).substring(0, 500));
                this.handleInteractionSuccess(data);
                break;
                
            case 'INTERACTION_CREATE':
                console.log('INTERACTION_CREATE:', data.type, data.id);
                break;
                
            default:
                break;
        }
    }
    
    handleInteractionSuccess(data) {
        if (!data.interaction || !data.interaction.type) return;
        
        if (data.interaction.type === 2) {
            console.log('Slash command succeeded, looking for message...');
            
            if (data.response && data.response.message) {
                const msg = data.response.message;
                console.log(`Found response message: id=${msg.id}, hasComponents=${!!msg.components?.length}`);
                
                if (msg.components && msg.components.length > 0) {
                    for (const row of msg.components) {
                        for (const component of row.components || []) {
                            if (component.type === 2 && component.custom_id && 
                                (component.custom_id.startsWith('aanko_t_') || component.custom_id.startsWith('aanko_p_'))) {
                                
                                console.log(`Found button in INTERACTION_SUCCESS! messageId=${msg.id}, customId=${component.custom_id}`);
                                this.capturedButton = {
                                    messageId: msg.id,
                                    customId: component.custom_id,
                                    flags: msg.flags || 64
                                };
                                
                                setTimeout(() => this.clickButton(), 300);
                                return;
                            }
                        }
                    }
                }
            }
        }
    }
    
    subscribeToGuild() {
        console.log(`Subscribing to guild ${this.guildId}, channel ${this.targetChannelId}...`);
        
        this.send({
            op: 14,
            d: {
                guild_id: this.guildId,
                channels: {
                    [this.targetChannelId]: [[0, 99]]
                }
            }
        });

        this.send({
            op: 37,
            d: {
                subscriptions: {
                    [this.guildId]: {
                        channels: {
                            [this.targetChannelId]: [[0, 99]]
                        }
                    }
                }
            }
        });
        
        setTimeout(() => {
            if (!this.commandSent) {
                this.commandSent = true;
                this.executeCommand();
            }
        }, 1000);
    }

    async executeCommand() {
        console.log('Executing /aanko command via HTTP...');
        
        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateBoundary = () => {
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const nonce = generateSnowflake();

        const payload = {
            type: 2,
            application_id: this.targetApplicationId,
            channel_id: this.targetChannelId,
            session_id: this.sessionId,
            nonce: nonce,
            data: {
                version: this.commandVersion,
                id: this.commandId,
                name: 'aanko',
                type: 1,
                options: this.options
            }
        };

        if (this.guildId) {
            payload.guild_id = this.guildId;
        }

        const boundary = '----WebKitFormBoundary' + generateBoundary();
        const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`;

        try {
            const response = await axios.post('https://discord.com/api/v10/interactions', formBody, {
                headers: {
                    'Authorization': this.token,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'X-Super-Properties': Buffer.from(JSON.stringify({
                        os: "Windows", browser: "Chrome", device: "", system_locale: "ja",
                        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        browser_version: "120.0.0.0", os_version: "10", release_channel: "stable",
                        client_build_number: 251236
                    })).toString('base64'),
                    'X-Discord-Locale': 'ja',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://discord.com'
                }
            });
            console.log('Sent /aanko command via HTTP, waiting for button message...');
        } catch (error) {
            console.error('HTTP /aanko failed:', error.response?.data || error.message);
        }
    }

    handleMessageCreate(data) {
        console.log(`MESSAGE_CREATE: channel=${data.channel_id}, author=${data.author?.id}, hasComponents=${!!data.components?.length}`);
        
        if (data.channel_id !== this.targetChannelId) return;
        if (data.author?.id !== this.targetApplicationId) return;
        if (!data.components || data.components.length === 0) return;

        for (const row of data.components) {
            for (const component of row.components || []) {
                if (component.type === 2 && component.custom_id && 
                    (component.custom_id.startsWith('aanko_t_') || component.custom_id.startsWith('aanko_p_'))) {
                    
                    console.log(`Found button! messageId=${data.id}, customId=${component.custom_id}`);
                    this.capturedButton = {
                        messageId: data.id,
                        customId: component.custom_id,
                        flags: data.flags || 0
                    };
                    
                    if (this.delayClick) {
                        console.log(`[DELAY_CLICK] Button found but delayClick=true, not clicking yet. messageId=${data.id}`);
                        this.cleanup();
                        if (this.resolveButton) {
                            this.resolveButton({
                                success: true,
                                messageId: data.id,
                                customId: component.custom_id,
                                delayedClick: true,
                                message: 'Button found, click delayed'
                            });
                        }
                    } else {
                        setTimeout(() => this.clickButton(), 300);
                    }
                    return;
                }
            }
        }
    }

    async clickButton() {
        if (!this.capturedButton) {
            this.cleanup();
            if (this.resolveButton) {
                this.resolveButton({ success: false, error: 'No button captured' });
            }
            return;
        }

        console.log(`Clicking button ${this.clickCount} times via HTTP API...`);
        let executed = 0;

        const generateSnowflake = () => {
            const timestamp = BigInt(Date.now() - 1420070400000) << 22n;
            const random = BigInt(Math.floor(Math.random() * 4194304));
            return (timestamp | random).toString();
        };

        const generateBoundary = () => {
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)];
            }
            return result;
        };

        const superProperties = {
            os: "Windows",
            browser: "Chrome",
            device: "",
            system_locale: "ja",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            browser_version: "120.0.0.0",
            os_version: "10",
            release_channel: "stable",
            client_build_number: 251236
        };

        for (let i = 0; i < this.clickCount; i++) {
            try {
                const clickPayload = {
                    type: 3,
                    nonce: generateSnowflake(),
                    session_id: this.sessionId,
                    channel_id: this.targetChannelId,
                    message_id: this.capturedButton.messageId,
                    message_flags: this.capturedButton.flags || 0,
                    application_id: this.targetApplicationId,
                    data: {
                        component_type: 2,
                        custom_id: this.capturedButton.customId
                    }
                };

                if (this.guildId) {
                    clickPayload.guild_id = this.guildId;
                }

                const boundary = '----WebKitFormBoundary' + generateBoundary();
                const formBody = `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${JSON.stringify(clickPayload)}\r\n--${boundary}--`;

                await axios.post('https://discord.com/api/v10/interactions', formBody, {
                    headers: {
                        'Authorization': this.token,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'X-Super-Properties': Buffer.from(JSON.stringify(superProperties)).toString('base64'),
                        'X-Discord-Locale': 'ja',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Origin': 'https://discord.com',
                        'Referer': 'https://discord.com/channels/@me'
                    }
                });

                executed++;
                console.log(`Clicked button ${i + 1}/${this.clickCount} via HTTP`);

            } catch (error) {
                console.log(`Button click ${i + 1} failed: ${error.response?.data?.message || error.message}`);
                if (error.response?.status === 429) {
                    const retryAfter = (error.response?.data?.retry_after || 1) * 1000;
                    await new Promise(r => setTimeout(r, retryAfter));
                }
            }

            if (i < this.clickCount - 1) {
                await new Promise(r => setTimeout(r, this.clickDelayMs));
            }
        }

        this.cleanup();
        if (this.resolveButton) {
            this.resolveButton({
                success: executed > 0,
                messageId: this.capturedButton.messageId,
                customId: this.capturedButton.customId,
                executed: executed,
                total: this.clickCount
            });
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    cleanup() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
        }
    }
}

async function executeButtonViaGateway(token, channelId, guildId, applicationId, commandId, commandVersion, options, clickCount, clickDelayMs, delayClick = false) {
    const gateway = new ButtonClickGateway(token);
    return await gateway.executeAndClick(channelId, guildId, applicationId, commandId, commandVersion, options, clickCount, clickDelayMs, delayClick);
}

async function clickButtonDirectly(token, guildId, channelId, applicationId, messageId, customId, clickCount = 10, clickDelayMs = 500) {
    const gateway = new ButtonClickGateway(token);
    gateway.targetChannelId = channelId;
    gateway.guildId = guildId;
    gateway.targetApplicationId = applicationId;
    gateway.clickCount = clickCount;
    gateway.clickDelayMs = clickDelayMs;
    gateway.capturedButton = {
        messageId: messageId,
        customId: customId,
        flags: 0
    };
    gateway.sessionId = 'dummy';
    
    return new Promise(async (resolve) => {
        gateway.resolveButton = resolve;
        await gateway.clickButton();
    });
}

module.exports = { fetchMembersViaGateway, DiscordGateway, executeButtonViaGateway, ButtonClickGateway, clickButtonDirectly };
