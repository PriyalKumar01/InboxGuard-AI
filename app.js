// ============================================================
//  InboxGuard AI — Main Application (app.js)
//  Uses global INBOX_EMAILS from data.js and global agents
// ============================================================

(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  var state = {
    emails: INBOX_EMAILS.map(function(e) { return Object.assign({}, e); }),
    trash: [],
    selectedId: null,
    view: 'inbox',       // inbox | starred | trash
    priorityFilter: 'all',
    searchQuery: '',
    pendingDeleteEmail: null,
    pendingDeleteCb: null
  };

  // ── DOM refs ───────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  var listEl     = $('email-list');
  var detailEl   = $('detail-pane');
  var searchEl   = $('search-input');
  var modalBg    = $('modal-bg');
  var toastEl    = $('toast');

  // ── Date Formatting ────────────────────────────────────────
  function fmtDate(d) {
    var dt = new Date(d), now = new Date();
    var diff = now - dt;
    if (diff < 86400000 && dt.getDate() === now.getDate()) {
      return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (diff < 172800000) return 'Yesterday';
    return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }
  function fmtFull(d) {
    return new Date(d).toLocaleString('en-IN', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  // ── Get Emails For Current View ───────────────────────────
  function viewEmails() {
    var list;
    if (state.view === 'trash') {
      list = state.trash.slice();
    } else if (state.view === 'starred') {
      list = state.emails.filter(function(e) { return e.starred; });
    } else {
      list = state.emails.slice();
    }
    if (state.searchQuery) {
      list = EmailSearchAgent.search(state.searchQuery, list);
    }
    if (state.priorityFilter !== 'all') {
      var pf = state.priorityFilter;
      list = list.filter(function(e) { return PriorityDetectionAgent.detect(e) === pf; });
    }
    return list;
  }

  // ── Render Email List ─────────────────────────────────────
  function renderList() {
    var emails = viewEmails();
    listEl.innerHTML = '';

    // Update unread badge
    var unread = state.emails.filter(function(e) { return !e.read; }).length;
    var badge = $('inbox-badge');
    if (badge) badge.textContent = unread > 0 ? unread : '';

    // Update heading
    var h2 = $('list-h2');
    var cnt = $('list-count');
    var titles = { inbox:'Inbox', starred:'Starred', trash:'Trash' };
    if (h2) h2.textContent = state.searchQuery ? 'Search Results' : (titles[state.view] || 'Inbox');
    if (cnt) cnt.textContent = emails.length + ' email' + (emails.length !== 1 ? 's' : '');

    if (emails.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="ei">📭</div>' +
        '<p>' + (state.searchQuery ? 'No emails match your search.' : 'Nothing here yet.') + '</p></div>';
      return;
    }

    emails.forEach(function(email) {
      var p = PriorityDetectionAgent.detect(email);
      var isSelected = email.id === state.selectedId;
      var item = document.createElement('div');
      item.className = 'email-item' +
        (email.read ? '' : ' unread') +
        (isSelected ? ' is-selected' : '');
      item.dataset.id = email.id;

      var preview = (email.body || '').replace(/\n+/g, ' ').slice(0, 75);

      item.innerHTML =
        '<div class="email-item-r1">' +
          (email.read ? '<div style="width:7px"></div>' : '<div class="ei-dot"></div>') +
          '<span class="ei-from">' + esc(email.fromName) + '</span>' +
          '<span class="ei-date">' + fmtDate(email.date) + '</span>' +
        '</div>' +
        '<div class="ei-subject">' + esc(email.subject) + '</div>' +
        '<div class="email-item-r3">' +
          '<span class="ei-preview">' + esc(preview) + '…</span>' +
          '<span class="pbadge ' + p + '">' + PriorityDetectionAgent.getBadge(p) + ' ' + p + '</span>' +
          '<span class="ei-star' + (email.starred ? ' starred' : '') + '" data-star="' + email.id + '">' +
            (email.starred ? '★' : '☆') +
          '</span>' +
        '</div>';

      listEl.appendChild(item);

      item.addEventListener('click', function(e) {
        if (e.target.dataset.star) return;
        openEmail(email.id);
      });
    });

    // Star clicks
    listEl.querySelectorAll('[data-star]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStar(parseInt(el.dataset.star));
      });
    });
  }

  // ── Open Email ─────────────────────────────────────────────
  function openEmail(id) {
    var email = findEmail(id);
    if (!email) return;
    email.read = true;
    state.selectedId = id;
    renderList();
    renderDetail(email);
  }

  function findEmail(id) {
    for (var i = 0; i < state.emails.length; i++) {
      if (state.emails[i].id === id) return state.emails[i];
    }
    for (var j = 0; j < state.trash.length; j++) {
      if (state.trash[j].id === id) return state.trash[j];
    }
    return null;
  }

  // ── Render Email Detail ────────────────────────────────────
  function renderDetail(email) {
    var p = PriorityDetectionAgent.detect(email);
    var summary = SummarizationAgent.summarize(email);
    var replies = ReplyGenerationAgent.generate(email);
    var meeting = MeetingDetectionAgent.detect(email);
    var inTrash = state.trash.indexOf(email) !== -1;

    var mtgHtml = '';
    if (meeting.isMeeting) {
      mtgHtml = '<div class="mtg-card">' +
        '<div class="mtg-icon">📅</div>' +
        '<div class="mtg-info"><h4>Meeting Detected</h4>' +
        '<p>' + (meeting.summary || 'Time/date detected in this email') + '</p></div>' +
        '<button class="mtg-cal-btn" id="btn-calendar">+ Add to Calendar</button>' +
        '</div>';
    }

    var repliesHtml = '';
    if (!inTrash) {
      repliesHtml = '<div class="reply-section">' +
        '<div class="reply-label">⚡ Smart Replies</div>' +
        '<div class="reply-btns">' +
        replies.map(function(r, i) {
          return '<button class="reply-btn" data-ri="' + i + '">' + esc(r) + '</button>';
        }).join('') +
        '</div></div>';
    }

    var deleteBtn = inTrash
      ? '<button class="det-btn" id="btn-restore">↩ Restore</button>'
      : '<button class="det-btn del" id="btn-delete">🗑 Delete</button>';

    detailEl.innerHTML =
      '<div class="detail-scroll">' +
        '<div class="det-header">' +
          '<div class="det-subject">' + esc(email.subject) + '</div>' +
          '<div class="det-meta">' +
            '<div class="det-from">' +
              '<span class="det-from-name">' + esc(email.fromName) + '</span>' +
              '<span class="det-from-email">&lt;' + esc(email.from) + '&gt;</span>' +
            '</div>' +
            '<span class="pbadge ' + p + '">' + PriorityDetectionAgent.getBadge(p) + ' ' + p + ' priority</span>' +
            '<span class="det-date">' + fmtFull(email.date) + '</span>' +
          '</div>' +
          '<div class="det-actions">' +
            '<button class="det-btn" id="btn-reply">↩ Reply</button>' +
            '<button class="det-btn' + (email.starred ? ' starred-active' : '') + '" id="btn-star">' +
              (email.starred ? '★ Starred' : '☆ Star') +
            '</button>' +
            deleteBtn +
          '</div>' +
        '</div>' +
        '<div class="ai-card">' +
          '<div class="ai-card-head"><div class="ai-pulse"></div>AI Summary</div>' +
          '<div class="ai-card-body">' + esc(summary) + '</div>' +
        '</div>' +
        mtgHtml +
        '<div class="email-body">' + esc(email.body) + '</div>' +
        repliesHtml +
      '</div>';

    // Wire events
    var btnDel = $('btn-delete');
    if (btnDel) btnDel.addEventListener('click', function() { initiateDelete(email); });

    var btnRestore = $('btn-restore');
    if (btnRestore) btnRestore.addEventListener('click', function() { restoreEmail(email); });

    var btnStar = $('btn-star');
    if (btnStar) btnStar.addEventListener('click', function() { toggleStar(email.id); openEmail(email.id); });

    var btnReply = $('btn-reply');
    if (btnReply) btnReply.addEventListener('click', function() { showToast('💬 Reply composer opened'); });

    var btnCal = $('btn-calendar');
    if (btnCal) btnCal.addEventListener('click', function() {
      showToast('📅 Meeting added: ' + (meeting.summary || 'Event added to calendar'));
      btnCal.textContent = '✅ Added';
      btnCal.style.opacity = '.6';
      btnCal.disabled = true;
    });

    detailEl.querySelectorAll('.reply-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.ri);
        var text = replies[idx];
        showToast('✅ Reply sent: "' + text.slice(0, 45) + (text.length > 45 ? '…' : '') + '"');
        btn.textContent = '✓ Sent';
        btn.style.color = 'var(--accent-green)';
        btn.disabled = true;
      });
    });
  }

  // ── Detail Placeholder ─────────────────────────────────────
  function showPlaceholder() {
    detailEl.innerHTML =
      '<div class="detail-placeholder">' +
        '<div class="dp-icon">✉️</div>' +
        '<div class="dp-title">Select an email to read</div>' +
        '<div class="dp-sub">Your intelligent inbox is ready.</div>' +
      '</div>';
  }

  // ── Delete Flow ────────────────────────────────────────────
  function initiateDelete(email) {
    var p = PriorityDetectionAgent.detect(email);
    var check = EmailProtectionAgent.checkBeforeDelete(email, p);
    if (check.protected) {
      showModal('⚠️', 'Delete Email?', check.message, function() { doDelete(email); });
    } else {
      doDelete(email);
    }
  }

  function doDelete(email) {
    state.emails = state.emails.filter(function(e) { return e.id !== email.id; });
    state.trash.push(email);
    state.selectedId = null;
    showPlaceholder();
    renderList();
    showToast('🗑 Email moved to Trash');
  }

  function restoreEmail(email) {
    state.trash = state.trash.filter(function(e) { return e.id !== email.id; });
    state.emails.push(email);
    state.selectedId = null;
    showPlaceholder();
    renderList();
    showToast('↩ Email restored to Inbox');
  }

  // ── Toggle Star ────────────────────────────────────────────
  function toggleStar(id) {
    var email = findEmail(id);
    if (email) {
      email.starred = !email.starred;
      renderList();
      showToast(email.starred ? '⭐ Email starred' : '☆ Star removed');
    }
  }

  // ── Nav Setup ──────────────────────────────────────────────
  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        item.classList.add('active');
        state.view = item.dataset.view || 'inbox';
        state.searchQuery = '';
        state.selectedId = null;
        searchEl.value = '';
        // Reset filter tabs
        document.querySelectorAll('.filt-btn').forEach(function(b) { b.classList.remove('active'); });
        var allBtn = document.querySelector('.filt-btn[data-pf="all"]');
        if (allBtn) allBtn.classList.add('active');
        state.priorityFilter = 'all';
        showPlaceholder();
        renderList();
      });
    });
  }

  // ── Filter Tabs ────────────────────────────────────────────
  function setupFilters() {
    document.querySelectorAll('.filt-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filt-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.priorityFilter = btn.dataset.pf;
        state.selectedId = null;
        showPlaceholder();
        renderList();
      });
    });
  }

  // ── Search ─────────────────────────────────────────────────
  function setupSearch() {
    var debounce;
    searchEl.addEventListener('input', function() {
      clearTimeout(debounce);
      debounce = setTimeout(function() {
        state.searchQuery = searchEl.value.trim();
        state.selectedId = null;
        showPlaceholder();
        renderList();
      }, 280);
    });
  }

  // ── Daily Briefing ─────────────────────────────────────────
  function setupBriefing() {
    var briefing = DailyBriefingAgent.generate(state.emails);

    var el = function(id) { return $(id); };
    if (el('b-unread')) el('b-unread').textContent = briefing.unread;
    if (el('b-high'))   el('b-high').textContent   = briefing.high;
    if (el('b-mtgs'))   el('b-mtgs').textContent   = briefing.meetings;
    if (el('b-total'))  el('b-total').textContent  = briefing.total;

    var total = briefing.total || 1;
    var pHigh = el('pb-high'), pMed = el('pb-med'), pLow = el('pb-low');
    if (pHigh) pHigh.style.width = Math.round(briefing.high / total * 100) + '%';
    if (pMed) pMed.style.width = Math.round(briefing.medium / total * 100) + '%';
    if (pLow) pLow.style.width = Math.round(briefing.low / total * 100) + '%';

    var hlEl = $('b-highlights');
    if (hlEl) {
      if (briefing.highlights.length > 0) {
        hlEl.innerHTML = '<h5>🔴 Needs Attention</h5>' +
          briefing.highlights.map(function(e) {
            return '<p>• <strong>' + esc(e.subject) + '</strong> from ' + esc(e.fromName) + '</p>';
          }).join('');
      } else {
        hlEl.innerHTML = '<p>All clear – no urgent unread emails!</p>';
      }
    }

    var head = $('briefing-head');
    var body = $('briefing-body');
    if (head && body) {
      head.addEventListener('click', function() {
        head.classList.toggle('open');
        body.classList.toggle('show');
      });
      head.classList.add('open');
      body.classList.add('show');
    }
  }

  // ── Modal ──────────────────────────────────────────────────
  function showModal(icon, title, msg, onConfirm) {
    $('modal-icon').textContent = icon;
    $('modal-title').textContent = title;
    $('modal-msg').textContent = msg;
    modalBg.classList.add('show');

    var conf = $('modal-confirm');
    var canc = $('modal-cancel');

    function cleanup() {
      modalBg.classList.remove('show');
      conf.onclick = null;
      canc.onclick = null;
    }
    conf.onclick = function() { cleanup(); onConfirm(); };
    canc.onclick = function() { cleanup(); showToast('🛡 Email kept safe'); };

    modalBg.onclick = function(e) { if (e.target === modalBg) { cleanup(); } };
  }

  // ── Toast ──────────────────────────────────────────────────
  var toastTimer;
  function showToast(msg) {
    toastEl.innerHTML = '<span>' + msg + '</span>';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toastEl.classList.remove('show'); }, 3000);
  }

  // ── Escape HTML ────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Compose Btn ────────────────────────────────────────────
  var composeBtn = $('compose-btn');
  if (composeBtn) {
    composeBtn.addEventListener('click', function() { showToast('✏ Compose window opened'); });
  }

  // ── Init ───────────────────────────────────────────────────
  setupNav();
  setupFilters();
  setupSearch();
  setupBriefing();
  renderList();
  showPlaceholder();

})();
