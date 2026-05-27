const API_CONFIG = {
    apiKey: 'ptlc_fUVguzJJAugo1yh86scbFvQR5tELMlb7xv5n3XBCM2l',
    serverId: '0a090342-d608-4488-8810-11b484fb3317',
    panelUrl: 'https://panel.arqonara.com'
};

const ADMIN_CONFIG = {
    username: 'admin',
    password: 'duskg@nt3ng303#'
};

const SKILLS_LIST = [
    { name: 'Penambangan', id: 'mining' },
    { name: 'Pertanian', id: 'farming' },
    { name: 'Pertarungan', id: 'combat' },
    { name: 'Pemanenan Kayu', id: 'woodcutting' },
    { name: 'Memancing', id: 'fishing' },
    { name: 'Bertahan Hidup', id: 'survival' },
    { name: 'Sihir', id: 'magic' }
];

// ============================================
// SHARED STORAGE ENGINE
// ============================================
const SharedDB = {
    USERS_KEY:     'dv_users',
    SESSIONS_KEY:  'dv_sessions',
    COMMANDS_KEY:  'duskveil_commands',
    PURCHASES_KEY: 'duskveil_purchases',
    VERSION_KEY:   'dv_version',

    _enc(data) {
        try { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); } catch { return JSON.stringify(data); }
    },
    _dec(str) {
        if (!str) return null;
        try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { try { return JSON.parse(str); } catch { return null; } }
    },
    _read(key, fallback) {
        const raw = localStorage.getItem(key);
        const result = this._dec(raw);
        return result !== null ? result : fallback;
    },
    _write(key, data) {
        localStorage.setItem(key, this._enc(data));
        const v = (parseInt(localStorage.getItem(this.VERSION_KEY) || '0') + 1);
        localStorage.setItem(this.VERSION_KEY, String(v));
    },

    getVersion()  { return parseInt(localStorage.getItem(this.VERSION_KEY) || '0'); },

    getUsers()    { return this._read(this.USERS_KEY, { users: [] }).users || []; },
    saveUsers(u)  { this._write(this.USERS_KEY, { users: u }); },

    getSessions() { return this._read(this.SESSIONS_KEY, {}) || {}; },
    saveSessions(s) { this._write(this.SESSIONS_KEY, s); },

    registerSession(username, role) {
        const sessions = this.getSessions();
        sessions[username] = { username, role, loginAt: Date.now(), lastSeen: Date.now() };
        this.saveSessions(sessions);
    },
    heartbeat(username) {
        const sessions = this.getSessions();
        if (sessions[username]) {
            sessions[username].lastSeen = Date.now();
            localStorage.setItem(this.SESSIONS_KEY, this._enc(sessions));
        }
    },
    removeSession(username) {
        const sessions = this.getSessions();
        delete sessions[username];
        this.saveSessions(sessions);
    },
    getOnlineSessions() {
        const sessions = this.getSessions();
        const cutoff = Date.now() - 20000;
        return Object.values(sessions).filter(s => s.lastSeen > cutoff);
    },

    getPurchases()    { return this._read(this.PURCHASES_KEY, []) || []; },
    savePurchases(d)  { this._write(this.PURCHASES_KEY, d); },
    getCommands()     { return this._read(this.COMMANDS_KEY, []) || []; },
    saveCommands(d)   { this._write(this.COMMANDS_KEY, d); }
};

