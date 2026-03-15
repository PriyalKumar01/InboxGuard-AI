// ============================================================
//  InboxGuard AI v2.0 – Main Application (public/app.js)
//  Real Gmail integration via backend API
// ============================================================

(function() {
'use strict';

// ── State ──────────────────────────────────────────────────
var SUPPORT_EMAIL = 'priyalkumar06@gmail.com';
var SUPPORT_WHATSAPP = '+918957221543';
var state = {
  authenticated: false,
  user: null,
  emails: [],
  allLoaded: [],
  nextPageToken: null,
  totalEmails: 0,
  selectedIds: new Set(),     // for multi-select
  composeVariantIdx: 0,       // current AI variant index
  currentView: 'INBOX',
  currentCategory: 'all',
  priorityFilter: 'all',
  searchQuery: '',
  selectedEmail: null,
  isSearchMode: false,
  isLoading: false,
  pollingTimer: null,
};

// ── DOM ────────────────────────────────────────────────────
function $id(id) { return document.getElementById(id); }
function $q(selector) { return document.querySelector(selector); }
function $qa(selector) { return document.querySelectorAll(selector); }

var authScreen     = $id('auth-screen');
var appScreen      = $id('app-screen');
var loadingOverlay = $id('loading-overlay');
var loadingText    = $id('loading-text');
var emailListEl    = $id('email-list');
var detailContent  = $id('detail-content');
var detailPH       = $id('detail-placeholder');
var modalBg        = $id('modal-bg');
var toastEl        = $id('toast');
var elTitle        = $id('elp-title');
var elCount        = $id('elp-count');
var unreadBadge    = $id('unread-badge');
var searchInput    = $id('global-search-input');
var loadMoreRow    = $id('load-more-row');
var loadMoreBtn    = $id('load-more-btn');
var refreshBtn     = $id('refresh-btn');
var bcToggle       = $id('bc-toggle');
var bcBody         = $id('bc-body');

// ── Utilities ──────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ms) {
  if (!ms) return '';
  var dt = new Date(ms), now = new Date();
  var diff = now - dt;
  if (diff < 86400000 && dt.getDate() === now.getDate()) {
    return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diff < 172800000) return 'Yesterday';
  return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function fmtFull(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function avatarColor(name) {
  var colors = ['#2563EB','#4F46E5','#7C3AED','#DB2777','#DC2626','#D97706','#059669','#0891B2'];
  var idx = 0;
  for (var i = 0; i < (name || '').length; i++) idx += name.charCodeAt(i);
  return colors[idx % colors.length];
}

function initials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(function(p) { return p[0]; }).join('').toUpperCase();
}

// Sanitize HTML for safe display
function sanitizeHtml(html) {
  var div = document.createElement('div');
  div.innerHTML = html;
  // Remove dangerous tags
  var dangerous = div.querySelectorAll('script, style, iframe, object, embed, form');
  dangerous.forEach(function(el) { el.remove(); });
  // Make all links open in new tab safely
  div.querySelectorAll('a').forEach(function(a) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return div.innerHTML;
}

// Convert plain text to HTML with clickable links
function textToHtml(text) {
  var escaped = esc(text);
  // Make URLs clickable
  escaped = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Paragraphs
  escaped = escaped.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  return '<p>' + escaped + '</p>';
}

// ── Loading State ──────────────────────────────────────────
function showLoading(msg) {
  state.isLoading = true;
  if (loadingText) loadingText.textContent = msg || 'Loading…';
  loadingOverlay.classList.remove('hidden');
}
function hideLoading() {
  state.isLoading = false;
  loadingOverlay.classList.add('hidden');
}

// ── Toast ──────────────────────────────────────────────────
var toastTimer;
function showToast(msg) {
  toastEl.innerHTML = msg;
  toastEl.classList.remove('hidden');
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toastEl.classList.remove('show');
    setTimeout(function() { toastEl.classList.add('hidden'); }, 300);
  }, 3500);
}

// ── API Helpers ────────────────────────────────────────────
async function apiFetch(url, opts) {
  var res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
  if (res.status === 401) {
    state.authenticated = false;
    showAuthScreen();
    showToast('⚠️ Session expired. Please sign in again.');
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    var err = await res.json().catch(function() { return { error: res.statusText }; });
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

// ── Init ───────────────────────────────────────────────────
async function init() {
  showLoading('Checking authentication…');
  try {
    var data = await apiFetch('/api/me');
    if (data.authenticated) {
      state.authenticated = true;
      state.user = data.user;
      showAppScreen();
      await loadEmails();
      startPolling();
    } else {
      showAuthScreen();
    }
  } catch (e) {
    if (e.message !== 'Not authenticated') showAuthScreen();
  } finally {
    hideLoading();
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'error') {
    showToast('❌ Authentication failed: ' + (params.get('reason') || 'Unknown error'));
    history.replaceState({}, '', '/');
  }
  if (params.get('auth') === 'success') {
    history.replaceState({}, '', '/');
  }
}

// ── Auto Polling (real-time updates every 90s) ─────────────
function startPolling() {
  if (state.pollingTimer) clearInterval(state.pollingTimer);
  state.pollingTimer = setInterval(function() {
    if (!state.isLoading && !state.isSearchMode) {
      silentRefresh();
    }
  }, 90000);
}

async function silentRefresh() {
  try {
    var view = state.currentView;
    var params = new URLSearchParams({ limit: 50 });
    if (view === 'TRASH')    params.set('label', 'TRASH');
    else if (view === 'STARRED') params.set('label', 'STARRED');
    else if (view === 'SENT')    params.set('label', 'SENT');
    else                          params.set('label', 'INBOX');

    var data = await apiFetch('/api/emails?' + params.toString());
    var newEmails = data.emails || [];

    // Find truly new emails (not in allLoaded)
    var existingIds = new Set(state.allLoaded.map(function(e) { return e.id; }));
    var fresh = newEmails.filter(function(e) { return !existingIds.has(e.id); });

    if (fresh.length > 0) {
      // Prepend new emails to the top
      state.allLoaded = fresh.concat(state.allLoaded);
      // Update read status for existing emails
      newEmails.forEach(function(ne) {
        var existing = state.allLoaded.find(function(e) { return e.id === ne.id; });
        if (existing && ne.read !== existing.read) existing.read = ne.read;
      });
      updateDisplayedEmails();
      updateBriefing();
      updateUnreadBadge();
      updateCategoryTabs();
      showToast('📬 ' + fresh.length + ' new email' + (fresh.length > 1 ? 's' : '') + ' arrived!');
    }
  } catch (e) {
    // Silently fail – don't disturb user
    console.warn('Silent refresh failed:', e.message);
  }
}

// ── Screens ────────────────────────────────────────────────
function showAuthScreen() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showAppScreen() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  var avatar = $id('user-avatar');
  if (avatar && state.user) {
    avatar.src = state.user.picture || '';
    avatar.alt = state.user.name || '';
    avatar.onerror = function() { avatar.style.display = 'none'; };
  }
  if ($id('user-name'))  $id('user-name').textContent  = state.user ? state.user.name : '';
  if ($id('user-email')) $id('user-email').textContent = state.user ? state.user.email : '';

  setupEventListeners();
}

// ── Load Emails ───────────────────────────────────────────
async function loadEmails(append) {
  if (!append) {
    showLoading('Fetching your latest emails…');
    state.emails = [];
    state.allLoaded = [];
    state.nextPageToken = null;
    renderSkeletons();
  } else {
    showLoading('Loading more emails…');
  }

  try {
    var view = state.currentView;
    var params = new URLSearchParams({ limit: 50 });
    if (state.nextPageToken) params.set('pageToken', state.nextPageToken);

    if (view === 'TRASH')        params.set('label', 'TRASH');
    else if (view === 'STARRED') params.set('label', 'STARRED');
    else if (view === 'SENT')    params.set('label', 'SENT');
    else                          params.set('label', 'INBOX');

    var data = await apiFetch('/api/emails?' + params.toString());

    if (!append) {
      state.allLoaded = data.emails || [];
    } else {
      state.allLoaded = state.allLoaded.concat(data.emails || []);
    }
    state.nextPageToken = data.nextPageToken || null;
    state.totalEmails   = data.total || state.allLoaded.length;

    updateDisplayedEmails();
    updateBriefing();
    updateUnreadBadge();
    updateCategoryTabs();

    loadMoreRow.style.display = state.nextPageToken ? '' : 'none';
    showToast('📬 ' + state.allLoaded.length + ' emails loaded');
  } catch (e) {
    if (e.message !== 'Not authenticated') {
      emailListEl.innerHTML = '<div class="empty-state"><div class="ei">⚠️</div><p>Failed to load emails.<br>' + esc(e.message) + '</p></div>';
      showToast('❌ Error: ' + e.message);
    }
  } finally {
    hideLoading();
  }
}

// ── Category Tabs ──────────────────────────────────────────
function updateCategoryTabs() {
  if (state.currentView !== 'INBOX') return;
  var info = CategoryAgent.getCounts(state.allLoaded);
  var cats = ['primary','promotions','social','updates'];
  cats.forEach(function(cat) {
    var tabEl = $id('cat-tab-' + cat);
    if (!tabEl) return;
    var newCount = info.newCounts[cat];
    var badge = tabEl.querySelector('.cat-badge');
    if (badge) {
      badge.textContent = newCount > 0 ? newCount + ' new' : '';
      badge.style.display = newCount > 0 ? '' : 'none';
    }
  });
}

// ── Search ─────────────────────────────────────────────────
async function doSearch(query) {
  if (!query || !query.trim()) {
    state.isSearchMode = false;
    state.searchQuery  = '';
    updateDisplayedEmails();
    if (elTitle) elTitle.textContent = 'Inbox';
    return;
  }

  state.isSearchMode = true;
  state.searchQuery  = query;
  showLoading('Searching with AI…');

  var clientFiltered = EmailSearchAgent.filter(query, state.allLoaded);

  try {
    var gmailQ = EmailSearchAgent.toGmailQuery(query);
    var data   = await apiFetch('/api/search?q=' + encodeURIComponent(gmailQ));
    var serverEmails = data.emails || [];

    var seen = new Set();
    var merged = [];
    serverEmails.forEach(function(e) { if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); } });
    clientFiltered.forEach(function(e) { if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); } });

    state.emails = merged;
  } catch (e) {
    state.emails = clientFiltered;
  } finally {
    hideLoading();
  }

  renderEmailList();
  if (elTitle) elTitle.textContent = 'Search Results';
  if (elCount) elCount.textContent = state.emails.length + ' result' + (state.emails.length !== 1 ? 's' : '');
  state.selectedEmail = null;
  showDetailPlaceholder();
  loadMoreRow.style.display = 'none';
}

