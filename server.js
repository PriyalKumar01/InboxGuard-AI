// ============================================================
//  InboxGuard AI - Server (server.js)
//  Node.js + Express + Gmail OAuth + Gmail API
// ============================================================
require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const { google }   = require('googleapis');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── OAuth2 Client ────────────────────────────────────────────
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${baseUrl}/auth/google/callback`
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'inboxguard-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false }
}));

// ── Helper: get authenticated Gmail client ───────────────────
function getGmailClient(session) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials(session.tokens);
  client.on('tokens', (newTokens) => {
    session.tokens = { ...session.tokens, ...newTokens };
  });
  return google.gmail({ version: 'v1', auth: client });
}

// ── Helper: parse email address header ───────────────────────
function parseFrom(fromHeader) {
  if (!fromHeader) return { name: 'Unknown', email: '' };
  const m = fromHeader.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: fromHeader.trim(), email: fromHeader.trim() };
}

// ── Helper: decode base64 email body ─────────────────────────
function decodeBody(payload) {
  let html = '';
  let text = '';
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      html += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      text += Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(walk);
  };
  walk(payload);
  // Prefer HTML body for richer display; fall back to plain text
  return { html: html.trim(), text: text.trim() };
}

// ── Helper: format email message ─────────────────────────────
function formatMessage(data) {
  const headers = data.payload.headers || [];
  const h = (name) => (headers.find(x => x.name.toLowerCase() === name.toLowerCase()) || {}).value || '';

  const fromParsed = parseFrom(h('From'));
  const { html, text } = decodeBody(data.payload);
  const body = html || text || data.snippet || '';

  return {
    id:           data.id,
    threadId:     data.threadId,
    from:         fromParsed.email,
    fromName:     fromParsed.name,
    to:           h('To'),
    subject:      h('Subject') || '(No Subject)',
    messageId:    h('Message-ID'),
    references:   h('References'),
    date:         h('Date'),
    dateMs:       parseInt(data.internalDate) || Date.now(),
    body:         body.slice(0, 8000),
    isHtml:       !!html,
    snippet:      data.snippet || '',
    read:         !(data.labelIds || []).includes('UNREAD'),
    starred:      (data.labelIds || []).includes('STARRED'),
    labels:       data.labelIds || [],
    hasAttachment: (data.payload.parts || []).some(p =>
      p.filename && p.filename.length > 0
    ),
  };
}

// ── Helper: build RFC 2822 raw email ────────────────────────
function buildRawEmail({ to, from, subject, body, inReplyTo, references }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
  ];
  if (inReplyTo)  lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('', body);
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

// ── Auth Routes ──────────────────────────────────────────────
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent select_account',
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    console.error('OAuth error from Google:', error);
    return res.redirect('/?auth=error&reason=' + encodeURIComponent(error));
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;

    // Fetch user info
    const tempClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    tempClient.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: tempClient });
    const { data: userInfo } = await oauth2Api.userinfo.get();
    req.session.user = {
      id:      userInfo.id,
      name:    userInfo.name,
      email:   userInfo.email,
      picture: userInfo.picture,
    };

    res.redirect('/?auth=success');
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.redirect('/?auth=error&reason=' + encodeURIComponent(err.message));
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ── API: Current User ────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (!req.session.user || !req.session.tokens) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, user: req.session.user });
});

// ── API: Fetch Emails ────────────────────────────────────────
app.get('/api/emails', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const gmail = getGmailClient(req.session);

    const pageToken   = req.query.pageToken    || undefined;
    const maxResults  = Math.min(parseInt(req.query.limit) || 50, 100);
    const labelFilter = req.query.label        || 'INBOX';
    const q           = req.query.q            || '';

    // List message IDs
    const listResp = await gmail.users.messages.list({
      userId:     'me',
      maxResults,
      pageToken,
      labelIds:   labelFilter !== 'all' ? [labelFilter] : undefined,
      q:          q || undefined,
    });

    const messages      = listResp.data.messages      || [];
    const nextPageToken = listResp.data.nextPageToken  || null;
    const total         = listResp.data.resultSizeEstimate || messages.length;

    if (messages.length === 0) {
      return res.json({ emails: [], nextPageToken: null, total: 0 });
    }

    // Batch fetch full message details (parallel)
    const details = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({
          userId:  'me',
          id:      msg.id,
          format:  'full',
        }).catch(e => {
          console.warn(`Failed to fetch msg ${msg.id}:`, e.message);
          return null;
        })
      )
    );

    const emails = details
      .filter(Boolean)
      .map(({ data }) => formatMessage(data));

    res.json({ emails, nextPageToken, total });
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
    if (err.code === 401 || err.status === 401) {
      req.session.tokens = null;
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── API: Send Reply ──────────────────────────────────────────
app.post('/api/emails/:id/reply', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    const { to, subject, body, inReplyTo, references, threadId } = req.body;
    const fromEmail = req.session.user.email;
    const fromName  = req.session.user.name;

    const raw = buildRawEmail({
      to,
      from:       `${fromName} <${fromEmail}>`,
      subject:    subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body,
      inReplyTo,
      references,
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Reply send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Send Composed Email ─────────────────────────────────
app.post('/api/emails/compose', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    const { to, subject, body } = req.body;
    const fromEmail = req.session.user.email;
    const fromName  = req.session.user.name;

    const raw = buildRawEmail({
      to, subject, body,
      from: `${fromName} <${fromEmail}>`,
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Compose send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Star/Unstar Email ───────────────────────────────────
app.post('/api/emails/:id/star', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    const { starred } = req.body;
    await gmail.users.messages.modify({
      userId: 'me',
      id: req.params.id,
      requestBody: {
        addLabelIds:    starred ? ['STARRED'] : [],
        removeLabelIds: starred ? [] : ['STARRED'],
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Mark as Read ────────────────────────────────────────
app.post('/api/emails/:id/read', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    await gmail.users.messages.modify({
      userId: 'me',
      id: req.params.id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Trash Email ─────────────────────────────────────────
app.post('/api/emails/:id/trash', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    await gmail.users.messages.trash({ userId: 'me', id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Untrash Email ───────────────────────────────────────
app.post('/api/emails/:id/untrash', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const gmail = getGmailClient(req.session);
    await gmail.users.messages.untrash({ userId: 'me', id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Gmail Search ────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: 'Not authenticated' });
  const { q } = req.query;
  if (!q) return res.json({ emails: [] });

  try {
    const gmail = getGmailClient(req.session);

    const listResp = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 30,
      q: q,
    });

    const messages = listResp.data.messages || [];
    if (!messages.length) return res.json({ emails: [] });

    const details = await Promise.all(
      messages.map(msg =>
        gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' })
          .catch(() => null)
      )
    );

    const emails = details.filter(Boolean).map(({ data }) => formatMessage(data));
    res.json({ emails, total: emails.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         InboxGuard AI  v2.0              ║');
  console.log(`║   Server: http://localhost:${PORT}           ║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('  Gmail OAuth: http://localhost:' + PORT + '/auth/google');
  console.log('  Make sure http://localhost:' + PORT + '/auth/google/callback');
  console.log('  is added as authorized redirect URI in Google Cloud Console.\n');
});
