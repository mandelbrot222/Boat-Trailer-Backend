/*
 * Page-specific logic for managing boat/trailer moves.  This script
 * handles adding new moves to Google Sheets via the proxy-backed API
 * and rendering the list on the calendar.
 */

// Ensure the user is authenticated before allowing interaction
ensureLoggedIn();

// === Sheets backend integration ===
let SCHEDULE_CACHE = []; // in-memory cache from backend

async function backendLoadSchedules() {
  const rows = await SheetsAPI.listSchedules({});
  SCHEDULE_CACHE = rows.map(r => {
    const s = new Date(r.StartISO);
    const e = new Date(r.EndISO || r.StartISO);
    const y = s.getFullYear();
    const m = String(s.getMonth()+1).padStart(2,'0');
    const d = String(s.getDate()).padStart(2,'0');
    const hh = String(s.getHours()).padStart(2,'0');
    const mm = String(s.getMinutes()).padStart(2,'0');
    const ey = e.getFullYear();
    const em = String(e.getMonth()+1).padStart(2,'0');
    const ed = String(e.getDate()).padStart(2,'0');
    const ehh = String(e.getHours()).padStart(2,'0');
    const emm = String(e.getMinutes()).padStart(2,'0');
    return {
      id: r.ID,
      startDate: `${y}-${m}-${d}`,
      startTime: `${hh}:${mm}`,
      endDate: `${ey}-${em}-${ed}`,
      endTime: `${ehh}:${emm}`,
      description: r.Description || '',
      name: r.Name || '',
      appointmentType: r.Kind || 'Other'
    };
  });
  return SCHEDULE_CACHE;
}

async function backendCreate(record) {
  const StartISO = `${record.startDate}T${record.startTime}`;
  const EndISO = `${record.endDate}T${record.endTime}`;
  const created = await SheetsAPI.createSchedule({
    StartISO, EndISO,
    Kind: record.appointmentType,
    Description: record.description,
    Name: record.name
  });
  record.id = created.ID;
  // optimistic update
  SCHEDULE_CACHE.push(record);
}

async function backendUpdate(index, record) {
  const id = record.id || SCHEDULE_CACHE[index]?.id;
  if (!id) throw new Error('Missing record ID for update');
  const StartISO = `${record.startDate}T${record.startTime}`;
  const EndISO = `${record.endDate}T${record.endTime}`;
  await SheetsAPI.updateSchedule({
    ID: id,
    StartISO, EndISO,
    Kind: record.appointmentType,
    Description: record.description,
    Name: record.name,
    Deleted: false
  });
  // optimistic update
  SCHEDULE_CACHE[index] = { ...record, id };
}

async function backendDelete(index) {
  const id = SCHEDULE_CACHE[index]?.id;
  if (!id) return;
  await SheetsAPI.deleteSchedule(id);
  SCHEDULE_CACHE.splice(index, 1);
}

function getSchedules() { return SCHEDULE_CACHE.slice(); }

const APPOINTMENT_TYPES = [
  { name: 'Launch', color: '#007F7E' },
  { name: 'Water Haul In', color: '#4577D5' },
  { name: 'Winter Storage Removal', color: '#C11A44' },
  { name: 'Winter Storage Intake', color: '#EBCB00' },
  { name: 'Trailer Storage Removal', color: '#8F4E9F' },
  { name: 'Trailer Storage Intake', color: '#F58220' },
  { name: 'Other', color: '#7A7A7A' }
];

const TYPE_COLOURS = {};
APPOINTMENT_TYPES.forEach(item => { TYPE_COLOURS[item.name] = item.color; });

let scheduleCalendar;

