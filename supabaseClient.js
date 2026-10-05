const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const CONFIG_FILE = path.join(__dirname, 'data', 'supabase_config.json');

// Check if Supabase credentials are provided
function isSupabaseConfigured() {
  const { url, key } = getCredentials();
  return Boolean(url && key);
}

// Helper to get active credentials from process.env or config file
function getCredentials() {
  let url = process.env.SUPABASE_URL || '';
  let key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if ((!url || !key) && fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (!url && cfg.url) url = cfg.url;
      if (!key && cfg.key) key = cfg.key;
    } catch (e) {}
  }

  return { url: url.trim(), key: key.trim() };
}

function saveCredentials(url, key) {
  const cfg = { url: url.trim(), key: key.trim(), updatedAt: new Date().toISOString() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');

  // Also update .env for hosting persistence
  try {
    const envFile = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
      if (envContent.includes('SUPABASE_URL=')) {
        envContent = envContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL=${url.trim()}`);
      } else {
        envContent += `\nSUPABASE_URL=${url.trim()}`;
      }
      if (envContent.includes('SUPABASE_KEY=')) {
        envContent = envContent.replace(/SUPABASE_KEY=.*/, `SUPABASE_KEY=${key.trim()}`);
      } else {
        envContent += `\nSUPABASE_KEY=${key.trim()}`;
      }
    } else {
      envContent = `PORT=5000\nNODE_ENV=production\nSUPABASE_URL=${url.trim()}\nSUPABASE_KEY=${key.trim()}\n`;
    }
    fs.writeFileSync(envFile, envContent, 'utf8');
  } catch (e) {}

  process.env.SUPABASE_URL = url.trim();
  process.env.SUPABASE_KEY = key.trim();

  return cfg;
}

let cachedClient = null;
let lastCredsHash = '';

function getClient() {
  const { url, key } = getCredentials();
  if (!url || !key) return null;

  const currentHash = `${url}:${key}`;
  if (cachedClient && lastCredsHash === currentHash) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    lastCredsHash = currentHash;
    return cachedClient;
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
}

function cleanDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'null') return null;
  return s;
}

// Convert local camelCase object to Supabase snake_case table row
function toDbRow(c) {
  return {
    id: c.id,
    firm: (c.firm || 'RD').toUpperCase(),
    module_type: c.moduleType || 'CLEARING',
    sr_no: c.srNo || 0,
    cheque_number: String(c.chequeNumber || ''),
    party_name: c.partyName || '',
    bank_name: c.bankName || '',
    branch: c.branch || '',
    amount: Number(c.amount || 0),
    cheque_date: cleanDate(c.chequeDate),
    clearing_date: cleanDate(c.clearingDate),
    sent_to_bank_date: cleanDate(c.sentToBankDate),
    actual_clear_date: cleanDate(c.actualClearDate),
    hold_date: cleanDate(c.holdDate),
    hold_reason: c.holdReason || '',
    instruction_by: c.instructionBy || '',
    return_date: cleanDate(c.returnDate),
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

// Convert Supabase snake_case row back to local camelCase
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

// Test connection to Supabase
async function testConnection() {
  const supabase = getClient();
  if (!supabase) {
    return { connected: false, message: 'Supabase credentials not configured in environment variables or .env' };
  }
  try {
    const { count, error } = await supabase.from('cheques').select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01') {
        return { 
          connected: false, 
          tableMissing: true, 
          message: 'Connected to Supabase project, but "cheques" table is not created yet. Run supabase_schema.sql in Supabase SQL Editor.' 
        };
      }
      return { connected: false, message: error.message };
    }
    return { connected: true, count: count || 0, message: `Connected to Supabase! Found ${count || 0} cheques in cloud database.` };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

// Upload all local cheques to Supabase in batches of 50
async function pushAllToSupabase(cheques) {
  const supabase = getClient();
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  const rows = cheques.map(toDbRow);
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('cheques').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Error uploading batch ${i}-${i + BATCH_SIZE}:`, error);
      return { success: false, error: error.message, inserted };
    }
    inserted += chunk.length;
  }

  return { success: true, count: inserted, message: `Successfully pushed ${inserted} cheques to Supabase!` };
}

// Pull all cheques from Supabase cloud table
async function pullAllFromSupabase() {
  const supabase = getClient();
  if (!supabase) return { success: false, error: 'Supabase is not configured' };

  try {
    const { data, error } = await supabase.from('cheques').select('*').order('sr_no', { ascending: true });
    if (error) return { success: false, error: error.message };

    const mapped = (data || []).map(fromDbRow);
    return { success: true, cheques: mapped, count: mapped.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Push a single cheque change to Supabase (fires asynchronously on add/update)
async function syncSingleCheque(cheque) {
  const supabase = getClient();
  if (!supabase) return;
  try {
    const row = toDbRow(cheque);
    const { error } = await supabase.from('cheques').upsert([row], { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Sync Error]', error.message);
    }
  } catch (err) {
    console.error('[Supabase Sync Exception]', err.message);
  }
}

// Delete single cheque from Supabase
async function deleteSingleCheque(id) {
  const supabase = getClient();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('cheques').delete().eq('id', id);
    if (error) {
      console.error('[Supabase Delete Error]', error.message);
    }
  } catch (err) {
    console.error('[Supabase Delete Exception]', err.message);
  }
}

// Delete all cheques from Supabase cloud table
async function clearAllFromSupabase() {
  const supabase = getClient();
  if (!supabase) return { success: false, error: 'Supabase is not configured' };
  try {
    const { error } = await supabase.from('cheques').delete().neq('id', '___NON_EXISTENT_ID___');
    if (error) {
      console.error('[Supabase Clear All Error]', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[Supabase Clear All Exception]', err.message);
    return { success: false, error: err.message };
  }
}

// Auto-seed and initialize backend when hosted
async function initSupabaseBackend(localCheques = []) {
  if (!isSupabaseConfigured()) {
    console.log('[Backend Database] Supabase credentials not found in env. Running in LOCAL database mode.');
    return { enabled: false, connected: false };
  }

  console.log('[Backend Database] Connecting to Supabase Cloud Database...');
  const test = await testConnection();

  if (!test.connected) {
    console.warn('[Backend Database Warning]', test.message);
    return { enabled: true, connected: false, message: test.message, tableMissing: test.tableMissing };
  }

  console.log(`[Backend Database] 🟢 Supabase Cloud Connected! Found ${test.count} records in cloud table.`);

  // If cloud table is empty and we have local seed records, auto-migrate to cloud!
  if (test.count === 0 && localCheques && localCheques.length > 0) {
    console.log(`[Backend Database] Cloud table is empty. Auto-seeding all ${localCheques.length} cheques to Supabase...`);
    const seedRes = await pushAllToSupabase(localCheques);
    if (seedRes.success) {
      console.log(`[Backend Database] ✅ Auto-seed completed! Uploaded ${seedRes.count} cheques to Supabase cloud.`);
    } else {
      console.error(`[Backend Database] Auto-seed error:`, seedRes.error);
    }
  }

  return { enabled: true, connected: true, count: test.count };
}

module.exports = {
  isSupabaseConfigured,
  getCredentials,
  saveCredentials,
  getClient,
  testConnection,
  pushAllToSupabase,
  pullAllFromSupabase,
  clearAllFromSupabase,
  syncSingleCheque,
  deleteSingleCheque,
  initSupabaseBackend
};
