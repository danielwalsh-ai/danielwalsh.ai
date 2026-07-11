
/* ════ AUTH ════ */
let loginAttempts = 0;
const MAX_ATTEMPTS = 5;

function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pw = document.getElementById('login-pw').value;
  if (user === 'daniel' && pw === 'admin123') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('portal').classList.add('visible');
    initPortal();
  } else {
    loginAttempts++;
    document.getElementById('login-error').classList.add('show');
    document.getElementById('login-pw').value = '';
    if (loginAttempts >= MAX_ATTEMPTS) {
      document.getElementById('attempt-counter').textContent = 'Too many failed attempts. Please wait.';
      document.querySelector('.login-btn').disabled = true;
      setTimeout(() => {
        loginAttempts = 0;
        document.querySelector('.login-btn').disabled = false;
        document.getElementById('attempt-counter').textContent = '';
      }, 30000);
    } else {
      document.getElementById('attempt-counter').textContent = `${MAX_ATTEMPTS - loginAttempts} attempt${MAX_ATTEMPTS - loginAttempts === 1 ? '' : 's'} remaining`;
    }
  }
}
function doLogout() {
  document.getElementById('portal').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-user').value = '';
  document.getElementById('login-error').classList.remove('show');
  document.getElementById('attempt-counter').textContent = '';
}

/* ════ NAVIGATION ════ */
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
  const titles = { dashboard: 'Dashboard', calendar: 'Availability', bookings: 'Bookings', settings: 'Settings' };
  document.getElementById('page-title').textContent = titles[id];
}

/* ════ CLOCK ════ */
function updateClock() {
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);

/* ════ DATA ════ */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const today = new Date(2026, 5, 21);
let viewMonth = 5, viewYear = 2026;
let selectedDate = null;

const unavailWeekdays = [0, 6];
const bookedDates = { '2026-06-22': ['09:00'], '2026-06-23': ['09:00','10:30'], '2026-06-29': ['09:00'], '2026-06-30': ['11:00'] };
const hourAvailability = {};
const ALL_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];

const BOOKINGS = [
  { name:'Sarah Mitchell', email:'s.mitchell@techcorp.com', date:'Mon 22 Jun · 09:00', dateKey:'2026-06-22', service:'Strategy & Advisory', value:1200, status:'confirmed' },
  { name:'James Thornton', email:'james@thornton.io', date:'Tue 23 Jun · 09:00', dateKey:'2026-06-23', service:'AI Implementation', value:3500, status:'confirmed' },
  { name:'Emma Clarke', email:'emma.clarke@ventures.co', date:'Tue 23 Jun · 10:30', dateKey:'2026-06-23', service:'Training & Workshops', value:950, status:'pending' },
  { name:'Michael Okafor', email:'m.okafor@globalco.com', date:'Mon 29 Jun · 09:00', dateKey:'2026-06-29', service:'Fractional AI Officer', value:4500, status:'confirmed' },
  { name:'Laura Benson', email:'laura@benson-partners.com', date:'Tue 30 Jun · 11:00', dateKey:'2026-06-30', service:'Strategy & Advisory', value:1200, status:'completed' },
];

function dateKey(y, m, d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

/* ════ CALENDAR ════ */
function renderCalendar() {
  document.getElementById('cal-month-label').textContent = MONTHS[viewMonth] + ' ' + viewYear;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const first = new Date(viewYear, viewMonth, 1).getDay();
  const offset = first === 0 ? 6 : first - 1;
  const days = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('button'); el.className = 'cal-day empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= days; d++) {
    const el = document.createElement('button'); el.className = 'cal-day';
    el.textContent = d;
    const key = dateKey(viewYear, viewMonth, d);
    const dow = new Date(viewYear, viewMonth, d).getDay();
    const isToday = (d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear());
    if (isToday) el.classList.add('today');
    if (unavailWeekdays.includes(dow)) el.classList.add('weekend');
    if (bookedDates[key]?.length) el.classList.add('has-bookings');
    if (selectedDate === key) el.classList.add('selected');
    el.onclick = () => selectDay(key, d);
    grid.appendChild(el);
  }
}

function changeMonth(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
}