// ── Filter & Display ───────────────────────────────────────
function updateDisplayedEmails() {
  if (state.isSearchMode) return;
  var list = state.allLoaded.slice();

  // Category filter
  if (state.currentCategory && state.currentCategory !== 'all') {
    list = list.filter(function(e) {
      return CategoryAgent.categorize(e) === state.currentCategory;
    });
  }

  // Priority filter
  if (state.priorityFilter !== 'all') {
    var pf = state.priorityFilter;
    list = list.filter(function(e) { return PriorityDetectionAgent.detect(e) === pf; });
  }

  state.emails = list;
  renderEmailList();

  var views = { INBOX:'Inbox', STARRED:'Starred', SENT:'Sent', TRASH:'Trash' };
  if (elTitle) elTitle.textContent = views[state.currentView] || 'Inbox';
}

// ── Render Email List ──────────────────────────────────────
function renderSkeletons() {
  var html = '';
  for (var i = 0; i < 8; i++) {
    html += '<div class="skeleton">' +
      '<div class="skel-line" style="height:12px;width:' + (60 + i * 5 % 30) + '%"></div>' +
      '<div class="skel-line" style="height:11px;width:' + (45 + i * 7 % 40) + '%"></div>' +
      '<div class="skel-line" style="height:10px;width:' + (70 + i * 3 % 20) + '%"></div>' +
      '</div>';
  }
  emailListEl.innerHTML = html;
}

