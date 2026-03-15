// ============================================================
//  InboxGuard AI — AI Agents (agents.js)
//  Plain global functions — no ES modules
// ============================================================

// ── 1. Priority Detection Agent ──────────────────────────────
var PriorityDetectionAgent = {
  HIGH_KEYWORDS: [
    'urgent', 'critical', 'immediately', 'asap', 'emergency', 'production bug',
    'job offer', 'offer letter', 'interview scheduled', 'performance review',
    'security alert', 'new sign-in', 'transaction failed', 'payment failed',
    'annual bonus', 'deadline', 'war room', 'cto', 'ceo', 'boss',
    'confirm your availability', 'failed payment'
  ],
  LOW_KEYWORDS: [
    'newsletter', 'digest', 'flash sale', 'promotion', 'discount',
    'cashback', 'unsubscribe', 'profile views', 'recording ready',
    'workspace is', 'unread messages', 'slack notification'
  ],

  detect: function(email) {
    var text = ((email.subject || '') + ' ' + (email.body || '') + ' ' + (email.fromName || '')).toLowerCase();
    var h = 0, l = 0;
    for (var i = 0; i < this.HIGH_KEYWORDS.length; i++) {
      if (text.indexOf(this.HIGH_KEYWORDS[i]) !== -1) h++;
    }
    for (var j = 0; j < this.LOW_KEYWORDS.length; j++) {
      if (text.indexOf(this.LOW_KEYWORDS[j]) !== -1) l++;
    }
    if (h >= 1 && l === 0) return 'high';
    if (l >= 2 && h === 0) return 'low';
    return 'medium';
  },

  getBadge: function(p) {
    return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
  }
};

// ── 2. Summarization Agent ────────────────────────────────────
var SummarizationAgent = {
  KEYWORDS: [
    'urgent', 'offer', 'interview', 'meeting', 'payment', 'invoice', 'deadline',
    'confirm', 'schedule', 'review', 'update', 'bonus', 'certificate', 'failed',
    'security', 'sale', 'critical', 'action', 'required', 'complete', 'job'
  ],

  summarize: function(email) {
    var body = (email.body || '').replace(/\n+/g, ' ').trim();
    var self = this;
    var sentences = body.split(/[.!?]\s+/).filter(function(s) { return s.length > 20; });
    if (sentences.length === 0) return body.slice(0, 160);

    var scored = sentences.map(function(s) {
      var sl = s.toLowerCase();
      var score = 0;
      for (var i = 0; i < self.KEYWORDS.length; i++) {
        if (sl.indexOf(self.KEYWORDS[i]) !== -1) score++;
      }
      return { text: s.trim(), score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    var top = scored.slice(0, 2).map(function(s) { return s.text; }).join(' ');
    return top.slice(0, 200) + (top.length > 200 ? '…' : '');
  }
};

// ── 3. Reply Generation Agent ─────────────────────────────────
var ReplyGenerationAgent = {
  generate: function(email) {
    var text = ((email.subject || '') + ' ' + (email.body || '')).toLowerCase();
    var cat = email.category || '';

    if (cat === 'job' || text.indexOf('job offer') !== -1 || text.indexOf('offer letter') !== -1) {
      return [
        'Thank you for the offer! I\'m very excited about this opportunity.',
        'I\'d like to review the details and get back to you by tomorrow.',
        'Could you share more details about the role and team structure?'
      ];
    }
    if (cat === 'interview' || text.indexOf('interview') !== -1) {
      return [
        'I confirm my availability for the interview. Looking forward to it!',
        'Thank you for the opportunity. I\'ll be fully prepared for the session.',
        'Could we possibly reschedule to a slightly different time?'
      ];
    }
    if (cat === 'meeting' || text.indexOf('meeting') !== -1 || text.indexOf('review meeting') !== -1) {
      return [
        'Thanks for the invite! I\'ll be there on time.',
        'Confirmed – I\'ll join the meeting as scheduled.',
        'I have a conflict that day. Can we reschedule to next week?'
      ];
    }
    if (cat === 'payment' || text.indexOf('payment') !== -1 || text.indexOf('invoice') !== -1) {
      return [
        'Received, thank you for the confirmation.',
        'Please send me the detailed invoice for my records.',
        'I\'ll process this and get back to you shortly.'
      ];
    }
    if (cat === 'work' || text.indexOf('bug') !== -1 || text.indexOf('production') !== -1) {
      return [
        'On it! I\'ll investigate and update you within the hour.',
        'Looking into this now. Will keep the team updated.',
        'Thanks for flagging. I\'ll coordinate with the team immediately.'
      ];
    }
    if (cat === 'education' || text.indexOf('research') !== -1 || text.indexOf('paper') !== -1) {
      return [
        'Thank you for the detailed feedback. I\'ll incorporate the changes.',
        'Understood! I\'ll submit the revised version before the deadline.',
        'Could we schedule a quick call to clarify some points?'
      ];
    }
    if (cat === 'security') {
      return [
        'Yes, that was me. No further action needed.',
        'I don\'t recognize this activity. I\'ll secure my account now.',
        'I\'ll review my account activity immediately.'
      ];
    }
    if (cat === 'personal') {
      return [
        'Hi Mom! Miss you too. I\'ll try to make it home! 😊',
        'Will call you soon to discuss the plans!',
        'I\'ll check my work schedule and let you know this week.'
      ];
    }
    return [
      'Thank you for reaching out! I\'ll get back to you soon.',
      'Noted – I\'ll take a look and respond shortly.',
      'Thanks for the update. Acknowledged!'
    ];
  }
};

// ── 4. Meeting Detection Agent ────────────────────────────────
var MeetingDetectionAgent = {
  KEYWORDS: ['meeting', 'interview', 'scheduled', 'schedule', 'zoom', 'google meet',
    'figma meet', 'conference', 'call', 'session', 'review meeting', 'sync'],

  detect: function(email) {
    var text = ((email.subject || '') + ' ' + (email.body || '')).toLowerCase();
    var hasMtg = false;
    for (var i = 0; i < this.KEYWORDS.length; i++) {
      if (text.indexOf(this.KEYWORDS[i]) !== -1) { hasMtg = true; break; }
    }

    var fullText = (email.subject || '') + ' ' + (email.body || '');

    var dateMatch = fullText.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i)
      || fullText.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\w+\s+\d{1,2}/i);

    var timeMatch = fullText.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|IST)?/);

    return {
      isMeeting: hasMtg && (dateMatch || timeMatch),
      date: dateMatch ? dateMatch[0] : null,
      time: timeMatch ? timeMatch[0] : null,
      summary: dateMatch && timeMatch
        ? dateMatch[0] + ' at ' + timeMatch[0]
        : dateMatch ? dateMatch[0]
        : timeMatch ? timeMatch[0] : null
    };
  }
};

