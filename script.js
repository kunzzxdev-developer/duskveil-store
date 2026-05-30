// ============================================
// DuskVeilSMP - STORE SYSTEM (Tanpa Verifikasi)
// ============================================

// Data Storage menggunakan localStorage
let users = {};
let commands = [];
let purchases = [];

// Load data dari localStorage
function loadData() {
    const savedUsers = localStorage.getItem('duskveil_users');
    if (savedUsers) {
        users = JSON.parse(savedUsers);
    } else {
        // Default admin account
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
    
    const savedCommands = localStorage.getItem('duskveil_commands');
    if (savedCommands) {
        commands = JSON.parse(savedCommands);
    } else {
        commands = [];
        localStorage.setItem('duskveil_commands', JSON.stringify(commands));
    }
    
    const savedPurchases = localStorage.getItem('duskveil_purchases');
    if (savedPurchases) {
        purchases = JSON.parse(savedPurchases);
    } else {
        purchases = [];
        localStorage.setItem('duskveil_purchases', JSON.stringify(purchases));
    }
}

// Save data ke localStorage
function saveUsers() {
    localStorage.setItem('duskveil_users', JSON.stringify(users));
}

function saveCommands() {
    localStorage.setItem('duskveil_commands', JSON.stringify(commands));
}

function savePurchases() {
    localStorage.setItem('duskveil_purchases', JSON.stringify(purchases));
}

// Helper functions
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
    setTimeout(() => div.remove(), 3000);
}

