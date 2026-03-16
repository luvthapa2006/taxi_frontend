// ========================================
// PAYMENT.JS  –  Cashfree Payment Gateway
// Uses Cashfree JS SDK (drop-in checkout)
// ========================================

let bookingDetails   = null;
let confirmedBooking = null;
let appliedCoupon    = null;  // { code, discount, finalAmount }

// ----------------------------------------
// Coupon application
// ----------------------------------------
async function applyCoupon() {
  const code = document.getElementById('coupon-input')?.value?.trim()?.toUpperCase();
  const resultEl = document.getElementById('coupon-result');
  if (!code) { if (resultEl) resultEl.innerHTML = '<div class="coupon-error">Please enter a coupon code</div>'; return; }

  const applyBtn = document.getElementById('apply-coupon-btn');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Checking…'; }

  const result = await validateCoupon(code, bookingDetails.totalAmount);

  if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; }

  if (result.valid) {
    appliedCoupon = result;
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="coupon-success">
          ✅ Coupon <strong>${result.code}</strong> applied!
          <span style="float:right;cursor:pointer;color:#6b7280;" onclick="removeCoupon()">✕ Remove</span>
        </div>`;
    }
    updateTotalWithDiscount(result);
    showToast(`Coupon applied! 🎉`, 'success');
  } else {
    appliedCoupon = null;
    if (resultEl) resultEl.innerHTML = `<div class="coupon-error">❌ ${result.message || 'Invalid coupon'}</div>`;
  }
}

function removeCoupon() {
  appliedCoupon = null;
  const resultEl = document.getElementById('coupon-result');
  if (resultEl) resultEl.innerHTML = '';
  const input = document.getElementById('coupon-input');
  if (input) input.value = '';
  // Restore original total in summary
  const totalEl = document.querySelector('.total-amount');
  if (totalEl) totalEl.textContent = formatCurrency(bookingDetails.totalAmount);
  const discountRow = document.getElementById('discount-row');
  if (discountRow) discountRow.remove();
}

function updateTotalWithDiscount(couponResult) {
  const summarySection = document.getElementById('booking-summary-section');
  if (!summarySection) return;

  // Find or update total amount display
  const totalEl = summarySection.querySelector('.total-amount');
  if (!totalEl) return;

  const originalAmount = bookingDetails.totalAmount;
  const discount = couponResult.discount;
  const finalAmount = couponResult.finalAmount;

  // Remove old discount row if any
  const oldRow = document.getElementById('discount-row');
  if (oldRow) oldRow.remove();

  // Animate original price strike-through
  totalEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.3rem;">
      <div class="price-strike-wrap" style="color:#9ca3af;font-size:0.9rem;">
        <span>${formatCurrency(originalAmount)}</span>
        <div class="price-strike-line"></div>
      </div>
      <div style="color:#10b981;font-size:1.3rem;font-weight:800;">${formatCurrency(finalAmount)}</div>
      <div class="savings-badge">🎉 Hurray! You saved ${formatCurrency(discount)}</div>
    </div>`;

  // Update pay button text
  const payBtn = document.getElementById('pay-btn');
  if (payBtn) payBtn.textContent = `Pay ${formatCurrency(finalAmount)} →`;
}

// ----------------------------------------
// Page init
// ----------------------------------------
async function initPaymentPage() {
  const params = getQueryParams();

  // Returning from Cashfree redirect → verify payment
  if (params.order_id && params.booking_token) {
    await verifyAndShowResult(params.order_id, params.booking_token);
    return;
  }

  // Normal entry from seats page
  if (!params.scheduleId || !params.seats || !params.totalAmount) {
    showToast('Invalid booking details', 'error');
    navigateTo('index.html');
    return;
  }

  bookingDetails = {
    scheduleId:  params.scheduleId,
    seatNumbers: params.seats.split(','),
    totalAmount: parseInt(params.totalAmount)
  };

  showLoading();
  const schedule = await getScheduleById(bookingDetails.scheduleId);
  hideLoading();

  if (!schedule) {
    showToast('Schedule not found', 'error');
    navigateTo('timings.html');
    return;
  }

  displayBookingSummary(schedule);
  setupPaymentForm();
}

// ----------------------------------------
// Verify payment after redirect return
// ----------------------------------------
async function verifyAndShowResult(orderId, bookingToken) {
  // Hide form, show confirmation area
  const formContainer         = document.getElementById('payment-form-container');
  const confirmationContainer = document.getElementById('confirmation-container');
  if (formContainer)         formContainer.style.display         = 'none';
  if (confirmationContainer) confirmationContainer.style.display = 'block';

  confirmationContainer.innerHTML = `
    <div style="text-align:center;padding:3rem;">
      <div class="spinner" style="margin:0 auto 1rem;"></div>
      <p>Verifying your payment, please wait…</p>
    </div>`;

  try {
    showLoading();
    const res = await fetch(`${API_BASE_URL}/cashfree/verify-payment`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orderId, bookingToken })
    });
    hideLoading();

    const result = await res.json();

    if (result.success && result.status === 'PAID') {
      confirmedBooking = result.booking;
      showConfirmationScreen(result.booking);
    } else {
      showPaymentFailed(result.message || 'Payment was not completed.');
    }
  } catch (err) {
    hideLoading();
    console.error('Verification error:', err);
    showPaymentFailed('Could not verify payment. Please contact support.');
  }
}

