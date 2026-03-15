// ============================================================
//  InboxGuard AI v2.0 – AI Agents (public/agents.js)
//  7 agents + CategoryAgent + EmailComposerAgent
// ============================================================

// ── 1. Priority Detection Agent ──────────────────────────────
var PriorityDetectionAgent = {
  HIGH_KW: [
    'job offer','offer letter','offer extended','you have been selected','pleased to offer',
    'interview scheduled','interview invitation','final round','onsite interview',
    'payment failed','transaction declined','insufficient funds','account suspended',
    'security alert','unauthorized access','verify your identity','suspicious activity',
    'performance review','salary revision','promotion letter','appraisal',
    'visa approved','joining letter','appointment letter','legal notice','summons',
    'annual bonus','performance bonus','increment letter','contract signed',
    'deadline today','immediate action required','your account has been',
    'admission offer','scholarship','result declared','you have passed'
  ],
  LOW_KW: [
    'newsletter','weekly digest','daily digest','monthly digest','unsubscribe',
    'view in browser','view this email','this email was sent to',
    'substack','medium daily digest','morning brew','tldr',
    'linkedin','i want to connect','waiting for your response','connection request',
    'people you may know','new connection','profile views','follow back',
    'twitter','instagram','facebook','youtube notification','tiktok',
    'spotify','apple music','song recommendation','new release','playlist',
    'netflix','prime video','hotstar','watch now','stream now',
    'promotional','flash sale','sale ends','limited time offer','up to % off',
    'cashback','promo code','voucher code','coupon','black friday','cyber monday',
    'flipkart','amazon deals','myntra','swiggy offers','zomato offers',
    'github notification','github digest','pr review requested','dependabot',
    'your weekly summary','what happened this week','here are your updates',
    'noreply','no-reply','donotreply','do-not-reply',
    'fine-grained personal access token','token expir'
  ],

  detect: function(email) {
    var subject  = (email.subject  || '').toLowerCase();
    var fromName = (email.fromName || email.from || '').toLowerCase();
    var fromAddr = (email.from     || '').toLowerCase();
    var body     = (email.body     || email.snippet || '').slice(0, 500).toLowerCase();
    var full     = subject + ' ' + fromName + ' ' + fromAddr + ' ' + body;

    var highHits = 0;
    this.HIGH_KW.forEach(function(k) {
      if (subject.indexOf(k) !== -1) highHits += 2;
      else if (full.indexOf(k) !== -1) highHits += 1;
    });

    var lowHits = 0;
    this.LOW_KW.forEach(function(k) {
      if (full.indexOf(k) !== -1) lowHits++;
    });

    if (/noreply|no-reply|donotreply|newsletter|@substack|@medium|@linkedin|@spotify|@netflix/
        .test(fromAddr)) lowHits += 2;

    if (highHits >= 2) return 'high';
    if (lowHits >= 1 && highHits === 0) return 'low';
    if (highHits === 1 && lowHits === 0) return 'high';
    return 'medium';
  },

  getBadgeHtml: function(p) {
    var cfg = {
      high:   { emoji: '🔴', text: 'High'   },
      medium: { emoji: '🟡', text: 'Med'    },
      low:    { emoji: '🟢', text: 'Low'    }
    };
    var c = cfg[p] || cfg.medium;
    return '<span class="pbadge ' + p + '">' + c.emoji + ' ' + c.text + '</span>';
  }
};


