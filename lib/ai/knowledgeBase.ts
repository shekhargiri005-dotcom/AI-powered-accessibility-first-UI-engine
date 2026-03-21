export interface ComponentKnowledge {
  id: string;
  name: string;
  keywords: string[];
  guidelines: string;
}

export const KNOWLEDGE_BASE: ComponentKnowledge[] = [
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
  }
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