// ----------------------------------------
// Display booking summary (right-hand card)
// ----------------------------------------
function displayBookingSummary(schedule) {
  const summarySection = document.getElementById('booking-summary-section');
  if (!summarySection) return;

  summarySection.innerHTML = `
    <div class="summary-card">
      <h3 class="summary-title">Booking Summary</h3>

      <div class="summary-details">
        <div class="detail-row">
          <span class="detail-label">Cab</span>
          <span class="detail-value">${schedule.cabName}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Route</span>
          <span class="detail-value">${schedule.origin} → ${schedule.destination}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Departure</span>
          <span class="detail-value">${formatDate(schedule.departureTime)} at ${formatTime(schedule.departureTime)}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Selected Seats</span>
          <span class="detail-value">
            ${bookingDetails.seatNumbers.map(s => `<span class="seat-badge">${s}</span>`).join(' ')}
          </span>
        </div>

        <div class="detail-row breakdown">
          <span class="detail-label">Seat Breakdown</span>
          <div class="breakdown-items">
            ${bookingDetails.seatNumbers.map(seat => {
              const price = calculateSeatPriceForRoute(schedule.origin, schedule.destination, seat);
              return `<div class="breakdown-item"><span>${seat}</span><span>${formatCurrency(price)}</span></div>`;
            }).join('')}
          </div>
        </div>

        <div class="summary-divider"></div>

        <div class="detail-row total">
          <span class="detail-label">Total Amount</span>
          <span class="detail-value total-amount" id="total-amount-display">${formatCurrency(bookingDetails.totalAmount)}</span>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------
// Wire up the passenger-details form
// ----------------------------------------
function setupPaymentForm() {
  const form = document.getElementById('payment-form');
  if (!form) return;

  form.addEventListener('submit', handlePaymentSubmit);

  // Numeric-only phone input
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10);
    });
  }
}

// ----------------------------------------
// Form submit → call backend → open Cashfree
// ----------------------------------------
async function handlePaymentSubmit(e) {
  e.preventDefault();

  if (!validateForm('payment-form')) return;

  const payload = {
    customerName: document.getElementById('name').value.trim(),
    email:        document.getElementById('email').value.trim(),
    phone:        document.getElementById('phone').value.trim(),
    ...bookingDetails,
    // Use discounted total if coupon applied
    totalAmount:  appliedCoupon ? appliedCoupon.finalAmount : bookingDetails.totalAmount,
    couponCode:   appliedCoupon ? appliedCoupon.code : null
  };

  showLoading();

  try {
    const res = await fetch(`${API_BASE_URL}/cashfree/create-order`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    const result = await res.json();
    hideLoading();

    if (!result.success) {
      showToast(result.message || 'Could not create order. Try again.', 'error');

      // Seats snatched? Send user back to pick different ones
      if (result.unavailableSeats) {
        showToast(`Seats ${result.unavailableSeats.join(', ')} are no longer available.`, 'error');
        setTimeout(() => navigateTo('seats.html', { id: payload.scheduleId }), 2000);
      }
      return;
    }

    const { paymentSessionId, orderId, bookingToken, env } = result.data;
    console.log('✅ Order created:', orderId, '| token:', bookingToken);

    // Record coupon usage
    if (appliedCoupon?.code) {
      await useCoupon(appliedCoupon.code);
    }

    // Store so we can retrieve on return
    sessionStorage.setItem('pendingBookingToken', bookingToken);
    sessionStorage.setItem('pendingOrderId', orderId);

    // Open Cashfree checkout
    openCashfreeCheckout(paymentSessionId, orderId, bookingToken, env);

  } catch (err) {
    console.error('❌ Create-order error:', err);
    hideLoading();
    showToast('Payment initiation failed. Please try again.', 'error');
  }
}

// ----------------------------------------
// Launch Cashfree Drop-in / Redirect
// ----------------------------------------
function openCashfreeCheckout(paymentSessionId, orderId, bookingToken, env) {
  // Check if Cashfree SDK is loaded
  if (typeof Cashfree === 'undefined') {
    console.warn('Cashfree SDK not loaded, falling back to redirect.');
    cashfreeFallbackRedirect(paymentSessionId, orderId, bookingToken, env);
    return;
  }

  const frontendUrl = window.location.origin;
  const returnUrl   = `${frontendUrl}/payment.html?order_id=${orderId}&booking_token=${bookingToken}`;

  const cashfree = Cashfree({
    mode: env === 'PROD' ? 'production' : 'sandbox'
  });

  cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_self',
    returnUrl
  }).then(result => {
    if (result.error) {
      console.error('Cashfree checkout error:', result.error);
      showToast('Payment failed: ' + result.error.message, 'error');
    }
    // On success the SDK redirects automatically via returnUrl
  });
}

// ----------------------------------------
// Fallback: redirect to Cashfree hosted page
// ----------------------------------------
function cashfreeFallbackRedirect(paymentSessionId, orderId, bookingToken, env) {
  const baseUrl   = env === 'PROD'
    ? 'https://payments.cashfree.com'
    : 'https://payments-test.cashfree.com';

  const frontendUrl = window.location.origin;
  const returnUrl   = encodeURIComponent(`${frontendUrl}/payment.html?order_id=${orderId}&booking_token=${bookingToken}`);

  showToast('Redirecting to payment gateway…', 'info');
  setTimeout(() => {
    window.location.href = `${baseUrl}/order/#${paymentSessionId}`;
  }, 500);
}