// ── 2. Summarization Agent ────────────────────────────────────
var SummarizationAgent = {
  NOISE: [
    /^https?:\/\//i,
    /^dear\s/i,
    /^hi\s/i,
    /^hello\s/i,
    /regards,?$/i,
    /^unsubscribe/i,
    /^view this email/i,
    /^this email was sent/i,
    /^if you (have|are|no longer)/i,
    /^\s*$/,
  ],

  HIGH_KW: ['offer','interview','payment','invoice','deadline','certificate',
    'security','alert','action required','selected','hired','approved',
    'confirm','schedule','meeting','update','result','passed','failed',
    'bonus','review','contract','visa','joining'],

  summarize: function(email) {
    // Strip HTML tags for summarization
    var raw = (email.body || email.snippet || '').trim()
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#8203;/g, '')   // zero-width space
      .replace(/&zwnj;/g, '')    // zero-width non-joiner
      .replace(/&zwj;/g, '')     // zero-width joiner
      .replace(/&#xFEFF;/g, '')  // BOM
      .replace(/&#x200B;/g, '')  // zero-width space hex
      .replace(/&#x200C;/g, '')  // zero-width non-joiner hex
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '') // strip unicode invisibles
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!raw) return 'No content available.';

    var lines = raw.split(/\n/).map(function(l) { return l.trim(); }).filter(Boolean);
    var self  = this;

    var clean = lines.filter(function(line) {
      return !self.NOISE.some(function(rx) { return rx.test(line); });
    });

    if (clean.length === 0) return (raw.replace(/\s+/g, ' ').trim()).slice(0, 160);

    var scored = clean.map(function(line) {
      var ll = line.toLowerCase();
      var score = 0;
      self.HIGH_KW.forEach(function(k) { if (ll.indexOf(k) !== -1) score += 2; });
      if (line.length > 20 && line.length < 200) score += 1;
      if (line.indexOf('http') !== -1) score -= 3;
      return { text: line, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    var picked = scored.slice(0, 3).map(function(s) { return s.text; });
    var origOrder = picked.sort(function(a, b) {
      return clean.indexOf(a) - clean.indexOf(b);
    });

    var summary = origOrder.join(' ').replace(/\s+/g, ' ').trim();
    summary = summary.replace(/[.…]+$/, '').trim();
    if (summary.length > 0 && !/[.!?]$/.test(summary)) summary += '.';

    if (summary.length > 250) {
      var cut = summary.slice(0, 250);
      var lastDot = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
      summary = lastDot > 100 ? cut.slice(0, lastDot + 1) : cut.trim() + '.';
    }

    return summary || raw.slice(0, 160);
  }
};


// ── 3. Reply Generation Agent ─────────────────────────────────
var ReplyGenerationAgent = {
  generate: function(email) {
    var text = [(email.subject||''), (email.body||''), (email.snippet||'')].join(' ').toLowerCase();

    if (/job offer|offer letter|pleased to offer|we'd like to offer|selected for the role/.test(text)) {
      return [
        'Thank you so much for the offer! I\'m thrilled about this opportunity and would love to accept.',
        'I\'d like to review the details carefully and respond by tomorrow – could you share the full offer document?',
        'Could you share more about the team structure, onboarding process, and start date?'
      ];
    }
    if (/interview|screening call|technical round|hiring process/.test(text)) {
      return [
        'I confirm my availability! Looking forward to the interview – please share any prep material.',
        'Thank you for the opportunity. I\'ll be well-prepared for the session.',
        'Could we possibly reschedule by 30 minutes if needed?'
      ];
    }
    if (/meeting|call scheduled|calendar invite|zoom|google meet|teams|sync/.test(text)) {
      return [
        'Thanks for the invite! I\'ll be there on time.',
        'Confirmed – I\'ll join as scheduled.',
        'I have a slight conflict. Could we push by 30 minutes?'
      ];
    }
    if (/payment|invoice|receipt|transaction|billing|amount due|subscription/.test(text)) {
      return [
        'Received, thank you for the confirmation.',
        'Please send a detailed invoice for my records.',
        'I\'ll process this and get back to you shortly.'
      ];
    }
    if (/bug|production|critical issue|outage|incident|deploy|release|pr merged/.test(text)) {
      return [
        'On it! I\'ll investigate and update you within the hour.',
        'Looking into this now. Will keep everyone posted.',
        'Can you share more details or logs? I\'ll jump on a call.'
      ];
    }
    if (/research|paper|thesis|feedback|revision|conference|submission/.test(text)) {
      return [
        'Thank you for the feedback. I\'ll incorporate all changes.',
        'I\'ll submit the revised version well before the deadline.',
        'Could we have a quick call to discuss specific sections?'
      ];
    }
    if (/security|sign-in|unusual activity|verify|2fa|authentication/.test(text)) {
      return [
        'Yes, that was me signing in. No action needed.',
        'I don\'t recognize this activity. I\'ll secure my account now.',
        'Please escalate this to the security team immediately.'
      ];
    }
    if (/mom|dad|family|brother|sister|cousin|uncle|aunt/.test(text)) {
      return [
        'Miss you too! Will call soon 😊',
        'I\'ll check my schedule and let you know this week.',
        'Sending lots of love! Talk soon. ❤️'
      ];
    }
    return [
      'Thank you for reaching out! I\'ll get back to you shortly.',
      'Noted – I\'ll review this and respond by EOD.',
      'Appreciate the update. I\'ll follow up as needed.'
    ];
  }
};

// ── 4. Meeting Detection Agent ────────────────────────────────
var MeetingDetectionAgent = {
  KW: ['meeting','interview','scheduled','schedule','zoom','google meet',
    'microsoft teams','webinar','conference call','sync','standup','one-on-one',
    'calendar','skype','invite','join us','join the call','attendance'],

  detect: function(email) {
    var text = [(email.subject||''), (email.body||'')].join(' ').toLowerCase();
    var full = [(email.subject||''), (email.body||'')].join(' ');
    var hasMtg = this.KW.some(function(k){ return text.indexOf(k) !== -1; });

    var dateM = full.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i)
      || full.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
    var timeM = full.match(/\d{1,2}:\d{2}\s*(?:AM|PM|IST|UTC|GMT|EST|PST)/i)
      || full.match(/\b\d{1,2}\s*(?:AM|PM)\b/i);

    return {
      isMeeting: hasMtg && (dateM || timeM),
      date:    dateM ? dateM[0] : null,
      time:    timeM ? timeM[0] : null,
      summary: dateM && timeM
        ? dateM[0] + ' at ' + timeM[0]
        : (dateM || timeM)
          ? (dateM || timeM)[0]
          : null
    };
  }
};

// ── 5. Email Protection Agent ─────────────────────────────────
var EmailProtectionAgent = {
  CRITICAL_KW: [
    'job offer','offer letter','you\'ve been selected','we are pleased to offer',
    'interview scheduled','final round','offer extended',
    'payment receipt','payment confirmation','transaction id','invoice',
    'certificate of completion','you have passed','congratulations',
    'annual bonus','performance bonus','salary hike','increment letter',
    'visa approved','appointment letter','joining letter','contract'
  ],

  checkBeforeDelete: function(email, priority) {
    var text = [(email.subject||''), (email.body||'')].join(' ').toLowerCase();
    var isCritical = this.CRITICAL_KW.some(function(k){ return text.indexOf(k) !== -1; });

    if (isCritical || priority === 'high') {
      return {
        protected: true,
        message: '⚠️ This email appears to contain important information (job offer, payment, certificate, or interview invite). Are you sure you want to delete it?'
      };
    }
    if (email.starred) {
      return {
        protected: true,
        message: '⭐ This email is starred as important. Are you sure you want to delete it?'
      };
    }
    return { protected: false };
  }
};

// ── 6. Daily Briefing Agent ───────────────────────────────────
var DailyBriefingAgent = {
  generate: function(emails) {
    var unread = 0, high = 0, medium = 0, low = 0, meetings = 0;
    var highlights = [];

    emails.forEach(function(e) {
      var p = PriorityDetectionAgent.detect(e);
      if (!e.read) unread++;
      if (p === 'high') {
        high++;
        if (!e.read) highlights.push(e);
      } else if (p === 'medium') {
        medium++;
      } else {
        low++;
      }
      if (MeetingDetectionAgent.detect(e).isMeeting) meetings++;
    });

    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return {
      greeting: greeting,
      total:   emails.length,
      unread:  unread,
      high:    high,
      medium:  medium,
      low:     low,
      meetings: meetings,
      highlights: highlights.slice(0, 3)
    };
  }
};

// ── 7. AI Email Search Agent ──────────────────────────────────
var EmailSearchAgent = {
  NL_TO_GMAIL: [
    { pattern: /interview/i,              gmail: 'interview OR "interview scheduled" OR "interview invitation"' },
    { pattern: /job offer|offer letter/i, gmail: '"job offer" OR "offer letter" OR "pleased to offer"' },
    { pattern: /payment|invoice|receipt/i,gmail: 'payment OR invoice OR receipt OR transaction' },
    { pattern: /certificate|certif/i,     gmail: 'certificate OR "certificate of completion" OR congratulations' },
    { pattern: /meeting|call|sync/i,      gmail: 'meeting OR "scheduled call" OR zoom OR "google meet"' },
    { pattern: /newsletter|digest/i,      gmail: 'unsubscribe OR newsletter OR digest' },
    { pattern: /security|sign.?in/i,      gmail: 'security OR "sign-in" OR "unusual activity"' },
    { pattern: /promo|sale|discount/i,    gmail: 'sale OR discount OR "promo code" OR cashback' },
    { pattern: /unread/i,                 gmail: 'is:unread' },
    { pattern: /starred|important/i,      gmail: 'is:starred' },
    { pattern: /high\s+priority|urgent/i, gmail: 'is:important OR priority:high' },
  ],

  toGmailQuery: function(nlQuery) {
    var q = nlQuery.trim();
    for (var i = 0; i < this.NL_TO_GMAIL.length; i++) {
      if (this.NL_TO_GMAIL[i].pattern.test(q)) return this.NL_TO_GMAIL[i].gmail;
    }
    return q;
  },

  filter: function(query, emails) {
    if (!query || !query.trim()) return emails;
    var q = query.toLowerCase().trim();

    var wantsUnread  = /\bunread\b/.test(q);
    var wantsStarred = /\bstarred\b|\bimportant\b/.test(q);
    var wantsHigh    = /high priority|urgent|critical/.test(q);

    var stopWords = new Set(['show','find','search','me','my','all','the','emails','email','about','from','last','week','this','year','today','recent']);
    var tokens = q.split(/\s+/).filter(function(t){ return t.length > 2 && !stopWords.has(t); });

    return emails.filter(function(email) {
      var text = [email.subject, email.body, email.from, email.fromName, email.snippet]
        .filter(Boolean).join(' ').toLowerCase();

      if (wantsUnread  && email.read)    return false;
      if (wantsStarred && !email.starred) return false;
      if (wantsHigh && PriorityDetectionAgent.detect(email) !== 'high') return false;
      if (!wantsUnread && !wantsStarred && !wantsHigh) {
        return tokens.some(function(t){ return text.indexOf(t) !== -1; });
      }
      return true;
    });
  }
};

// ── 8. Category Agent (Gmail-style tabs) ─────────────────────
var CategoryAgent = {
  categorize: function(email) {
    var fromAddr = (email.from     || '').toLowerCase();
    var fromName = (email.fromName || '').toLowerCase();
    var subject  = (email.subject  || '').toLowerCase();
    var body     = (email.body     || email.snippet || '').slice(0, 300).toLowerCase();
    var full     = fromAddr + ' ' + fromName + ' ' + subject + ' ' + body;

    // Social
    if (/linkedin\.com|twitter\.com|instagram\.com|facebook\.com|tiktok\.com|youtube\.com|snapchat|pinterest|reddit\.com/.test(fromAddr) ||
        /linkedin|twitter|instagram|facebook|youtube notification|tiktok|social media|followers|connection request|people you may know/.test(full)) {
      return 'social';
    }

    // Promotions
    if (/flipkart|amazon|myntra|swiggy|zomato|blinkit|nykaa|bigbasket|meesho|ajio|shopify/.test(fromAddr) ||
        /sale|offer|discount|cashback|promo code|voucher|coupon|deal|% off|flash sale|limited time|shop now|buy now|exclusive|save big/.test(full) ||
        /unsubscribe/.test(full)) {
      return 'promotions';
    }

    // Updates (platform notifications, newsletters, digests, noreply)
    if (/noreply|no-reply|donotreply|do-not-reply|mailer|notification|alerts?@/.test(fromAddr) ||
        /newsletter|digest|weekly update|monthly update|github|gitlab|jira|slack|trello|notion|substack|medium\.com/.test(full) ||
        /your account|password|verify|otp|login|sign.?in|access token/.test(full)) {
      return 'updates';
    }

    // Primary: everything else
    return 'primary';
  },

  getCounts: function(emails) {
    var counts = { primary: 0, promotions: 0, social: 0, updates: 0 };
    var newCounts = { primary: 0, promotions: 0, social: 0, updates: 0 };
    emails.forEach(function(e) {
      var cat = CategoryAgent.categorize(e);
      counts[cat]++;
      if (!e.read) newCounts[cat]++;
    });
    return { counts: counts, newCounts: newCounts };
  }
};

// ── 9. Email Composer Agent (AI body writer) ──────────────────
var EmailComposerAgent = {

  // Extract meaningful topic tokens from subject
  _topic: function(subject) {
    var stopWords = /^(regarding|re|fwd|fw|request|for|about|the|a|an|is|to|of|and|with|on|at|in|from|your|our|my|we|you|i|it|this|that|dear|hi|hello|hey|please|kindly|sir|ma'am|madam|team|all)$/i;
    return (subject || '')
      .replace(/[^a-zA-Z0-9 %]/g, ' ')
      .split(/\s+/)
      .filter(function(w) { return w.length > 2 && !stopWords.test(w); })
      .slice(0, 5)
      .join(' ');
  },

  // Detect the recipient's likely type from address
  _recipientType: function(to) {
    var t = (to || '').toLowerCase();
    if (/ac\.in|edu|iit|nit|hbtu|iiit|university|college/.test(t)) return 'academic';
    if (/hr@|recruit|career|hiring|jobs|talent/.test(t)) return 'recruiter';
    if (/support|help|info|contact|admin/.test(t)) return 'support';
    return 'professional';
  },

  // All template variants keyed by detected type
  _templates: {
    // Application / job
    application: [
      function(s, topic, to, rt) {
        var opening = rt === 'academic' ? 'Respected Sir/Madam,' : 'Dear Hiring Team,';
        return opening + '\n\nI hope this message finds you well.\n\nI am writing to formally apply for / request consideration regarding: ' + s + '\n\nI have carefully reviewed the requirements and believe I meet the necessary criteria. I would be keen to provide any additional information or documentation required.\n\nLooking forward to a positive response.\n\nWarm regards,\n[Your Name]';
      },
      function(s, topic, to, rt) {
        return 'Hello,\n\nI am reaching out in connection with – ' + s + '\n\nI am genuinely interested and would like to take this forward. Please let me know the next steps or any documentation you may require from my end.\n\nThank you for your time and consideration.\n\nSincerely,\n[Your Name]';
      },
      function(s, topic, to, rt) {
        return 'Dear Concerned Authority,\n\nThis email is with reference to: ' + s + '\n\nI humbly request your kind attention to the above matter. I assure you of my full cooperation and look forward to a favourable response at the earliest.\n\nWith regards,\n[Your Name]';
      }
    ],
    // Meeting / schedule
    meeting: [
      function(s, topic) {
        return 'Hi,\n\nHope you are doing well!\n\nI would like to schedule a brief call or meeting to discuss: ' + s + '\n\nCould you please share your availability for a 30-minute slot this week or early next week? I am flexible and happy to work around your schedule.\n\nLooking forward to connecting!\n\nBest regards,\n[Your Name]';
      },
      function(s, topic) {
        return 'Hello,\n\nI am writing to request a meeting regarding ' + s + '.\n\nPlease let me know a time that works best for you – I am available most weekdays between 10 AM and 5 PM. A video call (Zoom/Google Meet) would work great.\n\nThanks and regards,\n[Your Name]';
      }
    ],
    // Follow-up
    followup: [
      function(s, topic) {
        return 'Hi,\n\nI hope you are doing well. This is a gentle follow-up regarding: ' + s + '\n\nI wanted to check if there has been any progress or if you need any additional information from my side. I look forward to your update.\n\nThank you for your time.\n\nBest regards,\n[Your Name]';
      },
      function(s, topic) {
        return 'Hello,\n\nJust following up on ' + s + '.\n\nKindly let me know the current status at your earliest convenience. I am happy to provide any further details if required.\n\nAppreciate your prompt response.\n\nWith regards,\n[Your Name]';
      }
    ],
    // Payment / invoice
    payment: [
      function(s) {
        return 'Hi,\n\nI hope this email finds you well.\n\nI am writing regarding: ' + s + '\n\nKindly find the relevant details attached for your records. Please process the same at your earliest and do let me know once completed.\n\nFor any queries, feel free to reach out.\n\nBest regards,\n[Your Name]';
      },
      function(s) {
        return 'Dear Team,\n\nThis is to bring to your attention the matter of: ' + s + '\n\nWe request you to kindly take necessary action at the earliest and share the confirmation/receipt once done.\n\nThank you for your cooperation.\n\nRegards,\n[Your Name]';
      }
    ],
    // Thank you
    thankyou: [
      function(s) { return 'Hi,\n\nI just wanted to take a moment to sincerely thank you for ' + s + '.\n\nIt really means a lot and I truly appreciate your time and effort. I hope to stay in touch and return the favour whenever the opportunity arises.\n\nWith heartfelt gratitude,\n[Your Name]'; },
      function(s) { return 'Hello,\n\nA quick note of appreciation for ' + s + '.\n\nYour support has been invaluable and I am truly grateful. Please do not hesitate to reach out if there is ever anything I can do for you.\n\nWarm thanks,\n[Your Name]'; }
    ],
    // Complaint / request / permission
    complaint: [
      function(s, topic, to, rt) {
        var opening = rt === 'academic' ? 'Respected Sir/Madam,' : 'Dear Concerned Authority,';
        return opening + '\n\nI am writing to bring to your notice the following matter:\n\n' + s + '\n\nI request you to kindly look into this at the earliest and take appropriate action. I look forward to a prompt and favourable resolution.\n\nThank you for your understanding.\n\nYours sincerely,\n[Your Name]';
      },
      function(s) { return 'Hello,\n\nI wanted to raise a concern / make a formal request regarding: ' + s + '\n\nI would appreciate your assistance in resolving this matter and would be happy to provide any supporting information required.\n\nLooking forward to your response.\n\nRegards,\n[Your Name]'; }
    ],
    // Feedback / review
    feedback: [
      function(s) {
        return 'Hi,\n\nI am writing to share my feedback regarding: ' + s + '\n\nAfter careful consideration, here are my observations:\n\n• Observation 1: [Describe what worked well or an issue noticed]\n• Observation 2: [Suggest an improvement or highlight a strength]\n• Observation 3: [Any other relevant point]\n\nI hope this feedback is useful. Please feel free to reach out for a detailed discussion.\n\nBest regards,\n[Your Name]';
      }
    ],
    // Collaboration / partnership
    collab: [
      function(s) {
        return 'Hi,\n\nI hope this email finds you well!\n\nI am reaching out to explore a potential collaboration on: ' + s + '\n\nI believe we can achieve great results together and would love to discuss how we can work towards a common goal. Would you be open to a quick call this week?\n\nLooking forward to hearing from you.\n\nBest regards,\n[Your Name]';
      }
    ],
    // Generic / default
    generic: [
      function(s) {
        return 'Hi,\n\nI hope this message finds you well.\n\nI am writing to you regarding: ' + s + '\n\nI would appreciate your guidance / assistance on the above. Please let me know if you need any further details from my end.\n\nLooking forward to your response.\n\nBest regards,\n[Your Name]';
      },
      function(s) {
        return 'Hello,\n\nHope you are doing great!\n\nThis email is regarding: ' + s + '\n\n[Add your main message here – the AI has set up the structure for you. Just fill in the key details and send!]\n\nFeel free to reach out with any questions.\n\nThanks and regards,\n[Your Name]';
      },
      function(s) {
        return 'Dear Sir/Madam,\n\nGreetings!\n\nI am writing with reference to: ' + s + '\n\nI wish to bring this to your kind attention and request your prompt response. I am available for further discussion at your convenience.\n\nWith kind regards,\n[Your Name]';
      }
    ]
  },

  _detectType: function(s) {
    if (/interview|application|apply|job|position|role|hiring|resume|cv|recruitment|admission|scholarship|selection|internship|offer|oppurtunity|opportunity|candidature|attendance|leave|permission|fee|dues/.test(s)) return 'application';
    if (/meeting|schedule|call|sync|discussion|catch.?up|connect|appointment|demo|presentation/.test(s)) return 'meeting';
    if (/follow.?up|followup|checking|update|status|remind|pending|awaiting|response/.test(s)) return 'followup';
    if (/invoice|payment|billing|amount|fee|cost|price|quote|transaction|refund|reimbursement/.test(s)) return 'payment';
    if (/thank|thanks|gratitude|appreciation|grateful|acknowledge/.test(s)) return 'thankyou';
    if (/complaint|grievance|issue|problem|concern|dissatisfied|unsatisfied|error|bug|wrong|incorrect|inconvenience/.test(s)) return 'complaint';
    if (/feedback|review|suggestion|improve|opinion|thoughts|rating|evaluation/.test(s)) return 'feedback';
    if (/collab|partner|partnership|joint|together|team.?up|proposal/.test(s)) return 'collab';
    return 'generic';
  },

  compose: function(to, subject, variantIndex) {
    var s    = (subject || '').trim();
    var sl   = s.toLowerCase();
    var topic = this._topic(s);
    var rt   = this._recipientType(to);
    var type = this._detectType(sl);
    var variants = this._templates[type] || this._templates.generic;
    var idx = (variantIndex !== undefined && variantIndex !== null)
      ? variantIndex % variants.length
      : 0;
    return variants[idx](s, topic, to, rt);
  },

  rewrite: function(to, subject, currentIndex) {
    var type = this._detectType((subject || '').toLowerCase());
    var variants = this._templates[type] || this._templates.generic;
    var nextIdx = ((currentIndex || 0) + 1) % variants.length;
    return { body: this.compose(to, subject, nextIdx), variantIndex: nextIdx };
  }
};
