// ============================================
// DuskVeilSMP - SIMPLE STORAGE (Tanpa Firebase)
// ============================================

// Data Storage
let users = {};
let commands = [];
let purchases = [];
let currentUser = null;
let syncChannel = null;

// ============================================
// INIT DATA
// ============================================
function loadData() {
    // Load users
    const savedUsers = localStorage.getItem('duskveil_users');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        users = {
            'admin': {
                username: 'admin',
                password: 'dusk@gnt3ng303#',
                role: 'admin',
                coin: 999999,
                createdAt: new Date().toISOString()
            }
        };
        localStorage.setItem('duskveil_users', JSON.stringify(users));
    }
    
    // Load commands
    const savedCommands = localStorage.getItem('duskveil_commands');
    if (savedCommands) {
        commands = JSON.parse(savedCommands);
    } else {
        commands = [];
        localStorage.setItem('duskveil_commands', JSON.stringify(commands));
    }
    
    // Load purchases
    const savedPurchases = localStorage.getItem('duskveil_purchases');
    if (savedPurchases) {
        purchases = JSON.parse(savedPurchases);
    } else {
        purchases = [];
        localStorage.setItem('duskveil_purchases', JSON.stringify(purchases));
    }
}

function saveUsers() {
    localStorage.setItem('duskveil_users', JSON.stringify(users));
    // Broadcast perubahan ke tab lain
    broadcastChange({ type: 'users', data: users });
}

function saveCommands() {
    localStorage.setItem('duskveil_commands', JSON.stringify(commands));
    broadcastChange({ type: 'commands', data: commands });
}

function savePurchases() {
    localStorage.setItem('duskveil_purchases', JSON.stringify(purchases));
    broadcastChange({ type: 'purchases', data: purchases });
}

// ============================================
// BROADCAST CHANNEL (Sinkron antar tab)
// ============================================
function initBroadcastChannel() {
    if (window.BroadcastChannel) {
        syncChannel = new BroadcastChannel('duskveil_sync');
        syncChannel.onmessage = function(event) {
            var data = event.data;
            if (data.type === 'users') {
                users = data.data;
                if (currentUser && currentUser.role === 'admin') {
                    ui.renderAdminTable();
                    ui.updateStats();
                }
                // Update current user coin if needed
                if (currentUser && users[currentUser.username]) {
                    var newCoin = users[currentUser.username].coin;
                    if (currentUser.coin !== newCoin) {
                        currentUser.coin = newCoin;
                        sessionStorage.setItem('duskveil_session', JSON.stringify(currentUser));
                        ui.updateHeader();
                        showToast('💰 Saldo diperbarui: ' + newCoin.toLocaleString() + ' koin', 'info');
                    }
                }
            }
            if (data.type === 'commands') {
                commands = data.data;
                if (currentUser && currentUser.role === 'admin') {
                    ui.updateAdminBadge();
                    var cmdPanel = document.getElementById('command-panel');
                    if (cmdPanel && !cmdPanel.classList.contains('hidden')) {
                        ui.renderCommandTable();
                    }
                    ui.updateStats();
                }
            }
            if (data.type === 'purchases') {
                purchases = data.data;
                if (currentUser && currentUser.role === 'admin') {
                    var purchasePanel = document.getElementById('purchase-panel');
                    if (purchasePanel && !purchasePanel.classList.contains('hidden')) {
                        ui.renderPurchaseLog();
                    }
                    ui.updateStats();
                }
            }
        };
    }
}

function broadcastChange(data) {
    if (syncChannel) {
        syncChannel.postMessage(data);
    }
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
    var box = document.getElementById('toast-box');
    if (!box) return;
    var div = document.createElement('div');
    div.className = 'toast ' + type;
    div.innerHTML = '<span>' + sanitize(msg) + '</span><span style="cursor:pointer;margin-left:10px;" onclick="this.parentElement.remove()">✕</span>';
    box.appendChild(div);
    setTimeout(function() { if(div.parentElement) div.remove(); }, 3000);
}