function renderEmailList() {
  var emails = state.emails;
  var selCount = state.selectedIds.size;

  // Show/hide multi-select toolbar
  var toolbar = $id('multi-select-toolbar');
  if (toolbar) {
    if (selCount > 0) {
      toolbar.classList.remove('hidden');
      var selLabel = $id('sel-count-label');
      if (selLabel) selLabel.textContent = selCount + ' selected';
    } else {
      toolbar.classList.add('hidden');
    }
  }

  if (elCount) elCount.textContent = emails.length + ' email' + (emails.length !== 1 ? 's' : '');

  if (emails.length === 0) {
    emailListEl.innerHTML = '<div class="empty-state"><div class="ei">📭</div>' +
      '<p>' + (state.isSearchMode ? 'No emails found for your search.' : 'No emails here.') + '</p></div>';
    return;
  }

  var html = '';
  emails.forEach(function(email, idx) {
    var p      = PriorityDetectionAgent.detect(email);
    var sel    = email.id === (state.selectedEmail && state.selectedEmail.id);
    var picked = state.selectedIds.has(email.id);
    var date   = email.dateMs ? fmtDate(email.dateMs) : '';
    var preview = (email.snippet || (email.isHtml ? email.body.replace(/<[^>]+>/g,' ') : email.body) || '')
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').slice(0, 90);

    html += '<div class="email-card' +
      (email.read ? '' : ' unread') +
      (sel ? ' is-active' : '') +
      (picked ? ' is-selected' : '') +
      '" data-id="' + esc(email.id) + '" style="animation-delay:' + (idx * 0.02) + 's">' +

      // Checkbox for multi-select
      '<div class="ec-check-wrap">' +
        '<input type="checkbox" class="ec-check" data-check="' + esc(email.id) + '"' +
          (picked ? ' checked' : '') + ' title="Select" />' +
      '</div>' +

      '<div class="ec-main">' +
        '<div class="ec-row1">' +
          (email.read ? '<span class="ec-read-spacer"></span>' : '<span class="ec-unread-dot"></span>') +
          '<span class="ec-from">' + esc(email.fromName || email.from) + '</span>' +
          '<span class="ec-date">' + esc(date) + '</span>' +
        '</div>' +
        '<div class="ec-subject">' + esc(email.subject) + '</div>' +
        '<div class="ec-row3">' +
          '<span class="ec-preview">' + esc(preview) + '</span>' +
          PriorityDetectionAgent.getBadgeHtml(p) +
          '<span class="ec-star' + (email.starred ? ' starred' : '') + '" data-star="' + esc(email.id) + '" title="Star">' +
            (email.starred ? '★' : '☆') +
          '</span>' +
        '</div>' +
      '</div>' +

      '</div>';
  });
  emailListEl.innerHTML = html;

  emailListEl.querySelectorAll('.email-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.dataset.star || e.target.dataset.check || e.target.type === 'checkbox') return;
      var id = card.dataset.id;
      var email = findEmail(id);
      if (email) openEmail(email);
    });
  });
  emailListEl.querySelectorAll('[data-star]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleStar(el.dataset.star);
    });
  });
  // Checkbox select
  emailListEl.querySelectorAll('.ec-check').forEach(function(cb) {
    cb.addEventListener('change', function(e) {
      e.stopPropagation();
      var id = cb.dataset.check;
      if (cb.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      renderEmailList(); // re-render toolbar
    });
  });
}

function findEmail(id) {
  return state.emails.find(function(e) { return e.id === id; })
    || state.allLoaded.find(function(e) { return e.id === id; });
}

// ── Open Email Detail ──────────────────────────────────────
function openEmail(email) {
  state.selectedEmail = email;
  // On mobile: hide email list, show detail
  var emailListPanel = $q('.email-list-panel');
  var emailDetailPanel = $id('email-detail-panel');
  if (window.innerWidth <= 768) {
    if (emailListPanel) emailListPanel.classList.add('mobile-detail-open');
    if (emailDetailPanel) emailDetailPanel.classList.add('mobile-detail-active');
  }

  var wasUnread = !email.read;
  if (wasUnread) {
    email.read = true;
    var inAll = state.allLoaded.find(function(e) { return e.id === email.id; });
    if (inAll) inAll.read = true;
    apiFetch('/api/emails/' + email.id + '/read', { method: 'POST' }).catch(function() {});
    updateUnreadBadge();
    updateBriefing();
    renderEmailList();
  } else {
    renderEmailList();
  }
  renderDetail(email);
}

