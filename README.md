# CHEQUE MANAGEMENT SYSTEM (RD & SAF)
### Reliable Drapes (RD) ✦ Shree Ambica Furnishings India Pvt Ltd (SAF)

A custom, professional cheque management web application designed exactly matching your spreadsheet structure, with automated 1-day clearing reminders, bank deposit slip photo uploads, return reason tracking, and custody management.

---

## 📊 Exact Spreadsheet Architecture & Modules

### 1. Top Multi-Firm Switcher & Summary Dashboard
- **🔵 Reliable Drapes (RD)**: 75 Cheques | ₹ 19,96,755
- **🟢 Shree Ambica Furnishings (SAF)**: 100 Cheques | ₹ 24,99,738
- **🌟 Grand Total**: 175 Cheques | ₹ 44,96,493

#### Top KPI Summary Blocks:
1. **📤 SENT FOR CLEARING**: ₹ 29,26,795 (124 cheques)
   - 🔵 RD: ₹ 12,51,974 (50 cheques)
   - 🟢 SAF: ₹ 16,74,821 (74 cheques)
2. **📌 ON HOLD**: ₹ 1,53,839 (5 cheques)
   - 🔵 RD: ₹ 10,400 (1 cheque)
   - 🟢 SAF: ₹ 1,43,439 (4 cheques)
3. **↩ RETURNED**: ₹ 14,15,859 (46 cheques)
   - 🔵 RD: ₹ 7,34,381 (24 cheques)
   - 🟢 SAF: ₹ 6,81,478 (22 cheques)

---

## 📑 Sheets / Tabs Matching Your Workflow

### 1. 📤 Cheque Clearing Sheet (124 Cheques)
Columns:
- `Sr #`
- `Firm` (🔵 RD in Blue, 🟢 SAF in Green)
- `Cheque Date`
- `Party Name / Particulars`
- `Cheque Number`
- `Drawn On (Bank)`
- `Amount (₹)`
- `Sent to Bank Date` (Deposit Date)
- `Actual Clear Date`
- `Status` (✅ Cleared / ❌ Bounced / ⏳ In Clearing)
- `Cheque Photo` (Clickable "View Cheque" lightbox viewer)
- `Action` (Deposit Slip upload, Mark Cleared, Mark Bounced)

### 2. 📌 Hold Cheques Sheet (5 Cheques)
Columns:
- `Sr #`
- `Firm` (🔵 RD / 🟢 SAF)
- `Cheque Date`
- `Party Name / Particulars`
- `Cheque Number`
- `Drawn On (Bank)`
- `Amount (₹)`
- `Hold Date`
- `Hold Reason` (Hold by Party, Hold by Raju Ji till 15 Apr, etc.)
- `Instruction By` (Ashok Ji, Raju Ji, Rakesh Sir, Nisar Sir, Hold by Party)
- `Days on Hold` (Calculated automatically from hold date to today)
- `Current Status` (⏸ On Hold)
- `Action` (Release to Bank, WhatsApp Notice, Delete)

### 3. ↩ Returned Cheques Sheet (46 Cheques)
Columns:
- `Sr #`
- `Firm` (🔵 RD / 🟢 SAF)
- `Cheque Date`
- `Party Name / Particulars`
- `Cheque Number`
- `Drawn On (Bank)`
- `Amount (₹)`
- `Return Date`
- `Return Reason` (Insufficient Funds, Exceeds Arrangement, Signature Mismatch, Alternation In date, Payee Name Differ, Other)
- `Action Taken` (Sent to PNP, Rakesh Sir, 💰 Recovered in Cash, 🔄 Under Follow-Up)
- `Recovery Status` (🔴 Unresolved, 🟡 In Progress, 🟢 Recovered)
- `Action` (Re-deposit in Bank, Mark Recovered, WhatsApp Notice)

---

## 🚀 How to Run
- Double-click **`Start-Cheque-System.bat`** on your Desktop.
- Access in browser: `http://localhost:5000`