function selectDay(key, d) {
  selectedDate = key;
  renderCalendar();
  const dateObj = new Date(key + 'T12:00:00');
  const isWeekend = unavailWeekdays.includes(dateObj.getDay());
  document.getElementById('day-panel-title').textContent = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('day-placeholder').style.display = 'none';
  document.getElementById('day-actions').style.display = 'flex';
  document.getElementById('hour-list').style.display = 'flex';

  if (!hourAvailability[key]) {
    hourAvailability[key] = {};
    ALL_SLOTS.forEach(s => { hourAvailability[key][s] = !isWeekend; });
  }

  const list = document.getElementById('hour-list');
  list.innerHTML = '';
  const booked = bookedDates[key] || [];

  ALL_SLOTS.forEach(slot => {
    const isBooked = booked.includes(slot);
    const isAvail = hourAvailability[key][slot];
    const row = document.createElement('div');
    row.className = 'hour-row' + (isBooked ? ' booked' : '');

    const timeEl = document.createElement('div'); timeEl.className = 'hour-time'; timeEl.textContent = slot;
    const infoEl = document.createElement('div'); infoEl.className = 'hour-booking';

    if (isBooked) {
      const booking = BOOKINGS.find(b => b.dateKey === key && b.date.includes(slot));
      infoEl.innerHTML = booking ? `<strong>${booking.name}</strong>${booking.service}` : '<strong>Booked</strong>';
    } else {
      infoEl.textContent = isAvail ? 'Available' : 'Blocked';
      infoEl.style.color = isAvail ? 'rgba(34,197,94,0.7)' : 'var(--muted)';
    }

    const toggle = document.createElement('button');
    toggle.className = 'toggle' + (isAvail ? ' on' : '');
    if (isBooked) toggle.disabled = true;
    toggle.onclick = () => {
      hourAvailability[key][slot] = !hourAvailability[key][slot];
      toggle.classList.toggle('on', hourAvailability[key][slot]);
      infoEl.textContent = hourAvailability[key][slot] ? 'Available' : 'Blocked';
      infoEl.style.color = hourAvailability[key][slot] ? 'rgba(34,197,94,0.7)' : 'var(--muted)';
      showToast('Availability updated');
    };

    row.appendChild(timeEl); row.appendChild(infoEl); row.appendChild(toggle);
    list.appendChild(row);
  });
}

function blockAll() {
  if (!selectedDate) return;
  ALL_SLOTS.forEach(s => { if (!bookedDates[selectedDate]?.includes(s)) hourAvailability[selectedDate][s] = false; });
  selectDay(selectedDate);
  showToast('Day blocked');
}
function unblockAll() {
  if (!selectedDate) return;
  ALL_SLOTS.forEach(s => { hourAvailability[selectedDate][s] = true; });
  selectDay(selectedDate);
  showToast('Day opened');
}

/* ════ BOOKINGS ════ */
function renderBookings(filter = 'all') {
  const tbody = document.getElementById('bookings-tbody');
  tbody.innerHTML = '';
  const filtered = filter === 'all' ? BOOKINGS : BOOKINGS.filter(b => b.status === filter);
  filtered.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div style="font-weight:600;font-size:13px;">${b.name}</div><div style="font-size:11px;color:var(--muted);">${b.email}</div></td>
      <td style="color:var(--muted);">${b.date}</td>
      <td>${b.service}</td>
      <td style="color:var(--amber);font-weight:600;">£${b.value.toLocaleString()}</td>
      <td><span class="badge ${b.status}">${b.status}</span></td>
      <td>
        <button class="action-btn" onclick="showToast('Email sent to ${b.name}')">Email</button>
        <button class="action-btn danger" onclick="showToast('Booking cancelled')">Cancel</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterBookings(filter, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBookings(filter);
}

/* ════ DASHBOARD WIDGETS ════ */
function renderDashboard() {
  const upcoming = document.getElementById('upcoming-tbody');
  upcoming.innerHTML = '';
  BOOKINGS.filter(b => b.status !== 'completed').slice(0, 4).forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><div style="font-weight:600;font-size:13px;">${b.name}</div><div style="font-size:11px;color:var(--muted);">${b.service}</div></td><td style="color:var(--muted);font-size:12px;">${b.date}</td><td style="color:var(--amber);font-weight:600;">£${b.value.toLocaleString()}</td>`;
    upcoming.appendChild(tr);
  });

  const feed = document.getElementById('activity-feed');
  const activities = [
    { icon:'🟢', text:'New booking — Sarah Mitchell', time:'2 hrs ago' },
    { icon:'💳', text:'Payment received — James Thornton · £3,500', time:'5 hrs ago' },
    { icon:'📧', text:'Confirmation sent — Emma Clarke', time:'Yesterday' },
    { icon:'✅', text:'Session completed — Laura Benson', time:'2 days ago' },
    { icon:'🔒', text:'Admin login from London, UK', time:'3 days ago' },
  ];
  feed.innerHTML = activities.map(a => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);">
      <span style="font-size:14px;">${a.icon}</span>
      <div style="flex:1;"><div style="font-size:13px;">${a.text}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;">${a.time}</div></div>
    </div>`).join('');
}

/* ════ TOAST ════ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ════ INIT ════ */
function initPortal() {
  updateClock();
  renderCalendar();
  renderBookings();
  renderDashboard();
}

document.getElementById('login-pw').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
