// ============================================
// DuskVeilSMP - COMPLETE SYSTEM
// ============================================

// Firebase Config (SUDAH SETTING)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCyEbIOIJ4DGEczi0yPWUSaA9BIM5TFgj0",
    authDomain: "duskveilsmp.firebaseapp.com",
    projectId: "duskveilsmp",
    storageBucket: "duskveilsmp.firebasestorage.app",
    messagingSenderId: "797107010544",
    appId: "1:797107010544:web:6b5401cdb0cf045c0dbb35"
};

// Global variables
let db = null;
let usersCollection = null;
let sessionsCollection = null;
let commandsCollection = null;
let purchasesCollection = null;
let currentUser = null;
let unsubscribeListeners = [];
let firebaseReady = false;
let productsCache = null;

// ============================================
// INIT FIREBASE V8
// ============================================
function loadFirebase() {
    return new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            try {
                db = firebase.firestore();
                usersCollection = db.collection('users');
                sessionsCollection = db.collection('sessions');
                commandsCollection = db.collection('commands');
                purchasesCollection = db.collection('purchases');
                firebaseReady = true;
                resolve();
                return;
            } catch(e) { reject(e); }
        }
        
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js';
        script.onload = () => {
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js';
            firestoreScript.onload = () => {
                try {
                    if (!firebase.apps.length) {
                        firebase.initializeApp(FIREBASE_CONFIG);
                    }
                    db = firebase.firestore();
                    usersCollection = db.collection('users');
                    sessionsCollection = db.collection('sessions');
                    commandsCollection = db.collection('commands');
                    purchasesCollection = db.collection('purchases');
                    firebaseReady = true;
                    resolve();
                } catch(e) { reject(e); }
            };
            firestoreScript.onerror = reject;
            document.head.appendChild(firestoreScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function sanitize(str) {
    if (!str) return '';
    return String(str).replace(/[<>]/g, '');
}

function showToast(msg, type) {
    if (!type) type = 'success';
    const box = document.getElementById('toast-box');
    if (!box) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<span>${sanitize(msg)}</span><span style="cursor:pointer;margin-left:10px;" onclick="this.parentElement.remove()">✕</span>`;
    box.appendChild(div);
    setTimeout(() => { if(div.parentElement) div.remove(); }, 3000);
}

// ============================================
// REALTIME LISTENERS (SYNC OTOMATIS)
// ============================================
function setupRealtimeListeners() {
    for(let i = 0; i < unsubscribeListeners.length; i++) {
        if(unsubscribeListeners[i]) unsubscribeListeners[i]();
    }
    unsubscribeListeners = [];
    
    if(!currentUser) return;
    
    if(currentUser.role === 'admin') {
        const usersUnsub = usersCollection.onSnapshot(() => {
            ui.renderAdminTable();
            ui.updateStats();
        });
        unsubscribeListeners.push(usersUnsub);
        
        const sessionsUnsub = sessionsCollection.onSnapshot(() => {
            ui.renderOnlinePlayers();
            ui.updateStats();
        });
        unsubscribeListeners.push(sessionsUnsub);
        
        const commandsUnsub = commandsCollection.onSnapshot(() => {
            ui.updateAdminBadge();
            const cmdPanel = document.getElementById('command-panel');
            if(cmdPanel && !cmdPanel.classList.contains('hidden')) {
                ui.renderCommandTable();
            }
            ui.updateStats();
        });
        unsubscribeListeners.push(commandsUnsub);
        
        const purchasesUnsub = purchasesCollection.onSnapshot(() => {
            const purchasePanel = document.getElementById('purchase-panel');
            if(purchasePanel && !purchasePanel.classList.contains('hidden')) {
                ui.renderPurchaseLog();
            }
            ui.updateStats();
        });
        unsubscribeListeners.push(purchasesUnsub);
    } else {
        const userUnsub = usersCollection.doc(currentUser.username).onSnapshot((doc) => {
            if(doc.exists) {
                const newData = doc.data();
                if(currentUser.coin !== newData.coin) {
                    currentUser.coin = newData.coin;
                    localStorage.setItem('duskveil_session', JSON.stringify({
                        username: currentUser.username,
                        role: currentUser.role,
                        coin: currentUser.coin
                    }));
                    ui.updateHeader();
                    showToast(`💰 Saldo diperbarui: ${newData.coin.toLocaleString()} koin`, 'info');
                }
            }
        });
        unsubscribeListeners.push(userUnsub);
    }
}

// ============================================
// UI FUNCTIONS
// ============================================
const ui = {
    switchTab: function(tab) {
        const loginForm = document.getElementById('form-login');
        const registerForm = document.getElementById('form-register');
        const btns = document.querySelectorAll('.tab-btn');
        
        if (tab === 'login') {
            if(loginForm) loginForm.classList.remove('hidden');
            if(registerForm) registerForm.classList.add('hidden');
            if(btns[0]) btns[0].classList.add('active');
            if(btns[1]) btns[1].classList.remove('active');
        } else {
            if(loginForm) loginForm.classList.add('hidden');
            if(registerForm) registerForm.classList.remove('hidden');
            if(btns[0]) btns[0].classList.remove('active');
            if(btns[1]) btns[1].classList.add('active');
        }
    },

    showPage: function(page) {
        const authSection = document.getElementById('auth-section');
        const navbar = document.getElementById('navbar');
        const storeSection = document.getElementById('store-section');
        const adminDashboard = document.getElementById('admin-dashboard');
        
        if (page === 'auth') {
            if(authSection) authSection.classList.remove('hidden');
            if(navbar) navbar.classList.add('hidden');
            if(storeSection) storeSection.classList.add('hidden');
            if(adminDashboard) adminDashboard.classList.add('hidden');
            const cmdPanel = document.getElementById('command-panel');
            const purchasePanel = document.getElementById('purchase-panel');
            if(cmdPanel) cmdPanel.classList.add('hidden');
            if(purchasePanel) purchasePanel.classList.add('hidden');
        } else {
            if(authSection) authSection.classList.add('hidden');
            if(navbar) navbar.classList.remove('hidden');
            
            if (currentUser) {
                const isAdmin = currentUser.role === 'admin';
                const adminNotice = document.getElementById('admin-notice');
                if(adminNotice) adminNotice.classList.toggle('hidden', !isAdmin);
                
                const commandsBtn = document.getElementById('nav-commands-btn');
                if(commandsBtn) commandsBtn.classList.toggle('hidden', !isAdmin);
                
                const purchasesBtn = document.getElementById('nav-purchases-btn');
                if(purchasesBtn) purchasesBtn.classList.toggle('hidden', !isAdmin);
                
                const adminBtn = document.getElementById('nav-admin-btn');
                if(adminBtn) adminBtn.classList.toggle('hidden', !isAdmin);
                
                if (isAdmin) {
                    if(adminDashboard) adminDashboard.classList.remove('hidden');
                    if(storeSection) storeSection.classList.add('hidden');
                    this.renderAdminTable();
                    this.updateStats();
                    this.renderOnlinePlayers();
                } else {
                    if(storeSection) storeSection.classList.remove('hidden');
                    if(adminDashboard) adminDashboard.classList.add('hidden');
                }
                this.updateHeader();
                this.updateAdminBadge();
            }
        }
    },

    updateHeader: function() {
        if (!currentUser) return;
        const usernameEl = document.getElementById('nav-username');
        const coinEl = document.getElementById('nav-coin');
        const avatarEl = document.getElementById('nav-avatar');
        if(usernameEl) usernameEl.innerText = sanitize(currentUser.username);
        if(coinEl) coinEl.innerText = (currentUser.coin || 0).toLocaleString();
        if(avatarEl) avatarEl.innerText = currentUser.username.charAt(0).toUpperCase();
    },

    updateAdminBadge: async function() {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        if(currentUser && currentUser.role === 'admin' && firebaseReady) {
            try {
                const snapshot = await commandsCollection.where('status', '==', 'pending').get();
                badge.textContent = snapshot.size;
                badge.style.display = snapshot.size > 0 ? 'inline-flex' : 'none';
            } catch(e) { console.error(e); }
        }
    },

    renderStore: function() {
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
        productsCache = products;

        const kontrakGrid = document.getElementById('grid-kontrak');
        if(kontrakGrid) {
            kontrakGrid.innerHTML = '';
            for(let i = 0; i < products.kontrak.length; i++) {
                const item = products.kontrak[i];
                kontrakGrid.innerHTML += `<div class="card">
                    <div class="card-img">📜</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Buku Kontrak</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="app.buyBook('${item.name}', ${item.price}, '${item.cmd}')">BELI SEKARANG</button>
                    </div>
                </div>`;
            }
        }

        const rankGrid = document.getElementById('grid-rank');
        if(rankGrid) {
            rankGrid.innerHTML = '';
            for(let i = 0; i < products.rank.length; i++) {
                const item = products.rank[i];
                rankGrid.innerHTML += `<div class="card">
                    <div class="card-img">👑</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Rank Server</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="app.buyRank('${item.name}', ${item.price}, '${item.cmd}')">BELI SEKARANG</button>
                    </div>
                </div>`;
            }
        }

        const skillGrid = document.getElementById('grid-skill');
        if(skillGrid) {
            skillGrid.innerHTML = '';
            for(let i = 0; i < products.skill.length; i++) {
                const item = products.skill[i];
                const onclickAttr = item.type === 'single' ? `app.showSkillSelection(${item.price})` : `app.buyAllSkills(${item.price})`;
                skillGrid.innerHTML += `<div class="card">
                    <div class="card-img">⚔️</div>
                    <div class="card-content">
                        <div class="card-title">${item.name}</div>
                        <div class="card-type">Skill</div>
                        <div class="card-price">${item.price.toLocaleString()} 🪙</div>
                        <button class="btn-buy" onclick="${onclickAttr}">BELI SEKARANG</button>
                    </div>
                </div>`;
            }
        }
    },

    renderAdminTable: async function() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        if(!firebaseReady) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat...</td></tr>';
            return;
        }
        
        try {
            const snapshot = await usersCollection.get();
            const users = [];
            snapshot.forEach(doc => users.push(doc.data()));
            
            if(users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada member</td></tr>';
                return;
            }
            
            let html = '';
            for(let i = 0; i < users.length; i++) {
                const u = users[i];
                html += `<tr>
                    <td>${sanitize(u.username)}</td>
                    <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                    <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                    <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                    <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${sanitize(u.username)}', ${u.coin || 0})">Edit</button></td>
                </tr>`;
            }
            tbody.innerHTML = html;
        } catch(e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Error loading data</td></tr>';
        }
    },

    updateStats: async function() {
        if(!firebaseReady) return;
        try {
            const usersSnapshot = await usersCollection.get();
            let totalCoin = 0;
            let userCount = 0;
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                userCount++;
                totalCoin += (data.coin || 0);
            });
            
            const purchasesSnapshot = await purchasesCollection.get();
            const commandsSnapshot = await commandsCollection.where('status', '==', 'pending').get();
            
            const totalUsersEl = document.getElementById('stat-total-users');
            const totalCoinEl = document.getElementById('stat-total-coins');
            const totalPurchasesEl = document.getElementById('stat-total-purchases');
            const pendingCommandsEl = document.getElementById('stat-pending-commands');
            
            if(totalUsersEl) totalUsersEl.textContent = userCount;
            if(totalCoinEl) totalCoinEl.textContent = totalCoin.toLocaleString();
            if(totalPurchasesEl) totalPurchasesEl.textContent = purchasesSnapshot.size;
            if(pendingCommandsEl) pendingCommandsEl.textContent = commandsSnapshot.size;
        } catch(e) { console.error(e); }
    },

    renderOnlinePlayers: async function() {
        const container = document.getElementById('online-players-list');
        const countEl = document.getElementById('online-count');
        if (!container) return;
        if(!firebaseReady) {
            container.innerHTML = '<div style="color:var(--text3);padding:8px 0;">Memuat...</div>';
            return;
        }
        
        try {
            const cutoff = Date.now() - 30000;
            const snapshot = await sessionsCollection.get();
            const online = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if(data.lastSeen > cutoff) online.push(data);
            });
            
            if(countEl) countEl.textContent = online.length;
            
            if(online.length === 0) {
                container.innerHTML = '<div style="color:var(--text3);padding:8px 0;">Tidak ada user online</div>';
                return;
            }
            
            let html = '';
            for(let i = 0; i < online.length; i++) {
                const s = online[i];
                html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border);">
                    <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
                    <span style="flex:1;">${sanitize(s.username)}</span>
                    <span style="font-size:0.75rem;color:var(--text3);">${s.role}</span>
                </div>`;
            }
            container.innerHTML = html;
        } catch(e) { console.error(e); }
    },

    renderCommandTable: async function() {
        const tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        if(!firebaseReady) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat...</td></tr>';
            return;
        }
        
        try {
            const snapshot = await commandsCollection.orderBy('timestamp', 'desc').limit(100).get();
            const commands = [];
            snapshot.forEach(doc => commands.push({ id: doc.id, ...doc.data() }));
            
            if(commands.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada command</td></tr>';
                return;
            }
            
            let html = '';
            for(let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                const statusClass = cmd.status === 'pending' ? 'status-pending' : 'status-executed';
                const statusText = cmd.status === 'pending' ? '⏳ Pending' : '✅ Executed';
                const actions = cmd.status === 'pending' 
                    ? `<button class="btn-execute" onclick="app.markExecuted('${cmd.id}')">✓ Tandai Selesai</button>`
                    : `<button class="btn-copy" onclick="app.deleteCommand('${cmd.id}')">🗑 Hapus</button>`;
                const timeStr = cmd.timestamp ? new Date(cmd.timestamp.toDate()).toLocaleString() : '-';
                html += `<tr>
                    <td style="font-size:0.75rem;">${timeStr}</td>
                    <td><code style="background:#1a1a2a;padding:4px 8px;border-radius:4px;">${sanitize(cmd.command)}</code><br><small>👤 ${sanitize(cmd.username)}</small></td>
                    <td><span class="command-status ${statusClass}">${statusText}</span></td>
                    <td>${actions}</td>
                </tr>`;
            }
            tbody.innerHTML = html;
        } catch(e) { console.error(e); }
    },

    renderPurchaseLog: async function() {
        const tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        if(!firebaseReady) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat...</td></tr>';
            return;
        }
        
        try {
            const snapshot = await purchasesCollection.orderBy('timestamp', 'desc').limit(50).get();
            const purchases = [];
            snapshot.forEach(doc => purchases.push(doc.data()));
            
            if(purchases.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada pembelian</td></tr>';
                return;
            }
            
            let html = '';
            for(let i = 0; i < purchases.length; i++) {
                const p = purchases[i];
                const statusClass = p.status === 'pending' ? 'status-pending' : 'status-executed';
                const statusText = p.status === 'pending' ? '⏳ Pending' : '✅ Selesai';
                const timeStr = p.timestamp ? new Date(p.timestamp.toDate()).toLocaleString() : '-';
                html += `<tr>
                    <td style="font-size:0.75rem;">${timeStr}</td>
                    <td>${sanitize(p.username)}</td>
                    <td>${sanitize(p.itemName)}</td>
                    <td style="color:var(--gold);">${(p.price || 0).toLocaleString()} 🪙</td>
                    <td><span class="command-status ${statusClass}">${statusText}</span></td>
                </tr>`;
            }
            tbody.innerHTML = html;
        } catch(e) { console.error(e); }
    },

    showCommandPanel: function() {
        const store = document.getElementById('store-section');
        const admin = document.getElementById('admin-dashboard');
        const purchase = document.getElementById('purchase-panel');
        const command = document.getElementById('command-panel');
        if(store) store.classList.add('hidden');
        if(admin) admin.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(command) command.classList.remove('hidden');
        this.renderCommandTable();
    },

    showPurchasePanel: function() {
        const store = document.getElementById('store-section');
        const admin = document.getElementById('admin-dashboard');
        const command = document.getElementById('command-panel');
        const purchase = document.getElementById('purchase-panel');
        if(store) store.classList.add('hidden');
        if(admin) admin.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.remove('hidden');
        this.renderPurchaseLog();
    },

    showAdminPanel: function() {
        const store = document.getElementById('store-section');
        const command = document.getElementById('command-panel');
        const purchase = document.getElementById('purchase-panel');
        const admin = document.getElementById('admin-dashboard');
        if(store) store.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(admin) admin.classList.remove('hidden');
        this.renderAdminTable();
        this.updateStats();
        this.renderOnlinePlayers();
    },

    showStorePanel: function() {
        const admin = document.getElementById('admin-dashboard');
        const command = document.getElementById('command-panel');
        const purchase = document.getElementById('purchase-panel');
        const store = document.getElementById('store-section');
        if(admin) admin.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(store) store.classList.remove('hidden');
    },

    showSkillModal: function(price, callback) {
        const modal = document.getElementById('skill-modal');
        const container = document.getElementById('skill-list-container');
        if (!container) return;
        
        const skillsList = [
            { name: 'Penambangan', id: 'mining' },
            { name: 'Pertanian', id: 'farming' },
            { name: 'Pertarungan', id: 'combat' },
            { name: 'Pemanenan Kayu', id: 'woodcutting' },
            { name: 'Memancing', id: 'fishing' },
            { name: 'Bertahan Hidup', id: 'survival' },
            { name: 'Sihir', id: 'magic' }
        ];
        
        container.innerHTML = '';
        for(let i = 0; i < skillsList.length; i++) {
            const skill = skillsList[i];
            const div = document.createElement('div');
            div.className = 'skill-option';
            div.innerHTML = `<span>⚔️ ${skill.name}</span><span style="color:var(--gold);">${price.toLocaleString()} 🪙</span>`;
            div.onclick = ((skillName) => {
                return () => {
                    ui.closeSkillModal();
                    callback(skillName, price);
                };
            })(skill.name);
            container.appendChild(div);
        }
        if(modal) modal.classList.remove('hidden');
    },

    closeSkillModal: function() {
        const modal = document.getElementById('skill-modal');
        if(modal) modal.classList.add('hidden');
    }
};