// ----------------------------------------
// Success screen
// ----------------------------------------
function showConfirmationScreen(booking) {
  const formContainer         = document.getElementById('payment-form-container');
  const confirmationContainer = document.getElementById('confirmation-container');
  if (formContainer)         formContainer.style.display         = 'none';
  if (confirmationContainer) confirmationContainer.style.display = 'block';

  const schedule = booking.scheduleId;

  confirmationContainer.innerHTML = `
    <div class="confirmation-success" style="text-align:center;margin-bottom:2rem;">
      <div class="success-icon" style="font-size:4rem;color:#10b981;margin-bottom:1rem;">✓</div>
      <h2 style="font-size:1.75rem;font-weight:700;color:#065f46;margin-bottom:0.5rem;">Booking Confirmed!</h2>
      <p style="color:#047857;">Your payment was successful and seats are reserved.</p>
    </div>

    <div class="ticket-card" style="background:white;border:1px solid #a7f3d0;border-radius:1rem;padding:2rem;margin-bottom:2rem;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;font-size:0.9rem;">

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Booking Token</span>
          <span style="font-weight:700;font-size:1.1rem;color:#1f2937;" id="booking-token-display">${booking.bookingToken}</span>
          <button onclick="copyToClipboard('${booking.bookingToken}')" style="margin-left:0.5rem;background:none;border:none;cursor:pointer;color:#667eea;" title="Copy">📋</button>
        </div>

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Passenger</span>
          <span style="font-weight:600;">${booking.customerName}</span>
        </div>

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Seats</span>
          <span style="font-weight:600;">${booking.seatNumbers.join(', ')}</span>
        </div>

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Amount Paid</span>
          <span style="font-weight:700;color:#10b981;font-size:1.1rem;">${formatCurrency(booking.totalAmount)}</span>
        </div>

        ${schedule ? `
        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Cab</span>
          <span style="font-weight:600;">${schedule.cabName}</span>
        </div>

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Route</span>
          <span style="font-weight:600;">${schedule.origin} → ${schedule.destination}</span>
        </div>

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Departure</span>
          <span style="font-weight:600;">${formatDate(schedule.departureTime)} at ${formatTime(schedule.departureTime)}</span>
        </div>
        ` : ''}

        <div>
          <span style="display:block;color:#6b7280;font-size:0.75rem;text-transform:uppercase;margin-bottom:0.25rem;">Contact</span>
          <span style="font-weight:600;">${booking.phone}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print Ticket</button>
      <button class="btn btn-outline" onclick="navigateTo('index.html')">Back to Home</button>
    </div>
  `;

  showToast('Booking confirmed! 🎉', 'success');
}

// ----------------------------------------
// Failure screen
// ----------------------------------------
function showPaymentFailed(reason) {
  const formContainer         = document.getElementById('payment-form-container');
  const confirmationContainer = document.getElementById('confirmation-container');
  if (formContainer)         formContainer.style.display         = 'none';
  if (confirmationContainer) confirmationContainer.style.display = 'block';

  confirmationContainer.innerHTML = `
    <div style="background:#fee2e2;border:2px solid #ef4444;border-radius:1rem;padding:2rem;text-align:center;max-width:500px;margin:0 auto;">
      <div style="font-size:4rem;color:#dc2626;margin-bottom:1rem;">✗</div>
      <h2 style="color:#991b1b;font-size:1.75rem;margin-bottom:0.5rem;">Payment Failed</h2>
      <p style="color:#7f1d1d;margin-bottom:1.5rem;">${reason}</p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="history.back()">Try Again</button>
        <button class="btn btn-outline" onclick="navigateTo('index.html')">Go to Home</button>
      </div>
    </div>
  `;

  showToast('Payment failed', 'error');
}

// ----------------------------------------
// Boot
// ----------------------------------------
document.addEventListener('DOMContentLoaded', initPaymentPage);

// Print styles for ticket
window.addEventListener('beforeprint', () => {
  document.body.classList.add('printing');
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
});