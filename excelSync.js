const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXPORTS_DIR = path.join(__dirname, 'exports');
const DAILY_EXPORTS_DIR = path.join(EXPORTS_DIR, 'daily');
const DESKTOP_DIR = path.join('C:', 'Users', 'Administrator', 'Desktop', 'Cheque-Excel-AutoSave');
const BACKUPS_DIR = path.join(__dirname, 'data', 'daily_backups');

[EXPORTS_DIR, DAILY_EXPORTS_DIR, DESKTOP_DIR, BACKUPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function formatDate(d) {
  const date = d ? new Date(d) : new Date();
  return date.toISOString().split('T')[0];
}

// Generate multi-sheet workbook matching the user's spreadsheet structure
function generateWorkbook(cheques, settings) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Cheque Clearing
  const clearingData = cheques
    .filter(c => c.moduleType === 'CLEARING')
    .map((c, idx) => ({
      'Sr #': idx + 1,
      'Firm': c.firm || 'RD',
      'Cheque Date': c.chequeDate || '',
      'Party Name / Particulars': c.partyName || '',
      'Cheque Number': c.chequeNumber || '',
      'Drawn On (Bank)': c.bankName || '',
      'Amount (₹)': Number(c.amount || 0),
      'Sent to Bank Date': c.sentToBankDate || '',
      'Actual Clear Date': c.actualClearDate || '',
      'Status': c.status === 'CLEARED' ? '✅ Cleared' : (c.status === 'BOUNCED' ? '❌ Bounced' : '⏳ In Clearing'),
      'Remarks': c.remarks || ''
    }));

  const wsClearing = XLSX.utils.json_to_sheet(clearingData.length ? clearingData : [{}]);
  wsClearing['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 38 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsClearing, 'Cheque Clearing');

  // 2. Sheet: Hold Cheques
  const holdData = cheques
    .filter(c => c.moduleType === 'HOLD')
    .map((c, idx) => ({
      'Sr #': idx + 1,
      'Firm': c.firm || 'SAF',
      'Cheque Date': c.chequeDate || '',
      'Party Name / Particulars': c.partyName || '',
      'Cheque Number': c.chequeNumber || '',
      'Drawn On (Bank)': c.bankName || '',
      'Amount (₹)': Number(c.amount || 0),
      'Hold Date': c.holdDate || '',
      'Hold Reason': c.holdReason || '',
      'Instruction By': c.instructionBy || '',
      'Days on Hold': c.daysOnHold || 0,
      'Current Status': '⏸ On Hold',
      'Remarks': c.remarks || ''
    }));

  const wsHold = XLSX.utils.json_to_sheet(holdData.length ? holdData : [{}]);
  wsHold['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 38 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsHold, 'Hold Cheques');

  // 3. Sheet: Returned Cheques
  const returnedData = cheques
    .filter(c => c.moduleType === 'RETURNED')
    .map((c, idx) => ({
      'Sr #': idx + 1,
      'Firm': c.firm || 'RD',
      'Cheque Date': c.chequeDate || '',
      'Party Name / Particulars': c.partyName || '',
      'Cheque Number': c.chequeNumber || '',
      'Drawn On (Bank)': c.bankName || '',
      'Amount (₹)': Number(c.amount || 0),
      'Return Date': c.returnDate || '',
      'Return Reason': c.returnReason || '',
      'Action Taken': c.actionTaken || '',
      'Recovery Status': c.recoveryStatus === 'RECOVERED' ? '🟢 Recovered' : (c.recoveryStatus === 'IN_PROGRESS' ? '🟡 In Progress' : '🔴 Unresolved'),
      'Remarks': c.remarks || ''
    }));

  const wsReturned = XLSX.utils.json_to_sheet(returnedData.length ? returnedData : [{}]);
  wsReturned['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 38 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsReturned, 'Returned Cheques');

  // 4. Sheet: Summary Dashboard (RD vs SAF)
  const clearingList = cheques.filter(c => c.moduleType === 'CLEARING');
  const holdList = cheques.filter(c => c.moduleType === 'HOLD');
  const retList = cheques.filter(c => c.moduleType === 'RETURNED');

  const summaryData = [
    { Category: 'SENT FOR CLEARING', 'Total Amount (₹)': clearingList.reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': clearingList.length, 'RD Amount (₹)': clearingList.filter(c => c.firm === 'RD').reduce((s, c) => s + (c.amount || 0), 0), 'RD Count': clearingList.filter(c => c.firm === 'RD').length, 'SAF Amount (₹)': clearingList.filter(c => c.firm === 'SAF').reduce((s, c) => s + (c.amount || 0), 0), 'SAF Count': clearingList.filter(c => c.firm === 'SAF').length },
    { Category: 'ON HOLD', 'Total Amount (₹)': holdList.reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': holdList.length, 'RD Amount (₹)': holdList.filter(c => c.firm === 'RD').reduce((s, c) => s + (c.amount || 0), 0), 'RD Count': holdList.filter(c => c.firm === 'RD').length, 'SAF Amount (₹)': holdList.filter(c => c.firm === 'SAF').reduce((s, c) => s + (c.amount || 0), 0), 'SAF Count': holdList.filter(c => c.firm === 'SAF').length },
    { Category: 'RETURNED / BOUNCED', 'Total Amount (₹)': retList.reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': retList.length, 'RD Amount (₹)': retList.filter(c => c.firm === 'RD').reduce((s, c) => s + (c.amount || 0), 0), 'RD Count': retList.filter(c => c.firm === 'RD').length, 'SAF Amount (₹)': retList.filter(c => c.firm === 'SAF').reduce((s, c) => s + (c.amount || 0), 0), 'SAF Count': retList.filter(c => c.firm === 'SAF').length },
    { Category: '--------------------', 'Total Amount (₹)': '', 'Total Cheques': '', 'RD Amount (₹)': '', 'RD Count': '', 'SAF Amount (₹)': '', 'SAF Count': '' },
    { Category: '🔵 TOTAL RD (Reliable Drapes)', 'Total Amount (₹)': cheques.filter(c => c.firm === 'RD').reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': cheques.filter(c => c.firm === 'RD').length, 'RD Amount (₹)': '', 'RD Count': '', 'SAF Amount (₹)': '', 'SAF Count': '' },
    { Category: '🟢 TOTAL SAF (Shree Ambica Furnishings)', 'Total Amount (₹)': cheques.filter(c => c.firm === 'SAF').reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': cheques.filter(c => c.firm === 'SAF').length, 'RD Amount (₹)': '', 'RD Count': '', 'SAF Amount (₹)': '', 'SAF Count': '' },
    { Category: '🌟 GRAND TOTAL (Both Firms)', 'Total Amount (₹)': cheques.reduce((s, c) => s + (c.amount || 0), 0), 'Total Cheques': cheques.length, 'RD Amount (₹)': '', 'RD Count': '', 'SAF Amount (₹)': '', 'SAF Count': '' }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 38 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Dashboard');

  return wb;
}

// Master Auto-Save function (Called after every add/edit/deposit/hold/delete & daily timer)
function autoSaveExcelAndDatabase(database) {
  try {
    const todayStr = formatDate(new Date());
    const cheques = database.cheques || [];
    const settings = database.settings || {};

    const wb = generateWorkbook(cheques, settings);

    // 1. Save Master Excel file
    const masterExcelPath = path.join(EXPORTS_DIR, 'Cheque_Master_Register.xlsx');
    XLSX.writeFile(wb, masterExcelPath);

    // 2. Save Daily Excel snapshot
    const dailyExcelPath = path.join(DAILY_EXPORTS_DIR, `Cheque_Register_${todayStr}.xlsx`);
    XLSX.writeFile(wb, dailyExcelPath);

    // 3. Mirror directly into Desktop AutoSave Folder for instant user access!
    const desktopMasterPath = path.join(DESKTOP_DIR, 'Cheque_Master_Register.xlsx');
    const desktopDailyPath = path.join(DESKTOP_DIR, `Cheque_Register_${todayStr}.xlsx`);
    try {
      fs.copyFileSync(masterExcelPath, desktopMasterPath);
      fs.copyFileSync(dailyExcelPath, desktopDailyPath);
    } catch (e) {
      // Desktop write fallback
    }

    // 4. Save Database Daily Backup JSON
    const dailyDbPath = path.join(BACKUPS_DIR, `database_backup_${todayStr}.json`);
    fs.writeFileSync(dailyDbPath, JSON.stringify(database, null, 2), 'utf8');

    console.log(`[AutoSave] Excel and Database successfully synchronized (${todayStr})`);
    return {
      success: true,
      todayStr,
      masterExcelPath,
      dailyExcelPath,
      dailyDbPath
    };
  } catch (err) {
    console.error('[AutoSave Error]', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  autoSaveExcelAndDatabase,
  generateWorkbook,
  EXPORTS_DIR,
  DAILY_EXPORTS_DIR,
  DESKTOP_DIR,
  BACKUPS_DIR
};