// ── 5. Email Protection Agent ─────────────────────────────────
var EmailProtectionAgent = {
  checkBeforeDelete: function(email, priority) {
    if (priority === 'high') {
      return {
        protected: true,
        message: '⚠️ This is a HIGH PRIORITY email from ' + (email.fromName || 'unknown') + '. Are you sure you want to delete it?'
      };
    }
    if (email.starred) {
      return {
        protected: true,
        message: '⭐ This email is starred. Are you sure you want to delete it?'
      };
    }
    return { protected: false, message: '' };
  }
};

// ── 6. Daily Briefing Agent ───────────────────────────────────
var DailyBriefingAgent = {
  generate: function(emails) {
    var unread = 0, high = 0, medium = 0, low = 0, meetings = 0;
    var highlights = [];

    for (var i = 0; i < emails.length; i++) {
      var e = emails[i];
      var p = PriorityDetectionAgent.detect(e);
      if (!e.read) unread++;
      if (p === 'high') { high++; if (!e.read) highlights.push(e); }
      if (p === 'medium') medium++;
      if (p === 'low') low++;
      var mtg = MeetingDetectionAgent.detect(e);
      if (mtg.isMeeting) meetings++;
    }

    return {
      total: emails.length,
      unread: unread,
      high: high,
      medium: medium,
      low: low,
      meetings: meetings,
      highlights: highlights.slice(0, 3)
    };
  }
};

// ── 7. Email Search Agent ─────────────────────────────────────
var EmailSearchAgent = {
  CATEGORY_MAP: {
    job: ['job', 'offer', 'hiring', 'recruit', 'career', 'position', 'role'],
    interview: ['interview', 'round', 'screening'],
    meeting: ['meeting', 'calendar', 'schedule', 'zoom', 'call', 'sync', 'review'],
    payment: ['payment', 'invoice', 'bill', 'receipt', 'transaction', 'stripe', 'razorpay', 'aws'],
    education: ['certificate', 'coursera', 'professor', 'research', 'paper', 'hackerrank', 'course'],
    newsletter: ['newsletter', 'digest', 'medium', 'weekly', 'daily'],
    promo: ['sale', 'discount', 'cashback', 'flash', 'deal', 'promo', 'flipkart', 'amazon'],
    security: ['security', 'sign-in', 'login', 'account', 'suspicious'],
    work: ['bug', 'production', 'github', 'pull request', 'deploy', 'sprint', 'roadmap', 'team']
  },

  search: function(query, emails) {
    if (!query || !query.trim()) return emails;
    var q = query.toLowerCase();

    var targetCat = null;
    var cats = Object.keys(this.CATEGORY_MAP);
    for (var c = 0; c < cats.length; c++) {
      var kws = this.CATEGORY_MAP[cats[c]];
      for (var k = 0; k < kws.length; k++) {
        if (q.indexOf(kws[k]) !== -1) { targetCat = cats[c]; break; }
      }
      if (targetCat) break;
    }

    var wantsUnread = q.indexOf('unread') !== -1;
    var wantsStarred = q.indexOf('starred') !== -1 || q.indexOf('important') !== -1;
    var wantsHigh = q.indexOf('high') !== -1 || q.indexOf('urgent') !== -1 || q.indexOf('critical') !== -1;

    var stopWords = ['show','find','search','all','my','me','the','emails','email','about','with','from'];
    var tokens = q.split(/\s+/).filter(function(t) {
      return t.length > 2 && stopWords.indexOf(t) === -1;
    });

    var self = this;
    return emails.filter(function(email) {
      var text = ((email.subject || '') + ' ' + (email.body || '') + ' ' + (email.from || '') + ' ' + (email.fromName || '') + ' ' + (email.category || '')).toLowerCase();

      if (targetCat && email.category !== targetCat) return false;
      if (wantsUnread && email.read) return false;
      if (wantsStarred && !email.starred) return false;
      if (wantsHigh && PriorityDetectionAgent.detect(email) !== 'high') return false;

      if (!targetCat && !wantsUnread && !wantsStarred && !wantsHigh) {
        for (var i = 0; i < tokens.length; i++) {
          if (text.indexOf(tokens[i]) !== -1) return true;
        }
        return false;
      }

      return true;
    });
  }
};
