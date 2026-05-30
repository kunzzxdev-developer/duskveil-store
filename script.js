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
const ADMIN_CONFIG = { 
    username: 'admin', 
    password: 'dusk@gnt3ng303#' 
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
// SIMPLE FUNCTIONS
// ============================================
function sanitize(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '');
}

function showToast(msg, type = 'success') {
    const box = document.getElementById('toast-box');
    if (!box) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<span>${sanitize(msg)}</span><span style="cursor:pointer;margin-left:10px;" onclick="this.parentElement.remove()">✕</span>`;
    box.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

// ============================================
// DATABASE OPERATIONS
// ============================================
const DB = {
    async getUser(username) {
        const snap = await getDoc(doc(db, 'users', username));
        return snap.exists() ? snap.data() : null;
    },
    async saveUser(username, data) {
        await setDoc(doc(db, 'users', username), data);
    },
    async updateCoin(username, coin) {
        await updateDoc(doc(db, 'users', username), { coin });
    },
    async getAllUsers() {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => d.data());
    },
    async setSession(username, role) {
        await setDoc(doc(db, 'sessions', username), {
            username, role, lastSeen: Date.now(), loginAt: Date.now()
        });
    },
    async removeSession(username) {
        try { await deleteDoc(doc(db, 'sessions', username)); } catch(e) {}
    },
    async heartbeat(username) {
        try { await updateDoc(doc(db, 'sessions', username), { lastSeen: Date.now() }); } catch(e) {}
    },
    async getOnlineSessions() {
        const snap = await getDocs(collection(db, 'sessions'));
        const cutoff = Date.now() - 30000;
        return snap.docs.map(d => d.data()).filter(s => s.lastSeen > cutoff);
    },
    async addPurchase(data) {
        await addDoc(collection(db, 'purchases'), { ...data, timestamp: serverTimestamp() });
    },
    async getPurchases(limitCount = 50) {
        const q = query(collection(db, 'purchases'), orderBy('timestamp', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async addCommand(data) {
        await addDoc(collection(db, 'commands'), { ...data, timestamp: serverTimestamp() });
    },
    async getCommands() {
        const q = query(collection(db, 'commands'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async updateCommand(id, data) {
        await updateDoc(doc(db, 'commands', id), data);
    },
    async deleteCommand(id) {
        await deleteDoc(doc(db, 'commands', id));
    },
    async getPendingCommands() {
        const q = query(collection(db, 'commands'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async clearCommands() {
        const snap = await getDocs(collection(db, 'commands'));
        for (const docSnap of snap.docs) {
            await deleteDoc(docSnap.ref);
        }
    }
};

// ============================================
// UI FUNCTIONS
// ============================================
const ui = {
    toast: showToast,

    switchTab(tab) {
        const loginForm = document.getElementById('form-login');
        const registerForm = document.getElementById('form-register');
        const btns = document.querySelectorAll('.tab-btn');
        
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            btns[0].classList.add('active');
            btns[1].classList.remove('active');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            btns[0].classList.remove('active');
            btns[1].classList.add('active');
        }
    },

    showPage(page) {
        const authSection = document.getElementById('auth-section');
        const navbar = document.getElementById('navbar');
        const storeSection = document.getElementById('store-section');
        const adminDashboard = document.getElementById('admin-dashboard');
        
        if (page === 'auth') {
            if (authSection) authSection.classList.remove('hidden');
            if (navbar) navbar.classList.add('hidden');
            if (storeSection) storeSection.classList.add('hidden');
            if (adminDashboard) adminDashboard.classList.add('hidden');
            document.getElementById('command-panel')?.classList.add('hidden');
            document.getElementById('purchase-panel')?.classList.add('hidden');
        } else {
            if (authSection) authSection.classList.add('hidden');
            if (navbar) navbar.classList.remove('hidden');
            
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                const user = JSON.parse(session);
                const isAdmin = user.role === 'admin';
                
                const adminNotice = document.getElementById('admin-notice');
                if (adminNotice) adminNotice.classList.toggle('hidden', !isAdmin);
                
                const commandsBtn = document.getElementById('nav-commands-btn');
                if (commandsBtn) commandsBtn.classList.toggle('hidden', !isAdmin);
                
                const purchasesBtn = document.getElementById('nav-purchases-btn');
                if (purchasesBtn) purchasesBtn.classList.toggle('hidden', !isAdmin);
                
                const adminBtn = document.getElementById('nav-admin-btn');
                if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin);
                
                if (isAdmin) {
                    if (adminDashboard) adminDashboard.classList.remove('hidden');
                    if (storeSection) storeSection.classList.add('hidden');
                    this.renderAdminTable();
                    this.updateStats();
                    this.renderOnlinePlayers();
                } else {
                    if (storeSection) storeSection.classList.remove('hidden');
                    if (adminDashboard) adminDashboard.classList.add('hidden');
                }
            } else {
                if (storeSection) storeSection.classList.remove('hidden');
                if (adminDashboard) adminDashboard.classList.add('hidden');
            }
            this.updateHeader();
        }
    },

    updateHeader() {
        const session = sessionStorage.getItem('duskveil_session');
        if (!session) return;
        const user = JSON.parse(session);
        const usernameEl = document.getElementById('nav-username');
        const coinEl = document.getElementById('nav-coin');
        const avatarEl = document.getElementById('nav-avatar');
        if (usernameEl) usernameEl.innerText = sanitize(user.username);
        if (coinEl) coinEl.innerText = (user.coin || 0).toLocaleString();
        if (avatarEl) avatarEl.innerText = user.username.charAt(0).toUpperCase();
        this.updateAdminBadge();
    },

    async updateAdminBadge() {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        const pending = await DB.getPendingCommands();
        const count = pending.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    },

    renderStore() {
        const products = {
            kontrak: [
                { name: 'Basic Contract', price: 10000, cmd: 'basic' },
                { name: 'Premium Contract', price: 35000, cmd: 'premium' },
                { name: 'Duskveil Contract', price: 55000, cmd: 'duskveil' },
                { name: 'Mythic Contract', price: 75000, cmd: 'mythic' }
            ],
            rank: [
                { name: 'Prime', price: 5000, cmd: 'prime' },
                { name: 'King', price: 15000, cmd: 'king' },
                { name: 'Immortal', price: 25000, cmd: 'immortal' },
                { name: 'Eternal', price: 35000, cmd: 'eternal' },
                { name: 'Abyss', price: 45000, cmd: 'abyss' }
            ],
            skill: [
                { name: 'Upgrade Skill', price: 15000, type: 'single' },
                { name: 'All Skills Max', price: 100000, type: 'all' }
            ]
        };

        const kontrakGrid = document.getElementById('grid-kontrak');
        if (kontrakGrid) {
            kontrakGrid.innerHTML = products.kontrak.map(item => `
                <div class="card">
                    <div class="card-img">📜</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Buku Kontrak</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="app.buyBook('${item.name}', ${item.price}, '${item.cmd}')">BELI SEKARANG</button>
                    </div>
                </div>
            `).join('');
        }

        const rankGrid = document.getElementById('grid-rank');
        if (rankGrid) {
            rankGrid.innerHTML = products.rank.map(item => `
                <div class="card">
                    <div class="card-img">👑</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Rank Server</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="app.buyRank('${item.name}', ${item.price}, '${item.cmd}')">BELI SEKARANG</button>
                    </div>
                </div>
            `).join('');
        }

        const skillGrid = document.getElementById('grid-skill');
        if (skillGrid) {
            skillGrid.innerHTML = products.skill.map(item => `
                <div class="card">
                    <div class="card-img">⚔️</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Skill</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="app.${item.type === 'single' ? 'showSkillSelection' : 'buyAllSkills'}(${item.price})">BELI SEKARANG</button>
                    </div>
                </div>
            `).join('');
        }
    },

    async renderAdminTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        const users = await DB.getAllUsers();
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada member</td></tr>';
            return;
        }
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${sanitize(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${sanitize(u.username)}', ${u.coin || 0})">Edit</button></td>
            </tr>
        `).join('');
    },

    async renderOnlinePlayers() {
        const container = document.getElementById('online-players-list');
        const countEl = document.getElementById('online-count');
        if (!container) return;
        const online = await DB.getOnlineSessions();
        if (countEl) countEl.textContent = online.length;
        if (online.length === 0) {
            container.innerHTML = '<div style="color:var(--text3);padding:8px 0;">Tidak ada user online</div>';
            return;
        }
        container.innerHTML = online.map(s => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);">
                <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
                <span style="flex:1;">${sanitize(s.username)}</span>
                <span style="font-size:0.75rem;color:var(--text3);">${s.role}</span>
            </div>
        `).join('');
    },

    async updateStats() {
        const users = await DB.getAllUsers();
        const totalCoin = users.reduce((sum, u) => sum + (u.coin || 0), 0);
        const purchases = await DB.getPurchases(999);
        const pending = await DB.getPendingCommands();
        
        const totalUsersEl = document.getElementById('stat-total-users');
        const totalCoinEl = document.getElementById('stat-total-coins');
        const totalPurchasesEl = document.getElementById('stat-total-purchases');
        const pendingCommandsEl = document.getElementById('stat-pending-commands');
        
        if (totalUsersEl) totalUsersEl.textContent = users.length;
        if (totalCoinEl) totalCoinEl.textContent = totalCoin.toLocaleString();
        if (totalPurchasesEl) totalPurchasesEl.textContent = purchases.length;
        if (pendingCommandsEl) pendingCommandsEl.textContent = pending.length;
    },

    showSkillModal(price, callback) {
        const modal = document.getElementById('skill-modal');
        const container = document.getElementById('skill-list-container');
        if (!container) return;
        container.innerHTML = '';
        SKILLS_LIST.forEach(skill => {
            const div = document.createElement('div');
            div.className = 'skill-option';
            div.innerHTML = `<span>⚔️ ${skill.name}</span><span style="color:var(--gold);">${price.toLocaleString()} 🪙</span>`;
            div.onclick = () => {
                this.closeSkillModal();
                callback(skill.name, price);
            };
            container.appendChild(div);
        });
        if (modal) modal.classList.remove('hidden');
    },

    closeSkillModal() {
        const modal = document.getElementById('skill-modal');
        if (modal) modal.classList.add('hidden');
    }
};

// ============================================
// APP FUNCTIONS
// ============================================
const app = {
    async init() {
        console.log('App starting...');
        try {
            // Create admin if not exists
            const adminExists = await DB.getUser(ADMIN_CONFIG.username);
            if (!adminExists) {
                await DB.saveUser(ADMIN_CONFIG.username, {
                    username: ADMIN_CONFIG.username,
                    password: ADMIN_CONFIG.password,
                    role: 'admin',
                    coin: 999999,
                    createdAt: new Date().toISOString()
                });
                console.log('Admin created');
            }

            ui.renderStore();

            // Check existing session
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                const user = JSON.parse(session);
                const dbUser = await DB.getUser(user.username);
                if (dbUser) {
                    await DB.setSession(user.username, dbUser.role);
                    ui.showPage('store');
                    ui.updateHeader();
                    this.startHeartbeat(user.username);
                } else {
                    sessionStorage.removeItem('duskveil_session');
                    ui.showPage('auth');
                }
            } else {
                ui.showPage('auth');
            }
        } catch (err) {
            console.error('Init error:', err);
            ui.toast('Error: ' + err.message, 'error');
            ui.showPage('auth');
        }
    },

    startHeartbeat(username) {
        setInterval(async () => {
            const session = sessionStorage.getItem('duskveil_session');
            if (session) {
                await DB.heartbeat(username);
            }
        }, 10000);
    },

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-user').value.trim();
        const password = document.getElementById('login-pass').value;
        const btn = document.getElementById('login-btn');
        
        if (!username || !password) {
            ui.toast('Isi username dan password!', 'error');
            return;
        }
        
        // Disable button
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        try {
            const user = await DB.getUser(username);
            if (!user) {
                ui.toast('Username tidak ditemukan!', 'error');
                return;
            }
            if (user.password !== password) {
                ui.toast('Password salah!', 'error');
                return;
            }
            
            const sessionData = {
                username: user.username,
                role: user.role,
                coin: user.coin || 0,
                loginAt: new Date().toISOString()
            };
            sessionStorage.setItem('duskveil_session', JSON.stringify(sessionData));
            await DB.setSession(username, user.role);
            
            ui.toast(`Selamat datang, ${sanitize(username)}!`, 'success');
            ui.updateHeader();
            ui.showPage('store');
            this.startHeartbeat(username);
            
            // Clear form
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
            
        } catch (err) {
            console.error('Login error:', err);
            ui.toast('Login gagal: ' + err.message, 'error');
        } finally {
            // Re-enable button
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
            }
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('reg-user').value.trim();
        const password = document.getElementById('reg-pass').value;
        const confirmPass = document.getElementById('reg-pass-confirm').value;
        const btn = document.getElementById('register-btn');
        
        if (!username || !password || !confirmPass) {
            ui.toast('Isi semua field!', 'error');
            return;
        }
        if (password !== confirmPass) {
            ui.toast('Password tidak cocok!', 'error');
            return;
        }
        if (username.length < 3 || username.length > 16) {
            ui.toast('Username 3-16 karakter!', 'error');
            return;
        }
        if (password.length < 6) {
            ui.toast('Password minimal 6 karakter!', 'error');
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        try {
            const existing = await DB.getUser(username);
            if (existing) {
                ui.toast('Username sudah digunakan!', 'error');
                return;
            }
            
            await DB.saveUser(username, {
                username,
                password,
                role: 'member',
                coin: 1000,
                createdAt: new Date().toISOString()
            });
            
            ui.toast('Registrasi berhasil! Silakan login.', 'success');
            ui.switchTab('login');
            document.getElementById('login-user').value = username;
            
            // Clear register form
            document.getElementById('reg-user').value = '';
            document.getElementById('reg-pass').value = '';
            document.getElementById('reg-pass-confirm').value = '';
            
        } catch (err) {
            ui.toast('Registrasi gagal: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="btn-text">DAFTAR SEKARANG</span><span class="btn-arrow">→</span>';
            }
        }
    },

    async logout() {
        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            const user = JSON.parse(session);
            await DB.removeSession(user.username);
        }
        sessionStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        ui.toast('Anda telah keluar.');
    },

    getCurrentUser() {
        const session = sessionStorage.getItem('duskveil_session');
        return session ? JSON.parse(session) : null;
    },

    async buyBook(itemName, price, cmd) {
        const user = this.getCurrentUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        await DB.updateCoin(user.username, newCoin);
        user.coin = newCoin;
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        await DB.addCommand({
            command: `ksl give ${user.username} ${cmd}`,
            username: user.username,
            itemName: itemName,
            status: 'pending'
        });
        await DB.addPurchase({
            username: user.username,
            itemName: itemName,
            price: price,
            status: 'pending'
        });
        
        ui.toast(`✅ ${itemName} berhasil dibeli! Command masuk antrian.`, 'success');
        ui.updateAdminBadge();
    },

    async buyRank(rankName, price, rankId) {
        const user = this.getCurrentUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        await DB.updateCoin(user.username, newCoin);
        user.coin = newCoin;
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        const commands = [
            `lp user ${user.username} parent set ${rankId.toLowerCase()}`,
            `pex user ${user.username} group set ${rankId.toLowerCase()}`,
            `manuadd ${user.username} ${rankName}`,
            `group addplayer ${user.username} ${rankId.toLowerCase()}`
        ];
        
        for (const cmd of commands) {
            await DB.addCommand({
                command: cmd,
                username: user.username,
                itemName: `Rank: ${rankName}`,
                status: 'pending'
            });
        }
        await DB.addPurchase({
            username: user.username,
            itemName: `Rank: ${rankName}`,
            price: price,
            status: 'pending'
        });
        
        ui.toast(`✅ Rank ${rankName} berhasil dibeli! Command masuk antrian.`, 'success');
        ui.updateAdminBadge();
    },

    showSkillSelection(price) {
        const user = this.getCurrentUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => this.upgradeSkill(skillName, actualPrice));
    },

    async upgradeSkill(skillName, price) {
        const user = this.getCurrentUser();
        if (!user) return;
        const level = prompt(`Level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) {
            ui.toast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        await DB.updateCoin(user.username, newCoin);
        user.coin = newCoin;
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        const skillId = SKILLS_LIST.find(s => s.name === skillName)?.id || skillName.toLowerCase();
        await DB.addCommand({
            command: `skill setlevel ${user.username} ${skillId} ${level}`,
            username: user.username,
            itemName: `Skill: ${skillName} → Lv.${level}`,
            status: 'pending'
        });
        await DB.addPurchase({
            username: user.username,
            itemName: `Skill: ${skillName} → Lv.${level}`,
            price: price,
            status: 'pending'
        });
        
        ui.toast(`✅ Skill ${skillName} diupgrade ke level ${level}!`, 'success');
        ui.updateAdminBadge();
    },

    async buyAllSkills(price) {
        const user = this.getCurrentUser();
        if (!user) { ui.toast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { ui.toast('Koin tidak cukup!', 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
            ui.toast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        await DB.updateCoin(user.username, newCoin);
        user.coin = newCoin;
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        await DB.addCommand({
            command: `skill setall ${user.username} ${maxLevel}`,
            username: user.username,
            itemName: `All Skills → Lv.${maxLevel}`,
            status: 'pending'
        });
        await DB.addPurchase({
            username: user.username,
            itemName: `All Skills → Lv.${maxLevel}`,
            price: price,
            status: 'pending'
        });
        
        ui.toast(`✅ Semua skill diset ke level ${maxLevel}!`, 'success');
        ui.updateAdminBadge();
    },

    async executeAllCommands() {
        const pending = await DB.getPendingCommands();
        if (pending.length === 0) {
            ui.toast('Tidak ada command pending!', 'error');
            return;
        }
        
        const commands = pending.map(c => c.command);
        const text = commands.join('\n');
        await navigator.clipboard.writeText(text);
        
        for (const cmd of pending) {
            await DB.updateCommand(cmd.id, { status: 'executed' });
        }
        
        ui.toast(`${pending.length} command sudah di-copy! Paste di console server.`, 'success');
        ui.updateAdminBadge();
        ui.renderAdminTable();
    },

    async copyAllCommands() {
        const pending = await DB.getPendingCommands();
        if (pending.length === 0) {
            ui.toast('Tidak ada command!', 'error');
            return;
        }
        const commands = pending.map(c => c.command).join('\n');
        await navigator.clipboard.writeText(commands);
        ui.toast(`${pending.length} command di-copy!`, 'success');
    },

    async exportCommands() {
        const commands = await DB.getCommands();
        const data = JSON.stringify(commands, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commands_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        ui.toast('Commands exported!', 'success');
    },

    async clearAllCommands() {
        if (!confirm('Hapus SEMUA command?')) return;
        await DB.clearCommands();
        ui.toast('Semua command dihapus!', 'success');
        ui.updateAdminBadge();
    },

    async exportAllData() {
        const users = await DB.getAllUsers();
        const purchases = await DB.getPurchases(999);
        const commands = await DB.getCommands();
        const data = JSON.stringify({ users, purchases, commands }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        ui.toast('Data exported!', 'success');
    },

    fillAdmin(username, coin) {
        const searchInput = document.getElementById('admin-search');
        const coinInput = document.getElementById('admin-coin');
        if (searchInput) searchInput.value = username;
        if (coinInput) coinInput.value = coin;
    },

    async adminSetCoin() {
        const username = document.getElementById('admin-search')?.value.trim();
        const coinValue = document.getElementById('admin-coin')?.value;
        
        if (!username) {
            ui.toast('Masukkan username!', 'error');
            return;
        }
        if (!coinValue || isNaN(coinValue) || parseInt(coinValue) < 0) {
            ui.toast('Masukkan jumlah koin yang valid!', 'error');
            return;
        }
        
        const user = await DB.getUser(username);
        if (!user) {
            ui.toast('User tidak ditemukan!', 'error');
            return;
        }
        
        await DB.updateCoin(username, parseInt(coinValue));
        ui.toast(`Koin ${sanitize(username)} → ${parseInt(coinValue).toLocaleString()}`, 'success');
        
        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            const currentUser = JSON.parse(session);
            if (currentUser.username === username) {
                currentUser.coin = parseInt(coinValue);
                sessionStorage.setItem('duskveil_session', JSON.stringify(currentUser));
                ui.updateHeader();
            }
        }
        
        ui.renderAdminTable();
        document.getElementById('admin-coin').value = '';
    }
};

// Expose to window
window.app = app;
window.ui = ui;

// Start app
window.addEventListener('DOMContentLoaded', () => app.init());