// ── Render Detail ──────────────────────────────────────────
function renderDetail(email) {
  var p       = PriorityDetectionAgent.detect(email);
  var summary = SummarizationAgent.summarize(email);
  var replies = ReplyGenerationAgent.generate(email);
  var meeting = MeetingDetectionAgent.detect(email);
  var color   = avatarColor(email.fromName || email.from);
  var inits   = initials(email.fromName || email.from || '?');
  var inTrash = state.currentView === 'TRASH';

  var html = '';

  // Subject line
  html += '<div class="det-subject">' + esc(email.subject) + '</div>';

  // Meta row
  html += '<div class="det-meta-row">';
  html += '<button class="det-back-btn" id="d-back" title="Back to list">←</button>';
  html += '<div class="det-avatar" style="background:' + color + '">' + esc(inits) + '</div>';
  html += '<div class="det-from-info">';
  html += '<div class="det-from-name">' + esc(email.fromName || email.from) + '</div>';
  html += '<div class="det-from-email"><span class="det-from-label">From:</span> ' + esc(email.from) + '</div>';
  html += '<div class="det-to-email"><span class="det-from-label">To:</span> ' + esc(email.to || 'me') + '</div>';
  html += '</div>';
  html += PriorityDetectionAgent.getBadgeHtml(p);
  html += '<div class="det-date">' + fmtFull(email.dateMs) + '</div>';
  html += '</div>';

  // Action buttons
  html += '<div class="det-actions">';
  html += '<button class="det-btn primary-btn" id="d-reply"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> Reply</button>';
  html += '<button class="det-btn' + (email.starred ? ' starred' : '') + '" id="d-star">' + (email.starred ? '★ Starred' : '☆ Star') + '</button>';
  if (!inTrash) {
    html += '<button class="det-btn del" id="d-delete">🗑 Delete</button>';
  } else {
    html += '<button class="det-btn" id="d-restore">↩ Restore</button>';
  }
  html += '</div>';

  // AI Summary
  html += '<div class="ai-summary-card">';
  html += '<div class="asc-header"><div class="asc-dot"></div>🤖 AI Summary</div>';
  html += '<div class="asc-text">' + esc(summary) + '</div>';
  html += '</div>';

  // Meeting card
  if (meeting.isMeeting) {
    html += '<div class="meeting-card">';
    html += '<div class="mc-icon">📅</div>';
    html += '<div class="mc-info">';
    html += '<div class="mc-title">Meeting Detected</div>';
    html += '<div class="mc-detail">' + esc(meeting.summary || 'Check email for meeting details') + '</div>';
    html += '</div>';
    html += '<button class="mc-btn" id="d-cal">+ Add to Calendar</button>';
    html += '</div>';
  }

  // Email body – render HTML or formatted text
  html += '<div class="email-body-card" id="email-body-content"></div>';

  // Smart replies
  if (!inTrash) {
    html += '<div class="smart-reply-section">';
    html += '<div class="smart-reply-label">⚡ Smart Replies</div>';
    html += '<div class="smart-reply-btns">';
    replies.forEach(function(r, i) {
      html += '<button class="sr-btn" data-ri="' + i + '">' + esc(r) + '</button>';
    });
    html += '</div></div>';
  }

  detailContent.innerHTML = html;

  // Safely inject email body (HTML or text)
  var bodyEl = $id('email-body-content');
  if (bodyEl) {
    if (email.isHtml && email.body) {
      bodyEl.innerHTML = sanitizeHtml(email.body);
    } else if (email.body) {
      bodyEl.innerHTML = textToHtml(email.body);
    } else {
      bodyEl.innerHTML = '<p style="color:var(--text-4);font-style:italic;">(No content)</p>';
    }
  }

  detailContent.classList.remove('hidden');
  detailPH.classList.add('hidden');

  // Wire actions
  var dBack = $id('d-back');
  if (dBack) dBack.addEventListener('click', function() {
    var emailListPanel = $q('.email-list-panel');
    var emailDetailPanel = $id('email-detail-panel');
    if (emailListPanel) emailListPanel.classList.remove('mobile-detail-open');
    if (emailDetailPanel) emailDetailPanel.classList.remove('mobile-detail-active');
    showDetailPlaceholder();
  });

  var dReply = $id('d-reply');
  if (dReply) dReply.addEventListener('click', function() { openReplyComposer(email, ''); });

  var dStar = $id('d-star');
  if (dStar) dStar.addEventListener('click', function() { toggleStar(email.id); });

  var dDelete = $id('d-delete');
  if (dDelete) dDelete.addEventListener('click', function() { initiateDelete(email); });

  var dRestore = $id('d-restore');
  if (dRestore) dRestore.addEventListener('click', function() { restoreEmail(email); });

  var dCal = $id('d-cal');
  if (dCal) dCal.addEventListener('click', function() {
    showToast('📅 Event saved: ' + (meeting.summary || 'Meeting'));
    dCal.textContent = '✅ Added';
    dCal.classList.add('added');
    dCal.disabled = true;
  });

  // Smart reply clicks → open reply composer pre-filled
  var srBtnsEl = detailContent.querySelector('.smart-reply-btns');
  detailContent.querySelectorAll('.sr-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var text = replies[parseInt(btn.dataset.ri)];
      openReplyComposer(email, text);
    });
  });
}


function showDetailPlaceholder() {
  state.selectedEmail = null;
  detailContent.classList.add('hidden');
  detailPH.classList.remove('hidden');
}

// ── Reply Composer Modal ───────────────────────────────────
function openReplyComposer(email, prefillBody) {
  var modal = $id('reply-modal');
  if (!modal) return;

  // Pre-fill fields
  var toEl   = $id('reply-to');
  var subEl  = $id('reply-subject');
  var bodyEl = $id('reply-body');

  if (toEl)   toEl.value  = email.from || '';
  if (subEl)  subEl.value = email.subject.startsWith('Re:') ? email.subject : 'Re: ' + email.subject;
  if (bodyEl) bodyEl.value = prefillBody
    ? prefillBody + '\n\n\n— Original Message —\nFrom: ' + (email.fromName || email.from) + '\n' + (email.snippet || '').slice(0, 200)
    : '\n\n\n— Original Message —\nFrom: ' + (email.fromName || email.from) + '\n' + (email.snippet || '').slice(0, 200);

  // Store current email ref for send
  modal.dataset.emailId  = email.id;
  modal.dataset.threadId = email.threadId || '';
  modal.dataset.msgId    = email.messageId || '';
  modal.dataset.refs     = email.references || '';

  modal.classList.remove('hidden');
  if (bodyEl) {
    bodyEl.focus();
    bodyEl.setSelectionRange(0, 0);
  }
}

function closeReplyModal() {
  var modal = $id('reply-modal');
  if (modal) modal.classList.add('hidden');
}

async function sendReply() {
  var modal   = $id('reply-modal');
  var to      = ($id('reply-to')      || {}).value || '';
  var subject = ($id('reply-subject') || {}).value || '';
  var body    = ($id('reply-body')    || {}).value || '';

  if (!to.trim()) { showToast('❌ Please enter a recipient'); return; }
  if (!body.trim()) { showToast('❌ Please write something'); return; }

  var emailId  = modal.dataset.emailId;
  var threadId = modal.dataset.threadId;
  var inReplyTo= modal.dataset.msgId;
  var references= modal.dataset.refs;

  var sendBtn = $id('reply-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

  try {
    await apiFetch('/api/emails/' + emailId + '/reply', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, threadId, inReplyTo, references })
    });
    closeReplyModal();
    showToast('✅ Reply sent successfully!');
  } catch (e) {
    showToast('❌ Failed to send: ' + e.message);
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '✉️ Send Reply'; }
  }
}

// ── Compose Modal ──────────────────────────────────────────
function openComposeModal(prefillTo, prefillSubject) {
  var modal = $id('compose-modal');
  if (!modal) return;
  state.composeVariantIdx = 0;
  var toEl   = $id('compose-to');
  var subEl  = $id('compose-subject');
  var bodyEl = $id('compose-body');
  if (toEl)   toEl.value   = prefillTo || '';
  if (subEl)  subEl.value  = prefillSubject || '';
  if (bodyEl) bodyEl.value = prefillSubject ? EmailComposerAgent.compose(prefillTo || '', prefillSubject, 0) : '';
  modal.classList.remove('hidden');
  if (toEl) toEl.focus();
  // Reset rewrite btn text
  var rwBtn = $id('compose-rewrite-btn');
  if (rwBtn) rwBtn.textContent = '🔄 Rewrite';
}

function closeComposeModal() {
  var modal = $id('compose-modal');
  if (modal) modal.classList.add('hidden');
}

async function sendCompose() {
  var to      = ($id('compose-to')      || {}).value || '';
  var subject = ($id('compose-subject') || {}).value || '';
  var body    = ($id('compose-body')    || {}).value || '';

  if (!to.trim())      { showToast('❌ Please enter a recipient'); return; }
  if (!subject.trim()) { showToast('❌ Please enter a subject'); return; }
  if (!body.trim())    { showToast('❌ Please write something'); return; }

  var sendBtn = $id('compose-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

  // Detect if this is a support email to priyalkumar06@gmail.com
  var isSupportEmail = to.trim().toLowerCase() === SUPPORT_EMAIL.toLowerCase();

  try {
    await apiFetch('/api/emails/compose', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body })
    });
    closeComposeModal();
    showToast('✅ Email sent successfully!');

    // If support email, schedule auto thank-you after 10 min
    if (isSupportEmail && state.user && state.user.email) {
      var fromEmail = state.user.email;
      var fromName  = state.user.name || 'User';
      setTimeout(function() {
        var thankBody = 'Hi ' + fromName + ',\n\n' +
          'Thank you so much for reaching out to InboxGuard AI Support! 🙏\n\n' +
          'We\'ve received your message and you\'re now in our support queue.\n' +
          'Our team will personally get back to you shortly.\n\n' +
          '📬 Your query: "' + subject + '"\n\n' +
          'In the meantime, you can also reach us directly:\n' +
          '• WhatsApp: +91 8957221543\n' +
          '• Email: priyalkumar06@gmail.com\n\n' +
          'We appreciate your patience and look forward to helping you out! 😊\n\n' +
          'Warm regards,\nPriyal Kumar Singh\nInboxGuard AI Support';

        apiFetch('/api/emails/compose', {
          method: 'POST',
          body: JSON.stringify({
            to: fromEmail,
            subject: '📬 We received your support request!',
            body: thankBody
          })
        }).catch(function() {});
      }, 10 * 60 * 1000); // 10 minutes
      showToast('📬 Support email sent! Auto-reply in 10 min.');
    }
  } catch (e) {
    showToast('❌ Failed to send: ' + e.message);
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '✉️ Send Email'; }
  }
}

