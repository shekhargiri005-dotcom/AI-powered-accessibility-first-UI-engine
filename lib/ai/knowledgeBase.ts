export interface ComponentKnowledge {
  id: string;
  name: string;
  keywords: string[];
  guidelines: string;
  isAppTemplate?: boolean;
  isWebglTemplate?: boolean;
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
  // ─── 3D WebGL Templates ──────────────────────────────────────────────────
  {
    id: 'webgl-portfolio',
    name: '3D Interactive Portfolio',
    keywords: ['3d portfolio', 'webgl portfolio', 'interactive 3d resume', 'floating cubes', '3d showcase'],
    isWebglTemplate: true,
    guidelines: `WEBGL APP: A beautiful 3D portfolio. Scene: A dark, moody environment with an abstract central floating shape (e.g. rotating Icosahedron or group of floating cubes). Lighting: Ambient light, a colorful spotlight (e.g. purple/blue), and Environment maps. UI Overlay: Glassmorphic header nav, a hero section (Title: "Creative Developer", Subtitle, "View Work" button), and floating social icons, layered using Tailwind over the canvas. Animation: useFrame to slowly rotate the central mesh and make it float up and down.`
  },
  {
    id: 'webgl-landing',
    name: '3D SaaS Landing Page',
    keywords: ['3d landing page', 'webgl saas', '3d hero', '3d website background', 'site with moving component', 'three.js site'],
    isWebglTemplate: true,
    guidelines: `WEBGL APP: A modern SaaS product landing page with a 3D hero background. Scene: A bright, clean environment with floating geometric primitives (spheres, toruses, cones) acting as abstract product features. Uses ContactShadows for grounding. Lighting: Soft bright directional light + ambient. UI Overlay: Standard SaaS hero text ("Build Faster. Scale Further."), email signup input, and "Get Started" button over the left side of the screen. Animation: useFrame to slowly spin the geometry and hover them gently.`
  },
  {
    id: 'webgl-data-viz',
    name: '3D Data Visualization',
    keywords: ['3d data viz', '3d chart', '3d graph', 'webgl data visualization', '3d analytics'],
    isWebglTemplate: true,
    guidelines: `WEBGL APP: An interactive 3D data visualization dashboard. Scene: A 3D bar chart or scatter plot using instanced meshes or mapped groups of Box/Sphere geometries representing data points. Includes Text3D labels for axes. Controls: OrbitControls enabled for user to rotate and explore the data. UI Overlay: Sidebar with data filters, legend, and metric cards overlaid on the canvas. Lighting: Professional studio lighting setup.`
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

export function findWebglTemplate(prompt: string): string | null {
  const normalized = prompt.toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.isWebglTemplate && item.keywords.some(kw => normalized.includes(kw))) {
      return `WEBGL TEMPLATE [${item.name}]: ${item.guidelines}`;
    }
  }
  return null;
}
