// ========================================
// DATA.JS - Taxi Booking API Integration
// Cab Types: Sedan (4+1) | SUV (6+1)
// ========================================

const API_BASE_URL = 'https://srt-backend-a5m9.onrender.com/api';

const CAB_TYPE_SEDAN = 'Sedan (4+1)';
const CAB_TYPE_SUV   = 'SUV (6+1)';

function getTotalSeats(cabType) {
  if (cabType === CAB_TYPE_SEDAN) return 4;
  if (cabType === CAB_TYPE_SUV)   return 6;
  return 4;
}

function getSeatIds(cabType) {
  if (cabType === CAB_TYPE_SEDAN) return { lower: ['F1','R1','R2','R3'], upper: [] };
  if (cabType === CAB_TYPE_SUV)   return { lower: ['F1','R1','R2','R3','R4','R5'], upper: [] };
  return { lower: ['F1','R1','R2','R3'], upper: [] };
}

function getSeatInfo(seatId) {
  return {
    isFront: seatId === 'F1',
    isRear:  seatId !== 'F1',
    deck: 'L', zone: seatId === 'F1' ? 'front' : 'rear'
  };
}

// ── Pricing ──
const defaultPricing = { frontPrice: 600, rearPrice: 500, perSeat: {} };

function getRouteKey(origin, destination) {
  return `${origin.trim().toLowerCase()}-${destination.trim().toLowerCase()}`;
}

function getRoutePricing(origin, destination) {
  const key = getRouteKey(origin, destination);
  try {
    const stored = localStorage.getItem('routePricing_taxi_v1');
    if (stored) { const all = JSON.parse(stored); if (all[key]) return all[key]; }
  } catch(e) {}
  return { ...defaultPricing, perSeat: {} };
}

function setRoutePricing(origin, destination, pricing) {
  const key = getRouteKey(origin, destination);
  try {
    let all = {};
    const stored = localStorage.getItem('routePricing_taxi_v1');
    if (stored) all = JSON.parse(stored);
    all[key] = {
      frontPrice:  parseInt(pricing.frontPrice)||600,
      rearPrice:   parseInt(pricing.rearPrice)||500,
      perSeat:     pricing.perSeat||{},
      routeName:   `${origin} → ${destination}`,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('routePricing_taxi_v1', JSON.stringify(all));
    return true;
  } catch(e) { return false; }
}

function getAllRoutePricing() {
  try { const s = localStorage.getItem('routePricing_taxi_v1'); return s ? JSON.parse(s) : {}; }
  catch(e) { return {}; }
}

function deleteRoutePricing(origin, destination) {
  const key = getRouteKey(origin, destination);
  try {
    const s = localStorage.getItem('routePricing_taxi_v1');
    if (s) { const all = JSON.parse(s); delete all[key]; localStorage.setItem('routePricing_taxi_v1', JSON.stringify(all)); }
    return true;
  } catch(e) { return false; }
}

function calculateSeatPriceForRoute(origin, destination, seatId) {
  const pricing = getRoutePricing(origin, destination);
  if (pricing.perSeat && pricing.perSeat[seatId] !== undefined) return parseInt(pricing.perSeat[seatId]);
  return seatId === 'F1' ? (pricing.frontPrice||600) : (pricing.rearPrice||500);
}

function getSeatPricing()          { return { frontPrice:600, rearPrice:500 }; }
function updateSeatPricing()       { return true; }
function resetSeatPricing()        { return true; }
function calculateSeatPrice(bp,s)  { return bp; }

// ── API ──
async function getSchedules(filters = {}) {
  try {
    const q = new URLSearchParams();
    if (filters.origin)      q.append('origin',      filters.origin);
    if (filters.destination) q.append('destination', filters.destination);
    if (filters.date)        q.append('date',        filters.date);
    const res = await fetch(`${API_BASE_URL}/schedules?${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const schedules = await res.json();
    return schedules.map(s => ({ ...s, id: s._id||s.id, bookedSeats: s.bookedSeats||[] }));
  } catch(e) { console.error(e); showToast('Failed to load cab schedules.','error'); return []; }
}

async function getOriginCities() {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/origins`);
    if (!res.ok) throw new Error('Failed');
    return (await res.json()).cities || [];
  } catch(e) { return []; }
}

async function getDestinationCities() {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/destinations`);
    if (!res.ok) throw new Error('Failed');
    return (await res.json()).cities || [];
  } catch(e) { return []; }
}

async function getAllCities() {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/cities`);
    if (!res.ok) throw new Error('Failed');
    return (await res.json()).cities || [];
  } catch(e) { return []; }
}

