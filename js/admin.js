// ========================================
// ADMIN.JS - Admin Panel Logic
// ========================================

// ── Auth: ALWAYS require password on every page load ──
// Never persist auth across reloads or tab switches
const ADMIN_PASSWORD_KEY = '__srt_admin_sess__';
let isAuthenticated = false;   // starts false EVERY time

let selectedRoute  = null;
let allBookingsCache = [];    // cached for export

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function initAdminPage() {
  // Always show login on fresh page load
  showLoginModal();

  // Also lock whenever the tab becomes visible again after being hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isAuthenticated) {
      showLoginModal();
    }
  });
}

// ─────────────────────────────────────────
// LOGIN MODAL
// ─────────────────────────────────────────
function showLoginModal() {
  isAuthenticated = false;
  document.body.classList.remove('admin-authed');
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    // clear & focus password field
    const pw = document.getElementById('admin-password');
    if (pw) { pw.value = ''; setTimeout(() => pw.focus(), 100); }
  }
}

function hideLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}

function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;

  // Validate against env-based password (stored server-side ideally;
  // for now keep the same pattern as before)
  const correct = 'admin123'; // ← change to match your ADMIN_PASSWORD env var

  if (password === correct) {
    isAuthenticated = true;
    document.body.classList.add('admin-authed');
    hideLoginModal();
    initAdminDashboard();
    showToast('Welcome back!', 'success');
  } else {
    showToast('Incorrect password', 'error');
    document.getElementById('admin-password').value = '';
    // shake the modal box
    const box = document.querySelector('.modal-content');
    if (box) {
      box.style.animation = 'none';
      box.offsetHeight; // reflow
      box.style.animation = 'shake 0.4s ease';
    }
  }
}

function adminLogout() {
  isAuthenticated = false;
  showToast('Logged out', 'info');
  setTimeout(() => location.reload(), 600);
}

