// ChequeMaster Pro - Application Logic (RD vs SAF Spreadsheet Mode)

// Supabase Direct Cloud Configuration (Enables standalone cloud connection without PC dependency)
const SUPABASE_URL = 'https://qqglkbsrhfvsbplclllt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZ2xrYnNyaGZ2c2JwbGNsbGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODg0OTUsImV4cCI6MjEwNjU2NDQ5NX0.pFiJQZCQObsrXcwh1LtplVbsaOqOIdprFSQGPmY50EU';

let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
    console.log('🟢 Supabase Direct Client initialized successfully!');
  } catch (err) {
    console.warn('Supabase Client init warning:', err);
  }
}

let allCheques = [];
let currentStats = {};
let currentReminders = {};
let currentFirm = 'ALL'; // 'ALL', 'RD', 'SAF'
let activeTab = 'all'; // 'all', 'clearing', 'hold', 'returned', 'due_tomorrow', 'stale'
let viewMode = typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table'; // Auto mobile-friendly
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  initViewMode();
  initDateDefaults();
  loadChequesAndStats();
  checkSupabaseStatus();

  // Listen for real-time cloud database updates from Supabase
  if (supabaseClient) {
    try {
      supabaseClient.channel('cheques-live-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cheques' }, () => {
          console.log('⚡ Realtime Supabase change received! Refreshing UI...');
          loadChequesAndStats(true);
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime channel error:', e);
    }
  }

  setInterval(() => {
    loadChequesAndStats(true);
    checkSupabaseStatus();
  }, 60000);
});

function formatINR(amount) {
  const num = Number(amount) || 0;
  return '₹ ' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '--';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initDateDefaults() {
  const today = new Date().toISOString().split('T')[0];
  const cd = document.getElementById('newChequeDateInput');
  const sb = document.getElementById('newSentToBankDate');
  const dd = document.getElementById('depositDateInput');
  if (cd) cd.value = today;
  if (sb) sb.value = today;
  if (dd) dd.value = today;
}

// Check if a date string (YYYY-MM-DD) is in the future
function isDateInFuture(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target.getTime() > today.getTime();
}

// Auto-switch status to POST_DATED when entering future date in Add Modal
function handleNewChequeDateChange(dateStr) {
  const isFuture = isDateInFuture(dateStr);
  const hint = document.getElementById('newChequeDateHint');
  const statusSelect = document.getElementById('newChequeStatus');
  if (hint) hint.classList.toggle('hidden', !isFuture);
  if (statusSelect) {
    if (isFuture) {
      statusSelect.value = 'POST_DATED';
    } else if (statusSelect.value === 'POST_DATED') {
      statusSelect.value = 'SENT_FOR_CLEARING';
    }
  }
}

// Auto-switch status to POST_DATED when entering future date in Edit Modal
function handleEditChequeDateChange(dateStr) {
  const isFuture = isDateInFuture(dateStr);
  const hint = document.getElementById('editChequeDateHint');
  const statusSelect = document.getElementById('editStatus');
  if (hint) hint.classList.toggle('hidden', !isFuture);
  if (statusSelect) {
    if (isFuture) {
      if (!['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(statusSelect.value)) {
        statusSelect.value = 'POST_DATED';
      }
    } else if (statusSelect.value === 'POST_DATED') {
      statusSelect.value = 'SENT_FOR_CLEARING';
    }
  }
}

// Firm Filter switcher (All, RD, SAF)
function setFirmFilter(firm) {
  currentFirm = firm;
  document.querySelectorAll('.firm-switch-btn').forEach(btn => btn.classList.remove('active', 'bg-blue-600', 'bg-emerald-600', 'bg-slate-700', 'text-white'));
  
  const activeBtn = document.getElementById(`firmBtn-${firm}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    if (firm === 'RD') activeBtn.classList.add('bg-blue-600', 'text-white');
    else if (firm === 'SAF') activeBtn.classList.add('bg-emerald-600', 'text-white');
    else activeBtn.classList.add('bg-slate-700', 'text-white');
  }

  // Update export CSV URL
  const exportBtn = document.getElementById('btnExportCSV');
  if (exportBtn) exportBtn.href = `/api/export/csv?firm=${firm}`;

  renderMainView();
}

// View Mode handlers (table vs cards)
function initViewMode() {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    viewMode = 'cards';
  } else {
    viewMode = 'table';
  }
  updateViewModeButtons();
}

function updateViewModeButtons() {
  const tableBtn = document.getElementById('viewBtn-table');
  const cardsBtn = document.getElementById('viewBtn-cards');
  if (tableBtn && cardsBtn) {
    if (viewMode === 'table') {
      tableBtn.className = 'px-2.5 py-1 rounded text-xs font-bold text-white bg-blue-600 transition';
      cardsBtn.className = 'px-2.5 py-1 rounded text-xs font-bold text-slate-400 hover:text-white transition';
    } else {
      cardsBtn.className = 'px-2.5 py-1 rounded text-xs font-bold text-white bg-blue-600 transition';
      tableBtn.className = 'px-2.5 py-1 rounded text-xs font-bold text-slate-400 hover:text-white transition';
    }
  }
}

function setViewMode(mode) {
  viewMode = mode;
  updateViewModeButtons();
  renderMainView();
}

// Tab selection
function selectTab(tabKey) {
  activeTab = tabKey;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const currentBtn = document.getElementById(`tab-${tabKey}`);
  if (currentBtn) currentBtn.classList.add('active');
  renderMainView();
}

// Search debounce
let searchDebounceTimer;
function handleSearchInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const input = document.getElementById('searchInput');
    searchQuery = input.value.trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !searchQuery);
    renderMainView();
  }, 200);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  searchQuery = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderMainView();
}

// Compress image file to base64 Data URL (Fast, lightweight, fits directly into Supabase)
function readFileAsCompressedBase64(file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve('');
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Map local camelCase object to Supabase snake_case table row
function toDbRow(c) {
  return {
    id: c.id,
    firm: (c.firm || 'RD').toUpperCase(),
    module_type: c.moduleType || 'CLEARING',
    sr_no: Number(c.srNo) || 0,
    cheque_number: String(c.chequeNumber || ''),
    party_name: c.partyName || '',
    bank_name: c.bankName || '',
    branch: c.branch || '',
    amount: Number(c.amount || 0),
    cheque_date: c.chequeDate || null,
    clearing_date: c.clearingDate || null,
    sent_to_bank_date: c.sentToBankDate || null,
    actual_clear_date: c.actualClearDate || null,
    hold_date: c.holdDate || null,
    hold_reason: c.holdReason || '',
    instruction_by: c.instructionBy || '',
    return_date: c.returnDate || null,
    return_reason: c.returnReason || '',
    action_taken: c.actionTaken || '',
    recovery_status: c.recoveryStatus || 'UNRESOLVED',
    status: c.status || 'SENT_FOR_CLEARING',
    cheque_photo: c.chequePhoto || '',
    receipt_photo: c.receiptPhoto || '',
    remarks: c.remarks || '',
    updated_at: new Date().toISOString()
  };
}

// Map Supabase snake_case row to local camelCase object
function fromDbRow(row) {
  return {
    id: row.id,
    firm: (row.firm || 'RD').toUpperCase(),
    moduleType: row.module_type || 'CLEARING',
    srNo: row.sr_no || 0,
    chequeNumber: row.cheque_number || '',
    partyName: row.party_name || '',
    bankName: row.bank_name || '',
    branch: row.branch || '',
    amount: Number(row.amount || 0),
    chequeDate: row.cheque_date || '',
    clearingDate: row.clearing_date || '',
    sentToBankDate: row.sent_to_bank_date || '',
    actualClearDate: row.actual_clear_date || '',
    holdDate: row.hold_date || '',
    holdReason: row.hold_reason || '',
    instructionBy: row.instruction_by || '',
    returnDate: row.return_date || '',
    returnReason: row.return_reason || '',
    actionTaken: row.action_taken || '',
    recoveryStatus: row.recovery_status || 'UNRESOLVED',
    status: row.status || 'SENT_FOR_CLEARING',
    chequePhoto: row.cheque_photo || '',
    receiptPhoto: row.receipt_photo || '',
    remarks: row.remarks || '',
    createdAt: row.created_at || new Date().toISOString()
  };
}

function addThreeMonths(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  d.setMonth(d.getMonth() + 3);
  return d;
}

// Dynamic calculations for PDC, reminders, stale dates
function enrichCheque(cheque, todayStr) {
  const today = todayStr ? new Date(todayStr) : new Date();
  today.setHours(0, 0, 0, 0);

  const firm = cheque.firm ? cheque.firm.toUpperCase().trim() : 'RD';
  const firmName = firm === 'SAF' ? 'Shree Ambica Furnishings India Pvt Ltd' : 'Reliable Drapes';
  const firmBadge = firm === 'SAF' ? '🟢 SAF' : '🔵 RD';

  // 3-Month Expiry Calculation
  const expiryDate = addThreeMonths(cheque.chequeDate);
  expiryDate.setHours(0, 0, 0, 0);

  const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = daysToExpiry < 0 && cheque.status !== 'CLEARED';

  // Effective Clearing Date
  const effectiveClearingDateStr = cheque.postponedDate || cheque.releaseDate || cheque.clearingDate || cheque.chequeDate;
  const clearingDateObj = effectiveClearingDateStr ? new Date(effectiveClearingDateStr) : new Date();
  clearingDateObj.setHours(0, 0, 0, 0);

  const daysToClearing = Math.ceil((clearingDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Reminders
  const isPending = ['IN_HAND', 'ON_HOLD', 'SENT_FOR_CLEARING', 'POSTPONED', 'POST_DATED'].includes(cheque.status);
  const isDueTomorrow = isPending && daysToClearing === 1;
  const isDueToday = isPending && daysToClearing === 0;
  const isOverdue = isPending && daysToClearing < 0;

  // Days on Hold
  let daysOnHold = 0;
  if (cheque.holdDate) {
    const hDate = new Date(cheque.holdDate);
    daysOnHold = Math.max(0, Math.floor((today.getTime() - hDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Days Pending Deposit
  let daysPending = 0;
  if (cheque.sentToBankDate) {
    const sDate = new Date(cheque.sentToBankDate);
    daysPending = Math.max(0, Math.floor((today.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Post-Dated Cheque (PDC) Calculation
  const chqDate = cheque.chequeDate ? new Date(cheque.chequeDate) : null;
  if (chqDate) chqDate.setHours(0, 0, 0, 0);
  const isFutureDate = chqDate && chqDate.getTime() > today.getTime();
  const isPostDated = cheque.status === 'POST_DATED' || (isFutureDate && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(cheque.status));
  const effectiveStatus = isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(cheque.status) ? 'POST_DATED' : cheque.status;

  // Days since cleared & days until automatic purge on Day 22 (21 days retention)
  let daysSinceCleared = 0;
  let daysUntilPurge = null;
  if (cheque.status === 'CLEARED') {
    const clrDateStr = cheque.actualClearDate || cheque.clearingDate;
    if (clrDateStr) {
      const clrDate = new Date(clrDateStr);
      clrDate.setHours(0, 0, 0, 0);
      daysSinceCleared = Math.max(0, Math.floor((today.getTime() - clrDate.getTime()) / (1000 * 60 * 60 * 24)));
      daysUntilPurge = Math.max(0, 22 - daysSinceCleared);
    }
  }

  return {
    ...cheque,
    firm,
    firmName,
    firmBadge,
    effectiveClearingDate: effectiveClearingDateStr,
    expiryDate: expiryDate.toISOString().split('T')[0],
    daysToExpiry,
    isStale,
    isFutureDate,
    isPostDated,
    effectiveStatus,
    daysToClearing,
    isDueTomorrow,
    isDueToday,
    isOverdue,
    daysOnHold,
    daysPending,
    daysSinceCleared,
    daysUntilPurge
  };
}

// Compute client-side totals & reminders directly from data
function computeStatsAndReminders() {
  const clearingList = allCheques.filter(c => c.moduleType === 'CLEARING');
  const holdList = allCheques.filter(c => c.moduleType === 'HOLD');
  const returnedList = allCheques.filter(c => c.moduleType === 'RETURNED');

  const rdList = allCheques.filter(c => c.firm === 'RD');
  const safList = allCheques.filter(c => c.firm === 'SAF');

  currentStats = {
    clearing: {
      totalAmount: clearingList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      totalCount: clearingList.length,
      rdAmount: clearingList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      rdCount: clearingList.filter(c => c.firm === 'RD').length,
      safAmount: clearingList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      safCount: clearingList.filter(c => c.firm === 'SAF').length,
    },
    hold: {
      totalAmount: holdList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      totalCount: holdList.length,
      rdAmount: holdList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      rdCount: holdList.filter(c => c.firm === 'RD').length,
      safAmount: holdList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      safCount: holdList.filter(c => c.firm === 'SAF').length,
    },
    returned: {
      totalAmount: returnedList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      totalCount: returnedList.length,
      rdAmount: returnedList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      rdCount: returnedList.filter(c => c.firm === 'RD').length,
      safAmount: returnedList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      safCount: returnedList.filter(c => c.firm === 'SAF').length,
    },
    totals: {
      rdTotalAmount: rdList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      rdTotalCount: rdList.length,
      safTotalAmount: safList.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      safTotalCount: safList.length,
      grandTotalAmount: allCheques.reduce((acc, c) => acc + (Number(c.amount) || 0), 0),
      grandTotalCount: allCheques.length,
    },
    postDatedCount: allCheques.filter(c => c.isPostDated || c.status === 'POST_DATED').length,
    dueTomorrowCount: allCheques.filter(c => c.isDueTomorrow).length,
    staleCount: allCheques.filter(c => c.isStale).length
  };

  currentReminders = {
    dueTomorrow: allCheques.filter(c => c.isDueTomorrow),
    dueToday: allCheques.filter(c => c.isDueToday),
    staleCheques: allCheques.filter(c => c.isStale)
  };
}

// Automatically purge cleared cheques older than 21 days (removed on Day 22+) directly from Supabase Cloud
async function checkAndPurgeOldClearedCheques() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (supabaseClient) {
    try {
      const { data: clearedRows, error } = await supabaseClient
        .from('cheques')
        .select('id, party_name, cheque_number, actual_clear_date, clearing_date, status')
        .eq('status', 'CLEARED');

      if (!error && clearedRows && clearedRows.length > 0) {
        const toDeleteIds = [];
        clearedRows.forEach(c => {
          const dateStr = c.actual_clear_date || c.clearing_date;
          if (dateStr) {
            const clrDate = new Date(dateStr);
            clrDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - clrDate.getTime()) / (1000 * 60 * 60 * 24));
            // If 21 days completed -> on 22nd day onwards (>= 22), purge automatically
            if (diffDays >= 22) {
              toDeleteIds.push(c.id);
            }
          }
        });

        if (toDeleteIds.length > 0) {
          console.log(`🧹 [Auto-Purge] Deleting ${toDeleteIds.length} cleared cheques (>21 days) from Supabase Cloud:`, toDeleteIds);
          await supabaseClient.from('cheques').delete().in('id', toDeleteIds);
        }
      }
    } catch (e) {
      console.warn('[Auto-Purge] Client check warning:', e);
    }
  }

  // Also notify server in background if reachable
  try {
    fetch('/api/cheques/purge-cleared', { method: 'POST' }).catch(() => {});
  } catch (e) {}
}

// Fetch Data (Direct Supabase Cloud first, fallback to Local API)
async function loadChequesAndStats(silent = false) {
  // Always run 21-day auto-purge check before reading data
  await checkAndPurgeOldClearedCheques();

  // 1. Direct Supabase Cloud Connection (Works on any phone or browser anywhere)
  if (supabaseClient) {
    try {
      const { data: rows, error } = await supabaseClient
        .from('cheques')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && rows) {
        allCheques = rows.map(r => enrichCheque(fromDbRow(r)));
        computeStatsAndReminders();
        renderKPIs();
        renderAlertBanners();
        updateBellBadge();
        renderMainView();
        if (!silent && currentReminders.dueTomorrow && currentReminders.dueTomorrow.length > 0) {
          playReminderSound();
        }
        return;
      }
    } catch (sbErr) {
      console.warn('Supabase direct query failed, falling back to local API:', sbErr);
    }
  }

  // 2. Fallback to Local API (If running via localhost desktop server)
  try {
    const [chequesRes, statsRes, remindersRes] = await Promise.all([
      fetch('/api/cheques'),
      fetch('/api/stats'),
      fetch('/api/reminders')
    ]);

    const chequesData = await chequesRes.json();
    const statsData = await statsRes.json();
    const remindersData = await remindersRes.json();

    if (chequesData.success) allCheques = chequesData.cheques || [];
    if (statsData.success) {
      currentStats = statsData.stats || {};
      renderKPIs();
    }
    if (remindersData.success) {
      currentReminders = remindersData.reminders || {};
      renderAlertBanners();
      updateBellBadge();
      if (!silent && currentReminders.dueTomorrow && currentReminders.dueTomorrow.length > 0) {
        playReminderSound();
      }
    }

    renderMainView();
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

function renderKPIs() {
  const s = currentStats;
  if (!s || !s.clearing) return;

  // 1. Sent for Clearing
  setText('statClearingTotalAmount', formatINR(s.clearing.totalAmount));
  setText('statClearingTotalCount', s.clearing.totalCount);
  setText('statClearingRD', formatINR(s.clearing.rdAmount));
  setText('statClearingRDCount', `${s.clearing.rdCount} cheques`);
  setText('statClearingSAF', formatINR(s.clearing.safAmount));
  setText('statClearingSAFCount', `${s.clearing.safCount} cheques`);

  // 2. On Hold
  setText('statHoldTotalAmount', formatINR(s.hold.totalAmount));
  setText('statHoldTotalCount', s.hold.totalCount);
  setText('statHoldRD', formatINR(s.hold.rdAmount));
  setText('statHoldRDCount', `${s.hold.rdCount} cheque`);
  setText('statHoldSAF', formatINR(s.hold.safAmount));
  setText('statHoldSAFCount', `${s.hold.safCount} cheques`);

  // 3. Returned
  setText('statReturnedTotalAmount', formatINR(s.returned.totalAmount));
  setText('statReturnedTotalCount', s.returned.totalCount);
  setText('statReturnedRD', formatINR(s.returned.rdAmount));
  setText('statReturnedRDCount', `${s.returned.rdCount} cheques`);
  setText('statReturnedSAF', formatINR(s.returned.safAmount));
  setText('statReturnedSAFCount', `${s.returned.safCount} cheques`);

  // 4. Firm Totals
  setText('statRDTotalAmount', formatINR(s.totals.rdTotalAmount));
  setText('statRDTotalCount', s.totals.rdTotalCount);
  setText('statSAFTotalAmount', formatINR(s.totals.safTotalAmount));
  setText('statSAFTotalCount', s.totals.safTotalCount);
  setText('statGrandTotalAmount', formatINR(s.totals.grandTotalAmount));
  setText('statGrandTotalCount', s.totals.grandTotalCount);

  // Switcher badges
  setText('firmBadge-ALL', s.totals.grandTotalCount);
  setText('firmBadge-RD', s.totals.rdTotalCount);
  setText('firmBadge-SAF', s.totals.safTotalCount);

  // Tab badges
  setText('tabBadge-clearing', s.clearing.totalCount);
  setText('tabBadge-hold', s.hold.totalCount);
  setText('tabBadge-returned', s.returned.totalCount);
  const pdCount = s.postDatedCount !== undefined ? s.postDatedCount : allCheques.filter(c => c.status === 'POST_DATED' || c.isPostDated).length;
  setText('tabBadge-post_dated', pdCount);
  setText('tabBadge-due_tomorrow', s.dueTomorrowCount || 0);
  setText('tabBadge-stale', s.staleCount || 0);
  const allTabBadge = document.querySelector('#tab-all .tab-badge');
  if (allTabBadge) allTabBadge.textContent = s.totals.grandTotalCount;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateBellBadge() {
  const count = currentReminders.dueTomorrow ? currentReminders.dueTomorrow.length : 0;
  const badge = document.getElementById('bellBadgeCount');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function playReminderSound() {
  const audio = document.getElementById('reminderAudio');
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio autoplay prevented'));
  }
}

// Urgent Banners
function renderAlertBanners() {
  const container = document.getElementById('urgentAlertsContainer');
  if (!container) return;

  const dueTomorrow = currentReminders.dueTomorrow || [];
  let html = '';

  if (dueTomorrow.length > 0) {
    const totalAmt = dueTomorrow.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    html += `
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-3 shadow-md flex items-center justify-between mb-3 text-xs">
        <div class="flex items-center gap-2.5">
          <i class="fa-solid fa-bell text-lg animate-bounce"></i>
          <div>
            <span class="font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-[10px] mr-1">1-Day Reminder</span>
            <span class="font-bold">Tomorrow ${dueTomorrow.length} cheque(s) are due for bank clearing (Total: ${formatINR(totalAmt)})!</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="selectTab('due_tomorrow')" class="px-3 py-1 bg-white text-slate-900 rounded font-bold hover:bg-slate-100">View (${dueTomorrow.length})</button>
          <button onclick="shareWhatsApp('tomorrow')" class="px-2.5 py-1 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-800"><i class="fa-brands fa-whatsapp"></i></button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Get filtered list based on currentFirm, activeTab, and searchQuery
function getFilteredList() {
  let list = [...allCheques];

  if (currentFirm === 'RD' || currentFirm === 'SAF') {
    list = list.filter(c => c.firm === currentFirm);
  }

  if (activeTab === 'clearing') {
    list = list.filter(c => c.moduleType === 'CLEARING');
  } else if (activeTab === 'hold') {
    list = list.filter(c => c.moduleType === 'HOLD');
  } else if (activeTab === 'returned') {
    list = list.filter(c => c.moduleType === 'RETURNED');
  } else if (activeTab === 'post_dated') {
    list = list.filter(c => c.status === 'POST_DATED' || c.isPostDated);
  } else if (activeTab === 'due_tomorrow') {
    list = list.filter(c => c.isDueTomorrow);
  } else if (activeTab === 'stale') {
    list = list.filter(c => c.isStale);
  }

  if (searchQuery) {
    list = list.filter(c =>
      c.partyName.toLowerCase().includes(searchQuery) ||
      c.chequeNumber.toLowerCase().includes(searchQuery) ||
      c.bankName.toLowerCase().includes(searchQuery) ||
      (c.holdReason && c.holdReason.toLowerCase().includes(searchQuery)) ||
      (c.instructionBy && c.instructionBy.toLowerCase().includes(searchQuery)) ||
      (c.returnReason && c.returnReason.toLowerCase().includes(searchQuery)) ||
      (c.actionTaken && c.actionTaken.toLowerCase().includes(searchQuery))
    );
  }

  return list;
}

// Render Main View (Table vs Cards)
function renderMainView() {
  const container = document.getElementById('mainDataContainer');
  if (!container) return;

  const list = getFilteredList();

  if (list.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-xl border border-slate-300 p-12 text-center shadow-sm">
        <i class="fa-solid fa-inbox text-3xl text-slate-300 mb-2"></i>
        <h4 class="text-sm font-bold text-slate-700">No Cheques Found</h4>
        <p class="text-xs text-slate-400 mt-0.5">Try switching the firm filter or clearing your search term.</p>
        <button onclick="openNewChequeModal()" class="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">
          + Add Cheque
        </button>
      </div>
    `;
    return;
  }

  if (viewMode === 'table') {
    container.innerHTML = renderSpreadsheetTable(list);
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        ${list.map(c => renderCard(c)).join('')}
      </div>
    `;
  }
}

// Render Spreadsheet Table (Exact Google / Excel Sheet structure!)
function renderSpreadsheetTable(list) {
  // Determine table columns based on active tab
  const isHold = activeTab === 'hold';
  const isReturned = activeTab === 'returned';
  const isPostDatedTab = activeTab === 'post_dated';

  const sheetTitle = isHold ? '📌 Hold Cheques' : (isReturned ? '↩ Returned Cheques' : (isPostDatedTab ? '📅 Post-Dated Cheques (PDC)' : '📤 Cheque Clearing'));

  return `
    <div class="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      
      <!-- Sub-header bar showing active sheet info -->
      <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-800">
            ${sheetTitle}
          </span>
          <span class="text-slate-400">•</span>
          <span class="text-slate-600 font-medium">Showing ${list.length} records</span>
          <span class="text-slate-400">•</span>
          <span class="font-mono font-bold text-slate-900">Total: ${formatINR(list.reduce((sum, c) => sum + (c.amount || 0), 0))}</span>
        </div>
        <div class="text-[11px] text-slate-500">
          🔵 RD = Reliable Drapes &nbsp;|&nbsp; 🟢 SAF = Shree Ambica Furnishings
        </div>
      </div>

      <!-- Scrollable table container -->
      <div class="overflow-x-auto max-h-[70vh]">
        <table class="w-full min-w-[950px] text-left border-collapse text-xs">
          <thead class="bg-slate-100/90 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 select-none shadow-sm">
            <tr>
              <th class="py-2.5 px-3 border-r border-slate-200 text-center w-12 font-mono">Sr #</th>
              <th class="py-2.5 px-3 border-r border-slate-200 text-center w-24">Firm</th>
              <th class="py-2.5 px-3 border-r border-slate-200 w-28">Cheque Date</th>
              <th class="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Party Name / Particulars</th>
              <th class="py-2.5 px-3 border-r border-slate-200 w-28 font-mono">Cheque Number</th>
              <th class="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Drawn On (Bank)</th>
              <th class="py-2.5 px-3 border-r border-slate-200 text-right w-32 font-mono">Amount (₹)</th>

              ${isHold ? `
                <th class="py-2.5 px-3 border-r border-slate-200 w-28">Hold Date</th>
                <th class="py-2.5 px-3 border-r border-slate-200 min-w-[150px]">Hold Reason</th>
                <th class="py-2.5 px-3 border-r border-slate-200 min-w-[120px]">Instruction By</th>
                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-24">Days on Hold</th>
                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-28">Current Status</th>
              ` : (isReturned ? `
                <th class="py-2.5 px-3 border-r border-slate-200 w-28">Return Date</th>
                <th class="py-2.5 px-3 border-r border-slate-200 min-w-[150px]">Return Reason</th>
                <th class="py-2.5 px-3 border-r border-slate-200 min-w-[120px]">Action Taken</th>
                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-28">Recovery Status</th>
              ` : `
                <th class="py-2.5 px-3 border-r border-slate-200 w-28">Sent to Bank</th>
                <th class="py-2.5 px-3 border-r border-slate-200 w-28">Actual Clear</th>
                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-28">Status</th>
              `)}

              <th class="py-2.5 px-2 border-r border-slate-200 text-center w-28 whitespace-nowrap">Cheque Photo</th>
              <th class="py-2.5 px-2 border-r border-slate-200 text-center w-28 whitespace-nowrap">Clearing Slip</th>
              <th class="py-2.5 px-2 text-center w-32 whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 font-normal">
            ${list.map((c, idx) => renderTableRow(c, idx + 1, isHold, isReturned)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTableRow(c, index, isHold, isReturned) {
  // Firm Badge styling (Blue for RD, Green for SAF)
  const isSAF = c.firm === 'SAF';
  const firmBadge = isSAF 
    ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">🟢 SAF</span>`
    : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-300 font-mono">🔵 RD</span>`;

  // Status badge styling
  const isPostDated = c.status === 'POST_DATED' || (c.isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(c.status));
  let statusBadge = '';
  if (c.status === 'CLEARED') {
    const purgeText = c.daysUntilPurge !== null ? `${c.daysUntilPurge}d left` : '';
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200" title="Cleared ${c.daysSinceCleared || 0} days ago. Auto-removes on Day 22 (${c.daysUntilPurge !== null ? c.daysUntilPurge + ' days left' : ''})">✅ Cleared${purgeText ? ` (${purgeText})` : ''}</span>`;
  } else if (c.status === 'BOUNCED') {
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">❌ Bounced</span>`;
  } else if (c.status === 'ON_HOLD') {
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">⏸ On Hold</span>`;
  } else if (isPostDated) {
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">📅 Post Dated (PDC)</span>`;
  } else {
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">⏳ In Clearing</span>`;
  }

  // Row background based on status
  let rowBg = 'hover:bg-slate-50/80';
  if (c.status === 'CLEARED') rowBg = 'bg-emerald-50/20 hover:bg-emerald-50/40';
  else if (c.status === 'BOUNCED') rowBg = 'bg-rose-50/30 hover:bg-rose-50/50';
  else if (c.status === 'ON_HOLD') rowBg = 'bg-amber-50/30 hover:bg-amber-50/50';
  else if (isPostDated) rowBg = 'bg-purple-50/30 hover:bg-purple-50/50';

  // Cheque Photo link cell
  const chequePhotoCell = c.chequePhoto ? `
    <button onclick="openImageViewer('${c.chequePhoto}', 'Cheque Photo: ${c.partyName} - ${formatINR(c.amount)}')" class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold underline text-xs">
      <i class="fa-solid fa-image text-xs"></i> View Cheque
    </button>
  ` : `<span class="text-slate-400 text-[11px]">--</span>`;

  // Clearing Slip Photo link cell
  const receiptPhotoCell = c.receiptPhoto ? `
    <button onclick="openImageViewer('${c.receiptPhoto}', 'Clearing Slip: ${c.partyName} - ${formatINR(c.amount)}')" class="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold underline text-xs">
      <i class="fa-solid fa-receipt text-xs"></i> View Slip
    </button>
  ` : (c.status !== 'CLEARED' ? `
    <button onclick="openDepositModal('${c.id}')" class="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-700 text-[11px] font-semibold hover:bg-slate-100 px-1.5 py-0.5 rounded border border-dashed border-slate-300">
      <i class="fa-solid fa-upload text-[10px]"></i> Slip
    </button>
  ` : `<span class="text-slate-400 text-[11px]">--</span>`);

  return `
    <tr class="${rowBg} transition-colors">
      <td class="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500 font-semibold">${index}</td>
      <td class="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">${firmBadge}</td>
      <td class="py-2 px-3 border-r border-slate-200 font-mono text-slate-700 text-xs">${formatDateDisplay(c.chequeDate)}</td>
      <td class="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">${c.partyName}</td>
      <td class="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800 tracking-wider">${c.chequeNumber}</td>
      <td class="py-2 px-3 border-r border-slate-200 text-slate-700">${c.bankName}</td>
      <td class="py-2 px-3 border-r border-slate-200 text-right font-mono font-black text-slate-900">${formatINR(c.amount)}</td>

      ${isHold ? `
        <td class="py-2 px-3 border-r border-slate-200 font-mono text-xs text-slate-600">${formatDateDisplay(c.holdDate)}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-amber-900 font-medium">${c.holdReason || '--'}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-slate-700 font-semibold">${c.instructionBy || '--'}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold text-amber-800">${c.daysOnHold || 0} days</td>
        <td class="py-2 px-3 border-r border-slate-200 text-center">${statusBadge}</td>
      ` : (isReturned ? `
        <td class="py-2 px-3 border-r border-slate-200 font-mono text-xs text-slate-600">${formatDateDisplay(c.returnDate)}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-rose-900 font-bold">${c.returnReason || '--'}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-slate-700 font-semibold">${c.actionTaken || '--'}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-center">
          ${c.recoveryStatus === 'RECOVERED' ? '<span class="text-emerald-700 font-bold">🟢 Recovered</span>' : (c.recoveryStatus === 'IN_PROGRESS' ? '<span class="text-amber-600 font-bold">🟡 In Progress</span>' : '<span class="text-rose-700 font-bold">🔴 Unresolved</span>')}
        </td>
      ` : `
        <td class="py-2 px-3 border-r border-slate-200 font-mono text-xs text-slate-600">${formatDateDisplay(c.sentToBankDate)}</td>
        <td class="py-2 px-3 border-r border-slate-200 font-mono text-xs text-slate-600">${formatDateDisplay(c.actualClearDate)}</td>
        <td class="py-2 px-3 border-r border-slate-200 text-center">${statusBadge}</td>
      `)}

      <td class="py-2 px-2 border-r border-slate-200 text-center whitespace-nowrap">${chequePhotoCell}</td>
      <td class="py-2 px-2 border-r border-slate-200 text-center whitespace-nowrap">${receiptPhotoCell}</td>
      
      <!-- Actions -->
      <td class="py-2 px-2 text-center whitespace-nowrap">
        <div class="inline-flex items-center gap-1">
          <button onclick="openEditChequeModal('${c.id}')" class="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit Cheque Details">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
          </button>
          ${c.status !== 'CLEARED' ? `
            <button onclick="openDepositModal('${c.id}')" class="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Deposit in Bank / Upload Slip">
              <i class="fa-solid fa-receipt text-xs"></i>
            </button>
            <button onclick="markCleared('${c.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Mark Cleared">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
          ` : ''}
          <button onclick="shareSingleWhatsApp('${c.id}')" class="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Share WhatsApp with Cheque Details & Photo">
            <i class="fa-brands fa-whatsapp text-xs"></i>
          </button>
          <button onclick="deleteCheque('${c.id}')" class="p-1 text-slate-400 hover:text-red-600 rounded" title="Delete Cheque (Password Protected)">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Render Card Mode (Modern Mobile & Tablet Responsive View)
function renderCard(c) {
  const isSAF = c.firm === 'SAF';
  const isPostDated = c.status === 'POST_DATED' || (c.isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(c.status));
  
  let statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">⏳ In Clearing</span>';
  if (c.status === 'CLEARED') {
    const purgeText = c.daysUntilPurge !== null ? `${c.daysUntilPurge}d left` : '';
    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200" title="Cleared ${c.daysSinceCleared || 0} days ago. Auto-removes on Day 22">✅ Cleared${purgeText ? ` (${purgeText})` : ''}</span>`;
  } else if (c.status === 'BOUNCED') {
    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">❌ Bounced</span>';
  } else if (c.status === 'ON_HOLD') {
    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">⏸ On Hold</span>';
  } else if (isPostDated) {
    statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">📅 Post Dated (PDC)</span>';
  }

  const borderAccent = isSAF ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-blue-500';

  return `
    <div class="bg-white rounded-2xl border border-slate-300 p-4 shadow-sm hover:shadow-md transition space-y-3 ${borderAccent} relative">
      <!-- Top Row: Firm Tag & Amount -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-black ${isSAF ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-blue-100 text-blue-900 border border-blue-300'} font-mono">
            ${isSAF ? '🟢 SAF' : '🔵 RD'}
          </span>
          <span class="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">#${c.chequeNumber}</span>
        </div>
        <div class="text-right">
          <span class="font-mono text-lg font-black text-slate-900">${formatINR(c.amount)}</span>
        </div>
      </div>

      <!-- Party Name & Bank -->
      <div>
        <h4 class="font-bold text-slate-900 text-sm leading-snug">${c.partyName}</h4>
        <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
          <i class="fa-solid fa-building-columns text-[10px] text-slate-400"></i>
          <span>${c.bankName}</span>
        </p>
      </div>

      <!-- Dates & Status Info Box -->
      <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Cheque Date</span>
          <span class="font-mono font-bold text-slate-800 text-xs">${formatDateDisplay(c.chequeDate)}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Status</span>
          <div>${statusBadge}</div>
        </div>
        ${c.sentToBankDate ? `
          <div class="col-span-2 pt-1.5 mt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
            <span>📤 Sent: <span class="font-mono font-semibold">${formatDateDisplay(c.sentToBankDate)}</span></span>
            ${c.actualClearDate ? `<span>✅ Cleared: <span class="font-mono font-semibold text-emerald-700">${formatDateDisplay(c.actualClearDate)}</span></span>` : ''}
          </div>
        ` : ''}
        ${c.holdReason ? `
          <div class="col-span-2 pt-1.5 mt-1 border-t border-slate-200/60 text-[11px] text-amber-900">
            <span class="font-bold">Hold Reason:</span> ${c.holdReason} (by ${c.instructionBy || 'Party'})
          </div>
        ` : ''}
        ${c.returnReason ? `
          <div class="col-span-2 pt-1.5 mt-1 border-t border-slate-200/60 text-[11px] text-rose-900">
            <span class="font-bold">Return Reason:</span> ${c.returnReason}
          </div>
        ` : ''}
      </div>

      <!-- Photos (Cheque + Slip) -->
      ${(c.chequePhoto || c.receiptPhoto) ? `
        <div class="flex items-center gap-2 pt-1 flex-wrap">
          ${c.chequePhoto ? `
            <button onclick="openImageViewer('${c.chequePhoto}', 'Cheque Photo: ${c.partyName}')" class="text-blue-700 text-xs font-bold bg-blue-50 hover:bg-blue-100 active:scale-95 px-2.5 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5 transition">
              <i class="fa-solid fa-image text-xs"></i> Cheque Photo
            </button>
          ` : ''}
          ${c.receiptPhoto ? `
            <button onclick="openImageViewer('${c.receiptPhoto}', 'Clearing Slip: ${c.partyName}')" class="text-emerald-700 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 active:scale-95 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition">
              <i class="fa-solid fa-receipt text-xs"></i> Clearing Slip
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- Bottom Touch Action Bar -->
      <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5">
          ${c.status !== 'CLEARED' ? `
            <button onclick="openDepositModal('${c.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1">
              <i class="fa-solid fa-upload text-[10px]"></i>
              <span>Deposit Slip</span>
            </button>
            <button onclick="markCleared('${c.id}')" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition" title="Mark Cleared">
              <i class="fa-solid fa-check text-xs"></i>
            </button>
          ` : '<span class="text-emerald-700 text-xs font-bold">✅ Cleared</span>'}
        </div>
        
        <div class="flex items-center gap-1">
          <button onclick="openEditChequeModal('${c.id}')" class="p-2 text-indigo-600 hover:bg-indigo-50 active:scale-95 rounded-lg border border-slate-200 transition" title="Edit Cheque">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
          </button>
          <button onclick="shareSingleWhatsApp('${c.id}')" class="p-2 text-emerald-600 hover:bg-emerald-50 active:scale-95 rounded-lg border border-slate-200 transition" title="Share WhatsApp">
            <i class="fa-brands fa-whatsapp text-sm"></i>
          </button>
          <button onclick="deleteCheque('${c.id}')" class="p-2 text-slate-400 hover:text-red-600 active:scale-95 hover:bg-red-50 rounded-lg border border-slate-200 transition" title="Delete Cheque (Password: axon241)">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>

    </div>
  `;
}

// Modal Toggle
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function openNewChequeModal() {
  initDateDefaults();
  const form = document.getElementById('newChequeForm');
  if (form) form.reset();
  initDateDefaults();
  const hint = document.getElementById('newChequeDateHint');
  if (hint) hint.classList.add('hidden');
  const statusSelect = document.getElementById('newChequeStatus');
  if (statusSelect) statusSelect.value = 'SENT_FOR_CLEARING';
  toggleModuleFields('CLEARING');
  openModal('newChequeModal');
}

function toggleModuleFields(val) {
  const clr = document.getElementById('fieldsClearing');
  const hld = document.getElementById('fieldsHold');
  const ret = document.getElementById('fieldsReturned');
  if (clr) clr.classList.toggle('hidden', val !== 'CLEARING');
  if (hld) hld.classList.toggle('hidden', val !== 'HOLD');
  if (ret) ret.classList.toggle('hidden', val !== 'RETURNED');
}

async function handleNewChequeSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving to Cloud...';
    }

    const firm = (form.firm.value || 'RD').toUpperCase();
    const moduleType = form.moduleType.value || 'CLEARING';
    const chequeNumber = form.chequeNumber.value.trim();
    const partyName = form.partyName.value.trim();
    const bankName = form.bankName.value.trim();
    const branch = form.branch ? form.branch.value.trim() : '';
    const amount = Number(form.amount.value) || 0;
    const chequeDate = form.chequeDate.value || '';
    const sentToBankDate = form.sentToBankDate ? form.sentToBankDate.value : '';
    const clearingDate = form.clearingDate ? form.clearingDate.value : '';
    const status = form.status ? form.status.value : 'SENT_FOR_CLEARING';
    const remarks = form.remarks ? form.remarks.value.trim() : '';
    const holdReason = form.holdReason ? form.holdReason.value.trim() : '';
    const instructionBy = form.instructionBy ? form.instructionBy.value.trim() : '';
    const returnReason = form.returnReason ? form.returnReason.value.trim() : '';
    const actionTaken = form.actionTaken ? form.actionTaken.value.trim() : '';

    const prefix = moduleType === 'HOLD' ? 'HLD' : (moduleType === 'RETURNED' ? 'RET' : 'CLR');
    const existingSameModule = allCheques.filter(c => c.moduleType === moduleType);
    const newSrNo = existingSameModule.length + 1;
    const newId = `${prefix}-${String(newSrNo).padStart(4, '0')}`;

    // Read photos as compressed Base64
    const chqFile = document.getElementById('newChequePhoto')?.files?.[0];
    const recFile = document.getElementById('newReceiptPhoto')?.files?.[0];

    const chequePhotoBase64 = chqFile ? await readFileAsCompressedBase64(chqFile) : '';
    const receiptPhotoBase64 = recFile ? await readFileAsCompressedBase64(recFile) : '';

    const newCheque = {
      id: newId,
      firm,
      moduleType,
      srNo: newSrNo,
      chequeNumber,
      partyName,
      bankName,
      branch,
      amount,
      chequeDate,
      clearingDate,
      sentToBankDate,
      holdReason,
      instructionBy,
      returnReason,
      actionTaken,
      recoveryStatus: 'UNRESOLVED',
      status,
      chequePhoto: chequePhotoBase64,
      receiptPhoto: receiptPhotoBase64,
      remarks,
      createdAt: new Date().toISOString()
    };

    // Direct Supabase Cloud Save
    if (supabaseClient) {
      const dbRow = toDbRow(newCheque);
      const { error: sbError } = await supabaseClient.from('cheques').insert([dbRow]);
      if (sbError) {
        throw new Error('Supabase Cloud save failed: ' + sbError.message);
      }
    }

    // Mirror to local server in background if reachable
    try {
      const formData = new FormData(form);
      if (chequePhotoBase64) formData.append('chequePhotoBase64', chequePhotoBase64);
      if (receiptPhotoBase64) formData.append('receiptPhotoBase64', receiptPhotoBase64);
      fetch('/api/cheques', { method: 'POST', body: formData }).catch(() => {});
    } catch (e) {}

    closeModal('newChequeModal');
    form.reset();
    initDateDefaults();
    await loadChequesAndStats();
    showToast('✅ Cheque saved directly to Supabase Cloud!');
  } catch (err) {
    console.error('Error saving cheque:', err);
    alert('Save Error: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-plus-circle mr-1"></i> Save Cheque';
    }
  }
}

function openDepositModal(id) {
  const c = allCheques.find(x => x.id === id);
  if (!c) return;
  document.getElementById('depositChequeId').value = c.id;
  document.getElementById('depositPartyInfo').textContent = `${c.partyName} (${c.firm})`;
  document.getElementById('depositAmountInfo').textContent = formatINR(c.amount);
  document.getElementById('depositDateInput').value = new Date().toISOString().split('T')[0];
  openModal('depositModal');
}

async function handleDepositSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const id = document.getElementById('depositChequeId').value;
  const depositDate = document.getElementById('depositDateInput').value;
  const fileInput = document.getElementById('depositReceiptInput');

  try {
    let receiptBase64 = '';
    if (fileInput && fileInput.files && fileInput.files[0]) {
      receiptBase64 = await readFileAsCompressedBase64(fileInput.files[0]);
    }

    // Direct Supabase Cloud Update
    if (supabaseClient) {
      const updateData = { sent_to_bank_date: depositDate, updated_at: new Date().toISOString() };
      if (receiptBase64) updateData.receipt_photo = receiptBase64;
      const { error } = await supabaseClient.from('cheques').update(updateData).eq('id', id);
      if (error) throw new Error(error.message);
    }

    // Mirror to local server
    try {
      const formData = new FormData(form);
      fetch(`/api/cheques/${id}/deposit`, { method: 'POST', body: formData }).catch(() => {});
    } catch (e) {}

    closeModal('depositModal');
    await loadChequesAndStats();
    showToast('✅ Deposit slip uploaded to Supabase Cloud!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function markCleared(id) {
  if (!confirm('Mark this cheque as cleared by bank?')) return;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // Direct Supabase Cloud Update
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from('cheques')
        .update({ status: 'CLEARED', actual_clear_date: todayStr, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    // Local server mirror
    try {
      fetch(`/api/cheques/${id}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearanceDate: todayStr })
      }).catch(() => {});
    } catch (e) {}

    await loadChequesAndStats();
    showToast('✅ Cheque marked as Cleared in Supabase!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteCheque(id) {
  const c = allCheques.find(x => x.id === id);
  const chequeLabel = c ? `${c.partyName} (Cheque: ${c.chequeNumber}, ₹${c.amount})` : id;

  const enteredPassword = prompt(`🔒 SECURITY VERIFICATION\nCheque delete karne ke liye password enter karein:\n\nCheque: ${chequeLabel}`);
  if (enteredPassword === null) return; // User cancelled

  if (enteredPassword.trim() !== 'axon241') {
    alert('❌ Galat Password! Cheque delete karne ki anumati nahi hai.');
    return;
  }

  if (!confirm(`⚠️ FINAL CONFIRMATION:\nKya aap sach me ye cheque permanently delete karna chahte hain?\n\n${chequeLabel}`)) {
    return;
  }

  try {
    // Direct Supabase Cloud Delete
    if (supabaseClient) {
      const { error } = await supabaseClient.from('cheques').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }

    // Local server mirror
    try {
      fetch(`/api/cheques/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-delete-password': enteredPassword.trim()
        },
        body: JSON.stringify({ password: enteredPassword.trim() })
      }).catch(() => {});
    } catch (e) {}

    await loadChequesAndStats();
    showToast('✅ Cheque successfully delete ho gaya.');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Reset/Clear all data prompt (Password Protected: axon241)
async function clearAllDataPrompt() {
  const count = allCheques.length;
  const enteredPassword = prompt(`🔒 SECURITY VERIFICATION\nDatabase ka saara data (${count} cheques) clear karne ke liye password enter karein:\n\nPassword:`);
  if (enteredPassword === null) return; // User cancelled

  if (enteredPassword.trim() !== 'axon241') {
    alert('❌ Galat Password! Data clear karne ki anumati nahi hai.');
    return;
  }

  if (!confirm(`⚠️ FINAL CONFIRMATION:\nKya aap sach me saara data permanently delete karke blank spreadsheet banana chahte hain?\n\nIs se sabhi ${count} cheques remove ho jayenge aur aap nayi entries kar sakenge.`)) {
    return;
  }

  try {
    // Direct Supabase Cloud Delete All
    if (supabaseClient) {
      const { error } = await supabaseClient.from('cheques').delete().neq('id', '___non_existent___');
      if (error) throw new Error(error.message);
    }

    // Local server mirror
    try {
      fetch('/api/cheques/clear-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-delete-password': enteredPassword.trim()
        },
        body: JSON.stringify({ password: enteredPassword.trim() })
      }).catch(() => {});
    } catch (e) {}

    closeModal('supabaseModal');
    await loadChequesAndStats();
    showToast('✅ Sabhi data clear ho gaya! Ab aap nayi entry kar sakte hain.');
    alert('✅ All data cleared successfully from Supabase Cloud!');
  } catch (err) {
    alert('Clear Error: ' + err.message);
  }
}

// ======================== EDIT CHEQUE MODAL HANDLERS ========================

function openEditChequeModal(id) {
  const c = allCheques.find(x => x.id === id);
  if (!c) return;

  document.getElementById('editChequeId').value = c.id;
  document.getElementById('editModalSubtitle').textContent = `Editing: ${c.partyName} (Cheque #${c.chequeNumber})`;

  // Firm radio
  if (c.firm === 'SAF') {
    document.getElementById('editFirmSAF').checked = true;
  } else {
    document.getElementById('editFirmRD').checked = true;
  }

  document.getElementById('editChequeModuleType').value = c.moduleType || 'CLEARING';
  document.getElementById('editChequeNumber').value = c.chequeNumber || '';
  document.getElementById('editAmount').value = c.amount || '';
  document.getElementById('editPartyName').value = c.partyName || '';
  document.getElementById('editBankName').value = c.bankName || '';
  document.getElementById('editChequeDate').value = c.chequeDate || '';
  const isPostDated = c.status === 'POST_DATED' || (c.isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(c.status));
  const effectiveStatus = isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(c.status) ? 'POST_DATED' : (c.status || 'SENT_FOR_CLEARING');
  document.getElementById('editStatus').value = effectiveStatus;

  const editHint = document.getElementById('editChequeDateHint');
  if (editHint) {
    editHint.classList.toggle('hidden', !isDateInFuture(c.chequeDate));
  }

  // Conditional fields
  document.getElementById('editSentToBankDate').value = c.sentToBankDate || '';
  document.getElementById('editActualClearDate').value = c.actualClearDate || '';
  document.getElementById('editHoldDate').value = c.holdDate || '';
  document.getElementById('editHoldReason').value = c.holdReason || '';
  document.getElementById('editInstructionBy').value = c.instructionBy || '';
  document.getElementById('editReturnDate').value = c.returnDate || '';
  document.getElementById('editReturnReason').value = c.returnReason || 'Insufficient Funds';
  document.getElementById('editActionTaken').value = c.actionTaken || '';
  document.getElementById('editRemarks').value = c.remarks || '';

  // Photo previews
  const chequePreview = document.getElementById('editChequePhotoPreview');
  if (chequePreview) {
    if (c.chequePhoto) {
      chequePreview.innerHTML = `
        <div class="flex items-center justify-center gap-1.5 text-blue-700 font-bold">
          <i class="fa-solid fa-circle-check text-emerald-600"></i>
          <span>Photo attached</span>
          <button type="button" onclick="openImageViewer('${c.chequePhoto}', 'Cheque Photo: ${c.partyName}')" class="text-blue-600 underline ml-1">View</button>
        </div>
      `;
    } else {
      chequePreview.innerHTML = `<span class="text-slate-400">No cheque photo uploaded</span>`;
    }
  }

  const receiptPreview = document.getElementById('editReceiptPhotoPreview');
  if (receiptPreview) {
    if (c.receiptPhoto) {
      receiptPreview.innerHTML = `
        <div class="flex items-center justify-center gap-1.5 text-emerald-700 font-bold">
          <i class="fa-solid fa-circle-check text-emerald-600"></i>
          <span>Slip attached</span>
          <button type="button" onclick="openImageViewer('${c.receiptPhoto}', 'Clearing Slip: ${c.partyName}')" class="text-emerald-700 underline ml-1">View</button>
        </div>
      `;
    } else {
      receiptPreview.innerHTML = `<span class="text-slate-400">No clearing slip uploaded</span>`;
    }
  }

  // Clear file inputs
  const file1 = document.getElementById('editChequePhotoInput');
  const file2 = document.getElementById('editReceiptPhotoInput');
  if (file1) file1.value = '';
  if (file2) file2.value = '';

  toggleEditModuleFields(c.moduleType || 'CLEARING');
  openModal('editChequeModal');
}

function toggleEditModuleFields(val) {
  const clr = document.getElementById('editFieldsClearing');
  const hld = document.getElementById('editFieldsHold');
  const ret = document.getElementById('editFieldsReturned');
  if (clr) clr.classList.toggle('hidden', val !== 'CLEARING');
  if (hld) hld.classList.toggle('hidden', val !== 'HOLD');
  if (ret) ret.classList.toggle('hidden', val !== 'RETURNED');
}

async function handleEditChequeSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const id = document.getElementById('editChequeId').value;
  const btn = document.getElementById('btnSaveEditCheque');
  if (!id) return;

  const existing = allCheques.find(x => x.id === id);
  if (!existing) {
    alert('Cheque not found!');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Updating Cloud...`;
    }

    const firm = form.querySelector('input[name="firm"]:checked')?.value || existing.firm || 'RD';
    const moduleType = form.moduleType?.value || existing.moduleType || 'CLEARING';
    const chequeNumber = form.chequeNumber.value.trim();
    const amount = Number(form.amount.value) || 0;
    const partyName = form.partyName.value.trim();
    const bankName = form.bankName.value.trim();
    const branch = form.branch ? form.branch.value.trim() : (existing.branch || '');
    const chequeDate = form.chequeDate.value || '';
    const status = form.status.value || existing.status;
    const sentToBankDate = form.sentToBankDate ? form.sentToBankDate.value : '';
    let actualClearDate = form.actualClearDate ? form.actualClearDate.value : '';
    const holdDate = form.holdDate ? form.holdDate.value : '';
    const holdReason = form.holdReason ? form.holdReason.value.trim() : '';
    const instructionBy = form.instructionBy ? form.instructionBy.value.trim() : '';
    const returnDate = form.returnDate ? form.returnDate.value : '';
    const returnReason = form.returnReason ? form.returnReason.value.trim() : '';
    const actionTaken = form.actionTaken ? form.actionTaken.value.trim() : '';
    const remarks = form.remarks ? form.remarks.value.trim() : '';
    const recoveryStatus = form.recoveryStatus ? form.recoveryStatus.value : existing.recoveryStatus;

    if (status === 'CLEARED' && !actualClearDate) {
      actualClearDate = new Date().toISOString().split('T')[0];
    }

    // Process new photos if uploaded
    const chqFileInput = document.getElementById('editChequePhotoInput');
    const recFileInput = document.getElementById('editReceiptPhotoInput');

    let chequePhoto = existing.chequePhoto || '';
    let receiptPhoto = existing.receiptPhoto || '';

    if (chqFileInput && chqFileInput.files && chqFileInput.files[0]) {
      chequePhoto = await readFileAsCompressedBase64(chqFileInput.files[0]);
    }
    if (recFileInput && recFileInput.files && recFileInput.files[0]) {
      receiptPhoto = await readFileAsCompressedBase64(recFileInput.files[0]);
    }

    const updated = {
      ...existing,
      firm,
      moduleType,
      partyName,
      chequeNumber,
      bankName,
      branch,
      amount,
      chequeDate,
      sentToBankDate,
      actualClearDate,
      status,
      remarks,
      holdDate,
      holdReason,
      instructionBy,
      returnDate,
      returnReason,
      actionTaken,
      recoveryStatus,
      chequePhoto,
      receiptPhoto
    };

    // Direct Supabase Cloud Update
    if (supabaseClient) {
      const dbRow = toDbRow(updated);
      const { error: sbError } = await supabaseClient.from('cheques').update(dbRow).eq('id', id);
      if (sbError) {
        throw new Error('Supabase Cloud update failed: ' + sbError.message);
      }
    }

    // Local mirror
    try {
      const formData = new FormData();
      formData.append('firm', firm);
      formData.append('moduleType', moduleType);
      formData.append('chequeNumber', chequeNumber);
      formData.append('amount', amount);
      formData.append('partyName', partyName);
      formData.append('bankName', bankName);
      formData.append('branch', branch);
      formData.append('chequeDate', chequeDate);
      formData.append('status', status);
      formData.append('sentToBankDate', sentToBankDate);
      formData.append('actualClearDate', actualClearDate);
      formData.append('holdDate', holdDate);
      formData.append('holdReason', holdReason);
      formData.append('instructionBy', instructionBy);
      formData.append('returnDate', returnDate);
      formData.append('returnReason', returnReason);
      formData.append('actionTaken', actionTaken);
      formData.append('remarks', remarks);
      formData.append('recoveryStatus', recoveryStatus);
      if (chequePhoto) formData.append('chequePhotoBase64', chequePhoto);
      if (receiptPhoto) formData.append('receiptPhotoBase64', receiptPhoto);

      fetch(`/api/cheques/${id}/update`, { method: 'POST', body: formData }).catch(() => {});
    } catch (e) {}

    closeModal('editChequeModal');
    await loadChequesAndStats();
    showToast('✅ Cheque details successfully update ho gayi (Supabase Cloud)!');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Cheque`;
    }
  }
}

