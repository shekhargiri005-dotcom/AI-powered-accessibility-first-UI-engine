export interface ComponentKnowledge {
  id: string;
  name: string;
  keywords: string[];
  guidelines: string;
  isAppTemplate?: boolean;
  isDepthUITemplate?: boolean;
}

export const KNOWLEDGE_BASE: ComponentKnowledge[] = [
  // ─── Single Component Templates ───────────────────────────────────────────
  {
    id: 'login',
    name: 'Login Page',
    keywords: ['login', 'sign in', 'authenticate'],
    guidelines: 'Build a production-ready login page with email/password fields, validation, submit button with loading state, and error handling. UI: Centered card layout, minimal design, subtle depth shadow, simple SVG icon (lock/user).'
  },
  {
    id: 'signup',
    name: 'Signup Page',
    keywords: ['signup', 'register', 'create account'],
    guidelines: 'Create a signup form with Name, email, password, confirm password. Needs validation, inline error messages, and disabled submit state. UI: Clean form layout, consistent spacing, minimal design with subtle depth.'
  },
  {
    id: 'dashboard',
    name: 'Dashboard Layout',
    keywords: ['dashboard', 'admin panel', 'overview'],
    guidelines: 'Build a dashboard layout with Sidebar navigation, Top header with user info, Main content area with summary cards. UI: Clean grid layout, consistent spacing, soft shadows and layered cards.'
  },
  {
    id: 'product-card',
    name: 'Product Card',
    keywords: ['product card', 'item card', 'merchandise'],
    guidelines: 'Create a reusable product card with Image, title, price, and Add to cart button. UI: Card-based layout, subtle shadow and hover effect, clean typography and spacing.'
  },
  {
    id: 'profile-settings',
    name: 'Profile Settings',
    keywords: ['profile', 'settings', 'account settings', 'user profile'],
    guidelines: 'Build a profile settings page with Name, bio, avatar upload, and Save button with validation. UI: Clean form layout, avatar preview, simple and minimal styling.'
  },
  {
    id: 'data-table',
    name: 'Data Table',
    keywords: ['data table', 'grid', 'datagrid', 'list of data'],
    guidelines: 'Create a data table with Sortable columns, Pagination, and Empty state. UI: Clean table layout, clear spacing, subtle borders and hover states.'
  },
  {
    id: 'pricing',
    name: 'Pricing Cards',
    keywords: ['pricing', 'subscription', 'plans'],
    guidelines: 'Build pricing cards with Plan name, price, feature list, and Subscription button. UI: Highlight recommended plan, clean card layout, subtle depth and spacing.'
  },
  {
    id: 'modal',
    name: 'Modal Dialog',
    keywords: ['modal', 'dialog', 'popup', 'alert'],
    guidelines: 'Create a modal dialog with Title, description, Confirm and cancel buttons. UI: Centered modal, overlay background, smooth open/close feel.'
  },
  {
    id: 'sidebar',
    name: 'Sidebar Navigation',
    keywords: ['sidebar', 'side nav', 'drawer'],
    guidelines: 'Build a sidebar with Navigation links, Active state, Icons. UI: Clean vertical layout, collapsible option.'
  },
  {
    id: 'search-filter',
    name: 'Search + Filter',
    keywords: ['search', 'filter', 'search bar'],
    guidelines: 'Create a search interface with Search input, Filter dropdown, Results list. UI: Clean layout, clear spacing, simple interactions.'
  },
  {
    id: 'cart',
    name: 'Cart Page',
    keywords: ['cart', 'shopping cart', 'checkout'],
    guidelines: 'Build a shopping cart page with List of items, Quantity controls, Total price and checkout button. UI: Clean list layout, clear hierarchy.'
  },
  {
    id: 'analytics-cards',
    name: 'Analytics Cards',
    keywords: ['analytics', 'metrics', 'stats', 'kpi'],
    guidelines: 'Create analytics cards with Metric title, Value, Trend indicator. UI: Card layout, subtle shadow, clear typography.'
  },
  {
    id: 'notification-panel',
    name: 'Notification Panel',
    keywords: ['notifications', 'alerts', 'inbox'],
    guidelines: 'Build a notification panel with List of notifications, Read/unread state. UI: Clean list design, subtle separators.'
  },
  {
    id: 'calendar',
    name: 'Calendar Component',
    keywords: ['calendar', 'date picker', 'schedule'],
    guidelines: 'Create a calendar UI with Monthly view, Date selection. UI: Clean grid layout, simple interactions.'
  },
  {
    id: 'file-upload',
    name: 'File Upload',
    keywords: ['upload', 'file drop', 'file upload'],
    guidelines: 'Build a file upload component with Drag and drop, File preview. UI: Minimal drop area, clear feedback states.'
  },
  {
    id: 'loading-skeleton',
    name: 'Loading Skeleton',
    keywords: ['skeleton', 'loading', 'placeholder'],
    guidelines: 'Create loading skeletons for Cards, Text blocks. UI: Smooth placeholders, minimal animation.'
  },
  {
    id: 'invoice',
    name: 'Invoice UI',
    keywords: ['invoice', 'receipt', 'bill'],
    guidelines: 'Build an invoice layout with Items list, Total cost. UI: Clean table style, clear alignment.'
  },
  {
    id: 'team-list',
    name: 'Team Members List',
    keywords: ['team', 'members', 'users list'],
    guidelines: 'Create a team list with Avatar, Name, Role. UI: Clean list layout, consistent spacing.'
  },
  {
    id: 'empty-state',
    name: 'Empty State',
    keywords: ['empty state', 'no data', 'no results'],
    guidelines: 'Create an empty state UI with Message, Action button. UI: Minimal design, optional SVG illustration.'
  },
  {
    id: 'password-reset',
    name: 'Password Reset',
    keywords: ['password reset', 'forgot password', 'recover'],
    guidelines: 'Build a password reset form with Email input, Submit button. UI: Simple form layout, clean spacing.'
  },
  {
    id: 'form-builder',
    name: 'Form Builder UI',
    keywords: ['form builder', 'dynamic form', 'fields'],
    guidelines: 'Create a dynamic form layout with Multiple input types. UI: Structured spacing, clean alignment.'
  },
  {
    id: 'chart-section',
    name: 'Chart Section',
    keywords: ['chart', 'graph', 'plot'],
    guidelines: 'Build a chart container UI with Title, Placeholder for graph. UI: Card layout, clean spacing.'
  },
  {
    id: 'activity-feed',
    name: 'Activity Feed',
    keywords: ['activity feed', 'timeline', 'recent activity'],
    guidelines: 'Create an activity feed with Timeline items, User actions. UI: Vertical layout, clear hierarchy.'
  },
  {
    id: 'hero',
    name: 'Hero Section',
    keywords: ['hero', 'landing page', 'banner'],
    guidelines: 'Build a landing hero section with Heading, Subtext, CTA button. UI: Centered layout, clean typography.'
  },
  {
    id: 'mobile-nav',
    name: 'Mobile Navigation',
    keywords: ['mobile nav', 'hamburger menu', 'drawer menu'],
    guidelines: 'Create a mobile navigation menu with Toggle button, Navigation links. UI: Simple overlay, smooth interaction.'
  },
  {
    id: 'button-system',
    name: 'Button System',
    keywords: ['button system', 'button group', 'buttons'],
    guidelines: 'Build a reusable button system with Variants (primary, secondary), Disabled and loading states. UI: Consistent styling, clean spacing.'
  },

  // ─── Full App Templates ────────────────────────────────────────────────────
  {
    id: 'app-instagram',
    name: 'Instagram App',
    keywords: ['instagram', 'instagram-like', 'instagram clone', 'social media app', 'photo sharing app', 'reels app'],
    isAppTemplate: true,
    guidelines: `FULL APP: Instagram-like social media. Screens: Feed (stories row + photo posts with likes/comments/share), Explore (grid of photos with search), Reels (vertical video feed with likes/comments overlay), Notifications (likes/follows/comments list), Profile (avatar, bio, post grid, followers/following counts). Nav: bottom bar with Home/Explore/Reels/Notifications/Profile SVG icons. Colors: background=#000000, surface=#111111, primary=#E1306C, text=#FFFFFF. Mock data: 8 posts with emoji avatars, usernames, captions, like counts 100-50000, comment counts. Stories: 8 story bubbles with gradient ring. Reels: 5 vertical cards with video placeholder, like/comment/share overlays. Profile: grid of 9 post thumbnails.`
  },
  {
    id: 'app-twitter',
    name: 'Twitter / X App',
    keywords: ['twitter', 'x app', 'twitter clone', 'twitter-like', 'tweet', 'microblogging'],
    isAppTemplate: true,
    guidelines: `FULL APP: Twitter/X-like microblogging. Screens: Home (tweet feed with likes/retweets/replies), Explore (trending topics + search bar), Notifications (mentions/likes/follows), Messages (DM list + chat view), Profile (bio, tweet count, followers, pinned tweet, tweet grid). Nav: sidebar on left with icons for Home/Explore/Notifications/Messages/Profile + blue Tweet button. Colors: background=#000000, surface=#16181C, primary=#1D9BF0, text=#E7E9EA. Mock data: 10 tweets with @usernames, timestamps, like/retweet/reply counts, verified badges. Trending: 8 hashtags with tweet counts.`
  },
  {
    id: 'app-spotify',
    name: 'Spotify App',
    keywords: ['spotify', 'spotify clone', 'spotify-like', 'music streaming', 'music app', 'music player'],
    isAppTemplate: true,
    guidelines: `FULL APP: Spotify-like music streaming. Screens: Home (featured playlists, recently played, recommended), Search (category grid with colorful cards), Library (playlists + albums list), Now Playing (large album art, progress bar, controls, lyrics). Nav: bottom bar with Home/Search/Library/Profile. Colors: background=#121212, surface=#1E1E1E, primary=#1DB954, text=#FFFFFF. Mock data: 8 playlists with emoji covers, 6 artists, 10 songs with duration. Now Playing: animated progress bar, shuffle/repeat/heart controls. Search categories: colorful gradient cards (Pop, Hip-Hop, Rock, Chill, Party, Workout, Focus, Podcasts).`
  },
  {
    id: 'app-slack',
    name: 'Slack App',
    keywords: ['slack', 'slack clone', 'slack-like', 'team chat', 'messaging app', 'team communication'],
    isAppTemplate: true,
    guidelines: `FULL APP: Slack-like team messaging. Screens: Messages (active channel messages with replies/reactions), Channels (list of all channels with unread counts), DMs (direct message threads), Mentions (messages that mention the user), Profile. Nav: sidebar with workspace icon, channel list, DM list. Colors: background=#1A1D21, surface=#222529, primary=#4A154B, accent=#ECB22E, text=#D1D2D3. Mock data: 6 channels (#general #random #engineering #design #announcements #random), 8 messages per channel with emoji reactions, 5 DM threads. Message composer with emoji/attachment buttons.`
  },
  {
    id: 'app-airbnb',
    name: 'Airbnb App',
    keywords: ['airbnb', 'airbnb clone', 'airbnb-like', 'rental app', 'booking app', 'stay booking'],
    isAppTemplate: true,
    guidelines: `FULL APP: Airbnb-like rental booking. Screens: Explore (search bar + category pills + listing grid), Map (placeholder map + floating listing cards), Listing Detail (photos, title, host, price, amenities, booking CTA), Wishlists (saved listings grid), Profile (trips, reviews, settings). Nav: bottom bar with Explore/Wishlists/Trips/Messages/Profile. Colors: background=#FFFFFF, surface=#F7F7F7, primary=#FF385C, text=#222222. Mock data: 10 listings with emoji location, price/night, star rating, review count, superhost badge. Categories: Icons row for Beach/Mountains/Countryside/Cities/Farms/Castles/Arctic.`
  },
  {
    id: 'app-github',
    name: 'GitHub App',
    keywords: ['github', 'github clone', 'github-like', 'code repository', 'developer app', 'git app'],
    isAppTemplate: true,
    guidelines: `FULL APP: GitHub-like code hosting. Screens: Feed (activity timeline, PRs/issues from followed users), Explore (trending repos by language), Repositories (list of user repos with stars/forks), Issues (open issues with labels/assignees), Profile (contributions graph placeholder, bio, pinned repos). Nav: sidebar with Feed/Explore/Repos/Issues/PRs/Profile. Colors: background=#0D1117, surface=#161B22, primary=#238636, accent=#58A6FF, text=#C9D1D9. Mock data: 8 repos with star/fork/language counts, 6 trending repos, 10 issues with colorful label badges (bug/enhancement/help-wanted).`
  },
  {
    id: 'app-trello',
    name: 'Trello App',
    keywords: ['trello', 'trello clone', 'trello-like', 'kanban', 'kanban board', 'project management app', 'task board'],
    isAppTemplate: true,
    guidelines: `FULL APP: Trello-like kanban board. Screens: Board (3-4 columns: To Do/In Progress/Review/Done with draggable card stubs), Boards List (all workspace boards with colored headers), Calendar (simple month grid with task dots), Profile. Nav: sidebar with Boards/Templates/Calendar/Profile + workspace switcher. Colors: background=#1D2125, surface=#22272B, primary=#579DFF, text=#B6C2CF. Mock data: 4 columns with 4-5 cards each. Cards have: title, colored label badges, due date, assignee emoji avatar, checklist progress. Board list: 6 boards with gradient header colors.`
  },
  {
    id: 'app-ecommerce',
    name: 'E-Commerce App',
    keywords: ['ecommerce', 'e-commerce', 'shop', 'online store', 'shopping app', 'store app', 'marketplace app'],
    isAppTemplate: true,
    guidelines: `FULL APP: Premium e-commerce shopping. Screens: Home (hero banner + category pills + featured products grid + flash sale countdown), Products (filterable grid with sort options), Product Detail (image carousel placeholder, price, size selector, add to cart), Cart (item list with quantity controls, total, checkout CTA), Profile (orders, wishlist, addresses). Nav: bottom bar with Home/Search/Cart(badge)/Wishlist/Profile. Colors: background=#FFFFFF, surface=#F8F9FA, primary=#6366F1, text=#1F2937. Mock data: 12 products with emoji images, names, prices, star ratings, sale badges. Cart: 3 items with quantity steppers. Flash sale: countdown timer component.`
  },
  // ─── Depth UI Templates ──────────────────────────────────────────────────
  {
    id: 'depth-startup',
    name: 'Depth UI Startup Hero',
    keywords: ['startup hero', 'depth ui', 'premium hero', 'floating cards', 'layered hero'],
    isDepthUITemplate: true,
    guidelines: `DEPTH UI: A beautiful premium startup landing page hero. Features soft parallax, glowing blurred floating background shapes, and floating cards. Use Tailwind CSS with arbitrary values for transforms and standard Framer Motion for scroll/hover interactions. Avoid 3D WebGL. Structure: 1) Hero with headline + sub-headline + CTA button, 2) Soft glowing orbs behind the text using absolute divs with blur and opacity, 3) Floating UI screenshot cards at depth offset transforms. Motion: use framer motion "useScroll" + "useTransform" to make the orbs move slower than the scroll (parallax factor 0.3). All animated elements must have a "prefers-reduced-motion" static fallback.`
  },
  {
    id: 'depth-feature',
    name: 'Depth UI Feature Reveal',
    keywords: ['feature reveal', 'depth ui feature', 'scroll section', 'layered feature'],
    isDepthUITemplate: true,
    guidelines: `DEPTH UI: A feature reveal section heavily leveraging soft parallax depth. As the user scrolls, feature text floats up cleanly while background dashboard screenshots or illustrative cards subtly scale and move on a Z-axis simulation. Use Framer Motion useScroll and useTransform. Avoid Three.js. Each feature block: left text + right "floating UI card" image with a translateY driven by scroll offset. Background: gradient radial glow that persists across sections. Entry animations: "initial={{ opacity: 0, y: 40 }}", "whileInView={{ opacity: 1, y: 0 }}", "viewport={{ once: true }}".`
  },
  {
    id: 'depth-parallax-marketing',
    name: 'Depth UI Full-Page Parallax Marketing Site',
    keywords: ['parallax marketing', 'depth landing', 'cinematic parallax', 'full page depth', 'scroll depth'],
    isDepthUITemplate: true,
    guidelines: `DEPTH UI: A full-page cinematic marketing site with heavy scroll-linked parallax. Sections: Hero, Feature Showcase, Social Proof, Pricing, CTA Footer. Motion architecture: a root useScroll hook tracks the total page scroll. Each section uses useTransform to interpolate translateY, opacity, and scale from scroll progress ranges (e.g. [0.0, 0.25] for hero, [0.2, 0.45] for features). Background atmospheric layer: large slow-moving gradient blobs (motion.div with useTransform, factor 0.1). Foreground elements move faster (factor 0.6). Typography animates in with staggered children (variants with staggerDelay 0.1). Accessibility: entire motion system controlled by a single CSS media query "prefers-reduced-motion: reduce" that sets all transitions to "none".`
  },
  {
    id: 'depth-scroll-storytelling',
    name: 'Depth UI Scroll Storytelling',
    keywords: ['scroll storytelling', 'cinematic scroll', 'story scroll', 'narrative scroll', 'immersive scroll'],
    isDepthUITemplate: true,
    guidelines: `DEPTH UI: A scroll-driven narrative / storytelling presentation. Multiple full-viewport "chapters" stacked vertically. Each chapter fades in as it enters the viewport and fades out as it leaves. Use Framer Motion useInView for entry and exit. Sticky progress indicator: a fixed left-side dot navigation showing the active chapter. Chapter structure: big full-screen background gradient layer (slow-moving parallax), centred text content (faster), floating decorative elements (variable parallax). Each chapter has a theme: chapter 1 = deep navy, chapter 2 = warm amber, chapter 3 = emerald. All transitions are cross-fading, no jarring cuts.`
  },
  {
    id: 'depth-floating-dashboard',
    name: 'Depth UI Floating Dashboard',
    keywords: ['floating dashboard', 'depth dashboard', 'glass dashboard', 'premium dashboard'],
    isDepthUITemplate: true,
    guidelines: `DEPTH UI: A premium dashboard with glassmorphism cards floating over atmospheric depth backgrounds. Layout: sidebar navigation + main content grid. Background: radial gradient with additional blurred blob shapes (purple/indigo) that subtly drift using CSS keyframes (very slow, 20s loop). Cards: glass effect (backdrop-filter blur, semi-transparent white border, subtle box-shadow). Card entrance: staggered framer-motion "whileInView" reveal. Stats cards: animated counter using framer-motion "useAnimate". Charts: clean SVG line/bar charts. No external chart libraries. Accessibility: all dashboard data exposed as accessible table in sr-only div for screen readers.`
  },
];

export function findRelevantKnowledge(prompt: string): string | null {
  const normalized = prompt.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.keywords.some(kw => normalized.includes(kw))) {
      return `KNOWLEDGE BASE MATCH [${item.name}]: ${item.guidelines}`;
    }
  }
  return null;
}

export function findAppTemplate(prompt: string): string | null {
  const normalized = prompt.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.isAppTemplate && item.keywords.some(kw => normalized.includes(kw))) {
      return `APP TEMPLATE [${item.name}]: ${item.guidelines}`;
    }
  }
  return null;
}

export function findDepthUITemplate(prompt: string): string | null {
  const normalized = prompt.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.isDepthUITemplate && item.keywords.some(kw => normalized.includes(kw))) {
      return `DEPTH UI TEMPLATE [${item.name}]: ${item.guidelines}`;
    }
  }
  return null;
}