// ============================================
// SYNC ENGINE
// ============================================
const SyncEngine = {
    channel: null,
    lastVersion: -1,
    knownUsers: new Set(),
    knownOnline: new Set(),

    init() {
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel('duskveil_sync');
            this.channel.onmessage = (e) => this._onMessage(e.data);
        }

        window.addEventListener('storage', (e) => {
            if ([SharedDB.VERSION_KEY, SharedDB.SESSIONS_KEY, SharedDB.USERS_KEY].includes(e.key)) {
                this._refresh();
            }
        });

        this.lastVersion = SharedDB.getVersion();
        this.knownUsers = new Set(SharedDB.getUsers().map(u => u.username));
        this.knownOnline = new Set(SharedDB.getOnlineSessions().map(s => s.username));

        setInterval(() => this._poll(), 2000);

        setInterval(() => {
            const user = app._getUser();
            if (user) SharedDB.heartbeat(user.username);
        }, 5000);
    },

    _poll() {
        const currentVer = SharedDB.getVersion();
        if (currentVer === this.lastVersion) {
            this._checkOnlineChanges();
            return;
        }
        this.lastVersion = currentVer;
        this._refresh();
    },

    _checkOnlineChanges() {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        if (user.role !== 'admin') return;

        const currentOnline = new Set(SharedDB.getOnlineSessions().map(s => s.username));
        const added   = [...currentOnline].filter(u => !this.knownOnline.has(u));
        const removed = [...this.knownOnline].filter(u => !currentOnline.has(u));

        if (added.length > 0 || removed.length > 0) {
            this.knownOnline = currentOnline;
            ui.renderOnlinePlayers();
            ui.updateStats();
            added.forEach(u => {
                const sessions = SharedDB.getSessions();
                const isNew = sessions[u] && (Date.now() - sessions[u].loginAt) < 10000;
                if (isNew) ui.toast(`🟢 "${u}" baru saja login!`, 'info');
            });
        }
    },

    _refresh() {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);

        if (user.role === 'admin') {
            const currentUsers = new Set(SharedDB.getUsers().map(u => u.username));
            const newUsers = [...currentUsers].filter(u => !this.knownUsers.has(u));
            newUsers.forEach(u => ui.toast(`🎉 Member baru "${u}" berhasil daftar!`, 'success'));
            this.knownUsers = currentUsers;

            ui.renderAdminTable();
            ui.renderOnlinePlayers();
            ui.updateStats();
            ui.updateAdminBadge();

            if (!document.getElementById('purchase-panel')?.classList.contains('hidden')) ui.renderPurchaseLog();
            if (!document.getElementById('command-panel')?.classList.contains('hidden')) ui.renderCommandTable();
        } else {
            const freshUser = SharedDB.getUsers().find(u => u.username === user.username);
            if (freshUser && freshUser.coin !== user.coin) {
                const updated = { ...user, coin: freshUser.coin };
                sessionStorage.setItem('duskveil_session', JSON.stringify(updated));
                ui.updateHeader();
                ui.toast(`💰 Saldo diperbarui admin: ${freshUser.coin.toLocaleString()} koin`, 'success');
            }
        }
    },

    _onMessage({ type, data }) {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        if (user.role === 'admin') {
            if (type === 'purchase') ui.toast(`💰 Pembelian: ${data.itemName} oleh ${data.username}`, 'info');
        }
        this._refresh();
    },

    broadcast(type, data) {
        if (this.channel) this.channel.postMessage({ type, data, ts: Date.now() });
    }
};