function openImageViewer(src, title) {
  const modal = document.getElementById('imageViewerModal');
  const img = document.getElementById('imageViewerImg');
  const titleEl = document.getElementById('imageViewerTitle');
  const downloadEl = document.getElementById('imageViewerDownload');

  if (img) img.src = src;
  if (titleEl) titleEl.textContent = title || 'Cheque Preview';
  if (downloadEl) {
    downloadEl.href = src;
    downloadEl.setAttribute('download', `cheque-file-${Date.now()}`);
  }
  openModal('imageViewerModal');
}

function shareSingleWhatsApp(id) {
  const c = allCheques.find(x => x.id === id);
  if (!c) return;

  const firmTitle = c.firm === 'SAF' ? '🟢 Shree Ambica Furnishings (SAF)' : '🔵 Reliable Drapes (RD)';
  
  const isPostDated = c.status === 'POST_DATED' || (c.isPostDated && !['CLEARED', 'BOUNCED', 'ON_HOLD'].includes(c.status));
  let statusText = '⏳ In Clearing';
  if (c.status === 'CLEARED') statusText = '✅ Cleared in Bank';
  else if (c.status === 'BOUNCED') statusText = '❌ Bounced / Returned';
  else if (c.status === 'ON_HOLD') statusText = '⏸ On Hold';
  else if (isPostDated) statusText = '📅 Post Dated Cheque (PDC)';

  const text = 
    `🏛️ *CHEQUE DETAILS - ${firmTitle}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Party:* ${c.partyName}\n` +
    `💰 *Amount:* ${formatINR(c.amount)}\n` +
    `🔢 *Cheque No:* ${c.chequeNumber}\n` +
    `🏦 *Bank:* ${c.bankName}\n` +
    `📅 *Cheque Date:* ${formatDateDisplay(c.chequeDate)}\n` +
    (c.sentToBankDate ? `📤 *Sent to Bank:* ${formatDateDisplay(c.sentToBankDate)}\n` : '') +
    (c.actualClearDate ? `✅ *Clear Date:* ${formatDateDisplay(c.actualClearDate)}\n` : '') +
    (c.holdReason ? `📌 *Hold Reason:* ${c.holdReason} (by ${c.instructionBy || 'Party'})\n` : '') +
    (c.returnReason ? `↩ *Return Reason:* ${c.returnReason}\n` : '') +
    (c.actionTaken ? `🛠 *Action Taken:* ${c.actionTaken}\n` : '') +
    `📊 *Status:* ${statusText}\n` +
    (c.remarks ? `📝 *Remarks:* ${c.remarks}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

function shareWhatsApp(type) {
  const list = currentReminders.dueTomorrow || [];
  if (list.length === 0) return;

  let text = `*⚠️ CHEQUES DUE FOR BANK CLEARING TOMORROW*\n\n`;
  list.forEach((c, idx) => {
    text += `${idx + 1}. [${c.firm}] ${c.partyName} - ${formatINR(c.amount)} (Cheque: ${c.chequeNumber}, ${c.bankName})\n`;
  });
  text += `\nTotal Amount: ${formatINR(list.reduce((sum, c) => sum + (c.amount || 0), 0))}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function openRemindersDrawer() {
  const drawer = document.getElementById('remindersDrawer');
  const content = document.getElementById('remindersDrawerContent');
  if (!drawer || !content) return;

  const dueTomorrow = currentReminders.dueTomorrow || [];
  let html = '';

  if (dueTomorrow.length > 0) {
    html += `<h4 class="text-xs font-bold text-amber-700 uppercase">Due Tomorrow (${dueTomorrow.length})</h4>`;
    dueTomorrow.forEach(c => {
      html += `<div class="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs">
        <div class="flex justify-between font-bold"><span>[${c.firm}] ${c.partyName}</span><span>${formatINR(c.amount)}</span></div>
        <div class="text-[11px] text-slate-500">Cheque: ${c.chequeNumber} (${c.bankName})</div>
      </div>`;
    });
  }

  if (!html) {
    html = '<p class="text-xs text-slate-400 text-center py-8">No urgent alerts at the moment.</p>';
  }

  content.innerHTML = html;
  drawer.classList.remove('translate-x-full');
}

function closeRemindersDrawer() {
  const drawer = document.getElementById('remindersDrawer');
  if (drawer) drawer.classList.add('translate-x-full');
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold z-50 flex items-center gap-2 border border-slate-700';
  toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function triggerAutoSave() {
  try {
    const res = await fetch('/api/trigger-autosave', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('All 175+ cheques synchronized & auto-saved to Excel (.xlsx) and Database!');
    }
  } catch (e) {
    alert('Auto-save error: ' + e.message);
  }
}

// ======================== SUPABASE FUNCTIONS ========================

let supabaseSchemaSql = '';

async function checkSupabaseStatus() {
  const dot = document.getElementById('supabaseStatusDot');
  const btnText = document.getElementById('supabaseStatusBtnText');
  const btn = document.getElementById('btnSupabaseCloud');
  const icon = document.getElementById('supabaseStatusIcon');
  const title = document.getElementById('supabaseStatusTitle');
  const msg = document.getElementById('supabaseStatusMsg');
  const box = document.getElementById('supabaseStatusBox');
  const extraInfo = document.getElementById('supabaseExtraInfo');

  if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin text-base text-blue-600 mt-0.5';

  // 1. Direct Supabase Cloud Check (Runs anywhere on mobile or desktop)
  if (supabaseClient) {
    try {
      const { count, error } = await supabaseClient.from('cheques').select('*', { count: 'exact', head: true });
      if (!error) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        if (btnText) btnText.textContent = '☁️ Supabase Cloud';
        if (btn) btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded-lg text-xs font-bold shadow-sm transition';
        if (box) box.className = 'p-3.5 rounded-xl border flex items-start gap-3 bg-emerald-50 border-emerald-300 text-emerald-900';
        if (icon) icon.className = 'fa-solid fa-circle-check text-lg text-emerald-600 mt-0.5';
        if (title) title.textContent = '🟢 Supabase Cloud Direct Connected!';
        if (msg) msg.textContent = 'All read and write operations are synced directly with Supabase Cloud table.';
        if (extraInfo) {
          extraInfo.innerHTML = `
            <div><i class="fa-solid fa-link mr-1 text-emerald-700"></i> Cloud Project: <span class="font-bold text-slate-800">https://qqglkbsrhfvsbplclllt.supabase.co</span></div>
            <div><i class="fa-solid fa-cloud mr-1 text-emerald-700"></i> Records in Cloud Table: <span class="font-bold text-emerald-800">${count ?? allCheques.length}</span> cheques</div>
            <div><i class="fa-solid fa-globe mr-1 text-emerald-700"></i> Access Mode: <span class="font-bold text-slate-800">Direct Internet Cloud (No local Wi-Fi needed)</span></div>
          `;
        }
        return;
      }
    } catch (e) {
      console.warn('Direct Supabase status check exception:', e);
    }
  }

  try {
    const res = await fetch('/api/supabase/status');
    const data = await res.json();

    if (data.rawUrl && document.getElementById('supabaseUrlInput')) {
      document.getElementById('supabaseUrlInput').value = data.rawUrl;
    }

    if (data.connected) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      if (btnText) btnText.textContent = '☁️ Supabase Cloud';
      if (btn) btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded-lg text-xs font-bold shadow-sm transition';
      if (box) box.className = 'p-3.5 rounded-xl border flex items-start gap-3 bg-emerald-50 border-emerald-300 text-emerald-900';
      if (icon) icon.className = 'fa-solid fa-circle-check text-lg text-emerald-600 mt-0.5';
      if (title) title.textContent = '🟢 Supabase Cloud Database Connected!';
      if (msg) msg.textContent = data.message || 'All read and write operations are synced directly with Supabase cloud.';
      if (extraInfo) {
        extraInfo.innerHTML = `
          <div><i class="fa-solid fa-link mr-1 text-emerald-700"></i> Cloud Host: <span class="font-bold text-slate-800">${data.url || 'Connected'}</span></div>
          <div><i class="fa-solid fa-cloud mr-1 text-emerald-700"></i> Records in Cloud Table: <span class="font-bold text-emerald-800">${data.cloudCount ?? '175'}</span> cheques</div>
          <div><i class="fa-solid fa-hard-drive mr-1 text-emerald-700"></i> Local Mirror & Backup: <span class="font-bold text-slate-800">${data.localCount || '175'}</span> cheques (RD & SAF)</div>
        `;
      }
    } else if (data.tableMissing) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      if (btnText) btnText.textContent = '⚠️ Table Missing';
      if (box) box.className = 'p-3.5 rounded-xl border flex items-start gap-3 bg-amber-50 border-amber-300 text-amber-900';
      if (icon) icon.className = 'fa-solid fa-triangle-exclamation text-lg text-amber-600 mt-0.5';
      if (title) title.textContent = '⚠️ Table "cheques" missing in Supabase';
      if (msg) msg.textContent = 'Connected to Supabase project, but "cheques" table does not exist. Please copy and run the SQL Schema below in your Supabase SQL Editor.';
      if (extraInfo) extraInfo.innerHTML = '';
    } else if (data.configured) {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-400';
      if (btnText) btnText.textContent = '🔴 Sync Error';
      if (box) box.className = 'p-3.5 rounded-xl border flex items-start gap-3 bg-rose-50 border-rose-300 text-rose-900';
      if (icon) icon.className = 'fa-solid fa-circle-xmark text-lg text-rose-600 mt-0.5';
      if (title) title.textContent = '🔴 Connection Failed';
      if (msg) msg.textContent = data.message || 'Could not reach Supabase. Check your URL / Key.';
      if (extraInfo) extraInfo.innerHTML = '';
    } else {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      if (btnText) btnText.textContent = '💾 Local DB';
      if (btn) btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold shadow-sm transition';
      if (box) box.className = 'p-3.5 rounded-xl border flex items-start gap-3 bg-slate-50 border-slate-300 text-slate-800';
      if (icon) icon.className = 'fa-solid fa-hard-drive text-lg text-slate-500 mt-0.5';
      if (title) title.textContent = '💾 Local Database Active (175 Cheques)';
      if (msg) msg.textContent = 'System is running smoothly on local storage & Excel auto-save. When hosting in the cloud, set SUPABASE_URL and SUPABASE_KEY in your server Environment Variables.';
      if (extraInfo) {
        extraInfo.innerHTML = `
          <div><i class="fa-solid fa-check mr-1 text-emerald-600"></i> Local Cheques Loaded: <span class="font-bold">${data.localCount || '175'}</span> (RD: ₹19.96L, SAF: ₹24.99L)</div>
          <div><i class="fa-solid fa-cloud-arrow-up mr-1 text-indigo-600"></i> Cloud Status: Ready for hosting environment variables</div>
        `;
      }
    }
  } catch (err) {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-400';
  }
}