// ============================================
// UI FUNCTIONS
// ============================================
var ui = {
    switchTab: function(tab) {
        var loginForm = document.getElementById('form-login');
        var registerForm = document.getElementById('form-register');
        var btns = document.querySelectorAll('.tab-btn');
        
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
        var authSection = document.getElementById('auth-section');
        var navbar = document.getElementById('navbar');
        var storeSection = document.getElementById('store-section');
        var adminDashboard = document.getElementById('admin-dashboard');
        var cmdPanel = document.getElementById('command-panel');
        var purchasePanel = document.getElementById('purchase-panel');
        
        if (page === 'auth') {
            if(authSection) authSection.classList.remove('hidden');
            if(navbar) navbar.classList.add('hidden');
            if(storeSection) storeSection.classList.add('hidden');
            if(adminDashboard) adminDashboard.classList.add('hidden');
            if(cmdPanel) cmdPanel.classList.add('hidden');
            if(purchasePanel) purchasePanel.classList.add('hidden');
        } else {
            if(authSection) authSection.classList.add('hidden');
            if(navbar) navbar.classList.remove('hidden');
            
            if (currentUser) {
                var isAdmin = currentUser.role === 'admin';
                var adminNotice = document.getElementById('admin-notice');
                if(adminNotice) adminNotice.classList.toggle('hidden', !isAdmin);
                
                var commandsBtn = document.getElementById('nav-commands-btn');
                if(commandsBtn) commandsBtn.classList.toggle('hidden', !isAdmin);
                
                var purchasesBtn = document.getElementById('nav-purchases-btn');
                if(purchasesBtn) purchasesBtn.classList.toggle('hidden', !isAdmin);
                
                var adminBtn = document.getElementById('nav-admin-btn');
                if(adminBtn) adminBtn.classList.toggle('hidden', !isAdmin);
                
                if (isAdmin) {
                    if(adminDashboard) adminDashboard.classList.remove('hidden');
                    if(storeSection) storeSection.classList.add('hidden');
                    this.renderAdminTable();
                    this.updateStats();
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
        var usernameEl = document.getElementById('nav-username');
        var coinEl = document.getElementById('nav-coin');
        var avatarEl = document.getElementById('nav-avatar');
        if(usernameEl) usernameEl.innerText = sanitize(currentUser.username);
        if(coinEl) coinEl.innerText = (currentUser.coin || 0).toLocaleString();
        if(avatarEl) avatarEl.innerText = currentUser.username.charAt(0).toUpperCase();
    },

    updateAdminBadge: function() {
        var badge = document.getElementById('pending-badge');
        if (!badge) return;
        if(currentUser && currentUser.role === 'admin') {
            var pending = commands.filter(function(c) { return c.status === 'pending'; });
            var count = pending.length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    },

    renderStore: function() {
        var products = {
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

        var kontrakGrid = document.getElementById('grid-kontrak');
        if(kontrakGrid) {
            kontrakGrid.innerHTML = '';
            for(var i = 0; i < products.kontrak.length; i++) {
                var item = products.kontrak[i];
                kontrakGrid.innerHTML += '<div class="card">' +
                    '<div class="card-img">📜</div>' +
                    '<div class="card-content">' +
                    '<div class="card-title">' + item.name + '</div>' +
                    '<div class="card-type">Buku Kontrak</div>' +
                    '<div class="card-price">' + item.price.toLocaleString() + ' 🪙</div>' +
                    '<button class="btn-buy" onclick="app.buyBook(\'' + item.name + '\', ' + item.price + ', \'' + item.cmd + '\')">BELI SEKARANG</button>' +
                    '</div></div>';
            }
        }

        var rankGrid = document.getElementById('grid-rank');
        if(rankGrid) {
            rankGrid.innerHTML = '';
            for(var j = 0; j < products.rank.length; j++) {
                var item = products.rank[j];
                rankGrid.innerHTML += '<div class="card">' +
                    '<div class="card-img">👑</div>' +
                    '<div class="card-content">' +
                    '<div class="card-title">' + item.name + '</div>' +
                    '<div class="card-type">Rank Server</div>' +
                    '<div class="card-price">' + item.price.toLocaleString() + ' 🪙</div>' +
                    '<button class="btn-buy" onclick="app.buyRank(\'' + item.name + '\', ' + item.price + ', \'' + item.cmd + '\')">BELI SEKARANG</button>' +
                    '</div></div>';
            }
        }

        var skillGrid = document.getElementById('grid-skill');
        if(skillGrid) {
            skillGrid.innerHTML = '';
            for(var k = 0; k < products.skill.length; k++) {
                var item = products.skill[k];
                var onclickAttr = item.type === 'single' ? 'app.showSkillSelection(' + item.price + ')' : 'app.buyAllSkills(' + item.price + ')';
                skillGrid.innerHTML += '<div class="card">' +
                    '<div class="card-img">⚔️</div>' +
                    '<div class="card-content">' +
                    '<div class="card-title">' + item.name + '</div>' +
                    '<div class="card-type">Skill</div>' +
                    '<div class="card-price">' + item.price.toLocaleString() + ' 🪙</div>' +
                    '<button class="btn-buy" onclick="' + onclickAttr + '">BELI SEKARANG</button>' +
                    '</div></div>';
            }
        }
    },

    renderAdminTable: function() {
        var tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        
        var userList = Object.values(users);
        if (userList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada member</td></tr>';
            return;
        }
        
        var html = '';
        for(var i = 0; i < userList.length; i++) {
            var u = userList[i];
            html += '<tr>' +
                '<td>' + sanitize(u.username) + '</td>' +
                '<td><span class="status-badge ' + (u.role === 'admin' ? 'status-admin' : 'status-member') + '">' + u.role.toUpperCase() + '</span></td>' +
                '<td style="color:var(--gold);">' + (u.coin || 0).toLocaleString() + '</td>' +
                '<td>' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-') + '</td>' +
                '<td><button class="btn-tbl-edit" onclick="app.fillAdmin(\'' + sanitize(u.username) + '\', ' + (u.coin || 0) + ')">Edit</button></td>' +
                '</tr>';
        }
        tbody.innerHTML = html;
    },

    updateStats: function() {
        var userList = Object.values(users);
        var totalCoin = 0;
        for(var i = 0; i < userList.length; i++) {
            totalCoin += (userList[i].coin || 0);
        }
        var pending = commands.filter(function(c) { return c.status === 'pending'; });
        
        var totalUsersEl = document.getElementById('stat-total-users');
        var totalCoinEl = document.getElementById('stat-total-coins');
        var totalPurchasesEl = document.getElementById('stat-total-purchases');
        var pendingCommandsEl = document.getElementById('stat-pending-commands');
        
        if(totalUsersEl) totalUsersEl.textContent = userList.length;
        if(totalCoinEl) totalCoinEl.textContent = totalCoin.toLocaleString();
        if(totalPurchasesEl) totalPurchasesEl.textContent = purchases.length;
        if(pendingCommandsEl) pendingCommandsEl.textContent = pending.length;
    },

    renderCommandTable: function() {
        var tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        
        if (commands.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada command</td></tr>';
            return;
        }
        
        var html = '';
        for(var i = 0; i < commands.length; i++) {
            var cmd = commands[i];
            var statusClass = cmd.status === 'pending' ? 'status-pending' : 'status-executed';
            var statusText = cmd.status === 'pending' ? '⏳ Pending' : '✅ Executed';
            var actions = cmd.status === 'pending' 
                ? '<button class="btn-execute" onclick="app.markExecuted(\'' + cmd.id + '\')">✓ Tandai Selesai</button>'
                : '<button class="btn-copy" onclick="app.deleteCommand(\'' + cmd.id + '\')">🗑 Hapus</button>';
            var timeStr = cmd.timestamp ? new Date(cmd.timestamp).toLocaleString() : '-';
            html += '<tr>' +
                '<td style="font-size:0.75rem;">' + timeStr + '</td>' +
                '<td><code style="background:#1a1a2a;padding:4px 8px;border-radius:4px;">' + sanitize(cmd.command) + '</code><br><small>👤 ' + sanitize(cmd.username) + '</small></td>' +
                '<td><span class="command-status ' + statusClass + '">' + statusText + '</span></td>' +
                '<td>' + actions + '</td>' +
                '</tr>';
        }
        tbody.innerHTML = html;
    },

    renderPurchaseLog: function() {
        var tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        
        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada pembelian</td></tr>';
            return;
        }
        
        var html = '';
        for(var i = 0; i < purchases.length; i++) {
            var p = purchases[i];
            var statusClass = p.status === 'pending' ? 'status-pending' : 'status-executed';
            var statusText = p.status === 'pending' ? '⏳ Pending' : '✅ Selesai';
            var timeStr = p.timestamp ? new Date(p.timestamp).toLocaleString() : '-';
            html += '<tr>' +
                '<td style="font-size:0.75rem;">' + timeStr + '</td>' +
                '<td>' + sanitize(p.username) + '</td>' +
                '<td>' + sanitize(p.itemName) + '</td>' +
                '<td style="color:var(--gold);">' + (p.price || 0).toLocaleString() + ' 🪙</td>' +
                '<td><span class="command-status ' + statusClass + '">' + statusText + '</span></td>' +
                '</tr>';
        }
        tbody.innerHTML = html;
    },

    showCommandPanel: function() {
        var store = document.getElementById('store-section');
        var admin = document.getElementById('admin-dashboard');
        var purchase = document.getElementById('purchase-panel');
        var command = document.getElementById('command-panel');
        if(store) store.classList.add('hidden');
        if(admin) admin.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(command) command.classList.remove('hidden');
        this.renderCommandTable();
    },

    showPurchasePanel: function() {
        var store = document.getElementById('store-section');
        var admin = document.getElementById('admin-dashboard');
        var command = document.getElementById('command-panel');
        var purchase = document.getElementById('purchase-panel');
        if(store) store.classList.add('hidden');
        if(admin) admin.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.remove('hidden');
        this.renderPurchaseLog();
    },

    showAdminPanel: function() {
        var store = document.getElementById('store-section');
        var command = document.getElementById('command-panel');
        var purchase = document.getElementById('purchase-panel');
        var admin = document.getElementById('admin-dashboard');
        if(store) store.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(admin) admin.classList.remove('hidden');
        this.renderAdminTable();
        this.updateStats();
    },

    showStorePanel: function() {
        var admin = document.getElementById('admin-dashboard');
        var command = document.getElementById('command-panel');
        var purchase = document.getElementById('purchase-panel');
        var store = document.getElementById('store-section');
        if(admin) admin.classList.add('hidden');
        if(command) command.classList.add('hidden');
        if(purchase) purchase.classList.add('hidden');
        if(store) store.classList.remove('hidden');
    },

    showSkillModal: function(price, callback) {
        var modal = document.getElementById('skill-modal');
        var container = document.getElementById('skill-list-container');
        if (!container) return;
        
        var skillsList = [
            { name: 'Penambangan', id: 'mining' },
            { name: 'Pertanian', id: 'farming' },
            { name: 'Pertarungan', id: 'combat' },
            { name: 'Pemanenan Kayu', id: 'woodcutting' },
            { name: 'Memancing', id: 'fishing' },
            { name: 'Bertahan Hidup', id: 'survival' },
            { name: 'Sihir', id: 'magic' }
        ];
        
        container.innerHTML = '';
        for(var i = 0; i < skillsList.length; i++) {
            var skill = skillsList[i];
            var div = document.createElement('div');
            div.className = 'skill-option';
            div.innerHTML = '<span>⚔️ ' + skill.name + '</span><span style="color:var(--gold);">' + price.toLocaleString() + ' 🪙</span>';
            div.onclick = (function(skillName, cb) {
                return function() {
                    ui.closeSkillModal();
                    cb(skillName, price);
                };
            })(skill.name, callback);
            container.appendChild(div);
        }
        if(modal) modal.classList.remove('hidden');
    },

    closeSkillModal: function() {
        var modal = document.getElementById('skill-modal');
        if(modal) modal.classList.add('hidden');
    }
};

// ============================================
// APP FUNCTIONS
// ============================================
var app = {
    init: function() {
        // Load all data
        loadData();
        
        // Setup broadcast channel untuk sync antar tab
        initBroadcastChannel();
        
        // Render store
        ui.renderStore();
        
        // Check existing session
        var savedSession = sessionStorage.getItem('duskveil_session');
        if (savedSession) {
            try {
                var userData = JSON.parse(savedSession);
                if (users[userData.username]) {
                    currentUser = users[userData.username];
                    ui.showPage('store');
                    ui.updateHeader();
                    ui.updateAdminBadge();
                } else {
                    sessionStorage.removeItem('duskveil_session');
                    ui.showPage('auth');
                }
            } catch(e) {
                sessionStorage.removeItem('duskveil_session');
                ui.showPage('auth');
            }
        } else {
            ui.showPage('auth');
        }
        
        // Hide loading overlay
        var overlay = document.getElementById('loading-overlay');
        if(overlay) overlay.style.display = 'none';
        
        // Init particles
        this.initParticles();
    },

    initParticles: function() {
        var container = document.getElementById('particles');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < 30; i++) {
            var p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.setProperty('--dur', (4 + Math.random() * 6) + 's');
            p.style.setProperty('--delay', (Math.random() * 5) + 's');
            container.appendChild(p);
        }
    },

    handleLogin: function(e) {
        e.preventDefault();
        
        var username = document.getElementById('login-user').value.trim();
        var password = document.getElementById('login-pass').value;
        var btn = document.getElementById('login-btn');
        
        if (!username || !password) {
            showToast('Isi username dan password!', 'error');
            return;
        }
        
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        setTimeout(function() {
            try {
                var user = users[username];
                if (!user) {
                    showToast('Username tidak ditemukan!', 'error');
                    if(btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
                    }
                    return;
                }
                if (user.password !== password) {
                    showToast('Password salah!', 'error');
                    if(btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
                    }
                    return;
                }
                
                currentUser = user;
                sessionStorage.setItem('duskveil_session', JSON.stringify({
                    username: user.username,
                    role: user.role,
                    coin: user.coin
                }));
                
                showToast('Selamat datang, ' + sanitize(username) + '!', 'success');
                ui.updateHeader();
                ui.showPage('store');
                ui.updateAdminBadge();
                
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
        }, 100);
    },

    handleRegister: function(e) {
        e.preventDefault();
        
        var username = document.getElementById('reg-user').value.trim();
        var password = document.getElementById('reg-pass').value;
        var confirmPass = document.getElementById('reg-pass-confirm').value;
        var btn = document.getElementById('register-btn');
        
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
        if (username === 'admin') {
            showToast('Username tidak tersedia!', 'error');
            return;
        }
        
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        setTimeout(function() {
            try {
                if (users[username]) {
                    showToast('Username sudah digunakan!', 'error');
                    if(btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="btn-text">DAFTAR SEKARANG</span><span class="btn-arrow">→</span>';
                    }
                    return;
                }
                
                users[username] = {
                    username: username,
                    password: password,
                    role: 'member',
                    coin: 1000,
                    createdAt: new Date().toISOString()
                };
                saveUsers();
                
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
        }, 100);
    },

    logout: function() {
        currentUser = null;
        sessionStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        showToast('Anda telah keluar.');
    },

    getCurrentUser: function() {
        return currentUser;
    },

    buyBook: function(itemName, price, cmd) {
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup! Butuh ' + price.toLocaleString(), 'error'); return; }
        if (!confirm('Beli ' + itemName + ' seharga ' + price.toLocaleString() + ' koin?')) return;
        
        var newCoin = (currentUser.coin || 0) - price;
        users[currentUser.username].coin = newCoin;
        currentUser.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify({username: currentUser.username, role: currentUser.role, coin: currentUser.coin}));
        ui.updateHeader();
        
        var newCommand = {
            id: Date.now(),
            command: 'ksl give ' + currentUser.username + ' ' + cmd,
            username: currentUser.username,
            itemName: itemName,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        commands.unshift(newCommand);
        saveCommands();
        
        var newPurchase = {
            id: Date.now(),
            username: currentUser.username,
            itemName: itemName,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        purchases.unshift(newPurchase);
        savePurchases();
        
        showToast('✅ ' + itemName + ' berhasil dibeli!', 'success');
        ui.updateAdminBadge();
    },

    buyRank: function(rankName, price, rankId) {
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup! Butuh ' + price.toLocaleString(), 'error'); return; }
        if (!confirm('Beli rank ' + rankName + ' seharga ' + price.toLocaleString() + ' koin?')) return;
        
        var newCoin = (currentUser.coin || 0) - price;
        users[currentUser.username].coin = newCoin;
        currentUser.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify({username: currentUser.username, role: currentUser.role, coin: currentUser.coin}));
        ui.updateHeader();
        
        var commandsList = [
            'lp user ' + currentUser.username + ' parent set ' + rankId.toLowerCase(),
            'pex user ' + currentUser.username + ' group set ' + rankId.toLowerCase(),
            'manuadd ' + currentUser.username + ' ' + rankName,
            'group addplayer ' + currentUser.username + ' ' + rankId.toLowerCase()
        ];
        
        for(var i = 0; i < commandsList.length; i++) {
            commands.unshift({
                id: Date.now() + i,
                command: commandsList[i],
                username: currentUser.username,
                itemName: 'Rank: ' + rankName,
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        }
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: currentUser.username,
            itemName: 'Rank: ' + rankName,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast('✅ Rank ' + rankName + ' berhasil dibeli!', 'success');
        ui.updateAdminBadge();
    },

    showSkillSelection: function(price) {
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, function(skillName, actualPrice) {
            app.upgradeSkill(skillName, actualPrice);
        });
    },

    upgradeSkill: function(skillName, price) {
        if (!currentUser) return;
        var level = prompt('Level untuk skill ' + skillName + ' (1-1000):', '100');
        if (!level || isNaN(level) || level < 1 || level > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm('Upgrade ' + skillName + ' ke level ' + level + ' seharga ' + price.toLocaleString() + ' koin?')) return;
        
        var newCoin = (currentUser.coin || 0) - price;
        users[currentUser.username].coin = newCoin;
        currentUser.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify({username: currentUser.username, role: currentUser.role, coin: currentUser.coin}));
        ui.updateHeader();
        
        var skillId = skillName.toLowerCase().replace(/ /g, '');
        commands.unshift({
            id: Date.now(),
            command: 'skill setlevel ' + currentUser.username + ' ' + skillId + ' ' + level,
            username: currentUser.username,
            itemName: 'Skill: ' + skillName + ' → Lv.' + level,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: currentUser.username,
            itemName: 'Skill: ' + skillName + ' → Lv.' + level,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast('✅ Skill ' + skillName + ' diupgrade ke level ' + level + '!', 'success');
        ui.updateAdminBadge();
    },

    buyAllSkills: function(price) {
        if (!currentUser) { showToast('Silakan login!', 'error'); return; }
        if ((currentUser.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        var maxLevel = prompt('Set semua skill ke level berapa? (1-1000):', '1000');
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm('Set ALL SKILLS ke level ' + maxLevel + ' seharga ' + price.toLocaleString() + ' koin?')) return;
        
        var newCoin = (currentUser.coin || 0) - price;
        users[currentUser.username].coin = newCoin;
        currentUser.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify({username: currentUser.username, role: currentUser.role, coin: currentUser.coin}));
        ui.updateHeader();
        
        commands.unshift({
            id: Date.now(),
            command: 'skill setall ' + currentUser.username + ' ' + maxLevel,
            username: currentUser.username,
            itemName: 'All Skills → Lv.' + maxLevel,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: currentUser.username,
            itemName: 'All Skills → Lv.' + maxLevel,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast('✅ Semua skill diset ke level ' + maxLevel + '!', 'success');
        ui.updateAdminBadge();
    },

    markExecuted: function(id) {
        for(var i = 0; i < commands.length; i++) {
            if(commands[i].id == id) {
                commands[i].status = 'executed';
                break;
            }
        }
        saveCommands();
        ui.renderCommandTable();
        ui.updateAdminBadge();
        showToast('Command ditandai selesai!', 'success');
    },

    deleteCommand: function(id) {
        if (!confirm('Hapus command ini?')) return;
        for(var i = 0; i < commands.length; i++) {
            if(commands[i].id == id) {
                commands.splice(i, 1);
                break;
            }
        }
        saveCommands();
        ui.renderCommandTable();
        ui.updateAdminBadge();
        showToast('Command dihapus!', 'success');
    },

    executeAllCommands: function() {
        var pending = commands.filter(function(c) { return c.status === 'pending'; });
        if (pending.length === 0) {
            showToast('Tidak ada command pending!', 'error');
            return;
        }
        
        var commandsText = '';
        for(var i = 0; i < pending.length; i++) {
            commandsText += pending[i].command + '\n';
        }
        
        navigator.clipboard.writeText(commandsText);
        
        for(var j = 0; j < pending.length; j++) {
            pending[j].status = 'executed';
        }
        saveCommands();
        
        showToast(pending.length + ' command sudah di-copy! Paste di console server.', 'success');
        ui.updateAdminBadge();
        ui.renderCommandTable();
    },

    copyAllCommands: function() {
        var pending = commands.filter(function(c) { return c.status === 'pending'; });
        if (pending.length === 0) {
            showToast('Tidak ada command!', 'error');
            return;
        }
        var commandsText = '';
        for(var i = 0; i < pending.length; i++) {
            commandsText += pending[i].command + '\n';
        }
        navigator.clipboard.writeText(commandsText);
        showToast(pending.length + ' command di-copy!', 'success');
    },

    exportCommands: function() {
        var data = JSON.stringify(commands, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'commands_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Commands exported!', 'success');
    },

    clearAllCommands: function() {
        if (!confirm('Hapus SEMUA command?')) return;
        commands = [];
        saveCommands();
        showToast('Semua command dihapus!', 'success');
        ui.updateAdminBadge();
        ui.renderCommandTable();
    },

    exportAllData: function() {
        var data = JSON.stringify({ users: users, purchases: purchases, commands: commands }, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'backup_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported!', 'success');
    },

    fillAdmin: function(username, coin) {
        var searchInput = document.getElementById('admin-search');
        var coinInput = document.getElementById('admin-coin');
        if(searchInput) searchInput.value = username;
        if(coinInput) coinInput.value = coin;
    },

    adminSetCoin: function() {
        var username = document.getElementById('admin-search')?.value.trim();
        var coinValue = document.getElementById('admin-coin')?.value;
        
        if (!username) {
            showToast('Masukkan username!', 'error');
            return;
        }
        if (!coinValue || isNaN(coinValue) || parseInt(coinValue) < 0) {
            showToast('Masukkan jumlah koin yang valid!', 'error');
            return;
        }
        
        if (!users[username]) {
            showToast('User tidak ditemukan!', 'error');
            return;
        }
        
        users[username].coin = parseInt(coinValue);
        saveUsers();
        showToast('✅ Koin ' + sanitize(username) + ' → ' + parseInt(coinValue).toLocaleString(), 'success');
        
        if (currentUser && currentUser.username === username) {
            currentUser.coin = parseInt(coinValue);
            sessionStorage.setItem('duskveil_session', JSON.stringify({username: currentUser.username, role: currentUser.role, coin: currentUser.coin}));
            ui.updateHeader();
        }
        
        ui.renderAdminTable();
        document.getElementById('admin-coin').value = '';
    }
};

// Make global
window.app = app;
window.ui = ui;

// Start app
document.addEventListener('DOMContentLoaded', function() {
    app.init();
});
