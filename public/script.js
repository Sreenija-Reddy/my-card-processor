const API_URL = 'http://localhost:3000/api';

// Tab Navigation
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Card Validation
document.getElementById('card-number').addEventListener('input', function(e) {
    const cardNumber = e.target.value.replace(/\s+/g, '');
    const cardTypeEl = document.getElementById('card-type');

    if (!cardNumber) {
        cardTypeEl.textContent = '';
        return;
    }

    const cardType = getCardType(cardNumber);
    const isValid = validateCardNumber(cardNumber);

    cardTypeEl.textContent = `Card Type: ${cardType}`;
    cardTypeEl.style.color = isValid ? 'green' : 'red';
});

// Form Submission
document.getElementById('transaction-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cardNumber = document.getElementById('card-number').value.replace(/\s+/g, '');
    const amount = document.getElementById('amount').value;
    const submitBtn = e.target.querySelector('button');

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardNumber, amount })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Transaction failed');
        }

        const data = await response.json();
        showResult(`✅ Processed $${data.amount.toFixed(2)} for ${data.cardType} (•••• ${data.cardNumber.slice(-4)})`, 'success');
    } catch (error) {
        showResult(`❌ Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Process';
    }
});

// File Processing
async function processFiles() {
    const fileInput = document.getElementById('transaction-files');
    const processBtn = document.getElementById('process-btn');
    const progressEl = document.getElementById('file-progress');

    if (fileInput.files.length === 0) {
        showFileResults('Please select at least one file', 'error');
        return;
    }

    try {
        processBtn.disabled = true;
        processBtn.textContent = 'Processing...';
        progressEl.innerHTML = 'Preparing files...';
        showFileResults('', 'info');

        const formData = new FormData();
        for (const file of fileInput.files) {
            formData.append('files', file);
        }

        const response = await fetch(`${API_URL}/process-files`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'File processing failed');
        }

        const result = await response.json();
        showFileResults(
            `✔ Successfully processed ${result.processed} transactions<br>
             ✖ ${result.rejected} transactions were rejected`,
            'success'
        );

        // Refresh reports
        if (document.getElementById('reports').classList.contains('active')) {
            loadSummary();
            loadRejected();
        }
    } catch (error) {
        showFileResults(`❌ Error: ${error.message}`, 'error');
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Process Files';
        progressEl.innerHTML = '';
        fileInput.value = '';
    }
}

// Reporting Functions
async function loadSummary() {
    try {
        const response = await fetch(`${API_URL}/reports/summary`);
        if (!response.ok) throw new Error(await response.text());

        const report = await response.json();
        renderSummaryReport(report);
    } catch (error) {
        document.getElementById('report-results').innerHTML =
            `<div class="error">❌ Error: ${error.message}</div>`;
    }
}

async function loadRejected() {
    try {
        const response = await fetch(`${API_URL}/reports/rejected`);
        if (!response.ok) throw new Error(await response.text());

        const rejected = await response.json();
        renderRejectedReport(rejected);
    } catch (error) {
        document.getElementById('report-results').innerHTML =
            `<div class="error">❌ Error: ${error.message}</div>`;
    }
}

// Helper Functions
function showResult(message, type) {
    const resultEl = document.getElementById('transaction-result');
    resultEl.innerHTML = message;
    resultEl.className = type;
}

function showFileResults(message, type) {
    const resultEl = document.getElementById('file-results');
    resultEl.innerHTML = message;
    resultEl.className = type;
}

function validateCardNumber(cardNumber) {
    // Simple validation - in production use Luhn algorithm
    const firstDigit = cardNumber.charAt(0);
    return ['3', '4', '5', '6'].includes(firstDigit) &&
           cardNumber.length >= 13 &&
           cardNumber.length <= 16;
}

function getCardType(cardNumber) {
    if (!cardNumber) return 'Unknown';
    const firstDigit = cardNumber.charAt(0);
    switch(firstDigit) {
        case '3': return 'American Express';
        case '4': return 'Visa';
        case '5': return 'MasterCard';
        case '6': return 'Discover';
        default: return 'Invalid';
    }
}

function renderSummaryReport(report) {
    let html = `
        <h3>Transaction Summary</h3>
        <div class="summary-stats">
            <div>Total Transactions: <strong>${report.totalTransactions || 0}</strong></div>
            <div>Total Amount: <strong>$${(report.totalAmount || 0).toFixed(2)}</strong></div>
            <div>Rejected Transactions: <strong>${report.rejectedCount || 0}</strong></div>
        </div>`;

    if (report.byCardType) {
        html += `<h4>By Card Type</h4><div class="chart-container">`;
        const maxCount = Math.max(...Object.values(report.byCardType), 1);
        for (const [type, count] of Object.entries(report.byCardType)) {
            const width = (count / maxCount) * 100;
            html += `
                <div class="chart-row">
                    <span class="chart-label">${type}:</span>
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${width}%"></div>
                    </div>
                    <span class="chart-value">${count}</span>
                </div>`;
        }
        html += `</div>`;
    }

    if (report.byDate) {
        html += `<h4>Daily Transactions</h4><div class="daily-container">`;
        for (const [date, count] of Object.entries(report.byDate)) {
            html += `
                <div class="daily-row">
                    <span>${date}:</span>
                    <span>${count} transactions</span>
                </div>`;
        }
        html += `</div>`;
    }

    document.getElementById('report-results').innerHTML = html;
}

function renderRejectedReport(rejected) {
    let html = `<h3>Rejected Transactions (${rejected.length})</h3>`;

    if (rejected.length === 0) {
        html += `<p>No rejected transactions found</p>`;
    } else {
        html += `<div class="rejected-grid">
              <div class="grid-header" style="color: black;">Card Number</div>
              <div class="grid-header" style="color: black;">Amount</div>
              <div class="grid-header" style="color: black;">Reason</div>
              <div class="grid-header" style="color: black;">Date</div>`;

        rejected.forEach(t => {
            const cardNumberDisplay = t.cardNumber ? `•••• ${String(t.cardNumber).slice(-4)}` : 'N/A';
            const amountDisplay = t.amount ? `$${t.amount}` : 'N/A';
            const reasonDisplay = t.reason || 'Unknown';
            const dateDisplay = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'N/A';

            html += `
                  <div>${cardNumberDisplay}</div>
                  <div>${amountDisplay}</div>
                  <div>${reasonDisplay}</div>
                  <div>${dateDisplay}</div>`;
        });

        html += `</div>`;
    }

    document.getElementById('report-results').innerHTML = html;
}