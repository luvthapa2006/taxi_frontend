// ========================================
// SEATS.JS — Taxi Seat Selection
// Layouts: Sedan (4+1) | SUV (6+1)
// ========================================

let currentSchedule = null;
let selectedSeats   = [];

function initSeatsPage() {
  const params = getQueryParams();
  if (!params.id) { showToast('Invalid schedule','error'); navigateTo('timings.html'); return; }
  loadSchedule(params.id);
}

async function loadSchedule(id) {
  showLoading();
  currentSchedule = await getScheduleById(id);
  hideLoading();
  if (!currentSchedule) { showToast('Schedule not found','error'); navigateTo('timings.html'); return; }
  displayScheduleInfo();
  buildCabUI();
  updateSummary();
}

function displayScheduleInfo() {
  const info = document.getElementById('schedule-info');
  if (info) info.innerHTML =
    '<h1 class="page-title" style="font-size:1.5rem;font-weight:700;color:#1e293b;margin-bottom:.25rem;">Select Your Seat</h1>' +
    '<p style="color:#64748b;font-size:.9rem;">' + currentSchedule.busName + ' &bull; ' + currentSchedule.type + '</p>';

  const jd = document.getElementById('journey-details');
  if (jd) jd.innerHTML =
    '<h3 class="summary-title" style="font-size:1rem;font-weight:700;margin-bottom:1rem;color:#1e293b;">Journey Details</h3>' +
    '<div style="display:flex;flex-direction:column;gap:.75rem;">' +
    '<div><div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;margin-bottom:.2rem;">Route</div><div style="font-weight:600;color:#1e293b;">' + currentSchedule.origin + ' → ' + currentSchedule.destination + '</div></div>' +
    '<div><div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;margin-bottom:.2rem;">Departure</div><div style="font-weight:600;color:#1e293b;">' + formatDate(currentSchedule.departureTime) + ' at ' + formatTime(currentSchedule.departureTime) + '</div></div>' +
    '<div><div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;margin-bottom:.2rem;">Cab Type</div><div style="font-weight:600;color:#1e293b;">' + currentSchedule.type + '</div></div>' +
    '</div>';
}

function injectStyles() {
  if (document.getElementById('taxi-seat-css')) return;
  const el = document.createElement('style');
  el.id = 'taxi-seat-css';
  el.textContent = `
    .tx-cab {
      max-width:340px;width:100%;margin:0 auto;
      background:#f8fafc;border:2px solid #e2e8f0;border-radius:20px;
      padding:1.25rem 1.25rem 1.5rem;box-sizing:border-box;
      position:relative;
    }
    /* car shape top */
    .tx-cab::before {
      content:'';position:absolute;top:-14px;left:50%;transform:translateX(-50%);
      width:55%;height:14px;background:#e2e8f0;border-radius:12px 12px 0 0;
    }
    .tx-driver-row {
      display:flex;align-items:center;justify-content:space-between;
      background:linear-gradient(135deg,#1e293b,#334155);
      border-radius:12px;padding:.6rem 1rem;margin-bottom:1rem;
    }
    .tx-driver-label {
      display:flex;align-items:center;gap:.5rem;
      color:#fff;font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;
    }
    .tx-steering { font-size:1.3rem; }
    .tx-windshield {
      text-align:center;padding:.45rem;
      background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.2);
      border-radius:8px;font-size:.65rem;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;
    }
    .tx-separator {
      border:none;border-top:2px dashed #cbd5e1;margin:.9rem 0;
    }
    .tx-row {
      display:flex;align-items:stretch;justify-content:center;gap:8px;margin-bottom:8px;
    }
    .tx-seat {
      flex:1;max-width:88px;min-height:72px;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
      border:2px solid #cbd5e1;border-radius:12px;background:#fff;
      cursor:pointer;transition:all .18s;padding:6px 4px;box-sizing:border-box;
      position:relative;
    }
    .tx-seat:hover:not(:disabled) { border-color:#f59e0b;background:#fffbeb;transform:translateY(-2px);box-shadow:0 4px 12px rgba(245,158,11,.25); }
    .tx-seat:disabled { cursor:not-allowed;opacity:.5; }
    .tx-seat.front-seat { background:#f0f9ff;border-color:#7dd3fc; }
    .tx-seat.front-seat:hover:not(:disabled) { border-color:#0ea5e9;background:#e0f2fe; }
    .tx-seat.selected { background:linear-gradient(135deg,#f59e0b,#d97706)!important;border-color:transparent!important;box-shadow:0 4px 16px rgba(245,158,11,.5); }
    .tx-seat.selected .sn,.tx-seat.selected .sp,.tx-seat.selected .si { color:rgba(255,255,255,.95)!important; }
    .tx-seat.booked { background:#f1f5f9!important;border-color:#e2e8f0!important;opacity:.55; }
    .tx-seat.driver-seat { background:linear-gradient(135deg,#1e293b,#334155);border-color:transparent;cursor:default; }
    .tx-seat .sn { font-size:.65rem;font-weight:800;color:#1e293b;line-height:1; }
    .tx-seat .si { font-size:1.3rem;line-height:1; }
    .tx-seat .sp { font-size:.58rem;color:#64748b;line-height:1; }
    .tx-legend { display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.25rem;font-size:.75rem;color:#64748b; }
    .tx-legend-item { display:flex;align-items:center;gap:.4rem; }
    .tx-swatch { width:14px;height:14px;border-radius:4px;border:2px solid; }
    .tx-aisle { width:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:.6rem; }
    .seat-label-bar { text-align:center;font-size:.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem; }
    @media(max-width:400px){ .tx-seat{max-width:72px;min-height:64px;} }
  `;
  document.head.appendChild(el);
}

