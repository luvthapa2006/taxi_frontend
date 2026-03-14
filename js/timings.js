// ========================================
// TIMINGS.JS - Cab Schedules List Page Logic (WORKING VERSION)
// ========================================

let currentFilters = {};
let allSchedules = [];

// Initialize page
async function initTimingsPage() {
  console.log('🚀 Initializing Timings Page...');
  
  // Get filter params from URL
  const params = getQueryParams();
  currentFilters = {
    origin: params.origin || '',
    destination: params.destination || '',
    date: params.date || ''
  };
  
  console.log('📋 Current filters:', currentFilters);
  
  // Display filters info
  displayFilterInfo();
  
  // Setup filter controls if they exist
  setupFilterControls();
  
  // Load and display schedules
  await loadSchedules();
}

// Setup filter controls
function setupFilterControls() {
  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortSchedules(e.target.value);
    });
  }
}

// Display filter information
function displayFilterInfo() {
  const filterInfo = document.getElementById('filter-info');
  if (!filterInfo) return;
  
  if (currentFilters.origin && currentFilters.destination) {
    let infoText = `Showing cabs for ${currentFilters.origin} to ${currentFilters.destination}`;
    if (currentFilters.date) {
      infoText += ` on ${formatDate(currentFilters.date)}`;
    }
    filterInfo.innerHTML = `<h1 class="page-title" style="margin: 0; color: white;">${infoText}</h1>`;
  } else {
    filterInfo.innerHTML = `<h1 class="page-title" style="margin: 0; color: white;">All Available Cabs</h1>`;
  }
}