// ── Delete Flow ────────────────────────────────────────────
function initiateDelete(email) {
  var p = PriorityDetectionAgent.detect(email);
  var check = EmailProtectionAgent.checkBeforeDelete(email, p);
  if (check.protected) {
    showModal('🛡', 'Protected Email', check.message, function() { doDelete(email); });
  } else {
    doDelete(email);
  }
}

async function doDelete(email) {
  showLoading('Moving to Trash…');
  try {
    await apiFetch('/api/emails/' + email.id + '/trash', { method: 'POST' });
    state.allLoaded = state.allLoaded.filter(function(e) { return e.id !== email.id; });
    state.emails    = state.emails.filter(function(e) { return e.id !== email.id; });
    showDetailPlaceholder();
    renderEmailList();
    updateUnreadBadge();
    showToast('🗑 Email moved to Trash');
  } catch (e) {
    showToast('❌ Failed to delete: ' + e.message);
  } finally {
    hideLoading();
  }
}

async function restoreEmail(email) {
  showLoading('Restoring…');
  try {
    await apiFetch('/api/emails/' + email.id + '/untrash', { method: 'POST' });
    state.allLoaded = state.allLoaded.filter(function(e) { return e.id !== email.id; });
    state.emails    = state.emails.filter(function(e) { return e.id !== email.id; });
    showDetailPlaceholder();
    renderEmailList();
    showToast('↩ Email restored to Inbox');
  } catch (e) {
    state.allLoaded = state.allLoaded.filter(function(e) { return e.id !== email.id; });
    state.emails    = state.emails.filter(function(e) { return e.id !== email.id; });
    showDetailPlaceholder();
    renderEmailList();
    showToast('↩ Email restored');
  } finally {
    hideLoading();
  }
}

// ── Star Toggle ────────────────────────────────────────────
async function toggleStar(id) {
  var email = findEmail(id);
  if (!email) return;
  email.starred = !email.starred;
  renderEmailList();
  if (state.selectedEmail && state.selectedEmail.id === id) renderDetail(email);

  try {
    await apiFetch('/api/emails/' + id + '/star', {
      method: 'POST',
      body: JSON.stringify({ starred: email.starred })
    });
    showToast(email.starred ? '⭐ Email starred' : '☆ Star removed');
  } catch (e) {
    email.starred = !email.starred;
    renderEmailList();
    showToast('❌ Failed to update star');
  }
}

// ── Briefing ───────────────────────────────────────────────
function updateBriefing() {
  var b = DailyBriefingAgent.generate(state.allLoaded);
  var total = b.total || 1;

  var greeting = $id('bc-greeting');
  if (greeting) greeting.textContent = b.greeting + ', ' + (state.user ? state.user.name.split(' ')[0] : '') + '!';
  var bcUnread = $id('bc-unread');   if (bcUnread)   bcUnread.textContent   = b.unread;
  var bcHigh   = $id('bc-high');     if (bcHigh)     bcHigh.textContent     = b.high;
  var bcMtg    = $id('bc-meetings'); if (bcMtg)      bcMtg.textContent      = b.meetings;
  var bcTotal  = $id('bc-total');    if (bcTotal)    bcTotal.textContent    = b.total;

  setTimeout(function() {
    var bh = $id('bc-bar-high'), bm = $id('bc-bar-med'), bl = $id('bc-bar-low');
    if (bh) bh.style.width = Math.round(b.high   / total * 100) + '%';
    if (bm) bm.style.width = Math.round(b.medium / total * 100) + '%';
    if (bl) bl.style.width = Math.round(b.low    / total * 100) + '%';
  }, 100);

  var hlEl = $id('bc-highlights');
  if (hlEl) {
    if (b.highlights.length > 0) {
      hlEl.innerHTML = '<div class="bc-hl-title">🔴 Needs Attention</div>' +
        b.highlights.map(function(e) {
          return '<p class="bc-hl-item">• <strong>' + esc(e.subject.slice(0, 40)) + '</strong></p>';
        }).join('');
    } else {
      hlEl.innerHTML = '<p class="bc-hl-ok">✅ No urgent emails!</p>';
    }
  }
}

function updateUnreadBadge() {
  var unread = state.allLoaded.filter(function(e) { return !e.read; }).length;
  if (unreadBadge) unreadBadge.textContent = unread > 0 ? String(unread) : '';
  document.title = unread > 0 ? '(' + unread + ') InboxGuard AI' : 'InboxGuard AI';
}

// ── Modal ──────────────────────────────────────────────────
function showModal(icon, title, msg, onConfirm) {
  $id('modal-icon-wrap').textContent = icon;
  $id('modal-title').textContent = title;
  $id('modal-msg').textContent = msg;
  modalBg.classList.remove('hidden');

  function cleanup() { modalBg.classList.add('hidden'); }
  $id('modal-confirm').onclick = function() { cleanup(); onConfirm(); };
  $id('modal-cancel').onclick  = function() { cleanup(); showToast('🛡 Email kept safe'); };
  modalBg.onclick = function(e) { if (e.target === modalBg) cleanup(); };
}