function transformSchedulesToEvents() {
  const list = getSchedules();
  return list.map((item, index) => ({
    title: item.description,
    start: `${item.startDate}T${item.startTime}`,
    end: `${item.endDate}T${item.endTime}`,
    backgroundColor: TYPE_COLOURS[item.appointmentType] || TYPE_COLOURS['Other'],
    borderColor: TYPE_COLOURS[item.appointmentType] || TYPE_COLOURS['Other'],
    extendedProps: { record: item, appointmentType: item.appointmentType, index }
  }));
}

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  scheduleCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: 'auto',
    dayHeaderContent: (arg) => {
      const dow = arg.date.toLocaleDateString([], { weekday: 'short' });
      const m = String(arg.date.getMonth() + 1);
      const d = String(arg.date.getDate());
      return { html: `<div class="nm-dow">${dow}</div><div class="nm-date">${m}/${d}</div>` };
    },
    events: transformSchedulesToEvents(),
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    slotDuration: '00:30:00',
    slotMinTime: '07:00:00',
    slotMaxTime: '16:00:00',
    allDaySlot: false,
    businessHours: { daysOfWeek: [1,2,3,4,5,6], startTime: '07:00', endTime: '16:00' },
    eventOverlap: false,
    selectable: true,
    selectOverlap: false,
    editable: false,
    selectAllow: (selectInfo) => selectInfo.start.getDay() !== 0,
    select: (info) => { openAppointmentModal('add', { start: info.start, end: info.end }); scheduleCalendar.unselect(); },
    eventClick: (info) => { openAppointmentModal('edit', { event: info.event }); }
  });
  scheduleCalendar.render();
}

function refreshCalendar() {
  if (!scheduleCalendar) return;
  const events = transformSchedulesToEvents();
  scheduleCalendar.removeAllEvents();
  events.forEach(ev => scheduleCalendar.addEvent(ev));
}

function renderSchedules() { refreshCalendar(); }

let currentModalMode = null;
let currentEventIndex = null;

function populateModalAppointmentOptions() {
  const select = document.getElementById('modal-type');
  if (!select) return;
  select.innerHTML = '';
  APPOINTMENT_TYPES.forEach(item => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function openAppointmentModal(mode, data) {
  currentModalMode = mode;
  const modal = document.getElementById('appointment-modal');
  const modalTitle = document.getElementById('modal-title');
  const startInput = document.getElementById('modal-start');
  const descInput = document.getElementById('modal-desc');
  const nameInput = document.getElementById('modal-name');
  const typeSelect = document.getElementById('modal-type');
  const deleteBtn = document.getElementById('modal-delete');
  populateModalAppointmentOptions();
  if (mode === 'add') {
    modalTitle.textContent = 'New Appointment';
    const startDateTime = data.start;
    startInput.value = formatDateTimeForDisplay(startDateTime);
    startInput.dataset.iso = startDateTime.toISOString();
    descInput.value = '';
    nameInput.value = '';
    typeSelect.value = APPOINTMENT_TYPES[0].name;
    deleteBtn.style.display = 'none';
    currentEventIndex = null;
  } else if (mode === 'edit' && data.event) {
    modalTitle.textContent = 'Edit Appointment';
    const rec = data.event.extendedProps.record;
    const startDT = new Date(`${rec.startDate}T${rec.startTime}`);
    startInput.value = formatDateTimeForDisplay(startDT);
    startInput.dataset.iso = startDT.toISOString();
    descInput.value = rec.description;
    nameInput.value = rec.name;
    typeSelect.value = rec.appointmentType;
    deleteBtn.style.display = 'inline-block';
    currentEventIndex = data.event.extendedProps.index;
  }
  modal.style.display = 'flex';
}

function closeAppointmentModal() {
  const modal = document.getElementById('appointment-modal');
  modal.style.display = 'none';
  currentModalMode = null;
  currentEventIndex = null;
}

function formatDateTimeForDisplay(dateObj) {
  return dateObj.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

async function handleModalSave(e) {
  e.preventDefault();
  const startInput = document.getElementById('modal-start');
  const descInput = document.getElementById('modal-desc');
  const nameInput = document.getElementById('modal-name');
  const typeSelect = document.getElementById('modal-type');
  const startISO = startInput.dataset.iso;
  const startDateObj = new Date(startISO);

  const startYear = startDateObj.getFullYear();
  const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
  const startDay = String(startDateObj.getDate()).padStart(2, '0');
  const startHours = String(startDateObj.getHours()).padStart(2, '0');
  const startMinutes = String(startDateObj.getMinutes()).padStart(2, '0');
  const startDate = `${startYear}-${startMonth}-${startDay}`;
  const startTime = `${startHours}:${startMinutes}`;

  const endDateObj = new Date(startDateObj.getTime() + 30 * 60000);
  const endYear = endDateObj.getFullYear();
  const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDateObj.getDate()).padStart(2, '0');
  const endHours = String(endDateObj.getHours()).padStart(2, '0');
  const endMinutes = String(endDateObj.getMinutes()).padStart(2, '0');
  const endDate = `${endYear}-${endMonth}-${endDay}`;
  const endTime = `${endHours}:${endMinutes}`;

  const record = {
    startDate,
    startTime,
    endDate,
    endTime,
    description: descInput.value.trim(),
    name: nameInput.value.trim(),
    appointmentType: typeSelect.value
  };

  if (!record.description || !record.name) { alert('Please provide a description and name.'); return; }

  const hour = startDateObj.getHours();
  const minute = startDateObj.getMinutes();
  if (startDateObj.getDay() === 0 || hour < 7 || hour > 15 || (hour === 15 && minute > 30)) {
    alert('Invalid start time or day for scheduling.'); return;
  }

  const existing = getSchedules();
  const newStart = startDateObj;
  const newEnd = endDateObj;
  const overlap = existing.some((item, idx) => {
    if (currentModalMode === 'edit' && idx === currentEventIndex) return false;
    const s1 = new Date(`${item.startDate}T${item.startTime}`);
    const e1 = new Date(`${item.endDate}T${item.endTime}`);
    return newStart < e1 && newEnd > s1;
  });
  if (overlap) { alert('This appointment overlaps with an existing one.'); return; }

  try {
    if (currentModalMode === 'add') {
      await backendCreate(record);
    } else if (currentModalMode === 'edit' && currentEventIndex !== null) {
      record.id = SCHEDULE_CACHE[currentEventIndex]?.id;
      await backendUpdate(currentEventIndex, record);
    }
    closeAppointmentModal();
    // instant refresh from local cache (no round-trip)
    renderSchedules();
    // background sync to ensure cache matches sheet (no UI wait)
    backendLoadSchedules().then(renderSchedules).catch(err => console.warn('Background sync failed:', err));
  } catch (err) {
    console.error('Save failed:', err);
    alert('Save failed: ' + (err && err.message ? err.message : err));
  }
}

async function handleModalDelete() {
  if (currentModalMode === 'edit' && currentEventIndex !== null) {
    await backendDelete(currentEventIndex);
    closeAppointmentModal();
    renderSchedules();
    backendLoadSchedules().then(renderSchedules).catch(err => console.warn('Background sync failed:', err));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modalForm = document.getElementById('modal-form');
  if (modalForm) modalForm.addEventListener('submit', handleModalSave);
  const cancelBtn = document.getElementById('modal-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeAppointmentModal);
  const deleteBtn = document.getElementById('modal-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', handleModalDelete);
});

initCalendar();
(async () => { await backendLoadSchedules(); renderSchedules(); })();

function renderLegend() {
  const legendEl = document.getElementById('legend');
  if (!legendEl) return;
  legendEl.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Appointment Types';
  legendEl.appendChild(title);
  APPOINTMENT_TYPES.forEach(item => {
    const wrap = document.createElement('div');
    wrap.className = 'legend-item';
    const colourBox = document.createElement('span');
    colourBox.className = 'legend-color';
    colourBox.style.backgroundColor = item.color;
    const label = document.createElement('span');
    label.textContent = item.name;
    wrap.appendChild(colourBox);
    wrap.appendChild(label);
    legendEl.appendChild(wrap);
  });
}
renderLegend();
