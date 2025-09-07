// Your deployed Apps Script endpoint URLs here:
const APPS_SCRIPT_BASE_URL = 'https://script.google.com/macros/s/AKfycbzN71NkBa-kapo6BuOVsBruAeBCuNYrwaNbxPtvfFYBjXwLsQuUKva23T3H_alxqCv9/exec';

let institutionList = [];
let institutionID = '';
let institutionName = '';
let session = {}; // stores login context

document.addEventListener('DOMContentLoaded', function() {
  initLogin();
  initTabs();
  initLogout();
});

function initLogin() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getInstitutions`)
    .then(res => res.json())
    .then(data => {
      institutionList = data.institutions || [];
      const select = document.getElementById('institution');
      select.innerHTML = institutionList.map(inst => 
        `<option value="${inst.ID}">${inst.Name}</option>`
      ).join('');
    });

  document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const selectedID = document.getElementById('institution').value;
    const password = document.getElementById('password').value;
    fetch(`${APPS_SCRIPT_BASE_URL}?action=login`, {
      method: 'POST',
      body: JSON.stringify({institutionID: selectedID, password}),
      headers: {'Content-Type': 'application/json'}
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        institutionID = selectedID;
        institutionName = institutionList.find(i => i.ID === institutionID)?.Name || '';
        session = data.session || {};
        showDashboard();
      } else {
        document.getElementById('login-error').textContent = 'Invalid credentials.';
      }
    });
  });
}

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

function loadSummary() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getSummary&institutionID=${encodeURIComponent(institutionID)}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('total-members').textContent = data.totalMembers || 0;
      document.getElementById('total-usd').textContent = data.totalUSD || 0;
      document.getElementById('total-zwl').textContent = data.totalZWL || 0;
      document.getElementById('outstanding-months').textContent = data.outstandingMonths || 0;
    });
}

function loadMembers() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getMembers&institutionID=${encodeURIComponent(institutionID)}`)
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
    });
}

function populateMembersTable(members) {
  const tbody = document.querySelector('#members-table tbody');
  tbody.innerHTML = members.map(m => `
    <tr>
      <td>${m.MemberID}</td>
      <td>${m.Name}</td>
      <td>${m.JobTitle}</td>
      <td>${m.Email}</td>
    </tr>
  `).join('');
}

function loadPaymentHistory() {
  fetch(`${APPS_SCRIPT_BASE_URL}?action=getPaymentHistory&institutionID=${encodeURIComponent(institutionID)}`)
    .then(res => res.json())
    .then(data => {
      let payments = data.payments || [];
      populatePaymentsTable(payments);

      document.getElementById('download-csv-btn').onclick = () => {
        let csvRows = [
          ['TransactionID','Date','AmountUSD','AmountZWL','MonthsPaid','Status','PickupDate','ScheduleFileLink']
        ];
        payments.forEach(p => {
          csvRows.push([
            p.TransactionID, p.Date, p.AmountUSD, p.AmountZWL,
            p.MonthsPaid, p.Status, p.PickupDate, p.ScheduleFileLink
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
    });
}

function populatePaymentsTable(payments) {
  const tbody = document.querySelector('#payment-history-table tbody');
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${p.TransactionID}</td>
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
      // File upload via Apps Script
      let fr = new FileReader();
      fr.onload = function() {
        let fileData = fr.result.split(',')[1]; // base64 part
        fetch(`${APPS_SCRIPT_BASE_URL}?action=uploadFile`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            fileData: fileData
          }),
          headers: {'Content-Type': 'application/json'}
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
    headers: {'Content-Type': 'application/json'}
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
  });
}