// ============================================
// APP FUNCTIONS
// ============================================
const app = {
    init: async function() {
        const overlay = document.getElementById('loading-overlay');
        
        try {
            await loadFirebase();
            
            if(overlay) overlay.style.display = 'none';
            
            // Create default admin
            const adminDoc = await usersCollection.doc('admin').get();
            if(!adminDoc.exists) {
                await usersCollection.doc('admin').set({
                    username: 'admin',
                    password: 'dusk@gnt3ng303#',
                    role: 'admin',
                    coin: 999999,
                    createdAt: new Date().toISOString()
                });
                console.log('Admin created');
            }
            
            ui.renderStore();
            
            const savedSession = localStorage.getItem('duskveil_session');
            if(savedSession) {
                try {
                    const userData = JSON.parse(savedSession);
                    const userDoc = await usersCollection.doc(userData.username).get();
                    if(userDoc.exists) {
                        currentUser = userDoc.data();
                        await sessionsCollection.doc(currentUser.username).set({
                            username: currentUser.username,
                            role: currentUser.role,
                            lastSeen: Date.now(),
                            loginAt: Date.now()
                        });
                        setupRealtimeListeners();
                        ui.showPage('store');
                        ui.updateHeader();
                        ui.updateAdminBadge();
                        this.startHeartbeat();
                    } else {
                        localStorage.removeItem('duskveil_session');
                        ui.showPage('auth');
                    }
                } catch(e) {
                    localStorage.removeItem('duskveil_session');
                    ui.showPage('auth');
                }
            } else {
                ui.showPage('auth');
            }
            
            this.initParticles();
        } catch(e) {
            console.error('Init error:', e);
            if(overlay) overlay.style.display = 'none';
            showToast('Error: ' + e.message, 'error');
            ui.showPage('auth');
        }
    },

    initParticles: function() {
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

    startHeartbeat: function() {
        setInterval(() => {
            if(currentUser && firebaseReady) {
                sessionsCollection.doc(currentUser.username).update({
                    lastSeen: Date.now()
                }).catch(() => {});
            }
        }, 10000);
    },

    handleLogin: async function(e) {
        e.preventDefault();
        
        if(!firebaseReady) {
            showToast('Sistem masih memuat, tunggu sebentar...', 'error');
            return;
        }
        
        const username = document.getElementById('login-user').value.trim();
        const password = document.getElementById('login-pass').value;
        const btn = document.getElementById('login-btn');
        
        if (!username || !password) {
            showToast('Isi username dan password!', 'error');
            return;
        }
        
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        try {
            const userDoc = await usersCollection.doc(username).get();
            if(!userDoc.exists) {
                showToast('Username tidak ditemukan!', 'error');
                return;
            }
            
            const user = userDoc.data();
            if(user.password !== password) {
                showToast('Password salah!', 'error');
                return;
            }
            
            currentUser = user;
            localStorage.setItem('duskveil_session', JSON.stringify({
                username: user.username,
                role: user.role,
                coin: user.coin
            }));
            
            await sessionsCollection.doc(username).set({
                username: username,
                role: user.role,
                lastSeen: Date.now(),
                loginAt: Date.now()
            });
            
            setupRealtimeListeners();
            showToast(`Selamat datang, ${sanitize(username)}!`, 'success');
            ui.updateHeader();
            ui.showPage('store');
            ui.updateAdminBadge();
            this.startHeartbeat();
            
            document.getElementById('login-user').value = '';
            document.getElementById('login-pass').value = '';
            
        } catch(err) {
            showToast('Login gagal: ' + err.message, 'error');
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
            }
        }
    },

    handleRegister: async function(e) {
        e.preventDefault();
        
        if(!firebaseReady) {
            showToast('Sistem masih memuat, tunggu sebentar...', 'error');
            return;
        }
        
        const username = document.getElementById('reg-user').value.trim();
        const password = document.getElementById('reg-pass').value;
        const confirmPass = document.getElementById('reg-pass-confirm').value;
        const btn = document.getElementById('register-btn');
        
        if (!username || !password || !confirmPass) {
            showToast('Isi semua field!', 'error');
            return;
        }
        if (password !== confirmPass) {
            showToast('Password tidak cocok!', 'error');
            return;
        }
        if (username.length < 3 || username.length > 16) {
            showToast('Username 3-16 karakter!', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('Password minimal 6 karakter!', 'error');
            return;
        }
        if(username === 'admin') {
            showToast('Username tidak tersedia!', 'error');
            return;
        }
        
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        try {
            const userDoc = await usersCollection.doc(username).get();
            if(userDoc.exists) {
                showToast('Username sudah digunakan!', 'error');
                return;
            }
            
            await usersCollection.doc(username).set({
                username: username,
                password: password,
                role: 'member',
                coin: 1000,
                createdAt: new Date().toISOString()
            });
            
            showToast('Registrasi berhasil! Silakan login.', 'success');
            ui.switchTab('login');
            document.getElementById('login-user').value = username;
            
            document.getElementById('reg-user').value = '';
            document.getElementById('reg-pass').value = '';
            document.getElementById('reg-pass-confirm').value = '';
            
        } catch(err) {
            showToast('Registrasi gagal: ' + err.message, 'error');
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="btn-text">DAFTAR SEKARANG</span><span class="btn-arrow">→</span>';
            }
        }
    },

    logout: async function() {
        if(currentUser && firebaseReady) {
            try {
                await sessionsCollection.doc(currentUser.username).delete();
            } catch(e) {}
        }
        for(let i = 0; i < unsubscribeListeners.length; i++) {
            if(unsubscribeListeners[i]) unsubscribeListeners[i]();
        }
        unsubscribeListeners = [];
        currentUser = null;
        localStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        showToast('Anda telah keluar.');
    },

    buyBook: async function(itemName, price, cmd) {
        if (!firebaseReady) { showToast('Sistem masih memuat...', 'error'); return; }
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;
        
        try {
            const newCoin = (currentUser.coin || 0) - price;
            await usersCollection.doc(currentUser.username).update({ coin: newCoin });
            currentUser.coin = newCoin;
            localStorage.setItem('duskveil_session', JSON.stringify({
                username: currentUser.username,
                role: currentUser.role,
                coin: currentUser.coin
            }));
            ui.updateHeader();
            
            await commandsCollection.add({
                command: `ksl give ${currentUser.username} ${cmd}`,
                username: currentUser.username,
                itemName: itemName,
                status: 'pending',
                timestamp: new Date()
            });
            
            await purchasesCollection.add({
                username: currentUser.username,
                itemName: itemName,
                price: price,
                status: 'pending',
                timestamp: new Date()
            });
            
            showToast(`✅ ${itemName} berhasil dibeli!`, 'success');
            ui.updateAdminBadge();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    buyRank: async function(rankName, price, rankId) {
        if (!firebaseReady) { showToast('Sistem masih memuat...', 'error'); return; }
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;
        
        try {
            const newCoin = (currentUser.coin || 0) - price;
            await usersCollection.doc(currentUser.username).update({ coin: newCoin });
            currentUser.coin = newCoin;
            localStorage.setItem('duskveil_session', JSON.stringify({
                username: currentUser.username,
                role: currentUser.role,
                coin: currentUser.coin
            }));
            ui.updateHeader();
            
            const commandsList = [
                `lp user ${currentUser.username} parent set ${rankId.toLowerCase()}`,
                `pex user ${currentUser.username} group set ${rankId.toLowerCase()}`,
                `manuadd ${currentUser.username} ${rankName}`,
                `group addplayer ${currentUser.username} ${rankId.toLowerCase()}`
            ];
            
            for(let i = 0; i < commandsList.length; i++) {
                await commandsCollection.add({
                    command: commandsList[i],
                    username: currentUser.username,
                    itemName: `Rank: ${rankName}`,
                    status: 'pending',
                    timestamp: new Date()
                });
            }
            
            await purchasesCollection.add({
                username: currentUser.username,
                itemName: `Rank: ${rankName}`,
                price: price,
                status: 'pending',
                timestamp: new Date()
            });
            
            showToast(`✅ Rank ${rankName} berhasil dibeli!`, 'success');
            ui.updateAdminBadge();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    showSkillSelection: function(price) {
        if (!firebaseReady) { showToast('Sistem masih memuat...', 'error'); return; }
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => {
            app.upgradeSkill(skillName, actualPrice);
        });
    },

    upgradeSkill: async function(skillName, price) {
        if (!firebaseReady) return;
        if (!currentUser) return;
        const level = prompt(`Level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;
        
        try {
            const newCoin = (currentUser.coin || 0) - price;
            await usersCollection.doc(currentUser.username).update({ coin: newCoin });
            currentUser.coin = newCoin;
            localStorage.setItem('duskveil_session', JSON.stringify({
                username: currentUser.username,
                role: currentUser.role,
                coin: currentUser.coin
            }));
            ui.updateHeader();
            
            const skillId = skillName.toLowerCase().replace(/ /g, '');
            await commandsCollection.add({
                command: `skill setlevel ${currentUser.username} ${skillId} ${level}`,
                username: currentUser.username,
                itemName: `Skill: ${skillName} → Lv.${level}`,
                status: 'pending',
                timestamp: new Date()
            });
            
            await purchasesCollection.add({
                username: currentUser.username,
                itemName: `Skill: ${skillName} → Lv.${level}`,
                price: price,
                status: 'pending',
                timestamp: new Date()
            });
            
            showToast(`✅ Skill ${skillName} diupgrade ke level ${level}!`, 'success');
            ui.updateAdminBadge();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    buyAllSkills: async function(price) {
        if (!firebaseReady) { showToast('Sistem masih memuat...', 'error'); return; }
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;
        
        try {
            const newCoin = (currentUser.coin || 0) - price;
            await usersCollection.doc(currentUser.username).update({ coin: newCoin });
            currentUser.coin = newCoin;
            localStorage.setItem('duskveil_session', JSON.stringify({
                username: currentUser.username,
                role: currentUser.role,
                coin: currentUser.coin
            }));
            ui.updateHeader();
            
            await commandsCollection.add({
                command: `skill setall ${currentUser.username} ${maxLevel}`,
                username: currentUser.username,
                itemName: `All Skills → Lv.${maxLevel}`,
                status: 'pending',
                timestamp: new Date()
            });
            
            await purchasesCollection.add({
                username: currentUser.username,
                itemName: `All Skills → Lv.${maxLevel}`,
                price: price,
                status: 'pending',
                timestamp: new Date()
            });
            
            showToast(`✅ Semua skill diset ke level ${maxLevel}!`, 'success');
            ui.updateAdminBadge();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    markExecuted: async function(id) {
        if(!firebaseReady) return;
        try {
            await commandsCollection.doc(id).update({ status: 'executed' });
            ui.renderCommandTable();
            ui.updateAdminBadge();
            showToast('Command ditandai selesai!', 'success');
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    deleteCommand: async function(id) {
        if(!firebaseReady) return;
        if (!confirm('Hapus command ini?')) return;
        try {
            await commandsCollection.doc(id).delete();
            ui.renderCommandTable();
            ui.updateAdminBadge();
            showToast('Command dihapus!', 'success');
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    executeAllCommands: async function() {
        if(!firebaseReady) return;
        try {
            const snapshot = await commandsCollection.where('status', '==', 'pending').get();
            const commands = [];
            snapshot.forEach(doc => commands.push({ id: doc.id, command: doc.data().command }));
            
            if(commands.length === 0) {
                showToast('Tidak ada command pending!', 'error');
                return;
            }
            
            let commandsText = '';
            for(let i = 0; i < commands.length; i++) {
                commandsText += commands[i].command + '\n';
            }
            await navigator.clipboard.writeText(commandsText);
            
            for(let i = 0; i < commands.length; i++) {
                await commandsCollection.doc(commands[i].id).update({ status: 'executed' });
            }
            
            showToast(`${commands.length} command sudah di-copy! Paste di console server.`, 'success');
            ui.updateAdminBadge();
            ui.renderCommandTable();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    copyAllCommands: async function() {
        if(!firebaseReady) return;
        try {
            const snapshot = await commandsCollection.where('status', '==', 'pending').get();
            const commands = [];
            snapshot.forEach(doc => commands.push(doc.data().command));
            
            if(commands.length === 0) {
                showToast('Tidak ada command!', 'error');
                return;
            }
            
            const commandsText = commands.join('\n');
            await navigator.clipboard.writeText(commandsText);
            showToast(`${commands.length} command di-copy!`, 'success');
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    exportCommands: async function() {
        if(!firebaseReady) return;
        try {
            const snapshot = await commandsCollection.get();
            const commands = [];
            snapshot.forEach(doc => commands.push({ id: doc.id, ...doc.data() }));
            
            const data = JSON.stringify(commands, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `commands_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Commands exported!', 'success');
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    clearAllCommands: async function() {
        if(!firebaseReady) return;
        if (!confirm('Hapus SEMUA command?')) return;
        try {
            const snapshot = await commandsCollection.get();
            for(let i = 0; i < snapshot.docs.length; i++) {
                await commandsCollection.doc(snapshot.docs[i].id).delete();
            }
            showToast('Semua command dihapus!', 'success');
            ui.updateAdminBadge();
            ui.renderCommandTable();
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    exportAllData: async function() {
        if(!firebaseReady) return;
        try {
            const usersSnapshot = await usersCollection.get();
            const users = [];
            usersSnapshot.forEach(doc => users.push(doc.data()));
            
            const purchasesSnapshot = await purchasesCollection.get();
            const purchases = [];
            purchasesSnapshot.forEach(doc => purchases.push(doc.data()));
            
            const commandsSnapshot = await commandsCollection.get();
            const commands = [];
            commandsSnapshot.forEach(doc => commands.push(doc.data()));
            
            const data = JSON.stringify({ users, purchases, commands }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Data exported!', 'success');
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    },

    fillAdmin: function(username, coin) {
        const searchInput = document.getElementById('admin-search');
        const coinInput = document.getElementById('admin-coin');
        if(searchInput) searchInput.value = username;
        if(coinInput) coinInput.value = coin;
    },

    adminSetCoin: async function() {
        if(!firebaseReady) {
            showToast('Sistem masih memuat...', 'error');
            return;
        }
        
        const username = document.getElementById('admin-search')?.value.trim();
        const coinValue = document.getElementById('admin-coin')?.value;
        
        if (!username) {
            showToast('Masukkan username!', 'error');
            return;
        }
        if (!coinValue || isNaN(coinValue) || parseInt(coinValue) < 0) {
            showToast('Masukkan jumlah koin yang valid!', 'error');
            return;
        }
        
        try {
            const userDoc = await usersCollection.doc(username).get();
            if(!userDoc.exists) {
                showToast('User tidak ditemukan!', 'error');
                return;
            }
            
            await usersCollection.doc(username).update({ coin: parseInt(coinValue) });
            showToast(`✅ Koin ${sanitize(username)} → ${parseInt(coinValue).toLocaleString()}`, 'success');
            
            if(currentUser && currentUser.username === username) {
                currentUser.coin = parseInt(coinValue);
                localStorage.setItem('duskveil_session', JSON.stringify({
                    username: currentUser.username,
                    role: currentUser.role,
                    coin: currentUser.coin
                }));
                ui.updateHeader();
            }
            
            ui.renderAdminTable();
            document.getElementById('admin-coin').value = '';
        } catch(err) {
            showToast('Gagal: ' + err.message, 'error');
        }
    }
};

// Make global
window.app = app;
window.ui = ui;

// Start app
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