// ============================================
// SECURITY UTILITIES
// ============================================
const Security = {
    sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    validateUsername: (u) => /^[a-zA-Z0-9_]{3,16}$/.test(u),
    validatePassword: (p) => p.length >= 6,
    rateLimiter: {},
    checkRateLimit(action, max = 5, windowMs = 60000) {
        const now = Date.now();
        if (!this.rateLimiter[action]) { this.rateLimiter[action] = { attempts: 1, first: now }; return true; }
        const r = this.rateLimiter[action];
        if (now - r.first > windowMs) { r.attempts = 1; r.first = now; return true; }
        if (r.attempts >= max) return false;
        r.attempts++;
        return true;
    },
    generateToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

// ============================================
// TURNSTILE MANAGER
// ============================================
const TurnstileManager = {
    widgetId: null,
    siteKey: '0x4AAAAAADWhIdBmcN5kZHEQ',
    render(tab) {
        this.remove();
        const id = tab === 'login' ? 'turnstile-login' : 'turnstile-register';
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = '';
        if (window.turnstile) {
            this.widgetId = window.turnstile.render(container, {
                sitekey: this.siteKey,
                callback: (token) => { app.turnstileToken = token; },
                'error-callback': () => { app.turnstileToken = null; ui.toast('❌ Verifikasi gagal, coba lagi.', 'error'); },
                theme: 'dark', size: 'normal'
            });
        } else {
            container.innerHTML = '<div style="color:var(--text3);font-size:0.78rem;text-align:center;padding:12px;">⏳ Memuat verifikasi...</div>';
        }
    },
    remove() {
        if (this.widgetId && window.turnstile) { try { window.turnstile.remove(this.widgetId); } catch(e) {} this.widgetId = null; }
        app.turnstileToken = null;
    },
    reset() {
        if (this.widgetId && window.turnstile) { try { window.turnstile.reset(this.widgetId); } catch(e) {} }
        app.turnstileToken = null;
    }
};

// ============================================
// PTERODACTYL AUTO-EXECUTE
// ============================================
const PterodactylAPI = {
    async sendCommand(command) {
        try {
            const wsRes = await fetch(`${API_CONFIG.panelUrl}/api/client/servers/${API_CONFIG.serverId}/websocket`, {
                headers: { 'Authorization': `Bearer ${API_CONFIG.apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }
            });
            if (!wsRes.ok) return { success: false, error: `HTTP ${wsRes.status}` };
            const { data: { token, socket: wsUrl } } = await wsRes.json();
            return new Promise((resolve) => {
                const ws = new WebSocket(wsUrl);
                let timeout = setTimeout(() => { ws.close(); resolve({ success: false, error: 'Timeout 10s' }); }, 10000);
                ws.onopen = () => ws.send(JSON.stringify({ event: 'auth', args: [token] }));
                ws.onmessage = (e) => {
                    const msg = JSON.parse(e.data);
                    if (msg.event === 'auth success') {
                        ws.send(JSON.stringify({ event: 'send command', args: [command] }));
                        clearTimeout(timeout);
                        setTimeout(() => { ws.close(); resolve({ success: true }); }, 800);
                    }
                    if (msg.event === 'token expired' || msg.event === 'jwt error') { clearTimeout(timeout); ws.close(); resolve({ success: false, error: 'Token expired' }); }
                };
                ws.onerror = () => { clearTimeout(timeout); resolve({ success: false, error: 'WS error' }); };
            });
        } catch(err) { return { success: false, error: err.message }; }
    },
    async sendCommands(commands) {
        const results = [];
        for (const cmd of commands) {
            const r = await this.sendCommand(cmd);
            results.push({ command: cmd, ...r });
            if (!r.success) break;
            await new Promise(r => setTimeout(r, 400));
        }
        return results;
    }
};

// ============================================
// COMMAND QUEUE
// ============================================
const CommandQueue = {
    getAll()   { return SharedDB.getCommands(); },
    save(cmds) { SharedDB.saveCommands(cmds); SyncEngine.broadcast('command_added', { count: cmds.length }); },
    add(command, username, itemName, autoSent = false) {
        const cmds = this.getAll();
        cmds.push({ id: Date.now() + Math.random(), command: Security.sanitize(command), username: Security.sanitize(username), itemName: Security.sanitize(itemName), timestamp: new Date().toISOString(), status: autoSent ? 'executed' : 'pending', autoSent });
        if (cmds.length > 500) cmds.shift();
        this.save(cmds);
    },
    markExecuted(id) { const c = this.getAll(); const x = c.find(x => x.id === id); if (x) x.status = 'executed'; this.save(c); },
    markFailed(id)   { const c = this.getAll(); const x = c.find(x => x.id === id); if (x) x.status = 'failed'; this.save(c); },
    delete(id)       { this.save(this.getAll().filter(c => c.id !== id)); },
    clearAll()       { SharedDB.saveCommands([]); SyncEngine.broadcast('command_added', { count: 0 }); },
    getPending()     { return this.getAll().filter(c => c.status === 'pending'); }
};

// ============================================
// PURCHASE LOG
// ============================================
const PurchaseLog = {
    getAll() { return SharedDB.getPurchases(); },
    add(username, itemName, price, commands, autoExecuted = false) {
        const all = this.getAll();
        const entry = {
            id: Date.now(),
            username: Security.sanitize(username),
            itemName: Security.sanitize(itemName),
            price: parseInt(price) || 0,
            commands: Array.isArray(commands) ? commands.map(c => Security.sanitize(c)) : [Security.sanitize(commands)],
            autoExecuted,
            timestamp: new Date().toISOString()
        };
        all.unshift(entry);
        SharedDB.savePurchases(all.slice(0, 200));
        SyncEngine.broadcast('purchase', entry);
    },
    getRecent(n = 50) { return this.getAll().slice(0, n); }
};

// ============================================
// DATABASE
// ============================================
const DB = {
    init() {
        let users = SharedDB.getUsers();
        if (!users.find(u => u.username === ADMIN_CONFIG.username)) {
            users.push({ username: ADMIN_CONFIG.username, password: ADMIN_CONFIG.password, role: 'admin', coin: 999999, createdAt: new Date().toISOString() });
        }
        if (!users.find(u => u.username === 'player1')) {
            users.push({ username: 'player1', password: 'player1', role: 'member', coin: 50000, createdAt: new Date().toISOString() });
        }
        SharedDB.saveUsers(users);
    },
    getUsers()  { return SharedDB.getUsers(); },
    login(u, p) {
        const user = SharedDB.getUsers().find(x => x.username === u && x.password === p);
        if (user) {
            const token = Security.generateToken();
            SharedDB.registerSession(u, user.role);
            SyncEngine.broadcast('user_login', { username: u, role: user.role, ts: Date.now() });
            return { success: true, user: { ...user, token, loginAt: new Date().toISOString() } };
        }
        return { success: false, message: 'Username atau password salah.' };
    },
    register(u, p) {
        if (!Security.validateUsername(u)) return { success: false, message: 'Username hanya huruf, angka, underscore (3-16 karakter).' };
        if (!Security.validatePassword(p)) return { success: false, message: 'Password minimal 6 karakter.' };
        const users = SharedDB.getUsers();
        if (u === ADMIN_CONFIG.username) return { success: false, message: 'Username terlindungi.' };
        if (users.find(x => x.username === u)) return { success: false, message: 'Username sudah ada.' };
        users.push({ username: u, password: p, role: 'member', coin: 1000, createdAt: new Date().toISOString() });
        SharedDB.saveUsers(users);
        SyncEngine.broadcast('user_register', { username: u, ts: Date.now() });
        return { success: true };
    },
    updateUserCoin(username, newCoin) {
        const users = SharedDB.getUsers();
        const idx = users.findIndex(u => u.username === username);
        if (idx === -1) return false;
        users[idx].coin = Math.max(0, parseInt(newCoin) || 0);
        SharedDB.saveUsers(users);
        SyncEngine.broadcast('coin_updated', { username, coin: users[idx].coin, byAdmin: true });
        const session = sessionStorage.getItem('duskveil_session');
        if (session) { let s = JSON.parse(session); if (s.username === username) { s.coin = users[idx].coin; sessionStorage.setItem('duskveil_session', JSON.stringify(s)); } }
        return true;
    },
    getUser(username) { return SharedDB.getUsers().find(u => u.username === username); }
};

// ============================================
// PROCESS COMMANDS
// ============================================
async function processCommands(commands, username, itemName, price) {
    const cmdArray = Array.isArray(commands) ? commands : [commands];
    ui.toast('⏳ Mengirim command ke server...', 'info');
    const results = await PterodactylAPI.sendCommands(cmdArray);
    const allOk = results.every(r => r.success);
    if (allOk) {
        cmdArray.forEach(cmd => CommandQueue.add(cmd, username, itemName, true));
        PurchaseLog.add(username, itemName, price, cmdArray, true);
        ui.toast('✅ Command berhasil dikirim otomatis!', 'success');
    } else {
        cmdArray.forEach(cmd => CommandQueue.add(cmd, username, itemName, false));
        PurchaseLog.add(username, itemName, price, cmdArray, false);
        ui.toast('⚠️ Auto-execute gagal. Command disimpan di Queue — paste manual.', 'error');
    }
    ui.updateAdminBadge();
    ui.renderCommandTable();
    ui.renderPurchaseLog();
    ui.updateStats();
}

// ============================================
// UI CONTROLLER
// ============================================
const ui = {
    toast(msg, type = 'success') {
        const box = document.getElementById('toast-box');
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.innerHTML = `<span>${Security.sanitize(msg)}</span><span style="cursor:pointer;font-size:1.1rem;opacity:.6" onclick="this.parentElement.remove()">×</span>`;
        box.appendChild(div);
        setTimeout(() => div.remove(), 5000);
    },

    switchTab(tab) {
        const lf = document.getElementById('form-login');
        const rf = document.getElementById('form-register');
        const btns = document.querySelectorAll('.tab-btn');
        if (tab === 'login') { lf.classList.remove('hidden'); rf.classList.add('hidden'); btns[0].classList.add('active'); btns[1].classList.remove('active'); }
        else { lf.classList.add('hidden'); rf.classList.remove('hidden'); btns[0].classList.remove('active'); btns[1].classList.add('active'); }
        TurnstileManager.render(tab);
    },

    renderStore() {
        const products = {
            kontrak: [
                { name: 'Basic Contract', price: 10000, smallName: 'basic' },
                { name: 'Premium Contract', price: 35000, smallName: 'premium' },
                { name: 'Duskveil Contract', price: 55000, smallName: 'duskveil' },
                { name: 'Mythic Contract', price: 75000, smallName: 'mythic' }
            ],
            rank: [
                { name: 'Prime', price: 5000, rankName: 'prime' },
                { name: 'King', price: 15000, rankName: 'king' },
                { name: 'Immortal', price: 25000, rankName: 'immortal' },
                { name: 'Eternal', price: 35000, rankName: 'eternal' },
                { name: 'Abyss', price: 45000, rankName: 'abyss' }
            ],
            skill: [
                { name: 'Upgrade Skill', price: 15000, type: 'single' },
                { name: 'All Skills Max', price: 100000, type: 'all' }
            ]
        };
        const createCard = (cat, item) => {
            let onclick = '';
            if (cat === 'skill') onclick = item.type === 'single' ? `app.showSkillSelection(${item.price})` : `app.buyAllSkills(${item.price})`;
            if (cat === 'kontrak') onclick = `app.buyBook('${item.name}',${item.price},'${item.smallName}')`;
            if (cat === 'rank') onclick = `app.buyRank('${item.name}',${item.price},'${item.rankName}')`;
            const icon = cat === 'kontrak' ? '📜' : cat === 'rank' ? '👑' : '⚔️';
            const type = cat === 'kontrak' ? 'Buku Kontrak' : cat === 'rank' ? 'Rank Server' : 'Skill';
            return `<div class="card"><div class="card-img">${icon}</div><div class="card-content"><div class="card-title">${Security.sanitize(item.name)}</div><div class="card-type">${type}</div><div class="card-price">${item.price.toLocaleString()} 🪙</div><button class="btn-buy" onclick="${onclick}">BELI SEKARANG</button></div></div>`;
        };
        const kg = document.getElementById('grid-kontrak'); if (kg) kg.innerHTML = products.kontrak.map(i => createCard('kontrak', i)).join('');
        const rg = document.getElementById('grid-rank');    if (rg) rg.innerHTML = products.rank.map(i => createCard('rank', i)).join('');
        const sg = document.getElementById('grid-skill');   if (sg) sg.innerHTML = products.skill.map(i => createCard('skill', i)).join('');
    },

    renderAdminTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        const users = DB.getUsers();
        if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Tidak ada member</td></tr>'; return; }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${Security.sanitize(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                <td style="font-size:0.78rem;color:var(--text3);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${Security.sanitize(u.username)}',${u.coin || 0})">Edit</button></td>
            </tr>`).join('');
    },

    renderOnlinePlayers() {
        const container = document.getElementById('online-players-list');
        if (!container) return;
        const online = SharedDB.getOnlineSessions();
        const badge = document.getElementById('online-count');

        if (online.length === 0) {
            container.innerHTML = '<div style="color:var(--text3);font-size:0.85rem;padding:8px 0;">Tidak ada user online saat ini</div>';
            if (badge) badge.textContent = '0';
            return;
        }
        if (badge) badge.textContent = String(online.length);

        container.innerHTML = online.map(s => {
            const ago = Math.round((Date.now() - s.lastSeen) / 1000);
            const agoText = ago < 5 ? 'aktif sekarang' : `${ago}d lalu`;
            const dot = ago < 8 ? '#10b981' : '#f59e0b';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);">
                <span style="width:8px;height:8px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0;"></span>
                <span style="font-weight:600;flex:1;">${Security.sanitize(s.username)}</span>
                <span style="font-size:0.72rem;color:var(--text3);">${s.role}</span>
                <span style="font-size:0.72rem;color:var(--text3);">${agoText}</span>
            </div>`;
        }).join('');
    },

    renderPurchaseLog() {
        const tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        const purchases = PurchaseLog.getRecent(50);
        if (purchases.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Belum ada pembelian</td></tr>'; return; }
        tbody.innerHTML = purchases.map(p => {
            const sc = p.autoExecuted ? 'status-executed' : 'status-pending';
            const st = p.autoExecuted ? '✅ Auto-sent' : '⏳ Manual Queue';
            const cmdsHtml = p.commands.map(c => `<code style="display:block;font-size:0.72rem;background:var(--bg2);padding:2px 6px;border-radius:3px;margin:2px 0;color:var(--primary3);">${Security.sanitize(c)}</code>`).join('');
            return `<tr>
                <td style="font-size:0.78rem;color:var(--text3);">${new Date(p.timestamp).toLocaleString('id-ID')}</td>
                <td style="font-weight:600;">${Security.sanitize(p.username)}</td>
                <td>${Security.sanitize(p.itemName)}<div style="margin-top:4px;">${cmdsHtml}</div></td>
                <td style="color:var(--gold);font-weight:700;">${(p.price || 0).toLocaleString()}</td>
                <td><span class="command-status ${sc}">${st}</span></td>
            </tr>`;
        }).join('');
    },

    renderCommandTable() {
        const tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        const commands = CommandQueue.getAll();
        if (commands.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);">📭 Tidak ada command</td></tr>'; return; }
        tbody.innerHTML = commands.map(cmd => {
            const sc = cmd.status === 'pending' ? 'status-pending' : cmd.status === 'failed' ? 'status-failed' : 'status-executed';
            const st = cmd.status === 'pending' ? '⏳ Pending' : cmd.status === 'failed' ? '❌ Failed' : (cmd.autoSent ? '✅ Auto-sent' : '✅ Executed');
            const safeCmd = Security.sanitize(cmd.command).replace(/"/g, '&quot;');
            const actions = cmd.status === 'pending'
                ? `<button class="btn-execute" onclick="app.copyAndExecute(${cmd.id}, this.getAttribute('data-cmd'))" data-cmd="${safeCmd}">📋 Copy & Execute</button><button class="btn-copy" onclick="app.copyCommandOnly(this.getAttribute('data-cmd'))" data-cmd="${safeCmd}">📄 Copy</button>`
                : `<button class="btn-copy" onclick="app.deleteCommand(${cmd.id})">🗑️ Hapus</button>`;
            return `<tr>
                <td style="font-size:0.78rem;">${new Date(cmd.timestamp).toLocaleString('id-ID')}</td>
                <td><div class="command-text"><code>${Security.sanitize(cmd.command)}</code></div><small style="color:var(--text3);">👤 ${Security.sanitize(cmd.username)} — ${Security.sanitize(cmd.itemName)}</small></td>
                <td><span class="command-status ${sc}">${st}</span></td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    },

    updateStats() {
        const users    = DB.getUsers();
        const total    = users.reduce((s, u) => s + (u.coin || 0), 0);
        const buys     = PurchaseLog.getAll();
        const pending  = CommandQueue.getPending();
        const online   = SharedDB.getOnlineSessions();
        const el = (id) => document.getElementById(id);
        if (el('stat-total-users'))    el('stat-total-users').textContent    = users.length.toLocaleString();
        if (el('stat-total-coins'))    el('stat-total-coins').textContent    = total.toLocaleString();
        if (el('stat-total-purchases'))el('stat-total-purchases').textContent= buys.length.toLocaleString();
        if (el('stat-pending-commands'))el('stat-pending-commands').textContent = pending.length.toLocaleString();
        const playerCountEl = document.getElementById('server-player-count');
        if (playerCountEl) playerCountEl.textContent = `${online.length} / 100`;
    },

    updateAdminBadge() {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        const n = CommandQueue.getPending().length;
        badge.textContent = n;
        badge.style.display = n > 0 ? 'inline-flex' : 'none';
    },

    showCommandPanel() {
        ['store-section','admin-dashboard','purchase-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('command-panel')?.classList.remove('hidden');
        this.renderCommandTable();
    },
    showPurchasePanel() {
        ['store-section','admin-dashboard','command-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('purchase-panel')?.classList.remove('hidden');
        this.renderPurchaseLog();
    },
    showAdminPanel() {
        ['store-section','command-panel','purchase-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('admin-dashboard')?.classList.remove('hidden');
        this.renderAdminTable();
        this.updateStats();
        this.renderOnlinePlayers();
    },
    showStorePanel() {
        document.getElementById('store-section')?.classList.remove('hidden');
        ['admin-dashboard','command-panel','purchase-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    },

    updateHeader() {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        const el = (id) => document.getElementById(id);
        if (el('nav-username')) el('nav-username').innerText = Security.sanitize(user.username);
        if (el('nav-coin'))     el('nav-coin').innerText     = (user.coin || 0).toLocaleString();
        if (el('nav-avatar'))   el('nav-avatar').innerText   = user.username.charAt(0).toUpperCase();
        this.updateAdminBadge();
    },

    showPage(page) {
        const auth = document.getElementById('auth-section');
        const store = document.getElementById('store-section');
        const nav   = document.getElementById('navbar');
        if (page === 'auth') {
            auth?.classList.remove('hidden');
            store?.classList.add('hidden');
            nav?.classList.add('hidden');
            ['admin-dashboard','command-panel','purchase-panel'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
            setTimeout(() => TurnstileManager.render('login'), 100);
        } else {
            auth?.classList.add('hidden');
            nav?.classList.remove('hidden');
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                const user = JSON.parse(session);
                const isAdmin = user.role === 'admin';
                document.getElementById('admin-notice')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-commands-btn')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-purchases-btn')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-admin-btn')?.classList.toggle('hidden', !isAdmin);
                isAdmin ? this.showAdminPanel() : this.showStorePanel();
            }
            this.updateAdminBadge();
        }
    },

    showSkillModal(price, cb) {
        const modal = document.getElementById('skill-modal');
        const container = document.getElementById('skill-list-container');
        if (!container) return;
        container.innerHTML = '';
        SKILLS_LIST.forEach(skill => {
            const div = document.createElement('div');
            div.className = 'skill-option';
            div.innerHTML = `<span class="skill-name">⚔️ ${Security.sanitize(skill.name)}</span><span class="skill-price">${price.toLocaleString()} 🪙</span>`;
            div.onclick = () => { this.closeSkillModal(); cb(skill.name, price); };
            container.appendChild(div);
        });
        modal?.classList.remove('hidden');
    },

    closeSkillModal() { document.getElementById('skill-modal')?.classList.add('hidden'); }
};

// ============================================
// APP LOGIC
// ============================================
const app = {
    turnstileToken: null,

    init() {
        SyncEngine.init();
        DB.init();
        ui.renderStore();

        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                const dbUser = DB.getUser(user.username);
                if (dbUser) {
                    const fresh = { ...dbUser, token: user.token, loginAt: user.loginAt };
                    sessionStorage.setItem('duskveil_session', JSON.stringify(fresh));
                    SharedDB.registerSession(user.username, dbUser.role);
                    ui.updateHeader();
                    ui.showPage('store');
                } else {
                    sessionStorage.removeItem('duskveil_session');
                    ui.showPage('auth');
                }
            } catch { sessionStorage.removeItem('duskveil_session'); ui.showPage('auth'); }
        } else {
            ui.showPage('auth');
        }
        this.initParticles();
    },

    initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top  = Math.random() * 100 + '%';
            p.style.setProperty('--dur',   (4 + Math.random() * 6) + 's');
            p.style.setProperty('--delay', (Math.random() * 5) + 's');
            container.appendChild(p);
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        if (!Security.checkRateLimit('login', 5, 60000)) { ui.toast('⛔ Terlalu banyak percobaan. Coba lagi 1 menit lagi.', 'error'); return; }
        if (!app.turnstileToken) { ui.toast('⚠️ Harap selesaikan verifikasi keamanan!', 'error'); return; }
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        if (!u || !p) { ui.toast('Harap isi username dan password!', 'error'); return; }
        const res = DB.login(u, p);
        if (res.success) {
            sessionStorage.setItem('duskveil_session', JSON.stringify(res.user));
            ui.toast(`Selamat datang, ${Security.sanitize(res.user.username)}!`);
            ui.updateHeader();
            ui.showPage('store');
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
            app.turnstileToken = null;
        } else {
            ui.toast(res.message, 'error');
            TurnstileManager.reset();
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        if (!Security.checkRateLimit('register', 3, 60000)) { ui.toast('⛔ Terlalu banyak percobaan.', 'error'); return; }
        if (!app.turnstileToken) { ui.toast('⚠️ Harap selesaikan verifikasi keamanan!', 'error'); return; }
        const u  = document.getElementById('reg-user').value.trim();
        const p  = document.getElementById('reg-pass').value;
        const pc = document.getElementById('reg-pass-confirm').value;
        if (!u || !p || !pc) { ui.toast('Harap isi semua field!', 'error'); return; }
        if (p !== pc) { ui.toast('Password tidak cocok!', 'error'); return; }
        const res = DB.register(u, p);
        if (res.success) {
            ui.toast('Registrasi berhasil! Silakan login.');
            ui.switchTab('login');
            document.getElementById('login-user').value = u;
            ['reg-user','reg-pass','reg-pass-confirm'].forEach(id => { document.getElementById(id).value = ''; });
            app.turnstileToken = null;
        } else {
            ui.toast(res.message, 'error');
            TurnstileManager.reset();
        }
    },

    logout() {
        const user = this._getUser();
        if (user) SharedDB.removeSession(user.username);
        sessionStorage.removeItem('duskveil_session');
        SyncEngine.broadcast('user_logout', { username: user?.username, ts: Date.now() });
        ui.showPage('auth');
        ui.toast('Anda telah keluar.');
        app.turnstileToken = null;
    },

    _deductCoin(user, price) {
        const newBal = Math.max(0, (user.coin || 0) - price);
        DB.updateUserCoin(user.username, newBal);
        user.coin = newBal;
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        return user;
    },

    _getUser() {
        const s = sessionStorage.getItem('duskveil_session');
        return s ? JSON.parse(s) : null;
    },

    async buyBook(itemName, price, smallTextName) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;
        this._deductCoin(user, price);
        await processCommands(`ksl give ${user.username} ${smallTextName}`, user.username, itemName, price);
    },

    async buyRank(rankName, price, rankId) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;
        this._deductCoin(user, price);
        const commands = [
            `lp user ${user.username} parent set ${rankId.toLowerCase()}`,
            `pex user ${user.username} group set ${rankId.toLowerCase()}`,
            `manuadd ${user.username} ${rankName}`,
            `group addplayer ${user.username} ${rankId.toLowerCase()}`
        ];
        await processCommands(commands, user.username, `Rank: ${rankName}`, price);
    },

    showSkillSelection(price) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => this.upgradeSkill(skillName, actualPrice));
    },

    async upgradeSkill(skillName, price) {
        const user = this._getUser();
        if (!user) return;
        const level = prompt(`Level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) { ui.toast('Level tidak valid!', 'error'); return; }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;
        this._deductCoin(user, price);
        const skillId = SKILLS_LIST.find(s => s.name === skillName)?.id || skillName.toLowerCase();
        await processCommands(`skill setlevel ${user.username} ${skillId} ${level}`, user.username, `Skill: ${skillName} → Lv.${level}`, price);
    },

    async buyAllSkills(price) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) { ui.toast('Level tidak valid!', 'error'); return; }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;
        this._deductCoin(user, price);
        await processCommands(`skill setall ${user.username} ${maxLevel}`, user.username, `All Skills → Lv.${maxLevel}`, price);
    },

    async copyAndExecute(id, command) {
        await navigator.clipboard.writeText(command);
        ui.toast('✅ Command di-copy!');
        if (confirm('Apakah command sudah dijalankan?\nOK = sudah')) {
            CommandQueue.markExecuted(id);
            ui.renderCommandTable();
            ui.updateAdminBadge();
            ui.toast('✅ Ditandai executed!');
        }
    },

    async copyCommandOnly(command) { await navigator.clipboard.writeText(command); ui.toast('✅ Command di-copy!'); },

    deleteCommand(id) {
        if (!confirm('Hapus command ini?')) return;
        CommandQueue.delete(id); ui.renderCommandTable(); ui.updateAdminBadge(); ui.toast('🗑️ Dihapus!');
    },

    async executeAllCommands() {
        const pending = CommandQueue.getPending();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command pending!', 'error'); return; }
        if (!confirm(`Kirim ${pending.length} command ke server?`)) return;
        ui.toast(`⏳ Mengirim ${pending.length} command...`);
        const results = await PterodactylAPI.sendCommands(pending.map(c => c.command));
        const allOk = results.every(r => r.success);
        if (allOk) {
            pending.forEach(c => CommandQueue.markExecuted(c.id));
            ui.toast(`✅ Semua ${pending.length} command berhasil!`);
        } else {
            pending.forEach((c, i) => { if (results[i]?.success) CommandQueue.markExecuted(c.id); else CommandQueue.markFailed(c.id); });
            navigator.clipboard.writeText(pending.map(c => c.command).join('\n'));
            ui.toast('⚠️ Sebagian gagal. Command di-copy — paste manual!', 'error');
        }
        ui.renderCommandTable(); ui.updateAdminBadge(); ui.updateStats();
    },

    async copyAllCommands() {
        const pending = CommandQueue.getPending();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        await navigator.clipboard.writeText(pending.map(c => c.command).join('\n'));
        ui.toast(`✅ ${pending.length} command di-copy!`);
    },

    clearAllCommands() {
        if (CommandQueue.getPending().length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        if (!confirm('Hapus SEMUA command?')) return;
        CommandQueue.clearAll(); ui.renderCommandTable(); ui.updateAdminBadge(); ui.updateStats(); ui.toast('🗑️ Semua command dihapus!');
    },

    exportCommands() {
        const commands = CommandQueue.getAll();
        if (commands.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(commands, null, 2));
        const a = document.createElement('a'); a.href = uri; a.download = `duskveil_commands_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`; a.click();
        ui.toast(`💾 Exported ${commands.length} command!`);
    },

    exportAllData() {
        const data = { users: DB.getUsers(), purchases: PurchaseLog.getAll(), commands: CommandQueue.getAll(), exportedAt: new Date().toISOString() };
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a'); a.href = uri; a.download = `duskveil_backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`; a.click();
        ui.toast('💾 Database exported!');
    },

    clearAllData() {
        if (!confirm('⚠️ Hapus SEMUA data? Tidak bisa dibatalkan!')) return;
        if (!confirm('Konfirmasi terakhir: yakin?')) return;
        [SharedDB.USERS_KEY, SharedDB.SESSIONS_KEY, SharedDB.COMMANDS_KEY, SharedDB.PURCHASES_KEY].forEach(k => localStorage.removeItem(k));
        DB.init(); ui.renderAdminTable(); ui.updateStats(); ui.toast('🗑️ Data direset!');
    },

    fillAdmin(u, c) {
        const si = document.getElementById('admin-search'); if (si) si.value = u;
        const ci = document.getElementById('admin-coin');   if (ci) ci.value = c;
    },

    adminSetCoin() {
        const username   = document.getElementById('admin-search').value.trim();
        const coinAmount = document.getElementById('admin-coin').value;
        if (!username) { ui.toast('Masukkan username!', 'error'); return; }
        if (!coinAmount || isNaN(coinAmount) || parseInt(coinAmount) < 0) { ui.toast('Jumlah koin tidak valid!', 'error'); return; }
        if (DB.updateUserCoin(username, parseInt(coinAmount))) {
            ui.toast(`✅ Koin ${Security.sanitize(username)} → ${parseInt(coinAmount).toLocaleString()}`);
            ui.renderAdminTable(); ui.updateHeader(); ui.updateStats();
            document.getElementById('admin-coin').value = '';
        } else { ui.toast('User tidak ditemukan!', 'error'); }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

window.addEventListener('beforeunload', () => {
    const user = app._getUser();
    if (user) SharedDB.removeSession(user.username);
});
'''

# Verifikasi: cek apakah ada karakter aneh di akhir
print("Last 200 chars:")
print(repr(js_fixed[-200:]))
print()

# Cek apakah ada var(--border1) yang salah
if 'border1' in js_fixed:
    print("ERROR: masih ada 'border1'!")
else:
    print("OK: tidak ada 'border1'")

# Cek apakah ada \\n yang salah (double escaped)
if "join('\\\\n')" in js_fixed:
    print("ERROR: masih ada join('\\\\n')!")
else:
    print("OK: tidak ada join('\\\\n')")

# Cek apakah ada }) ekstra di akhir
if js_fixed.rstrip().endswith('})'):
    print("ERROR: masih ada }) ekstra di akhir!")
else:
    print("OK: tidak ada }) ekstra di akhir")

# Cek bracket balance
open_brackets = js_fixed.count('{')
close_brackets = js_fixed.count('}')
open_parens = js_fixed.count('(')
close_parens = js_fixed.count(')')
print(f"\nBrackets: {open_brackets} open, {close_brackets} close")
print(f"Parens: {open_parens} open, {close_parens} close")

with open('/mnt/agents/output/script.js', 'w', encoding='utf-8') as f:
    f.write(js_fixed)

print(f"\n✅ script.js saved! Size: {len(js_fixed)} chars")
