// E-Mart Management System - Client API Utility

// Create the toast container on load if not exists
window.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
});

// Show notifications toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || document.body;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'danger') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  
  toast.innerHTML = `
    <i class="fas ${iconClass}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// API Request Wrappers
const API = {
  async handleResponse(response) {
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.message || `HTTP error! status: ${response.status}`;
      showToast(errorMsg, 'danger');
      throw new Error(errorMsg);
    }
    return data;
  },

  async get(url) {
    try {
      const response = await fetch(url);
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`[API GET] Failed fetching ${url}:`, error);
      throw error;
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`[API POST] Failed:`, error);
      throw error;
    }
  },

  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`[API PUT] Failed:`, error);
      throw error;
    }
  },

  async delete(url) {
    try {
      const response = await fetch(url, {
        method: 'DELETE'
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`[API DELETE] Failed:`, error);
      throw error;
    }
  },

  async upload(url, formData) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData // Note: Content-Type header must NOT be set manually, browser sets it with boundary
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`[API UPLOAD] Failed:`, error);
      throw error;
    }
  }
};

// Export to window
window.API = API;
window.showToast = showToast;