// ── Event Listeners ────────────────────────────────────────
function setupEventListeners() {
  // Sidebar nav
  $qa('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      $qa('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var view = btn.dataset.view;
      if (view && !view.startsWith('priority-')) {
        state.currentView    = view;
        state.priorityFilter = 'all';
        state.currentCategory = 'all';
        $qa('.elf').forEach(function(b) { b.classList.remove('active'); });
        var allBtn = $q('.elf[data-pf="all"]');
        if (allBtn) allBtn.classList.add('active');
        // Reset category tabs
        $qa('.cat-tab').forEach(function(t) { t.classList.remove('active'); });
        var primaryTab = $q('.cat-tab[data-cat="all"]');
        if (primaryTab) primaryTab.classList.add('active');
      } else if (view && view.startsWith('priority-')) {
        state.priorityFilter = view.replace('priority-', '');
        state.currentView = 'INBOX';
        $qa('.nav-btn[data-view]').forEach(function(b) {
          b.classList.toggle('active', b.dataset.view === 'INBOX');
        });
      }

      state.isSearchMode  = false;
      state.searchQuery   = '';
      searchInput.value   = '';
      state.selectedEmail = null;
      showDetailPlaceholder();

      // Close mobile sidebar
      var sidebarEl = $id('sidebar');
      var overlayEl = $id('sidebar-overlay');
      if (sidebarEl && window.innerWidth <= 768) {
        sidebarEl.classList.remove('mobile-open');
        if (overlayEl) overlayEl.classList.remove('visible');
      }

      loadEmails();
    });
  });

  // Priority filter tabs
  $qa('.elf').forEach(function(btn) {
    btn.addEventListener('click', function() {
      $qa('.elf').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.priorityFilter = btn.dataset.pf;
      state.isSearchMode   = false;
      state.selectedEmail  = null;
      showDetailPlaceholder();
      updateDisplayedEmails();
    });
  });

  // Category tabs
  $qa('.cat-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      $qa('.cat-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.currentCategory = tab.dataset.cat || 'all';
      state.selectedEmail   = null;
      showDetailPlaceholder();
      updateDisplayedEmails();
    });
  });

  // Global search with debounce
  var searchTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    var q = searchInput.value.trim();
    searchTimer = setTimeout(function() {
      if (q.length > 2) {
        doSearch(q);
      } else if (q.length === 0) {
        state.isSearchMode = false;
        updateDisplayedEmails();
      }
    }, 350);
  });

  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      clearTimeout(searchTimer);
      var q = searchInput.value.trim();
      if (q) doSearch(q);
    }
    if (e.key === 'Escape') {
      searchInput.value = '';
      state.isSearchMode = false;
      updateDisplayedEmails();
    }
  });

  // Refresh button
  refreshBtn.addEventListener('click', function() {
    refreshBtn.classList.add('spinning');
    state.isSearchMode = false;
    state.searchQuery  = '';
    searchInput.value  = '';
    loadEmails().finally(function() {
      refreshBtn.classList.remove('spinning');
    });
  });

  // Load more
  loadMoreBtn.addEventListener('click', function() {
    if (state.nextPageToken) loadEmails(true);
  });

  // Logout
  var logoutBtn = $id('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', async function() {
    if (state.pollingTimer) clearInterval(state.pollingTimer);
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch(e) {}
    window.location.href = '/';
  });

  // Briefing toggle
  if (bcToggle) {
    bcToggle.classList.add('open');
    bcToggle.addEventListener('click', function() {
      bcToggle.classList.toggle('open');
      bcBody.style.display = bcBody.style.display === 'none' ? '' : 'none';
    });
  }

  // Compose button
  var composeBtn = $id('compose-btn');
  if (composeBtn) composeBtn.addEventListener('click', openComposeModal);

  // Compose modal events
  var composeClose = $id('compose-close');
  if (composeClose) composeClose.addEventListener('click', closeComposeModal);

  var composeSend = $id('compose-send-btn');
  if (composeSend) composeSend.addEventListener('click', sendCompose);

  // AI compose: auto-generate body when subject is typed
  var composeSub  = $id('compose-subject');
  var composeBody = $id('compose-body');
  var composeTo   = $id('compose-to');
  if (composeSub && composeBody) {
    var aiTimer;
    composeSub.addEventListener('input', function() {
      clearTimeout(aiTimer);
      aiTimer = setTimeout(function() {
        var sub = composeSub.value.trim();
        var to  = composeTo ? composeTo.value.trim() : '';
        if (sub.length > 3 && !composeBody.value.trim()) {
          state.composeVariantIdx = 0;
          composeBody.value = EmailComposerAgent.compose(to, sub, 0);
          showToast('🤖 AI wrote an email draft for you!');
        }
      }, 800);
    });
  }

  // AI Generate button (generate/regenerate body from current To+Subject)
  var composeGenBtn = $id('compose-gen-btn');
  if (composeGenBtn) {
    composeGenBtn.addEventListener('click', function() {
      var sub = ($id('compose-subject') || {}).value.trim();
      var to  = ($id('compose-to')      || {}).value.trim();
      if (!sub) { showToast('⚠️ Please enter a subject first'); return; }
      state.composeVariantIdx = 0;
      var body = EmailComposerAgent.compose(to, sub, 0);
      if ($id('compose-body')) $id('compose-body').value = body;
      showToast('🤖 AI draft generated!');
    });
  }

  // Rewrite button (cycle to next variant)
  var composeRwBtn = $id('compose-rewrite-btn');
  if (composeRwBtn) {
    composeRwBtn.addEventListener('click', function() {
      var sub = ($id('compose-subject') || {}).value.trim();
      var to  = ($id('compose-to')      || {}).value.trim();
      if (!sub) { showToast('⚠️ Please enter a subject first'); return; }
      var result = EmailComposerAgent.rewrite(to, sub, state.composeVariantIdx);
      state.composeVariantIdx = result.variantIndex;
      if ($id('compose-body')) $id('compose-body').value = result.body;
      showToast('🔄 Rewritten with a different style!');
    });
  }

  // Reply modal events
  var replyClose = $id('reply-close');
  if (replyClose) replyClose.addEventListener('click', closeReplyModal);

  var replySend = $id('reply-send-btn');
  if (replySend) replySend.addEventListener('click', sendReply);

  // Close modals on backdrop click
  var replyModal = $id('reply-modal');
  if (replyModal) replyModal.addEventListener('click', function(e) {
    if (e.target === replyModal) closeReplyModal();
  });
  var composeModal = $id('compose-modal');
  if (composeModal) composeModal.addEventListener('click', function(e) {
    if (e.target === composeModal) closeComposeModal();
  });

  // Escape key closes modals
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeReplyModal();
      closeComposeModal();
    }
  });

  // ── Sidebar Toggle (hamburger) ──
  var sidebarEl  = $id('sidebar');
  var overlayEl  = $id('sidebar-overlay');
  var toggleBtn  = $id('sidebar-toggle-btn');

  if (toggleBtn && sidebarEl) {
    toggleBtn.addEventListener('click', function() {
      var isMobile = window.innerWidth <= 768;
      if (isMobile) {
        sidebarEl.classList.toggle('mobile-open');
        if (overlayEl) overlayEl.classList.toggle('visible', sidebarEl.classList.contains('mobile-open'));
      } else {
        sidebarEl.classList.toggle('collapsed');
        // Update topnav-left width
        var topnavLeft = $q('.topnav-left');
        if (topnavLeft) {
          topnavLeft.classList.toggle('collapsed', sidebarEl.classList.contains('collapsed'));
        }
      }
    });
    if (overlayEl) {
      overlayEl.addEventListener('click', function() {
        sidebarEl.classList.remove('mobile-open');
        overlayEl.classList.remove('visible');
      });
    }
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        sidebarEl.classList.remove('mobile-open');
        if (overlayEl) overlayEl.classList.remove('visible');
        // Reset mobile detail state
        var elp = $q('.email-list-panel');
        var edp = $id('email-detail-panel');
        if (elp) elp.classList.remove('mobile-detail-open');
        if (edp) edp.classList.remove('mobile-detail-active');
      }
    });
  }
}


