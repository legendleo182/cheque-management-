const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CHEQUES_UPLOADS = path.join(UPLOADS_DIR, 'cheques');
const RECEIPTS_UPLOADS = path.join(UPLOADS_DIR, 'receipts');
const DB_FILE = path.join(DATA_DIR, 'cheques.json');

[DATA_DIR, BACKUPS_DIR, UPLOADS_DIR, CHEQUES_UPLOADS, RECEIPTS_UPLOADS].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'receiptPhoto') {
      cb(null, RECEIPTS_UPLOADS);
    } else {
      cb(null, CHEQUES_UPLOADS);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

const { autoSaveExcelAndDatabase, EXPORTS_DIR } = require('./excelSync');
const {
  isSupabaseConfigured,
  getCredentials,
  saveCredentials,
  testConnection,
  pushAllToSupabase,
  pullAllFromSupabase,
  clearAllFromSupabase,
  syncSingleCheque,
  deleteSingleCheque,
  initSupabaseBackend
} = require('./supabaseClient');

function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { cheques: [], settings: {} };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database:', err);
    return { cheques: [], settings: {} };
  }
}

function writeDatabase(data) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonStr, 'utf8');
    fs.renameSync(tempFile, DB_FILE);

    // Periodic backup
    const backupFile = path.join(BACKUPS_DIR, `cheques_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, jsonStr, 'utf8');
    cleanOldBackups();

    // AUTO-SAVE to Excel & Daily Database Backup!
    autoSaveExcelAndDatabase(data);

    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// ========================================================
// AUTO-PURGE: Cleared cheques older than 21 days (Day 22+)
// ========================================================
async function autoPurgeOldClearedCheques() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const db = readDatabase();
    if (!db || !Array.isArray(db.cheques)) return { purgedCount: 0 };

    const toPurge = [];
    const remaining = [];

    db.cheques.forEach(c => {
      if (c.status === 'CLEARED') {
        const clrDateStr = c.actualClearDate || c.clearingDate;
        if (clrDateStr) {
          const clrDate = new Date(clrDateStr);
          clrDate.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today.getTime() - clrDate.getTime()) / (1000 * 60 * 60 * 24));
          // If 21 days completed -> on 22nd day onwards (>= 22), purge automatically
          if (diffDays >= 22) {
            toPurge.push({
              ...c,
              daysSinceCleared: diffDays,
              purgedAt: new Date().toISOString()
            });
            return;
          }
        }
      }
      remaining.push(c);
    });

    // Also check Supabase Cloud table directly
    const { getClient } = require('./supabaseClient');
    const supabase = getClient();
    let cloudPurgedCount = 0;

    if (supabase) {
      try {
        const { data: cloudCleared } = await supabase
          .from('cheques')
          .select('id, party_name, cheque_number, amount, actual_clear_date, clearing_date, status')
          .eq('status', 'CLEARED');

        if (cloudCleared && cloudCleared.length > 0) {
          const cloudToPurgeIds = [];
          cloudCleared.forEach(c => {
            const clrDateStr = c.actual_clear_date || c.clearing_date;
            if (clrDateStr) {
              const clrDate = new Date(clrDateStr);
              clrDate.setHours(0, 0, 0, 0);
              const diffDays = Math.floor((today.getTime() - clrDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays >= 22) {
                cloudToPurgeIds.push(c.id);
              }
            }
          });

          if (cloudToPurgeIds.length > 0) {
            console.log(`[Auto-Purge] Deleting ${cloudToPurgeIds.length} cleared cheques (Day 22+) from Supabase Cloud...`);
            const { error: delErr } = await supabase.from('cheques').delete().in('id', cloudToPurgeIds);
            if (!delErr) {
              cloudPurgedCount = cloudToPurgeIds.length;
            } else {
              console.error('[Auto-Purge] Supabase delete error:', delErr.message);
            }
          }
        }
      } catch (sbErr) {
        console.warn('[Auto-Purge] Supabase cloud purge check warning:', sbErr.message);
      }
    }

    if (toPurge.length > 0) {
      console.log(`[Auto-Purge] Found ${toPurge.length} local cleared cheques on Day 22+. Purging & archiving...`);

      // 1. Archive to permanent audit backup
      const archiveFile = path.join(BACKUPS_DIR, 'purged_cleared_cheques_archive.json');
      let archive = [];
      if (fs.existsSync(archiveFile)) {
        try {
          archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
        } catch (e) {}
      }
      archive.push(...toPurge);
      fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2), 'utf8');

      // 2. Save remaining back to local DB
      db.cheques = remaining;
      writeDatabase(db);
    }

    return {
      success: true,
      purgedCount: toPurge.length,
      cloudPurgedCount,
      purgedCheques: toPurge
    };
  } catch (err) {
    console.error('[Auto-Purge Error]', err);
    return { success: false, error: err.message };
  }
}

// Hourly check to ensure daily snapshot & auto-purging old cleared cheques
setInterval(() => {
  try {
    const db = readDatabase();
    autoSaveExcelAndDatabase(db);
    autoPurgeOldClearedCheques();
  } catch (e) {
    console.error('Daily scheduler error:', e);
  }
}, 30 * 60 * 1000); // Every 30 mins

// Run auto-purge check on startup
setTimeout(autoPurgeOldClearedCheques, 4000);

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('cheques_backup_'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length > 10) {
      files.slice(10).forEach(f => {
        fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
      });
    }
  } catch (e) {}
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function addThreeMonths(dateStr) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 3);
  return d;
}

// Enrich cheque record with dynamic calculation
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

  // Effective Clearing Date / Release Date
  const effectiveClearingDateStr = cheque.postponedDate || cheque.releaseDate || cheque.clearingDate || cheque.chequeDate;
  const clearingDateObj = new Date(effectiveClearingDateStr);
  clearingDateObj.setHours(0, 0, 0, 0);

  const daysToClearing = Math.ceil((clearingDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Reminders
  const isPending = ['IN_HAND', 'ON_HOLD', 'SENT_FOR_CLEARING', 'POSTPONED'].includes(cheque.status);
  const isDueTomorrow = isPending && daysToClearing === 1;
  const isDueToday = isPending && daysToClearing === 0;
  const isOverdue = isPending && daysToClearing < 0;

  // Days on Hold (auto calculated)
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
    expiryDate: formatDate(expiryDate),
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

// API: GET /api/cheques
app.get('/api/cheques', (req, res) => {
  const db = readDatabase();
  const todayStr = req.query.today || formatDate(new Date());
  let list = db.cheques.map(c => enrichCheque(c, todayStr));

  // Firm filter: RD, SAF, ALL
  const firm = req.query.firm ? req.query.firm.toUpperCase() : 'ALL';
  if (firm === 'RD' || firm === 'SAF') {
    list = list.filter(c => c.firm === firm);
  }

  // Module Tab filter: clearing, hold, returned, post_dated, due_tomorrow, stale, cleared, bounced
  const tab = req.query.tab || 'all';
  if (tab === 'clearing') {
    list = list.filter(c => c.moduleType === 'CLEARING');
  } else if (tab === 'hold') {
    list = list.filter(c => c.moduleType === 'HOLD');
  } else if (tab === 'returned') {
    list = list.filter(c => c.moduleType === 'RETURNED');
  } else if (tab === 'post_dated') {
    list = list.filter(c => c.isPostDated || c.status === 'POST_DATED');
  } else if (tab === 'due_tomorrow') {
    list = list.filter(c => c.isDueTomorrow);
  } else if (tab === 'stale') {
    list = list.filter(c => c.isStale);
  } else if (tab === 'cleared') {
    list = list.filter(c => c.status === 'CLEARED');
  } else if (tab === 'bounced') {
    list = list.filter(c => c.status === 'BOUNCED');
  }

  // Search filter
  const q = req.query.search ? req.query.search.toLowerCase().trim() : '';
  if (q) {
    list = list.filter(c => 
      c.partyName.toLowerCase().includes(q) ||
      c.chequeNumber.toLowerCase().includes(q) ||
      c.bankName.toLowerCase().includes(q) ||
      (c.holdReason && c.holdReason.toLowerCase().includes(q)) ||
      (c.returnReason && c.returnReason.toLowerCase().includes(q)) ||
      (c.instructionBy && c.instructionBy.toLowerCase().includes(q)) ||
      (c.actionTaken && c.actionTaken.toLowerCase().includes(q))
    );
  }

  res.json({
    success: true,
    count: list.length,
    cheques: list
  });
});

// API: GET /api/stats - Dashboard Breakdown (RD vs SAF vs Total)
app.get('/api/stats', (req, res) => {
  const db = readDatabase();
  const todayStr = req.query.today || formatDate(new Date());
  const enriched = db.cheques.map(c => enrichCheque(c, todayStr));

  const firm = req.query.firm ? req.query.firm.toUpperCase() : 'ALL';
  const filterList = (firm === 'RD' || firm === 'SAF') ? enriched.filter(c => c.firm === firm) : enriched;

  const clearingList = enriched.filter(c => c.moduleType === 'CLEARING');
  const holdList = enriched.filter(c => c.moduleType === 'HOLD');
  const returnedList = enriched.filter(c => c.moduleType === 'RETURNED');

  const stats = {
    // Top Summary Blocks
    clearing: {
      totalAmount: clearingList.reduce((acc, c) => acc + (c.amount || 0), 0),
      totalCount: clearingList.length,
      rdAmount: clearingList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (c.amount || 0), 0),
      rdCount: clearingList.filter(c => c.firm === 'RD').length,
      safAmount: clearingList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (c.amount || 0), 0),
      safCount: clearingList.filter(c => c.firm === 'SAF').length,
    },
    hold: {
      totalAmount: holdList.reduce((acc, c) => acc + (c.amount || 0), 0),
      totalCount: holdList.length,
      rdAmount: holdList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (c.amount || 0), 0),
      rdCount: holdList.filter(c => c.firm === 'RD').length,
      safAmount: holdList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (c.amount || 0), 0),
      safCount: holdList.filter(c => c.firm === 'SAF').length,
    },
    returned: {
      totalAmount: returnedList.reduce((acc, c) => acc + (c.amount || 0), 0),
      totalCount: returnedList.length,
      rdAmount: returnedList.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (c.amount || 0), 0),
      rdCount: returnedList.filter(c => c.firm === 'RD').length,
      safAmount: returnedList.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (c.amount || 0), 0),
      safCount: returnedList.filter(c => c.firm === 'SAF').length,
    },
    totals: {
      rdTotalAmount: enriched.filter(c => c.firm === 'RD').reduce((acc, c) => acc + (c.amount || 0), 0),
      rdTotalCount: enriched.filter(c => c.firm === 'RD').length,
      safTotalAmount: enriched.filter(c => c.firm === 'SAF').reduce((acc, c) => acc + (c.amount || 0), 0),
      safTotalCount: enriched.filter(c => c.firm === 'SAF').length,
      grandTotalAmount: enriched.reduce((acc, c) => acc + (c.amount || 0), 0),
      grandTotalCount: enriched.length
    },
    // Reminders
    dueTomorrowCount: filterList.filter(c => c.isDueTomorrow).length,
    dueTomorrowAmount: filterList.filter(c => c.isDueTomorrow).reduce((acc, c) => acc + (c.amount || 0), 0),
    dueTodayCount: filterList.filter(c => c.isDueToday).length,
    dueTodayAmount: filterList.filter(c => c.isDueToday).reduce((acc, c) => acc + (c.amount || 0), 0),
    staleCount: filterList.filter(c => c.isStale).length,
    staleAmount: filterList.filter(c => c.isStale).reduce((acc, c) => acc + (c.amount || 0), 0),
    postDatedCount: filterList.filter(c => c.isPostDated || c.status === 'POST_DATED').length,
    postDatedAmount: filterList.filter(c => c.isPostDated || c.status === 'POST_DATED').reduce((acc, c) => acc + (c.amount || 0), 0)
  };

  res.json({ success: true, stats, settings: db.settings });
});

// API: GET /api/reminders
app.get('/api/reminders', (req, res) => {
  const db = readDatabase();
  const todayStr = req.query.today || formatDate(new Date());
  const enriched = db.cheques.map(c => enrichCheque(c, todayStr));

  const dueTomorrow = enriched.filter(c => c.isDueTomorrow);
  const dueToday = enriched.filter(c => c.isDueToday);
  const staleCheques = enriched.filter(c => c.isStale);

  res.json({
    success: true,
    reminders: {
      dueTomorrow,
      dueToday,
      staleCheques
    }
  });
});

// API: POST /api/cheques - Add New Cheque
app.post('/api/cheques', upload.fields([
  { name: 'chequePhoto', maxCount: 1 },
  { name: 'receiptPhoto', maxCount: 1 }
]), (req, res) => {
  try {
    const db = readDatabase();
    const body = req.body;

    const moduleType = body.moduleType || 'CLEARING';
    const prefix = moduleType === 'HOLD' ? 'HLD' : (moduleType === 'RETURNED' ? 'RET' : 'CLR');
    const newSrNo = db.cheques.filter(c => c.moduleType === moduleType).length + 1;
    const newId = `${prefix}-${String(newSrNo).padStart(4, '0')}`;

    const chequePhotoPath = req.files && req.files.chequePhoto && req.files.chequePhoto[0] 
      ? `/uploads/cheques/${req.files.chequePhoto[0].filename}` 
      : (body.chequePhotoBase64 || '');

    const receiptPhotoPath = req.files && req.files.receiptPhoto && req.files.receiptPhoto[0] 
      ? `/uploads/receipts/${req.files.receiptPhoto[0].filename}` 
      : '';

    const newCheque = {
      id: newId,
      srNo: newSrNo,
      firm: (body.firm || 'RD').toUpperCase(),
      moduleType,
      chequeNumber: body.chequeNumber || '',
      partyName: body.partyName || '',
      bankName: body.bankName || '',
      branch: body.branch || '',
      amount: parseFloat(body.amount) || 0,
      chequeDate: body.chequeDate || formatDate(new Date()),
      clearingDate: body.clearingDate || body.chequeDate || formatDate(new Date()),
      sentToBankDate: body.sentToBankDate || '',
      actualClearDate: body.actualClearDate || '',
      holdDate: body.holdDate || '',
      holdReason: body.holdReason || '',
      instructionBy: body.instructionBy || '',
      returnDate: body.returnDate || '',
      returnReason: body.returnReason || '',
      actionTaken: body.actionTaken || '',
      recoveryStatus: body.recoveryStatus || 'UNRESOLVED',
      status: body.status || (moduleType === 'HOLD' ? 'ON_HOLD' : (moduleType === 'RETURNED' ? 'BOUNCED' : (body.chequeDate && new Date(body.chequeDate) > new Date(formatDate(new Date())) ? 'POST_DATED' : 'SENT_FOR_CLEARING'))),
      chequePhoto: chequePhotoPath,
      receiptPhoto: receiptPhotoPath,
      remarks: body.remarks || '',
      createdAt: new Date().toISOString()
    };

    db.cheques.unshift(newCheque);
    writeDatabase(db);
    syncSingleCheque(newCheque).catch(e => console.error('Supabase async sync err:', e));

    res.json({
      success: true,
      message: 'Cheque record added successfully!',
      cheque: enrichCheque(newCheque, formatDate(new Date()))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: POST /api/cheques/:id/deposit - Upload Receipt & Update
app.post('/api/cheques/:id/deposit', upload.single('receiptPhoto'), (req, res) => {
  try {
    const db = readDatabase();
    const id = req.params.id;
    const cheque = db.cheques.find(c => c.id === id);

    if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

    const receiptPhotoPath = req.file 
      ? `/uploads/receipts/${req.file.filename}` 
      : (req.body.receiptPhotoBase64 || cheque.receiptPhoto || '');

    cheque.status = 'SENT_FOR_CLEARING';
    cheque.receiptPhoto = receiptPhotoPath;
    cheque.sentToBankDate = req.body.depositDate || formatDate(new Date());
    cheque.depositAccount = req.body.bankAccount || '';
    if (req.body.depositNotes) {
      cheque.remarks = (cheque.remarks ? cheque.remarks + ' | ' : '') + req.body.depositNotes;
    }

    writeDatabase(db);
    syncSingleCheque(cheque).catch(e => console.error('Supabase async sync err:', e));
    res.json({
      success: true,
      message: 'Deposit slip uploaded and cheque marked in clearing!',
      cheque: enrichCheque(cheque, formatDate(new Date()))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: POST /api/cheques/:id/clear
app.post('/api/cheques/:id/clear', (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const cheque = db.cheques.find(c => c.id === id);
  if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

  cheque.status = 'CLEARED';
  cheque.actualClearDate = req.body.clearanceDate || formatDate(new Date());

  writeDatabase(db);
  syncSingleCheque(cheque).catch(e => console.error('Supabase async sync err:', e));
  res.json({ success: true, message: 'Cheque marked as Cleared!', cheque });
});

// API: POST /api/cheques/:id/bounce
app.post('/api/cheques/:id/bounce', (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const cheque = db.cheques.find(c => c.id === id);
  if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

  cheque.status = 'BOUNCED';
  cheque.moduleType = 'RETURNED';
  cheque.returnDate = req.body.bounceDate || formatDate(new Date());
  cheque.returnReason = req.body.bounceReason || 'Insufficient Funds';
  cheque.actionTaken = req.body.actionTaken || 'Sent to PNP';
  cheque.recoveryStatus = req.body.recoveryStatus || 'UNRESOLVED';
  cheque.bankCharges = parseFloat(req.body.bankCharges) || 0;

  writeDatabase(db);
  syncSingleCheque(cheque).catch(e => console.error('Supabase async sync err:', e));
  res.json({ success: true, message: 'Cheque marked as Returned / Bounced!', cheque });
});

// API: POST /api/cheques/:id/hold - Put on hold
app.post('/api/cheques/:id/hold', (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const cheque = db.cheques.find(c => c.id === id);
  if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

  cheque.moduleType = 'HOLD';
  cheque.status = 'ON_HOLD';
  cheque.holdDate = req.body.holdDate || formatDate(new Date());
  cheque.holdReason = req.body.holdReason || 'Hold by Party';
  cheque.instructionBy = req.body.instructionBy || 'Hold by Party';
  cheque.releaseDate = req.body.releaseDate || '';

  writeDatabase(db);
  syncSingleCheque(cheque).catch(e => console.error('Supabase async sync err:', e));
  res.json({ success: true, message: 'Cheque placed on Hold!', cheque });
});

// API: POST /api/cheques/:id/release-hold - Release hold to clearing
app.post('/api/cheques/:id/release-hold', (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const cheque = db.cheques.find(c => c.id === id);
  if (!cheque) return res.status(404).json({ success: false, error: 'Cheque not found' });

  cheque.moduleType = 'CLEARING';
  cheque.status = 'SENT_FOR_CLEARING';
  cheque.sentToBankDate = req.body.depositDate || formatDate(new Date());

  writeDatabase(db);
  syncSingleCheque(cheque).catch(e => console.error('Supabase async sync err:', e));
  res.json({ success: true, message: 'Cheque released to Bank Clearing!', cheque });
});

// API: PUT /api/cheques/:id or POST /api/cheques/:id/update - Edit/Update Cheque Details
const handleUpdateCheque = (req, res) => {
  try {
    const db = readDatabase();
    const id = req.params.id;
    const cheque = db.cheques.find(c => c.id === id);
    if (!cheque) return res.status(404).json({ success: false, error: 'Cheque record not found' });

    const body = req.body;
    if (body.firm) cheque.firm = body.firm.toUpperCase().trim();
    if (body.moduleType) cheque.moduleType = body.moduleType.trim();
    if (body.chequeNumber !== undefined) cheque.chequeNumber = body.chequeNumber.trim();
    if (body.partyName !== undefined) cheque.partyName = body.partyName.trim();
    if (body.bankName !== undefined) cheque.bankName = body.bankName.trim();
    if (body.branch !== undefined) cheque.branch = body.branch.trim();
    if (body.amount !== undefined) cheque.amount = parseFloat(body.amount) || 0;
    if (body.chequeDate !== undefined) cheque.chequeDate = body.chequeDate;
    if (body.clearingDate !== undefined) cheque.clearingDate = body.clearingDate;
    if (body.sentToBankDate !== undefined) cheque.sentToBankDate = body.sentToBankDate;
    if (body.actualClearDate !== undefined) cheque.actualClearDate = body.actualClearDate;
    if (body.holdDate !== undefined) cheque.holdDate = body.holdDate;
    if (body.holdReason !== undefined) cheque.holdReason = body.holdReason;
    if (body.instructionBy !== undefined) cheque.instructionBy = body.instructionBy;
    if (body.returnDate !== undefined) cheque.returnDate = body.returnDate;
    if (body.returnReason !== undefined) cheque.returnReason = body.returnReason;
    if (body.actionTaken !== undefined) cheque.actionTaken = body.actionTaken;
    if (body.recoveryStatus !== undefined) cheque.recoveryStatus = body.recoveryStatus;
    if (body.status !== undefined) cheque.status = body.status;
    if (body.remarks !== undefined) cheque.remarks = body.remarks;

    // Handle photo updates
    if (req.files && req.files.chequePhoto && req.files.chequePhoto[0]) {
      cheque.chequePhoto = `/uploads/cheques/${req.files.chequePhoto[0].filename}`;
    } else if (body.chequePhotoBase64) {
      cheque.chequePhoto = body.chequePhotoBase64;
    }

    if (req.files && req.files.receiptPhoto && req.files.receiptPhoto[0]) {
      cheque.receiptPhoto = `/uploads/receipts/${req.files.receiptPhoto[0].filename}`;
    } else if (body.receiptPhotoBase64) {
      cheque.receiptPhoto = body.receiptPhotoBase64;
    }

    cheque.updatedAt = new Date().toISOString();

    writeDatabase(db);
    syncSingleCheque(cheque).catch(e => console.error('Supabase sync edit err:', e));

    res.json({
      success: true,
      message: 'Cheque record updated successfully!',
      cheque: enrichCheque(cheque, formatDate(new Date()))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.put('/api/cheques/:id', upload.fields([
  { name: 'chequePhoto', maxCount: 1 },
  { name: 'receiptPhoto', maxCount: 1 }
]), handleUpdateCheque);

app.post('/api/cheques/:id/update', upload.fields([
  { name: 'chequePhoto', maxCount: 1 },
  { name: 'receiptPhoto', maxCount: 1 }
]), handleUpdateCheque);

// API: DELETE /api/cheques/:id (Protected by password: axon241)
app.delete('/api/cheques/:id', (req, res) => {
  const password = req.body?.password || req.headers['x-delete-password'] || req.query.password;
  if (password !== 'axon241') {
    return res.status(403).json({
      success: false,
      error: 'Security authorization failed: Galat Password! Cheque delete karne ki anumati nahi hai.'
    });
  }

  const db = readDatabase();
  const id = req.params.id;
  db.cheques = db.cheques.filter(c => c.id !== id);
  writeDatabase(db);
  deleteSingleCheque(id).catch(e => console.error('Supabase async delete err:', e));
  res.json({ success: true, message: 'Cheque deleted successfully.' });
});

// API: POST /api/cheques/clear-all (Password protected: axon241)
app.post('/api/cheques/clear-all', async (req, res) => {
  const password = req.body?.password || req.headers['x-delete-password'] || req.query.password;
  if (password !== 'axon241') {
    return res.status(403).json({
      success: false,
      error: 'Security authorization failed: Galat Password! Data clear karne ki anumati nahi hai.'
    });
  }

  try {
    const db = readDatabase();
    const countBefore = (db.cheques || []).length;

    // Backup before clear
    const backupFile = path.join(BACKUPS_DIR, `cheques_pre_clear_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(db, null, 2), 'utf8');

    // Reset local cheques array
    db.cheques = [];
    writeDatabase(db);

    // Also clear Supabase cloud database if configured
    let cloudCleared = false;
    if (isSupabaseConfigured()) {
      const clearRes = await clearAllFromSupabase();
      cloudCleared = clearRes.success;
    }

    res.json({
      success: true,
      message: `Pura data clear ho gaya! ${countBefore} cheques remove ho chuke hain. Ab aap fresh nayi entries kar sakte hain.`,
      countCleared: countBefore,
      cloudCleared
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Export CSV exactly matching the sheet format
app.get('/api/export/csv', (req, res) => {
  const db = readDatabase();
  const todayStr = formatDate(new Date());
  const firm = req.query.firm ? req.query.firm.toUpperCase() : 'ALL';
  let list = db.cheques.map(c => enrichCheque(c, todayStr));

  if (firm === 'RD' || firm === 'SAF') {
    list = list.filter(c => c.firm === firm);
  }

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Sr #',
    'Firm (RD / SAF)',
    'Module',
    'Cheque Date',
    'Party Name / Particulars',
    'Cheque Number',
    'Drawn On (Bank)',
    'Amount (INR)',
    'Sent to Bank Date',
    'Actual Clear Date',
    'Hold Date',
    'Hold Reason',
    'Instruction By',
    'Return Date',
    'Return Reason',
    'Action Taken',
    'Status',
    'Remarks'
  ];

  const rows = list.map((c, idx) => [
    escapeCSV(idx + 1),
    escapeCSV(c.firm),
    escapeCSV(c.moduleType),
    escapeCSV(c.chequeDate),
    escapeCSV(c.partyName),
    escapeCSV(c.chequeNumber),
    escapeCSV(c.bankName),
    escapeCSV(c.amount),
    escapeCSV(c.sentToBankDate),
    escapeCSV(c.actualClearDate),
    escapeCSV(c.holdDate),
    escapeCSV(c.holdReason),
    escapeCSV(c.instructionBy),
    escapeCSV(c.returnDate),
    escapeCSV(c.returnReason),
    escapeCSV(c.actionTaken),
    escapeCSV(c.status),
    escapeCSV(c.remarks)
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Cheque_Register_${firm}_${todayStr}.csv`);
  res.send(csvContent);
});

// Download Real Multi-Sheet Master Excel (.xlsx) file
app.get('/api/download/master-excel', (req, res) => {
  const masterPath = path.join(__dirname, 'exports', 'Cheque_Master_Register.xlsx');
  if (!fs.existsSync(masterPath)) {
    const db = readDatabase();
    autoSaveExcelAndDatabase(db);
  }
  const fileName = `Cheque_Master_Register_${formatDate(new Date())}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const fileStream = fs.createReadStream(masterPath);
  fileStream.pipe(res);
});

// Trigger Manual Auto-Save
app.post('/api/trigger-autosave', (req, res) => {
  const db = readDatabase();
  const result = autoSaveExcelAndDatabase(db);
  res.json({ success: true, message: 'Excel and Database Auto-Saved!', ...result });
});

// ======================== SUPABASE API ROUTES ========================

// GET /api/supabase/status - Get config & connection test
app.get('/api/supabase/status', async (req, res) => {
  const creds = getCredentials();
  const configured = Boolean(creds.url && creds.key);
  const db = readDatabase();
  let connection = { connected: false, message: 'Not configured in environment variables or .env' };

  if (configured) {
    connection = await testConnection();
  }

  // Mask URL for display
  let maskedUrl = creds.url;
  try {
    if (maskedUrl) {
      const u = new URL(maskedUrl);
      maskedUrl = `${u.protocol}//${u.hostname.substring(0, 8)}...${u.hostname.slice(-12)}`;
    }
  } catch (e) {}

  res.json({
    success: true,
    configured,
    url: maskedUrl,
    rawUrl: creds.url,
    connected: connection.connected,
    tableMissing: Boolean(connection.tableMissing),
    message: connection.message,
    cloudCount: connection.count ?? null,
    localCount: (db.cheques || []).length
  });
});

// POST /api/supabase/config - Save credentials & test (for optional server config)
app.post('/api/supabase/config', async (req, res) => {
  const { url, key } = req.body;
  if (!url || !key) {
    return res.status(400).json({ success: false, error: 'URL and Key are required' });
  }

  saveCredentials(url, key);
  const test = await testConnection();
  if (test.connected) {
    // If connected and cloud is empty, seed automatically
    const db = readDatabase();
    if (test.count === 0 && db.cheques && db.cheques.length > 0) {
      await pushAllToSupabase(db.cheques);
    }
  }

  res.json({
    success: true,
    message: 'Supabase credentials saved successfully to backend environment!',
    connected: test.connected,
    tableMissing: Boolean(test.tableMissing),
    testMessage: test.message
  });
});

// POST /api/supabase/push-all - Upload all local cheques to Supabase
app.post('/api/supabase/push-all', async (req, res) => {
  const db = readDatabase();
  const result = await pushAllToSupabase(db.cheques || []);
  res.json(result);
});

// POST /api/supabase/pull-all - Pull latest data from Supabase
app.post('/api/supabase/pull-all', async (req, res) => {
  const result = await pullAllFromSupabase();
  if (result.success && result.cheques) {
    const db = readDatabase();
    db.cheques = result.cheques;
    writeDatabase(db);
    res.json({ success: true, message: `Successfully pulled ${result.count} cheques from Supabase!`, count: result.count });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

// GET /api/supabase/schema-sql - Get the SQL migration script
app.get('/api/supabase/schema-sql', (req, res) => {
  const sqlPath = path.join(__dirname, 'supabase_schema.sql');
  if (fs.existsSync(sqlPath)) {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    res.json({ success: true, sql });
  } else {
    res.status(404).json({ success: false, error: 'SQL schema file not found' });
  }
});

// POST /api/cheques/purge-cleared - Manually or programmatically trigger 21-day auto-purge
app.post('/api/cheques/purge-cleared', async (req, res) => {
  const result = await autoPurgeOldClearedCheques();
  res.json(result);
});


app.listen(PORT, '0.0.0.0', async () => {
  console.log(`====================================================`);
  console.log(`CHEQUE MANAGEMENT SYSTEM (RD & SAF) Started on port ${PORT}`);
  console.log(`Website URL: http://localhost:${PORT}`);
  console.log(`====================================================`);

  // Initialize Backend Cloud Database (Supabase)
  try {
    const localDb = readDatabase();
    const initRes = await initSupabaseBackend(localDb.cheques || []);
    if (initRes.connected && initRes.count > 0) {
      // Sync cloud cheques into memory/local database cache
      const cloudData = await pullAllFromSupabase();
      if (cloudData.success && cloudData.cheques && cloudData.cheques.length > 0) {
        localDb.cheques = cloudData.cheques;
        writeDatabase(localDb);
        console.log(`[Backend Database] Synchronized ${cloudData.cheques.length} cheques from Supabase cloud.`);
      }
    }
  } catch (err) {
    console.error('[Backend Database Init Error]', err.message);
  }
});