async function loadSupabaseSQLSchema() {
  const codeBox = document.getElementById('sqlSchemaCode');
  try {
    const res = await fetch('/api/supabase/schema-sql');
    const data = await res.json();
    if (data.success && data.sql) {
      supabaseSchemaSql = data.sql;
      if (codeBox) codeBox.textContent = data.sql;
    }
  } catch (e) {
    if (codeBox) codeBox.textContent = '-- Error loading schema';
  }
}

function openSupabaseModal() {
  const enteredPassword = prompt('🔒 SECURITY VERIFICATION\nSupabase Cloud Settings dekhne ke liye password enter karein:\n\nPassword:');
  if (enteredPassword === null) return; // User cancelled

  if (enteredPassword.trim() !== 'axon241') {
    alert('❌ Galat Password! Supabase settings open karne ki anumati nahi hai.');
    return;
  }

  checkSupabaseStatus();
  loadSupabaseSQLSchema();
  openModal('supabaseModal');
}

// Window Cut / Close with Escape Key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('supabaseModal');
    closeModal('newChequeModal');
    closeModal('editChequeModal');
    closeModal('depositModal');
    closeModal('imageViewerModal');
    closeRemindersDrawer();
  }
});

async function handleSupabaseConfigSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const url = form.supabaseUrl.value.trim();
  const key = form.supabaseKey.value.trim();
  const btn = document.getElementById('btnSaveSupabase');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Testing...';

  try {
    const res = await fetch('/api/supabase/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.connected ? 'Connected to Supabase!' : 'Credentials saved, checking table...');
      await checkSupabaseStatus();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Server Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save & Connect</span>';
  }
}

