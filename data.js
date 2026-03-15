
// ============================================================
//  InboxGuard AI — Sample Email Data (data.js)
//  Plain global array — no module system needed
// ============================================================

var INBOX_EMAILS = [
  {
    id: 1,
    from: "hr@techcorp.io",
    fromName: "TechCorp HR",
    subject: "Job Offer – Senior Software Engineer",
    body: "Dear Priya,\n\nWe are thrilled to extend you a formal offer for the position of Senior Software Engineer at TechCorp. After carefully reviewing your profile and your excellent performance in our interview rounds, we believe you are an exceptional fit for our team.\n\nOffer Details:\n• Role: Senior Software Engineer\n• Compensation: ₹28 LPA + ESOPs\n• Start Date: April 1, 2026\n• Location: Bengaluru (Hybrid)\n\nPlease review the attached offer letter and revert with your acceptance by March 20, 2026. We look forward to having you on board!\n\nBest regards,\nAnita Sharma\nHead of Talent Acquisition, TechCorp",
    date: "2026-03-15T09:00:00",
    read: false,
    starred: true,
    category: "job"
  },
  {
    id: 2,
    from: "noreply@stripe.com",
    fromName: "Stripe",
    subject: "Payment of ₹4,999 received for InboxGuard Pro",
    body: "Hi Priya,\n\nYour payment of ₹4,999.00 for InboxGuard Pro (Annual Plan) was successfully processed.\n\nTransaction Details:\n• Amount: ₹4,999.00\n• Date: March 15, 2026\n• Payment Method: Visa ending in 4242\n• Invoice ID: INV-2026-0315-887\n\nYour subscription is now active until March 15, 2027.\n\nThank you for your business!\n\nStripe Payment Services",
    date: "2026-03-15T08:30:00",
    read: false,
    starred: false,
    category: "payment"
  },
  {
    id: 3,
    from: "interviewer@googlex.com",
    fromName: "Google Interviews",
    subject: "Interview Scheduled – March 18, 2026 at 11:00 AM IST",
    body: "Hello Priya,\n\nWe're pleased to invite you to the next round of interviews for the Software Engineer role at Google.\n\nMeeting Details:\n📅 Date: Wednesday, March 18, 2026\n🕐 Time: 11:00 AM – 12:30 PM IST\n📍 Format: Google Meet (link will be sent 30 min before)\n👤 Interviewer: Rahul Mehta, Principal Engineer\n\nPlease confirm your availability by replying to this email.\n\nGood luck!\n\nGoogle Recruiting Team",
    date: "2026-03-14T18:00:00",
    read: false,
    starred: true,
    category: "interview"
  },
  {
    id: 4,
    from: "manager@project.dev",
    fromName: "Vikram Singh (Manager)",
    subject: "URGENT: Production bug in payment module – needs immediate fix",
    body: "Hi Priya,\n\nCritical alert: our payment processing module is throwing 503 errors for ~15% of transactions in production.\n\nAffected endpoint: POST /api/v2/checkout/process\nError rate: ~15%\nStarted: 8:42 AM today\n\nPlease join the war room immediately: meet.google.com/war-room-prod\n\nPriority: CRITICAL. Loop in the full backend team.\n\nVikram",
    date: "2026-03-15T09:15:00",
    read: false,
    starred: false,
    category: "work"
  },
  {
    id: 5,
    from: "noreply@coursera.org",
    fromName: "Coursera",
    subject: "Your certificate is ready – Machine Learning Specialization",
    body: "Congratulations, Priya! 🎉\n\nYou've successfully completed the Machine Learning Specialization by Andrew Ng on Coursera!\n\nYour verified certificate is now available:\n📜 Certificate ID: CERT-ML-2026-88423\n🔗 View Certificate: coursera.org/verify/88423\n\nShare it on LinkedIn to showcase your skills!\n\nKeep learning,\nThe Coursera Team",
    date: "2026-03-13T14:00:00",
    read: true,
    starred: false,
    category: "education"
  },
  {
    id: 6,
    from: "newsletter@medium.com",
    fromName: "Medium Daily Digest",
    subject: "Today's top stories in AI, Tech & Design",
    body: "Good morning! Here are today's top picks:\n\n📌 \"The Future of LLMs: What GPT-5 Could Look Like\" – 12 min read\n📌 \"10 VSCode Extensions You're Missing Out On\" – 5 min read\n📌 \"Why Figma is Still Winning the Design Tool Wars\" – 8 min read\n📌 \"React 20: What's New and Should You Upgrade\" – 9 min read\n\nPersonalized based on your interests in AI and web development.\n\nUnsubscribe | Manage Preferences",
    date: "2026-03-15T07:00:00",
    read: true,
    starred: false,
    category: "newsletter"
  },
  {
    id: 7,
    from: "recruiter@startup.vc",
    fromName: "Riya Kapoor – NovaMind AI",
    subject: "Exciting opportunity at a Series B AI startup – let's connect!",
    body: "Hi Priya,\n\nI came across your profile on LinkedIn and was really impressed by your expertise in AI/ML and full-stack development.\n\nWe're building an AI-powered document intelligence platform and looking for senior engineers to join early. The role comes with:\n• Competitive comp + generous equity\n• Fully remote\n• Work directly with the founding team\n\nWould you be open to a 20-min call this week?\n\nWarm regards,\nRiya Kapoor\nTalent Partner, NovaMind AI",
    date: "2026-03-14T11:00:00",
    read: false,
    starred: false,
    category: "job"
  },
  {
    id: 8,
    from: "accounts@aws.amazon.com",
    fromName: "Amazon Web Services",
    subject: "Your AWS bill for February 2026 – ₹3,217.44",
    body: "Dear Customer,\n\nYour AWS invoice for February 2026 is now available.\n\nAccount: priya@inboxguard.ai\nBilling Period: Feb 1 – Feb 28, 2026\nTotal Amount Due: ₹3,217.44\nDue Date: March 25, 2026\n\nService Breakdown:\n• EC2 Instances: ₹1,892.00\n• S3 Storage: ₹423.50\n• Lambda Functions: ₹312.94\n• CloudFront CDN: ₹589.00\n\nAmazon Web Services",
    date: "2026-03-14T06:00:00",
    read: true,
    starred: false,
    category: "payment"
  },
  {
    id: 9,
    from: "team@figma.com",
    fromName: "Figma",
    subject: "Design review meeting – March 19, 2026 at 3:00 PM",
    body: "Hi team,\n\nA design review meeting has been scheduled for the InboxGuard AI dashboard redesign.\n\n📅 Date: Thursday, March 19, 2026\n🕒 Time: 3:00 PM – 4:30 PM IST\n📍 Figma Meet: figma.com/meet/inboxguard-review\n\nAgenda:\n1. Current dashboard walkthrough (15 min)\n2. Proposed redesign review (30 min)\n3. Feedback and iteration planning (15 min)\n\nSee you there!\nFigma Design Team",
    date: "2026-03-14T10:00:00",
    read: false,
    starred: true,
    category: "meeting"
  },
  {
    id: 10,
    from: "promo@flipkart.com",
    fromName: "Flipkart",
    subject: "🔥 Flash Sale! Up to 80% OFF on Electronics – Today Only",
    body: "SUPER SALE IS LIVE!\n\n🛒 Grab the best deals before they're gone:\n• Apple MacBook Air M3 – ₹89,999\n• Sony WH-1000XM5 Headphones – ₹18,999\n• Samsung Galaxy S25 – ₹64,999\n\n⏰ Sale ends at midnight!\n\nShop Now → flipkart.com/flash-sale\n\nUnsubscribe from promotional emails",
    date: "2026-03-15T06:00:00",
    read: true,
    starred: false,
    category: "promo"
  },
  {
    id: 11,
    from: "boss@company.com",
    fromName: "Arjun Mehta (CEO)",
    subject: "Quarterly performance review – March 20, 2026 at 2 PM",
    body: "Hi Priya,\n\nI'd like to schedule your quarterly performance review.\n\n📅 Date: Friday, March 20, 2026\n🕑 Time: 2:00 PM – 3:00 PM IST\n📍 My Office / Zoom: zoom.us/j/9988776655\n\nTopics we'll cover:\n1. Q1 performance highlights\n2. Goals for Q2\n3. Professional development plan\n\nLooking forward to our conversation.\n\nBest,\nArjun Mehta\nCEO, InboxGuard",
    date: "2026-03-13T17:00:00",
    read: false,
    starred: true,
    category: "meeting"
  },
  {
    id: 12,
    from: "noreply@github.com",
    fromName: "GitHub",
    subject: "Your PR #247 was merged – feat: add AI priority tagging",
    body: "Hey priya-dev,\n\nYour pull request #247 \"feat: add AI priority tagging to email classifier\" has been merged into main by @vikramsingh.\n\n📦 Repository: inboxguard-ai/core\n🔀 Commits: 8 commits merged\n✅ CI Checks: All 12 passed\n\nRelease to production is scheduled for March 16.\n\nGitHub",
    date: "2026-03-14T20:00:00",
    read: true,
    starred: false,
    category: "work"
  },
  {
    id: 13,
    from: "security@google.com",
    fromName: "Google Security",
    subject: "New sign-in on your account from Chrome on Windows",
    body: "A new sign-in to your Google Account priya@gmail.com was detected.\n\nDevice: Chrome on Windows 11\nLocation: Bengaluru, India\nTime: March 15, 2026, 8:55 AM IST\n\nIf this was you, no action is needed.\n\nIf you don't recognize this sign-in, secure your account immediately:\n→ myaccount.google.com/security\n\nGoogle Security Team",
    date: "2026-03-15T09:00:00",
    read: false,
    starred: false,
    category: "security"
  },
  {
    id: 14,
    from: "updates@linkedin.com",
    fromName: "LinkedIn",
    subject: "You appeared in 34 searches this week 🎯",
    body: "Hi Priya,\n\nHere's your weekly LinkedIn summary:\n\n👀 Profile views: 47 (+22% from last week)\n🔍 Search appearances: 34\n📈 Post impressions: 1,204\n🤝 New connection requests: 8\n\nTop companies that viewed your profile:\n• Google\n• Microsoft\n• PhonePe\n• Razorpay\n\nLinkedIn",
    date: "2026-03-14T09:00:00",
    read: true,
    starred: false,
    category: "social"
  },
  {
    id: 15,
    from: "professor@iitb.ac.in",
    fromName: "Prof. Ramesh Kumar",
    subject: "Research paper feedback – deadline extended to March 25",
    body: "Dear Priya,\n\nI've reviewed your submitted draft of \"Optimizing Transformer Architectures for Edge Devices.\"\n\nKey feedback:\n1. Abstract needs condensing (currently 350 words, target 250)\n2. Section 4.2 graph labels too small – please use 12pt minimum\n3. Comparison table in Section 5 is missing baseline metrics\n4. Add 2-3 more recent references (2024-2025)\n\nDeadline extended to March 25, 2026. Please submit revised version by March 22.\n\nBest,\nProf. Ramesh Kumar\nIIT Bombay",
    date: "2026-03-13T11:00:00",
    read: false,
    starred: true,
    category: "education"
  },
  {
    id: 16,
    from: "hr@inboxguard.ai",
    fromName: "HR – InboxGuard",
    subject: "Annual bonus disbursement – March 31, 2026",
    body: "Dear Priya,\n\nWe're happy to inform you that your annual performance bonus will be disbursed on March 31, 2026.\n\nBonus Details:\n• Amount: ₹1,20,000\n• Account: HDFC Bank ending ****3821\n• Reference: BONUS-2026-PRD-002\n\nThis reflects your outstanding contributions to the InboxGuard AI product over the past year.\n\nCongratulations!\n\nHR Team\nInboxGuard AI",
    date: "2026-03-12T11:00:00",
    read: false,
    starred: true,
    category: "payment"
  },
  {
    id: 17,
    from: "mom@family.com",
    fromName: "Mom",
    subject: "Diwali plans – can you come home this year? 🪔",
    body: "Hi Priya beta,\n\nJust checking in with you. It's been 3 months! Hope work is not too stressful.\n\nDiwali is coming next month and the whole family is planning to be home.\n\nCan you take a week off and come home? We'll make your favourite aamras and shrikhand 😊\n\nLots of love,\nMom",
    date: "2026-03-12T19:00:00",
    read: true,
    starred: true,
    category: "personal"
  },
  {
    id: 18,
    from: "noreply@hackerrank.com",
    fromName: "HackerRank",
    subject: "Your coding certificate – Data Structures & Algorithms",
    body: "Congratulations Priya! 🏆\n\nYou have earned a HackerRank Certificate in Data Structures & Algorithms.\n\n🎯 Score: 98/100\n📊 Ranking: Top 3% globally\n📜 Certificate ID: HR-DSA-2026-77842\n\nShare on LinkedIn!\n\nHackerRank Team",
    date: "2026-03-11T09:00:00",
    read: true,
    starred: false,
    category: "education"
  },
  {
    id: 19,
    from: "cto@inboxguard.ai",
    fromName: "Sanjay Rao (CTO)",
    subject: "Architecture review: scale InboxGuard to 1M users",
    body: "Hi Priya,\n\nI'd like to discuss our infrastructure roadmap to scale to 1 million users.\n\nKey areas to review:\n1. Database sharding strategy\n2. CDN and caching layer improvements\n3. Microservices vs monorepo trade-offs\n4. Real-time email processing pipeline\n5. Cost optimization on AWS\n\nPlease prepare your current system bottleneck analysis.\n\nSanjay Rao\nCTO, InboxGuard AI",
    date: "2026-03-13T16:00:00",
    read: false,
    starred: true,
    category: "work"
  },
  {
    id: 20,
    from: "support@razorpay.com",
    fromName: "Razorpay Support",
    subject: "Transaction failed – ₹2,499 payment to Adobe",
    body: "Hi Priya,\n\nA recent transaction on your Razorpay account has failed.\n\nTransaction Details:\n• Amount: ₹2,499.00\n• Merchant: Adobe Systems India\n• Date: March 14, 2026, 10:45 PM\n• Failure Reason: Insufficient funds\n• Reference ID: TXN-RPY-2026-88221\n\nPlease ensure sufficient balance and try again.\n\nRazorpay",
    date: "2026-03-14T22:45:00",
    read: false,
    starred: false,
    category: "payment"
  },
  {
    id: 21,
    from: "events@devfest.io",
    fromName: "DevFest India 2026",
    subject: "Confirmed! DevFest India – April 5, 2026 in Bengaluru",
    body: "🎉 Your registration is confirmed!\n\n📅 Date: Saturday, April 5, 2026\n🕒 Time: 9:00 AM – 6:00 PM\n📍 Venue: NIMHANS Convention Centre, Bengaluru\n🎤 Keynote: Sundar Pichai\n\nYour Ticket ID: DFI-2026-PR-00892\n\nSessions Include:\n• Building AI Agents with Gemini\n• Flutter for Production\n• Scaling to Millions with Firebase\n\nSee you there!\nDevFest Team",
    date: "2026-03-10T10:00:00",
    read: true,
    starred: true,
    category: "event"
  },
  {
    id: 22,
    from: "promo@amazon.in",
    fromName: "Amazon India",
    subject: "Exclusively for you: 20% cashback on your next purchase",
    body: "Hi Priya,\n\nAs a valued Prime member, we have an exclusive offer just for you!\n\n💰 Get 20% cashback (up to ₹500) on your next purchase.\n\nOffer valid on Electronics, Books, Kitchen Appliances.\nUse code: PRIME20 at checkout.\nValid until: March 20, 2026\n\nTerms and conditions apply. Unsubscribe",
    date: "2026-03-13T08:00:00",
    read: true,
    starred: false,
    category: "promo"
  },
  {
    id: 23,
    from: "team@slack.com",
    fromName: "Slack",
    subject: "You have 12 unread messages from your team",
    body: "Hey Priya! You have new messages waiting for you.\n\n💬 #general (5) – Vikram, Ananya, and 3 others sent messages\n💬 #engineering (4) – Discussion about the new API design pattern\n💬 #random (3) – Friday fun! Weekly meme drop 😄\n\nOpen Slack → app.slack.com",
    date: "2026-03-15T08:00:00",
    read: true,
    starred: false,
    category: "work"
  },
  {
    id: 24,
    from: "noreply@notion.so",
    fromName: "Notion",
    subject: "Priya, your workspace is 90% full",
    body: "Hi Priya,\n\nYour Notion workspace is almost full!\n\n📦 Storage Used: 4.5GB / 5GB (90%)\n\nTo avoid disruption, please upgrade your plan or delete unused files.\n\n🆙 Upgrade to Notion Plus\n• Unlimited storage\n• Unlimited blocks\n• Version history (90 days)\n\nUpgrade for ₹400/month → notion.so/upgrade\n\nNotion Team",
    date: "2026-03-10T14:00:00",
    read: true,
    starred: false,
    category: "service"
  },
  {
    id: 25,
    from: "noreply@zoom.us",
    fromName: "Zoom",
    subject: "Meeting recording ready: Product sync – March 14",
    body: "Hi Priya,\n\nThe recording for your Zoom meeting is now available.\n\n📅 Meeting: Product Sync – Q2 Roadmap Planning\n📆 Date: March 14, 2026\n⏱ Duration: 1 hr 12 min\n👥 Participants: 8\n\nWatch Recording → zoom.us/recording/share/9988abc\n(Link expires in 30 days)\n\nZoom Meetings",
    date: "2026-03-14T15:00:00",
    read: true,
    starred: false,
    category: "work"
  }
];
