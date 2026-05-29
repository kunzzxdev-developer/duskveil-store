// ============================================
// FIREBASE CONFIG
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot, getDocs, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCyEbIOIJ4DGEczi0yPWUSaA9BIM5TFgj0",
    authDomain: "duskveilsmp.firebaseapp.com",
    projectId: "duskveilsmp",
    storageBucket: "duskveilsmp.firebasestorage.app",
    messagingSenderId: "797107010544",
    appId: "1:797107010544:web:6b5401cdb0cf045c0dbb35",
    measurementId: "G-ZC06WZXWP9"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ============================================
// CONSTANTS
// ============================================
const API_CONFIG = {
    apiKey: 'ptlc_fUVguzJJAugo1yh86scbFvQR5tELMlb7xv5n3XBCM2l',
    serverId: '0a090342-d608-4488-8810-11b484fb3317',
    panelUrl: 'https://panel.arqonara.com'
};

const ADMIN_CONFIG = { username: 'admin', password: 'duskg@nt3ng303#' };

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
// FIREBASE DB — pengganti localStorage
// ============================================
const FirebaseDB = {
    // USERS
    async getUser(username) {
        const snap = await getDoc(doc(db, 'users', username));
        return snap.exists() ? snap.data() : null;
    },
    async getAllUsers() {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => d.data());
    },
    async saveUser(username, data) {
        await setDoc(doc(db, 'users', username), data, { merge: true });
    },
    async updateCoin(username, coin) {
        await updateDoc(doc(db, 'users', username), { coin });
    },

    // SESSIONS (online tracking)
    async setSession(username, role) {
        await setDoc(doc(db, 'sessions', username), {
            username, role,
            loginAt: Date.now(),
            lastSeen: Date.now()
        });
    },
    async heartbeat(username) {
        try { await updateDoc(doc(db, 'sessions', username), { lastSeen: Date.now() }); } catch(e) {}
    },
    async removeSession(username) {
        try { await deleteDoc(doc(db, 'sessions', username)); } catch(e) {}
    },
    async getOnlineSessions() {
        const cutoff = Date.now() - 20000;
        const snap = await getDocs(collection(db, 'sessions'));
        return snap.docs.map(d => d.data()).filter(s => s.lastSeen > cutoff);
    },

    // PURCHASES
    async addPurchase(data) {
        await addDoc(collection(db, 'purchases'), { ...data, timestamp: serverTimestamp() });
    },
    async getPurchases(n = 50) {
        const q = query(collection(db, 'purchases'), orderBy('timestamp', 'desc'), limit(n));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // COMMANDS
    async addCommand(data) {
        const ref = await addDoc(collection(db, 'commands'), { ...data, timestamp: serverTimestamp() });
        return ref.id;
    },
    async getCommands() {
        const q = query(collection(db, 'commands'), orderBy('timestamp', 'desc'), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async updateCommand(id, data) {
        await updateDoc(doc(db, 'commands', id), data);
    },
    async deleteCommand(id) {
        await deleteDoc(doc(db, 'commands', id));
    },
    async clearCommands() {
        const snap = await getDocs(collection(db, 'commands'));
        const batch = snap.docs.map(d => deleteDoc(doc(db, 'commands', d.id)));
        await Promise.all(batch);
    },
    async getPendingCommands() {
        const q = query(collection(db, 'commands'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
};

// ============================================
// REALTIME LISTENERS
// ============================================
const RealtimeSync = {
    unsubs: [],

    init(role, username) {
        this.stopAll();

        if (role === 'admin') {
            // Listen users
            this.unsubs.push(onSnapshot(collection(db, 'users'), () => {
                ui.renderAdminTable();
                ui.updateStats();
            }));
            // Listen sessions (online players)
            this.unsubs.push(onSnapshot(collection(db, 'sessions'), () => {
                ui.renderOnlinePlayers();
                ui.updateStats();
            }));
            // Listen commands
            this.unsubs.push(onSnapshot(collection(db, 'commands'), () => {
                ui.updateAdminBadge();
                if (!document.getElementById('command-panel')?.classList.contains('hidden')) ui.renderCommandTable();
            }));
            // Listen purchases
            this.unsubs.push(onSnapshot(collection(db, 'purchases'), () => {
                if (!document.getElementById('purchase-panel')?.classList.contains('hidden')) ui.renderPurchaseLog();
                ui.updateStats();
            }));
        } else {
            // Member: listen coin update
            this.unsubs.push(onSnapshot(doc(db, 'users', username), (snap) => {
                if (!snap.exists()) return;
                const fresh = snap.data();
                const session = sessionStorage.getItem('duskveil_session');
                if (!session) return;
                const user = JSON.parse(session);
                if (fresh.coin !== user.coin) {
                    user.coin = fresh.coin;
                    sessionStorage.setItem('duskveil_session', JSON.stringify(user));
                    ui.updateHeader();
                    ui.toast(`💰 Saldo diperbarui: ${fresh.coin.toLocaleString()} koin`, 'success');
                }
            }));
        }

        // Heartbeat
        setInterval(() => {
            const s = sessionStorage.getItem('duskveil_session');
            if (s) FirebaseDB.heartbeat(JSON.parse(s).username);
        }, 5000);
    },

    stopAll() {
        this.unsubs.forEach(u => u());
        this.unsubs = [];
    }
};

// ============================================
// SECURITY
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
        return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');
    }
};

// ============================================
// TURNSTILE
// ============================================
const TurnstileManager = {
    widgetId: null,
    siteKey: '0x4AAAAAADWhIT5hFjEKoRvwiD6Re9f3S74',

    render(tab) {
        this.remove();
        const id = tab === 'login' ? 'turnstile-login' : 'turnstile-register';
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = '';
        if (window.turnstile && typeof window.turnstile.render === 'function') {
            try {
                this.widgetId = window.turnstile.render(container, {
                    sitekey: this.siteKey,
                    callback: (token) => { app.turnstileToken = token; },
                    'error-callback': () => { app.turnstileToken = null; this._showFallback(container); },
                    'expired-callback': () => { app.turnstileToken = null; },
                    theme: 'dark', size: 'normal'
                });
            } catch(e) { this._showFallback(container); }
        } else {
            container.innerHTML = '<div style="color:var(--text3);font-size:0.78rem;text-align:center;padding:12px;">⏳ Memuat verifikasi...</div>';
            setTimeout(() => this.render(tab), 2000);
        }
    },
    _showFallback(container) {
        const a = Math.floor(Math.random()*10)+1, b = Math.floor(Math.random()*10)+1;
        container.innerHTML = `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:12px;border:1px dashed var(--border);border-radius:8px;">
            <p style="margin-bottom:8px;">🔒 Verifikasi Manual</p>
            <p style="font-size:1.2rem;color:var(--text);margin-bottom:8px;">${a} + ${b} = ?</p>
            <input type="number" id="fallback-captcha" placeholder="Jawaban" style="width:100px;text-align:center;padding:6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);">
            <button onclick="TurnstileManager._checkFallback(${a+b})" style="margin-left:8px;padding:6px 12px;background:var(--primary);border:none;border-radius:6px;color:white;cursor:pointer;">OK</button>
        </div>`;
    },
    _checkFallback(ans) {
        const input = document.getElementById('fallback-captcha');
        if (input && parseInt(input.value) === ans) {
            app.turnstileToken = 'fallback_' + Date.now();
            input.closest('[id^="turnstile-"]').innerHTML = '<div style="color:var(--success);text-align:center;padding:12px;">✅ Berhasil!</div>';
        } else { ui.toast('Jawaban salah!', 'error'); }
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
// PTERODACTYL API
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
                let timeout = setTimeout(() => { ws.close(); resolve({ success: false, error: 'Timeout' }); }, 10000);
                ws.onopen = () => ws.send(JSON.stringify({ event: 'auth', args: [token] }));
                ws.onmessage = (e) => {
                    const msg = JSON.parse(e.data);
                    if (msg.event === 'auth success') {
                        ws.send(JSON.stringify({ event: 'send command', args: [command] }));
                        clearTimeout(timeout);
                        setTimeout(() => { ws.close(); resolve({ success: true }); }, 800);
                    }
                    if (['token expired','jwt error'].includes(msg.event)) { clearTimeout(timeout); ws.close(); resolve({ success: false, error: 'Token expired' }); }
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
// PROCESS COMMANDS
// ============================================
async function processCommands(commands, username, itemName, price) {
    const cmdArray = Array.isArray(commands) ? commands : [commands];
    ui.toast('⏳ Mengirim command ke server...', 'info');
    const results = await PterodactylAPI.sendCommands(cmdArray);
    const allOk = results.every(r => r.success);
    for (const cmd of cmdArray) {
        await FirebaseDB.addCommand({
            command: Security.sanitize(cmd),
            username: Security.sanitize(username),
            itemName: Security.sanitize(itemName),
            status: allOk ? 'executed' : 'pending',
            autoSent: allOk
        });
    }
    await FirebaseDB.addPurchase({
        username: Security.sanitize(username),
        itemName: Security.sanitize(itemName),
        price: parseInt(price) || 0,
        commands: cmdArray.map(c => Security.sanitize(c)),
        autoExecuted: allOk
    });
    if (allOk) {
        ui.toast('✅ Command berhasil dikirim otomatis!', 'success');
    } else {
        ui.toast('⚠️ Auto-execute gagal. Command disimpan di Queue.', 'error');
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
        if (!box) return;
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
        const icon = { kontrak: '📜', rank: '👑', skill: '⚔️' };
        const type = { kontrak: 'Buku Kontrak', rank: 'Rank Server', skill: 'Skill' };
        const createCard = (cat, item) => {
            let onclick = '';
            if (cat === 'skill') onclick = item.type === 'single' ? `app.showSkillSelection(${item.price})` : `app.buyAllSkills(${item.price})`;
            if (cat === 'kontrak') onclick = `app.buyBook('${item.name}',${item.price},'${item.smallName}')`;
            if (cat === 'rank') onclick = `app.buyRank('${item.name}',${item.price},'${item.rankName}')`;
            return `<div class="card"><div class="card-img">${icon[cat]}</div><div class="card-content"><div class="card-title">${Security.sanitize(item.name)}</div><div class="card-type">${type[cat]}</div><div class="card-price">${item.price.toLocaleString()} 🪙</div><button class="btn-buy" onclick="${onclick}">BELI SEKARANG</button></div></div>`;
        };
        const kg = document.getElementById('grid-kontrak'); if (kg) kg.innerHTML = products.kontrak.map(i => createCard('kontrak', i)).join('');
        const rg = document.getElementById('grid-rank');    if (rg) rg.innerHTML = products.rank.map(i => createCard('rank', i)).join('');
        const sg = document.getElementById('grid-skill');   if (sg) sg.innerHTML = products.skill.map(i => createCard('skill', i)).join('');
    },

    async renderAdminTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        const users = await FirebaseDB.getAllUsers();
        if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Tidak ada member</td></tr>'; return; }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${Security.sanitize(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                <td style="font-size:0.78rem;color:var(--text3);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${Security.sanitize(u.username)}',${u.coin||0})">Edit</button></td>
            </tr>`).join('');
    },

    async renderOnlinePlayers() {
        const container = document.getElementById('online-players-list');
        if (!container) return;
        const online = await FirebaseDB.getOnlineSessions();
        const badge = document.getElementById('online-count');
        if (online.length === 0) {
            container.innerHTML = '<div style="color:var(--text3);font-size:0.85rem;padding:8px 0;">Tidak ada user online</div>';
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

    async renderPurchaseLog() {
        const tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        const purchases = await FirebaseDB.getPurchases(50);
        if (purchases.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Belum ada pembelian</td></tr>'; return; }
        tbody.innerHTML = purchases.map(p => {
            const sc = p.autoExecuted ? 'status-executed' : 'status-pending';
            const st = p.autoExecuted ? '✅ Auto-sent' : '⏳ Manual Queue';
            const cmds = (p.commands||[]).map(c => `<code style="display:block;font-size:0.72rem;background:var(--bg2);padding:2px 6px;border-radius:3px;margin:2px 0;color:var(--primary3);">${Security.sanitize(c)}</code>`).join('');
            const ts = p.timestamp?.toDate ? p.timestamp.toDate().toLocaleString('id-ID') : '-';
            return `<tr>
                <td style="font-size:0.78rem;color:var(--text3);">${ts}</td>
                <td style="font-weight:600;">${Security.sanitize(p.username)}</td>
                <td>${Security.sanitize(p.itemName)}<div style="margin-top:4px;">${cmds}</div></td>
                <td style="color:var(--gold);font-weight:700;">${(p.price||0).toLocaleString()}</td>
                <td><span class="command-status ${sc}">${st}</span></td>
            </tr>`;
        }).join('');
    },

    async renderCommandTable() {
        const tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        const commands = await FirebaseDB.getCommands();
        if (commands.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);">📭 Tidak ada command</td></tr>'; return; }
        tbody.innerHTML = commands.map(cmd => {
            const sc = cmd.status === 'pending' ? 'status-pending' : cmd.status === 'failed' ? 'status-failed' : 'status-executed';
            const st = cmd.status === 'pending' ? '⏳ Pending' : cmd.status === 'failed' ? '❌ Failed' : (cmd.autoSent ? '✅ Auto-sent' : '✅ Executed');
            const safeCmd = Security.sanitize(cmd.command).replace(/"/g,'&quot;');
            const actions = cmd.status === 'pending'
                ? `<button class="btn-execute" onclick="app.copyAndExecute('${cmd.id}','${safeCmd}')">📋 Copy & Execute</button>`
                : `<button class="btn-copy" onclick="app.deleteCommand('${cmd.id}')">🗑️ Hapus</button>`;
            const ts = cmd.timestamp?.toDate ? cmd.timestamp.toDate().toLocaleString('id-ID') : '-';
            return `<tr>
                <td style="font-size:0.78rem;">${ts}</td>
                <td><div class="command-text"><code>${Security.sanitize(cmd.command)}</code></div><small style="color:var(--text3);">👤 ${Security.sanitize(cmd.username)} — ${Security.sanitize(cmd.itemName)}</small></td>
                <td><span class="command-status ${sc}">${st}</span></td>
                <td>${actions}</td>
            </tr>`;
        }).join('');
    },

    async updateStats() {
        const users    = await FirebaseDB.getAllUsers();
        const total    = users.reduce((s, u) => s + (u.coin || 0), 0);
        const buys     = await FirebaseDB.getPurchases(999);
        const pending  = await FirebaseDB.getPendingCommands();
        const online   = await FirebaseDB.getOnlineSessions();
        const el = (id) => document.getElementById(id);
        if (el('stat-total-users'))     el('stat-total-users').textContent     = users.length.toLocaleString();
        if (el('stat-total-coins'))     el('stat-total-coins').textContent     = total.toLocaleString();
        if (el('stat-total-purchases')) el('stat-total-purchases').textContent = buys.length.toLocaleString();
        if (el('stat-pending-commands'))el('stat-pending-commands').textContent= pending.length.toLocaleString();
        const pc = document.getElementById('server-player-count');
        if (pc) pc.textContent = `${online.length} / 100`;
    },

    async updateAdminBadge() {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        const pending = await FirebaseDB.getPendingCommands();
        const n = pending.length;
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
        const auth  = document.getElementById('auth-section');
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

    async init() {
        try {
            // Pastikan admin ada di Firestore
            const adminExists = await FirebaseDB.getUser(ADMIN_CONFIG.username);
            if (!adminExists) {
                await FirebaseDB.saveUser(ADMIN_CONFIG.username, {
                    username: ADMIN_CONFIG.username,
                    password: ADMIN_CONFIG.password,
                    role: 'admin',
                    coin: 999999,
                    createdAt: new Date().toISOString()
                });
            }

            ui.renderStore();

            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                try {
                    const user = JSON.parse(session);
                    const dbUser = await FirebaseDB.getUser(user.username);
                    if (dbUser) {
                        const fresh = { ...dbUser, token: user.token, loginAt: user.loginAt };
                        sessionStorage.setItem('duskveil_session', JSON.stringify(fresh));
                        await FirebaseDB.setSession(user.username, dbUser.role);
                        RealtimeSync.init(dbUser.role, user.username);
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
        } catch(e) {
            console.error('App init error:', e);
            alert('Error saat memuat aplikasi. Periksa koneksi internet dan coba refresh.');
        }
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
        if (!Security.checkRateLimit('login', 5, 60000)) { ui.toast('⛔ Terlalu banyak percobaan. Tunggu 1 menit.', 'error'); return; }
        if (!app.turnstileToken) { ui.toast('⚠️ Selesaikan verifikasi keamanan!', 'error'); return; }
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        if (!u || !p) { ui.toast('Isi username dan password!', 'error'); return; }
        const dbUser = await FirebaseDB.getUser(u);
        if (!dbUser || dbUser.password !== p) { ui.toast('Username atau password salah.', 'error'); TurnstileManager.reset(); return; }
        const token = Security.generateToken();
        const userData = { ...dbUser, token, loginAt: new Date().toISOString() };
        sessionStorage.setItem('duskveil_session', JSON.stringify(userData));
        await FirebaseDB.setSession(u, dbUser.role);
        RealtimeSync.init(dbUser.role, u);
        ui.toast(`Selamat datang, ${Security.sanitize(u)}!`);
        ui.updateHeader();
        ui.showPage('store');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        app.turnstileToken = null;
    },

    async handleRegister(e) {
        e.preventDefault();
        if (!Security.checkRateLimit('register', 3, 60000)) { ui.toast('⛔ Terlalu banyak percobaan.', 'error'); return; }
        if (!app.turnstileToken) { ui.toast('⚠️ Selesaikan verifikasi keamanan!', 'error'); return; }
        const u  = document.getElementById('reg-user').value.trim();
        const p  = document.getElementById('reg-pass').value;
        const pc = document.getElementById('reg-pass-confirm').value;
        if (!u || !p || !pc) { ui.toast('Isi semua field!', 'error'); return; }
        if (p !== pc) { ui.toast('Password tidak cocok!', 'error'); return; }
        if (!Security.validateUsername(u)) { ui.toast('Username hanya huruf, angka, underscore (3-16 karakter).', 'error'); return; }
        if (!Security.validatePassword(p)) { ui.toast('Password minimal 6 karakter.', 'error'); return; }
        if (u === ADMIN_CONFIG.username) { ui.toast('Username terlindungi.', 'error'); return; }
        const existing = await FirebaseDB.getUser(u);
        if (existing) { ui.toast('Username sudah digunakan!', 'error'); return; }
        await FirebaseDB.saveUser(u, { username: u, password: p, role: 'member', coin: 1000, createdAt: new Date().toISOString() });
        ui.toast('Registrasi berhasil! Silakan login.');
        ui.switchTab('login');
        document.getElementById('login-user').value = u;
        ['reg-user','reg-pass','reg-pass-confirm'].forEach(id => { document.getElementById(id).value = ''; });
        app.turnstileToken = null;
    },

    async logout() {
        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            const user = JSON.parse(session);
            await FirebaseDB.removeSession(user.username);
        }
        RealtimeSync.stopAll();
        sessionStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        ui.toast('Anda telah keluar.');
        app.turnstileToken = null;
    },

    async _deductCoin(user, price) {
        const newBal = Math.max(0, (user.coin || 0) - price);
        await FirebaseDB.updateCoin(user.username, newBal);
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
        if ((user.coin||0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;
        await this._deductCoin(user, price);
        await processCommands(`ksl give ${user.username} ${smallTextName}`, user.username, itemName, price);
    },

    async buyRank(rankName, price, rankId) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin||0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;
        await this._deductCoin(user, price);
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
        if ((user.coin||0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => this.upgradeSkill(skillName, actualPrice));
    },

    async upgradeSkill(skillName, price) {
        const user = this._getUser();
        if (!user) return;
        const level = prompt(`Level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) { ui.toast('Level tidak valid!', 'error'); return; }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;
        await this._deductCoin(user, price);
        const skillId = SKILLS_LIST.find(s => s.name === skillName)?.id || skillName.toLowerCase();
        await processCommands(`skill setlevel ${user.username} ${skillId} ${level}`, user.username, `Skill: ${skillName} → Lv.${level}`, price);
    },

    async buyAllSkills(price) {
        const user = this._getUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin||0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) { ui.toast('Level tidak valid!', 'error'); return; }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;
        await this._deductCoin(user, price);
        await processCommands(`skill setall ${user.username} ${maxLevel}`, user.username, `All Skills → Lv.${maxLevel}`, price);
    },

    async copyAndExecute(id, command) {
        await navigator.clipboard.writeText(command);
        ui.toast('✅ Command di-copy!');
        if (confirm('Apakah command sudah dijalankan?\nOK = sudah')) {
            await FirebaseDB.updateCommand(id, { status: 'executed' });
            ui.renderCommandTable();
            ui.updateAdminBadge();
            ui.toast('✅ Ditandai executed!');
        }
    },

    async deleteCommand(id) {
        if (!confirm('Hapus command ini?')) return;
        await FirebaseDB.deleteCommand(id);
        ui.renderCommandTable();
        ui.updateAdminBadge();
        ui.toast('🗑️ Dihapus!');
    },

    async executeAllCommands() {
        const pending = await FirebaseDB.getPendingCommands();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command pending!', 'error'); return; }
        if (!confirm(`Kirim ${pending.length} command ke server?`)) return;
        ui.toast(`⏳ Mengirim ${pending.length} command...`);
        const results = await PterodactylAPI.sendCommands(pending.map(c => c.command));
        const allOk = results.every(r => r.success);
        for (let i = 0; i < pending.length; i++) {
            const status = results[i]?.success ? 'executed' : 'failed';
            await FirebaseDB.updateCommand(pending[i].id, { status });
        }
        if (allOk) { ui.toast(`✅ Semua ${pending.length} command berhasil!`); }
        else { navigator.clipboard.writeText(pending.map(c => c.command).join('\n')); ui.toast('⚠️ Sebagian gagal. Di-copy — paste manual!', 'error'); }
        ui.renderCommandTable(); ui.updateAdminBadge(); ui.updateStats();
    },

    async copyAllCommands() {
        const pending = await FirebaseDB.getPendingCommands();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        await navigator.clipboard.writeText(pending.map(c => c.command).join('\n'));
        ui.toast(`✅ ${pending.length} command di-copy!`);
    },

    async clearAllCommands() {
        const pending = await FirebaseDB.getPendingCommands();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        if (!confirm('Hapus SEMUA command?')) return;
        await FirebaseDB.clearCommands();
        ui.renderCommandTable(); ui.updateAdminBadge(); ui.updateStats();
        ui.toast('🗑️ Semua command dihapus!');
    },

    async exportCommands() {
        const commands = await FirebaseDB.getCommands();
        if (commands.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(commands, null, 2));
        const a = document.createElement('a'); a.href = uri; a.download = `commands_${Date.now()}.json`; a.click();
        ui.toast(`💾 Exported!`);
    },

    async exportAllData() {
        const [users, purchases, commands] = await Promise.all([FirebaseDB.getAllUsers(), FirebaseDB.getPurchases(999), FirebaseDB.getCommands()]);
        const data = { users, purchases, commands, exportedAt: new Date().toISOString() };
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a'); a.href = uri; a.download = `duskveil_backup_${Date.now()}.json`; a.click();
        ui.toast('💾 Database exported!');
    },

    async clearAllData() {
        if (!confirm('⚠️ Hapus SEMUA data?')) return;
        if (!confirm('Konfirmasi terakhir: yakin?')) return;
        await FirebaseDB.clearCommands();
        ui.renderAdminTable(); ui.updateStats();
        ui.toast('🗑️ Data direset!');
    },

    fillAdmin(u, c) {
        const si = document.getElementById('admin-search'); if (si) si.value = u;
        const ci = document.getElementById('admin-coin');   if (ci) ci.value = c;
    },

    async adminSetCoin() {
        const username   = document.getElementById('admin-search').value.trim();
        const coinAmount = document.getElementById('admin-coin').value;
        if (!username) { ui.toast('Masukkan username!', 'error'); return; }
        if (!coinAmount || isNaN(coinAmount) || parseInt(coinAmount) < 0) { ui.toast('Jumlah koin tidak valid!', 'error'); return; }
        const user = await FirebaseDB.getUser(username);
        if (!user) { ui.toast('User tidak ditemukan!', 'error'); return; }
        await FirebaseDB.updateCoin(username, parseInt(coinAmount));
        ui.toast(`✅ Koin ${Security.sanitize(username)} → ${parseInt(coinAmount).toLocaleString()}`);
        ui.renderAdminTable(); ui.updateHeader(); ui.updateStats();
        document.getElementById('admin-coin').value = '';
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
window.addEventListener('beforeunload', async () => {
    const session = sessionStorage.getItem('duskveil_session');
    if (session) { const user = JSON.parse(session); await FirebaseDB.removeSession(user.username); }
});

// Expose ke global scope (wajib karena type="module")
window.app = app;
window.ui = ui;
window.TurnstileManager = TurnstileManager;