async function getAllRoutes() {
  try {
    const schedules = await getSchedules();
    const seen = new Set();
    return schedules.reduce((acc, s) => {
      const key = getRouteKey(s.origin, s.destination);
      if (!seen.has(key)) { seen.add(key); acc.push({ key, origin:s.origin, destination:s.destination, display:`${s.origin} → ${s.destination}` }); }
      return acc;
    }, []);
  } catch(e) { return []; }
}

async function getScheduleById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/${id}`);
    if (!res.ok) throw new Error('Not found');
    const s = await res.json();
    return { ...s, id: s._id||s.id, bookedSeats: s.bookedSeats||[] };
  } catch(e) { showToast('Failed to load schedule.','error'); return null; }
}

async function addSchedule(data) {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    const s = await res.json();
    return { ...s, id: s._id||s.id, bookedSeats: s.bookedSeats||[] };
  } catch(e) { showToast(e.message,'error'); return null; }
}

async function updateSchedule(id, updates) {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updates) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    const s = await res.json();
    return { ...s, id: s._id||s.id, bookedSeats: s.bookedSeats||[] };
  } catch(e) { showToast(e.message,'error'); return null; }
}

async function deleteSchedule(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/${id}`, { method:'DELETE' });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return true;
  } catch(e) { showToast(e.message,'error'); return false; }
}

async function createBooking(data) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) return { error: result.message||'Failed', unavailableSeats: result.unavailableSeats };
    return { ...result, id: result._id||result.id, bookingToken: result.bookingToken };
  } catch(e) { return { error:'Failed to create booking.' }; }
}

async function getBookingByToken(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${token}`);
    if (!res.ok) return null;
    const b = await res.json();
    return { ...b, id: b._id||b.id };
  } catch(e) { return null; }
}

async function getAllBookings() {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings`);
    if (!res.ok) throw new Error('Failed');
    return (await res.json()).map(b => ({ ...b, id: b._id||b.id }));
  } catch(e) { return []; }
}

async function cancelBooking(token) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${token}/cancel`, { method:'PUT', headers:{'Content-Type':'application/json'} });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    return true;
  } catch(e) { showToast(e.message,'error'); return false; }
}

async function getBookingStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/stats/revenue`);
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch(e) { return { totalRevenue:0, totalBookings:0 }; }
}

const TOTAL_SEATS = 6;
const SEATS_PER_DECK = 6;
function generateAllSeats() { return ['F1','R1','R2','R3','R4','R5']; }
const ALL_SEATS = generateAllSeats();
let cachedSchedules = [];
async function loadAndCacheSchedules(f={}) { cachedSchedules = await getSchedules(f); return cachedSchedules; }

console.log('✅ Data.js (Taxi v1) — Sedan(4+1) + SUV(6+1)');

// ── Coupons ──
async function validateCoupon(code, totalAmount) {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons/validate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code,totalAmount}) });
    return await res.json();
  } catch(e) { return { error:'Failed to validate coupon' }; }
}
async function useCoupon(code) {
  try { await fetch(`${API_BASE_URL}/coupons/use`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code}) }); } catch(e) {}
}
async function getAllCoupons() {
  try { const res = await fetch(`${API_BASE_URL}/coupons`); if (!res.ok) throw new Error('Failed'); return await res.json(); }
  catch(e) { return []; }
}
async function createCoupon(data) {
  try {
    const res = await fetch(`${API_BASE_URL}/coupons`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message);
    return result;
  } catch(e) { showToast(e.message,'error'); return null; }
}
async function deleteCoupon(id) {
  try { const res = await fetch(`${API_BASE_URL}/coupons/${id}`, {method:'DELETE'}); if (!res.ok) throw new Error('Failed'); return true; }
  catch(e) { showToast('Failed to delete coupon','error'); return false; }
}
async function toggleScheduleActive(id) {
  try { const res = await fetch(`${API_BASE_URL}/schedules/${id}/toggle-active`, {method:'PATCH'}); if (!res.ok) throw new Error('Failed'); return await res.json(); }
  catch(e) { showToast('Failed to toggle status','error'); return null; }
}
