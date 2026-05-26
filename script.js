fixed_js = '''const API_CONFIG = {
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
// REAL-TIME SYNC ENGINE (BARU)
// ============================================
const SyncEngine = {
    channel: null,
    
    init() {
        // BroadcastChannel untuk sync antar-tab di device yang sama
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel('duskveil_sync');
            this.channel.onmessage = (event) => {
                const { type, data } = event.data;
                this.handleSync(type, data);
            };
        }
        
        // Polling untuk deteksi perubahan dari tab lain (fallback)
        this.startPolling();
        
        // Event listener untuk storage changes (cross-tab)
        window.addEventListener('storage', (e) => {
            if (e.key === 'duskveil_db' || e.key === 'duskveil_commands' || e.key === 'duskveil_purchases') {
                this.handleSync('storage_change', { key: e.key });
            }
        });
    },
    
    handleSync(type, data) {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        
        // Update UI real-time untuk admin
        if (user.role === 'admin') {
            if (type === 'user_login' || type === 'user_register' || type === 'storage_change') {
                ui.renderAdminTable();
                ui.updateStats();
                ui.updateAdminBadge();
                
                // Notifikasi admin kalau ada user baru login
                if (type === 'user_login' && data && data.username) {
                    ui.toast(`🔔 User "${data.username}" baru saja login!`, 'info');
                }
                if (type === 'user_register' && data && data.username) {
                    ui.toast(`🎉 Member baru "${data.username}" berhasil mendaftar!`, 'success');
                }
            }
            if (type === 'purchase' && data) {
                ui.renderPurchaseLog();
                ui.updateStats();
                ui.toast(`💰 Pembelian baru: ${data.itemName} oleh ${data.username}`, 'info');
            }
            if (type === 'command_added') {
                ui.renderCommandTable();
                ui.updateAdminBadge();
            }
        }
        
        // Update coin untuk user biasa kalau di-update admin
        if (user.role === 'member' && type === 'coin_updated' && data.username === user.username) {
            const freshUser = DB.getUser(user.username);
            if (freshUser) {
                const newSession = { ...freshUser, token: user.token, loginAt: user.loginAt };
                sessionStorage.setItem('duskveil_session', JSON.stringify(newSession));
                ui.updateHeader();
                if (data.byAdmin) {
                    ui.toast(`💰 Saldo koin Anda diperbarui admin menjadi ${freshUser.coin.toLocaleString()}!`, 'success');
                }
            }
        }
    },
    
    broadcast(type, data) {
        // Kirim ke BroadcastChannel
        if (this.channel) {
            this.channel.postMessage({ type, data, timestamp: Date.now() });
        }
        
        // Trigger storage event untuk cross-tab
        // Dengan mengupdate localStorage dengan timestamp unik
        localStorage.setItem('duskveil_last_sync', Date.now().toString());
    },
    
    startPolling() {
        // Polling setiap 2 detik untuk deteksi perubahan
        // Berguna untuk device yang tidak support BroadcastChannel
        let lastSync = localStorage.getItem('duskveil_last_sync') || '0';
        
        setInterval(() => {
            const currentSync = localStorage.getItem('duskveil_last_sync') || '0';
            if (currentSync !== lastSync) {
                lastSync = currentSync;
                this.handleSync('storage_change', {});
            }
            
            // Update stats real-time untuk admin panel
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                const user = JSON.parse(session);
                if (user.role === 'admin') {
                    // Cek apakah ada user baru yang belum muncul di tabel
                    const currentUsers = DB.getUsers();
                    const tableBody = document.getElementById('user-table-body');
                    if (tableBody) {
                        const visibleRows = tableBody.querySelectorAll('tr');
                        if (visibleRows.length !== currentUsers.length && !document.getElementById('admin-dashboard').classList.contains('hidden')) {
                            ui.renderAdminTable();
                            ui.updateStats();
                        }
                    }
                    
                    // Update pending badge real-time
                    ui.updateAdminBadge();
                }
            }
        }, 2000);
    }
};

// ============================================
// SECURITY UTILITIES
// ============================================
const Security = {
    sanitize: (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    validateUsername: (username) => {
        const regex = /^[a-zA-Z0-9_]{3,16}$/;
        return regex.test(username);
    },
    validatePassword: (password) => {
        return password.length >= 6;
    },
    rateLimiter: {},
    checkRateLimit: (action, maxAttempts = 5, windowMs = 60000) => {
        const now = Date.now();
        if (!Security.rateLimiter[action]) {
            Security.rateLimiter[action] = { attempts: 1, firstAttempt: now };
            return true;
        }
        const record = Security.rateLimiter[action];
        if (now - record.firstAttempt > windowMs) {
            record.attempts = 1;
            record.firstAttempt = now;
            return true;
        }
        if (record.attempts >= maxAttempts) return false;
        record.attempts++;
        return true;
    },
    generateToken: () => {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
};

// ============================================
// TURNSTILE MANAGER (FIXED)
// ============================================
const TurnstileManager = {
    widgetId: null,
    currentTab: 'login',
    siteKey: '0x4AAAAAADWhIdBmcN5kZHEQ',
    
    render: (tab) => {
        TurnstileManager.remove();
        TurnstileManager.currentTab = tab;
        
        const containerId = tab === 'login' ? 'turnstile-login' : 'turnstile-register';
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        if (window.turnstile) {
            TurnstileManager.widgetId = window.turnstile.render(container, {
                sitekey: TurnstileManager.siteKey,
                callback: (token) => {
                    app.turnstileToken = token;
                    console.log(`✅ Turnstile verified for ${tab}`);
                },
                'error-callback': () => {
                    app.turnstileToken = null;
                    ui.toast('❌ Verifikasi keamanan gagal. Coba lagi.', 'error');
                },
                theme: 'dark',
                size: 'normal'
            });
        } else {
            container.innerHTML = '<div style="color:var(--text3);font-size:0.78rem;text-align:center;padding:12px;">⏳ Memuat verifikasi...</div>';
        }
    },
    
    remove: () => {
        if (TurnstileManager.widgetId && window.turnstile) {
            try {
                window.turnstile.remove(TurnstileManager.widgetId);
            } catch(e) {
                console.log('Turnstile remove error:', e);
            }
            TurnstileManager.widgetId = null;
        }
        app.turnstileToken = null;
    },
    
    reset: () => {
        if (TurnstileManager.widgetId && window.turnstile) {
            try {
                window.turnstile.reset(TurnstileManager.widgetId);
            } catch(e) {
                console.log('Turnstile reset error:', e);
            }
        }
        app.turnstileToken = null;
    }
};

// ============================================
// PTERODACTYL AUTO-EXECUTE
// ============================================
const PterodactylAPI = {
    sendCommand: async (command) => {
        try {
            const wsRes = await fetch(
                `${API_CONFIG.panelUrl}/api/client/servers/${API_CONFIG.serverId}/websocket`,
                {
                    headers: {
                        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!wsRes.ok) {
                const err = await wsRes.text();
                console.error('WS credentials error:', err);
                return { success: false, error: `HTTP ${wsRes.status}` };
            }

            const wsData = await wsRes.json();
            const { token, socket: wsUrl } = wsData.data;

            return new Promise((resolve) => {
                const ws = new WebSocket(wsUrl);
                let timeout = setTimeout(() => {
                    ws.close();
                    resolve({ success: false, error: 'WebSocket timeout (10s)' });
                }, 10000);

                ws.onopen = () => {
                    ws.send(JSON.stringify({ event: 'auth', args: [token] }));
                };

                ws.onmessage = (e) => {
                    const msg = JSON.parse(e.data);
                    if (msg.event === 'auth success') {
                        ws.send(JSON.stringify({ event: 'send command', args: [command] }));
                        clearTimeout(timeout);
                        setTimeout(() => {
                            ws.close();
                            resolve({ success: true });
                        }, 800);
                    }
                    if (msg.event === 'token expired' || msg.event === 'jwt error') {
                        clearTimeout(timeout);
                        ws.close();
                        resolve({ success: false, error: 'Token expired' });
                    }
                };
                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve({ success: false, error: 'WebSocket error' });
                };
            });
        } catch (err) {
            return { success: false, error: err.message };
        }
    },
    sendCommands: async (commands) => {
        const results = [];
        for (const cmd of commands) {
            const res = await PterodactylAPI.sendCommand(cmd);
            results.push({ command: cmd, ...res });
            if (!res.success) break;
            await new Promise(r => setTimeout(r, 400));
        }
        return results;
    }
};

// ============================================
// COMMAND QUEUE (DENGAN SYNC)
// ============================================
class CommandQueue {
    static getAll() {
        try { return JSON.parse(localStorage.getItem('duskveil_commands') || '[]'); }
        catch { return []; }
    }
    static save(cmds) {
        localStorage.setItem('duskveil_commands', JSON.stringify(cmds));
        SyncEngine.broadcast('command_added', { count: cmds.length });
    }
    static add(command, username, itemName, autoSent = false) {
        const cmds = this.getAll();
        cmds.push({
            id: Date.now() + Math.random(),
            command: Security.sanitize(command),
            username: Security.sanitize(username),
            itemName: Security.sanitize(itemName),
            timestamp: new Date().toISOString(),
            status: autoSent ? 'executed' : 'pending',
            autoSent
        });
        if (cmds.length > 500) cmds.shift();
        this.save(cmds);
    }
    static markExecuted(id) {
        const cmds = this.getAll();
        const c = cmds.find(c => c.id === id);
        if (c) c.status = 'executed';
        this.save(cmds);
    }
    static markFailed(id) {
        const cmds = this.getAll();
        const c = cmds.find(c => c.id === id);
        if (c) c.status = 'failed';
        this.save(cmds);
    }
    static delete(id) {
        this.save(this.getAll().filter(c => c.id !== id));
    }
    static clearAll() {
        localStorage.setItem('duskveil_commands', '[]');
        SyncEngine.broadcast('command_added', { count: 0 });
    }
    static getPending() {
        return this.getAll().filter(c => c.status === 'pending');
    }
}

// ============================================
// PURCHASE LOG (DENGAN SYNC)
// ============================================
const PurchaseLog = {
    getAll() {
        try { return JSON.parse(localStorage.getItem('duskveil_purchases') || '[]'); }
        catch { return []; }
    },
    save(data) {
        localStorage.setItem('duskveil_purchases', JSON.stringify(data));
    },
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
        this.save(all.slice(0, 200));
        
        // Broadcast ke admin real-time
        SyncEngine.broadcast('purchase', entry);
    },
    getRecent(n = 50) {
        return this.getAll().slice(0, n);
    }
};

// ============================================
// DATABASE (ENCRYPTED) - DENGAN SYNC
// ============================================
const DB = {
    encrypt: (data) => {
        try { return btoa(JSON.stringify(data)); }
        catch { return JSON.stringify(data); }
    },
    decrypt: (str) => {
        try { return JSON.parse(atob(str)); }
        catch {
            try { return JSON.parse(str); }
            catch { return { users: [] }; }
        }
    },
    getKey: () => {
        const stored = localStorage.getItem('duskveil_db');
        return stored ? DB.decrypt(stored) : { users: [] };
    },
    save: (data) => {
        localStorage.setItem('duskveil_db', DB.encrypt(data));
        // Trigger sync untuk update real-time
        localStorage.setItem('duskveil_last_sync', Date.now().toString());
    },
    init: () => {
        let data = DB.getKey();
        if (!data.users) data.users = [];
        if (!data.users.find(u => u.username === ADMIN_CONFIG.username)) {
            data.users.push({
                username: ADMIN_CONFIG.username,
                password: ADMIN_CONFIG.password,
                role: 'admin',
                coin: 999999,
                createdAt: new Date().toISOString()
            });
        }
        if (!data.users.find(u => u.username === 'player1')) {
            data.users.push({
                username: 'player1',
                password: 'player1',
                role: 'member',
                coin: 50000,
                createdAt: new Date().toISOString()
            });
        }
        DB.save(data);
    },
    getUsers: () => DB.getKey().users || [],
    login: (u, p) => {
        const user = DB.getKey().users.find(x => x.username === u && x.password === p);
        if (user) {
            const token = Security.generateToken();
            const userData = { ...user, token, loginAt: new Date().toISOString() };
            
            // Broadcast ke semua tab bahwa user login
            SyncEngine.broadcast('user_login', { username: u, role: user.role, timestamp: Date.now() });
            
            return { success: true, user: userData };
        }
        return { success: false, message: 'Username atau password salah.' };
    },
    register: (u, p) => {
        if (!Security.validateUsername(u)) {
            return { success: false, message: 'Username hanya boleh huruf, angka, underscore (3-16 karakter).' };
        }
        if (!Security.validatePassword(p)) {
            return { success: false, message: 'Password minimal 6 karakter.' };
        }
        const data = DB.getKey();
        if (u === ADMIN_CONFIG.username) return { success: false, message: 'Username terlindungi.' };
        if (data.users.find(x => x.username === u)) return { success: false, message: 'Username sudah ada.' };
        
        const newUser = {
            username: u,
            password: p,
            role: 'member',
            coin: 1000,
            createdAt: new Date().toISOString()
        };
        data.users.push(newUser);
        DB.save(data);
        
        // Broadcast ke semua tab bahwa user baru terdaftar
        SyncEngine.broadcast('user_register', { username: u, timestamp: Date.now() });
        
        return { success: true };
    },
    updateUserCoin: (username, newCoin) => {
        const data = DB.getKey();
        const idx = data.users.findIndex(u => u.username === username);
        if (idx !== -1) {
            data.users[idx].coin = Math.max(0, parseInt(newCoin) || 0);
            DB.save(data);
            
            // Broadcast update coin ke user yang bersangkutan
            SyncEngine.broadcast('coin_updated', { 
                username, 
                coin: data.users[idx].coin,
                byAdmin: true 
            });
            
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                let s = JSON.parse(session);
                if (s.username === username) {
                    s.coin = data.users[idx].coin;
                    sessionStorage.setItem('duskveil_session', JSON.stringify(s));
                }
            }
            return true;
        }
        return false;
    },
    getUser: (username) => DB.getKey().users.find(u => u.username === username)
};

// ============================================
// PROCESS COMMANDS
// ============================================
async function processCommands(commands, username, itemName, price) {
    const cmdArray = Array.isArray(commands) ? commands : [commands];
    ui.toast(`⏳ Mengirim command ke server...`, 'info');

    const results = await PterodactylAPI.sendCommands(cmdArray);
    const allOk = results.every(r => r.success);

    if (allOk) {
        cmdArray.forEach(cmd => CommandQueue.add(cmd, username, itemName, true));
        PurchaseLog.add(username, itemName, price, cmdArray, true);
        ui.toast(`✅ Command berhasil dikirim otomatis ke server!`, 'success');
    } else {
        const failedIdx = results.findIndex(r => !r.success);
        console.warn('Auto-execute gagal:', results[failedIdx]?.error);
        cmdArray.forEach(cmd => CommandQueue.add(cmd, username, itemName, false));
        PurchaseLog.add(username, itemName, price, cmdArray, false);
        ui.toast(`⚠️ Auto-execute gagal. Command disimpan di Queue — paste manual di console server.`, 'error');
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
    toast: (msg, type = 'success') => {
        const box = document.getElementById('toast-box');
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.innerHTML = `<span>${Security.sanitize(msg)}</span><span style="cursor:pointer;font-size:1.1rem;opacity:.6" onclick="this.parentElement.remove()">×</span>`;
        box.appendChild(div);
        setTimeout(() => div.remove(), 5000);
    },

    switchTab: (tab) => {
        const lf = document.getElementById('form-login');
        const rf = document.getElementById('form-register');
        const btns = document.querySelectorAll('.tab-btn');
        if (tab === 'login') {
            lf.classList.remove('hidden'); rf.classList.add('hidden');
            btns[0].classList.add('active'); btns[1].classList.remove('active');
        } else {
            lf.classList.add('hidden'); rf.classList.remove('hidden');
            btns[0].classList.remove('active'); btns[1].classList.add('active');
        }
        TurnstileManager.render(tab);
    },

    renderStore: () => {
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
            return `
                <div class="card">
                    <div class="card-img">${icon}</div>
                    <div class="card-content">
                        <div class="card-title">${Security.sanitize(item.name)}</div>
                        <div class="card-type">${type}</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="${onclick}">BELI SEKARANG</button>
                    </div>
                </div>`;
        };

        const kontrakGrid = document.getElementById('grid-kontrak');
        const rankGrid = document.getElementById('grid-rank');
        const skillGrid = document.getElementById('grid-skill');
        
        if (kontrakGrid) kontrakGrid.innerHTML = products.kontrak.map(i => createCard('kontrak', i)).join('');
        if (rankGrid) rankGrid.innerHTML = products.rank.map(i => createCard('rank', i)).join('');
        if (skillGrid) skillGrid.innerHTML = products.skill.map(i => createCard('skill', i)).join('');
    },

    renderAdminTable: () => {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        const users = DB.getUsers();
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Tidak ada member</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${Security.sanitize(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                <td style="font-size:0.78rem;color:var(--text3);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${u.username}',${u.coin || 0})">Edit</button></td>
            </tr>`).join('');
    },

    renderPurchaseLog: () => {
        const tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        const purchases = PurchaseLog.getRecent(50);

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);">📭 Belum ada pembelian</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => {
            const statusClass = p.autoExecuted ? 'status-executed' : 'status-pending';
            const statusText = p.autoExecuted ? '✅ Auto-sent' : '⏳ Manual Queue';
            const cmdsHtml = p.commands.map(c => `<code style="display:block;font-size:0.72rem;background:var(--bg2);padding:2px 6px;border-radius:3px;margin:2px 0;color:var(--primary3);">${Security.sanitize(c)}</code>`).join('');
            return `
                <tr>
                    <td style="font-size:0.78rem;color:var(--text3);">${new Date(p.timestamp).toLocaleString('id-ID')}</td>
                    <td style="font-weight:600;">${Security.sanitize(p.username)}</td>
                    <td>${Security.sanitize(p.itemName)}<div style="margin-top:4px;">${cmdsHtml}</div></td>
                    <td style="color:var(--gold);font-weight:700;">${(p.price || 0).toLocaleString()}</td>
                    <td><span class="command-status ${statusClass}">${statusText}</span></td>
                </tr>`;
        }).join('');
    },

    renderCommandTable: () => {
        const tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        const commands = CommandQueue.getAll();
        if (commands.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);">📭 Tidak ada command</td></tr>';
            return;
        }
        tbody.innerHTML = commands.map(cmd => {
            const sc = cmd.status === 'pending' ? 'status-pending' : cmd.status === 'failed' ? 'status-failed' : 'status-executed';
            const st = cmd.status === 'pending' ? '⏳ Pending' : cmd.status === 'failed' ? '❌ Failed' : (cmd.autoSent ? '✅ Auto-sent' : '✅ Executed');
            const safeCmd = Security.sanitize(cmd.command).replace(/"/g, '&quot;');
            const actions = cmd.status === 'pending'
                ? `<button class="btn-execute" onclick="app.copyAndExecute(${cmd.id}, this.getAttribute('data-cmd'))" data-cmd="${safeCmd}">📋 Copy & Execute</button>
                   <button class="btn-copy" onclick="app.copyCommandOnly(this.getAttribute('data-cmd'))" data-cmd="${safeCmd}">📄 Copy</button>`
                : `<button class="btn-copy" onclick="app.deleteCommand(${cmd.id})">🗑️ Hapus</button>`;
            return `
                <tr>
                    <td style="font-size:0.78rem;">${new Date(cmd.timestamp).toLocaleString('id-ID')}</td>
                    <td><div class="command-text"><code>${Security.sanitize(cmd.command)}</code></div><small style="color:var(--text3);">👤 ${Security.sanitize(cmd.username)} — ${Security.sanitize(cmd.itemName)}</small></td>
                    <td><span class="command-status ${sc}">${st}</span></td>
                    <td>${actions}</td>
                </tr>`;
        }).join('');
    },

    updateStats: () => {
        const users = DB.getUsers();
        const totalCoins = users.reduce((sum, u) => sum + (u.coin || 0), 0);
        const purchases = PurchaseLog.getAll();
        const pending = CommandQueue.getPending();

        const statUsers = document.getElementById('stat-total-users');
        const statCoins = document.getElementById('stat-total-coins');
        const statPurchases = document.getElementById('stat-total-purchases');
        const statPending = document.getElementById('stat-pending-commands');

        if (statUsers) statUsers.textContent = users.length.toLocaleString();
        if (statCoins) statCoins.textContent = totalCoins.toLocaleString();
        if (statPurchases) statPurchases.textContent = purchases.length.toLocaleString();
        if (statPending) statPending.textContent = pending.length.toLocaleString();
    },

    updateAdminBadge: () => {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        const n = CommandQueue.getPending().length;
        badge.textContent = n;
        badge.style.display = n > 0 ? 'inline-flex' : 'none';
    },

    showCommandPanel: () => {
        document.getElementById('store-section').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('purchase-panel').classList.add('hidden');
        document.getElementById('command-panel').classList.remove('hidden');
        ui.renderCommandTable();
    },

    showPurchasePanel: () => {
        document.getElementById('store-section').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('command-panel').classList.add('hidden');
        document.getElementById('purchase-panel').classList.remove('hidden');
        ui.renderPurchaseLog();
    },

    showAdminPanel: () => {
        document.getElementById('store-section').classList.add('hidden');
        document.getElementById('command-panel').classList.add('hidden');
        document.getElementById('purchase-panel').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        ui.renderAdminTable();
        ui.updateStats();
    },

    showStorePanel: () => {
        document.getElementById('store-section').classList.remove('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('command-panel').classList.add('hidden');
        document.getElementById('purchase-panel').classList.add('hidden');
    },

    updateHeader: () => {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        const navUser = document.getElementById('nav-username');
        const navCoin = document.getElementById('nav-coin');
        const navAvatar = document.getElementById('nav-avatar');
        if (navUser) navUser.innerText = Security.sanitize(user.username);
        if (navCoin) navCoin.innerText = (user.coin || 0).toLocaleString();
        if (navAvatar) navAvatar.innerText = user.username.charAt(0).toUpperCase();
        ui.updateAdminBadge();
    },

    showPage: (page) => {
        const auth = document.getElementById('auth-section');
        const store = document.getElementById('store-section');
        const nav = document.getElementById('navbar');
        const adminDash = document.getElementById('admin-dashboard');
        
        if (page === 'auth') {
            auth.classList.remove('hidden');
            store.classList.add('hidden');
            nav.classList.add('hidden');
            if (adminDash) adminDash.classList.add('hidden');
            document.getElementById('command-panel')?.classList.add('hidden');
            document.getElementById('purchase-panel')?.classList.add('hidden');
            setTimeout(() => TurnstileManager.render('login'), 100);
        } else {
            auth.classList.add('hidden');
            nav.classList.remove('hidden');
            
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                const user = JSON.parse(session);
                const isAdmin = user.role === 'admin';
                
                document.getElementById('admin-notice')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-commands-btn')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-purchases-btn')?.classList.toggle('hidden', !isAdmin);
                document.getElementById('nav-admin-btn')?.classList.toggle('hidden', !isAdmin);
                
                if (isAdmin) {
                    ui.showAdminPanel();
                } else {
                    ui.showStorePanel();
                }
            }
            ui.updateAdminBadge();
        }
    },

    showSkillModal: (price, cb) => {
        const modal = document.getElementById('skill-modal');
        const container = document.getElementById('skill-list-container');
        if (!container) return;
        container.innerHTML = '';
        SKILLS_LIST.forEach(skill => {
            const div = document.createElement('div');
            div.className = 'skill-option';
            div.innerHTML = `<span class="skill-name">⚔️ ${Security.sanitize(skill.name)}</span><span class="skill-price">${price.toLocaleString()} 🪙</span>`;
            div.onclick = () => { ui.closeSkillModal(); cb(skill.name, price); };
            container.appendChild(div);
        });
        modal.classList.remove('hidden');
    },

    closeSkillModal: () => {
        const modal = document.getElementById('skill-modal');
        if (modal) modal.classList.add('hidden');
    }
};

// ============================================
// APP LOGIC
// ============================================
const app = {
    turnstileToken: null,

    init: () => {
        // Init sync engine dulu
        SyncEngine.init();
        
        DB.init();
        ui.renderStore();
        
        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                const dbUser = DB.getUser(user.username);
                if (dbUser) {
                    const freshSession = { ...dbUser, token: user.token, loginAt: user.loginAt };
                    sessionStorage.setItem('duskveil_session', JSON.stringify(freshSession));
                    ui.updateHeader();
                    ui.showPage('store');
                } else {
                    sessionStorage.removeItem('duskveil_session');
                    ui.showPage('auth');
                }
            } catch {
                sessionStorage.removeItem('duskveil_session');
                ui.showPage('auth');
            }
        } else {
            ui.showPage('auth');
        }

        app.initParticles();
    },

    initParticles: () => {
        const container = document.getElementById('particles');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.setProperty('--dur', (4 + Math.random() * 6) + 's');
            p.style.setProperty('--delay', (Math.random() * 5) + 's');
            container.appendChild(p);
        }
    },

    handleLogin: async (e) => {
        e.preventDefault();
        
        if (!Security.checkRateLimit('login', 5, 60000)) {
            ui.toast('⛔ Terlalu banyak percobaan login. Coba lagi dalam 1 menit.', 'error');
            return;
        }

        if (!app.turnstileToken) {
            ui.toast('⚠️ Harap selesaikan verifikasi keamanan terlebih dahulu!', 'error');
            return;
        }

        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        
        if (!u || !p) {
            ui.toast('Harap isi username dan password!', 'error');
            return;
        }
        
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

    handleRegister: async (e) => {
        e.preventDefault();
        
        if (!Security.checkRateLimit('register', 3, 60000)) {
            ui.toast('⛔ Terlalu banyak percobaan registrasi. Coba lagi dalam 1 menit.', 'error');
            return;
        }

        if (!app.turnstileToken) {
            ui.toast('⚠️ Harap selesaikan verifikasi keamanan terlebih dahulu!', 'error');
            return;
        }

        const u = document.getElementById('reg-user').value.trim();
        const p = document.getElementById('reg-pass').value;
        const pc = document.getElementById('reg-pass-confirm').value;
        
        if (!u || !p || !pc) {
            ui.toast('Harap isi semua field!', 'error');
            return;
        }
        
        if (p !== pc) {
            ui.toast('Password dan konfirmasi password tidak cocok!', 'error');
            return;
        }
        
        const res = DB.register(u, p);
        if (res.success) {
            ui.toast('Registrasi berhasil! Silakan login.');
            ui.switchTab('login');
            document.getElementById('login-user').value = u;
            document.getElementById('reg-user').value = '';
            document.getElementById('reg-pass').value = '';
            document.getElementById('reg-pass-confirm').value = '';
            app.turnstileToken = null;
        } else {
            ui.toast(res.message, 'error');
            TurnstileManager.reset();
        }
    },

    logout: () => {
        const user = app._getUser();
        sessionStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        ui.toast('Anda telah keluar.');
        app.turnstileToken = null;
        
        // Broadcast logout ke admin
        if (user) {
            SyncEngine.broadcast('user_logout', { username: user.username, timestamp: Date.now() });
        }
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

    buyBook: async (itemName, price, smallTextName) => {
        const user = app._getUser();
        if (!user) { ui.toast('Silakan login terlebih dahulu!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()} koin`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;

        app._deductCoin(user, price);
        const command = `ksl give ${user.username} ${smallTextName}`;
        await processCommands(command, user.username, itemName, price);
    },

    buyRank: async (rankName, price, rankId) => {
        const user = app._getUser();
        if (!user) { ui.toast('Silakan login terlebih dahulu!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()} koin`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;

        app._deductCoin(user, price);
        const commands = [
            `lp user ${user.username} parent set ${rankId.toLowerCase()}`,
            `pex user ${user.username} group set ${rankId.toLowerCase()}`,
            `manuadd ${user.username} ${rankName}`,
            `group addplayer ${user.username} ${rankId.toLowerCase()}`
        ];
        await processCommands(commands, user.username, `Rank: ${rankName}`, price);
    },

    showSkillSelection: (price) => {
        const user = app._getUser();
        if (!user) { ui.toast('Silakan login terlebih dahulu!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()} koin`, 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => app.upgradeSkill(skillName, actualPrice));
    },

    upgradeSkill: async (skillName, price) => {
        const user = app._getUser();
        if (!user) return;
        const level = prompt(`Masukkan level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) {
            ui.toast('Level tidak valid! (1-1000)', 'error');
            return;
        }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;

        app._deductCoin(user, price);
        const skillId = SKILLS_LIST.find(s => s.name === skillName)?.id || skillName.toLowerCase();
        const command = `skill setlevel ${user.username} ${skillId} ${level}`;
        await processCommands(command, user.username, `Skill: ${skillName} → Lv.${level}`, price);
    },

    buyAllSkills: async (price) => {
        const user = app._getUser();
        if (!user) { ui.toast('Silakan login terlebih dahulu!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()} koin`, 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) { ui.toast('Level tidak valid!', 'error'); return; }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;

        app._deductCoin(user, price);
        const command = `skill setall ${user.username} ${maxLevel}`;
        await processCommands(command, user.username, `All Skills → Lv.${maxLevel}`, price);
    },

    copyAndExecute: async (id, command) => {
        await navigator.clipboard.writeText(command);
        ui.toast('✅ Command di-copy ke clipboard!');
        if (confirm('Apakah command sudah dijalankan di server?\n\nOK = sudah, Cancel = belum')) {
            CommandQueue.markExecuted(id);
            ui.renderCommandTable();
            ui.updateAdminBadge();
            ui.toast('✅ Command ditandai executed!');
        }
    },

    copyCommandOnly: async (command) => {
        await navigator.clipboard.writeText(command);
        ui.toast('✅ Command di-copy! Paste di console server Minecraft.');
    },

    deleteCommand: (id) => {
        if (!confirm('Hapus command ini?')) return;
        CommandQueue.delete(id);
        ui.renderCommandTable();
        ui.updateAdminBadge();
        ui.toast('🗑️ Command dihapus!');
    },

    executeAllCommands: async () => {
        const pending = CommandQueue.getPending();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command pending!', 'error'); return; }

        if (confirm(`Kirim ${pending.length} command sekaligus ke server secara otomatis?`)) {
            ui.toast(`⏳ Mengirim ${pending.length} command ke server...`);
            const results = await PterodactylAPI.sendCommands(pending.map(c => c.command));
            const allOk = results.every(r => r.success);
            if (allOk) {
                pending.forEach(c => CommandQueue.markExecuted(c.id));
                ui.toast(`✅ Semua ${pending.length} command berhasil dikirim ke server!`);
            } else {
                const failedIdx = results.findIndex(r => !r.success);
                pending.forEach((c, idx) => {
                    if (idx <= failedIdx) {
                        if (results[idx]?.success) {
                            CommandQueue.markExecuted(c.id);
                        } else {
                            CommandQueue.markFailed(c.id);
                        }
                    }
                });
                const allCmds = pending.map(c => c.command).join('\\n');
                navigator.clipboard.writeText(allCmds);
                ui.toast(`⚠️ Sebagian command gagal. Semua command di-copy ke clipboard — paste manual!`, 'error');
            }
            ui.renderCommandTable();
            ui.updateAdminBadge();
            ui.updateStats();
        }
    },

    copyAllCommands: async () => {
        const pending = CommandQueue.getPending();
        if (pending.length === 0) { ui.toast('📭 Tidak ada command pending!', 'error'); return; }
        const allCmds = pending.map(c => c.command).join('\\n');
        await navigator.clipboard.writeText(allCmds);
        ui.toast(`✅ ${pending.length} command di-copy ke clipboard!`);
    },

    clearAllCommands: () => {
        if (CommandQueue.getPending().length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        if (!confirm('Hapus SEMUA command? Tidak bisa dibatalkan!')) return;
        CommandQueue.clearAll();
        ui.renderCommandTable();
        ui.updateAdminBadge();
        ui.updateStats();
        ui.toast('🗑️ Semua command dihapus!');
    },

    exportCommands: () => {
        const commands = CommandQueue.getAll();
        if (commands.length === 0) { ui.toast('📭 Tidak ada command!', 'error'); return; }
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(commands, null, 2));
        const a = document.createElement('a');
        a.href = uri;
        a.download = `duskveil_commands_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        a.click();
        ui.toast(`💾 Exported ${commands.length} command!`);
    },

    exportAllData: () => {
        const data = {
            users: DB.getUsers(),
            purchases: PurchaseLog.getAll(),
            commands: CommandQueue.getAll(),
            exportedAt: new Date().toISOString()
        };
        const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const a = document.createElement('a');
        a.href = uri;
        a.download = `duskveil_backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        a.click();
        ui.toast(`💾 Database exported!`);
    },

    clearAllData: () => {
        if (!confirm('⚠️ PERINGATAN: Ini akan menghapus SEMUA data (member, pembelian, command)!\\n\\nYakin ingin melanjutkan?')) return;
        if (!confirm('Konfirmasi terakhir: Semua data akan HILANG PERMANEN. Lanjutkan?')) return;
        localStorage.removeItem('duskveil_db');
        localStorage.removeItem('duskveil_commands');
        localStorage.removeItem('duskveil_purchases');
        DB.init();
        ui.renderAdminTable();
        ui.updateStats();
        ui.toast('🗑️ Semua data telah direset!');
    },

    fillAdmin: (u, c) => {
        const searchInput = document.getElementById('admin-search');
        const coinInput = document.getElementById('admin-coin');
        if (searchInput) searchInput.value = u;
        if (coinInput) coinInput.value = c;
    },

    adminSetCoin: () => {
        const username = document.getElementById('admin-search').value.trim();
        const coinAmount = document.getElementById('admin-coin').value;
        if (!username) { ui.toast('Masukkan username!', 'error'); return; }
        if (!coinAmount || isNaN(coinAmount) || parseInt(coinAmount) < 0) { ui.toast('Jumlah koin tidak valid!', 'error'); return; }
        if (DB.updateUserCoin(username, parseInt(coinAmount))) {
            ui.toast(`✅ Koin ${Security.sanitize(username)} → ${parseInt(coinAmount).toLocaleString()}`);
            ui.renderAdminTable();
            ui.updateHeader();
            ui.updateStats();
            document.getElementById('admin-coin').value = '';
        } else {
            ui.toast('User tidak ditemukan!', 'error');
        }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