// ── Multi-Select Bulk Delete ──────────────────────────────
function addMultiSelectListeners() {
  // Bulk delete
  var msBtnDel = $id('ms-delete-btn');
  if (msBtnDel) {
    msBtnDel.addEventListener('click', async function() {
      if (state.selectedIds.size === 0) return;
      var ids = Array.from(state.selectedIds);
      msBtnDel.disabled = true;
      msBtnDel.textContent = 'Deleting…';
      var done = 0;
      await Promise.all(ids.map(function(id) {
        return apiFetch('/api/emails/' + id + '/trash', { method: 'POST' })
          .then(function() {
            state.allLoaded = state.allLoaded.filter(function(e) { return e.id !== id; });
            state.emails    = state.emails.filter(function(e) { return e.id !== id; });
            done++;
          }).catch(function() {});
      }));
      state.selectedIds.clear();
      if (state.selectedEmail && ids.includes(state.selectedEmail.id)) showDetailPlaceholder();
      renderEmailList();
      updateUnreadBadge();
      showToast('🗑 ' + done + ' email' + (done !== 1 ? 's' : '') + ' moved to Trash');
      msBtnDel.disabled = false;
      msBtnDel.textContent = '🗑 Delete';
    });
  }
  // Clear selection
  var msBtnClear = $id('ms-clear-btn');
  if (msBtnClear) {
    msBtnClear.addEventListener('click', function() {
      state.selectedIds.clear();
      renderEmailList();
    });
  }
  // Select all
  var msAll = $id('ms-select-all');
  if (msAll) {
    msAll.addEventListener('click', function() {
      state.emails.forEach(function(e) { state.selectedIds.add(e.id); });
      renderEmailList();
    });
  }
}

// ── Support Widget ────────────────────────────────────────
function setupSupportWidget() {
  // WhatsApp
  var waBtn = $id('support-wa-btn');
  if (waBtn) {
    waBtn.addEventListener('click', function() {
      window.open('https://wa.me/' + SUPPORT_WHATSAPP.replace(/[^0-9]/g, '') +
        '?text=' + encodeURIComponent('Hi! I need help with InboxGuard AI.'), '_blank');
    });
  }
  // Email support button
  var emailSupportBtn = $id('support-email-btn');
  if (emailSupportBtn) {
    emailSupportBtn.addEventListener('click', function() {
      openComposeModal(SUPPORT_EMAIL, 'Support Request – InboxGuard AI');
    });
  }
  // Toggle widget
  var widgetToggle = $id('support-toggle');
  var widgetPanel  = $id('support-panel');
  if (widgetToggle && widgetPanel) {
    widgetToggle.addEventListener('click', function() {
      widgetPanel.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#support-widget')) {
        widgetPanel.classList.remove('open');
      }
    });
  }
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  init();
  addMultiSelectListeners();
  setupSupportWidget();
});

})()