function buildCabUI() {
  injectStyles();
  const old = document.getElementById('tx-wrapper');
  if (old) old.remove();

  const anchor = document.getElementById('upper-deck') || document.getElementById('lower-deck');
  const parent = anchor ? anchor.parentNode : document.body;
  [document.getElementById('upper-deck'),document.getElementById('lower-deck')].forEach(function(el){ if(el) el.style.display='none'; });

  const wrap = document.createElement('div');
  wrap.id = 'tx-wrapper';

  const cabType = currentSchedule.type || CAB_TYPE_SEDAN;
  const isSUV   = cabType === 'SUV (6+1)';
  const booked  = currentSchedule.bookedSeats || [];

  // Legend
  var legendHTML =
    '<div class="tx-legend">' +
      '<div class="tx-legend-item"><div class="tx-swatch" style="background:#f0f9ff;border-color:#7dd3fc;"></div>Front</div>' +
      '<div class="tx-legend-item"><div class="tx-swatch" style="background:#fff;border-color:#cbd5e1;"></div>Rear</div>' +
      '<div class="tx-legend-item"><div class="tx-swatch" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent;"></div>Selected</div>' +
      '<div class="tx-legend-item"><div class="tx-swatch" style="background:#f1f5f9;border-color:#e2e8f0;opacity:.55;"></div>Booked</div>' +
    '</div>';

  // Build cab HTML
  var cabHTML = '<div class="tx-cab">';

  // Driver row (top = front of car)
  cabHTML +=
    '<div class="tx-driver-row">' +
      '<div class="tx-driver-label"><span class="tx-steering">🎮</span> DRIVER</div>' +
      seatBtn('F1', false, booked) +
    '</div>';

  // Windshield divider label
  cabHTML += '<div class="tx-windshield">— Passenger Cabin —</div>';
  cabHTML += '<hr class="tx-separator">';

  // Rear row 1 (R1 R2 R3)
  cabHTML += '<div class="seat-label-bar">' + (isSUV ? 'Middle Row' : 'Rear Seats') + '</div>';
  cabHTML += '<div class="tx-row">' +
    seatBtn('R1', true, booked) +
    '<div class="tx-aisle">|</div>' +
    seatBtn('R2', true, booked) +
    seatBtn('R3', true, booked) +
  '</div>';

  if (isSUV) {
    cabHTML += '<hr class="tx-separator">';
    cabHTML += '<div class="seat-label-bar">Back Row</div>';
    cabHTML += '<div class="tx-row">' +
      '<div class="tx-aisle"></div>' +
      seatBtn('R4', true, booked) +
      '<div class="tx-aisle">|</div>' +
      seatBtn('R5', true, booked) +
      '<div class="tx-aisle"></div>' +
    '</div>';
  }

  cabHTML += '</div>'; // end .tx-cab

  wrap.innerHTML = legendHTML + cabHTML;
  parent.insertBefore(wrap, anchor);
}

