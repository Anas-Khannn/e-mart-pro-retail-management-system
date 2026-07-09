// E-Mart Management System - Navigation & Session Guard

document.addEventListener('DOMContentLoaded', async () => {
  // Public pages do not render the app shell. Keep them passive so a failed
  // dashboard guard cannot bounce back into an automatic dashboard redirect.
  const path = window.location.pathname;
  const isLandingPage = path === '/' || path === '/index.html';
  const isPublicPage = isLandingPage || 
                       path.endsWith('login.html') || 
                       path.endsWith('signup.html') || 
                       path.endsWith('forgot-password.html');

  if (isPublicPage) {
    return;
  }

  // Otherwise, verify session first
  let user = null;
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    user = await response.json();
  } catch (error) {
    console.error('[Nav Guard] Session check failed:', error);
    if (!path.endsWith('/pages/login.html')) {
      window.location.replace('/pages/login.html');
    }
    return;
  }

  // Session valid! Load layouts and theme
  initTheme();
  renderSidebar(user);
  renderHeader(user);
});

// Initialize theme setting from localStorage or DB config
function initTheme() {
  const localTheme = localStorage.getItem('theme') || 'light';
  if (localTheme === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getUserAvatarHtml(user, className) {
  const name = user.full_name || 'User';
  const initial = name.charAt(0).toUpperCase();

  if (user.profile_image_url) {
    return `
      <div class="${className}">
        <img src="${escapeHtml(user.profile_image_url)}" alt="${escapeHtml(name)} profile picture">
      </div>
    `;
  }

  return `<div class="${className}">${escapeHtml(initial)}</div>`;
}

// Generate the sidebar dynamically based on user role
function renderSidebar(user) {
  const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
  if (!sidebarPlaceholder) return;

  const path = window.location.pathname;
  
  const menuItems = [
    { name: 'Dashboard', path: '/dashboard/index.html', icon: 'fa-chart-pie', roles: ['admin', 'shopkeeper'] },
    { name: 'POS Checkout', path: '/pages/pos.html', icon: 'fa-shopping-cart', roles: ['admin', 'shopkeeper'] },
    { name: 'Products Inventory', path: '/pages/products.html', icon: 'fa-boxes', roles: ['admin', 'shopkeeper'] },
    { name: 'CRM Customers', path: '/pages/customers.html', icon: 'fa-users', roles: ['admin', 'shopkeeper'] },
    { name: 'Visual Reports', path: '/pages/reports.html', icon: 'fa-chart-bar', roles: ['admin', 'shopkeeper'] },
    { name: 'Users Management', path: '/pages/users.html', icon: 'fa-user-cog', roles: ['admin'] },
    { name: 'Store Settings', path: '/pages/settings.html', icon: 'fa-cogs', roles: ['admin'] }
  ];

  // Restrict access to admin pages for shopkeepers
  const isAdminPage = path.endsWith('users.html') || path.endsWith('settings.html');
  if (isAdminPage && user.role !== 'admin') {
    alert('Access Denied: Admin privileges required.');
    window.location.href = '/dashboard/index.html';
    return;
  }

  const avatarHtml = getUserAvatarHtml(user, 'sidebar-user-avatar');

  let linksHtml = '';
  menuItems.forEach(item => {
    if (item.roles.includes(user.role)) {
      const isActive = path.endsWith(item.path.split('/').pop()) ? 'active' : '';
      linksHtml += `
        <li>
          <a href="${item.path}" class="sidebar-link ${isActive}">
            <i class="fas ${item.icon}"></i>
            <span>${item.name}</span>
          </a>
        </li>
      `;
    }
  });

  sidebarPlaceholder.className = 'sidebar';
  sidebarPlaceholder.innerHTML = `
    <div class="sidebar-brand">
      <i class="fas fa-store"></i>
      <span>E-Mart</span>
    </div>
    <ul class="sidebar-menu">
      ${linksHtml}
    </ul>
    <div class="sidebar-footer">
      ${avatarHtml}
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${escapeHtml(user.full_name)}</div>
        <div class="sidebar-user-role">${escapeHtml(user.role)}</div>
      </div>
      <a href="#" id="sidebar-logout-btn" title="Logout" style="color: var(--danger-color); font-size: 1.15rem;">
        <i class="fas fa-sign-out-alt"></i>
      </a>
    </div>
  `;

  // Bind logout listener
  document.getElementById('sidebar-logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to log out?')) {
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (response.ok) {
          localStorage.removeItem('user');
          window.location.href = '/pages/login.html';
        }
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
  });
}

// Generate topbar header
function renderHeader(user) {
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (!headerPlaceholder) return;

  const path = window.location.pathname;
  const displayName = user.full_name || 'User';
  const avatarHtml = getUserAvatarHtml(user, 'header-user-avatar');
  let pageTitle = 'E-Mart Management';
  if (path.endsWith('index.html')) pageTitle = 'Dashboard';
  if (path.endsWith('pos.html')) pageTitle = 'POS Checkout';
  if (path.endsWith('products.html')) pageTitle = 'Products Inventory';
  if (path.endsWith('customers.html')) pageTitle = 'CRM Customers';
  if (path.endsWith('reports.html')) pageTitle = 'Visual Reports';
  if (path.endsWith('settings.html')) pageTitle = 'Store Settings';
  if (path.endsWith('users.html')) pageTitle = 'Users Management';

  headerPlaceholder.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px;">
      <button class="menu-toggle" id="menu-toggle-btn">
        <i class="fas fa-bars"></i>
      </button>
      <div class="header-title">
        <h2>${pageTitle}</h2>
      </div>
    </div>
    <div class="header-actions">
      <button class="theme-toggle" id="theme-toggle-btn" title="Toggle Light/Dark Mode">
        <i class="fas fa-moon"></i>
      </button>
      <div class="user-profile">
        ${avatarHtml}
        <span style="font-size: 0.875rem; font-weight: 500; display: inline-block;">${escapeHtml(displayName.split(' ')[0])}</span>
      </div>
    </div>
  `;

  // Bind responsive sidebar toggle
  document.getElementById('menu-toggle-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    if (sidebar) sidebar.classList.toggle('show');
  });

  // Bind theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeBtn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  });

  // Adjust current icon based on theme
  const isDark = document.body.classList.contains('dark-theme');
  themeBtn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}
