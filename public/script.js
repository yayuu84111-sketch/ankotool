let currentMembers = [];

async function fetchMembers() {
    const guildId = document.getElementById('guildId').value.trim();
    const token = document.getElementById('userToken').value.trim();
    
    hideAllSections();
    
    if (!guildId || !token) {
        showError('サーバーIDとトークンの両方を入力してください');
        return;
    }
    
    if (!/^\d{17,19}$/.test(guildId)) {
        showError('有効なサーバーIDを入力してください（17-19桁の数字）');
        return;
    }
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('fetchBtn').disabled = true;
    document.getElementById('fetchBtn').innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Gateway経由で取得中...';
    
    try {
        const response = await fetch('/api/members-gateway', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                guildId: guildId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Unknown error');
        }
        
        currentMembers = data.members;
        displayResults(data.members, data.count, data.totalMemberCount, data.onlineCount);
        
    } catch (error) {
        console.error('Error:', error);
        showError(getErrorMessage(error.message));
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('fetchBtn').disabled = false;
        document.getElementById('fetchBtn').innerHTML = '<i class="fas fa-users mr-2"></i>メンバーを取得';
    }
}

function displayResults(members, count, totalMemberCount, onlineCount) {
    let countText = count.toString();
    if (totalMemberCount && totalMemberCount > count) {
        countText += ` / ${totalMemberCount}`;
    }
    if (onlineCount) {
        countText += ` (オンライン: ${onlineCount})`;
    }
    document.getElementById('memberCount').textContent = countText;
    
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    members.forEach((member, index) => {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors';
        
        const displayName = member.nickname || member.username;
        const discriminator = member.discriminator !== '0' ? `#${member.discriminator}` : '';
        
        memberDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-gray-400 text-sm w-8">${index + 1}</span>
                <div>
                    <div class="text-white font-medium">${escapeHtml(displayName)}${discriminator}</div>
                    <div class="text-gray-400 text-sm font-mono">${member.id}</div>
                </div>
            </div>
            <button onclick="copyToClipboard('${member.id}')" class="text-blue-400 hover:text-blue-300 transition-colors">
                <i class="fas fa-copy"></i>
            </button>
        `;
        
        memberList.appendChild(memberDiv);
    });
    
    document.getElementById('results').classList.remove('hidden');
}

function copyAllIds() {
    const ids = currentMembers.map(member => member.id).join('\n');
    copyToClipboard(ids, 'すべてのIDをコピーしました！');
}

function copyToClipboard(text, message = 'IDをコピーしました！') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(message);
    }).catch(err => {
        console.error('コピーに失敗しました:', err);
        showToast('コピーに失敗しました', 'error');
    });
}

function downloadCSV() {
    const csvContent = 'ID,Username,Discriminator,Nickname\n' + 
        currentMembers.map(member => 
            `${member.id},"${escapeCSV(member.username)}","${member.discriminator}","${escapeCSV(member.nickname || '')}"`
        ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `discord_members_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSVファイルをダウンロードしました！');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').classList.remove('hidden');
}

function hideAllSections() {
    document.getElementById('results').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white font-medium z-50 transform transition-all duration-300 ${
        type === 'error' ? 'bg-red-500' : 'bg-green-500'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function getErrorMessage(error) {
    const errorMessages = {
        'Invalid token': 'トークンが無効です',
        'Insufficient permissions': '権限が不足しています',
        'Guild not found': 'サーバーが見つかりません',
        'Internal server error': 'サーバーエラーが発生しました'
    };
    
    return errorMessages[error] || `エラー: ${error}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeCSV(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
}

function switchTab(tabName) {
    document.getElementById('membersTab').classList.add('hidden');
    document.getElementById('aankoTab').classList.add('hidden');
    document.getElementById('joinerTab').classList.add('hidden');
    
    document.getElementById('membersTabBtn').classList.remove('bg-blue-600');
    document.getElementById('membersTabBtn').classList.add('bg-white/10');
    document.getElementById('aankoTabBtn').classList.remove('bg-blue-600');
    document.getElementById('aankoTabBtn').classList.add('bg-white/10');
    document.getElementById('joinerTabBtn').classList.remove('bg-blue-600');
    document.getElementById('joinerTabBtn').classList.add('bg-white/10');
    
    const externalAppSection = document.getElementById('externalAppSection');
    const accountSettingsSection = document.getElementById('accountSettingsSection');
    
    if (tabName === 'members') {
        document.getElementById('membersTab').classList.remove('hidden');
        document.getElementById('membersTabBtn').classList.add('bg-blue-600');
        document.getElementById('membersTabBtn').classList.remove('bg-white/10');
        if (externalAppSection) externalAppSection.classList.remove('hidden');
        if (accountSettingsSection) accountSettingsSection.classList.remove('hidden');
    } else if (tabName === 'aanko') {
        document.getElementById('aankoTab').classList.remove('hidden');
        document.getElementById('aankoTabBtn').classList.add('bg-blue-600');
        document.getElementById('aankoTabBtn').classList.remove('bg-white/10');
        if (externalAppSection) externalAppSection.classList.remove('hidden');
        if (accountSettingsSection) accountSettingsSection.classList.remove('hidden');
        loadBotInfo();
    } else if (tabName === 'joiner') {
        document.getElementById('joinerTab').classList.remove('hidden');
        document.getElementById('joinerTabBtn').classList.add('bg-blue-600');
        document.getElementById('joinerTabBtn').classList.remove('bg-white/10');
        if (externalAppSection) externalAppSection.classList.add('hidden');
        if (accountSettingsSection) accountSettingsSection.classList.add('hidden');
    }
}

async function loadBotInfo() {
    const serverInviteUrl = 'https://discord.gg/NYmSAdHjWV';
    document.getElementById('botInviteUrl').value = serverInviteUrl;
    document.getElementById('botInviteLink').href = serverInviteUrl;
    
    try {
        const response = await fetch('/api/bot/info');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('storedMemberCount').innerHTML = 
                `<i class="fas fa-database mr-2"></i>${data.storedMemberCount} 人のIDが保存済み`;
            document.getElementById('botStatusIndicator').classList.add('bg-green-500');
            document.getElementById('botStatusIndicator').classList.remove('bg-red-500');
            document.getElementById('botStatusText').textContent = 'Bot稼働中';
        }
    } catch (error) {
        console.error('Error loading bot info:', error);
        document.getElementById('botStatusIndicator').classList.remove('bg-green-500');
        document.getElementById('botStatusIndicator').classList.add('bg-red-500');
        document.getElementById('botStatusText').textContent = 'Bot接続エラー';
    }
    
    try {
        const configResponse = await fetch('/api/config/default-message');
        const configData = await configResponse.json();
        
        if (configData.success && configData.defaultMessage) {
            window.storedDefaultMessage = configData.defaultMessage;
        }
    } catch (error) {
        console.error('Error loading default message:', error);
    }
}

function copyInviteUrl() {
    const url = document.getElementById('botInviteUrl').value;
    if (url) {
        copyToClipboard(url, '招待URLをコピーしました！');
    }
}

function insertMemberIdsToInput() {
    if (currentMembers.length === 0) {
        showToast('先にメンバーを取得してください', 'error');
        return;
    }
    
    const memberIds = currentMembers.map(m => m.id);
    const idsText = memberIds.join(', ');
    
    document.getElementById('aankoUserIds').value = idsText;
    
    const aheUserIds = document.getElementById('aheButtonUserIds');
    if (aheUserIds) aheUserIds.value = idsText;
    
    const replayUserIds = document.getElementById('replayUserIds');
    if (replayUserIds) replayUserIds.value = idsText;
    
    document.getElementById('storedMemberCount').innerHTML = 
        `<i class="fas fa-check-circle mr-2"></i>${memberIds.length} 人挿入済み`;
    
    const replayCountSpan = document.getElementById('replayStoredMemberCount');
    if (replayCountSpan) {
        replayCountSpan.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${memberIds.length} 人挿入済み`;
    }
    
    showToast(`${memberIds.length} 人のメンバーIDを全ての入力欄に挿入しました！`);
}

async function fetchMembersFromAankoTab() {
    const guildId = document.getElementById('guildId').value.trim();
    const token = document.getElementById('userToken').value.trim();
    
    if (!guildId || !token) {
        showToast('サーバーIDとトークンを入力してください', 'error');
        return;
    }
    
    if (!/^\d{17,19}$/.test(guildId)) {
        showToast('有効なサーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('aankoFetchBtn');
    const countSpan = document.getElementById('storedMemberCount');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>取得中...';
    
    try {
        const response = await fetch('/api/members-gateway', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                guildId: guildId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Unknown error');
        }
        
        currentMembers = data.members;
        countSpan.innerHTML = `<i class="fas fa-check-circle mr-2 text-green-400"></i>${data.count} 人取得済み`;
        
        const replayCountSpan = document.getElementById('replayStoredMemberCount');
        if (replayCountSpan) {
            replayCountSpan.innerHTML = `<i class="fas fa-database mr-1"></i>${data.count} 人取得済み`;
        }
        
        showToast(`${data.count} 人のメンバーを取得しました！`);
        
    } catch (error) {
        console.error('Error:', error);
        countSpan.innerHTML = `<i class="fas fa-times-circle mr-2 text-red-400"></i>取得失敗`;
        showToast(getErrorMessage(error.message), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-users mr-2"></i>メンバーを取得';
    }
}

async function debugSearchAanko() {
    const token = document.getElementById('userToken').value.trim();
    const channelId = document.getElementById('testChannelId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!channelId) {
        showToast('チャンネルIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('debugSearchBtn');
    const resultDiv = document.getElementById('testResult');
    const resultText = document.getElementById('testResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>検索中...';
    resultDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/debug-search-aanko', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, channelId })
        });
        
        const data = await response.json();
        
        resultDiv.classList.remove('hidden');
        
        if (data.success) {
            let html = `<p class="text-blue-400 mb-2"><i class="fas fa-info-circle mr-2"></i>検索結果:</p>`;
            html += `<p class="text-gray-300">Bot Client ID: ${data.botClientId}</p>`;
            html += `<p class="text-gray-300">見つかったコマンド数: ${data.totalCommands}</p>`;
            html += `<p class="${data.aankoFound ? 'text-green-400' : 'text-red-400'}">aanko コマンド: ${data.aankoFound ? '見つかりました' : '見つかりません'}</p>`;
            
            if (data.allCommands.length > 0) {
                html += `<p class="text-gray-400 mt-2">全コマンド:</p><ul class="text-xs text-gray-500">`;
                data.allCommands.forEach(cmd => {
                    html += `<li>${cmd.name} (app: ${cmd.application_id})</li>`;
                });
                html += `</ul>`;
            }
            
            if (data.aankoCommand) {
                html += `<p class="text-green-400 mt-2">aanko詳細: ID=${data.aankoCommand.id}, Version=${data.aankoCommand.version}</p>`;
            } else {
                html += `<p class="text-yellow-400 mt-2">⚠️ Botをインストールしていない可能性があります。招待リンクからBotをインストールしてください。</p>`;
            }
            
            resultText.innerHTML = html;
        } else {
            resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${data.error}</p>`;
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search mr-2"></i>/aanko コマンドを検索（デバッグ）';
    }
}

async function testToken() {
    const token = document.getElementById('userToken').value.trim();
    const channelId = document.getElementById('testChannelId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!channelId) {
        showToast('チャンネルIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('testTokenBtn');
    const resultDiv = document.getElementById('testResult');
    const resultText = document.getElementById('testResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...';
    resultDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/test-send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                channelId,
                message: 'デフォルト2'
            })
        });
        
        const data = await response.json();
        
        resultDiv.classList.remove('hidden');
        
        if (data.success) {
            resultText.innerHTML = `
                <p class="text-green-400"><i class="fas fa-check-circle mr-2"></i>トークンは正常に動作しています！メッセージを送信しました。</p>
            `;
            showToast('テスト成功！メッセージを送信しました');
        } else {
            resultText.innerHTML = `
                <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${data.error}</p>
            `;
            showToast('テスト失敗', 'error');
        }
    } catch (error) {
        console.error('Error testing token:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `
            <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>
        `;
        showToast('テスト失敗', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>「こんにちは」を送信してテスト';
    }
}

async function checkChannelPermissions() {
    const tokens = document.getElementById('userToken').value.trim().split('\n').filter(t => t.trim());
    const guildId = document.getElementById('guildId').value.trim();
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!guildId) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('checkPermissionsBtn');
    const resultDiv = document.getElementById('externalTestResult');
    const resultText = document.getElementById('externalTestResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>チェック中...';
    resultDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/check-channel-permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: tokens[0],
                guildId
            })
        });
        
        const data = await response.json();
        
        resultDiv.classList.remove('hidden');
        
        if (data.success) {
            let html = `
                <div class="mb-4">
                    <p class="text-white font-bold mb-2">
                        <i class="fas fa-user mr-2"></i>ユーザー: ${data.user.username}
                        ${data.isAdmin ? '<span class="text-purple-400 ml-2">(管理者)</span>' : ''}
                    </p>
                    <div class="grid grid-cols-4 gap-2 text-center">
                        <div class="bg-green-500/20 rounded-lg p-2">
                            <p class="text-green-400 text-xl font-bold">${data.summary.ok}</p>
                            <p class="text-gray-400 text-xs">使用可能</p>
                        </div>
                        <div class="bg-yellow-500/20 rounded-lg p-2">
                            <p class="text-yellow-400 text-xl font-bold">${data.summary.noView}</p>
                            <p class="text-gray-400 text-xs">閲覧不可</p>
                        </div>
                        <div class="bg-orange-500/20 rounded-lg p-2">
                            <p class="text-orange-400 text-xl font-bold">${data.summary.noSend || 0}</p>
                            <p class="text-gray-400 text-xs">送信不可</p>
                        </div>
                        <div class="bg-red-500/20 rounded-lg p-2">
                            <p class="text-red-400 text-xl font-bold">${data.summary.noAppCommands}</p>
                            <p class="text-gray-400 text-xs">コマンド不可</p>
                        </div>
                    </div>
                </div>
                <div class="space-y-1">
            `;
            
            for (const ch of data.channels) {
                let statusClass, statusIcon;
                if (ch.status === 'ok') {
                    statusClass = 'text-green-400';
                    statusIcon = 'fa-check-circle';
                } else if (ch.status === 'no_view') {
                    statusClass = 'text-yellow-400';
                    statusIcon = 'fa-eye-slash';
                } else if (ch.status === 'no_send') {
                    statusClass = 'text-orange-400';
                    statusIcon = 'fa-comment-slash';
                } else {
                    statusClass = 'text-red-400';
                    statusIcon = 'fa-ban';
                }
                
                let slowModeIndicator = '';
                if (ch.slowMode && ch.slowMode > 0 && ch.status === 'ok') {
                    slowModeIndicator = `<span class="text-blue-400 text-xs ml-2"><i class="fas fa-clock mr-1"></i>${ch.slowMode}s</span>`;
                }
                
                let everyoneIndicator = '';
                if (ch.status === 'ok') {
                    if (ch.canMentionEveryone) {
                        everyoneIndicator = `<span class="text-yellow-400 text-xs ml-2" title="@everyone使用可能"><i class="fas fa-bullhorn"></i></span>`;
                    } else {
                        everyoneIndicator = `<span class="text-gray-500 text-xs ml-2" title="@everyone使用不可"><i class="fas fa-bullhorn"></i></span>`;
                    }
                }
                
                let threadIndicator = '';
                if (ch.status === 'ok') {
                    if (ch.canCreatePublicThreads) {
                        threadIndicator = `<span class="text-green-400 text-xs ml-1" title="スレッド作成可能"><i class="fas fa-comments"></i></span>`;
                    } else {
                        threadIndicator = `<span class="text-gray-500 text-xs ml-1" title="スレッド作成不可"><i class="fas fa-comments"></i></span>`;
                    }
                }
                
                html += `
                    <div class="flex items-center justify-between py-1 border-b border-white/10">
                        <span class="text-gray-300">
                            <i class="fas fa-hashtag mr-1 text-gray-500"></i>${ch.name}${slowModeIndicator}${everyoneIndicator}${threadIndicator}
                        </span>
                        <span class="${statusClass}">
                            <i class="fas ${statusIcon} mr-1"></i>
                            ${ch.reason || '使用可能'}
                        </span>
                    </div>
                `;
            }
            
            html += '</div>';
            resultText.innerHTML = html;
            showToast(`${data.summary.ok}/${data.summary.total} チャンネルで使用可能`);
        } else {
            resultText.innerHTML = `
                <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${data.error}</p>
            `;
            showToast('チェック失敗', 'error');
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `
            <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>
        `;
        showToast('チェック失敗', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shield-alt mr-2"></i>全チャンネルの権限をチェック';
    }
}

let isAankoRunning = false;
let shouldStopAanko = false;
let aankoAbortController = null;

function setMentionCountAll() {
    const userIdsText = document.getElementById('aankoUserIds').value.trim();
    const userIds = userIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim().replace(/^<@!?(\d+)>$/, '$1').replace(/[<@!>]/g, ''))
        .filter(id => id && /^\d{15,20}$/.test(id));
    
    if (userIds.length === 0) {
        showToast('先にユーザーIDを入力してください', 'error');
        return;
    }
    
    document.getElementById('aankoMentionCount').value = userIds.length;
    showToast(`メンション人数を ${userIds.length} 人に設定しました`);
}

async function fetchAllTextChannels() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!guildId) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchChannelsBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, skipFilter: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const channelIds = data.channels.map(c => c.id).join(', ');
            document.getElementById('aankoChannelIds').value = channelIds;
            showToast(`${data.channels.length} 個のテキストチャンネルを取得しました（フィルターなし）`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('チャンネル取得に失敗しました: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hashtag mr-1"></i>サーバーの全チャンネルを取得';
    }
}

async function stopAankoCommand() {
    shouldStopAanko = true;
    if (aankoAbortController) {
        aankoAbortController.abort();
    }
    
    // Also cancel server-side operation
    try {
        await fetch('/api/cancel-direct-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.log('Cancel request error:', e);
    }
    
    showToast('停止リクエストを送信しました...');
}

function togglePollOptions() {
    const checkbox = document.getElementById('aankoPollEnabled');
    const container = document.getElementById('pollOptionsContainer');
    if (checkbox.checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

async function executeAankoCommand() {
    const tokensText = document.getElementById('userToken').value.trim();
    const channelIdsText = document.getElementById('aankoChannelIds').value.trim();
    const userIdsText = document.getElementById('aankoUserIds').value.trim();
    const mentionCount = parseInt(document.getElementById('aankoMentionCount').value) || 0;
    let message = document.getElementById('aankoMessage').value.trim() || null;
    const perChannelCount = parseInt(document.getElementById('aankoPerChannelCount').value) || 5;
    const totalCount = parseInt(document.getElementById('aankoExecuteCount').value) || 0;
    const delaySeconds = parseFloat(document.getElementById('aankoDelaySeconds').value) || 0.01;
    const delayMs = Math.max(delaySeconds * 1000, 10);
    const includeRandomChars = document.getElementById('aankoRandomChars')?.checked ?? true;
    const includeEveryone = document.getElementById('aankoEveryone')?.checked ?? false;
    
    const pollEnabled = document.getElementById('aankoPollEnabled')?.checked ?? false;
    let pollQuestion = document.getElementById('aankoPollQuestion')?.value.trim() || '';
    let pollAnswersText = document.getElementById('aankoPollAnswers')?.value.trim() || '';
    const pollDuration = parseInt(document.getElementById('aankoPollDuration')?.value) || 24;
    const pollMultiselect = document.getElementById('aankoPollMultiselect')?.value === 'true';
    
    const defaultPollQuestion = '🤍🩷💚🖤❤️🩵🩶🧡💙💛💜🤎❣️💗💝💓❤️‍🩹❤️‍🔥💞💘💖💕 😉あんこちゃんだよ！🩵あんこ鯖では主にピクセルガンの無償代行 🧡ワイワイ雑談‼️ 🩷荒らしを行っています 🤍スマホ勢でも荒らし知識がなくても 💚自作あんこアプリで最強荒らし勢になろう';
    const defaultPollAnswer = '❤️🧡💛💚💙💜🤎🖤🤍🩷🩵🩶💖💗💓💞💕💘💝';
    
    let pollData = null;
    if (pollEnabled) {
        if (!pollQuestion) {
            pollQuestion = defaultPollQuestion;
        }
        let answers;
        if (!pollAnswersText) {
            answers = Array(10).fill(defaultPollAnswer);
        } else {
            answers = pollAnswersText.split('\n').map(a => a.trim()).filter(a => a.length > 0);
        }
        if (answers.length >= 2 && answers.length <= 10) {
            pollData = {
                question: pollQuestion,
                answers: answers,
                duration: pollDuration,
                multiselect: pollMultiselect
            };
        } else {
            showToast('投票の選択肢は2〜10個にしてください', 'error');
            return;
        }
    }
    
    // includeEveryoneはサーバーに送信し、サーバー側で処理する
    // messageが空でincludeEveryoneがtrueの場合、サーバーでデフォルトメッセージ + @everyoneになる
    
    let tokens = [];
    if (tokensText) {
        tokens = tokensText.split(/[\n]+/).map(t => t.trim()).filter(t => t.length > 20);
    }
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!channelIdsText) {
        showToast('チャンネルIDを入力してください', 'error');
        return;
    }
    
    const channelIds = channelIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim())
        .filter(id => id && /^\d+$/.test(id));
    
    if (channelIds.length === 0) {
        showToast('有効なチャンネルIDを入力してください', 'error');
        return;
    }
    
    const userIds = userIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim().replace(/^<@!?(\d+)>$/, '$1').replace(/[<@!>]/g, ''))
        .filter(id => id && /^\d{15,20}$/.test(id));
    
    const btn = document.getElementById('aankoExecuteBtn');
    const stopBtn = document.getElementById('aankoStopBtn');
    const progressDiv = document.getElementById('aankoProgress');
    const progressText = document.getElementById('aankoProgressText');
    const resultDiv = document.getElementById('aankoExecuteResult');
    const resultText = document.getElementById('aankoResultText');
    
    isAankoRunning = true;
    shouldStopAanko = false;
    aankoAbortController = new AbortController();
    btn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    progressText.textContent = '';
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    
    progressText.textContent = `${tokens.length}トークン x ${channelIds.length}チャンネル 送信中... (各チャンネル${perChannelCount}回, 間隔${delaySeconds}秒${totalCount > 0 ? `, 上限${totalCount}` : ''})`;
    
    try {
        const response = await fetch('/api/send-dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens,
                channelIds,
                userIds,
                mentionCount,
                message,
                count: perChannelCount,
                totalCount: totalCount,
                delayMs,
                includeRandomChars,
                includeEveryone,
                pollData
            }),
            signal: aankoAbortController.signal
        });
        
        const data = await response.json();
        
        resultDiv.classList.remove('hidden');
        if (data.success) {
            resultText.innerHTML = `
                <p class="text-green-400 mb-2"><i class="fas fa-check-circle mr-2"></i>完了！</p>
                <p class="text-gray-400">トークン数: ${data.tokenCount || tokens.length} | チャンネル数: ${data.channelCount || channelIds.length}</p>
                <p class="text-gray-400">成功: ${data.success} | 失敗: ${data.failed}</p>
                <p class="text-blue-400 text-sm mt-2">トークン直接送信完了</p>
            `;
            showToast(`送信完了: 成功${data.success} 失敗${data.failed}`);
        } else {
            throw new Error(data.error || '送信に失敗しました');
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            resultDiv.classList.remove('hidden');
            resultText.innerHTML = `<p class="text-yellow-400"><i class="fas fa-stop-circle mr-2"></i>停止しました</p>`;
            showToast('処理を停止しました');
        } else {
            console.error('Error executing send:', error);
            resultDiv.classList.remove('hidden');
            resultText.innerHTML = `
                <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>
            `;
            showToast('実行に失敗しました', 'error');
        }
    } finally {
        isAankoRunning = false;
        shouldStopAanko = false;
        aankoAbortController = null;
        btn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        progressDiv.classList.add('hidden');
    }
}

let isAheButtonRunning = false;
let shouldStopAheButton = false;
let aheButtonAbortController = null;
let aheButtonPollInterval = null;

async function createAheButtonAndClick() {
    const tokensText = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    const channelIdsText = document.getElementById('aheButtonChannelIds').value.trim();
    let channelIds = channelIdsText.split(/[,\n\s]+/).map(id => id.trim()).filter(id => /^\d{17,19}$/.test(id));
    const clickCount = parseInt(document.getElementById('aheButtonClickCount').value) || 1;
    const clicksPerChannel = Math.max(1, parseInt(document.getElementById('aheClicksPerChannel').value) || 1);
    let message = document.getElementById('aheButtonMessage').value.trim() || null;
    const userIdsText = document.getElementById('aheButtonUserIds').value.trim();
    const userIds = userIdsText ? userIdsText.split(/[,\n\s]+/).map(id => id.trim().replace(/^<@!?(\d+)>$/, '$1').replace(/[<@!>]/g, '')).filter(id => /^\d{15,20}$/.test(id)) : [];
    const includeEveryone = document.getElementById('aheButtonEveryone')?.checked ?? false;
    const randLen = 0; // ランダム文字は使用しない
    const dmUserId = document.getElementById('aheDmUserId')?.value.trim() || '';
    
    let mentionCount = parseInt(document.getElementById('aheButtonMentionCount').value) || 0;
    if (userIds.length > 0 && mentionCount === 0) {
        mentionCount = userIds.length;
        console.log(`[createAheButtonAndClick] Auto-set mentionCount to ${mentionCount} based on userIds`);
    }
    
    let tokens = [];
    if (tokensText) {
        tokens = tokensText.split(/[\n]+/).map(t => t.trim()).filter(t => t.length > 20);
    }
    
    if (tokens.length === 0) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    let isDmMode = false;
    if (dmUserId && /^\d{17,19}$/.test(dmUserId)) {
        isDmMode = true;
        channelIds = [];
    } else if (channelIds.length === 0) {
        showToast('チャンネルIDまたはDM送信先ユーザーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('aheButtonExecuteBtn');
    const stopBtn = document.getElementById('aheButtonStopBtn');
    const progressDiv = document.getElementById('aheButtonProgress');
    const progressText = document.getElementById('aheButtonProgressText');
    const resultDiv = document.getElementById('aheButtonResult');
    const resultText = document.getElementById('aheButtonResultText');
    
    isAheButtonRunning = true;
    shouldStopAheButton = false;
    aheButtonAbortController = new AbortController();
    
    btn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    // Clear any existing poll interval from previous run
    if (aheButtonPollInterval) {
        clearInterval(aheButtonPollInterval);
        aheButtonPollInterval = null;
    }
    
    progressText.innerHTML = '';
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    
    try {
        let totalClicksSent = 0;
        let totalButtonsCreated = 0;
        
        for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
            if (shouldStopAheButton) break;
            
            const token = tokens[tokenIndex];
            let targetChannelIds = isDmMode ? [] : channelIds;
            
            if (isDmMode) {
                progressText.textContent = `トークン ${tokenIndex + 1}/${tokens.length}: DM チャンネル作成中...`;
                
                try {
                    const dmResponse = await fetch('/api/create-dm-channel', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, userId: dmUserId }),
                        signal: aheButtonAbortController.signal
                    });
                    
                    const dmResult = await dmResponse.json();
                    
                    if (dmResult.success) {
                        targetChannelIds = [dmResult.channelId];
                        console.log(`Token ${tokenIndex + 1}: DM channel created: ${dmResult.channelId}`);
                    } else {
                        console.log(`Token ${tokenIndex + 1}: DM channel creation failed: ${dmResult.error}`);
                        showToast(`DM作成失敗: ${dmResult.error}`, 'error');
                        continue;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') throw e;
                    console.error(`Token ${tokenIndex + 1}: DM creation error: ${e.message}`);
                    showToast(`DMエラー: ${e.message}`, 'error');
                    continue;
                }
            }
            
            // Generate operationId for progress tracking
            const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            progressText.innerHTML = `<span class="text-yellow-400">🔄 実行中</span> - トークン ${tokenIndex + 1}/${tokens.length}<br><span class="text-gray-400">📦 ボタン作成準備中...</span>`;
            
            try {
                // Start polling for progress (use global variable to allow cleanup)
                aheButtonPollInterval = setInterval(async () => {
                    try {
                        const progressResponse = await fetch(`/api/operation-progress/${operationId}`);
                        const progressData = await progressResponse.json();
                        if (progressData.success && progressData.status) {
                            let phaseIcon = progressData.phase === 'creating' ? '📦' : '🖱️';
                            let statusColor = progressData.lastError ? 'text-orange-400' : 'text-blue-400';
                            let errorText = progressData.lastError ? `<br><span class="text-red-400 text-xs">エラー: ${progressData.lastError}</span>` : '';
                            progressText.innerHTML = `<span class="text-yellow-400">🔄 実行中</span> - トークン ${tokenIndex + 1}/${tokens.length}<br><span class="${statusColor}">${phaseIcon} ${progressData.status}</span>${errorText}`;
                        }
                    } catch (e) {}
                }, 400);
                
                // Start API call with operationId
                const createResponse = await fetch('/api/ahe-instant-parallel-button', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        channelIds: targetChannelIds,
                        clickCount,
                        clicksPerChannel,
                        guildId: isDmMode ? null : (guildId || null),
                        message: message || null,
                        userIds: userIds.length > 0 ? userIds : null,
                        mentionCount,
                        includeEveryone,
                        randLen,
                        operationId
                    }),
                    signal: aheButtonAbortController.signal
                });
                
                const createResult = await createResponse.json();
                
                // Stop polling
                if (aheButtonPollInterval) {
                    clearInterval(aheButtonPollInterval);
                    aheButtonPollInterval = null;
                }
                
                if (createResult.success) {
                    totalButtonsCreated += createResult.buttonsCreated || 0;
                    totalClicksSent += createResult.clicksSent || 0;
                    progressText.innerHTML = `<span class="text-green-400">✅ 完了</span> - トークン ${tokenIndex + 1}/${tokens.length}<br><span class="text-gray-400">ボタン: ${createResult.buttonsCreated}個, クリック: ${createResult.clicksSent}回</span>`;
                    console.log(`Token ${tokenIndex + 1}: Created ${createResult.buttonsCreated} buttons, sent ${createResult.clicksSent} clicks`);
                } else {
                    console.log(`Token ${tokenIndex + 1}: Failed - ${createResult.error}`);
                    continue;
                }
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                console.error(`Token ${tokenIndex + 1}: Error - ${e.message}`);
                continue;
            }
        }
        
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `
            <p class="text-green-400 mb-2"><i class="fas fa-bolt mr-2"></i>/ahe 処理完了！</p>
            <p class="text-gray-400">${isDmMode ? 'DM送信先: ' + dmUserId : 'チャンネル数: ' + channelIds.length}</p>
            <p class="text-gray-400">トークン数: ${tokens.length}</p>
            <p class="text-gray-400">総クリック回数: ${clickCount}</p>
            <p class="text-gray-400">${isDmMode ? '' : 'チャンネル毎クリック: ' + clicksPerChannel}</p>
            <p class="text-gray-400">作成ボタン合計: ${totalButtonsCreated}個</p>
            <p class="text-gray-400">送信クリック合計: ${totalClicksSent}回</p>
        `;
        showToast(`/ahe 処理完了! ${totalClicksSent}クリック発射`);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            resultDiv.classList.remove('hidden');
            resultText.innerHTML = `<p class="text-yellow-400"><i class="fas fa-stop-circle mr-2"></i>停止しました</p>`;
            showToast('処理を停止しました');
        } else {
            console.error('Error creating ahe button and clicking:', error);
            resultDiv.classList.remove('hidden');
            resultText.innerHTML = `
                <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>
            `;
            showToast('実行に失敗しました', 'error');
        }
    } finally {
        // Always clear the poll interval
        if (aheButtonPollInterval) {
            clearInterval(aheButtonPollInterval);
            aheButtonPollInterval = null;
        }
        isAheButtonRunning = false;
        shouldStopAheButton = false;
        aheButtonAbortController = null;
        btn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        progressDiv.classList.add('hidden');
    }
}

async function stopAheButtonClick() {
    shouldStopAheButton = true;
    
    // Clear poll interval immediately on stop
    if (aheButtonPollInterval) {
        clearInterval(aheButtonPollInterval);
        aheButtonPollInterval = null;
    }
    
    if (aheButtonAbortController) {
        aheButtonAbortController.abort();
    }
    
    // Also cancel server-side operation
    try {
        await fetch('/api/cancel-ahe-button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.log('Cancel request error:', e);
    }
    
    showToast('/ahe 停止中...', 'warning');
}

async function fetchAllTextChannelsForAhe() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!guildId || !/^\d{17,19}$/.test(guildId)) {
        showToast('有効なサーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchChannelsBtnAhe');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        // Use externalAppsOnly=true to get channels where external apps are allowed
        // (even if app commands are not allowed)
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, externalAppsOnly: true })
        });
        
        const data = await response.json();
        
        if (data.success && data.channels.length > 0) {
            const channelIds = data.channels.map(ch => ch.id).join('\n');
            document.getElementById('aheButtonChannelIds').value = channelIds;
            showToast(`${data.channels.length}個のチャンネルを取得しました！（外部アプリ許可チャンネル）`);
        } else {
            showToast('チャンネルが見つかりませんでした', 'error');
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('チャンネル取得に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function setMentionCountAllAhe() {
    const userIdsText = document.getElementById('aheButtonUserIds').value.trim();
    const userIds = userIdsText ? userIdsText.split(/[,\n\s]+/).map(id => id.trim().replace(/^<@!?(\d+)>$/, '$1').replace(/[<@!>]/g, '')).filter(id => /^\d{15,20}$/.test(id)) : [];
    document.getElementById('aheButtonMentionCount').value = userIds.length || 1;
}

let fetchedChannels = [];

async function autoFetchChannels() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token || !guildId || !/^\d{17,19}$/.test(guildId)) {
        return;
    }
    
    const statusEl = document.getElementById('channelFetchStatus');
    
    if (statusEl) statusEl.textContent = 'チャンネル取得中...';
    
    try {
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId })
        });
        
        const data = await response.json();
        
        if (data.success && data.channels.length > 0) {
            fetchedChannels = data.channels;
            
            const channelInput = document.getElementById('aankoChannelIds');
            if (channelInput && !channelInput.value.trim()) {
                const channelIds = data.channels.map(c => c.id).join(', ');
                channelInput.value = channelIds;
            }
            
            if (statusEl) statusEl.textContent = `${data.channels.length} 個のチャンネルを取得しました`;
            showToast(`${data.channels.length} 個のチャンネルを自動取得しました`);
        } else {
            if (statusEl) statusEl.textContent = 'チャンネルが見つかりません';
        }
    } catch (error) {
        console.log('Auto channel fetch failed:', error.message);
        if (statusEl) statusEl.textContent = 'チャンネル取得失敗';
    }
}

let previousGuildId = '';

function clearServerRelatedFields() {
    const aankoChannelIds = document.getElementById('aankoChannelIds');
    if (aankoChannelIds) aankoChannelIds.value = '';
    const aankoUserIds = document.getElementById('aankoUserIds');
    if (aankoUserIds) aankoUserIds.value = '';
    const testChannelId = document.getElementById('testChannelId');
    if (testChannelId) testChannelId.value = '';
    
    const aheChannelIds = document.getElementById('aheButtonChannelIds');
    if (aheChannelIds) aheChannelIds.value = '';
    const aheUserIds = document.getElementById('aheButtonUserIds');
    if (aheUserIds) aheUserIds.value = '';
    
    currentMembers = [];
    const storedMemberCount = document.getElementById('storedMemberCount');
    if (storedMemberCount) {
        storedMemberCount.innerHTML = '<i class="fas fa-database mr-2"></i>0 人取得済み';
    }
    
    const testResult = document.getElementById('testResult');
    if (testResult) testResult.classList.add('hidden');
    const externalTestResult = document.getElementById('externalTestResult');
    if (externalTestResult) externalTestResult.classList.add('hidden');
    const aankoExecuteResult = document.getElementById('aankoExecuteResult');
    if (aankoExecuteResult) aankoExecuteResult.classList.add('hidden');
    const aheButtonResult = document.getElementById('aheButtonResult');
    if (aheButtonResult) aheButtonResult.classList.add('hidden');
    
    fetchedChannels = [];
}

function toggleGroupDmMessageContainer() {
    const sendMessageCheckbox = document.getElementById('groupDmSendMessage');
    const messageContainer = document.getElementById('groupDmMessageContainer');
    if (sendMessageCheckbox && messageContainer) {
        if (sendMessageCheckbox.checked) {
            messageContainer.classList.remove('hidden');
        } else {
            messageContainer.classList.add('hidden');
        }
    }
}

let isGroupDmRunning = false;
let shouldStopGroupDm = false;

function stopGroupDmCreation() {
    shouldStopGroupDm = true;
    showToast('停止リクエストを送信しました...');
}

async function createGroupDmBatch() {
    if (isGroupDmRunning) {
        showToast('既に実行中です', 'error');
        return;
    }
    
    const tokens = document.getElementById('userToken').value.trim().split('\n').filter(t => t.trim());
    const friendIdsText = document.getElementById('groupDmFriendIds').value.trim();
    const groupName = document.getElementById('groupDmName').value.trim();
    const groupIcon = document.getElementById('groupDmIcon').value.trim();
    const sendMessage = document.getElementById('groupDmSendMessage').checked;
    const autoLeave = document.getElementById('groupDmAutoLeave').checked;
    const message = document.getElementById('groupDmMessage').value.trim();
    const repeatCount = Math.max(1, parseInt(document.getElementById('groupDmRepeatCount').value) || 1);
    const delaySeconds = parseFloat(document.getElementById('groupDmDelaySeconds').value) || 0.5;
    const delayMs = Math.max(delaySeconds * 1000, 10);
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!friendIdsText) {
        showToast('フレンドIDを入力してください', 'error');
        return;
    }
    
    const friendIds = friendIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim())
        .filter(id => /^\d{17,19}$/.test(id));
    
    if (friendIds.length < 2) {
        showToast('フレンドIDを2人以上指定してください', 'error');
        return;
    }
    
    if (sendMessage && !message) {
        showToast('お知らせメッセージを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('createGroupDmBtn');
    const stopBtn = document.getElementById('stopGroupDmBtn');
    const progressDiv = document.getElementById('groupDmProgress');
    const progressText = document.getElementById('groupDmProgressText');
    const progressBar = document.getElementById('groupDmProgressBar');
    const resultDiv = document.getElementById('groupDmResult');
    const resultText = document.getElementById('groupDmResultText');
    
    isGroupDmRunning = true;
    shouldStopGroupDm = false;
    btn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    progressText.textContent = '';
    progressBar.style.width = '0%';
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    
    let successCount = 0;
    let failCount = 0;
    const createdGroups = [];
    
    try {
        for (let i = 0; i < repeatCount; i++) {
            if (shouldStopGroupDm) {
                break;
            }
            
            const currentProgress = ((i + 1) / repeatCount) * 100;
            progressText.textContent = `${i + 1} / ${repeatCount}`;
            progressBar.style.width = `${currentProgress}%`;
            
            try {
                const response = await fetch('/api/create-group-dm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: tokens[0],
                        recipientIds: friendIds,
                        groupName: groupName || null,
                        groupIcon: groupIcon || null,
                        sendMessage: sendMessage,
                        message: message || null,
                        autoLeave: autoLeave
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    successCount++;
                    createdGroups.push(data.channelId);
                } else {
                    failCount++;
                    console.log(`Group DM creation ${i + 1} failed:`, data.error);
                }
            } catch (error) {
                failCount++;
                console.error(`Group DM creation ${i + 1} error:`, error.message);
            }
            
            if (i < repeatCount - 1 && !shouldStopGroupDm) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        resultDiv.classList.remove('hidden');
        
        if (shouldStopGroupDm) {
            resultText.innerHTML = `
                <p class="text-yellow-400 mb-2"><i class="fas fa-stop-circle mr-2"></i>停止しました</p>
                <p class="text-gray-300">成功: <span class="text-green-400">${successCount}</span> / 失敗: <span class="text-red-400">${failCount}</span></p>
                ${createdGroups.length > 0 ? `<p class="text-gray-400 text-xs mt-2">作成されたグループID: ${createdGroups.slice(0, 5).join(', ')}${createdGroups.length > 5 ? '...' : ''}</p>` : ''}
            `;
            showToast('処理を停止しました');
        } else {
            resultText.innerHTML = `
                <p class="text-green-400 mb-2"><i class="fas fa-check-circle mr-2"></i>完了！</p>
                <p class="text-gray-300">作成回数: ${repeatCount}回</p>
                <p class="text-gray-300">成功: <span class="text-green-400">${successCount}</span> / 失敗: <span class="text-red-400">${failCount}</span></p>
                ${createdGroups.length > 0 ? `<p class="text-gray-400 text-xs mt-2">作成されたグループID: ${createdGroups.slice(0, 5).join(', ')}${createdGroups.length > 5 ? '...' : ''}</p>` : ''}
                <button onclick="copyToClipboard('${createdGroups.join('\\n')}', 'グループIDをコピーしました！')" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                    <i class="fas fa-copy mr-1"></i>全グループIDをコピー
                </button>
            `;
            showToast(`グループDM作成完了: 成功${successCount} 失敗${failCount}`);
        }
    } catch (error) {
        console.error('Error in batch group DM creation:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `
            <p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>
        `;
        showToast('グループDM作成失敗', 'error');
    } finally {
        isGroupDmRunning = false;
        shouldStopGroupDm = false;
        btn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        progressDiv.classList.add('hidden');
    }
}

async function leaveGuild() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!guildId || !/^\d{17,19}$/.test(guildId)) {
        showToast('有効なサーバーIDを入力してください', 'error');
        return;
    }
    
    if (!confirm(`サーバーID: ${guildId} から退出しますか？\nこの操作は元に戻せません。`)) {
        return;
    }
    
    const btn = document.getElementById('leaveGuildBtn');
    const resultDiv = document.getElementById('leaveGuildResult');
    const resultText = document.getElementById('leaveGuildResultText');
    const originalBtnText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>退出中...';
    
    try {
        const tokens = token.split(/[\n]+/).map(t => t.trim()).filter(t => t.length > 20);
        let successCount = 0;
        let failCount = 0;
        
        for (const t of tokens) {
            try {
                const response = await fetch('/api/leave-guild', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: t, guildId })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    successCount++;
                } else {
                    failCount++;
                    const errorMsg = result.error || `HTTP ${response.status}`;
                    console.log(`Leave failed for token: ${errorMsg}`);
                }
            } catch (e) {
                failCount++;
                console.error(`Leave error: ${e.message}`);
            }
        }
        
        resultDiv.classList.remove('hidden');
        if (successCount > 0) {
            resultText.innerHTML = `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>退出成功: ${successCount}/${tokens.length}</span>`;
            showToast(`サーバーから退出しました (${successCount}/${tokens.length})`);
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>退出失敗: ${failCount}/${tokens.length}</span>`;
            showToast('サーバー退出に失敗しました', 'error');
        }
        
    } catch (error) {
        console.error('Error leaving guild:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>エラー: ${error.message}</span>`;
        showToast('サーバー退出に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}

async function updateDisplayName() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    const guildId = document.getElementById('guildId').value.trim();
    const nickname = document.getElementById('newDisplayName').value;
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!guildId || !/^\d{17,19}$/.test(guildId)) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('updateDisplayNameBtn');
    const resultDiv = document.getElementById('displayNameResult');
    const resultText = document.getElementById('displayNameResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await fetch('/api/update-nickname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, nickname })
        });
        
        const result = await response.json();
        
        resultDiv.classList.remove('hidden');
        if (response.ok && result.success) {
            const newNick = result.nickname || '(ニックネームなし)';
            resultText.innerHTML = `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>ニックネームを「${escapeHtml(newNick)}」に変更しました</span>`;
            showToast('ニックネームを変更しました');
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>${result.error || '変更に失敗しました'}</span>`;
            showToast('ニックネームの変更に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error updating nickname:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>エラー: ${error.message}</span>`;
        showToast('ニックネームの変更に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i>';
    }
}

async function leaveAllGroupDms() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!confirm('本当に全てのグループDMから退出しますか？\nこの操作は元に戻せません。')) {
        return;
    }
    
    const btn = document.getElementById('leaveAllGroupDmsBtn');
    const resultDiv = document.getElementById('leaveAllGroupDmsResult');
    const resultText = document.getElementById('leaveAllGroupDmsResultText');
    const originalBtnText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>退出中...';
    
    try {
        const response = await fetch('/api/leave-all-group-dms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const result = await response.json();
        
        resultDiv.classList.remove('hidden');
        if (response.ok && result.success) {
            if (result.leftCount === 0 && result.totalGroups === 0) {
                resultText.innerHTML = `<span class="text-yellow-400"><i class="fas fa-info-circle mr-1"></i>参加しているグループDMはありませんでした</span>`;
                showToast('グループDMはありませんでした');
            } else {
                resultText.innerHTML = `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>${result.leftCount}/${result.totalGroups} のグループDMから退出しました</span>`;
                showToast(`${result.leftCount}個のグループDMから退出しました`);
            }
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>${result.error || '退出に失敗しました'}</span>`;
            showToast('グループDMからの退出に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error leaving all group DMs:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>エラー: ${error.message}</span>`;
        showToast('グループDMからの退出に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}

let autoFetchDebounceTimer = null;

function tryAutoFetchMembers() {
    const guildId = document.getElementById('guildId')?.value.trim();
    const token = document.getElementById('userToken')?.value.trim();
    
    if (guildId && token && /^\d{17,19}$/.test(guildId) && token.length > 20) {
        if (autoFetchDebounceTimer) {
            clearTimeout(autoFetchDebounceTimer);
        }
        autoFetchDebounceTimer = setTimeout(() => {
            console.log('Auto-fetching members...');
            fetchMembersFromAankoTab();
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const guildIdInput = document.getElementById('guildId');
    const tokenInput = document.getElementById('userToken');
    
    if (guildIdInput) {
        previousGuildId = guildIdInput.value.trim();
    }
    
    if (guildIdInput) {
        guildIdInput.addEventListener('input', function() {
            const currentGuildId = this.value.trim();
            
            if (/^\d{17,19}$/.test(currentGuildId) && currentGuildId !== previousGuildId) {
                console.log('Server ID changed, clearing related fields');
                clearServerRelatedFields();
                previousGuildId = currentGuildId;
                tryAutoFetchMembers();
            }
        });
        
        guildIdInput.addEventListener('blur', function() {
            const currentGuildId = this.value.trim();
            if (/^\d{17,19}$/.test(currentGuildId) && currentGuildId !== previousGuildId) {
                console.log('Server ID changed (blur), clearing related fields');
                clearServerRelatedFields();
                previousGuildId = currentGuildId;
            }
            tryAutoFetchMembers();
        });
    }
    
    if (tokenInput) {
        tokenInput.addEventListener('blur', function() {
            tryAutoFetchMembers();
        });
    }
    
    const sendMessageCheckbox = document.getElementById('groupDmSendMessage');
    if (sendMessageCheckbox) {
        sendMessageCheckbox.addEventListener('change', toggleGroupDmMessageContainer);
    }
});

let currentReplayOperationId = null;
let replayProgressInterval = null;

async function recordMessages() {
    const tokens = document.getElementById('userToken').value.trim().split('\n').filter(t => t.trim());
    const channelIdsText = document.getElementById('recordChannelIds').value.trim();
    const messageCount = parseInt(document.getElementById('recordMessageCount').value) || 50;
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    const channelIds = channelIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim())
        .filter(id => /^\d{17,19}$/.test(id));
    
    if (channelIds.length === 0) {
        showToast('有効なチャンネルIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('recordMessagesBtn');
    const resultDiv = document.getElementById('recordResult');
    const resultText = document.getElementById('recordResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>記録中...';
    resultDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/record-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: tokens[0],
                channelIds: channelIds,
                messageCount: Math.min(Math.max(messageCount, 1), 100)
            })
        });
        
        const data = await response.json();
        
        resultDiv.classList.remove('hidden');
        
        if (data.success) {
            document.getElementById('replayStorageKey').value = data.storageKey;
            
            let html = `<p class="text-green-400 mb-2"><i class="fas fa-check-circle mr-2"></i>メッセージを記録しました！</p>`;
            html += `<p class="text-gray-300">記録キー: <span class="text-amber-400 font-mono">${data.storageKey}</span></p>`;
            html += `<p class="text-gray-300">総メッセージ数: ${data.totalMessages}</p>`;
            
            if (data.preview && data.preview.length > 0) {
                html += `<p class="text-gray-400 mt-2">プレビュー（最初の3件）:</p>`;
                html += `<ul class="text-xs text-gray-500 mt-1 space-y-1">`;
                data.preview.forEach(msg => {
                    const truncatedContent = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
                    html += `<li class="bg-black/30 p-2 rounded">${escapeHtml(msg.author)}: ${escapeHtml(truncatedContent)}</li>`;
                });
                html += `</ul>`;
            }
            
            resultText.innerHTML = html;
            showToast(`${data.totalMessages}件のメッセージを記録しました！`);
        } else {
            resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${data.error}</p>`;
            showToast('記録に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error recording messages:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>`;
        showToast('記録に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download mr-2"></i>メッセージを記録';
    }
}

async function replayMessages() {
    const tokens = document.getElementById('userToken').value.trim().split('\n').filter(t => t.trim());
    const storageKey = document.getElementById('replayStorageKey').value.trim();
    const targetChannelIdsText = document.getElementById('replayTargetChannelIds').value.trim();
    const delayMs = parseInt(document.getElementById('replayDelayMs').value) || 1000;
    const appendMessage = document.getElementById('replayAppendMessage').value;
    const userIdsText = document.getElementById('replayUserIds').value.trim();
    const mentionCount = parseInt(document.getElementById('replayMentionCount').value) || 0;
    const includeEveryone = document.getElementById('replayIncludeEveryone').checked;
    const includeRandomChars = document.getElementById('replayIncludeRandomChars').checked;
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!storageKey) {
        showToast('記録キーがありません。まずメッセージを記録してください', 'error');
        return;
    }
    
    const targetChannelIds = targetChannelIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim())
        .filter(id => /^\d{17,19}$/.test(id));
    
    if (targetChannelIds.length === 0) {
        showToast('有効な送信先チャンネルIDを入力してください', 'error');
        return;
    }
    
    const userIds = userIdsText
        .split(/[\s,\n]+/)
        .map(id => id.trim().replace(/^<@!?(\d+)>$/, '$1').replace(/[<@!>]/g, ''))
        .filter(id => /^\d{15,20}$/.test(id));
    
    const btn = document.getElementById('replayMessagesBtn');
    const cancelBtn = document.getElementById('cancelReplayBtn');
    const progressDiv = document.getElementById('replayProgress');
    const progressText = document.getElementById('replayProgressText');
    const progressBar = document.getElementById('replayProgressBar');
    const resultDiv = document.getElementById('replayResult');
    const resultText = document.getElementById('replayResultText');
    
    btn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    progressText.textContent = '開始中...';
    progressBar.style.width = '0%';
    
    try {
        const response = await fetch('/api/replay-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens: tokens,
                storageKey: storageKey,
                targetChannelIds: targetChannelIds,
                delayMs: delayMs,
                appendMessage: appendMessage,
                userIds: userIds,
                mentionCount: mentionCount,
                includeEveryone: includeEveryone,
                includeRandomChars: includeRandomChars
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.operationId) {
            currentReplayOperationId = data.operationId;
            progressText.textContent = `0 / ${data.totalMessages}`;
            
            replayProgressInterval = setInterval(async () => {
                try {
                    const progressResponse = await fetch(`/api/replay-progress/${currentReplayOperationId}`);
                    const progressData = await progressResponse.json();
                    
                    if (progressData.success) {
                        const { sent, total, status, errors } = progressData;
                        const percentage = total > 0 ? (sent / total) * 100 : 0;
                        
                        progressText.textContent = `${sent} / ${total}`;
                        progressBar.style.width = `${percentage}%`;
                        
                        if (status === 'completed' || status === 'cancelled') {
                            clearInterval(replayProgressInterval);
                            replayProgressInterval = null;
                            currentReplayOperationId = null;
                            
                            progressDiv.classList.add('hidden');
                            resultDiv.classList.remove('hidden');
                            btn.classList.remove('hidden');
                            cancelBtn.classList.add('hidden');
                            
                            if (status === 'completed') {
                                let html = `<p class="text-green-400 mb-2"><i class="fas fa-check-circle mr-2"></i>再送信が完了しました！</p>`;
                                html += `<p class="text-gray-300">送信: ${sent} / ${total}</p>`;
                                if (errors && errors.length > 0) {
                                    html += `<p class="text-yellow-400 mt-2">エラー: ${errors.length}件</p>`;
                                }
                                resultText.innerHTML = html;
                                showToast(`${sent}件のメッセージを送信しました！`);
                            } else {
                                resultText.innerHTML = `<p class="text-yellow-400"><i class="fas fa-stop-circle mr-2"></i>キャンセルされました (${sent} / ${total})</p>`;
                                showToast('再送信をキャンセルしました');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking progress:', error);
                }
            }, 1000);
            
        } else {
            throw new Error(data.error || '再送信の開始に失敗しました');
        }
    } catch (error) {
        console.error('Error replaying messages:', error);
        progressDiv.classList.add('hidden');
        resultDiv.classList.remove('hidden');
        btn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>`;
        showToast('再送信に失敗しました', 'error');
    }
}

async function cancelReplayMessages() {
    if (!currentReplayOperationId) {
        showToast('キャンセルする操作がありません', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/cancel-replay-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operationId: currentReplayOperationId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('キャンセルリクエストを送信しました');
        } else {
            showToast('キャンセルに失敗しました: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error cancelling replay:', error);
        showToast('キャンセルに失敗しました', 'error');
    }
}

async function fetchChannelsForRecord() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!guildId) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchChannelsForRecordBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, skipFilter: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const channelIds = data.channels.map(c => c.id).join(', ');
            document.getElementById('recordChannelIds').value = channelIds;
            showToast(`${data.channels.length} 個のテキストチャンネルを取得しました`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('チャンネル取得に失敗しました: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hashtag mr-1"></i>サーバーの全チャンネルを取得';
    }
}

async function fetchChannelsForReplay() {
    const token = document.getElementById('userToken').value.trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!guildId) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchChannelsForReplayBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, skipFilter: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const channelIds = data.channels.map(c => c.id).join(', ');
            document.getElementById('replayTargetChannelIds').value = channelIds;
            showToast(`${data.channels.length} 個のテキストチャンネルを取得しました`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('チャンネル取得に失敗しました: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hashtag mr-1"></i>サーバーの全チャンネルを取得';
    }
}

function insertUserIdsForReplay() {
    if (currentMembers.length === 0) {
        showToast('先にメンバーを取得してください（上部の「メンバーを取得」ボタン）', 'error');
        return;
    }
    
    const memberIds = currentMembers.map(m => m.id);
    const idsText = memberIds.join(', ');
    
    document.getElementById('replayUserIds').value = idsText;
    
    const countSpan = document.getElementById('replayStoredMemberCount');
    if (countSpan) {
        countSpan.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${memberIds.length} 人挿入済み`;
    }
    
    showToast(`${memberIds.length} 人のユーザーIDを挿入しました！`);
}

let reactionOperationId = null;
let reactionStopped = false;
let lastReactionChannelIds = null;

async function fetchChannelsForReaction() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0];
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!guildId) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchChannelsForReactionBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        const response = await fetch('/api/get-text-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, skipFilter: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const channelIds = data.channels.map(c => c.id).join(', ');
            document.getElementById('reactionChannelIds').value = channelIds;
            showToast(`${data.channels.length} 個のテキストチャンネルを取得しました`);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error fetching channels:', error);
        showToast('チャンネル取得に失敗しました: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hashtag mr-1"></i>サーバーの全チャンネルを取得';
    }
}

async function executeReaction() {
    const tokens = document.getElementById('userToken').value.trim().split('\n').filter(t => t.trim());
    const channelIdsRaw = document.getElementById('reactionChannelIds').value.trim();
    const messageCount = parseInt(document.getElementById('reactionMessageCount').value) || 10;
    const delaySeconds = parseFloat(document.getElementById('reactionDelay').value) || 0.3;
    const skipAlreadyReacted = document.getElementById('reactionSkipAlreadyReacted')?.checked !== false;
    
    if (tokens.length === 0) {
        showToast('トークンを入力してください', 'error');
        return;
    }
    
    if (!channelIdsRaw) {
        showToast('チャンネルIDを入力してください', 'error');
        return;
    }
    
    const channelIds = channelIdsRaw.split(/[\s,]+/).filter(id => id.trim() && /^\d{17,19}$/.test(id.trim()));
    
    if (channelIds.length === 0) {
        showToast('有効なチャンネルIDがありません', 'error');
        return;
    }
    
    const executeBtn = document.getElementById('reactionExecuteBtn');
    const stopBtn = document.getElementById('reactionStopBtn');
    const progressDiv = document.getElementById('reactionProgress');
    const progressText = document.getElementById('reactionProgressText');
    const resultDiv = document.getElementById('reactionResult');
    const resultText = document.getElementById('reactionResultText');
    
    try {
        await fetch('/api/cancel-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.log('Pre-cancel error (ignored):', e);
    }
    
    reactionOperationId = null;
    reactionStopped = false;
    lastReactionChannelIds = channelIdsRaw;
    
    executeBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    progressDiv.classList.remove('hidden');
    progressText.textContent = '0 / 0 リアクション完了';
    resultDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/api/add-reactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens,
                channelIds,
                messageCount,
                delayMs: Math.floor(delaySeconds * 1000),
                skipAlreadyReacted
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '開始に失敗しました');
        }
        
        reactionOperationId = data.operationId;
        
        const currentOperationId = reactionOperationId;
        
        const pollProgress = async () => {
            if (reactionStopped || reactionOperationId !== currentOperationId) return;
            
            try {
                const progressRes = await fetch(`/api/reaction-progress/${currentOperationId}`);
                const progressData = await progressRes.json();
                
                if (progressData.success) {
                    progressText.textContent = `${progressData.current} / ${progressData.total} リアクション完了`;
                    
                    if (progressData.status === 'completed' || progressData.status === 'cancelled') {
                        executeBtn.classList.remove('hidden');
                        stopBtn.classList.add('hidden');
                        progressDiv.classList.add('hidden');
                        resultDiv.classList.remove('hidden');
                        
                        const statusText = progressData.status === 'cancelled' ? 'キャンセル' : '完了';
                        resultText.innerHTML = `
                            <p class="text-green-400"><i class="fas fa-check-circle mr-2"></i>${statusText}！</p>
                            <p class="text-gray-300">成功: ${progressData.success || 0}件 / 失敗: ${progressData.failed || 0}件</p>
                        `;
                        reactionOperationId = null;
                        return;
                    }
                }
                
                setTimeout(pollProgress, 500);
            } catch (err) {
                console.error('Progress poll error:', err);
                if (!reactionStopped && reactionOperationId === currentOperationId) {
                    setTimeout(pollProgress, 1000);
                }
            }
        };
        
        pollProgress();
        
    } catch (error) {
        console.error('Error executing reaction:', error);
        executeBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        progressDiv.classList.add('hidden');
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<p class="text-red-400"><i class="fas fa-times-circle mr-2"></i>エラー: ${error.message}</p>`;
        reactionOperationId = null;
    }
}

async function stopReaction() {
    reactionStopped = true;
    reactionOperationId = null;
    
    try {
        await fetch('/api/cancel-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        showToast('リアクションを停止しました - 次回は最初から開始します');
    } catch (error) {
        console.error('Error stopping reaction:', error);
    }
    
    document.getElementById('reactionExecuteBtn').classList.remove('hidden');
    document.getElementById('reactionStopBtn').classList.add('hidden');
    document.getElementById('reactionProgress').classList.add('hidden');
    document.getElementById('reactionResult').classList.add('hidden');
}

let selectedGuildAvatarBase64 = null;

function handleGuildAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedGuildAvatarBase64 = e.target.result;
        document.getElementById('guildAvatarFileName').textContent = file.name;
    };
    reader.readAsDataURL(file);
}

async function updateGuildAvatar() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!selectedGuildAvatarBase64) {
        showToast('画像を選択してください', 'error');
        return;
    }
    
    const btn = document.getElementById('updateGuildAvatarBtn');
    const resultDiv = document.getElementById('guildAvatarResult');
    const resultText = document.getElementById('guildAvatarResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await fetch('/api/update-guild-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, avatarBase64: selectedGuildAvatarBase64 })
        });
        
        const result = await response.json();
        
        resultDiv.classList.remove('hidden');
        if (response.ok && result.success) {
            resultText.innerHTML = `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>ユーザーアバターを変更しました</span>`;
            showToast('ユーザーアバターを変更しました');
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>${result.error || '変更に失敗しました'}</span>`;
            showToast('アバターの変更に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error updating user avatar:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>エラー: ${error.message}</span>`;
        showToast('アバターの変更に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i>';
    }
}

async function removeGuildAvatar() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('removeGuildAvatarBtn');
    const resultDiv = document.getElementById('guildAvatarResult');
    const resultText = document.getElementById('guildAvatarResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await fetch('/api/update-guild-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, avatarBase64: null })
        });
        
        const result = await response.json();
        
        resultDiv.classList.remove('hidden');
        if (response.ok && result.success) {
            resultText.innerHTML = `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>ユーザーアバターを削除しました</span>`;
            showToast('ユーザーアバターを削除しました');
            selectedGuildAvatarBase64 = null;
            document.getElementById('guildAvatarFileName').textContent = '画像を選択';
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>${result.error || '削除に失敗しました'}</span>`;
            showToast('アバターの削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error removing user avatar:', error);
        resultDiv.classList.remove('hidden');
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>エラー: ${error.message}</span>`;
        showToast('アバターの削除に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i>';
    }
}

let randomNameRunning = false;
let randomNameOperationId = null;
let randomNamePollingActive = false;

function resetRandomNameButtonState() {
    const btn = document.getElementById('randomNameToggleBtn');
    const statusDiv = document.getElementById('randomNameStatus');
    if (!btn || !statusDiv) return;
    
    btn.innerHTML = '<i class="fas fa-play mr-1"></i>開始';
    btn.className = 'flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-semibold py-2 px-6 rounded-xl transition-all';
    btn.disabled = false;
    statusDiv.classList.add('hidden');
}

function setRandomNameButtonRunning() {
    const btn = document.getElementById('randomNameToggleBtn');
    const statusDiv = document.getElementById('randomNameStatus');
    const statusText = document.getElementById('randomNameStatusText');
    if (!btn || !statusDiv || !statusText) return;
    
    btn.innerHTML = '<i class="fas fa-stop mr-1"></i>停止';
    btn.className = 'flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-2 px-6 rounded-xl transition-all';
    statusDiv.classList.remove('hidden');
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>実行中...';
}

async function stopRandomName() {
    randomNameRunning = false;
    randomNamePollingActive = false;
    randomNameOperationId = null;
    
    resetRandomNameButtonState();
    
    try {
        await fetch('/api/random-name/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        showToast('ランダム名前変更を停止しました');
    } catch (error) {
        console.error('Error stopping random name:', error);
    }
}

async function toggleRandomName() {
    if (randomNameRunning) {
        await stopRandomName();
        return;
    }
    
    try {
        await fetch('/api/random-name/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
    }
    
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    const guildId = document.getElementById('guildId').value.trim();
    const customNamesRaw = document.getElementById('randomNameList').value.trim();
    const customNames = customNamesRaw ? customNamesRaw.split('\n').map(n => n.trim()).filter(n => n) : [];
    const suffix = document.getElementById('randomNameSuffix').value.trim();
    const intervalMs = Math.max(parseInt(document.getElementById('randomNameInterval').value) || 1000, 1000);
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!guildId || !/^\d{17,19}$/.test(guildId)) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/random-name/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId, intervalMs, customNames, suffix })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            randomNameRunning = true;
            randomNameOperationId = result.operationId;
            randomNamePollingActive = true;
            
            setRandomNameButtonRunning();
            showToast('ランダム名前変更を開始しました');
            
            const currentOpId = randomNameOperationId;
            const pollStatus = async () => {
                if (!randomNamePollingActive || randomNameOperationId !== currentOpId) return;
                
                const statusText = document.getElementById('randomNameStatusText');
                try {
                    const res = await fetch(`/api/random-name/status/${currentOpId}`);
                    const data = await res.json();
                    
                    if (!randomNamePollingActive || randomNameOperationId !== currentOpId) return;
                    
                    if (data.success && data.status === 'running') {
                        if (statusText) {
                            const intervalSec = (data.currentInterval / 1000).toFixed(1);
                            statusText.innerHTML = `<i class="fas fa-sync fa-spin mr-1"></i>変更: ${data.changeCount}回 | 間隔: ${intervalSec}秒 | ${escapeHtml(data.lastName || '...')}`;
                        }
                        setTimeout(pollStatus, 1000);
                    } else {
                        randomNameRunning = false;
                        randomNamePollingActive = false;
                        randomNameOperationId = null;
                        resetRandomNameButtonState();
                    }
                } catch (e) {
                    if (randomNamePollingActive && randomNameOperationId === currentOpId) {
                        setTimeout(pollStatus, 2000);
                    }
                }
            };
            pollStatus();
        } else {
            showToast(result.error || 'ランダム名前変更の開始に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error starting random name:', error);
        showToast('ランダム名前変更の開始に失敗しました', 'error');
    }
}

let randomAvatarRunning = false;
let randomAvatarOperationId = null;

async function toggleRandomAvatar() {
    const btn = document.getElementById('randomAvatarToggleBtn');
    const statusDiv = document.getElementById('randomAvatarStatus');
    const statusText = document.getElementById('randomAvatarStatusText');
    
    if (randomAvatarRunning) {
        try {
            await fetch('/api/random-avatar/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            showToast('ランダムアイコン変更を停止しました');
        } catch (error) {
            console.error('Error stopping random avatar:', error);
        }
        
        randomAvatarRunning = false;
        randomAvatarOperationId = null;
        btn.innerHTML = '<i class="fas fa-play mr-1"></i>開始';
        btn.classList.remove('from-red-600', 'to-pink-600', 'hover:from-red-700', 'hover:to-pink-700');
        btn.classList.add('from-cyan-600', 'to-blue-600', 'hover:from-cyan-700', 'hover:to-blue-700');
        statusDiv.classList.add('hidden');
        return;
    }
    
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    const intervalMs = parseInt(document.getElementById('randomAvatarInterval').value) || 2000;
    const avatarUrlsRaw = document.getElementById('randomAvatarUrls').value.trim();
    const avatarUrls = avatarUrlsRaw ? avatarUrlsRaw.split('\n').map(u => u.trim()).filter(u => u) : [];
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/random-avatar/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, intervalMs, avatarUrls })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            randomAvatarRunning = true;
            randomAvatarOperationId = result.operationId;
            btn.innerHTML = '<i class="fas fa-stop mr-1"></i>停止';
            btn.classList.remove('from-cyan-600', 'to-blue-600', 'hover:from-cyan-700', 'hover:to-blue-700');
            btn.classList.add('from-red-600', 'to-pink-600', 'hover:from-red-700', 'hover:to-pink-700');
            statusDiv.classList.remove('hidden');
            statusText.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>実行中...';
            showToast('ランダムアイコン変更を開始しました');
            
            const pollStatus = async () => {
                if (!randomAvatarRunning) return;
                try {
                    const res = await fetch(`/api/random-avatar/status/${randomAvatarOperationId}`);
                    const data = await res.json();
                    if (data.success && data.status === 'running') {
                        statusText.innerHTML = `<i class="fas fa-sync fa-spin mr-1"></i>変更回数: ${data.changeCount}`;
                        setTimeout(pollStatus, 1000);
                    } else {
                        randomAvatarRunning = false;
                        btn.innerHTML = '<i class="fas fa-play mr-1"></i>開始';
                        btn.classList.remove('from-red-600', 'to-pink-600', 'hover:from-red-700', 'hover:to-pink-700');
                        btn.classList.add('from-cyan-600', 'to-blue-600', 'hover:from-cyan-700', 'hover:to-blue-700');
                    }
                } catch (e) {
                    setTimeout(pollStatus, 2000);
                }
            };
            pollStatus();
        } else {
            showToast(result.error || 'ランダムアイコン変更の開始に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error starting random avatar:', error);
        showToast('ランダムアイコン変更の開始に失敗しました', 'error');
    }
}

let threadCreationRunning = false;
let threadCreationOperationId = null;
let threadCreationPollingActive = false;

function resetThreadCreateButtonState() {
    const btn = document.getElementById('threadCreateToggleBtn');
    const statusDiv = document.getElementById('threadCreateStatus');
    if (!btn || !statusDiv) return;
    
    btn.innerHTML = '<i class="fas fa-play mr-1"></i>開始';
    btn.className = 'flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-2 px-6 rounded-xl transition-all';
    btn.disabled = false;
    statusDiv.classList.add('hidden');
}

function setThreadCreateButtonRunning() {
    const btn = document.getElementById('threadCreateToggleBtn');
    const statusDiv = document.getElementById('threadCreateStatus');
    const statusText = document.getElementById('threadCreateStatusText');
    if (!btn || !statusDiv || !statusText) return;
    
    btn.innerHTML = '<i class="fas fa-stop mr-1"></i>停止';
    btn.className = 'flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-2 px-6 rounded-xl transition-all';
    statusDiv.classList.remove('hidden');
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>実行中...';
}

async function stopThreadCreation() {
    threadCreationRunning = false;
    threadCreationPollingActive = false;
    threadCreationOperationId = null;
    
    resetThreadCreateButtonState();
    
    try {
        await fetch('/api/thread-create/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        showToast('スレッド作成を停止しました');
    } catch (error) {
        console.error('Error stopping thread creation:', error);
    }
}

let threadChannelsData = [];

async function fetchThreadChannels() {
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    const guildId = document.getElementById('guildId').value.trim();
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!guildId || !/^\d{17,19}$/.test(guildId)) {
        showToast('サーバーIDを入力してください', 'error');
        return;
    }
    
    const btn = document.getElementById('fetchThreadChannelsBtn');
    const listDiv = document.getElementById('threadChannelList');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>取得中...';
    
    try {
        const response = await fetch('/api/get-thread-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, guildId })
        });
        
        const data = await response.json();
        
        if (data.success && data.channels.length > 0) {
            threadChannelsData = data.channels;
            listDiv.classList.remove('hidden');
            listDiv.innerHTML = `
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                    <button onclick="selectAllThreadChannels(true)" class="text-xs text-green-400 hover:text-green-300">全選択</button>
                    <span class="text-xs text-gray-400">${data.channels.length}チャンネル</span>
                    <button onclick="selectAllThreadChannels(false)" class="text-xs text-red-400 hover:text-red-300">全解除</button>
                </div>
                ${data.channels.map(ch => `
                    <label class="flex items-center gap-2 py-1 hover:bg-white/5 rounded cursor-pointer">
                        <input type="checkbox" class="thread-channel-checkbox" value="${ch.id}" data-name="${escapeHtml(ch.name)}" 
                            class="rounded bg-black/30 border-white/30 text-green-500 focus:ring-green-500">
                        <span class="text-sm text-gray-300"><i class="fas fa-hashtag mr-1 text-gray-500"></i>${escapeHtml(ch.name)}</span>
                    </label>
                `).join('')}
            `;
            showToast(`${data.channels.length}個のスレッド作成可能チャンネルを取得しました`);
        } else {
            listDiv.classList.remove('hidden');
            listDiv.innerHTML = '<div class="text-gray-400 text-xs text-center py-2">スレッド作成可能なチャンネルが見つかりませんでした</div>';
            showToast('スレッド作成可能なチャンネルが見つかりませんでした', 'error');
        }
    } catch (error) {
        console.error('Error fetching thread channels:', error);
        showToast('チャンネル取得に失敗しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>チャンネル取得';
    }
}

function selectAllThreadChannels(select) {
    document.querySelectorAll('.thread-channel-checkbox').forEach(cb => cb.checked = select);
}

function insertThreadChannelIds() {
    const checkboxes = document.querySelectorAll('.thread-channel-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('チャンネルを選択してください', 'error');
        return;
    }
    const ids = Array.from(checkboxes).map(cb => cb.value);
    document.getElementById('threadChannelIds').value = ids.join('\n');
    showToast(`${ids.length}個のチャンネルIDを挿入しました`);
}

async function addExternalApp() {
    const tokensText = document.getElementById('userToken').value.trim();
    const oauthUrl = document.getElementById('externalAppUrl').value.trim();
    
    if (!tokensText) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    if (!oauthUrl) {
        showToast('OAuth2 URLを入力してください', 'error');
        return;
    }
    
    const tokens = tokensText.split('\n').map(t => t.trim()).filter(t => t);
    const btn = document.getElementById('addExternalAppBtn');
    const resultDiv = document.getElementById('addExternalAppResult');
    const resultText = document.getElementById('addExternalAppResultText');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>追加中...';
    resultDiv.classList.remove('hidden');
    resultText.innerHTML = '<span class="text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>処理中...</span>';
    
    try {
        const response = await fetch('/api/authorize-external-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens, oauthUrl })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const successCount = data.results.filter(r => r.success).length;
            const failCount = data.results.filter(r => !r.success).length;
            
            let html = `<div class="text-green-400 mb-2"><i class="fas fa-check-circle mr-2"></i>完了: ${successCount}件成功`;
            if (failCount > 0) html += `, <span class="text-red-400">${failCount}件失敗</span>`;
            html += '</div>';
            
            html += '<div class="max-h-40 overflow-y-auto space-y-1">';
            data.results.forEach((r, i) => {
                if (r.success) {
                    html += `<div class="text-green-300 text-xs"><i class="fas fa-check mr-1"></i>トークン${i+1}: 追加成功</div>`;
                } else {
                    html += `<div class="text-red-300 text-xs"><i class="fas fa-times mr-1"></i>トークン${i+1}: ${escapeHtml(r.error)}</div>`;
                }
            });
            html += '</div>';
            
            resultText.innerHTML = html;
            if (successCount > 0) showToast(`${successCount}件のアカウントにアプリを追加しました`);
        } else {
            resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-2"></i>${escapeHtml(data.error)}</span>`;
            showToast(data.error || 'エラーが発生しました', 'error');
        }
    } catch (error) {
        console.error('Error adding external app:', error);
        resultText.innerHTML = `<span class="text-red-400"><i class="fas fa-times-circle mr-2"></i>接続エラーが発生しました</span>`;
        showToast('接続エラーが発生しました', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>マイアプリに追加';
    }
}

async function toggleThreadCreation() {
    if (threadCreationRunning) {
        await stopThreadCreation();
        return;
    }
    
    try {
        await fetch('/api/thread-create/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
    }
    
    const token = document.getElementById('userToken').value.trim().split('\n')[0].trim();
    const channelIdsText = document.getElementById('threadChannelIds').value.trim();
    const threadName = document.getElementById('threadName').value.trim();
    const intervalMs = Math.max(parseInt(document.getElementById('threadInterval').value) || 2000, 1000);
    
    if (!token) {
        showToast('ユーザートークンを入力してください', 'error');
        return;
    }
    
    const channelIds = channelIdsText
        .split(/[\n,]/)
        .map(id => id.trim())
        .filter(id => /^\d{17,19}$/.test(id));
    
    if (channelIds.length === 0) {
        showToast('有効なチャンネルIDを入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/thread-create/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, channelIds, threadName, intervalMs })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            threadCreationRunning = true;
            threadCreationOperationId = result.operationId;
            threadCreationPollingActive = true;
            
            setThreadCreateButtonRunning();
            showToast(`${channelIds.length}チャンネルでスレッド作成を開始しました`);
            
            const currentOpId = threadCreationOperationId;
            const pollStatus = async () => {
                if (!threadCreationPollingActive || threadCreationOperationId !== currentOpId) return;
                
                const statusText = document.getElementById('threadCreateStatusText');
                try {
                    const res = await fetch(`/api/thread-create/status/${currentOpId}`);
                    const data = await res.json();
                    
                    if (!threadCreationPollingActive || threadCreationOperationId !== currentOpId) return;
                    
                    if (data.success && data.status === 'running') {
                        if (statusText) {
                            const totalThreads = data.totalThreads || 0;
                            const channelCount = data.channelCount || 1;
                            statusText.innerHTML = `<i class="fas fa-sync fa-spin mr-1"></i>作成: ${totalThreads}個 (${channelCount}ch並行) | ${escapeHtml(data.lastThread || '...')}`;
                        }
                        setTimeout(pollStatus, 1000);
                    } else {
                        threadCreationRunning = false;
                        threadCreationPollingActive = false;
                        threadCreationOperationId = null;
                        resetThreadCreateButtonState();
                    }
                } catch (e) {
                    if (threadCreationPollingActive && threadCreationOperationId === currentOpId) {
                        setTimeout(pollStatus, 2000);
                    }
                }
            };
            pollStatus();
        } else {
            showToast(result.error || 'スレッド作成の開始に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Error starting thread creation:', error);
        showToast('スレッド作成の開始に失敗しました', 'error');
    }
}

let joinerCaptchaInvites = [];
let joinerStrictMode = false;
let joinerAutoScrollMode = true;
let joinerFirstLog = true;

function joinerLog(message) {
    const element = document.getElementById('joinerLog');
    if (element) {
        element.value += (joinerFirstLog ? '' : '\n') + message;
        if (joinerAutoScrollMode) {
            element.scrollTop = element.scrollHeight;
        }
    }
    joinerFirstLog = false;
}

function joinerElementDisabled(disabled) {
    const btn = document.getElementById('joinerExecuteBtn');
    const strictCheckbox = document.getElementById('joinerStrict');
    
    if (disabled) {
        if (btn) btn.setAttribute('disabled', '');
        if (strictCheckbox) strictCheckbox.setAttribute('disabled', '');
    } else {
        if (btn) btn.removeAttribute('disabled');
        if (strictCheckbox) strictCheckbox.removeAttribute('disabled');
    }
}

function joinerCheckOs() {
    const ua = navigator.userAgent;
    if (ua.match(/Win(dows )?NT 10\.0/)) return { name: 'Windows', version: '10' };
    if (ua.match(/Win(dows )?NT 6\.3/)) return { name: 'Windows', version: '8.1' };
    if (ua.match(/Win(dows )?NT 6\.2/)) return { name: 'Windows', version: '8' };
    if (ua.match(/Win(dows )?(NT [654]|9.)/)) return { name: 'Windows', version: '0' };
    if (ua.match(/Mac OS X ([0-9]+)[_.]([0-9]+)[_.]([0-9]+)/)) return { name: 'macOS', version: RegExp.$1 + '.' + RegExp.$2 + '.' + RegExp.$3 };
    if (ua.match(/Mac|PPC/)) return { name: 'macOS', version: '0' };
    if (ua.match(/iPhone|iPad/)) return { name: 'iOS', version: '0' };
    if (ua.match(/Android ([\.\d]+)/)) return { name: 'Android', version: RegExp.$1 };
    if (ua.match(/Linux/)) return { name: 'Linux', version: '0' };
    if (ua.match(/^.*\s([A-Za-z]+BSD)/)) return { name: RegExp.$1, version: '0' };
    return { name: 'Unknown', version: '0' };
}

function joinerCheckBrowser() {
    const nvUA = navigator.userAgent;
    let cutEd = nvUA.length;
    
    if (nvUA.indexOf('MSIE') !== -1) return { name: 'Internet Explorer', version: '10' };
    if (nvUA.indexOf('Trident') !== -1) return { name: 'Internet Explorer', version: '11' };
    if (nvUA.indexOf('Edge') !== -1 || nvUA.indexOf('Edg') !== -1) {
        const cutSt = nvUA.indexOf('Edge') !== -1 ? nvUA.indexOf('Edge') : nvUA.indexOf('Edg');
        const bwVer = nvUA.substring(cutSt + (nvUA.indexOf('Edge') !== -1 ? 5 : 4), cutEd);
        return { name: 'Edge', version: bwVer };
    }
    if (nvUA.indexOf('Firefox') !== -1) {
        return { name: 'FireFox', version: nvUA.substring(nvUA.indexOf('Firefox') + 8, cutEd) };
    }
    if (nvUA.indexOf('OPR') !== -1) {
        return { name: 'Opera', version: nvUA.substring(nvUA.indexOf('OPR') + 4, cutEd) };
    }
    if (nvUA.indexOf('Safari') !== -1) {
        if (nvUA.indexOf('Chrome') !== -1) {
            const cutSt = nvUA.indexOf('Chrome');
            cutEd = nvUA.indexOf(' ', cutSt);
            return { name: 'Chrome', version: nvUA.substring(cutSt + 7, cutEd) };
        }
        const cutSt = nvUA.indexOf('Version');
        cutEd = nvUA.indexOf(' ', cutSt);
        return { name: 'Safari', version: nvUA.substring(cutSt + 8, cutEd) };
    }
    return { name: 'Unknown', version: '0' };
}

function joinerGenerateRandomString(length, string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    return Array.from(crypto.getRandomValues(new Uint8Array(length))).map((n) => string[n % string.length]).join('');
}

function joinerGenerateLaunchSignature() {
    const BITS = 0b00000000100000000001000000010000000010000001000000001000000000000010000010000001000000000100000000000001000000000000100000000000n;
    const MASK_ALL = (1n << 128n) - 1n;
    let randomInt = 0n;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (let i = 0; i < 16; i++) {
        randomInt = (randomInt << 8n) | BigInt(bytes[i]);
    }
    const resultInt = randomInt & (~BITS & MASK_ALL);
    const hex = resultInt.toString(16).padStart(32, '0');
    return hex.substring(0, 8) + '-' + hex.substring(8, 12) + '-' + hex.substring(12, 16) + '-' + hex.substring(16, 20) + '-' + hex.substring(20, 32);
}

const joinerCreateUUID = () => {
    let d = new BigUint64Array(2);
    crypto.getRandomValues(d);
    let h = (d[0].toString(16).padStart(16, '0') + d[1].toString(16).padStart(16, '0')).slice(0, 32);
    h = h.substring(0, 12) + '4' + h.substring(13);
    const v = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
    h = h.substring(0, 16) + v + h.substring(17);
    return h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
};

function joinerGetSuperPropertiesJson() {
    const os = joinerCheckOs();
    const browser = joinerCheckBrowser();
    return {
        os: os.name,
        browser: browser.name,
        device: '',
        system_locale: navigator.language,
        has_client_mods: false,
        browser_user_agent: navigator.userAgent,
        browser_version: browser.version,
        os_version: os.version,
        referrer: '',
        referring_domain: '',
        referrer_current: '',
        referring_domain_current: '',
        release_channel: 'stable',
        client_build_number: 472914,
        client_event_source: null,
        client_launch_id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : joinerCreateUUID(),
        launch_signature: joinerGenerateLaunchSignature(),
        client_heartbeat_session_id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : joinerCreateUUID(),
        client_app_state: 'focused',
    };
}

function joinerGetSuperProperties() {
    return btoa(JSON.stringify(joinerGetSuperPropertiesJson()));
}

function joinerGetSessionId(discord_token) {
    return new Promise((resolve, reject) => {
        let complete = false;
        const ws = new WebSocket('wss://gateway.discord.gg/?encoding=json&v=9');
        ws.onopen = () => {
            ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: discord_token,
                    capabilities: 1734653,
                    properties: joinerGetSuperPropertiesJson(),
                    presence: { status: 'unknown', since: 0, activities: [], afk: false }
                }
            }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.op === 0 || data.t === 'READY') {
                complete = true;
                ws.close();
                resolve(data.d.session_id);
            }
        };
        ws.onerror = (error) => { console.error('WebSocket Error: ', error); reject(error); };
        ws.onclose = () => { if (!complete) reject(); };
    });
}

let joinerSessionId = null;

async function joinerGetFingerprintAndSetCookie() {
    const response = await fetch('/api/joiner/fingerprint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-joiner-session': joinerSessionId || ''
        },
        body: JSON.stringify({
            superProperties: joinerGetSuperProperties(),
            locale: new Intl.Locale(navigator.language).baseName,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
    });
    if (response.ok) {
        const data = await response.json();
        if (data.sessionId) joinerSessionId = data.sessionId;
        return data.fingerprint;
    }
    return null;
}

function joinerGetMaskedToken(discord_token) {
    return `${discord_token.split('.')[0]}.***`;
}

async function joinerInvite(discord_token, invite_code) {
    joinerLog('x-context-propertiesの値を計算しています...');
    joinerSessionId = null;
    
    const superProps = joinerGetSuperProperties();
    const locale = new Intl.Locale(navigator.language).baseName;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let response = await fetch(`/api/joiner/invite/${invite_code}?superProperties=${encodeURIComponent(superProps)}&locale=${locale}&timezone=${timezone}`);

    let x_context_properties;
    if (response.ok) {
        const json = await response.json();
        x_context_properties = btoa(JSON.stringify({
            location: 'Accept Invite Page',
            location_guild_id: json.guild.id,
            location_channel_id: json.channel.id,
            location_channel_type: 0
        }));
        document.getElementById('joinerServerName').innerText = json.guild.name;
        document.getElementById('joinerServerId').innerText = json.guild.id;
        document.getElementById('joinerServerInfo').classList.remove('hidden');
        joinerLog('✅ x-context-propertiesの値を取得しました！');
    } else {
        if (response.status === 404) {
            joinerLog('❌ 招待リンクが無効です。');
            return { error: 'invite' };
        } else if (response.status === 401) {
            joinerLog('❌ 認証が必要なようです。');
            return { error: 'invite' };
        }
        x_context_properties = btoa(JSON.stringify({
            location: 'Accept Invite Page',
            location_guild_id: '1441394248510607362',
            location_channel_id: '1441394250297249874',
            location_channel_type: 0
        }));
        joinerLog(`❌ x-context-propertiesの値を取得できませんでした。${joinerStrictMode ? '操作をキャンセル' : '別の固定値を使用'}します。`);
        if (joinerStrictMode) return { error: 'x-context-properties' };
    }

    joinerLog('x-fingerprintの値とCookieを取得しています...');
    let x_fingerprint = null;
    try {
        x_fingerprint = await joinerGetFingerprintAndSetCookie();
        joinerLog('✅ x-fingerprintの値とCookieを取得しました！');
    } catch {
        joinerLog(`❌ x-fingerprintの値とCookieを取得できませんでした。${joinerStrictMode ? '操作をキャンセル' : 'これらの値を使用せずに続行'}します。`);
        if (joinerStrictMode) return { error: 'x-fingerprint' };
    }

    await joinerInviteData(discord_token, invite_code, x_context_properties, x_fingerprint);
    return { x_context_properties, x_fingerprint };
}

async function joinerInviteData(discord_token, invite_code, x_context_properties, x_fingerprint) {
    const token_mask = joinerGetMaskedToken(discord_token);
    joinerLog(`${token_mask} session_idの値を取得しています...`);

    let session_id;
    try {
        session_id = await joinerGetSessionId(discord_token);
        joinerLog(`✅ ${token_mask} session_idの値を取得しました！`);
    } catch {
        joinerLog(`❌ ${token_mask} session_idの値を取得できませんでした。${joinerStrictMode ? '操作をキャンセル' : 'ランダム文字列を使用'}します。`);
        if (joinerStrictMode) return { error: 'session_id' };
        session_id = joinerGenerateRandomString(32, 'abcdef0123456789');
    }

    return await joinerInviteMain(discord_token, invite_code, x_context_properties, x_fingerprint, session_id, null, null, null);
}

async function joinerInviteMain(discord_token, invite_code, x_context_properties, x_fingerprint, session_id, hcaptcha_session_id, hcaptcha_rqtoken, hcaptcha_key) {
    const token_mask = joinerGetMaskedToken(discord_token);
    
    const headers = {
        'authorization': discord_token,
        'content-type': 'application/json',
        'x-discord-locale': new Intl.Locale(navigator.language).baseName,
        'x-discord-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        'x-super-properties': joinerGetSuperProperties(),
        'x-joiner-session': joinerSessionId || ''
    };
    
    if (x_context_properties) headers['x-context-properties'] = x_context_properties;
    if (x_fingerprint) headers['x-fingerprint'] = x_fingerprint;
    if (hcaptcha_key) headers['x-captcha-key'] = hcaptcha_key;
    if (hcaptcha_rqtoken) headers['x-captcha-rqtoken'] = hcaptcha_rqtoken;
    if (hcaptcha_session_id) headers['x-captcha-session-id'] = hcaptcha_session_id;

    joinerLog(`${token_mask} サーバーへの参加リクエストを送信しています...`);

    const response = await fetch('/api/joiner/join/' + invite_code, {
        headers: headers,
        body: JSON.stringify({ session_id: session_id }),
        method: 'POST',
    });

    if (response.status === 400) {
        const json = await response.json();
        console.log('400 response:', json);
        
        if (json.captcha_sitekey && (!hcaptcha_session_id || !hcaptcha_rqtoken || !hcaptcha_key)) {
            joinerLog(`⚠️ ${token_mask} Captchaが要求されました。操作が全て完了次第、hCaptchaウィジェットを配置します。`);
            joinerCaptchaInvites.push({
                discord_token, invite_code, x_context_properties, x_fingerprint, session_id,
                captcha_sitekey: json.captcha_sitekey,
                captcha_session_id: json.captcha_session_id,
                captcha_rqdata: json.captcha_rqdata,
                captcha_rqtoken: json.captcha_rqtoken,
            });
            return;
        } else {
            joinerLog(`❌ ${token_mask} リクエストエラー (400)`);
            joinerLog(`    詳細: ${json.message || JSON.stringify(json)}`);
            return;
        }
    }

    if (response.ok) {
        joinerLog(`✅ ${token_mask} サーバーへ参加しました！`);
    } else if (response.status === 401) {
        joinerLog(`❌ ${token_mask} トークンが無効なため、サーバーへ参加できませんでした...`);
    } else if (response.status === 403) {
        const json = await response.json();
        if (json.code === 10008) {
            joinerLog(`❌ ${token_mask} サーバーへ参加できませんでした...\n    このエラーはhCaptchaの解決にテキストを使用した認証ではなく、画像を使用した認証を使用すると軽減される可能性があります。`);
        }
        joinerLog(`❌ ${token_mask} サーバーへ参加できませんでした...\n    エラーコード: ${json.code}\n    理由: ${json.message}`);
    } else {
        joinerLog(`❌ ${token_mask} サーバーへ参加できませんでした...\n    HTTPステータスコード: ${response.status}`);
    }
}

let joinerCaptchaLoaded = false;

function joinerOnCaptchaLoad() {
    joinerCaptchaLoaded = true;
}
window.joinerOnCaptchaLoad = joinerOnCaptchaLoad;

function joinerRemoveCaptcha() {
    document.querySelectorAll('#joinerCaptchaBox iframe[data-hcaptcha-widget-id]').forEach(widget => {
        if (window.hcaptcha) {
            hcaptcha.remove(widget.getAttribute('data-hcaptcha-widget-id'));
        }
    });
    document.getElementById('joinerCaptchaBox').innerHTML = '';
}

async function joinerOnCaptchaSuccess(key) {
    console.log('Captcha Solved: ' + key);
    joinerLog('✅ Captchaが解決されました！');
    const invite_data = joinerCaptchaInvites[0];
    await joinerInviteMain(
        invite_data.discord_token,
        invite_data.invite_code,
        invite_data.x_context_properties,
        invite_data.x_fingerprint,
        invite_data.session_id,
        invite_data.captcha_session_id,
        invite_data.captcha_rqtoken,
        key
    );
    joinerCaptchaInvites.shift();
    joinerStartCaptcha();
}
window.joinerOnCaptchaSuccess = joinerOnCaptchaSuccess;

function joinerInitCaptcha(sitekey, rqdata) {
    if (!joinerCaptchaLoaded || !window.hcaptcha) {
        joinerLog('❌ hCaptchaウィジェットはまだ読み込まれていません。');
        setTimeout(() => joinerInitCaptcha(sitekey, rqdata), 1000);
        return;
    }
    
    const captchaBox = document.getElementById('joinerCaptchaBox');
    captchaBox.innerHTML = '<div id="joinerHcaptchaWidget"></div>';
    
    const widgetId = window.hcaptcha.render('joinerHcaptchaWidget', {
        sitekey: sitekey,
        callback: 'joinerOnCaptchaSuccess',
        theme: 'dark'
    });
    
    if (rqdata) {
        window.hcaptcha.setData(widgetId, { rqdata: rqdata });
    }
    
    joinerLog('hCaptchaウィジェットを配置しました。Captchaを解決してください。');
}

function joinerStartCaptcha() {
    joinerRemoveCaptcha();
    if (joinerCaptchaInvites.length) {
        document.getElementById('joinerCaptchaSection').classList.remove('hidden');
        joinerInitCaptcha(joinerCaptchaInvites[0].captcha_sitekey, joinerCaptchaInvites[0].captcha_rqdata);
    } else {
        document.getElementById('joinerCaptchaSection').classList.add('hidden');
        joinerElementDisabled(false);
        joinerLog('✅ 全ての操作が完了しました！');
    }
}

async function executeJoiner() {
    joinerElementDisabled(true);
    joinerFirstLog = true;
    joinerCaptchaInvites = [];
    document.getElementById('joinerLog').value = '';
    document.getElementById('joinerServerInfo').classList.add('hidden');
    document.getElementById('joinerCaptchaSection').classList.add('hidden');
    
    joinerStrictMode = document.getElementById('joinerStrict').checked;
    joinerAutoScrollMode = document.getElementById('joinerAutoScroll').checked;

    const tokens = document.getElementById('userToken').value.replace(/\r/g, '').split('\n').map(t => t.trim()).filter(t => t);
    const inviteInput = document.getElementById('joinerInvite').value.trim();
    const invite_code = inviteInput.replace(/^(https?:\/\/)?((canary\.|ptb\.)?discord(app)?\.com\.?\/invite\/|discord\.gg\/?.*(?=\/))\//, '').replace(/^discord\.gg\//, '');

    if (!invite_code) {
        joinerLog('❌ 招待リンクが指定されていません。');
        joinerElementDisabled(false);
        return;
    }

    if (tokens.length === 0) {
        joinerLog('❌ トークンが指定されていません。');
        joinerElementDisabled(false);
        return;
    }

    joinerLog('サーバー参加のセットアップを開始します。');

    let error = false;
    let data;
    const tokensCopy = [...tokens];
    
    do {
        if (tokensCopy.length) {
            data = await joinerInvite(tokensCopy.shift(), invite_code);
            error = !!data.error;
        } else {
            error = false;
        }
    } while (error);

    for (const token of tokensCopy) {
        await joinerInviteData(token, invite_code, data.x_context_properties, data.x_fingerprint);
    }

    joinerLog(`要求されたCaptcha数は${joinerCaptchaInvites.length}個です${joinerCaptchaInvites.length ? '。' : '！おめでとう✨️'}`);
    joinerStartCaptcha();
}

document.addEventListener('DOMContentLoaded', () => {
    const autoScrollCheckbox = document.getElementById('joinerAutoScroll');
    if (autoScrollCheckbox) {
        autoScrollCheckbox.addEventListener('change', (e) => {
            joinerAutoScrollMode = e.target.checked;
        });
    }
});
