// ========================================
// MAIN.JS - Common Utilities & Navigation
// ========================================

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' };
  return date.toLocaleDateString('en-IN', options);
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hours = Math.floor((end - start) / (1000 * 60 * 60));
  const minutes = Math.floor(((end - start) % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;
}

function formatCurrency(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹—';
  return `₹${num.toLocaleString('en-IN')}`;
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  const container = document.getElementById('toast-container') || createToastContainer();
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Navigation Helpers
function navigateTo(page, params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${page}?${queryString}` : page;
  window.location.href = url;
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

function goBack() {
  window.history.back();
}

// Navbar Active State
function updateNavbarActive() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Initialize navbar on page load
document.addEventListener('DOMContentLoaded', () => {
  updateNavbarActive();
  
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('show');
    });
  }
});

// Form Validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  const re = /^[6-9]\d{9}$/;
  return re.test(phone.replace(/\s+/g, ''));
}

function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;
  
  const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      isValid = false;
      input.classList.add('error');
    } else {
      input.classList.remove('error');
    }
    
    // Special validation for email
    if (input.type === 'email' && input.value && !validateEmail(input.value)) {
      isValid = false;
      input.classList.add('error');
      showToast('Please enter a valid email address', 'error');
    }
    
    // Special validation for phone
    if (input.type === 'tel' && input.value && !validatePhone(input.value)) {
      isValid = false;
      input.classList.add('error');
      showToast('Please enter a valid 10-digit phone number', 'error');
    }
  });
  
  if (!isValid) {
    showToast('Please fill all required fields', 'error');
  }
  
  return isValid;
}

// Loading Spinner
function showLoading() {
  const loader = document.getElementById('loading-spinner') || createLoadingSpinner();
  loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.getElementById('loading-spinner');
  if (loader) {
    loader.style.display = 'none';
  }
}

function createLoadingSpinner() {
  const loader = document.createElement('div');
  loader.id = 'loading-spinner';
  loader.className = 'loading-spinner';
  loader.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(loader);
  return loader;
}

// Modal Helpers
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Close modal on outside click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
    document.body.style.overflow = '';
  }
});

// Search  & Filter Helpers
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Smooth Scroll
function smoothScrollTo(element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Local Storage Helpers
function setLocalData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    return false;
  }
}

function getLocalData(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
}

function removeLocalData(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Error removing from localStorage:', e);
    return false;
  }
}

// Animation Helpers (Intersection Observer for scroll animations)
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

// Initialize scroll animations on load
document.addEventListener('DOMContentLoaded', initScrollAnimations);

// Print Helpers
function printElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Print</title>');
  printWindow.document.write('<link rel="stylesheet" href="css/tailwind.css">');
  printWindow.document.write('<style>body { padding: 20px; } @media print { .no-print { display: none; } }</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(element.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Copy to Clipboard
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy', 'error');
    });
  } else {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
  }
}

// Share API (if supported)
function shareBooking(booking) {
  const shareData = {
    title: 'Shree Ram Travels - Booking Confirmation',
    text: `Booking confirmed! Token: ${booking.bookingToken}\nSeats: ${booking.seatNumbers.join(', ')}\nAmount: ₹${booking.totalAmount}`,
    url: window.location.origin
  };
  
  if (navigator.share) {
    navigator.share(shareData).catch(err => console.log('Error sharing:', err));
  } else {
    copyToClipboard(`Booking Token: ${booking.bookingToken}\nSeats: ${booking.seatNumbers.join(', ')}\nAmount: ₹${booking.totalAmount}`);
  }
}

// Download as PDF (simplified - using print)
function downloadTicket(booking) {
  // Store booking data temporarily
  sessionStorage.setItem('currentTicket', JSON.stringify(booking));
  window.print();
}

// Error Handler
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  // Optionally show user-friendly error
  // showToast('An error occurred. Please try again.', 'error');
});

// Initialize app
function initApp() {
  console.log('Shree Ram Travels - App Initialized');
  // Any global initialization
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}