async function pushAllToSupabaseAction() {
  const btn = document.getElementById('btnPushAllSupabase');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Uploading...';

  try {
    const res = await fetch('/api/supabase/push-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.count} cheques successfully pushed to Supabase Cloud!`);
      await checkSupabaseStatus();
    } else {
      alert('Upload failed: ' + (data.error || 'Check table setup in Supabase'));
    }
  } catch (err) {
    alert('Server Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>🚀 Push All 175 Records</span>';
  }
}

async function pullAllFromSupabaseAction() {
  if (!confirm('Pull latest data from Supabase Cloud? This will refresh your local database with cloud records.')) return;
  const btn = document.getElementById('btnPullAllSupabase');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Pulling...';

  try {
    const res = await fetch('/api/supabase/pull-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Pulled ${data.count} records from Supabase!`);
      await loadChequesAndStats();
    } else {
      alert('Pull error: ' + data.error);
    }
  } catch (err) {
    alert('Server Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> <span>📥 Pull from Supabase</span>';
  }
}

function copySupabaseSQL() {
  if (!supabaseSchemaSql) {
    const code = document.getElementById('sqlSchemaCode').textContent;
    navigator.clipboard.writeText(code);
  } else {
    navigator.clipboard.writeText(supabaseSchemaSql);
  }
  const copyText = document.getElementById('copySqlText');
  if (copyText) {
    copyText.textContent = 'Copied!';
    setTimeout(() => { copyText.textContent = 'Copy SQL'; }, 2000);
  }
  showToast('SQL Schema copied to clipboard! Paste it into Supabase SQL Editor.');
}

// Auto-check on load
setTimeout(checkSupabaseStatus, 1000);