// Load schedules from API
async function loadSchedules() {
  const schedulesList = document.getElementById('schedules-list');
  
  if (!schedulesList) {
    console.error('❌ schedules-list element not found in DOM');
    return;
  }
  
  // Show loading state
  schedulesList.innerHTML = createLoadingSkeleton();
  
  try {
    console.log('🔄 Fetching schedules with filters:', currentFilters);
    
    // Fetch schedules from API
    allSchedules = await getSchedules(currentFilters);
    
    console.log('✅ Received schedules:', allSchedules.length);
    console.log('📊 Schedules data:', allSchedules);
    
    // Display schedules
    displaySchedules(allSchedules);
    
  } catch (error) {
    console.error('❌ Error loading schedules:', error);
    
    schedulesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Error Loading Cabes</h3>
        <p>${error.message || 'Failed to load cab schedules. Please check your connection.'}</p>
        <button onclick="loadSchedules()" class="btn btn-primary">
          🔄 Try Again
        </button>
      </div>
    `;
  }
}

// Create loading skeleton
function createLoadingSkeleton() {
  return `
    <div class="loading-container">
      <div class="schedule-card skeleton-card">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
      <div class="schedule-card skeleton-card">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
      <div class="schedule-card skeleton-card">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-button"></div>
      </div>
    </div>
  `;
}

// Display schedules
function displaySchedules(schedules) {
  const schedulesList = document.getElementById('schedules-list');
  if (!schedulesList) {
    console.error('❌ schedules-list element not found');
    return;
  }
  
  console.log('📊 Displaying schedules:', schedules.length);
  
  // Filter out: (1) cancelled dates, (2) cabs that have already departed
  const now = new Date();
  schedules = schedules.filter(s => {
    const dep = new Date(s.departureTime);
    const ds  = dep.toISOString().split('T')[0];
    const cancelled = s.cancelledDates || [];
    if (cancelled.includes(ds)) return false;
    // Remove cab from list if its departure time has already passed
    if (dep <= now) return false;
    return true;
  });

  // Deduplicate by cabName + departureTime + origin + destination
  // (prevents showing same cab multiple times when it was added with multi-date and
  //  also picked up by the recurring query, or when the same date was added more than once)
  const seen = new Set();
  schedules = schedules.filter(s => {
    const dep = new Date(s.departureTime);
    const key = `${s.cabName}|${s.origin}|${s.destination}|${dep.toISOString().slice(0,16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!schedules || schedules.length === 0) {
    schedulesList.innerHTML = createEmptyState();
    return;
  }
  
  // Group schedules by time of day
  const groupedSchedules = groupSchedulesByTimeOfDay(schedules);
  
  let html = '';
  
  // Morning cabs (6 AM - 12 PM)
  if (groupedSchedules.morning.length > 0) {
    html += createScheduleGroup('🌅', 'Morning Cabs (6 AM - 12 PM)', groupedSchedules.morning);
  }
  
  // Afternoon cabs (12 PM - 6 PM)
  if (groupedSchedules.afternoon.length > 0) {
    html += createScheduleGroup('☀️', 'Afternoon Cabs (12 PM - 6 PM)', groupedSchedules.afternoon);
  }
  
  // Evening cabs (6 PM - 12 AM)
  if (groupedSchedules.evening.length > 0) {
    html += createScheduleGroup('🌆', 'Evening Cabs (6 PM - 12 AM)', groupedSchedules.evening);
  }
  
  // Night cabs (12 AM - 6 AM)
  if (groupedSchedules.night.length > 0) {
    html += createScheduleGroup('🌙', 'Night Cabs (12 AM - 6 AM)', groupedSchedules.night);
  }
  
  schedulesList.innerHTML = html;
  
  console.log('✅ Schedules displayed successfully');
}

// Create schedule group
function createScheduleGroup(icon, title, schedules) {
  return `
    <div class="schedule-group" style="margin-bottom: 2rem;">
      <h3 class="schedule-group-title" style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb;">
        <span class="time-icon" style="font-size: 1.5rem;">${icon}</span>
        ${title}
      </h3>
      <div class="schedule-group-content" style="display: grid; gap: 1.5rem;">
        ${schedules.map(schedule => createScheduleCard(schedule)).join('')}
      </div>
    </div>
  `;
}

// Group schedules by time of day
function groupSchedulesByTimeOfDay(schedules) {
  const grouped = {
    morning: [],
    afternoon: [],
    evening: [],
    night: []
  };
  
  schedules.forEach(schedule => {
    const date = new Date(schedule.departureTime);
    const hour = date.getHours();
    
    if (hour >= 6 && hour < 12) {
      grouped.morning.push(schedule);
    } else if (hour >= 12 && hour < 18) {
      grouped.afternoon.push(schedule);
    } else if (hour >= 18 && hour < 24) {
      grouped.evening.push(schedule);
    } else {
      grouped.night.push(schedule);
    }
  });
  
  console.log('📊 Grouped schedules:', {
    morning: grouped.morning.length,
    afternoon: grouped.afternoon.length,
    evening: grouped.evening.length,
    night: grouped.night.length
  });
  
  return grouped;
}

// Create empty state
function createEmptyState() {
  return `
    <div class="empty-state" style="text-align: center; padding: 4rem 2rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div class="empty-icon" style="font-size: 4rem; margin-bottom: 1rem;">🚖</div>
      <h3 style="font-size: 1.5rem; font-weight: 600; color: #1f2937; margin-bottom: 0.5rem;">No Cabs Found</h3>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">We couldn't find any cabs matching your search criteria.</p>
      <div class="empty-state-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button onclick="clearFilters()" class="btn btn-primary">
          Clear Filters
        </button>
        <button onclick="navigateTo('index.html')" class="btn btn-outline">
          Back to Search
        </button>
      </div>
    </div>
  `;
}

// Create schedule card HTML with inline styles for guaranteed display
function createScheduleCard(schedule) {
  const totalSeats = (schedule.type === "SUV (6+1)") ? 6 : 4;
  const availableSeats = totalSeats - (schedule.bookedSeats?.length || 0);
  const duration = calculateDuration(schedule.departureTime, schedule.arrivalTime);
  const departureDate = new Date(schedule.departureTime);
  const isToday = isDateToday(departureDate);
  const nextDay = new Date(schedule.arrivalTime).toDateString() !== new Date(schedule.departureTime).toDateString();

  return `
    <div class="schedule-card" data-schedule-id="${schedule.id}">
      <div class="card-accent"></div>

      <div class="schedule-info">
        <!-- Cab name + badges -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;">
          <div>
            <h3 style="font-size:1.15rem;font-weight:700;color:#1e293b;margin:0 0 0.2rem;">${schedule.cabName}</h3>
            <span style="font-size:0.8rem;color:#92400e;background:#fef3c7;border:1px solid #fcd34d;padding:0.15rem 0.5rem;border-radius:4px;">${schedule.type}</span>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            ${isToday ? '<span style="background:#dcfce7;color:#15803d;font-size:0.72rem;font-weight:700;padding:0.25rem 0.6rem;border-radius:99px;border:1px solid #bbf7d0;">Today</span>' : ''}
            ${availableSeats <= 5 && availableSeats > 0 ? '<span style="background:#fef3c7;color:#92400e;font-size:0.72rem;font-weight:700;padding:0.25rem 0.6rem;border-radius:99px;border:1px solid #fcd34d;">Almost Full</span>' : ''}
          </div>
        </div>

        <!-- Route timeline -->
        <div style="display:flex;align-items:center;gap:1rem;margin:1rem 0;">
          <!-- Departure -->
          <div style="text-align:left;min-width:80px;">
            <div style="font-size:1.3rem;font-weight:800;color:#1e293b;">${formatTime(schedule.departureTime)}</div>
            <div style="font-size:0.82rem;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">${schedule.origin}</div>
            <div style="font-size:0.72rem;color:#9ca3af;">${formatDate(schedule.departureTime)}</div>
          </div>

          <!-- Connector -->
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.35rem;">
            <div style="width:100%;height:2px;background:linear-gradient(to right,#f59e0b,#d97706);border-radius:2px;"></div>
            <div style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:#6b7280;background:#f3f4f6;padding:0.2rem 0.6rem;border-radius:99px;white-space:nowrap;">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${duration}
            </div>
          </div>

          <!-- Arrival -->
          <div style="text-align:right;min-width:80px;">
            <div style="font-size:1.3rem;font-weight:800;color:#1e293b;">${formatTime(schedule.arrivalTime)}</div>
            <div style="font-size:0.82rem;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">${schedule.destination}</div>
            ${nextDay
              ? `<div style="font-size:0.72rem;color:#f59e0b;font-weight:600;">+1 Day · ${formatDate(schedule.arrivalTime)}</div>`
              : `<div style="font-size:0.72rem;color:#9ca3af;">${formatDate(schedule.arrivalTime)}</div>`
            }
          </div>
        </div>

        <!-- Amenities -->
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
          ${['❄️ AC','🎵 Music','🔌 Charging'].map(a => `<span style="padding:0.2rem 0.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:0.72rem;color:#6b7280;">${a}</span>`).join('')}
          
        </div>

        <!-- Pick Up / Drop points -->
        ${(schedule.pickupPoint || schedule.dropPoint) ? `
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:0.75rem;padding-top:0.75rem;border-top:1px dashed #e5e7eb;">
          ${schedule.pickupPoint ? `<div style="font-size:0.75rem;color:#475569;display:flex;align-items:flex-start;gap:0.3rem;"><span style="color:#10b981;">📍</span><div><span style="font-weight:600;color:#374151;">Pick Up:</span> ${schedule.pickupPoint}</div></div>` : ''}
          ${schedule.dropPoint   ? `<div style="font-size:0.75rem;color:#475569;display:flex;align-items:flex-start;gap:0.3rem;"><span style="color:#ef4444;">📍</span><div><span style="font-weight:600;color:#374151;">Drop:</span> ${schedule.dropPoint}</div></div>` : ''}
        </div>` : ''}
      </div>

      <!-- CTA panel -->
      <div class="schedule-cta">
        <div style="text-align:center;">
          <span style="font-size:0.72rem;color:#6b7280;display:block;margin-bottom:0.2rem;">Starting from</span>
          <div style="font-size:1.7rem;font-weight:800;color:#f59e0b;">${formatCurrency(schedule.price)}</div>
          <span style="font-size:0.72rem;color:#9ca3af;">per seat</span>
        </div>

        <button
          onclick="selectCab('${schedule.id}')"
          style="width:100%;padding:0.75rem 1.25rem;border-radius:8px;border:none;font-size:0.9rem;font-weight:600;cursor:pointer;transition:all 0.2s;
            ${availableSeats === 0
              ? 'background:#f3f4f6;color:#9ca3af;cursor:not-allowed;'
              : 'background:linear-gradient(135deg,#f59e0b,#d97706);color:white;'}"
          ${availableSeats === 0 ? 'disabled' : ''}
        >
          ${availableSeats > 0 ? 'Select Seat →' : 'Fully Booked'}
        </button>

        <div style="font-size:0.78rem;font-weight:600;display:flex;align-items:center;gap:0.3rem;color:${availableSeats === 0 ? '#ef4444' : availableSeats <= 5 ? '#f59e0b' : '#10b981'};">
          ${availableSeats > 0 ? `💺 ${availableSeats} seat${availableSeats > 1 ? 's' : ''} left` : '❌ No seats available'}
        </div>
      </div>
    </div>
  `;
}


// Helper: is this departure on today's date?
function isDateToday(date) {
  const today = new Date();
  return date.getDate()      === today.getDate()  &&
         date.getMonth()     === today.getMonth() &&
         date.getFullYear()  === today.getFullYear();
}

// Select cab and navigate to seats page
function selectCab(scheduleId) {
  console.log('🎫 Selecting cab:', scheduleId);
  
  if (!scheduleId) {
    showToast('Invalid cab selection', 'error');
    return;
  }
  
  // Store selected schedule in session storage for quick access
  const schedule = allSchedules.find(s => s.id === scheduleId);
  if (schedule) {
    sessionStorage.setItem('selectedSchedule', JSON.stringify(schedule));
  }
  
  navigateTo('seats.html', { id: scheduleId });
}

// Clear filters
function clearFilters() {
  currentFilters = {};
  navigateTo('timings.html');
}

// Sort schedules
function sortSchedules(sortBy) {
  console.log('🔄 Sorting by:', sortBy);
  
  if (!allSchedules || allSchedules.length === 0) {
    return;
  }
  
  let sortedSchedules = [...allSchedules];
  
  switch(sortBy) {
    case 'price-low':
      sortedSchedules.sort((a, b) => a.price - b.price);
      showToast('Sorted by: Price (Low to High)', 'info');
      break;
      
    case 'price-high':
      sortedSchedules.sort((a, b) => b.price - a.price);
      showToast('Sorted by: Price (High to Low)', 'info');
      break;
      
    case 'departure':
      sortedSchedules.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
      showToast('Sorted by: Departure Time', 'info');
      break;
      
    case 'duration':
      sortedSchedules.sort((a, b) => {
        const durationA = new Date(a.arrivalTime) - new Date(a.departureTime);
        const durationB = new Date(b.arrivalTime) - new Date(b.departureTime);
        return durationA - durationB;
      });
      showToast('Sorted by: Journey Duration', 'info');
      break;
      
    case 'seats':
      sortedSchedules.sort((a, b) => {
        const seatsA = ((a.type === "SUV (6+1)") ? 6 : 4) - (a.bookedSeats?.length || 0);
        const seatsB = ((b.type === "SUV (6+1)") ? 6 : 4) - (b.bookedSeats?.length || 0);
        return seatsB - seatsA;
      });
      showToast('Sorted by: Available Seats', 'info');
      break;
      
    default:
      return;
  }
  
  allSchedules = sortedSchedules;
  displaySchedules(allSchedules);
}

// Filter schedules by cab type
function filterByCabType(type) {
  console.log('🔍 Filtering by cab type:', type);
  
  if (type === 'all') {
    loadSchedules();
    return;
  }
  
  const filtered = allSchedules.filter(schedule => 
    schedule.type.toLowerCase().includes(type.toLowerCase())
  );
  
  displaySchedules(filtered);
  showToast(`Showing ${filtered.length} ${type} cabs`, 'info');
}

// Refresh schedules
async function refreshSchedules() {
  showToast('Refreshing cab schedules...', 'info');
  await loadSchedules();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimingsPage);
} else {
  initTimingsPage();
}

// Debug function - call this from console if needed
window.debugTimings = function() {
  console.log('🔍 Debug Info:');
  console.log('Current Filters:', currentFilters);
  console.log('All Schedules:', allSchedules);
  console.log('Schedules List Element:', document.getElementById('schedules-list'));
  console.log('Filter Info Element:', document.getElementById('filter-info'));
};

console.log('✅ Timings.js loaded - Use window.debugTimings() for debugging');