// Shake animation (injected once)
(function injectShake() {
  const s = document.createElement('style');
  s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`;
  document.head.appendChild(s);
})();

// ── IST Timezone Helpers ────────────────────────────────────────────────────
// All date/time operations use IST (UTC+5:30) to prevent timezone drift
// when the browser or server runs in a different timezone.

function toISTDateString(date) {
  // Returns "YYYY-MM-DD" in IST
  const d = new Date(date);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD
}

function toISTTimeString(date) {
  // Returns "HH:MM" in IST
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

function buildISTDateTime(dateStr, timeStr) {
  // Constructs an ISO string pinned to IST: "2026-02-23T17:00:00.000+05:30"
  return `${dateStr}T${timeStr}:00.000+05:30`;
}


// Group a flat list of schedules into route groups
function groupSchedulesByRoute(schedules) {
  const map = new Map();
  schedules.forEach(s => {
    const dep = new Date(s.departureTime);
    const timeKey = toISTTimeString(dep);
    const key = `${s.busName}||${s.origin}||${s.destination}||${timeKey}`;
    if (!map.has(key)) map.set(key, { key, schedules: [] });
    map.get(key).schedules.push(s);
  });
  map.forEach(g => g.schedules.sort((a,b) => new Date(a.departureTime) - new Date(b.departureTime)));
  return Array.from(map.values()).sort((a,b) =>
    new Date(a.schedules[0].departureTime) - new Date(b.schedules[0].departureTime)
  );
}
// ─────────────────────────────────────────
// DASHBOARD INIT
// ─────────────────────────────────────────
function initAdminDashboard() {
  loadBookingsTable();
  loadStats();
  initScheduleForm();
  initPricingForm();
  loadRouteSelector();
  initBusDatePicker();
  initCouponForm();
}

// ─────────────────────────────────────────
// STATS
// ─────────────────────────────────────────
async function loadStats() {
  const schedules = await getSchedules();
  const stats     = await getBookingStats();

  const totalRevenue  = stats.totalRevenue  || 0;
  const totalBookings = stats.totalBookings || 0;
  const totalBuses    = schedules.length;

  const statRevenue  = document.getElementById('stat-revenue');
  const statBookings = document.getElementById('stat-bookings');
  const statBuses    = document.getElementById('stat-buses');

  if (statRevenue)  statRevenue.textContent  = formatCurrency(totalRevenue);
  if (statBookings) statBookings.textContent = totalBookings;
  if (statBuses)    statBuses.textContent    = totalBuses;
}

// ─────────────────────────────────────────
// SCHEDULES TABLE
// ─────────────────────────────────────────
async function loadSchedulesTable() {
  // schedules-table-body was removed from the Schedules tab —
  // all schedule listing now happens in the Bus List tab via loadBusListTable()
  await loadBusListTable();
}

// ─────────────────────────────────────────
// BOOKINGS TABLE
// ─────────────────────────────────────────
async function loadBookingsTable() {
  const tbody = document.getElementById('bookings-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading…</td></tr>';
  const bookings = await getAllBookings();
  allBookingsCache = bookings; // cache for export

  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No bookings found</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(booking => {
    const schedule = booking.scheduleId;
    return `
      <tr>
        <td><code class="token-code">${booking.bookingToken}</code></td>
        <td>${booking.customerName}</td>
        <td>
          <div>${booking.email}</div>
          <div class="text-muted">${booking.phone}</div>
        </td>
        <td>
          ${schedule
            ? `<div><strong>${schedule.busName}</strong></div><div class="text-muted">${schedule.origin} → ${schedule.destination}</div>`
            : 'N/A'}
        </td>
        <td style="white-space:nowrap;font-size:0.82rem;color:#374151;">
          ${schedule && schedule.departureTime
            ? `<div>${formatDate(schedule.departureTime)}</div><div style="color:#667eea;font-weight:600;">${toISTTimeString(new Date(schedule.departureTime))}</div>`
            : (booking.createdAt ? `<div>${formatDate(booking.createdAt)}</div>` : '—')}
        </td>
        <td>${booking.seatNumbers.map(s => `<span class="seat-badge-sm">${s}</span>`).join(' ')}</td>
        <td>${formatCurrency(booking.totalAmount)}</td>
        <td>
          <span class="badge badge-${booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'secondary'}">
            ${booking.status}
          </span>
        </td>
        <td>
          ${booking.status === 'confirmed'
            ? `<button class="btn btn-sm btn-danger" onclick="cancelBookingConfirm('${booking.bookingToken}')">Cancel</button>`
            : '<span class="text-muted">-</span>'}
        </td>
      </tr>`;
  }).join('');
}

// ─────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────
function openExportModal() {
  // Populate route selector in modal
  const routeSelect = document.getElementById('export-route-filter');
  if (routeSelect && allBookingsCache.length > 0) {
    const routes = new Set();
    allBookingsCache.forEach(b => {
      if (b.scheduleId && b.scheduleId.origin) {
        routes.add(`${b.scheduleId.origin} → ${b.scheduleId.destination}`);
      }
    });
    routeSelect.innerHTML = '<option value="">All Cab Routes</option>';
    routes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      routeSelect.appendChild(opt);
    });
  }

  // Show/hide filter fields based on radio
  document.querySelectorAll('input[name="export-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const filterFields = document.getElementById('export-filter-fields');
      filterFields.classList.toggle('visible', radio.value === 'filter');
    });
  });

  // Reset to "all"
  document.querySelector('input[name="export-type"][value="all"]').checked = true;
  document.getElementById('export-filter-fields').classList.remove('visible');

  document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
}

// Close edit modal on outside click
document.addEventListener('click', function(e) {
  const modal = document.getElementById('edit-schedule-modal');
  if (modal && e.target === modal) closeEditModal();
});

function executeExport() {
  const exportType = document.querySelector('input[name="export-type"]:checked')?.value || 'all';

  let data = [...allBookingsCache];

  if (exportType === 'filter') {
    const dateFrom  = document.getElementById('export-date-from').value;
    const dateTo    = document.getElementById('export-date-to').value;
    const routeVal  = document.getElementById('export-route-filter').value;

    if (dateFrom) {
      const from = new Date(dateFrom);
      data = data.filter(b => new Date(b.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      data = data.filter(b => new Date(b.createdAt) <= to);
    }
    if (routeVal) {
      data = data.filter(b => {
        if (!b.scheduleId) return false;
        const route = `${b.scheduleId.origin} → ${b.scheduleId.destination}`;
        return route === routeVal;
      });
    }

    if (data.length === 0) {
      showToast('No bookings match the selected filters.', 'warning');
      return;
    }
  }

  downloadExcel(data);
  closeExportModal();
}

function downloadExcel(bookings) {
  // Build CSV (opens perfectly in Excel)
  const headers = [
    'Booking Token', 'Passenger Name', 'Email', 'Phone',
    'Bus Name', 'Route', 'Departure Date', 'Departure Time',
    'Seats', 'Total Amount (₹)', 'Status', 'Booked On'
  ];

  const rows = bookings.map(b => {
    const schedule = b.scheduleId;
    const dep = schedule?.departureTime ? new Date(schedule.departureTime) : null;
    return [
      b.bookingToken,
      b.customerName,
      b.email,
      b.phone,
      schedule?.busName || 'N/A',
      schedule ? `${schedule.origin} → ${schedule.destination}` : 'N/A',
      dep ? dep.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
      dep ? dep.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'N/A',
      b.seatNumbers.join(', '),
      b.totalAmount,
      b.status,
      new Date(b.createdAt).toLocaleString('en-IN')
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const BOM = '\uFEFF';  // UTF-8 BOM so Excel reads Hindi/special chars correctly
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `SRT_Taxi_Bookings_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${bookings.length} booking(s)!`, 'success');
}

// ─────────────────────────────────────────
// SCHEDULE FORM
// ─────────────────────────────────────────
function initScheduleForm() {
  const form = document.getElementById('schedule-form');
  if (form) {
    form.addEventListener('submit', handleScheduleSubmit);
    ['origin', 'destination'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateScheduleFormPricing);
    });
  }
}

function updateScheduleFormPricing() {
  const origin      = document.getElementById('origin')?.value.trim();
  const destination = document.getElementById('destination')?.value.trim();
  const preview     = document.getElementById('schedule-pricing-preview');
  if (!preview || !origin || !destination) { if (preview) preview.style.display = 'none'; return; }

  const routePricing   = getRoutePricing(origin, destination);
  const isCustom       = getAllRoutePricing()[getRouteKey(origin, destination)] !== undefined;
  const lower = routePricing.frontPrice ?? 0;
  const upper = routePricing.rearPrice ?? 0;
  preview.style.display = 'block';
  preview.innerHTML = `
    <div class="pricing-info-box">
      <div class="pricing-info-header">
        <strong>📊 Seat Pricing for this Route</strong>
        ${isCustom ? '<span class="badge badge-success">Custom</span>' : '<span class="badge badge-secondary">Default</span>'}
      </div>
      <div class="pricing-grid">
        <div class="pricing-item"><span class="pricing-label">🪑 Front Seat (F1):</span><span class="pricing-value">${formatCurrency(lower)}</span></div>
        <div class="pricing-item"><span class="pricing-label">💺 Rear Seats (R1–R5):</span><span class="pricing-value">${formatCurrency(upper)}</span></div>
      </div>
      <div class="pricing-note"><small>${isCustom ? 'This route has custom pricing.' : 'Using default pricing. Set custom pricing in the Pricing tab.'}</small></div>
    </div>`;
}

async function handleScheduleSubmit(e) {
  e.preventDefault();
  const busDates = buildDatesFromMode();
  const busTime  = document.getElementById('bus-time').value;
  const scheduleId = document.getElementById('schedule-id').value;

  // If editing an existing, use old single-date approach
  if (scheduleId) {
    // For edit mode, fall back to single date (use first date from picker or today)
    const singleDate = busDates[0] || toISTDateString(new Date());
    const departureDate = new Date(buildISTDateTime(singleDate, busTime));
    const durationHrs  = parseInt(document.getElementById('duration-hours').value)  || 0;
    const durationMins = parseInt(document.getElementById('duration-minutes').value) || 0;
    const totalMins    = (durationHrs * 60) + durationMins;
    const arrivalDate  = new Date(departureDate.getTime() + (totalMins || 30) * 60000);
    const origin       = document.getElementById('origin').value.trim();
    const destination  = document.getElementById('destination').value.trim();
    const basePriceRaw = document.getElementById('price').value;
    const basePrice    = basePriceRaw !== '' ? parseInt(basePriceRaw) : null;
    const formData = {
      busName: document.getElementById('bus-name').value.trim(),
      type: document.getElementById('bus-type').value,
      origin, destination,
      pickupPoint:   document.getElementById('pickup-point').value.trim(),
      dropPoint:     document.getElementById('drop-point').value.trim(),
      durationHours: durationHrs, durationMins,
      departureTime: departureDate.toISOString(),
      arrivalTime:   arrivalDate.toISOString(),
      price: basePrice || 0
    };
    showLoading();
    const result = await updateSchedule(scheduleId, formData);
    hideLoading();
    if (result) {
      showToast('Schedule updated!', 'success');
      resetScheduleFormState();
      await loadSchedulesTable(); await loadStats(); await loadRouteSelector();
    }
    return;
  }

  // New schedule — require at least one date
  if (!busDates.length) {
    showToast('Please select at least one bus date', 'error'); return;
  }
  if (!busTime) { showToast('Please set a departure time', 'error'); return; }

  const durationHrs  = parseInt(document.getElementById('duration-hours').value)  || 0;
  const durationMins = parseInt(document.getElementById('duration-minutes').value) || 0;
  const origin       = document.getElementById('origin').value.trim();
  const destination  = document.getElementById('destination').value.trim();
  const basePriceRaw = document.getElementById('price').value;
  const basePrice    = basePriceRaw !== '' ? parseInt(basePriceRaw) : null;

  const formData = {
    busName:       document.getElementById('bus-name').value.trim(),
    type:          document.getElementById('bus-type').value,
    origin, destination,
    pickupPoint:   document.getElementById('pickup-point').value.trim(),
    dropPoint:     document.getElementById('drop-point').value.trim(),
    durationHours: durationHrs,
    durationMins,
    price:         basePrice || 0,
    busDates,
    busTime
  };

  showLoading();
  const result = await addSchedule(formData);
  hideLoading();

  if (result) {
    const count = result.count || 1;
    showToast(`${count} schedule${count > 1 ? 's' : ''} added! 🎉`, 'success');

    if (basePrice && basePrice > 0) {
      const existing = getRoutePricing(origin, destination);
      setRoutePricing(origin, destination, {
        frontPrice: basePrice, rearPrice: basePrice, perSeat: existing.perSeat || {}
      });
    }

    resetScheduleFormState();
    await loadSchedulesTable(); await loadStats(); await loadRouteSelector();
  }
}

function resetScheduleFormState() {
  document.getElementById('schedule-form')?.reset();
  document.getElementById('schedule-id').value   = '';
  document.getElementById('bus-name').value       = 'Shree Ram Taxi';
  document.getElementById('bus-type').value       = 'Sedan (4+1)';
  document.getElementById('form-title').textContent = 'Add New Schedule';
  document.getElementById('schedule-pricing-preview').style.display = 'none';
  selectedBusDates = [];
  renderDatePills();
}

async function editSchedule(id) {
  showLoading();
  const schedule = await getScheduleById(id);
  hideLoading();
  if (!schedule) { showToast('Schedule not found', 'error'); return; }

  // Populate the edit modal fields
  document.getElementById('edit-schedule-id').value        = schedule.id || schedule._id;
  document.getElementById('edit-bus-type').value           = schedule.type;
  document.getElementById('edit-origin').value             = schedule.origin;
  document.getElementById('edit-destination').value        = schedule.destination;
  document.getElementById('edit-pickup-point').value       = schedule.pickupPoint  || '';
  document.getElementById('edit-drop-point').value         = schedule.dropPoint    || '';
  document.getElementById('edit-duration-hours').value     = schedule.durationHours || '';
  document.getElementById('edit-duration-minutes').value   = schedule.durationMins  || '';
  document.getElementById('edit-price').value              = schedule.price || '';

  // Departure date & time in IST
  const d = new Date(schedule.departureTime);
  document.getElementById('edit-departure-date').value = toISTDateString(d);
  document.getElementById('edit-departure-time').value = toISTTimeString(d);

  // Open modal
  const modal = document.getElementById('edit-schedule-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  document.getElementById('edit-schedule-modal').style.display = 'none';
  document.body.style.overflow = '';
}

async function saveEditModal(e) {
  e.preventDefault();
  const id = document.getElementById('edit-schedule-id').value;
  if (!id) { showToast('Missing schedule ID', 'error'); return; }

  const dateVal = document.getElementById('edit-departure-date').value;
  const timeVal = document.getElementById('edit-departure-time').value;
  if (!dateVal || !timeVal) { showToast('Please set departure date and time', 'error'); return; }

  const departureTime = new Date(buildISTDateTime(dateVal, timeVal));

  const payload = {
    busName:       'Shree Ram Taxi',
    type:          document.getElementById('edit-bus-type').value,
    origin:        document.getElementById('edit-origin').value.trim(),
    destination:   document.getElementById('edit-destination').value.trim(),
    pickupPoint:   document.getElementById('edit-pickup-point').value.trim(),
    dropPoint:     document.getElementById('edit-drop-point').value.trim(),
    durationHours: parseInt(document.getElementById('edit-duration-hours').value) || 0,
    durationMins:  parseInt(document.getElementById('edit-duration-minutes').value) || 0,
    price:         parseFloat(document.getElementById('edit-price').value) || 0,
    departureTime: departureTime.toISOString(),
  };

  try {
    showLoading();
    await updateSchedule(id, payload);
    hideLoading();
    closeEditModal();
    showToast('Schedule updated successfully!', 'success');
    await loadBusListTable();
    await loadStats();
  } catch (err) {
    hideLoading();
    showToast('Failed to update schedule. Please try again.', 'error');
    console.error('Edit save error:', err);
  }
}

// ── Delete Bus Dialog ──────────────────────────────────────────────────────
// _cancelDialogIds holds the array of schedule IDs for the selected route group
let _cancelDialogIds = [];

function openBusCancelDialog(idsInput) {
  // Accept JSON string (from onclick attr) or plain array
  let ids = idsInput;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch(e) { ids = [ids]; }
  }
  if (!Array.isArray(ids)) ids = [ids];
  _cancelDialogIds = ids;

  const s = allBusesCache.find(x => ids.includes(x.id) || ids.includes(x._id));
  const nameEl = document.getElementById('bus-cancel-dialog-name');
  if (nameEl && s) nameEl.textContent = `${s.busName} · ${s.origin} → ${s.destination}`;

  document.getElementById('cancel-dates-panel').style.display = 'none';
  document.getElementById('bus-cancel-dialog').style.display = 'flex';
}

function closeBusCancelDialog() {
  document.getElementById('bus-cancel-dialog').style.display = 'none';
  _cancelDialogIds = [];
}

async function busDeleteAction(action) {
  if (action === 'delete-all') {
    const count = _cancelDialogIds.length;
    if (!confirm(`Permanently delete this route and ALL ${count} date${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
    const idsToDelete = [..._cancelDialogIds];
    closeBusCancelDialog();
    showLoading();
    const results = await Promise.all(idsToDelete.map(id => deleteSchedule(id)));
    hideLoading();
    const allOk = results.every(Boolean);
    showToast(allOk ? `Route deleted (${count} date${count > 1 ? 's' : ''} removed)` : 'Some dates could not be deleted', allOk ? 'success' : 'error');
    await loadBusListTable(); await loadStats();

  } else if (action === 'delete-specific') {
    const panel = document.getElementById('cancel-dates-panel');
    const listEl = document.getElementById('cancel-dates-list');
    panel.style.display = 'block';

    // Show the REAL scheduled dates from the cache for this route group
    const groupSchedules = allBusesCache
      .filter(x => _cancelDialogIds.includes(x.id) || _cancelDialogIds.includes(x._id))
      .sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

    if (!groupSchedules.length) {
      listEl.innerHTML = '<p style="color:#6b7280;font-size:0.85rem;">No scheduled dates found.</p>';
      return;
    }

    listEl.innerHTML = groupSchedules.map(s => {
      const dateStr = new Date(s.departureTime).toLocaleDateString('en-IN',
        { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timeStr = toISTTimeString(new Date(s.departureTime));
      const id = s.id || s._id;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:0.4rem;">
          <div>
            <span style="font-weight:600;font-size:0.875rem;color:#1e293b;">${dateStr}</span>
            <span style="font-size:0.78rem;color:#f59e0b;margin-left:0.5rem;">@ ${timeStr}</span>
          </div>
          <button onclick="deleteSingleDateFromGroup('${id}', this)"
            style="padding:0.25rem 0.65rem;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:0.78rem;font-weight:600;cursor:pointer;">
            🗑 Delete
          </button>
        </div>`;
    }).join('');
  }
}

async function deleteSingleDateFromGroup(scheduleId, btn) {
  if (!confirm('Delete this specific date? This cannot be undone.')) return;
  btn.disabled = true;
  btn.textContent = '…';
  const ok = await deleteSchedule(scheduleId);
  if (ok) {
    _cancelDialogIds = _cancelDialogIds.filter(id => id !== scheduleId);
    btn.closest('div[style]').remove();
    showToast('Date deleted', 'success');
    if (_cancelDialogIds.length === 0) closeBusCancelDialog();
    await loadBusListTable(); await loadStats();
  } else {
    btn.disabled = false;
    btn.textContent = '🗑 Delete';
  }
}

function resetScheduleForm() {
  document.getElementById('schedule-form').reset();
  document.getElementById('schedule-id').value      = '';
  document.getElementById('bus-name').value         = 'Shree Ram Taxi';
  document.getElementById('bus-type').value         = 'Sedan (4+1)';
  document.getElementById('pickup-point').value     = '';
  document.getElementById('drop-point').value       = '';
  document.getElementById('duration-hours').value   = '';
  document.getElementById('duration-minutes').value = '';
  document.getElementById('form-title').textContent = 'Add New Schedule';
  document.getElementById('schedule-pricing-preview').style.display = 'none';
  selectedBusDates = [];
  renderDatePills();
}

// ─────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────
async function loadRouteSelector() {
  const routeSelect = document.getElementById('route-selector');
  if (!routeSelect) return;
  const routes     = await getAllRoutes();
  const allPricing = getAllRoutePricing();
  // remove old listener by cloning
  const fresh = routeSelect.cloneNode(false);
  routeSelect.parentNode.replaceChild(fresh, routeSelect);
  fresh.innerHTML = '<option value="">Select a route…</option>';
  routes.forEach(route => {
    const hasCustom = allPricing[route.key] !== undefined;
    const opt = document.createElement('option');
    opt.value = route.key;
    opt.textContent = `${route.display}${hasCustom ? ' ⭐' : ''}`;
    opt.dataset.origin      = route.origin;
    opt.dataset.destination = route.destination;
    fresh.appendChild(opt);
  });
  fresh.addEventListener('change', handleRouteSelection);
}

function handleRouteSelection(e) {
  const sel = e.target.options[e.target.selectedIndex];
  if (!sel.value) { selectedRoute = null; resetPricingForm(); return; }
  selectedRoute = {
    key:         sel.value,
    origin:      sel.dataset.origin,
    destination: sel.dataset.destination,
    display:     sel.textContent.replace(' ⭐','')
  };
  loadPricingForRoute(selectedRoute);
}

function loadPricingForRoute(route) {
  const pricing    = getRoutePricing(route.origin, route.destination);
  const allPricing = getAllRoutePricing();
  const hasCustom  = allPricing[route.key] !== undefined;

  // Section 1 – deck-level prices
  document.getElementById('lower-deck-price').value = pricing.frontPrice || 600;
  document.getElementById('upper-deck-price').value = pricing.rearPrice || 500;

  const ps = document.getElementById('pricing-status');
  if (ps) ps.innerHTML = hasCustom
    ? `<div class="alert alert-info"><strong>Custom pricing set for this route.</strong>
        <button class="btn btn-sm btn-outline" onclick="resetRoutePricing()" style="margin-left:1rem;">Reset to Default</button></div>`
    : `<div class="alert alert-secondary"><strong>Using default pricing.</strong> Save to apply custom pricing.</div>`;

  const btn = document.getElementById('reset-route-btn');
  if (btn) btn.style.display = hasCustom ? 'inline-flex' : 'none';

  // Section 2 – per-seat map (detect bus type from first schedule on this route)
  renderAdminSeatMap(route, pricing);
}

function initPricingForm() {
  const form = document.getElementById('pricing-form');
  if (!form) return;
  form.addEventListener('submit', handlePricingSubmit);
  ['lower-deck-price','upper-deck-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateDeckPricePreview);
  });
  resetPricingForm();
}

function resetPricingForm() {
  document.getElementById('lower-deck-price').value = 600;
  document.getElementById('upper-deck-price').value = 500;
  const ps = document.getElementById('pricing-status');
  if (ps) ps.innerHTML = `<div class="alert alert-secondary"><strong>Select a route</strong> to configure pricing.</div>`;
  document.getElementById('per-seat-map-container').innerHTML =
    `<p style="color:#6b7280;text-align:center;padding:2rem 0;">Select a route above to configure per-seat prices.</p>`;
  updateDeckPricePreview();
}

function updateDeckPricePreview() {
  const fp = parseInt(document.getElementById('lower-deck-price')?.value || 600);
  const rp = parseInt(document.getElementById('upper-deck-price')?.value || 500);
  const prev = document.getElementById('pricing-preview');
  if (!prev) return;
  prev.innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;padding:1rem;background:#f9fafb;border-radius:8px;">
      <div>
        <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.25rem;">🪑 Front Seat F1 (default)</div>
        <div style="font-size:1.4rem;font-weight:700;color:#0ea5e9;">${formatCurrency(fp)}</div>
      </div>
      <div>
        <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.25rem;">💺 Rear Seats R1–R5 (default)</div>
        <div style="font-size:1.4rem;font-weight:700;color:#f59e0b;">${formatCurrency(rp)}</div>
      </div>
      <div style="flex:1;min-width:200px;background:#fffbeb;border-radius:6px;padding:0.75rem;font-size:0.8rem;color:#92400e;">
        ℹ️ Per-seat overrides in Section 2 below will take priority over these defaults.
      </div>
    </div>`;
}

// ─── Section 2: Admin per-seat map (Taxi) ───
async function renderAdminSeatMap(route, pricing) {
  const container = document.getElementById('per-seat-map-container');
  if (!container) return;

  const schedules = await getSchedules({ origin: route.origin, destination: route.destination });
  const cabType   = schedules[0]?.type || 'Sedan (4+1)';
  const isSUV     = cabType === 'SUV (6+1)';
  const perSeat   = pricing.perSeat || {};

  const frontPrice = parseInt(document.getElementById('lower-deck-price')?.value || 600);
  const rearPrice  = parseInt(document.getElementById('upper-deck-price')?.value  || 500);

  // All seat IDs for this cab type
  const allSeats = isSUV
    ? ['F1', 'R1', 'R2', 'R3', 'R4', 'R5']
    : ['F1', 'R1', 'R2', 'R3'];

  function adminSeatInput(sid) {
    const isFront   = sid === 'F1';
    const defPrice  = isFront ? frontPrice : rearPrice;
    const val       = perSeat[sid] !== undefined ? perSeat[sid] : '';
    const icon      = isFront ? '🪑' : '💺';
    const label     = isFront ? 'Front' : 'Rear';
    return `
      <div class="admin-seat-input-wrap" title="${sid}" style="background:${isFront ? '#f0f9ff' : '#f8fafc'};border:1px solid ${isFront ? '#7dd3fc' : '#e2e8f0'};border-radius:10px;padding:0.75rem;display:flex;flex-direction:column;align-items:center;gap:0.4rem;min-width:90px;">
        <div style="font-size:1.3rem;">${icon}</div>
        <div style="font-size:0.72rem;font-weight:700;color:#1e293b;">${sid}</div>
        <div style="font-size:0.65rem;color:#64748b;">${label}</div>
        <input type="number" class="admin-seat-price-input" id="seat-input-${sid}"
          data-seat="${sid}" min="0" placeholder="${defPrice}"
          value="${val}" oninput="onPerSeatInput('${sid}')"
          style="width:80px;text-align:center;padding:0.35rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;">
      </div>`;
  }

  // Build a visual cab layout
  let cabHTML = `
    <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:16px;padding:1.25rem;max-width:420px;margin:0 auto;">
      <!-- Driver row -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#1e293b,#334155);border-radius:10px;padding:0.6rem 1rem;margin-bottom:1rem;">
        <div style="color:#fff;font-size:0.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">🎮 DRIVER (Not bookable)</div>
      </div>
      <div style="border-top:2px dashed #cbd5e1;margin-bottom:1rem;"></div>
      <div style="text-align:center;font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;">Passenger Seats — Set Individual Prices</div>
      <!-- Front passenger -->
      <div style="display:flex;justify-content:flex-start;gap:8px;margin-bottom:0.75rem;">
        ${adminSeatInput('F1')}
      </div>
      <div style="border-top:2px dashed #cbd5e1;margin:0.75rem 0;"></div>
      <div style="text-align:center;font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;">Middle Row</div>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:0.75rem;">
        ${adminSeatInput('R1')}
        <div style="width:24px;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:.7rem;">|</div>
        ${adminSeatInput('R2')}
        ${adminSeatInput('R3')}
      </div>`;

  if (isSUV) {
    cabHTML += `
      <div style="border-top:2px dashed #cbd5e1;margin:0.75rem 0;"></div>
      <div style="text-align:center;font-size:0.7rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.75rem;">Back Row</div>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:0.75rem;">
        <div style="width:90px;"></div>
        <div style="width:24px;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:.7rem;">|</div>
        ${adminSeatInput('R4')}
        ${adminSeatInput('R5')}
      </div>`;
  }

  cabHTML += `</div>`;

  container.innerHTML = `
    <div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#fffbeb;border-radius:8px;font-size:0.85rem;color:#92400e;border:1px solid #fcd34d;">
      💡 <strong>Tip:</strong> Leave blank to use the default Front/Rear price above. Enter a value to override that specific seat's price.
    </div>
    <div style="margin-bottom:1rem;padding:0.5rem 0.75rem;background:#f0fdf4;border-radius:8px;font-size:0.8rem;color:#166534;border:1px solid #bbf7d0;">
      🚖 Cab Type: <strong>${cabType}</strong> — ${isSUV ? '6 passenger seats (F1 + R1-R5)' : '4 passenger seats (F1 + R1-R3)'}
    </div>
    ${cabHTML}`;
}

function onPerSeatInput(seatId) {
  // live update — collected on save
}

function handlePricingSubmit(e) {
  e.preventDefault();
  if (!selectedRoute) { showToast('Please select a route first','warning'); return; }

  const lp = parseInt(document.getElementById('lower-deck-price').value);
  const up = parseInt(document.getElementById('upper-deck-price').value);
  if (isNaN(lp) || isNaN(up) || lp < 0 || up < 0) { showToast('Prices must be positive','error'); return; }

  // Collect per-seat overrides
  const perSeat = {};
  document.querySelectorAll('.admin-seat-price-input').forEach(input => {
    const sid = input.dataset.seat;
    const val = input.value.trim();
    if (val !== '' && !isNaN(parseInt(val)) && parseInt(val) >= 0) {
      perSeat[sid] = parseInt(val);
    }
  });

  const ok = setRoutePricing(selectedRoute.origin, selectedRoute.destination, { frontPrice: lp, rearPrice: up, perSeat });
  if (ok) {
    showToast(`Pricing saved for ${selectedRoute.display}!`, 'success');
    loadRouteSelector();
    loadPricingForRoute(selectedRoute);
  } else {
    showToast('Failed to save pricing','error');
  }
}

function resetRoutePricing() {
  if (!selectedRoute) return;
  if (confirm(`Reset pricing for ${selectedRoute.display} to defaults?`)) {
    deleteRoutePricing(selectedRoute.origin, selectedRoute.destination);
    showToast('Route pricing reset','success');
    loadRouteSelector();
    loadPricingForRoute(selectedRoute);
  }
}

function resetAllPricing() {
  if (confirm('⚠️ Reset ALL pricing to system defaults?')) {
    localStorage.removeItem('routePricing_taxi_v1');
    localStorage.removeItem('routePricing_v2');
    localStorage.removeItem('routePricing');
    showToast('All pricing reset','success');
    selectedRoute = null;
    document.getElementById('route-selector').value = '';
    resetPricingForm();
    loadRouteSelector();
  }
}

// ─────────────────────────────────────────
// TABS
// ─────────────────────────────────────────
function switchAdminTab(tabName, event) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
  const tabId = tabName === 'cablists' ? 'tab-cablists' : `tab-${tabName}`;
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');
  if (tabName === 'pricing')  loadRouteSelector();
  if (tabName === 'bookings') loadBookingsTable();
  if (tabName === 'cablists') loadBusListTable();
  if (tabName === 'coupons')  loadCouponsTable();
}


// ─────────────────────────────────────────
// CANCEL BOOKING
// ─────────────────────────────────────────
async function cancelBookingConfirm(bookingToken) {
  if (confirm(`Cancel booking ${bookingToken}?`)) {
    showLoading();
    const success = await cancelBooking(bookingToken);
    hideLoading();
    if (success) {
      await loadBookingsTable();
      await loadStats();
      showToast('Booking cancelled!', 'success');
    } else {
      showToast('Failed to cancel booking.', 'error');
    }
  }
}

// ─────────────────────────────────────────
// SEARCH FILTERS
// ─────────────────────────────────────────
function filterBookings() {
  const term = document.getElementById('booking-search')?.value.toLowerCase() || '';
  document.querySelectorAll('#bookings-table-body tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

function filterSchedules() {
  const term = document.getElementById('schedule-search')?.value.toLowerCase() || '';
  document.querySelectorAll('#schedules-table-body tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

// ─────────────────────────────────────────
// RESET STATS (dev only)
// ─────────────────────────────────────────
async function resetStatsTemporary() {
  if (confirm('⚠️ DEVELOPMENT ONLY: Reset all stats?')) {
    showLoading();
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/reset-stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (response.ok) {
        await loadStats();
        showToast('Stats reset!', 'success');
      } else {
        document.getElementById('stat-revenue').textContent  = '₹0';
        document.getElementById('stat-bookings').textContent = '0';
        showToast('Display reset (backend endpoint not implemented)', 'info');
      }
    } catch {
      document.getElementById('stat-revenue').textContent  = '₹0';
      document.getElementById('stat-bookings').textContent = '0';
    }
    hideLoading();
  }
}

// ─────────────────────────────────────────
// MULTI-DATE BUS PICKER
// ─────────────────────────────────────────
// ── Schedule Mode (Date Range / Days of Week / Specific Dates) ──────────────
let selectedBusDates = [];
let _scheduleMode = 'daterange';

function setScheduleMode(mode) {
  _scheduleMode = mode;
  ['daterange','specific'].forEach(m => {
    const panel = document.getElementById('mode-panel-' + m);
    const tab   = document.getElementById('mode-tab-' + m);
    if (panel) panel.style.display = m === mode ? 'block' : 'none';
    if (tab)   tab.style.border = m === mode ? '2px solid #667eea' : '2px solid #e5e7eb';
  });
  updateDatesSummary();
}

function previewDateRange() {
  const s = document.getElementById('range-start')?.value;
  const e = document.getElementById('range-end')?.value;
  const preview = document.getElementById('range-preview');
  if (!s || !e) { if (preview) preview.textContent = ''; return; }
  if (e < s) { if (preview) preview.textContent = '⚠️ End date must be after start date'; return; }
  const start = new Date(s), end = new Date(e);
  const days = Math.round((end - start) / 86400000) + 1;
  if (preview) preview.textContent = `✅ ${days} days (${s} → ${e})`;
  updateDatesSummary();
}


function updateDatesSummary() {
  const el = document.getElementById('dates-summary');
  if (!el) return;
  if (_scheduleMode === 'daterange') {
    const s = document.getElementById('range-start')?.value;
    const e = document.getElementById('range-end')?.value;
    el.textContent = s && e ? `📅 Daily from ${s} to ${e}` : '';
  } else {
    el.textContent = selectedBusDates.length ? `📌 ${selectedBusDates.length} specific date(s) selected` : '';
  }
}

function initBusDatePicker() {
  const today = toISTDateString(new Date()); // IST today
  ['bus-date-picker','range-start','range-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.min = today;
  });
  setScheduleMode('daterange');
  renderDatePills();
}

function addBusDate(dateStr) {
  if (!dateStr) return;
  if (!selectedBusDates.includes(dateStr)) {
    selectedBusDates.push(dateStr);
    selectedBusDates.sort();
    renderDatePills();
  }
}

function removeBusDate(dateStr) {
  selectedBusDates = selectedBusDates.filter(d => d !== dateStr);
  renderDatePills();
}

function renderDatePills() {
  const container = document.getElementById('selected-dates-list');
  if (!container) return;
  if (selectedBusDates.length === 0) {
    container.innerHTML = '<span style="color:#9ca3af;font-size:0.8rem;">No dates selected yet</span>';
  } else {
    container.innerHTML = selectedBusDates.map(d => {
      const display = new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      return `<span class="date-pill">${display}<button type="button" onclick="removeBusDate('${d}')" title="Remove">×</button></span>`;
    }).join('');
  }
  const hidden = document.getElementById('bus-dates-json');
  if (hidden) hidden.value = JSON.stringify(selectedBusDates);
  updateDatesSummary();
}

// Build the flat array of dates from current schedule mode (for form submission)
function buildDatesFromMode() {
  if (_scheduleMode === 'specific') return selectedBusDates;
  if (_scheduleMode === 'daterange') {
    const s = document.getElementById('range-start')?.value;
    const e = document.getElementById('range-end')?.value;
    if (!s || !e || e < s) return [];
    const dates = [];
    // Iterate using pure string comparison (YYYY-MM-DD sorts lexicographically)
    // to avoid ANY browser timezone drift with Date objects.
    let cur = s;
    while (cur <= e) {
      dates.push(cur);
      // Advance by one day: parse as IST midnight, add 24h, get IST date string
      const d = new Date(cur + 'T00:00:00.000+05:30');
      d.setUTCDate(d.getUTCDate() + 1);
      cur = toISTDateString(d);
    }
    return dates;
  }
  return [];
}

// Override initScheduleForm to hook multi-date
const _origInitScheduleForm = initScheduleForm;

// ─────────────────────────────────────────
// BUS LISTS TAB — one row per unique route group
// ─────────────────────────────────────────
let allBusesCache = [];

async function loadBusListTable() {
  const tbody = document.getElementById('buslist-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading…</td></tr>';
  allBusesCache = await getSchedules();
  renderBusListTable(allBusesCache);
}

function renderBusListTable(schedules) {
  const tbody = document.getElementById('buslist-table-body');
  if (!tbody) return;
  if (!schedules || schedules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No buses found</td></tr>';
    return;
  }

  const groups = groupSchedulesByRoute(schedules);

  tbody.innerHTML = groups.map(group => {
    const s = group.schedules[0];
    const dh = s.durationHours || 0, dm = s.durationMins || 0;
    const dur = (dh || dm) ? `${dh > 0 ? dh+'h ' : ''}${dm > 0 ? dm+'m' : ''}`.trim() : '—';

    const sorted = group.schedules.slice().sort((a,b) => new Date(a.departureTime) - new Date(b.departureTime));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const dateLabel = group.schedules.length === 1
      ? formatDate(first.departureTime)
      : `${formatDate(first.departureTime)} – ${formatDate(last.departureTime)}`;

    const ids = group.schedules.map(x => x.id || x._id);
    const idsAttr = JSON.stringify(ids).replace(/"/g, '&quot;');

    return `
    <tr>
      <td><div style="display:flex;align-items:center;gap:.3rem;font-weight:700;">${s.type.includes("SUV") ? "🚙" : "🚗"} <span>${s.busName}</span></div><div style="font-size:.72rem;color:#f59e0b;font-weight:600;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:.1rem .5rem;display:inline-block;margin-top:.2rem;">${s.type}</div></td>
      <td>${s.origin} → ${s.destination}</td>
      <td style="font-size:0.78rem;color:#475569;">${s.pickupPoint || '—'}<br>${s.dropPoint || '—'}</td>
      <td>
        <div style="font-size:0.85rem;">${dateLabel}</div>
        <small style="color:#f59e0b;font-weight:600;">${toISTTimeString(new Date(s.departureTime))} &nbsp;·&nbsp; ${group.schedules.length} day${group.schedules.length > 1 ? 's' : ''}</small>
      </td>
      <td><span style="background:#eff6ff;color:#3b82f6;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.78rem;">⏱ ${dur}</span></td>
      <td>${formatCurrency(s.price)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline" onclick="editSchedule('${s.id}')">Edit Details</button>
          <button class="btn btn-sm btn-danger" onclick="openBusCancelDialog('${idsAttr}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterBusList() {
  const term = document.getElementById('buslist-search')?.value.toLowerCase() || '';
  const type = document.getElementById('buslist-filter-type')?.value || '';
  const filtered = allBusesCache.filter(s => {
    const matchText = !term || (s.busName + s.origin + s.destination + s.type).toLowerCase().includes(term);
    const matchType = !type || s.type === type;
    return matchText && matchType;
  });
  renderBusListTable(filtered);
}

// ─────────────────────────────────────────
// COUPONS TAB
// ─────────────────────────────────────────
async function loadCouponsTable() {
  const tbody = document.getElementById('coupons-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading…</td></tr>';
  const coupons = await getAllCoupons();
  if (coupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No coupons yet. Create one above!</td></tr>';
    return;
  }
  const now = new Date();
  tbody.innerHTML = coupons.map(c => {
    const endDate   = new Date(c.endDate);
    const startDate = new Date(c.startDate);
    // Compare at end of IST day — coupon is expired only after 23:59:59 of the end date
    const expired = endDate < now;
    const notYet  = startDate > now;
    // Treat as inactive if expired (even if DB still says isActive=true)
    const effectivelyActive = c.isActive && !expired;

    // Days remaining label
    let daysLabel = '';
    if (!expired && !notYet && c.isActive) {
      const msLeft = endDate - now;
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3) daysLabel = `<div style="font-size:0.7rem;color:#dc2626;margin-top:2px;">⚠ ${daysLeft} day${daysLeft===1?'':'s'} left</div>`;
    }

    let statusBadge;
    if (expired)           statusBadge = '<span style="background:#fef3c7;color:#92400e;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.78rem;font-weight:600;">⏰ Expired</span>';
    else if (!c.isActive)  statusBadge = '<span style="background:#fee2e2;color:#dc2626;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.78rem;">Disabled</span>';
    else if (notYet)       statusBadge = '<span style="background:#eff6ff;color:#3b82f6;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.78rem;">Upcoming</span>';
    else                   statusBadge = '<span style="background:#d1fae5;color:#065f46;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.78rem;">Active ✓</span>';

    const discountDisplay = c.discountType === 'flat'
      ? `₹${c.discountValue} off`
      : `${c.discountValue}% off`;
    const usageDisplay = c.maxUsage ? `${c.usageCount}/${c.maxUsage}` : `${c.usageCount}/∞`;
    // Show row with reduced opacity and strikethrough code if expired
    const rowStyle = expired ? 'opacity:0.5;' : '';
    const codeStyle = expired ? 'font-size:1rem;letter-spacing:1px;text-decoration:line-through;color:#9ca3af;' : 'font-size:1rem;letter-spacing:1px;';
    return `
    <tr style="${rowStyle}">
      <td><strong style="${codeStyle}">${c.code}</strong></td>
      <td style="font-size:0.85rem;color:#475569;">${c.description || '—'}</td>
      <td><span style="background:#f0fdf4;color:#166534;padding:0.2rem 0.5rem;border-radius:4px;font-weight:600;">${discountDisplay}</span></td>
      <td style="font-size:0.82rem;">
        ${startDate.toLocaleDateString('en-IN')} – ${endDate.toLocaleDateString('en-IN')}
        ${daysLabel}
        ${expired ? '<div style="font-size:0.7rem;color:#92400e;margin-top:2px;">Expired on ' + endDate.toLocaleDateString('en-IN') + '</div>' : ''}
      </td>
      <td style="font-size:0.85rem;">${usageDisplay}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="btn-group">
          ${!expired ? `<button class="btn btn-sm" style="background:${effectivelyActive ? '#fef3c7' : '#d1fae5'};color:${effectivelyActive ? '#92400e' : '#065f46'};border:1px solid currentColor;" onclick="toggleCouponActive('${c._id}', ${effectivelyActive})">${effectivelyActive ? 'Disable' : 'Enable'}</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteCouponConfirm('${c._id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleCouponActive(id, currentlyActive) {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentlyActive })
    });
    if (res.ok) {
      showToast(currentlyActive ? 'Coupon disabled' : 'Coupon enabled', 'success');
      loadCouponsTable();
    }
  } catch (e) {
    showToast('Failed to update coupon', 'error');
  }
}

function initCouponForm() {
  const form = document.getElementById('coupon-form');
  if (!form) return;
  // Set default dates
  const today = toISTDateString(new Date()); // IST today
  const nextMonth = toISTDateString(new Date(Date.now() + 30*24*3600*1000));
  const startEl = document.getElementById('coupon-start');
  const endEl   = document.getElementById('coupon-end');
  if (startEl) startEl.value = today;
  if (endEl)   endEl.value   = nextMonth;
  form.addEventListener('submit', handleCouponSubmit);
}

function updateCouponPreview() {
  const type  = document.getElementById('coupon-type')?.value;
  const value = document.getElementById('coupon-value')?.value;
  const prev  = document.getElementById('coupon-preview');
  if (!prev) return;
  if (value && Number(value) > 0) {
    const display = type === 'flat' ? `₹${value} flat discount` : `${value}% percentage discount`;
    prev.style.display = 'block';
    prev.innerHTML = `🎉 Customers will get <strong>${display}</strong> on their booking total.`;
  } else {
    prev.style.display = 'none';
  }
}

async function handleCouponSubmit(e) {
  e.preventDefault();
  const code        = document.getElementById('coupon-code').value.trim().toUpperCase();
  const description = document.getElementById('coupon-description').value.trim();
  const discountType  = document.getElementById('coupon-type').value;
  const discountValue = document.getElementById('coupon-value').value;
  const startDate   = document.getElementById('coupon-start').value;
  const endDate     = document.getElementById('coupon-end').value;
  const maxUsage    = document.getElementById('coupon-max-usage').value;

  if (!code || !discountValue || !startDate || !endDate) {
    showToast('Please fill all required fields', 'error'); return;
  }
  if (new Date(startDate) > new Date(endDate)) {
    showToast('End date must be after start date', 'error'); return;
  }

  showLoading();
  const result = await createCoupon({ code, description, discountType, discountValue, startDate, endDate, maxUsage });
  hideLoading();
  if (result) {
    showToast(`Coupon "${code}" created! 🎟️`, 'success');
    resetCouponForm();
    loadCouponsTable();
  }
}

function resetCouponForm() {
  document.getElementById('coupon-form')?.reset();
  const today = toISTDateString(new Date()); // IST today
  const nextMonth = toISTDateString(new Date(Date.now() + 30*24*3600*1000));
  const startEl = document.getElementById('coupon-start');
  const endEl   = document.getElementById('coupon-end');
  if (startEl) startEl.value = today;
  if (endEl)   endEl.value   = nextMonth;
  const prev = document.getElementById('coupon-preview');
  if (prev) prev.style.display = 'none';
}

async function deleteCouponConfirm(id) {
  if (confirm('Delete this coupon? This cannot be undone.')) {
    showLoading();
    const ok = await deleteCoupon(id);
    hideLoading();
    if (ok) { showToast('Coupon deleted', 'success'); loadCouponsTable(); }
  }
}

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAdminPage);