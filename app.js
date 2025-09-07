// ===== CONFIG =====
const APPS_SCRIPT_BASE_URL = 'https://script.google.com/macros/s/AKfycbzN71NkBa-kapo6BuOVsBruAeBCuNYrwaNbxPtvfFYBjXwLsQuUKva23T3H_alxqCv9/exec';
const CREDENTIALS_URL = 'credentials.json'; // JSON file stored in your GitHub repo

let institutionList = [];
let institutionID = '';
let institutionName = '';
let session = {}; // stores login context
let credentialMap = {}; // ID → password lookup

document.addEventListener('DOMContentLoaded', function() {
  initLogin();
  initTabs();
  initLogout();
});

// ===== LOGIN HANDLING =====
function initLogin() {
  fetch(CREDENTIALS_URL)
    .then(res => res.json())
    .then(data => {
      institutionList = data.institutions || [];
      credentialMap = Object.fromEntries(institutionList.map(inst => [inst.ID, inst.Password]));

      const select = document.getElementById('institution');
      select.innerHTML = institutionList.map(inst =>
        `<option value="${inst.ID}">${inst.Name}</option>`
      ).join('');
    })
    .catch(err => console.error('Failed to load credentials:', err));

  document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const selectedID = document.getElementById('institution').value;
    const password = document.getElementById('password').value;

    if (credentialMap[selectedID] && credentialMap[selectedID] === password) {
      institutionID = selectedID;
      institutionName = institutionList.find(i => i.ID === institutionID)?.Name || '';
      session = { institutionID, loggedIn: true };
      showDashboard();
    } else {
      document.getElementById('login-error').textContent = 'Invalid credentials.';
    }
  });
}

// ===== DASHBOARD =====
function showDashboard() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('dashboard-container').style.display = '';
  document.getElementById('institution-name').textContent = institutionName;
  loadSummary();
  loadMembers();
  loadPaymentHistory();
  initLogPayment();
}

function initLogout() {
  document.getElementById('logout-btn').onclick = () => {
    session = {};
    institutionID = '';
    institutionName = '';
    document.getElementById('dashboard-container').style.display = 'none';
    document.getElementById('login-container').style.display = '';
    document.getElementById('login-form').reset();
  };
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });
}

// ===== SUMMARY =====
function loadSummary() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getSummary&institutionID=${encodeURIComponent(institutionID)}`, { mode: 'cors' })
    .then(res => res.json())
    .then(data => {
      document.getElementById('total-members').textContent = data.totalMembers || 0;
      document.getElementById('total-usd').textContent = data.totalUSD || 0;
      document.getElementById('total-zwl').textContent = data.totalZWL || 0;
      document.getElementById('outstanding-months').textContent = data.outstandingMonths || 0;
    })
    .catch(err => console.error('Failed to load summary:', err));
}

// ===== MEMBERS =====
function loadMembers() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getMembers&institutionID=${encodeURIComponent(institutionID)}`, { mode: 'cors' })
    .then(res => res.json())
    .then(data => {
      let members = data.members || [];
      populateMembersTable(members);

      document.getElementById('member-search').oninput = function() {
        const q = this.value.toLowerCase();
        let filtered = members.filter(m =>
          (m.MemberID && m.MemberID.toLowerCase().includes(q)) ||
          (m.Name && m.Name.toLowerCase().includes(q)) ||
          (m.JobTitle && m.JobTitle.toLowerCase().includes(q))
        );
        populateMembersTable(filtered);
      };
    })
    .catch(err => console.error('Failed to load members:', err));
}

function populateMembersTable(members) {
  const tbody = document.querySelector('#members-table tbody');
  tbody.innerHTML = members.map(m => `
    <tr>
      <td>${m.MemberID}</td>
      <td>${m.Name}</td>
      <td>${m.NationalID}</td>
      <td>${m.DateOfBirth ? new Date(m.DateOfBirth).toLocaleDateString() : ''}</td>
      <td>${m.Gender || ''}</td>
      <td>${m.JobTitle}</td>
      <td>${m.DateOfEmployment ? new Date(m.DateOfEmployment).toLocaleDateString() : ''}</td>
      <td>${m.Grade || ''}</td>
    </tr>
  `).join('');
}

// ===== PAYMENTS =====
function loadPaymentHistory() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getPaymentHistory&institutionID=${encodeURIComponent(institutionID)}`, { mode: 'cors' })
    .then(res => res.json())
    .then(data => {
      let payments = data.payments || [];
      populatePaymentsTable(payments);

      document.getElementById('download-csv-btn').onclick = () => {
        let csvRows = [
          ['TransactionID','ReceiptNumber','Date','AmountUSD','AmountZWL','MonthsPaid','Status','PickupDate','ScheduleFileLink']
        ];
        payments.forEach(p => {
          csvRows.push([
            p.TransactionID, p.ReceiptNumber || '', p.Date, p.AmountUSD, p.AmountZWL,
            p.MonthsPaid, p.Status, p.PickupDate || '', p.ScheduleFileLink || ''
          ]);
        });
        let csvContent = csvRows.map(e => e.join(",")).join("\n");
        let blob = new Blob([csvContent], { type: 'text/csv' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'payment_history.csv';
        a.click();
      };
    })
    .catch(err => console.error('Failed to load payment history:', err));
}

function populatePaymentsTable(payments) {
  const tbody = document.querySelector('#payment-history-table tbody');
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${p.TransactionID}</td>
      <td>${p.ReceiptNumber || ''}</td>
      <td>${p.Date}</td>
      <td>${p.AmountUSD}</td>
      <td>${p.AmountZWL}</td>
      <td>${p.MonthsPaid}</td>
      <td>${statusLabel(p.Status)}</td>
      <td>${p.PickupDate || ''}</td>
      <td>${p.ScheduleFileLink ? `<a href="${p.ScheduleFileLink}" target="_blank">Download</a>` : ''}</td>
    </tr>
  `).join('');
}

function statusLabel(status) {
  switch (status) {
    case 'Pending Verification': return `<span style="color:orange">${status}</span>`;
    case 'Receipt Ready': return `<span style="color:blue">${status}</span>`;
    case 'Picked Up': return `<span style="color:green">${status}</span>`;
    default: return status;
  }
}

// ===== LOG PAYMENT =====
function initLogPayment() {
  const form = document.getElementById('log-payment-form');
  form.onsubmit = function(e) {
    e.preventDefault();
    let transactionID = document.getElementById('transaction-id').value;
    let date = document.getElementById('payment-date').value;
    let amountUSD = document.getElementById('amount-usd').value;
    let amountZWL = document.getElementById('amount-zwl').value;
    let monthsPaid = document.getElementById('months-paid').value;
    let fileInput = document.getElementById('schedule-file');
    let file = fileInput.files[0];

    let paymentData = {
      institutionID,
      transactionID,
      date,
      amountUSD,
      amountZWL,
      monthsPaid
    };

    if (file) {
      let fr = new FileReader();
      fr.onload = function() {
        let fileData = fr.result.split(',')[1]; 
        fetch(`${APPS_SCRIPT_BASE_URL}?action=uploadFile`, {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, fileData }),
          headers: {'Content-Type': 'application/json'},
          mode: 'cors'
        })
        .then(res => res.json())
        .then(fileRes => {
          paymentData.scheduleFileLink = fileRes.fileUrl;
          submitPayment(paymentData);
        });
      };
      fr.readAsDataURL(file);
    } else {
      submitPayment(paymentData);
    }
  };
}

function submitPayment(paymentData) {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=logPayment`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
    headers: {'Content-Type': 'application/json'},
    mode: 'cors'
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      document.getElementById('log-payment-message').textContent = 'Payment logged successfully!';
      loadPaymentHistory();
      loadSummary();
      document.getElementById('log-payment-form').reset();
    } else {
      document.getElementById('log-payment-message').textContent = 'Failed to log payment.';
    }
    setTimeout(() => document.getElementById('log-payment-message').textContent = '', 4000);
  })
  .catch(err => console.error('Failed to submit payment:', err));
}
// ===================================

// Note: Ensure CORS is enabled in your Google Apps Script deployment settings. 