function seatBtn(seatId, isRear, bookedSeats) {
  var isBooked   = bookedSeats && bookedSeats.includes(seatId);
  var isSel      = selectedSeats.includes(seatId);
  var isFront    = seatId === 'F1';
  var price      = calculateSeatPriceForRoute(currentSchedule.origin, currentSchedule.destination, seatId);

  var cls = 'tx-seat';
  if (!isRear && isFront) cls += ' front-seat';
  if (isRear)  cls += ' rear-seat';
  if (isSel)   cls += ' selected';
  if (isBooked) cls += ' booked';

  var icon  = isFront ? '🪑' : '💺';
  var label = isFront ? 'Front' : 'Rear';
  var priceHTML = isBooked
    ? '<span class="sp" style="color:#ef4444;font-size:.55rem;">Booked</span>'
    : '<span class="sp">₹' + price + '</span>';

  return '<button class="' + cls + '" ' +
    (isBooked ? 'disabled' : 'onclick="toggleSeat(\'' + seatId + '\')"') +
    ' title="' + seatId + ' (' + label + ') - ₹' + price + '">' +
    '<span class="sn">' + seatId + '</span>' +
    '<span class="si">' + icon + '</span>' +
    priceHTML +
    '</button>';
}

function toggleSeat(seatId) {
  if (currentSchedule.bookedSeats && currentSchedule.bookedSeats.includes(seatId)) return;
  var idx = selectedSeats.indexOf(seatId);
  if (idx > -1) {
    selectedSeats.splice(idx, 1);
  } else {
    var max = currentSchedule.type === 'SUV (6+1)' ? 6 : 4;
    if (selectedSeats.length >= max) { showToast('Maximum ' + max + ' seats allowed','warning'); return; }
    selectedSeats.push(seatId);
  }
  buildCabUI();
  updateSummary();
}

function updateSummary() {
  var el = document.getElementById('booking-summary');
  if (!el) return;

  if (selectedSeats.length === 0) {
    el.innerHTML =
      '<div style="text-align:center;padding:1.5rem;color:#94a3b8;">' +
        '<div style="font-size:2.5rem;margin-bottom:.75rem;">🚖</div>' +
        '<p style="font-weight:500;color:#64748b;">No seats selected</p>' +
        '<p style="font-size:.8rem;">Click on a seat in the cab layout to select it</p>' +
      '</div>';
    return;
  }

  var total = 0;
  var rows = selectedSeats.map(function(sid) {
    var price = calculateSeatPriceForRoute(currentSchedule.origin, currentSchedule.destination, sid);
    total += price;
    var label = sid === 'F1' ? 'Front' : 'Rear';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;background:#f8fafc;border-radius:.5rem;margin-bottom:.4rem;">' +
      '<div style="display:flex;align-items:center;gap:.5rem;">' +
        '<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:999px;">' + sid + '</span>' +
        '<span style="font-size:.8rem;color:#64748b;">' + label + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:.75rem;">' +
        '<span style="font-weight:700;color:#1e293b;">₹' + price + '</span>' +
        '<button onclick="toggleSeat(\'' + sid + '\')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:1rem;line-height:1;" title="Remove">&times;</button>' +
      '</div>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<h4 style="font-size:.9rem;font-weight:700;margin-bottom:.75rem;color:#1e293b;">Selected Seats</h4>' +
    rows +
    '<div style="border-top:1px solid #e2e8f0;margin:1rem 0;"></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
      '<span style="font-weight:600;color:#475569;">Total Amount</span>' +
      '<span style="font-size:1.25rem;font-weight:800;color:#f59e0b;">₹' + total.toLocaleString('en-IN') + '</span>' +
    '</div>' +
    '<button style="width:100%;padding:.85rem;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:.75rem;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(245,158,11,.4);transition:transform .15s;" onclick="proceedToPayment()" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">' +
      '🚀 Proceed to Payment →' +
    '</button>';
}

function proceedToPayment() {
  if (selectedSeats.length === 0) { showToast('Please select at least one seat','warning'); return; }
  var total = 0;
  selectedSeats.forEach(function(sid) {
    total += calculateSeatPriceForRoute(currentSchedule.origin, currentSchedule.destination, sid);
  });
  navigateTo('payment.html', {
    scheduleId:  currentSchedule.id,
    seats:       selectedSeats.join(','),
    totalAmount: total
  });
}

document.addEventListener('DOMContentLoaded', initSeatsPage);
