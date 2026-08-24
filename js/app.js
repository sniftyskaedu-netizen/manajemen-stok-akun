import { db } from './db.js';
import { CryptoUtil } from './crypto.js';
import { TemplateEngine } from './template.js';

class AccExpressApp {
  constructor() {
    this.currentAdmin = sessionStorage.getItem('accexpress_admin') || null;
    this.decryptedPasswords = {};
    this.lastCompiledMessage = '';
  }

  async init() {
    await db.init();
    this.setupTheme();
    this.applySettingsToUI();
    this.setupEventListeners();
    this.setupWhatsAppInputSanitizers();
    this.populateProductDropdowns();
    this.renderInventoryTable();
    this.renderSalesHubInventory();
    this.updateAdminAuthState();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- HELPER HURUF DEPAN ICON LOGO (INITIALS) ---
  getBrandInitials(name) {
    if (!name) return 'AX';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // --- APPLICATION GLOBAL SETTINGS & BRANDING MANAGER ---
  applySettingsToUI() {
    const settings = db.getSettings();
    if (!settings) return;

    const webName = settings.web_name || 'AccExpress Seller Hub';
    const shopName = settings.shop_name || 'AccExpress Digital Store';

    // 1. Update Logo Icon Initials (Huruf Depan Toko / Web)
    const brandIconEl = document.querySelector('.brand-icon');
    if (brandIconEl) brandIconEl.innerText = this.getBrandInitials(webName || shopName);

    // 2. Update Document Title
    document.title = `${webName} — Manajemen & Pengiriman Akun Digital`;

    // 3. Update Header Navbar Brand Text
    const brandTextEl = document.querySelector('#navBrandBtn span:not(.brand-badge)');
    if (brandTextEl) brandTextEl.innerText = webName;

    // 4. Update Hero Section Titles
    const heroTitleEl = document.querySelector('.hero-title');
    if (heroTitleEl) heroTitleEl.innerText = webName;

    const heroSubEl = document.querySelector('.hero-subtitle');
    if (heroSubEl) heroSubEl.innerText = `Kelola dan kirim akun digital ${shopName} dengan cepat, mudah, dan terorganisir.`;

    // 5. Update Form Inputs in Settings Tab
    const setWebNameInput = document.getElementById('setWebName');
    const setShopNameInput = document.getElementById('setShopName');
    const setShopWaInput = document.getElementById('setShopWa');

    if (setWebNameInput) setWebNameInput.value = settings.web_name || '';
    if (setShopNameInput) setShopNameInput.value = settings.shop_name || '';
    if (setShopWaInput) setShopWaInput.value = settings.shop_whatsapp || '';
  }

  // --- DARK / LIGHT THEME TOGGLE ---
  setupTheme() {
    const savedTheme = localStorage.getItem('accexpress_theme');
    const body = document.body;
    const themeIcon = document.getElementById('themeToggleIcon');

    if (savedTheme === 'dark') {
      body.classList.add('dark-mode');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    } else {
      body.classList.remove('dark-mode');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    }

    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      localStorage.setItem('accexpress_theme', isDark ? 'dark' : 'light');

      if (themeIcon) {
        themeIcon.setAttribute('data-lucide', 'moon');
      } else {
        themeIcon.setAttribute('data-lucide', 'sun');
      }
      if (window.lucide) window.lucide.createIcons();
      this.showToast(`Mode ${isDark ? 'Gelap' : 'Terang'} diaktifkan.`, 'info');
    });
  }

