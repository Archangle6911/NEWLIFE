const STORAGE_KEY = 'birthday-club-members-v1';
const palette = ['#49305d', '#2f4654', '#57354c', '#3a405e', '#59452e', '#354b43', '#4b3657'];
const $ = (selector) => document.querySelector(selector);
const els = {
  total: $('#total-members'), monthCount: $('#month-count'), nextCountdown: $('#next-countdown'), nextPerson: $('#next-person'),
  monthLabel: $('#month-label'), days: $('#calendar-days'), upcoming: $('#upcoming-list'), upcomingEmpty: $('#upcoming-empty'),
  table: $('#members-table'), membersEmpty: $('#members-empty'), search: $('#search-input'), modal: $('#birthday-modal'),
  form: $('#birthday-form'), modalTitle: $('#modal-title'), name: $('#member-name'), date: $('#member-date'), role: $('#member-role'),
  toast: $('#toast'), saveButton: $('#save-member-button')
};
let members = loadMembers();
let visibleMonth = new Date();
visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
let editingId = null;
let toastTimeout;

function loadMembers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(m => m && m.id && m.name && /^\d{4}-\d{2}-\d{2}$/.test(m.birthday)) : [];
  } catch { return []; }
}
function saveMembers() { localStorage.setItem(STORAGE_KEY, JSON.stringify(members)); }
function dateOnly(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function parseBirthday(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
function monthDay(value) { const d = parseBirthday(value); return { month: d.getMonth(), day: d.getDate() }; }
function nextBirthday(member, from = new Date()) {
  const today = dateOnly(from); const { month, day } = monthDay(member.birthday);
  let next = new Date(today.getFullYear(), month, day);
  if (dateOnly(next) < today) next = new Date(today.getFullYear() + 1, month, day);
  return next;
}
function dayDifference(a, b) { return Math.round((dateOnly(b) - dateOnly(a)) / 86400000); }
function ordinal(n) { const v = n % 100; if (v >= 11 && v <= 13) return `${n}th`; return `${n}${({1:'st',2:'nd',3:'rd'})[n % 10] || 'th'}`; }
function formatDate(date, options = { month: 'short', day: 'numeric' }) { return date.toLocaleDateString('en-US', options); }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function colorFor(name) { return palette[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length]; }
function birthdayThisMonth(member, year, month) { const d = monthDay(member.birthday); return d.month === month; }
function showToast(message) {
  els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 2800);
}
function openModal(member = null) {
  editingId = member?.id ?? null;
  els.modalTitle.textContent = member ? 'Edit birthday' : 'Add a birthday';
  els.saveButton.innerHTML = member ? 'Save changes <span>→</span>' : 'Save birthday <span>→</span>';
  els.name.value = member?.name || ''; els.date.value = member?.birthday || ''; els.role.value = member?.role || '';
  els.modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => els.name.focus(), 30);
}
function closeModal() { els.modal.hidden = true; document.body.style.overflow = ''; editingId = null; els.form.reset(); }
function renderStats() {
  const now = new Date(); const today = dateOnly(now); const upcoming = members.map(member => ({ member, date: nextBirthday(member, today) })).sort((a,b) => a.date - b.date);
  els.total.textContent = members.length;
  els.monthCount.textContent = members.filter(m => birthdayThisMonth(m, now.getFullYear(), now.getMonth())).length;
  if (!upcoming.length) { els.nextCountdown.textContent = '—'; els.nextPerson.textContent = 'Add a birthday to begin'; return; }
  const days = dayDifference(today, upcoming[0].date);
  els.nextCountdown.textContent = days === 0 ? 'Today!' : days === 1 ? '1 day' : `${days} days`;
  els.nextPerson.textContent = days === 0 ? `${upcoming[0].member.name}'s birthday 🎉` : `${upcoming[0].member.name} · ${formatDate(upcoming[0].date, {month:'short', day:'numeric'})}`;
}
function renderCalendar() {
  const year = visibleMonth.getFullYear(), month = visibleMonth.getMonth();
  els.monthLabel.textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  els.days.innerHTML = '';
  const firstDay = new Date(year, month, 1); const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const today = dateOnly(new Date());
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dayMembers = members.filter(m => { const md = monthDay(m.birthday); return md.month === date.getMonth() && md.day === date.getDate(); });
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'day-cell';
    if (date.getMonth() !== month) cell.classList.add('outside');
    if (dateOnly(date).getTime() === today.getTime()) cell.classList.add('today');
    if (dayMembers.length) cell.classList.add('has-birthday');
    cell.setAttribute('aria-label', `${formatDate(date, {month:'long', day:'numeric', year:'numeric'})}${dayMembers.length ? ': ' + dayMembers.map(m => m.name).join(', ') + ' birthday' : ''}`);
    const number = document.createElement('span'); number.className = 'day-number'; number.textContent = date.getDate(); cell.append(number);
    if (dayMembers.length) { const names = document.createElement('span'); names.className = 'birthday-names'; names.textContent = dayMembers.length === 1 ? dayMembers[0].name.split(' ')[0] : `${dayMembers.length} birthdays`; cell.append(names); }
    cell.addEventListener('click', () => {
      if (dayMembers.length) showToast(dayMembers.map(m => `${m.name}${m.role ? ' · ' + m.role : ''}`).join(' | '));
      else { const defaultDate = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; openModal(); els.date.value = defaultDate; }
    });
    els.days.append(cell);
  }
}
function renderUpcoming() {
  const today = dateOnly(new Date());
  const upcoming = members.map(member => ({ member, date: nextBirthday(member, today) })).sort((a,b) => a.date - b.date).slice(0, 5);
  els.upcoming.innerHTML = ''; els.upcomingEmpty.hidden = upcoming.length > 0;
  upcoming.forEach(({member, date}) => {
    const days = dayDifference(today, date); const item = document.createElement('div'); item.className = 'upcoming-item';
    const badge = document.createElement('div'); badge.className = 'date-badge';
    const month = document.createElement('span'); month.textContent = date.toLocaleDateString('en-US', {month:'short'}).toUpperCase();
    const day = document.createElement('strong'); day.textContent = date.getDate(); badge.append(month, day);
    const info = document.createElement('div'); info.className = 'upcoming-info';
    const name = document.createElement('strong'); name.textContent = member.name;
    const detail = document.createElement('small'); detail.textContent = member.role || `Birthday · ${formatDate(date, {weekday:'short', month:'short', day:'numeric'})}`;
    info.append(name, detail);
    const left = document.createElement('span'); left.className = 'days-left'; left.textContent = days === 0 ? 'Today 🎉' : days === 1 ? 'Tomorrow' : `${days} days`;
    item.append(badge, info, left); els.upcoming.append(item);
  });
}
function renderMembers() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = members.filter(m => `${m.name} ${m.role || ''}`.toLowerCase().includes(query)).sort((a,b) => a.name.localeCompare(b.name));
  els.table.innerHTML = ''; els.membersEmpty.hidden = filtered.length > 0;
  if (members.length > 0 && filtered.length === 0) { els.membersEmpty.hidden = false; els.membersEmpty.querySelector('strong').textContent = 'No members found'; els.membersEmpty.querySelector('p').textContent = 'Try a different name or team search.'; els.membersEmpty.querySelector('button').hidden = true; }
  else { els.membersEmpty.querySelector('strong').textContent = 'Your team starts here'; els.membersEmpty.querySelector('p').textContent = 'Add a member to build your birthday calendar.'; els.membersEmpty.querySelector('button').hidden = false; }
  filtered.forEach(member => {
    const tr = document.createElement('tr'); const next = nextBirthday(member); const days = dayDifference(new Date(), next);
    const personTd = document.createElement('td'); const person = document.createElement('div'); person.className = 'member-cell';
    const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.style.background = colorFor(member.name); avatar.textContent = initials(member.name);
    const nameBlock = document.createElement('div'); const name = document.createElement('div'); name.className = 'member-name'; name.textContent = member.name;
    const role = document.createElement('div'); role.className = 'member-role'; role.textContent = member.role || 'Team member'; nameBlock.append(name, role); person.append(avatar, nameBlock); personTd.append(person);
    const birthTd = document.createElement('td'); birthTd.className = 'birthday-date'; birthTd.textContent = formatDate(parseBirthday(member.birthday), {month:'short', day:'numeric', year:'numeric'});
    const nextTd = document.createElement('td'); nextTd.className = 'next-date'; nextTd.textContent = days === 0 ? 'Today 🎉' : `${formatDate(next, {month:'short', day:'numeric'})} · ${days} day${days === 1 ? '' : 's'}`;
    const actionTd = document.createElement('td'); const actions = document.createElement('div'); actions.className = 'row-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'action-button'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${member.name}`); edit.addEventListener('click', () => openModal(member));
    const del = document.createElement('button'); del.type = 'button'; del.className = 'action-button delete'; del.textContent = 'Delete'; del.setAttribute('aria-label', `Delete ${member.name}`); del.addEventListener('click', () => {
      if (confirm(`Delete ${member.name}'s birthday?`)) { members = members.filter(m => m.id !== member.id); saveMembers(); renderAll(); showToast(`${member.name}'s birthday was deleted.`); }
    });
    actions.append(edit, del); actionTd.append(actions); tr.append(personTd, birthTd, nextTd, actionTd); els.table.append(tr);
  });
}
function renderAll() { renderStats(); renderCalendar(); renderUpcoming(); renderMembers(); }

$('#open-add-modal').addEventListener('click', () => openModal());
$('#empty-add-button').addEventListener('click', () => openModal());
$('#close-modal').addEventListener('click', closeModal); $('#cancel-modal').addEventListener('click', closeModal);
els.modal.addEventListener('click', event => { if (event.target === els.modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !els.modal.hidden) closeModal(); });
$('#prev-month').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth()-1, 1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth()+1, 1); renderCalendar(); });
$('#today-button').addEventListener('click', () => { const now = new Date(); visibleMonth = new Date(now.getFullYear(), now.getMonth(), 1); renderCalendar(); });
els.search.addEventListener('input', renderMembers);
els.form.addEventListener('submit', event => {
  event.preventDefault(); const name = els.name.value.trim(); const birthday = els.date.value; const role = els.role.value.trim();
  if (!name || !birthday) return;
  const parsed = parseBirthday(birthday); const now = new Date();
  if (parsed > dateOnly(now)) { showToast('Choose a date of birth that is not in the future.'); return; }
  const duplicate = members.find(m => m.id !== editingId && m.name.toLowerCase() === name.toLowerCase() && m.birthday === birthday);
  if (duplicate) { showToast('That member and birthday are already on the calendar.'); return; }
  if (editingId) { members = members.map(m => m.id === editingId ? {...m, name, birthday, role} : m); showToast(`${name}'s birthday was updated.`); }
  else { members.push({id: (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`), name, birthday, role}); showToast(`${name}'s birthday was added! 🎉`); }
  saveMembers(); closeModal(); renderAll();
});

renderAll();