// ============================================
// UI FUNCTIONS
// ============================================
const ui = {
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
        const commandPanel = document.getElementById('command-panel');
        const purchasePanel = document.getElementById('purchase-panel');
        
        if (page === 'auth') {
            if (authSection) authSection.classList.remove('hidden');
            if (navbar) navbar.classList.add('hidden');
            if (storeSection) storeSection.classList.add('hidden');
            if (adminDashboard) adminDashboard.classList.add('hidden');
            if (commandPanel) commandPanel.classList.add('hidden');
            if (purchasePanel) purchasePanel.classList.add('hidden');
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
                } else {
                    if (storeSection) storeSection.classList.remove('hidden');
                    if (adminDashboard) adminDashboard.classList.add('hidden');
                }
                this.updateHeader();
                this.updateAdminBadge();
            }
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
    },

    updateAdminBadge() {
        const badge = document.getElementById('pending-badge');
        if (!badge) return;
        const pending = commands.filter(c => c.status === 'pending');
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

    renderAdminTable() {
        const tbody = document.getElementById('user-table-body');
        if (!tbody) return;
        
        const userList = Object.values(users);
        if (userList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada member</td></tr>';
            return;
        }
        
        tbody.innerHTML = userList.map(u => `
            <tr>
                <td>${sanitize(u.username)}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'status-admin' : 'status-member'}">${u.role.toUpperCase()}</span></td>
                <td style="color:var(--gold);">${(u.coin || 0).toLocaleString()}</td>
                <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                <td><button class="btn-tbl-edit" onclick="app.fillAdmin('${sanitize(u.username)}', ${u.coin || 0})">Edit</button></td>
            </tr>
        `).join('');
    },

    updateStats() {
        const userList = Object.values(users);
        const totalCoin = userList.reduce((sum, u) => sum + (u.coin || 0), 0);
        const pending = commands.filter(c => c.status === 'pending');
        
        const totalUsersEl = document.getElementById('stat-total-users');
        const totalCoinEl = document.getElementById('stat-total-coins');
        const totalPurchasesEl = document.getElementById('stat-total-purchases');
        const pendingCommandsEl = document.getElementById('stat-pending-commands');
        
        if (totalUsersEl) totalUsersEl.textContent = userList.length;
        if (totalCoinEl) totalCoinEl.textContent = totalCoin.toLocaleString();
        if (totalPurchasesEl) totalPurchasesEl.textContent = purchases.length;
        if (pendingCommandsEl) pendingCommandsEl.textContent = pending.length;
    },

    renderCommandTable() {
        const tbody = document.getElementById('command-table-body');
        if (!tbody) return;
        
        if (commands.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tidak ada command</td></tr>';
            return;
        }
        
        tbody.innerHTML = commands.map(cmd => {
            const statusClass = cmd.status === 'pending' ? 'status-pending' : 'status-executed';
            const statusText = cmd.status === 'pending' ? '⏳ Pending' : '✅ Executed';
            return `
                <tr>
                    <td style="font-size:0.75rem;">${cmd.timestamp ? new Date(cmd.timestamp).toLocaleString() : '-'}</td>
                    <td><code style="background:#1a1a2a;padding:4px 8px;border-radius:4px;">${sanitize(cmd.command)}</code><br><small>👤 ${sanitize(cmd.username)}</small></td>
                    <td><span class="command-status ${statusClass}">${statusText}</span></td>
                    <td>${cmd.status === 'pending' ? `<button class="btn-execute" onclick="app.markExecuted('${cmd.id}')">✓ Tandai Selesai</button>` : `<button class="btn-copy" onclick="app.deleteCommand('${cmd.id}')">🗑 Hapus</button>`}</td>
                </tr>
            `;
        }).join('');
    },

    renderPurchaseLog() {
        const tbody = document.getElementById('purchase-log-body');
        if (!tbody) return;
        
        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada pembelian</td></tr>';
            return;
        }
        
        tbody.innerHTML = purchases.map(p => {
            const statusClass = p.status === 'pending' ? 'status-pending' : 'status-executed';
            const statusText = p.status === 'pending' ? '⏳ Pending' : '✅ Selesai';
            return `
                <tr>
                    <td style="font-size:0.75rem;">${p.timestamp ? new Date(p.timestamp).toLocaleString() : '-'}</td>
                    <td>${sanitize(p.username)}</td>
                    <td>${sanitize(p.itemName)}</td>
                    <td style="color:var(--gold);">${(p.price || 0).toLocaleString()} 🪙</td>
                    <td><span class="command-status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }).join('');
    },

    showCommandPanel() {
        document.getElementById('store-section')?.classList.add('hidden');
        document.getElementById('admin-dashboard')?.classList.add('hidden');
        document.getElementById('purchase-panel')?.classList.add('hidden');
        document.getElementById('command-panel')?.classList.remove('hidden');
        this.renderCommandTable();
    },

    showPurchasePanel() {
        document.getElementById('store-section')?.classList.add('hidden');
        document.getElementById('admin-dashboard')?.classList.add('hidden');
        document.getElementById('command-panel')?.classList.add('hidden');
        document.getElementById('purchase-panel')?.classList.remove('hidden');
        this.renderPurchaseLog();
    },

    showAdminPanel() {
        document.getElementById('store-section')?.classList.add('hidden');
        document.getElementById('command-panel')?.classList.add('hidden');
        document.getElementById('purchase-panel')?.classList.add('hidden');
        document.getElementById('admin-dashboard')?.classList.remove('hidden');
        this.renderAdminTable();
        this.updateStats();
    },

    showStorePanel() {
        document.getElementById('admin-dashboard')?.classList.add('hidden');
        document.getElementById('command-panel')?.classList.add('hidden');
        document.getElementById('purchase-panel')?.classList.add('hidden');
        document.getElementById('store-section')?.classList.remove('hidden');
    },

    showSkillModal(price, callback) {
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
        skillsList.forEach(skill => {
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
    init() {
        loadData();
        ui.renderStore();
        
        const session = sessionStorage.getItem('duskveil_session');
        if (session) {
            try {
                const user = JSON.parse(session);
                if (users[user.username]) {
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
        
        // Init particles
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
            p.style.top = Math.random() * 100 + '%';
            p.style.setProperty('--dur', (4 + Math.random() * 6) + 's');
            p.style.setProperty('--delay', (Math.random() * 5) + 's');
            container.appendChild(p);
        }
    },

    handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-user').value.trim();
        const password = document.getElementById('login-pass').value;
        const btn = document.getElementById('login-btn');
        
        if (!username || !password) {
            showToast('Isi username dan password!', 'error');
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        setTimeout(() => {
            try {
                const user = users[username];
                if (!user) {
                    showToast('Username tidak ditemukan!', 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
                    }
                    return;
                }
                if (user.password !== password) {
                    showToast('Password salah!', 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
                    }
                    return;
                }
                
                const sessionData = {
                    username: user.username,
                    role: user.role,
                    coin: user.coin || 0,
                    loginAt: new Date().toISOString()
                };
                sessionStorage.setItem('duskveil_session', JSON.stringify(sessionData));
                
                showToast(`Selamat datang, ${sanitize(username)}!`, 'success');
                ui.updateHeader();
                ui.showPage('store');
                ui.updateAdminBadge();
                
                document.getElementById('login-user').value = '';
                document.getElementById('login-pass').value = '';
                
            } catch(err) {
                showToast('Login gagal: ' + err.message, 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="btn-text">MASUK SERVER</span><span class="btn-arrow">→</span>';
                }
            }
        }, 100);
    },

    handleRegister(e) {
        e.preventDefault();
        
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
        if (username === 'admin') {
            showToast('Username tidak tersedia!', 'error');
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-text">Memuat...</span><span class="btn-arrow">→</span>';
        }
        
        setTimeout(() => {
            try {
                if (users[username]) {
                    showToast('Username sudah digunakan!', 'error');
                    if (btn) {
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
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="btn-text">DAFTAR SEKARANG</span><span class="btn-arrow">→</span>';
                }
            }
        }, 100);
    },

    logout() {
        sessionStorage.removeItem('duskveil_session');
        ui.showPage('auth');
        showToast('Anda telah keluar.');
    },

    getCurrentUser() {
        const session = sessionStorage.getItem('duskveil_session');
        return session ? JSON.parse(session) : null;
    },

    buyBook(itemName, price, cmd) {
        const user = this.getCurrentUser();
        if (!user) { showToast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { showToast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli ${itemName} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        users[user.username].coin = newCoin;
        user.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        const newCommand = {
            id: Date.now(),
            command: `ksl give ${user.username} ${cmd}`,
            username: user.username,
            itemName: itemName,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        commands.unshift(newCommand);
        saveCommands();
        
        const newPurchase = {
            id: Date.now(),
            username: user.username,
            itemName: itemName,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        purchases.unshift(newPurchase);
        savePurchases();
        
        showToast(`✅ ${itemName} berhasil dibeli!`, 'success');
        ui.updateAdminBadge();
    },

    buyRank(rankName, price, rankId) {
        const user = this.getCurrentUser();
        if (!user) { showToast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { showToast(`Koin tidak cukup! Butuh ${price.toLocaleString()}`, 'error'); return; }
        if (!confirm(`Beli rank ${rankName} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        users[user.username].coin = newCoin;
        user.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        const commandsList = [
            `lp user ${user.username} parent set ${rankId.toLowerCase()}`,
            `pex user ${user.username} group set ${rankId.toLowerCase()}`,
            `manuadd ${user.username} ${rankName}`,
            `group addplayer ${user.username} ${rankId.toLowerCase()}`
        ];
        
        for (const cmd of commandsList) {
            commands.unshift({
                id: Date.now(),
                command: cmd,
                username: user.username,
                itemName: `Rank: ${rankName}`,
                status: 'pending',
                timestamp: new Date().toISOString()
            });
        }
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: user.username,
            itemName: `Rank: ${rankName}`,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast(`✅ Rank ${rankName} berhasil dibeli!`, 'success');
        ui.updateAdminBadge();
    },

    showSkillSelection(price) {
        const user = this.getCurrentUser();
        if (!user) { showToast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        ui.showSkillModal(price, (skillName, actualPrice) => this.upgradeSkill(skillName, actualPrice));
    },

    upgradeSkill(skillName, price) {
        const user = this.getCurrentUser();
        if (!user) return;
        const level = prompt(`Level untuk skill ${skillName} (1-1000):`, "100");
        if (!level || isNaN(level) || level < 1 || level > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Upgrade ${skillName} ke level ${level} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        users[user.username].coin = newCoin;
        user.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        const skillId = skillName.toLowerCase().replace(/ /g, '');
        commands.unshift({
            id: Date.now(),
            command: `skill setlevel ${user.username} ${skillId} ${level}`,
            username: user.username,
            itemName: `Skill: ${skillName} → Lv.${level}`,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: user.username,
            itemName: `Skill: ${skillName} → Lv.${level}`,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast(`✅ Skill ${skillName} diupgrade ke level ${level}!`, 'success');
        ui.updateAdminBadge();
    },

    buyAllSkills(price) {
        const user = this.getCurrentUser();
        if (!user) { showToast('Silakan login!', 'error'); return; }
        if ((user.coin || 0) < price) { showToast('Koin tidak cukup!', 'error'); return; }
        const maxLevel = prompt("Set semua skill ke level berapa? (1-1000):", "1000");
        if (!maxLevel || isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
            showToast('Level tidak valid!', 'error');
            return;
        }
        if (!confirm(`Set ALL SKILLS ke level ${maxLevel} seharga ${price.toLocaleString()} koin?`)) return;
        
        const newCoin = (user.coin || 0) - price;
        users[user.username].coin = newCoin;
        user.coin = newCoin;
        saveUsers();
        sessionStorage.setItem('duskveil_session', JSON.stringify(user));
        ui.updateHeader();
        
        commands.unshift({
            id: Date.now(),
            command: `skill setall ${user.username} ${maxLevel}`,
            username: user.username,
            itemName: `All Skills → Lv.${maxLevel}`,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        saveCommands();
        
        purchases.unshift({
            id: Date.now(),
            username: user.username,
            itemName: `All Skills → Lv.${maxLevel}`,
            price: price,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        savePurchases();
        
        showToast(`✅ Semua skill diset ke level ${maxLevel}!`, 'success');
        ui.updateAdminBadge();
    },

    markExecuted(id) {
        const index = commands.findIndex(c => c.id == id);
        if (index !== -1) {
            commands[index].status = 'executed';
            saveCommands();
            ui.renderCommandTable();
            ui.updateAdminBadge();
            showToast('Command ditandai selesai!', 'success');
        }
    },

    deleteCommand(id) {
        if (!confirm('Hapus command ini?')) return;
        const index = commands.findIndex(c => c.id == id);
        if (index !== -1) {
            commands.splice(index, 1);
            saveCommands();
            ui.renderCommandTable();
            ui.updateAdminBadge();
            showToast('Command dihapus!', 'success');
        }
    },

    executeAllCommands() {
        const pending = commands.filter(c => c.status === 'pending');
        if (pending.length === 0) {
            showToast('Tidak ada command pending!', 'error');
            return;
        }
        
        const commandsText = pending.map(c => c.command).join('\n');
        navigator.clipboard.writeText(commandsText);
        
        for (const cmd of pending) {
            cmd.status = 'executed';
        }
        saveCommands();
        
        showToast(`${pending.length} command sudah di-copy! Paste di console server.`, 'success');
        ui.updateAdminBadge();
        ui.renderCommandTable();
    },

    copyAllCommands() {
        const pending = commands.filter(c => c.status === 'pending');
        if (pending.length === 0) {
            showToast('Tidak ada command!', 'error');
            return;
        }
        const commandsText = pending.map(c => c.command).join('\n');
        navigator.clipboard.writeText(commandsText);
        showToast(`${pending.length} command di-copy!`, 'success');
    },

    exportCommands() {
        const data = JSON.stringify(commands, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commands_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Commands exported!', 'success');
    },

    clearAllCommands() {
        if (!confirm('Hapus SEMUA command?')) return;
        commands = [];
        saveCommands();
        showToast('Semua command dihapus!', 'success');
        ui.updateAdminBadge();
        ui.renderCommandTable();
    },

    exportAllData() {
        const data = JSON.stringify({ users, purchases, commands }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported!', 'success');
    },

    fillAdmin(username, coin) {
        const searchInput = document.getElementById('admin-search');
        const coinInput = document.getElementById('admin-coin');
        if (searchInput) searchInput.value = username;
        if (coinInput) coinInput.value = coin;
    },

    adminSetCoin() {
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
        
        if (!users[username]) {
            showToast('User tidak ditemukan!', 'error');
            return;
        }
        
        users[username].coin = parseInt(coinValue);
        saveUsers();
        showToast(`Koin ${sanitize(username)} → ${parseInt(coinValue).toLocaleString()}`, 'success');
        
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

// Make sure CSS particles work
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    if (typeof app !== 'undefined') {
        app.init();
    }
});

// Make app global
window.app = app;
window.ui = ui;