  // --- INPUT SANITIZERS (ANGKA & HARUS BERSIH) ---
  setupWhatsAppInputSanitizers() {
    const numericInputIds = ['qaDuration', 'accFormDuration', 'qaCustomerWa', 'invSendCustomerWa', 'setShopWa', 'loginPassword', 'setNewPassword', 'setConfirmPassword'];
    numericInputIds.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
      }
    });
  }

  // --- UI TOAST NOTIFICATION HELPER ---
  showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // --- CLIPBOARD HELPER ---
  async copyToClipboard(text) {
    if (!text) return false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      console.warn('Navigator.clipboard error:', e);
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.warn('Fallback copy error:', err);
      return false;
    }
  }

  // --- SHOW SENT MESSAGE RESULT MODAL ---
  showSentMessageResultModal(compiledMessage, customerWa) {
    this.lastCompiledMessage = compiledMessage;
    const outputEl = document.getElementById('sentMessageOutput');
    const waBtn = document.getElementById('sentMessageWaBtn');

    if (outputEl) outputEl.innerText = compiledMessage;

    if (waBtn) {
      let cleanWa = (customerWa || '').replace(/[^0-9]/g, '');
      if (cleanWa.startsWith('0')) {
        cleanWa = '62' + cleanWa.substring(1);
      }
      waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(compiledMessage)}`;
    }

    this.openModal('sentMessageModal');
  }

  // --- MODAL HELPERS ---
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      if (id === 'adminLoginModal') {
        const input = document.getElementById('loginPassword');
        if (input) {
          input.value = '';
          setTimeout(() => input.focus(), 150);
        }
      }
    }
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  }

  // --- NAVIGATION & VIEW SWITCHER ---
  setupEventListeners() {
    document.getElementById('navBrandBtn')?.addEventListener('click', () => {
      this.returnToSalesHub();
    });

    const mobileToggle = document.getElementById('mobileNavToggle');
    if (mobileToggle) {
      mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentAdmin && document.getElementById('adminView')?.style.display !== 'none') {
          this.logoutAdmin();
        } else {
          document.getElementById('navLinks')?.classList.toggle('show');
        }
      });
    }

    document.addEventListener('click', (e) => {
      const navLinks = document.getElementById('navLinks');
      const mobileToggle = document.getElementById('mobileNavToggle');
      if (navLinks && navLinks.classList.contains('show') && !navLinks.contains(e.target) && !mobileToggle.contains(e.target)) {
        navLinks.classList.remove('show');
      }
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close');
        this.closeModal(modalId);
      });
    });

    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inputId = e.currentTarget.getAttribute('data-input');
        const input = document.getElementById(inputId);
        if (input) {
          const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
          input.setAttribute('type', type);
          const icon = e.currentTarget.querySelector('i');
          if (icon) {
            icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
            if (window.lucide) window.lucide.createIcons();
          }
        }
      });
    });

    document.getElementById('resendCopyBtn')?.addEventListener('click', async () => {
      if (this.lastCompiledMessage) {
        const copied = await this.copyToClipboard(this.lastCompiledMessage);
        if (copied) {
          this.showToast('✓ Pesan berhasil disalin ke clipboard!', 'success');
        } else {
          this.showToast('Silakan salin teks dari kotak secara manual.', 'info');
        }
      }
    });

    document.getElementById('salesHubProductFilter')?.addEventListener('change', () => {
      this.renderSalesHubInventory();
    });

    document.getElementById('tplFormType')?.addEventListener('change', (e) => {
      const type = e.target.value;
      const grp = document.getElementById('tplFormProductGroup');
      if (grp) grp.style.display = type === 'PRODUCT' ? 'block' : 'none';
    });

    document.getElementById('tplTypeFilter')?.addEventListener('change', () => {
      this.renderAdminTemplates();
    });

    // TOGGLE TIPE AKSES DI ADMIN MODAL
    document.getElementById('accFormAccessType')?.addEventListener('change', (e) => {
      const type = e.target.value;
      const pwdGrp = document.getElementById('accEmailPasswordGroup');
      const linkGrp = document.getElementById('accLinkGroup');
      if (pwdGrp && linkGrp) {
        if (type === 'LINK') {
          pwdGrp.style.display = 'none';
          linkGrp.style.display = 'block';
        } else {
          pwdGrp.style.display = 'block';
          linkGrp.style.display = 'none';
        }
      }
    });

    // TOGGLE MICRO ICON BUTTON DI QUICK ACCESS HEADER (GRID ROW PARALLEL TOGGLE)
    document.querySelectorAll('.qa-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        const hiddenInput = document.getElementById('qaAccessType');
        if (hiddenInput) hiddenInput.value = type;

        document.querySelectorAll('.qa-type-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });

        e.currentTarget.classList.add('active');
        e.currentTarget.style.background = 'var(--accent-primary)';
        e.currentTarget.style.color = '#ffffff';

        const emailGrp = document.getElementById('qaEmailGroup');
        const pwdGrp = document.getElementById('qaPasswordGroup');
        const linkGrp = document.getElementById('qaLinkGroup');
        const linkNotesGrp = document.getElementById('qaLinkNotesGroup');

        if (type === 'LINK') {
          if (emailGrp) emailGrp.style.display = 'none';
          if (pwdGrp) pwdGrp.style.display = 'none';
          if (linkGrp) linkGrp.style.display = 'block';
          if (linkNotesGrp) linkNotesGrp.style.display = 'block';
        } else {
          if (emailGrp) emailGrp.style.display = 'block';
          if (pwdGrp) pwdGrp.style.display = 'block';
          if (linkGrp) linkGrp.style.display = 'none';
          if (linkNotesGrp) linkNotesGrp.style.display = 'none';
        }
      });
    });

    this.setupFormListeners();
    this.setupAdminTabListeners();
    this.rebindPublicNavLinks();
  }

  setupFormListeners() {
    document.getElementById('quickAccessForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleQuickAccessSubmit();
    });

    document.getElementById('inventorySendForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleInventorySendSubmit();
    });

    document.getElementById('confirmResetAccBtn')?.addEventListener('click', async () => {
      const accId = document.getElementById('resetAccId').value;
      if (accId) {
        const acc = db.getAccountById(accId);
        await db.resetAccount(accId);
        db.addActivityLog(this.currentAdmin || 'staff', 'Reset Akun', 'akun', `Reset status akun ${acc ? (acc.link || acc.username_or_email) : accId} menjadi TERSEDIA`, accId);
        this.showToast('✓ Status akun berhasil di-reset ke TERSEDIA.', 'success');
        this.closeModal('resetAccountModal');
        this.renderInventoryTable();
        this.renderSalesHubInventory();
        if (this.currentAdmin) this.renderAdminAccounts();
      }
    });

    document.getElementById('trackForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleTrackSearch();
    });

    document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAdminLogin();
    });

    document.getElementById('accountForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveAccount();
    });

    document.getElementById('productForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveProduct();
    });

    document.getElementById('templateForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveTemplate();
    });

    document.querySelectorAll('.tag-pills, #templateTagPills').forEach(container => {
      container.addEventListener('click', (e) => {
        const pill = e.target.closest('.tag-pill');
        if (!pill) return;
        const tag = pill.getAttribute('data-tag');
        const textarea = document.getElementById('tplFormContent');
        if (textarea && tag) {
          const start = textarea.selectionStart ?? textarea.value.length;
          const end = textarea.selectionEnd ?? textarea.value.length;
          const text = textarea.value;
          textarea.value = text.substring(0, start) + tag + text.substring(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        }
      });
    });

    document.getElementById('previewTemplateInModalBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const textarea = document.getElementById('tplFormContent');
      const content = textarea ? textarea.value.trim() : '';

      // Tampilkan template sampel jika isi masih kosong
      const sampleText = content || 'Halo {{customer_whatsapp}}, terima kasih!\nBerikut akses produk {{product}} Anda:\n\nEmail / Akses: {{username}}\nPassword: {{password}}\nLink Akses: {{link}}\nDurasi: {{duration}} {{duration_unit}}\nCatatan: {{catatan}}';

      const tplType = document.getElementById('tplFormType')?.value || 'GLOBAL';
      const selectedProdId = document.getElementById('tplFormProductId')?.value;
      
      let prod = null;
      if (tplType === 'PRODUCT' && selectedProdId) {
        prod = db.getProductById(selectedProdId);
      }
      if (!prod) {
        prod = db.getActiveProducts()[0] || { name: 'Produk Digital' };
      }

      // Cari contoh akun riil dari database untuk produk ini (jika ada)
      const existingAccs = prod && prod.id ? db.getAccountsByProductId(prod.id) : [];
      const sampleAcc = existingAccs.find(a => a.access_type === 'LINK' || a.link) || existingAccs[0];

      let isLinkProd = false;
      let sampleLink = 'https://akses-produk.com/join-invite-sample';
      let sampleUser = 'customer.user@gmail.com';

      if (sampleAcc) {
        isLinkProd = sampleAcc.access_type === 'LINK' || Boolean(sampleAcc.link) || (sampleAcc.username_or_email && sampleAcc.username_or_email.startsWith('http'));
        sampleLink = sampleAcc.link || sampleAcc.username_or_email || sampleLink;
        sampleUser = isLinkProd ? sampleLink : sampleAcc.username_or_email;
      } else {
        // Jika template mengandung tag link, simulasikan sebagai produk link
        isLinkProd = sampleText.includes('{{link}}') || sampleText.includes('{{link_akses}}') || sampleText.includes('{{url_akses}}');
        if (isLinkProd) sampleUser = sampleLink;
      }

      const compiled = TemplateEngine.compile(sampleText, {
        product: prod ? prod.name : 'Produk Digital',
        access_type: isLinkProd ? 'LINK' : 'ACCOUNT',
        username: sampleUser,
        password: isLinkProd ? '-' : 'secretPassword123',
        link: sampleLink,
        duration: sampleAcc ? sampleAcc.duration : 30,
        duration_unit: sampleAcc ? sampleAcc.duration_unit : 'Hari',
        customer_whatsapp: '081234567890',
        notes: sampleAcc ? (sampleAcc.notes || 'Catatan Akses') : (isLinkProd ? 'Link Undangan Akses Produk' : 'Profile 1 PIN 1234'),
        sent_date: new Date(),
        expires_date: TemplateEngine.calculateExpirationDate(new Date(), 30, 'Hari')
      });

      const outputEl = document.getElementById('templatePreviewOutput');
      if (outputEl) {
        outputEl.innerText = compiled;
      }
      this.openModal('templatePreviewModal');
    });

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
      const type = document.getElementById('deleteTargetType').value;
      const id = document.getElementById('deleteTargetId').value;

      if (type === 'account') {
        const acc = db.getAccountById(id);
        db.deleteAccount(id);
        db.addActivityLog(this.currentAdmin, 'Akun Dihapus', 'akun', `Hapus data ${acc ? (acc.link || acc.username_or_email) : id}`, id);
        this.showToast('Data berhasil dihapus.', 'info');
        this.renderAdminAccounts();
        this.renderInventoryTable();
        this.renderSalesHubInventory();
      } else if (type === 'product') {
        const prod = db.getProductById(id);
        db.deleteProduct(id);
        db.addActivityLog(this.currentAdmin, 'Produk Dihapus', 'produk', `Hapus produk ${prod ? prod.name : id}`, id);
        this.showToast('Data produk berhasil dihapus.', 'info');
        this.renderAdminProducts();
        this.populateProductDropdowns();
      } else if (type === 'template') {
        db.deleteTemplate(id);
        db.addActivityLog(this.currentAdmin, 'Template Dihapus', 'template', `Hapus template ID ${id}`, id);
        this.showToast('Template pesan berhasil dihapus.', 'info');
        this.renderAdminTemplates();
      }
      this.closeModal('deleteConfirmModal');
    });

    // PENGATURAN INFORMASI TOKO & WEB
    document.getElementById('settingsGeneralForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const wName = document.getElementById('setWebName').value.trim();
      const sName = document.getElementById('setShopName').value.trim();
      const sWa = document.getElementById('setShopWa').value.trim();

      db.saveSettings({
        web_name: wName,
        shop_name: sName,
        shop_whatsapp: sWa
      });

      db.addActivityLog(this.currentAdmin || 'admin', 'Pengaturan Diperbarui', 'sistem', `Mengubah informasi web ke "${wName}" dan toko ke "${sName}"`);
      this.applySettingsToUI();
      this.showToast('✓ Pengaturan toko & web berhasil disimpan dan diterapkan!', 'success');
    });

    // PENGATURAN PIN KEAMANAN ADMIN
    document.getElementById('settingsSecurityForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('setNewPassword').value.trim();
      const p2 = document.getElementById('setConfirmPassword').value.trim();
      if (p1 !== p2) {
        this.showToast('Konfirmasi PIN baru tidak cocok.', 'error');
        return;
      }
      if (!p1 || p1.length < 4) {
        this.showToast('PIN minimal 4 angka.', 'error');
        return;
      }
      await db.updateAdminPassword(this.currentAdmin || 'admin', p1);
      db.addActivityLog(this.currentAdmin || 'admin', 'PIN Admin Diubah', 'admin', `PIN Admin berhasil diperbarui menjadi "${p1}"`);
      this.showToast(`✓ PIN Admin berhasil diperbarui menjadi "${p1}".`, 'success');
      document.getElementById('setNewPassword').value = '';
      document.getElementById('setConfirmPassword').value = '';
    });

    document.getElementById('refreshInventoryBtn')?.addEventListener('click', () => {
      this.renderInventoryTable();
      this.renderSalesHubInventory();
      this.showToast('Stok inventory diperbarui.', 'info');
    });

    document.getElementById('adminDownloadExcelBtn')?.addEventListener('click', () => {
      this.downloadAccountsExcel('admin');
    });

    document.getElementById('dashDownloadExcelBtn')?.addEventListener('click', () => {
      this.downloadAccountsExcel('admin');
    });

    ['adminAccSearch', 'adminAccProductFilter', 'adminAccStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderAdminAccounts());
    });

    ['invSearchInput', 'invProductFilter', 'invStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderInventoryTable());
    });
  }

  // --- ADMIN SIDEBAR TAB SWITCHER ---
  setupAdminTabListeners() {
    document.querySelectorAll('.sidebar-item[data-tab]').forEach(item => {
      item.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');

        document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
        const activeTabContent = document.getElementById(targetTab);
        if (activeTabContent) activeTabContent.style.display = 'block';

        if (targetTab === 'admin-dashboard') this.renderAdminDashboard();
        if (targetTab === 'admin-accounts') this.renderAdminAccounts();
        if (targetTab === 'admin-products') this.renderAdminProducts();
        if (targetTab === 'admin-templates') this.renderAdminTemplates();
        if (targetTab === 'admin-transactions') this.renderAdminTransactions();
        if (targetTab === 'admin-activity') this.renderAdminLogs();
        if (targetTab === 'admin-settings') this.renderAdminSettings();
      });
    });

    document.getElementById('openAddAccountModalBtn')?.addEventListener('click', () => {
      document.getElementById('accountForm').reset();
      document.getElementById('accFormId').value = '';
      document.getElementById('accFormAccessType').value = 'ACCOUNT';
      document.getElementById('accEmailPasswordGroup').style.display = 'block';
      document.getElementById('accLinkGroup').style.display = 'none';
      document.getElementById('accFormDuration').value = '';
      document.getElementById('accFormUnit').value = '';
      document.getElementById('accountModalTitle').innerText = 'Tambah Akun / Link Akses';
      this.populateProductDropdowns();
      this.openModal('accountModal');
    });

    document.getElementById('openAddProductModalBtn')?.addEventListener('click', () => {
      document.getElementById('productForm').reset();
      document.getElementById('prodFormId').value = '';
      document.getElementById('productModalTitle').innerText = 'Tambah Kategori Produk';
      this.openModal('productModal');
    });

    document.getElementById('openAddTemplateModalBtn')?.addEventListener('click', () => {
      document.getElementById('templateForm').reset();
      document.getElementById('tplFormId').value = '';
      document.getElementById('tplFormType').value = 'GLOBAL';
      document.getElementById('tplFormProductGroup').style.display = 'none';
      document.getElementById('templateModalTitle').innerText = 'Tambah Template Pesan';
      this.populateProductDropdowns();
      this.openModal('templateModal');
    });
  }

  // --- RETURN TO SALES HUB ---
  returnToSalesHub() {
    const adminView = document.getElementById('adminView');
    const publicView = document.getElementById('publicView');
    if (adminView && publicView) {
      adminView.style.display = 'none';
      publicView.style.display = 'block';
      document.querySelectorAll('.public-tab-view').forEach(v => v.style.display = 'none');
      document.getElementById('sales-hub-view').style.display = 'block';
    }
    this.updateAdminAuthState();
  }

  // --- LOGOUT ADMIN ---
  logoutAdmin() {
    sessionStorage.removeItem('accexpress_admin');
    this.currentAdmin = null;
    db.addActivityLog('admin', 'Admin Logout', 'sistem', 'Admin telah keluar dari sistem');
    this.returnToSalesHub();
    this.showToast('Anda telah keluar dari Admin Panel.', 'info');
  }

  // --- UPDATE ADMIN AUTH & NAVBAR STATE ---
  updateAdminAuthState() {
    const adminView = document.getElementById('adminView');
    const publicView = document.getElementById('publicView');
    const toggleBtn = document.getElementById('mobileNavToggle');
    const navLinks = document.getElementById('navLinks');

    const isAdminActive = this.currentAdmin && adminView && adminView.style.display !== 'none';

    if (isAdminActive) {
      if (toggleBtn) {
        toggleBtn.innerHTML = `<i data-lucide="log-out"></i>`;
        toggleBtn.setAttribute('title', 'Keluar dari Admin');
        toggleBtn.classList.add('btn-logout-blue');
      }
      if (navLinks) {
        navLinks.innerHTML = '';
        navLinks.classList.remove('show');
      }
    } else {
      if (toggleBtn) {
        toggleBtn.innerHTML = `<i data-lucide="menu"></i>`;
        toggleBtn.setAttribute('title', 'Menu Navigasi');
        toggleBtn.classList.remove('btn-logout-blue');
      }
      if (navLinks) {
        navLinks.innerHTML = `
          <li><a class="nav-link active" data-view="sales-hub-view"><i data-lucide="zap"></i> Sales Hub</a></li>
          <li><a class="nav-link" data-view="inventory-view"><i data-lucide="boxes"></i> Inventory Stok</a></li>
          <li><a class="nav-link" data-view="lacak-view"><i data-lucide="clock"></i> Lacak Masa Aktif</a></li>
          <li><a class="nav-link btn-admin-login" id="openAdminLoginBtn"><i data-lucide="shield"></i> Admin</a></li>
        `;
        this.rebindPublicNavLinks();
      }

      if (adminView) adminView.style.display = 'none';
      if (publicView) publicView.style.display = 'block';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  showAdminPanel() {
    const adminView = document.getElementById('adminView');
    const publicView = document.getElementById('publicView');
    if (adminView && publicView) {
      publicView.style.display = 'none';
      adminView.style.display = 'flex';
      this.updateAdminAuthState();

      // Reset menu sidebar & konten ke tab Dashboard
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      const dashItem = document.querySelector('.sidebar-item[data-tab="admin-dashboard"]');
      if (dashItem) dashItem.classList.add('active');

      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      const dashTab = document.getElementById('admin-dashboard');
      if (dashTab) dashTab.style.display = 'block';

      this.renderAdminDashboard();

      // Pastikan layar selalu tergulung paling atas & langsung berfokus pada tombol menu Dashboard
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const adminContent = document.querySelector('.admin-content');
      if (adminContent) adminContent.scrollTop = 0;
      if (dashItem) {
        dashItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  rebindPublicNavLinks() {
    document.querySelectorAll('[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetView = e.currentTarget.getAttribute('data-view');
        if (targetView === 'adminView') {
          e.preventDefault();
          this.openModal('adminLoginModal');
          return;
        }

        e.preventDefault();
        const adminView = document.getElementById('adminView');
        const publicView = document.getElementById('publicView');
        if (adminView && publicView && adminView.style.display !== 'none') {
          adminView.style.display = 'none';
          publicView.style.display = 'block';
        }

        document.querySelectorAll('.nav-link[data-view]').forEach(l => l.classList.remove('active'));
        const navLink = document.querySelector(`.nav-link[data-view="${targetView}"]`);
        if (navLink) navLink.classList.add('active');

        document.querySelectorAll('.public-tab-view').forEach(v => v.style.display = 'none');

        const activeView = document.getElementById(targetView);
        if (activeView) {
          activeView.style.display = 'block';
          activeView.scrollIntoView({ behavior: 'smooth' });
        }

        document.getElementById('navLinks')?.classList.remove('show');
      });
    });

    document.getElementById('openAdminLoginBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('adminLoginModal');
    });
  }

  // --- POPULATE PRODUCT DROPDOWNS ---
  populateProductDropdowns() {
    const activeProducts = db.getActiveProducts();
    const allProducts = db.getProducts();

    const qaDropdown = document.getElementById('qaProduct');
    if (qaDropdown) {
      qaDropdown.innerHTML = '<option value="" disabled selected>-- Pilih Produk --</option>' +
        activeProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    const shFilter = document.getElementById('salesHubProductFilter');
    if (shFilter) {
      const currentVal = shFilter.value;
      shFilter.innerHTML = '<option value="">Semua Kategori Produk</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      shFilter.value = currentVal;
    }

    const invFilter = document.getElementById('invProductFilter');
    if (invFilter) {
      const currentVal = invFilter.value;
      invFilter.innerHTML = '<option value="">Semua Produk</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      invFilter.value = currentVal;
    }

    const accProdSelect = document.getElementById('accFormProduct');
    if (accProdSelect) {
      accProdSelect.innerHTML = '<option value="" disabled selected>-- Pilih Kategori Produk --</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    const adminAccFilter = document.getElementById('adminAccProductFilter');
    if (adminAccFilter) {
      const currentVal = adminAccFilter.value;
      adminAccFilter.innerHTML = '<option value="">Semua Produk</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      adminAccFilter.value = currentVal;
    }

    const tplProdSelect = document.getElementById('tplFormProductId');
    if (tplProdSelect) {
      tplProdSelect.innerHTML = '<option value="" disabled selected>-- Pilih Produk Spesifik --</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  }

  // --- QUICK ACCESS SUBMISSION (HALAMAN VISITOR) ---
  async handleQuickAccessSubmit() {
    const accessType = document.getElementById('qaAccessType')?.value || 'ACCOUNT';
    const username = document.getElementById('qaUsername')?.value.trim() || '';
    const password = document.getElementById('qaPassword')?.value.trim() || '';
    const link = document.getElementById('qaLink')?.value.trim() || '';
    const linkNotes = document.getElementById('qaLinkNotes')?.value.trim() || '';
    const productId = document.getElementById('qaProduct').value;
    const customerWa = document.getElementById('qaCustomerWa').value.trim();
    const duration = document.getElementById('qaDuration').value.trim();
    const durationUnit = document.getElementById('qaDurationUnit').value;

    if (!productId || !customerWa || !duration || !durationUnit) {
      this.showToast('Silakan isi seluruh kolom wajib.', 'error');
      return;
    }

    if (accessType === 'LINK') {
      if (!link) {
        this.showToast('Silakan masukkan Link / URL Akses.', 'error');
        return;
      }
    } else {
      if (!username || !password) {
        this.showToast('Silakan masukkan Email/Username dan Password.', 'error');
        return;
      }

      // VALIDASI WAJIB ADA KARAKTER @ PADA EMAIL
      if (!username.includes('@')) {
        this.showToast("Email / Username wajib mengandung karakter '@' (e.g. user@gmail.com).", 'error');
        return;
      }
    }

    const product = db.getProductById(productId);
    const now = new Date();
    const expiresAt = TemplateEngine.calculateExpirationDate(now, duration, durationUnit);

    const isLinkType = accessType === 'LINK';

    const newAcc = await db.saveAccount({
      product_id: productId,
      access_type: isLinkType ? 'LINK' : 'ACCOUNT',
      username_or_email: isLinkType ? link : username,
      password: isLinkType ? '' : password,
      link: isLinkType ? link : '',
      status: 'TERKIRIM',
      customer_whatsapp: customerWa,
      duration: duration,
      duration_unit: durationUnit,
      sent_at: now.toISOString(),
      expires_at: expiresAt,
      notes: isLinkType ? (linkNotes || 'Link Undangan Akses') : 'Dikirim via Quick Access'
    });

    db.addTransaction({
      account_id: newAcc.id,
      product_id: productId,
      customer_whatsapp: customerWa,
      delivery_method: 'QUICK_ACCESS',
      duration: duration,
      duration_unit: durationUnit,
      sent_at: now.toISOString(),
      expires_at: expiresAt,
      status: 'TERKIRIM'
    });

    const activeTemplate = db.getTemplateForProduct(productId);
    const compiledMessage = TemplateEngine.compile(activeTemplate ? activeTemplate.content : '', {
      product: product ? product.name : '',
      access_type: isLinkType ? 'LINK' : 'ACCOUNT',
      username: isLinkType ? link : username,
      password: password,
      link: isLinkType ? link : '',
      duration: duration,
      duration_unit: durationUnit,
      customer_whatsapp: customerWa,
      notes: isLinkType ? linkNotes : '',
      sent_date: now,
      expires_date: expiresAt
    });

    await this.copyToClipboard(compiledMessage);
    this.showToast('✓ Akses berhasil dikirim!', 'success');
    this.showSentMessageResultModal(compiledMessage, customerWa);

    document.getElementById('quickAccessForm').reset();

    // RESET TOGGLE BUTTON KE EMAIL
    const emailBtn = document.querySelector('.qa-type-btn[data-type="ACCOUNT"]');
    if (emailBtn) emailBtn.click();

    this.renderInventoryTable();
    this.renderSalesHubInventory();
  }

  // --- RENDER SALES HUB INVENTORY PREVIEW (VISITOR VIEW) ---
  async renderSalesHubInventory() {
    const tbody = document.getElementById('salesHubInventoryTbody');
    if (!tbody) return;

    const prodFilter = document.getElementById('salesHubProductFilter')?.value || '';
    let accounts = db.getAccounts().filter(a => a.status === 'TERSEDIA');
    const products = db.getProducts();

    if (prodFilter) {
      accounts = accounts.filter(a => a.product_id === prodFilter);
    }

    if (accounts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada akun TERSEDIA di kategori ini.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    for (const acc of accounts) {
      const prod = products.find(p => p.id === acc.product_id);
      let badgeClass = 'badge-available';
      const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
      const linkVal = acc.link || acc.username_or_email;

      const usernameCell = isLink
        ? `<span class="link-text-field" title="${linkVal}">${linkVal.length > 35 ? linkVal.substring(0, 35) + '...' : linkVal}</span>`
        : acc.username_or_email;

      const passwordCell = isLink
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">(Link Akses)</span>`
        : `
          <span class="password-cell-container">
            <span class="password-text pwd-text-field" data-accid="${acc.id}">••••••••</span>
            <button class="eye-icon-btn inline-toggle-pwd" data-accid="${acc.id}">
              <i data-lucide="eye"></i>
            </button>
          </span>
        `;

      rowsHtml += `
        <tr>
          <td><strong>${prod ? prod.name : 'Produk'}</strong></td>
          <td>${usernameCell}</td>
          <td>${passwordCell}</td>
          <td><span class="badge ${badgeClass}">${acc.status}</span></td>
          <td style="text-align: right;">
            <button class="btn btn-primary btn-xs send-from-inv-btn" data-accid="${acc.id}">
              <i data-lucide="copy"></i> Kirim
            </button>
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();

    this.bindTableActionEvents(tbody);
  }

  // --- RENDER FULL INVENTORY TABLE (VISITOR VIEW) ---
  async renderInventoryTable() {
    const tbody = document.getElementById('inventoryTbody');
    if (!tbody) return;

    const searchStr = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
    const productFilter = document.getElementById('invProductFilter')?.value || '';
    const statusFilter = document.getElementById('invStatusFilter')?.value || '';

    let accounts = db.getAccounts();
    const products = db.getProducts();

    accounts = accounts.filter(acc => {
      const prod = products.find(p => p.id === acc.product_id);
      const accText = `${acc.username_or_email || ''} ${acc.link || ''}`.toLowerCase();
      const matchSearch = accText.includes(searchStr) || (prod && prod.name.toLowerCase().includes(searchStr));
      const matchProd = !productFilter || acc.product_id === productFilter;
      const matchStatus = !statusFilter || acc.status === statusFilter;
      return matchSearch && matchProd && matchStatus;
    });

    if (accounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <div class="empty-icon"><i data-lucide="inbox"></i></div>
            <div class="empty-text">Tidak ada akun yang ditemukan.</div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let rowsHtml = '';
    for (const acc of accounts) {
      const prod = products.find(p => p.id === acc.product_id);
      const prodName = prod ? prod.name : 'Produk';

      let badgeClass = 'badge-available';
      if (acc.status === 'TERKIRIM') badgeClass = 'badge-sent';
      if (acc.status === 'EXPIRED') badgeClass = 'badge-expired';

      const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
      const linkVal = acc.link || acc.username_or_email;

      const usernameCell = isLink
        ? `<span class="link-text-field" title="${linkVal}">${linkVal.length > 35 ? linkVal.substring(0, 35) + '...' : linkVal}</span>`
        : acc.username_or_email;

      const passwordCell = isLink
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">(Link Akses)</span>`
        : `
          <span class="password-cell-container">
            <span class="password-text pwd-text-field" data-accid="${acc.id}">••••••••</span>
            <button class="eye-icon-btn inline-toggle-pwd" data-accid="${acc.id}">
              <i data-lucide="eye"></i>
            </button>
          </span>
        `;

      rowsHtml += `
        <tr>
          <td><strong>${prodName}</strong></td>
          <td>${usernameCell}</td>
          <td>${passwordCell}</td>
          <td><span class="badge ${badgeClass}">${acc.status}</span></td>
          <td>${acc.customer_whatsapp || '-'}</td>
          <td>${TemplateEngine.formatDateIndo(acc.sent_at)}</td>
          <td>${TemplateEngine.formatDateIndo(acc.expires_at)}</td>
          <td style="text-align: right;">
            ${acc.status === 'TERSEDIA' ? `
              <button class="btn btn-primary btn-xs send-from-inv-btn" data-accid="${acc.id}">
                <i data-lucide="copy"></i> Kirim
              </button>
            ` : `
              <button class="btn btn-secondary btn-xs reset-acc-btn" data-accid="${acc.id}">
                <i data-lucide="rotate-ccw"></i> Batal Kirim
              </button>
            `}
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();

    this.bindTableActionEvents(tbody);
  }

  bindTableActionEvents(tbody) {
    tbody.querySelectorAll('.inline-toggle-pwd').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        const row = e.currentTarget.closest('tr');
        const span = row ? row.querySelector(`.pwd-text-field[data-accid="${id}"]`) : null;
        if (span) {
          if (span.innerText === '••••••••') {
            if (!this.decryptedPasswords[id]) {
              const acc = db.getAccountById(id);
              this.decryptedPasswords[id] = await CryptoUtil.decrypt(acc ? acc.encrypted_password : '');
            }
            span.innerText = this.decryptedPasswords[id] || 'N/A';
          } else {
            span.innerText = '••••••••';
          }
        }
      });
    });

    tbody.querySelectorAll('.send-from-inv-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        const acc = db.getAccountById(id);
        const prod = db.getProductById(acc ? acc.product_id : '');
        if (acc) {
          document.getElementById('invSendAccId').value = id;
          document.getElementById('invSendAccDetails').innerText = `${prod ? prod.name : 'Produk'} — ${acc.link || acc.username_or_email}`;
          document.getElementById('invSendCustomerWa').value = '';
          this.openModal('inventorySendModal');
        }
      });
    });

    tbody.querySelectorAll('.reset-acc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        document.getElementById('resetAccId').value = id;
        this.openModal('resetAccountModal');
      });
    });
  }

  // --- INVENTORY SEND SUBMISSION ---
  async handleInventorySendSubmit() {
    const accId = document.getElementById('invSendAccId').value;
    const customerWa = document.getElementById('invSendCustomerWa').value.trim();

    if (!customerWa) {
      this.showToast('Silakan masukkan nomor WhatsApp customer.', 'error');
      return;
    }

    const acc = db.getAccountById(accId);
    if (!acc) return;

    const prod = db.getProductById(acc.product_id);
    const duration = acc.duration || 30;
    const durationUnit = acc.duration_unit || 'Hari';

    const now = new Date();
    const expiresAt = TemplateEngine.calculateExpirationDate(now, duration, durationUnit);
    const rawPassword = acc.encrypted_password ? await CryptoUtil.decrypt(acc.encrypted_password) : '';

    await db.saveAccount({
      id: accId,
      status: 'TERKIRIM',
      customer_whatsapp: customerWa,
      duration: duration,
      duration_unit: durationUnit,
      sent_at: now.toISOString(),
      expires_at: expiresAt
    });

    db.addTransaction({
      account_id: accId,
      product_id: acc.product_id,
      customer_whatsapp: customerWa,
      delivery_method: 'INVENTORY',
      duration: duration,
      duration_unit: durationUnit,
      sent_at: now.toISOString(),
      expires_at: expiresAt,
      status: 'TERKIRIM'
    });

    const activeTemplate = db.getTemplateForProduct(acc.product_id);
    const compiledMessage = TemplateEngine.compile(activeTemplate ? activeTemplate.content : '', {
      product: prod ? prod.name : '',
      access_type: acc.access_type,
      username: acc.username_or_email,
      password: rawPassword,
      link: acc.link || acc.username_or_email,
      duration: duration,
      duration_unit: durationUnit,
      customer_whatsapp: customerWa,
      notes: acc.notes || '',
      sent_date: now,
      expires_date: expiresAt
    });

    await this.copyToClipboard(compiledMessage);
    this.closeModal('inventorySendModal');
    this.showToast('✓ Akses berhasil dikirim!', 'success');
    this.showSentMessageResultModal(compiledMessage, customerWa);

    this.renderInventoryTable();
    this.renderSalesHubInventory();
    if (this.currentAdmin) this.renderAdminAccounts();
  }

  // --- TRACK EXPIRATION SEARCH ---
  handleTrackSearch() {
    const query = document.getElementById('trackQuery').value.trim().toLowerCase();
    const container = document.getElementById('trackResultContainer');
    if (!query || !container) return;

    const accounts = db.getAccounts();
    const products = db.getProducts();

    const matches = accounts.filter(a =>
      (a.customer_whatsapp && a.customer_whatsapp.toLowerCase().includes(query)) ||
      (a.username_or_email && a.username_or_email.toLowerCase().includes(query)) ||
      (a.link && a.link.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i data-lucide="help-circle"></i></div>
          <div class="empty-text">Tidak ada data pesanan ditemukan untuk pencarian tersebut.</div>
        </div>
      `;
      container.style.display = 'block';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    const now = new Date();

    matches.forEach(acc => {
      const prod = products.find(p => p.id === acc.product_id);
      const prodName = prod ? prod.name : 'Digital Product';

      let statusBadge = `<span class="badge badge-sent">AKTIF</span>`;
      let sisaMasaAktifStr = '-';

      if (acc.expires_at) {
        const expDate = new Date(acc.expires_at);
        const diffMs = expDate - now;

        if (diffMs <= 0 || acc.status === 'EXPIRED') {
          statusBadge = `<span class="badge badge-expired">EXPIRED</span>`;
          sisaMasaAktifStr = '<span style="color: var(--status-expired); font-weight:700;">Masa aktif akun ini telah berakhir.</span>';
        } else {
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          sisaMasaAktifStr = `<strong>${diffDays} Hari</strong>`;
        }
      }

      const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
      const linkVal = acc.link || acc.username_or_email;

      cardsHtml += `
        <div class="track-result-card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.85rem;">
            <div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Produk</span>
              <h3 style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--text-main);">${prodName}</h3>
            </div>
            <div>${statusBadge}</div>
          </div>
          <div class="track-grid">
            <div class="track-item">
              <span class="track-label">${isLink ? 'Link Akses / Undangan' : 'Email / Username'}</span>
              <span class="track-value">${isLink ? `<span class="link-text-field">${linkVal}</span>` : acc.username_or_email}</span>
            </div>
            <div class="track-item">
              <span class="track-label">WhatsApp Customer</span>
              <span class="track-value">${acc.customer_whatsapp || '-'}</span>
            </div>
            <div class="track-item">
              <span class="track-label">Tanggal Aktivasi</span>
              <span class="track-value">${TemplateEngine.formatDateIndo(acc.sent_at)}</span>
            </div>
            <div class="track-item">
              <span class="track-label">Tanggal Expired</span>
              <span class="track-value">${TemplateEngine.formatDateIndo(acc.expires_at)}</span>
            </div>
            <div class="track-item" style="grid-column: 1 / -1; margin-top: 0.5rem; background: var(--bg-surface-hover); padding: 0.75rem; border-radius: var(--radius-sm);">
              <span class="track-label">Sisa Masa Aktif</span>
              <div class="track-value">${sisaMasaAktifStr}</div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
    container.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }

  // --- ADMIN AUTHENTICATION ---
  async handleAdminLogin() {
    const pin = document.getElementById('loginPassword').value.trim();

    if (!pin) {
      this.showToast('Silakan masukkan PIN Admin.', 'error');
      return;
    }

    const verified = await db.verifyAdmin('admin', pin);
    if (verified) {
      sessionStorage.setItem('accexpress_admin', 'admin');
      this.currentAdmin = 'admin';
      db.addActivityLog('admin', 'Admin Login', 'sistem', `Admin berhasil masuk`);
      this.showToast('✓ Verifikasi PIN Berhasil! Selamat datang Admin.', 'success');
      document.getElementById('loginPassword').value = '';
      this.closeModal('adminLoginModal');
      this.showAdminPanel();
    } else {
      this.showToast('PIN Admin salah. Silakan coba lagi.', 'error');
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginPassword').focus();
    }
  }

  // --- ADMIN DASHBOARD RENDER ---
  renderAdminDashboard() {
    const accounts = db.getAccounts();
    const products = db.getProducts();
    const transactions = db.getTransactions();
    const now = new Date();

    const totalCount = accounts.length;
    const availableCount = accounts.filter(a => a.status === 'TERSEDIA').length;
    const activeCount = accounts.filter(a => a.status === 'TERKIRIM').length;

    const expiredAccs = accounts.filter(a => {
      if (a.status === 'EXPIRED') return true;
      if (a.status === 'TERKIRIM' && a.expires_at) {
        return new Date(a.expires_at) <= now;
      }
      return false;
    });

    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const expiringSoonAccs = accounts.filter(a => {
      if (a.status === 'TERKIRIM' && a.expires_at) {
        const exp = new Date(a.expires_at);
        const diff = exp - now;
        return diff > 0 && diff <= twelveHoursMs;
      }
      return false;
    });

    document.getElementById('statTotalAccounts').innerText = totalCount.toLocaleString('id-ID');
    document.getElementById('statAvailableAccounts').innerText = availableCount.toLocaleString('id-ID');
    document.getElementById('statActiveAccounts').innerText = activeCount.toLocaleString('id-ID');
    document.getElementById('statExpiringSoonAccounts').innerText = expiringSoonAccs.length.toLocaleString('id-ID');
    document.getElementById('statExpiredTotalAccounts').innerText = expiredAccs.length.toLocaleString('id-ID');

    const chartContainer = document.getElementById('productStockChart');
    if (chartContainer) {
      let chartHtml = '';
      products.forEach(prod => {
        const prodAccs = accounts.filter(a => a.product_id === prod.id);
        const prodTotal = prodAccs.length;
        const prodAvailable = prodAccs.filter(a => a.status === 'TERSEDIA').length;
        const pct = prodTotal > 0 ? Math.round((prodAvailable / prodTotal) * 100) : 0;

        chartHtml += `
          <div class="chart-row">
            <div class="chart-header">
              <span>${prod.name}</span>
              <span style="color: var(--accent-secondary);">${pct}% (${prodAvailable}/${prodTotal} tersedia)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      });
      chartContainer.innerHTML = chartHtml || '<div style="color: var(--text-muted);">Belum ada produk.</div>';
    }

    const expiringWrapper = document.getElementById('expiringSoonCardWrapper');
    const expContainer = document.getElementById('expiringSoonContainer');
    if (expiringWrapper && expContainer) {
      if (expiringSoonAccs.length === 0) {
        expiringWrapper.style.display = 'none';
      } else {
        expiringWrapper.style.display = 'block';
        let expHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
        expiringSoonAccs.forEach(acc => {
          const prod = products.find(p => p.id === acc.product_id);
          const expDate = new Date(acc.expires_at);
          const hoursLeft = Math.max(1, Math.round((expDate - now) / (1000 * 60 * 60)));

          expHtml += `
            <div class="activity-item" style="border-left: 3px solid var(--status-warning); padding: 0.5rem;">
              <div>
                <strong>${prod ? prod.name : 'Produk'}</strong> — ${acc.link || acc.username_or_email}
                <div style="font-size: 0.75rem; color: var(--text-muted);">Customer: ${acc.customer_whatsapp || '-'}</div>
              </div>
              <span class="badge badge-warning">Expired dlm ${hoursLeft} Jam</span>
            </div>
          `;
        });
        expHtml += '</div>';
        expContainer.innerHTML = expHtml;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    const expiredWrapper = document.getElementById('expiredAccountsCardWrapper');
    const expiredListContainer = document.getElementById('expiredAccountsContainer');
    if (expiredWrapper && expiredListContainer) {
      if (expiredAccs.length === 0) {
        expiredWrapper.style.display = 'none';
      } else {
        expiredWrapper.style.display = 'block';
        let listHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
        expiredAccs.forEach(acc => {
          const prod = products.find(p => p.id === acc.product_id);
          listHtml += `
            <div class="activity-item" style="border-left: 4px solid var(--status-expired); background: var(--bg-surface-hover);">
              <div>
                <strong>${prod ? prod.name : 'Produk'}</strong> — ${acc.link || acc.username_or_email}
                <div style="font-size: 0.78rem; color: var(--text-muted);">WA Customer: ${acc.customer_whatsapp || '-'} | Expired: ${TemplateEngine.formatDateIndo(acc.expires_at)}</div>
              </div>
              <div class="action-buttons-cell">
                <span class="badge badge-expired">EXPIRED</span>
                <button class="btn btn-secondary btn-xs reset-acc-btn" data-accid="${acc.id}"><i data-lucide="rotate-ccw"></i> Reset Stock</button>
              </div>
            </div>
          `;
        });
        listHtml += '</div>';
        expiredListContainer.innerHTML = listHtml;

        expiredListContainer.querySelectorAll('.reset-acc-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-accid');
            document.getElementById('resetAccId').value = id;
            this.openModal('resetAccountModal');
          });
        });
      }
      if (window.lucide) window.lucide.createIcons();
    }

    const feedContainer = document.getElementById('recentActivityFeed');
    if (feedContainer) {
      const recentTx = transactions.slice(0, 6);
      if (recentTx.length === 0) {
        feedContainer.innerHTML = `<div class="empty-state" style="padding: 1rem 0;"><div class="empty-text">Belum ada transaksi.</div></div>`;
      } else {
        let feedHtml = '';
        recentTx.forEach(tx => {
          const prod = products.find(p => p.id === tx.product_id);
          feedHtml += `
            <div class="activity-item">
              <div class="activity-info">
                <i data-lucide="send" style="color: var(--accent-primary);"></i>
                <div>
                  <strong>${prod ? prod.name : 'Produk'}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Customer: ${tx.customer_whatsapp} | Metode: ${tx.delivery_method}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge badge-sent">${tx.status}</span>
                <div class="activity-time">${TemplateEngine.formatDateIndo(tx.sent_at)}</div>
              </div>
            </div>
          `;
        });
        feedHtml += '</div>';
        feedContainer.innerHTML = feedHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // --- ADMIN ACCOUNTS TAB ---
  renderAdminAccounts() {
    const tbody = document.getElementById('adminAccTbody');
    if (!tbody) return;

    const search = (document.getElementById('adminAccSearch')?.value || '').toLowerCase();
    const prodFilter = document.getElementById('adminAccProductFilter')?.value || '';
    const statusFilter = document.getElementById('adminAccStatusFilter')?.value || '';

    let accounts = db.getAccounts();
    const products = db.getProducts();

    accounts = accounts.filter(acc => {
      const prod = products.find(p => p.id === acc.product_id);
      const accText = `${acc.username_or_email || ''} ${acc.link || ''}`.toLowerCase();
      const matchSearch = accText.includes(search) || (prod && prod.name.toLowerCase().includes(search));
      const matchProd = !prodFilter || acc.product_id === prodFilter;
      const matchStatus = !statusFilter || acc.status === statusFilter;
      return matchSearch && matchProd && matchStatus;
    });

    if (accounts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Tidak ada akun ditemukan.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    accounts.forEach(acc => {
      const prod = products.find(p => p.id === acc.product_id);
      let badgeClass = 'badge-available';
      if (acc.status === 'TERKIRIM') badgeClass = 'badge-sent';
      if (acc.status === 'EXPIRED') badgeClass = 'badge-expired';

      const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
      const linkVal = acc.link || acc.username_or_email;

      const usernameCell = isLink
        ? `<span class="link-text-field" title="${linkVal}">${linkVal.length > 35 ? linkVal.substring(0, 35) + '...' : linkVal}</span>`
        : acc.username_or_email;

      const passwordCell = isLink
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">(Link Akses)</span>`
        : `
          <span class="password-cell-container">
            <span class="password-text pwd-text-field" data-accid="${acc.id}">••••••••</span>
            <button class="eye-icon-btn admin-toggle-pwd" data-accid="${acc.id}">
              <i data-lucide="eye"></i>
            </button>
          </span>
        `;

      rowsHtml += `
        <tr>
          <td><strong>${prod ? prod.name : '-'}</strong></td>
          <td>${usernameCell}</td>
          <td>${passwordCell}</td>
          <td><span class="badge ${badgeClass}">${acc.status}</span></td>
          <td>${acc.customer_whatsapp || '-'}</td>
          <td>${TemplateEngine.formatDateIndo(acc.sent_at)}</td>
          <td>${TemplateEngine.formatDateIndo(acc.expires_at)}</td>
          <td>${acc.notes || '-'}</td>
          <td style="text-align: right;">
            <div class="action-buttons-cell">
              <button class="btn btn-secondary btn-xs edit-acc-btn" data-accid="${acc.id}"><i data-lucide="edit-3"></i> Edit</button>
              <button class="btn btn-danger btn-xs delete-acc-btn" data-accid="${acc.id}"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();

    tbody.querySelectorAll('.admin-toggle-pwd').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        const row = e.currentTarget.closest('tr');
        const span = row ? row.querySelector(`.pwd-text-field[data-accid="${id}"]`) : null;
        if (span) {
          if (span.innerText === '••••••••') {
            if (!this.decryptedPasswords[id]) {
              const acc = db.getAccountById(id);
              this.decryptedPasswords[id] = await CryptoUtil.decrypt(acc ? acc.encrypted_password : '');
            }
            span.innerText = this.decryptedPasswords[id] || 'N/A';
          } else {
            span.innerText = '••••••••';
          }
        }
      });
    });

    tbody.querySelectorAll('.edit-acc-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        const acc = db.getAccountById(id);
        if (acc) {
          this.populateProductDropdowns();
          document.getElementById('accFormId').value = acc.id;
          document.getElementById('accFormProduct').value = acc.product_id;

          const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
          document.getElementById('accFormAccessType').value = isLink ? 'LINK' : 'ACCOUNT';

          const pwdGrp = document.getElementById('accEmailPasswordGroup');
          const linkGrp = document.getElementById('accLinkGroup');
          if (isLink) {
            if (pwdGrp) pwdGrp.style.display = 'none';
            if (linkGrp) linkGrp.style.display = 'block';
            document.getElementById('accFormLink').value = acc.link || acc.username_or_email || '';
          } else {
            if (pwdGrp) pwdGrp.style.display = 'block';
            if (linkGrp) linkGrp.style.display = 'none';
            document.getElementById('accFormUsername').value = acc.username_or_email || '';
            const rawPass = acc.encrypted_password ? await CryptoUtil.decrypt(acc.encrypted_password) : '';
            document.getElementById('accFormPassword').value = rawPass;
          }

          document.getElementById('accFormDuration').value = acc.duration || '';
          document.getElementById('accFormUnit').value = acc.duration_unit || '';
          document.getElementById('accFormNotes').value = acc.notes || '';
          document.getElementById('accountModalTitle').innerText = 'Edit Akun / Link Akses';
          this.openModal('accountModal');
        }
      });
    });

    tbody.querySelectorAll('.delete-acc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-accid');
        document.getElementById('deleteTargetType').value = 'account';
        document.getElementById('deleteTargetId').value = id;
        this.openModal('deleteConfirmModal');
      });
    });
  }

  // --- SAVE ACCOUNT HANDLER (ADMIN PANEL) ---
  async handleSaveAccount() {
    const id = document.getElementById('accFormId').value;
    const productId = document.getElementById('accFormProduct').value;
    const accessType = document.getElementById('accFormAccessType').value;
    const username = document.getElementById('accFormUsername').value.trim();
    const password = document.getElementById('accFormPassword').value.trim();
    const link = document.getElementById('accFormLink').value.trim();
    const duration = document.getElementById('accFormDuration').value;
    const durationUnit = document.getElementById('accFormUnit').value;
    const notes = document.getElementById('accFormNotes').value.trim();

    if (!productId || !duration || !durationUnit) {
      this.showToast('Silakan lengkapi Kategori Produk, Durasi, dan Satuan Waktu.', 'error');
      return;
    }

    if (accessType === 'LINK') {
      if (!link) {
        this.showToast('Silakan masukkan Link / URL Akses.', 'error');
        return;
      }
    } else {
      if (!username || !password) {
        this.showToast('Silakan masukkan Email/Username dan Password.', 'error');
        return;
      }

      // VALIDASI WAJIB ADA KARAKTER @ PADA EMAIL
      if (!username.includes('@')) {
        this.showToast("Email / Username wajib mengandung karakter '@' (e.g. customer@gmail.com).", 'error');
        return;
      }
    }

    const saved = await db.saveAccount({
      id: id || undefined,
      product_id: productId,
      access_type: accessType,
      username_or_email: accessType === 'LINK' ? link : username,
      password: accessType === 'LINK' ? '' : password,
      link: accessType === 'LINK' ? link : '',
      duration: duration,
      duration_unit: durationUnit,
      notes: notes
    });

    const displayTitle = accessType === 'LINK' ? 'Link Akses' : username;
    db.addActivityLog(this.currentAdmin, id ? 'Akun Diperbarui' : 'Akun Dibuat', 'akun', `${id ? 'Update' : 'Tambah'} ${displayTitle}`, saved.id);
    this.showToast(`✓ Data ${accessType === 'LINK' ? 'Link Akses' : username} berhasil ${id ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    this.closeModal('accountModal');

    const searchEl = document.getElementById('adminAccSearch');
    const prodFilterEl = document.getElementById('adminAccProductFilter');
    const statusFilterEl = document.getElementById('adminAccStatusFilter');
    if (searchEl) searchEl.value = '';
    if (prodFilterEl) prodFilterEl.value = '';
    if (statusFilterEl) statusFilterEl.value = '';

    this.renderAdminAccounts();
    this.renderAdminDashboard();
    this.renderInventoryTable();
    this.renderSalesHubInventory();
  }

  // --- ADMIN PRODUCTS TAB ---
  renderAdminProducts() {
    const tbody = document.getElementById('adminProdTbody');
    if (!tbody) return;

    const products = db.getProducts();
    const accounts = db.getAccounts();

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada kategori produk.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    products.forEach(prod => {
      const prodAccs = accounts.filter(a => a.product_id === prod.id);
      const availCount = prodAccs.filter(a => a.status === 'TERSEDIA').length;
      const activeCount = prodAccs.filter(a => a.status === 'TERKIRIM').length;
      const isAktif = prod.status === 'Aktif';

      rowsHtml += `
        <tr>
          <td><strong>${prod.name}</strong></td>
          <td><span class="badge badge-available">${availCount} Tersedia</span></td>
          <td><span class="badge badge-sent">${activeCount} Terkirim</span></td>
          <td>
            <span class="badge ${isAktif ? 'badge-available' : 'badge-expired'}">${prod.status}</span>
          </td>
          <td style="text-align: right;">
            <div class="action-buttons-cell">
              <button class="btn btn-secondary btn-xs edit-prod-btn" data-prodid="${prod.id}"><i data-lucide="edit-3"></i> Edit</button>
              <button class="btn btn-danger btn-xs delete-prod-btn" data-prodid="${prod.id}"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();

    tbody.querySelectorAll('.edit-prod-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-prodid');
        const prod = db.getProductById(id);
        if (prod) {
          document.getElementById('prodFormId').value = prod.id;
          document.getElementById('prodFormName').value = prod.name;
          document.getElementById('prodFormStatus').value = prod.status;
          document.getElementById('productModalTitle').innerText = 'Edit Kategori Produk';
          this.openModal('productModal');
        }
      });
    });

    tbody.querySelectorAll('.delete-prod-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-prodid');
        document.getElementById('deleteTargetType').value = 'product';
        document.getElementById('deleteTargetId').value = id;
        this.openModal('deleteConfirmModal');
      });
    });
  }

  // --- SAVE PRODUCT HANDLER ---
  handleSaveProduct() {
    const id = document.getElementById('prodFormId').value;
    const name = document.getElementById('prodFormName').value.trim();
    const status = document.getElementById('prodFormStatus').value;

    if (!name) {
      this.showToast('Nama Kategori Produk tidak boleh kosong.', 'error');
      return;
    }

    const saved = db.saveProduct({
      id: id || undefined,
      name,
      status: status
    });

    db.addActivityLog(this.currentAdmin, id ? 'Produk Diperbarui' : 'Produk Dibuat', 'produk', `${id ? 'Update' : 'Tambah'} kategori ${name}`, saved.id);
    this.showToast(`✓ Kategori Produk ${name} berhasil ${id ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    this.closeModal('productModal');
    this.renderAdminProducts();
    this.populateProductDropdowns();
  }

  // --- ADMIN TEMPLATES TAB ---
  renderAdminTemplates() {
    const tbody = document.getElementById('adminTplTbody');
    if (!tbody) return;

    const typeFilter = document.getElementById('tplTypeFilter')?.value || '';
    let templates = db.getTemplates();
    const products = db.getProducts();

    if (typeFilter) {
      templates = templates.filter(t => t.type === typeFilter);
    }

    if (templates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada template pesan di kategori ini.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    templates.forEach(tpl => {
      const prod = products.find(p => p.id === tpl.product_id);
      const snippet = tpl.content.length > 55 ? tpl.content.substring(0, 55) + '...' : tpl.content;
      const typeLabel = tpl.type === 'PRODUCT' ? `<span class="badge badge-sent">Produk: ${prod ? prod.name : 'Spesifik'}</span>` : `<span class="badge badge-available">Global</span>`;

      rowsHtml += `
        <tr>
          <td><strong>${tpl.name}</strong></td>
          <td>${typeLabel}</td>
          <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted); cursor: pointer;" class="preview-tpl-cell" data-tplid="${tpl.id}" title="Klik untuk lihat pratinjau">${snippet}</td>
          <td>
            ${tpl.is_default ? '<span class="badge badge-available">UTAMA</span>' : '<span class="badge badge-sent">SEKUNDER</span>'}
          </td>
          <td style="text-align: right;">
            <div class="action-buttons-cell">
              <button class="btn btn-info btn-xs preview-tpl-btn" data-tplid="${tpl.id}" title="Pratinjau Template"><i data-lucide="eye"></i> Pratinjau</button>
              ${!tpl.is_default ? `
                <button class="btn btn-success btn-xs set-default-tpl-btn" data-tplid="${tpl.id}">Utama</button>
              ` : ''}
              <button class="btn btn-secondary btn-xs edit-tpl-btn" data-tplid="${tpl.id}"><i data-lucide="edit-3"></i> Edit</button>
              ${!tpl.is_default ? `<button class="btn btn-danger btn-xs delete-tpl-btn" data-tplid="${tpl.id}"><i data-lucide="trash-2"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();

    // Event Listener Tombol / Cell Pratinjau Template
    tbody.querySelectorAll('.preview-tpl-btn, .preview-tpl-cell').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-tplid');
        const tpls = db.getTemplates();
        const tpl = tpls.find(t => t.id === id);
        if (!tpl) return;

        const allProds = db.getProducts();
        const prod = allProds.find(p => p.id === tpl.product_id) || db.getActiveProducts()[0] || { name: 'Produk Digital' };
        
        const existingAccs = prod && prod.id ? db.getAccountsByProductId(prod.id) : [];
        const sampleAcc = existingAccs.find(a => a.access_type === 'LINK' || a.link) || existingAccs[0];

        let isLinkProd = false;
        let sampleLink = 'https://akses-produk.com/join-invite-sample';
        let sampleUser = 'customer.user@gmail.com';

        if (sampleAcc) {
          isLinkProd = sampleAcc.access_type === 'LINK' || Boolean(sampleAcc.link) || (sampleAcc.username_or_email && sampleAcc.username_or_email.startsWith('http'));
          sampleLink = sampleAcc.link || sampleAcc.username_or_email || sampleLink;
          sampleUser = isLinkProd ? sampleLink : sampleAcc.username_or_email;
        } else {
          isLinkProd = tpl.content.includes('{{link}}') || tpl.content.includes('{{link_akses}}') || tpl.content.includes('{{url_akses}}');
          if (isLinkProd) sampleUser = sampleLink;
        }

        const compiled = TemplateEngine.compile(tpl.content, {
          product: prod ? prod.name : 'Produk Digital',
          access_type: isLinkProd ? 'LINK' : 'ACCOUNT',
          username: sampleUser,
          password: isLinkProd ? '-' : 'secretPassword123',
          link: sampleLink,
          duration: sampleAcc ? sampleAcc.duration : 30,
          duration_unit: sampleAcc ? sampleAcc.duration_unit : 'Hari',
          customer_whatsapp: '081234567890',
          notes: sampleAcc ? (sampleAcc.notes || 'Catatan Akses') : (isLinkProd ? 'Link Undangan Akses Produk' : 'Profile 1 PIN 1234'),
          sent_date: new Date(),
          expires_date: TemplateEngine.calculateExpirationDate(new Date(), 30, 'Hari')
        });

        const outputEl = document.getElementById('templatePreviewOutput');
        if (outputEl) {
          outputEl.innerText = compiled;
        }
        this.openModal('templatePreviewModal');
      });
    });

    tbody.querySelectorAll('.set-default-tpl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-tplid');
        db.setDefaultTemplate(id);
        db.addActivityLog(this.currentAdmin, 'Template Utama Diubah', 'template', `Mengubah template ID ${id} menjadi default`);
        this.showToast('✓ Template berhasil dijadikan utama.', 'success');
        this.renderAdminTemplates();
      });
    });

    tbody.querySelectorAll('.edit-tpl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-tplid');
        const tpls = db.getTemplates();
        const tpl = tpls.find(t => t.id === id);
        if (tpl) {
          this.populateProductDropdowns();
          document.getElementById('tplFormId').value = tpl.id;
          document.getElementById('tplFormName').value = tpl.name;
          document.getElementById('tplFormType').value = tpl.type || 'GLOBAL';
          document.getElementById('tplFormProductId').value = tpl.product_id || '';
          document.getElementById('tplFormProductGroup').style.display = tpl.type === 'PRODUCT' ? 'block' : 'none';
          document.getElementById('tplFormContent').value = tpl.content;
          document.getElementById('templateModalTitle').innerText = 'Edit Template Pesan';
          this.openModal('templateModal');
        }
      });
    });

    tbody.querySelectorAll('.delete-tpl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-tplid');
        document.getElementById('deleteTargetType').value = 'template';
        document.getElementById('deleteTargetId').value = id;
        this.openModal('deleteConfirmModal');
      });
    });
  }

  handleSaveTemplate() {
    const id = document.getElementById('tplFormId').value;
    const name = document.getElementById('tplFormName').value.trim();
    const type = document.getElementById('tplFormType').value;
    const productId = document.getElementById('tplFormProductId').value;
    const content = document.getElementById('tplFormContent').value.trim();

    if (!name || !content) {
      this.showToast('Silakan lengkapi nama dan isi template.', 'error');
      return;
    }

    const saved = db.saveTemplate({
      id: id || undefined,
      name,
      type,
      product_id: type === 'PRODUCT' ? productId : '',
      content
    });

    db.addActivityLog(this.currentAdmin, id ? 'Template Diperbarui' : 'Template Dibuat', 'template', `${id ? 'Update' : 'Tambah'} template ${name}`, saved.id);
    this.showToast(`✓ Template berhasil ${id ? 'diperbarui' : 'ditambahkan'}.`, 'success');
    this.closeModal('templateModal');
    this.renderAdminTemplates();
  }

  // --- ADMIN TRANSACTIONS TAB ---
  renderAdminTransactions() {
    const tbody = document.getElementById('adminTxTbody');
    if (!tbody) return;

    const search = (document.getElementById('txSearch')?.value || '').toLowerCase();
    const methodFilter = document.getElementById('txMethodFilter')?.value || '';

    let txs = db.getTransactions();
    const products = db.getProducts();

    txs = txs.filter(tx => {
      const matchSearch = tx.customer_whatsapp.toLowerCase().includes(search);
      const matchMethod = !methodFilter || tx.delivery_method === methodFilter;
      return matchSearch && matchMethod;
    });

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada riwayat transaksi.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    txs.forEach(tx => {
      const prod = products.find(p => p.id === tx.product_id);
      rowsHtml += `
        <tr>
          <td>${TemplateEngine.formatDateIndo(tx.sent_at)}</td>
          <td><strong>${prod ? prod.name : '-'}</strong></td>
          <td>${tx.customer_whatsapp}</td>
          <td><span class="badge badge-sent">${tx.delivery_method}</span></td>
          <td>${tx.duration} ${tx.duration_unit}</td>
          <td>${TemplateEngine.formatDateIndo(tx.expires_at)}</td>
          <td><span class="badge badge-available">${tx.status}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  // --- ADMIN ACTIVITY LOG TAB ---
  renderAdminLogs() {
    const tbody = document.getElementById('adminLogTbody');
    if (!tbody) return;

    const logs = db.getActivityLogs();
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada log aktivitas.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    logs.forEach(l => {
      rowsHtml += `
        <tr>
          <td style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${TemplateEngine.formatDateIndo(l.created_at)}</td>
          <td><strong style="color: var(--accent-primary);">@${l.admin_id}</strong></td>
          <td><span class="badge badge-available">${l.action}</span></td>
          <td><span class="badge badge-sent">${l.target_type}</span></td>
          <td>${l.description}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  // --- ADMIN SETTINGS TAB ---
  renderAdminSettings() {
    const settings = db.getSettings();
    document.getElementById('setWebName').value = settings.web_name || '';
    document.getElementById('setShopName').value = settings.shop_name || '';
    document.getElementById('setShopWa').value = settings.shop_whatsapp || '';
  }

  // --- DOWNLOAD DATA AKUN KE EXCEL (.XLSX) MULTI-SHEET ---
  async downloadAccountsExcel(sourceView = 'inventory') {
    try {
      let accounts = db.getAccounts();
      const products = db.getProducts();

      // Filter data sesuai view sumber yang memanggil
      if (sourceView === 'saleshub') {
        const prodFilter = document.getElementById('salesHubProductFilter')?.value || '';
        accounts = accounts.filter(acc => acc.status === 'TERSEDIA');
        if (prodFilter) {
          accounts = accounts.filter(acc => acc.product_id === prodFilter);
        }
      } else if (sourceView === 'inventory') {
        const searchStr = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
        const productFilter = document.getElementById('invProductFilter')?.value || '';
        const statusFilter = document.getElementById('invStatusFilter')?.value || '';

        accounts = accounts.filter(acc => {
          const prod = products.find(p => p.id === acc.product_id);
          const accText = `${acc.username_or_email || ''} ${acc.link || ''}`.toLowerCase();
          const matchSearch = accText.includes(searchStr) || (prod && prod.name.toLowerCase().includes(searchStr));
          const matchProd = !productFilter || acc.product_id === productFilter;
          const matchStatus = !statusFilter || acc.status === statusFilter;
          return matchSearch && matchProd && matchStatus;
        });
      } else if (sourceView === 'admin') {
        const search = (document.getElementById('adminAccSearch')?.value || '').toLowerCase();
        const prodFilter = document.getElementById('adminAccProductFilter')?.value || '';
        const statusFilter = document.getElementById('adminAccStatusFilter')?.value || '';

        accounts = accounts.filter(acc => {
          const prod = products.find(p => p.id === acc.product_id);
          const accText = `${acc.username_or_email || ''} ${acc.link || ''}`.toLowerCase();
          const matchSearch = accText.includes(search) || (prod && prod.name.toLowerCase().includes(search));
          const matchProd = !prodFilter || acc.product_id === prodFilter;
          const matchStatus = !statusFilter || acc.status === statusFilter;
          return matchSearch && matchProd && matchStatus;
        });
      }

      if (accounts.length === 0) {
        this.showToast('Tidak ada data akun yang dapat diunduh.', 'error');
        return;
      }

      this.showToast('Memproses unduhan data Excel...', 'info', 2000);

      // Dekripsi password untuk seluruh akun secara async
      const decryptedPassMap = {};
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const isLink = acc.access_type === 'LINK' || Boolean(acc.link);
        if (!isLink && acc.encrypted_password) {
          try {
            decryptedPassMap[acc.id] = await CryptoUtil.decrypt(acc.encrypted_password) || '-';
          } catch (e) {
            decryptedPassMap[acc.id] = '(Gagal dekripsi)';
          }
        } else if (isLink) {
          decryptedPassMap[acc.id] = '(Link Akses)';
        }
      }

      // Helper function untuk memformat list akun menjadi baris objek Excel
      const formatAccListToExcelRows = (accList) => {
        return accList.map((acc, idx) => {
          const prod = products.find(p => p.id === acc.product_id);
          const isLink = acc.access_type === 'LINK' || Boolean(acc.link);

          return {
            'No': idx + 1,
            'Produk': prod ? prod.name : 'Unknown Product',
            'Tipe Akses': isLink ? 'LINK' : 'ACCOUNT',
            'Email / Username / Link': isLink ? (acc.link || acc.username_or_email) : (acc.username_or_email || '-'),
            'Password': decryptedPassMap[acc.id] || '-',
            'Status': acc.status || 'TERSEDIA',
            'WhatsApp Customer': acc.customer_whatsapp || '-',
            'Durasi': acc.duration ? `${acc.duration} ${acc.duration_unit || 'Hari'}` : '-',
            'Tanggal Kirim': acc.sent_at ? TemplateEngine.formatDateIndo(acc.sent_at) : '-',
            'Tanggal Expired': acc.expires_at ? TemplateEngine.formatDateIndo(acc.expires_at) : '-',
            'Catatan / Info': acc.notes || '-'
          };
        });
      };

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `Data_Akun_AccExpress_${dateStr}.xlsx`;

      // Jika SheetJS (window.XLSX) tersedia, buat workbook multi-sheet
      if (window.XLSX && window.XLSX.utils) {
        const workbook = window.XLSX.utils.book_new();

        const colWidths = [
          { wch: 6 },   // No
          { wch: 22 },  // Produk
          { wch: 12 },  // Tipe Akses
          { wch: 38 },  // Email / Link
          { wch: 22 },  // Password
          { wch: 14 },  // Status
          { wch: 18 },  // WA Customer
          { wch: 14 },  // Durasi
          { wch: 22 },  // Tgl Kirim
          { wch: 22 },  // Tgl Expired
          { wch: 28 }   // Catatan
        ];

        const usedSheetNames = new Set();
        const addSheet = (dataRows, rawSheetName) => {
          if (!dataRows || dataRows.length === 0) return;
          let cleanName = rawSheetName.replace(/[:\\/?*\[\]]/g, '').slice(0, 30).trim();
          if (!cleanName) cleanName = 'Data';

          let finalName = cleanName;
          let counter = 1;
          while (usedSheetNames.has(finalName.toLowerCase())) {
            finalName = `${cleanName.slice(0, 26)} (${counter})`;
            counter++;
          }
          usedSheetNames.add(finalName.toLowerCase());

          const ws = window.XLSX.utils.json_to_sheet(dataRows);
          ws['!cols'] = colWidths;
          window.XLSX.utils.book_append_sheet(workbook, ws, finalName);
        };

        // 1. Sheet Utama: "Semua Data Akun"
        addSheet(formatAccListToExcelRows(accounts), 'Semua Data Akun');

        // 2. Sheet Berdasarkan Status Akun (TERSEDIA, TERKIRIM, EXPIRED)
        const tersediaList = accounts.filter(a => a.status === 'TERSEDIA');
        if (tersediaList.length > 0) {
          addSheet(formatAccListToExcelRows(tersediaList), 'Stok TERSEDIA');
        }

        const terkirimList = accounts.filter(a => a.status === 'TERKIRIM');
        if (terkirimList.length > 0) {
          addSheet(formatAccListToExcelRows(terkirimList), 'Stok TERKIRIM');
        }

        const expiredList = accounts.filter(a => a.status === 'EXPIRED');
        if (expiredList.length > 0) {
          addSheet(formatAccListToExcelRows(expiredList), 'Stok EXPIRED');
        }

        // 3. Sheet Berdasarkan Kategori Produk
        products.forEach(prod => {
          const prodAccs = accounts.filter(a => a.product_id === prod.id);
          if (prodAccs.length > 0) {
            addSheet(formatAccListToExcelRows(prodAccs), `Produk - ${prod.name}`);
          }
        });

        window.XLSX.writeFile(workbook, filename);
      } else {
        const allRows = formatAccListToExcelRows(accounts);
        this.downloadCSVFallback(allRows, filename.replace('.xlsx', '.csv'));
      }

      db.addActivityLog(this.currentAdmin || 'system', 'Export Excel', 'sistem', `Mengunduh ${accounts.length} data akun ke Excel (multi-sheet)`);
      this.showToast(`✓ Berhasil mengunduh ${accounts.length} data akun ke Excel!`, 'success');

    } catch (err) {
      console.error('Error exporting to Excel:', err);
      this.showToast('Gagal mengunduh file Excel. Silakan coba lagi.', 'error');
    }
  }

  downloadCSVFallback(rows, filename) {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  const app = new AccExpressApp();
  app.init();
});
