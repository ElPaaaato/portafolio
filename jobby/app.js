/* ==================================================================
   JOBBY — Motor de datos y lógica compartida
   ==================================================================
   - Store en localStorage con seed inicial
   - Modelo de datos: clientes, facturas, pagos, contratos, presupuestos,
     equipo, configuración
   - Sistema de permisos por rol
   - Formateo MX y helpers de cálculo (IVA, vencimientos, totales)
   - Inyección dinámica del sidebar para compartir en todas las páginas
   ================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'jobby_db_v3';
  const SESSION_KEY = 'jobby_session_v1';

  /* ============ SEED DATA ============ */
  const seed = () => ({
    company: {
      name: 'Empresa Demo',
      rfc: 'XAXX010101000',
      address: 'Monterrey, Nuevo León',
      phone: '81 8000 0000',
      logo: null,
      currency: 'MXN',
      fiscalRegime: '601 - General de Ley Personas Morales',
      satConnected: false,
      banksConnected: [],
      whatsappEnabled: false,
      emailNotifications: true
    },
    users: [
      { id: 'u1', name: 'Usuario Demo', email: 'demo@jobby.mx', password: 'demo1234', role: 'admin', status: 'active', lastActive: null, initials: 'UD', color: '#0F5132' }
    ],
    clients: [
      { id: 'c1', name: 'Grupo Financiero Monterrey', rfc: 'GFM900101ABC', email: 'pagos@gfmonterrey.mx', phone: '818 100 2000', address: 'Monterrey, Nuevo León', paymentTerms: 30, creditLimit: 500000, notes: '' }
    ],
    suppliers: [],
    products: [],
    forecasts: [],
    invoices: [],
    payments: [],
    contracts: [],
    budgets: [],
    activity: [],
    session: { userId: null }
  });

  function mkInvoice(folio, clientId, date, type, status, items, dueDate = null, supplierName = null) {
    const lineItems = items.map(([desc, qty, unitPrice]) => ({
      description: desc,
      qty,
      unitPrice,
      total: +(qty * unitPrice).toFixed(2)
    }));
    const subtotal = +lineItems.reduce((s, i) => s + i.total, 0).toFixed(2);
    const iva = +(subtotal * 0.16).toFixed(2);
    const total = +(subtotal + iva).toFixed(2);
    const due = dueDate || addDays(date, 30);
    return {
      id: 'inv_' + folio,
      folio,
      type,                       // emitted | received
      clientId,                   // null si received (usa supplierName)
      supplierName,
      issueDate: date,
      dueDate: due,
      items: lineItems,
      subtotal,
      iva,
      total,
      status,                     // draft | sent | pending | paid | overdue | cancelled
      currency: 'MXN',
      paymentMethod: type === 'emitted' ? 'PPD' : 'PUE',
      cfdiUse: 'G03',
      notes: ''
    };
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function clientInitials(name) {
    const parts = name.split(/\s+/).filter(w => w.length > 2);
    if (parts.length === 0) return name.slice(0, 3).toUpperCase();
    return parts.map(w => w[0].toUpperCase()).join('').slice(0, 4);
  }

  function nextFolioForClient(clientId) {
    if (!clientId) {
      const all = Store.all('invoices').filter(i => i.type === 'emitted');
      const max = all.length > 0 ? Math.max(...all.map(i => parseInt(i.folio.replace(/\D/g, '')) || 0)) : 0;
      return 'A-' + String(max + 1).padStart(3, '0');
    }
    const c = Store.find('clients', clientId);
    const prefix = c ? clientInitials(c.name) : 'A';
    const existing = Store.all('invoices').filter(i => i.type === 'emitted' && i.folio.startsWith(prefix + '-'));
    const max = existing.length > 0
      ? Math.max(...existing.map(i => parseInt(i.folio.split('-').pop()) || 0))
      : 0;
    return prefix + '-' + String(max + 1).padStart(3, '0');
  }

  /* ============ STORE ============ */
  const Store = {
    _db: null,

    init() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { this._db = JSON.parse(raw); }
        catch { this._db = seed(); this.save(); }
      } else {
        this._db = seed();
        this.save();
      }
      this.recomputeOverdue();

      // Session guard — redirect unauthenticated users away from app pages
      const publicPages = ['index.html', 'login.html', 'onboarding.html'];
      const page = location.pathname.split('/').pop() || 'index.html';
      const isPublic = publicPages.some(p => page === p || page === '');
      if (!isPublic && !this._db.session.userId) {
        location.replace('login.html');
      }
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._db));
    },

    reset() {
      this._db = seed();
      this.save();
    },

    all(collection) { return this._db[collection] || []; },

    find(collection, id) {
      return (this._db[collection] || []).find(x => x.id === id);
    },

    add(collection, item) {
      if (!item.id) item.id = collection.slice(0, 2) + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      this._db[collection].push(item);
      this.save();
      return item;
    },

    update(collection, id, patch) {
      const idx = this._db[collection].findIndex(x => x.id === id);
      if (idx >= 0) {
        this._db[collection][idx] = { ...this._db[collection][idx], ...patch };
        this.save();
        return this._db[collection][idx];
      }
      return null;
    },

    remove(collection, id) {
      this._db[collection] = this._db[collection].filter(x => x.id !== id);
      this.save();
    },

    get company() { return this._db.company; },
    set company(v) { this._db.company = v; this.save(); },

    get session() { return this._db.session; },

    currentUser() {
      return this._db.users.find(u => u.id === this._db.session.userId);
    },

    setCurrentUser(userId) {
      this._db.session.userId = userId;
      this.save();
    },

    login(email, password) {
      const u = this._db.users.find(x => x.email === email && x.password === password && x.status === 'active');
      if (!u) return false;
      this._db.session.userId = u.id;
      u.lastActive = new Date().toISOString();
      this.save();
      return true;
    },

    logout() {
      this._db.session.userId = null;
      this.save();
      location.replace('login.html');
    },

    recomputeOverdue() {
      const today = new Date().toISOString().slice(0, 10);
      this._db.invoices.forEach(inv => {
        if (inv.status === 'pending' || inv.status === 'sent') {
          if (inv.dueDate < today) inv.status = 'overdue';
        }
      });
      this.save();
    },

    logActivity(action, entity) {
      const u = this.currentUser();
      this._db.activity.unshift({
        id: 'a_' + Date.now(),
        date: new Date().toISOString(),
        user: u.id,
        action,
        entity
      });
      if (this._db.activity.length > 100) this._db.activity.pop();
      this.save();
    }
  };

  /* ============ PERMISOS POR ROL ============ */
  const ROLES = {
    admin:      { label: 'Administrador', can: ['*'] },
    cfo:        { label: 'CFO / Director',          can: ['view.*', 'invoice.*', 'payment.*', 'client.*', 'report.*', 'budget.*', 'team.view'] },
    accountant: { label: 'Contador',                can: ['view.*', 'invoice.*', 'payment.*', 'client.view', 'report.*'] },
    sales:      { label: 'Ventas',                  can: ['view.dashboard', 'invoice.create', 'invoice.view', 'client.*'] },
    viewer:     { label: 'Solo lectura',            can: ['view.*'] }
  };

  function can(action, user) {
    const u = user || Store.currentUser();
    if (!u) return false;
    const perms = ROLES[u.role]?.can || [];
    return perms.some(p => p === '*' || p === action || (p.endsWith('.*') && action.startsWith(p.slice(0, -2))));
  }

  /* ============ CÁLCULOS ============ */
  const Calc = {
    // Facturas emitidas pendientes de cobro (excluye draft y cancelled)
    receivable() {
      return Store.all('invoices')
        .filter(i => i.type === 'emitted' && (i.status === 'pending' || i.status === 'sent' || i.status === 'overdue'))
        .reduce((s, i) => s + i.total, 0);
    },

    // Facturas recibidas pendientes de pago
    payable() {
      return Store.all('invoices')
        .filter(i => i.type === 'received' && (i.status === 'pending' || i.status === 'sent' || i.status === 'overdue'))
        .reduce((s, i) => s + i.total, 0);
    },

    overdueAmount() {
      return Store.all('invoices')
        .filter(i => i.type === 'emitted' && i.status === 'overdue')
        .reduce((s, i) => s + i.total, 0);
    },

    paidThisMonth() {
      const { ym } = thisPeriod();
      return Store.all('payments')
        .filter(p => p.date.startsWith(ym))
        .filter(p => {
          const inv = Store.find('invoices', p.invoiceId);
          return inv && inv.type === 'emitted';
        })
        .reduce((s, p) => s + p.amount, 0);
    },

    invoicedThisMonth() {
      const { ym } = thisPeriod();
      return Store.all('invoices')
        .filter(i => i.type === 'emitted' && i.issueDate.startsWith(ym) && i.status !== 'draft' && i.status !== 'cancelled')
        .reduce((s, i) => s + i.total, 0);
    },

    invoicedLastMonth() {
      const last = lastMonth();
      return Store.all('invoices')
        .filter(i => i.type === 'emitted' && i.issueDate.startsWith(last) && i.status !== 'draft' && i.status !== 'cancelled')
        .reduce((s, i) => s + i.total, 0);
    },

    supplierBalance(supplierId) {
      return Store.all('invoices')
        .filter(i => i.supplierId === supplierId && (i.status === 'pending' || i.status === 'sent' || i.status === 'overdue'))
        .reduce((s, i) => s + i.total, 0);
    },

    // Antigüedad de cartera
    aging() {
      const today = new Date();
      const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
      Store.all('invoices')
        .filter(i => i.type === 'emitted' && (i.status === 'pending' || i.status === 'sent' || i.status === 'overdue'))
        .forEach(i => {
          const due = new Date(i.dueDate + 'T12:00:00');
          const days = Math.floor((today - due) / 86400000);
          if (days <= 0)      buckets.current += i.total;
          else if (days <= 30) buckets.d30 += i.total;
          else if (days <= 60) buckets.d60 += i.total;
          else if (days <= 90) buckets.d90 += i.total;
          else                 buckets.over90 += i.total;
        });
      return buckets;
    },

    clientBalance(clientId) {
      return Store.all('invoices')
        .filter(i => i.type === 'emitted' && i.clientId === clientId && i.status !== 'draft' && i.status !== 'cancelled' && i.status !== 'paid')
        .reduce((s, i) => s + i.total, 0);
    },

    // Proyección próximos 6 meses (contratos activos + proyectados ponderados)
    forecast(months = 6) {
      const today = new Date();
      const out = [];
      for (let i = 0; i < months; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const ym = d.toISOString().slice(0, 7);
        let committed = 0;
        let projected = 0;
        Store.all('contracts').forEach(k => {
          const start = k.startDate, end = k.endDate;
          if (ym >= start.slice(0, 7) && ym <= end.slice(0, 7)) {
            if (k.status === 'active')    committed += k.monthlyAmount;
            if (k.status === 'projected') projected += k.monthlyAmount * (k.probability / 100);
          }
        });
        out.push({ ym, label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), committed, projected });
      }
      return out;
    },

    budgetSummary() {
      const budgets = Store.all('budgets');
      const income = budgets.filter(b => b.type === 'income').reduce((s, b) => s + b.monthly, 0);
      const expense = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.monthly, 0);
      const actualIncome = budgets.filter(b => b.type === 'income').reduce((s, b) => s + b.actual, 0);
      const actualExpense = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.actual, 0);
      return { income, expense, net: income - expense, actualIncome, actualExpense, actualNet: actualIncome - actualExpense };
    }
  };

  function thisPeriod() {
    const d = new Date();
    const ym = d.toISOString().slice(0, 7);
    return { ym, month: d.getMonth(), year: d.getFullYear() };
  }

  function lastMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }

  /* ============ FORMATEO ============ */
  const fmt = {
    mxn(n, opts = {}) {
      if (n == null || isNaN(n)) return '—';
      return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: opts.decimals ?? 2, maximumFractionDigits: opts.decimals ?? 2 });
    },
    mxnCompact(n) {
      if (n == null || isNaN(n)) return '—';
      if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
      if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
      return '$' + Math.round(n);
    },
    date(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    dateShort(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    },
    dateTime(dt) {
      if (!dt) return '—';
      const d = new Date(dt);
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    },
    relative(dt) {
      if (!dt) return '—';
      const d = new Date(dt);
      const diff = (new Date() - d) / 1000;
      if (diff < 60) return 'hace ' + Math.floor(diff) + 's';
      if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + ' min';
      if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + ' h';
      if (diff < 604800) return 'hace ' + Math.floor(diff / 86400) + ' días';
      return this.date(d.toISOString().slice(0, 10));
    },
    daysUntil(dateStr) {
      if (!dateStr) return null;
      const due = new Date(dateStr + 'T12:00:00');
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      return Math.round((due - now) / 86400000);
    },
    statusLabel(s) {
      return { draft: 'Borrador', sent: 'Enviada', pending: 'Pendiente', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada' }[s] || s;
    },
    statusBadge(s) {
      return `<span class="badge badge-${s === 'paid' ? 'paid' : s === 'overdue' ? 'overdue' : s === 'pending' ? 'pending' : s === 'sent' ? 'sent' : s === 'draft' ? 'draft' : 'draft'}">${this.statusLabel(s)}</span>`;
    }
  };

  /* ============ SIDEBAR INJECTION ============ */
  function renderSidebar(activeKey) {
    const u = Store.currentUser();
    const items = [
      { section: 'General' },
      { key: 'dashboard',    label: 'Dashboard',    href: 'dashboard.html',    perm: 'view.dashboard',
        svg: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>' },
      { key: 'flujo',        label: 'Flujo',        href: 'flujo.html',        perm: 'invoice.view',
        svg: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
      { key: 'facturas',     label: 'Facturas',     href: 'facturas.html',     perm: 'invoice.view',
        svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
      { key: 'pagos',        label: 'Pagos',        href: 'pagos.html',        perm: 'payment.view',
        svg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/>' },
      { key: 'clientes',     label: 'Clientes',     href: 'clientes.html',     perm: 'client.view',
        svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },

      { section: 'Finanzas' },
      { key: 'proyecciones', label: 'Proyecciones', href: 'proyecciones.html', perm: 'report.view',
        svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
      { key: 'sat',          label: 'SAT / CFDI',   href: 'onboarding.html',   perm: 'view.dashboard',
        svg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/>' },

      { section: 'Cuenta' },
      { key: 'equipo',       label: 'Equipo',       href: 'equipo.html',       perm: 'view.dashboard',
        svg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { key: 'seguridad',    label: 'Seguridad',    href: 'seguridad.html',    perm: 'view.dashboard',
        svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
      { key: 'configuracion',label: 'Configuración',href: 'configuracion.html',perm: 'view.dashboard',
        svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
    ];

    let html = `
      <a href="dashboard.html" class="logo">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 20 C 10 8, 14 24, 20 12 S 28 20, 28 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="28" cy="10" r="2.5" fill="#D99050"/>
        </svg>
        Jobby<span class="dot">.</span>
      </a>`;

    let openList = false;
    items.forEach(it => {
      if (it.section) {
        if (openList) html += '</ul>';
        html += `<div class="side-section">${it.section}</div><ul class="side-nav">`;
        openList = true;
      } else {
        const allowed = it.perm ? can(it.perm) : true;
        if (!allowed) return;
        const active = it.key === activeKey ? 'active' : '';
        html += `
          <li><a href="${it.href}" class="${active}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${it.svg}</svg>
            ${it.label}
          </a></li>`;
      }
    });
    if (openList) html += '</ul>';

    html += `
      <div class="sidebar-foot">
        <div class="avatar" style="background: linear-gradient(135deg, ${u.color}, #C9A227);">${u.initials}</div>
        <div class="user-meta">
          <div class="name">${u.name}</div>
          <div class="role">${ROLES[u.role].label.toLowerCase()}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="window.Jobby.Store.logout()" title="Cerrar sesión">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
      </button>`;

    return html;
  }

  function mountSidebar(activeKey) {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.innerHTML = renderSidebar(activeKey);
  }

  /* ============ TOAST ============ */
  function toast(message, type = 'success') {
    let host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = `
      <span class="toast-ic">${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span>
      <span>${message}</span>`;
    host.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  /* ============ MODAL ============ */
  const Modal = {
    open(html, opts = {}) {
      this.close();
      const ov = document.createElement('div');
      ov.className = 'modal-ov';
      ov.innerHTML = `<div class="modal" style="max-width: ${opts.width || '520px'}">${html}</div>`;
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
      ov.addEventListener('click', e => { if (e.target === ov && opts.closeOnBackdrop !== false) this.close(); });
      document.addEventListener('keydown', this._esc);
      return ov;
    },
    close() {
      const ov = document.querySelector('.modal-ov');
      if (ov) {
        ov.classList.remove('show');
        setTimeout(() => ov.remove(), 200);
      }
      document.removeEventListener('keydown', this._esc);
    },
    _esc(e) { if (e.key === 'Escape') Modal.close(); }
  };

  /* ============ EXPORT ============ */
  window.Jobby = { Store, Calc, fmt, can, ROLES, mountSidebar, toast, Modal, addDays, clientInitials, nextFolioForClient };

  // Auto-init
  Store.init();
})();
