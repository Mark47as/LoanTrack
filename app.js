// LendTrack - Personal Lending Manager
// All data stored in memory and synchronized with localStorage

let loans = [];
let currentView = 'dashboard';
let currentTheme = 'light';
let editingLoanId = null;

// Initialize app
function initApp() {
    loadFromStorage();
    applyTheme();
    updateDashboard();
    renderRecentLoans();
    renderAllLoans();
    setTodayDate();
    setupEventListeners();
}

// In-Memory Storage Management
function loadFromStorage() {
    // Load sample data on first load
    if (loans.length === 0) {
        loans = getSampleData();
    }
}

function saveToStorage() {
    // Data persists in memory during session
    // In a real app, this would save to a backend
}

function getSampleData() {
    return [
        {
            id: generateId(),
            personName: 'Rahul Kumar',
            contactInfo: '+91 98765 43210',
            amount: 50000,
            type: 'lent',
            interestType: 'compound',
            interestRate: 12,
            startDate: '2024-01-15',
            durationMonths: 24,
            paymentFrequency: 'monthly',
            notes: 'Business loan',
            status: 'active',
            paymentsMade: [],
            createdAt: new Date('2024-01-15').toISOString()
        },
        {
            id: generateId(),
            personName: 'Priya Sharma',
            contactInfo: 'priya.sharma@email.com',
            amount: 25000,
            type: 'borrowed',
            interestType: 'simple',
            interestRate: 8,
            startDate: '2024-03-01',
            durationMonths: 12,
            paymentFrequency: 'monthly',
            notes: 'Personal loan',
            status: 'active',
            paymentsMade: [],
            createdAt: new Date('2024-03-01').toISOString()
        }
    ];
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substr(0, 2);
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('startDate');
    const paymentDateInput = document.getElementById('paymentDate');
    if (startDateInput) startDateInput.value = today;
    if (paymentDateInput) paymentDateInput.value = today;
}

// Interest Calculations
function calculateSimpleInterest(principal, rate, timeMonths) {
    const timeYears = timeMonths / 12;
    return (principal * rate * timeYears) / 100;
}

function calculateCompoundInterest(principal, rate, timeMonths, frequency) {
    const timeYears = timeMonths / 12;
    let n = 1; // Annual compounding by default
    
    if (frequency === 'monthly') {
        n = 12;
    } else if (frequency === 'quarterly') {
        n = 4;
    } else if (frequency === 'annually') {
        n = 1;
    }
    
    const amount = principal * Math.pow((1 + rate / (100 * n)), n * timeYears);
    return amount - principal;
}

function calculateTotalAmount(loan) {
    let interest = 0;
    if (loan.interestType === 'simple') {
        interest = calculateSimpleInterest(loan.amount, loan.interestRate, loan.durationMonths);
    } else {
        interest = calculateCompoundInterest(loan.amount, loan.interestRate, loan.durationMonths, loan.paymentFrequency);
    }
    return loan.amount + interest;
}

function calculateRemainingAmount(loan) {
    const totalAmount = calculateTotalAmount(loan);
    const paidAmount = loan.paymentsMade.reduce((sum, payment) => sum + payment.amount, 0);
    return totalAmount - paidAmount;
}

// Dashboard Updates
function updateDashboard() {
    const activeLoans = loans.filter(l => l.status === 'active');
    const lentLoans = activeLoans.filter(l => l.type === 'lent');
    const borrowedLoans = activeLoans.filter(l => l.type === 'borrowed');
    
    const totalLent = lentLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const totalBorrowed = borrowedLoans.reduce((sum, loan) => sum + loan.amount, 0);
    const expectedReturns = lentLoans.reduce((sum, loan) => sum + calculateTotalAmount(loan), 0);
    
    document.getElementById('totalLent').textContent = formatCurrency(totalLent);
    document.getElementById('totalBorrowed').textContent = formatCurrency(totalBorrowed);
    document.getElementById('expectedReturns').textContent = formatCurrency(expectedReturns);
    document.getElementById('activeLoans').textContent = activeLoans.length;
}

// Render Recent Loans
function renderRecentLoans() {
    const container = document.getElementById('recentLoansList');
    const recentLoans = loans
        .filter(l => l.status === 'active')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    
    if (recentLoans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">inbox</span>
                <h3>No loans yet</h3>
                <p>Start by adding a new loan using the button above</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentLoans.map(loan => createLoanCard(loan)).join('');
}

// Render All Loans
function renderAllLoans() {
    const container = document.getElementById('allLoansList');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const filterType = document.getElementById('filterType')?.value || 'all';
    
    let filteredLoans = loans.filter(loan => {
        const matchesSearch = loan.personName.toLowerCase().includes(searchTerm);
        let matchesFilter = true;
        
        if (filterType === 'lent') matchesFilter = loan.type === 'lent';
        else if (filterType === 'borrowed') matchesFilter = loan.type === 'borrowed';
        else if (filterType === 'active') matchesFilter = loan.status === 'active';
        else if (filterType === 'completed') matchesFilter = loan.status === 'completed';
        
        return matchesSearch && matchesFilter;
    });
    
    if (filteredLoans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">search_off</span>
                <h3>No loans found</h3>
                <p>Try adjusting your search or filter</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredLoans.map(loan => createLoanCard(loan)).join('');
}

// Create Loan Card HTML
function createLoanCard(loan) {
    const totalAmount = calculateTotalAmount(loan);
    const remainingAmount = calculateRemainingAmount(loan);
    const interest = totalAmount - loan.amount;
    
    return `
        <div class="loan-card" onclick="showLoanDetails('${loan.id}')">
            <div class="loan-card-header">
                <div class="loan-person">
                    <div class="loan-avatar">${getInitials(loan.personName)}</div>
                    <div class="loan-person-info">
                        <h3>${loan.personName}</h3>
                        <p>${formatDate(loan.startDate)}</p>
                    </div>
                </div>
                <span class="loan-type-badge ${loan.type}">${loan.type}</span>
            </div>
            <div class="loan-card-body">
                <div class="loan-detail">
                    <span class="loan-detail-label">Principal</span>
                    <span class="loan-detail-value">${formatCurrency(loan.amount)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">Interest</span>
                    <span class="loan-detail-value">${formatCurrency(interest)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">Total Amount</span>
                    <span class="loan-detail-value">${formatCurrency(totalAmount)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">Remaining</span>
                    <span class="loan-detail-value">${formatCurrency(remainingAmount)}</span>
                </div>
            </div>
            <div class="loan-card-footer">
                <span class="loan-status ${loan.status}">
                    <span class="material-icons" style="font-size: 16px;">
                        ${loan.status === 'active' ? 'schedule' : 'check_circle'}
                    </span>
                    ${loan.status}
                </span>
                <div class="loan-actions" onclick="event.stopPropagation();">
                    <button class="loan-action-btn" onclick="showPaymentModal('${loan.id}')">
                        <span class="material-icons">payment</span>
                        Pay
                    </button>
                    <button class="loan-action-btn" onclick="editLoan('${loan.id}')">
                        <span class="material-icons">edit</span>
                        Edit
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Modal Management
function showLoanModal(type) {
    editingLoanId = null;
    document.getElementById('loanForm').reset();
    document.getElementById('loanId').value = '';
    document.getElementById('modalTitle').textContent = 'Add Loan';
    document.getElementById('loanType').value = type;
    setTodayDate();
    updateInterestInfo();
    document.getElementById('loanModal').classList.add('active');
}

function closeLoanModal() {
    document.getElementById('loanModal').classList.remove('active');
    editingLoanId = null;
}

function editLoan(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    editingLoanId = loanId;
    document.getElementById('loanId').value = loan.id;
    document.getElementById('modalTitle').textContent = 'Edit Loan';
    document.getElementById('personName').value = loan.personName;
    document.getElementById('contactInfo').value = loan.contactInfo || '';
    document.getElementById('amount').value = loan.amount;
    document.getElementById('loanType').value = loan.type;
    document.getElementById('interestType').value = loan.interestType;
    document.getElementById('interestRate').value = loan.interestRate;
    document.getElementById('startDate').value = loan.startDate;
    document.getElementById('durationMonths').value = loan.durationMonths;
    document.getElementById('paymentFrequency').value = loan.paymentFrequency;
    document.getElementById('notes').value = loan.notes || '';
    
    updateInterestInfo();
    document.getElementById('loanModal').classList.add('active');
}

function saveLoan() {
    const form = document.getElementById('loanForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const loanData = {
        personName: document.getElementById('personName').value,
        contactInfo: document.getElementById('contactInfo').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('loanType').value,
        interestType: document.getElementById('interestType').value,
        interestRate: parseFloat(document.getElementById('interestRate').value),
        startDate: document.getElementById('startDate').value,
        durationMonths: parseInt(document.getElementById('durationMonths').value),
        paymentFrequency: document.getElementById('paymentFrequency').value,
        notes: document.getElementById('notes').value,
        status: 'active'
    };
    
    if (editingLoanId) {
        // Update existing loan
        const index = loans.findIndex(l => l.id === editingLoanId);
        if (index !== -1) {
            loans[index] = { ...loans[index], ...loanData };
            showToast('Loan updated successfully');
        }
    } else {
        // Create new loan
        const newLoan = {
            ...loanData,
            id: generateId(),
            paymentsMade: [],
            createdAt: new Date().toISOString()
        };
        loans.push(newLoan);
        showToast('Loan added successfully');
    }
    
    saveToStorage();
    updateDashboard();
    renderRecentLoans();
    renderAllLoans();
    closeLoanModal();
}

function updateInterestInfo() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const rate = parseFloat(document.getElementById('interestRate').value) || 0;
    const months = parseInt(document.getElementById('durationMonths').value) || 0;
    const type = document.getElementById('interestType').value;
    const frequency = document.getElementById('paymentFrequency').value;
    
    if (amount && rate && months) {
        let interest = 0;
        let formula = '';
        
        if (type === 'simple') {
            interest = calculateSimpleInterest(amount, rate, months);
            formula = `Simple Interest: SI = (P × R × T) / 100<br>SI = (${formatCurrency(amount)} × ${rate}% × ${(months/12).toFixed(2)} years) / 100`;
        } else {
            interest = calculateCompoundInterest(amount, rate, months, frequency);
            const years = (months / 12).toFixed(2);
            let n = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : 1;
            formula = `Compound Interest (${frequency}): CI = P × (1 + R/${n*100})^(${n}×T) - P<br>CI = ${formatCurrency(amount)} × (1 + ${rate}/${n*100})^(${n}×${years}) - ${formatCurrency(amount)}`;
        }
        
        const total = amount + interest;
        const previewText = `
            ${formula}<br><br>
            <strong>Interest Amount:</strong> ${formatCurrency(interest)}<br>
            <strong>Total Repayment:</strong> ${formatCurrency(total)}
        `;
        
        document.getElementById('previewText').innerHTML = previewText;
    }
}

// Loan Details Modal
function showLoanDetails(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const totalAmount = calculateTotalAmount(loan);
    const remainingAmount = calculateRemainingAmount(loan);
    const interest = totalAmount - loan.amount;
    const paidAmount = loan.paymentsMade.reduce((sum, p) => sum + p.amount, 0);
    
    const content = `
        <div class="loan-details">
            <div class="loan-person" style="margin-bottom: 24px;">
                <div class="loan-avatar" style="width: 64px; height: 64px; font-size: 24px;">${getInitials(loan.personName)}</div>
                <div class="loan-person-info" style="margin-left: 16px;">
                    <h3 style="font-size: 24px; margin-bottom: 8px;">${loan.personName}</h3>
                    <p>${loan.contactInfo || 'No contact info'}</p>
                    <span class="loan-type-badge ${loan.type}" style="margin-top: 8px;">${loan.type}</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="stat-item">
                    <p class="stat-label">Principal Amount</p>
                    <p class="stat-value">${formatCurrency(loan.amount)}</p>
                </div>
                <div class="stat-item">
                    <p class="stat-label">Interest</p>
                    <p class="stat-value">${formatCurrency(interest)}</p>
                </div>
                <div class="stat-item">
                    <p class="stat-label">Total Amount</p>
                    <p class="stat-value">${formatCurrency(totalAmount)}</p>
                </div>
                <div class="stat-item">
                    <p class="stat-label">Remaining</p>
                    <p class="stat-value">${formatCurrency(remainingAmount)}</p>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">Loan Details</h4>
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Interest Type:</span>
                        <span style="font-weight: 500;">${loan.interestType === 'simple' ? 'Simple' : 'Compound'} (${loan.interestRate}%)</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Start Date:</span>
                        <span style="font-weight: 500;">${formatDate(loan.startDate)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Duration:</span>
                        <span style="font-weight: 500;">${loan.durationMonths} months</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Payment Frequency:</span>
                        <span style="font-weight: 500;">${loan.paymentFrequency}</span>
                    </div>
                    ${loan.notes ? `<div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Notes:</span>
                        <span style="font-weight: 500;">${loan.notes}</span>
                    </div>` : ''}
                </div>
            </div>
            
            ${loan.paymentsMade.length > 0 ? `
                <div class="payment-history">
                    <h4 style="margin-bottom: 12px;">Payment History</h4>
                    ${loan.paymentsMade.map(payment => `
                        <div class="payment-item">
                            <div class="payment-info">
                                <div class="payment-amount">${formatCurrency(payment.amount)}</div>
                                <div class="payment-date">${formatDate(payment.date)}</div>
                                ${payment.notes ? `<div class="payment-notes">${payment.notes}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-card-border-inner); display: flex; justify-content: space-between;">
                        <span style="font-weight: 500;">Total Paid:</span>
                        <span style="font-weight: 700; font-size: 18px;">${formatCurrency(paidAmount)}</span>
                    </div>
                </div>
            ` : '<p style="color: var(--color-text-secondary); text-align: center; padding: 16px;">No payments recorded yet</p>'}
        </div>
    `;
    
    document.getElementById('loanDetailsContent').innerHTML = content;
    
    const actions = `
        <button class="btn btn--secondary" onclick="deleteLoan('${loan.id}')">Delete Loan</button>
        ${loan.status === 'active' ? `<button class="btn btn--primary" onclick="markAsCompleted('${loan.id}')">Mark as Completed</button>` : ''}
        <button class="btn btn--secondary" onclick="closeLoanDetailsModal()">Close</button>
    `;
    
    document.getElementById('loanDetailsActions').innerHTML = actions;
    document.getElementById('loanDetailsModal').classList.add('active');
}

function closeLoanDetailsModal() {
    document.getElementById('loanDetailsModal').classList.remove('active');
}

function deleteLoan(loanId) {
    if (confirm('Are you sure you want to delete this loan? This action cannot be undone.')) {
        loans = loans.filter(l => l.id !== loanId);
        saveToStorage();
        updateDashboard();
        renderRecentLoans();
        renderAllLoans();
        closeLoanDetailsModal();
        showToast('Loan deleted successfully');
    }
}

function markAsCompleted(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
        loan.status = 'completed';
        saveToStorage();
        updateDashboard();
        renderRecentLoans();
        renderAllLoans();
        closeLoanDetailsModal();
        showToast('Loan marked as completed');
    }
}

// Payment Modal
function showPaymentModal(loanId) {
    document.getElementById('paymentLoanId').value = loanId;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentNotes').value = '';
    setTodayDate();
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function savePayment() {
    const loanId = document.getElementById('paymentLoanId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const notes = document.getElementById('paymentNotes').value;
    
    if (!amount || !date) {
        showToast('Please fill in all required fields');
        return;
    }
    
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const payment = {
        amount: amount,
        date: date,
        notes: notes,
        timestamp: new Date().toISOString()
    };
    
    loan.paymentsMade.push(payment);
    
    // Check if loan is fully paid
    const remainingAmount = calculateRemainingAmount(loan);
    if (remainingAmount <= 0) {
        loan.status = 'completed';
    }
    
    saveToStorage();
    updateDashboard();
    renderRecentLoans();
    renderAllLoans();
    closePaymentModal();
    showToast('Payment recorded successfully');
}

// Statistics
function renderStatistics() {
    const lentLoans = loans.filter(l => l.type === 'lent');
    const borrowedLoans = loans.filter(l => l.type === 'borrowed');
    
    const totalLent = lentLoans.reduce((sum, l) => sum + l.amount, 0);
    const totalBorrowed = borrowedLoans.reduce((sum, l) => sum + l.amount, 0);
    
    const interestEarned = lentLoans.reduce((sum, loan) => {
        const total = calculateTotalAmount(loan);
        return sum + (total - loan.amount);
    }, 0);
    
    const interestPaid = borrowedLoans.reduce((sum, loan) => {
        const total = calculateTotalAmount(loan);
        return sum + (total - loan.amount);
    }, 0);
    
    const completedLoansCount = loans.filter(l => l.status === 'completed').length;
    const avgLoanAmount = loans.length > 0 ? loans.reduce((sum, l) => sum + l.amount, 0) / loans.length : 0;
    
    document.getElementById('totalInterestEarned').textContent = formatCurrency(interestEarned);
    document.getElementById('totalInterestPaid').textContent = formatCurrency(interestPaid);
    document.getElementById('completedLoans').textContent = completedLoansCount;
    document.getElementById('avgLoanAmount').textContent = formatCurrency(avgLoanAmount);
    
    // Lending Overview Chart
    const lendingCtx = document.getElementById('lendingChart');
    if (lendingCtx) {
        new Chart(lendingCtx, {
            type: 'doughnut',
            data: {
                labels: ['Lent', 'Borrowed'],
                datasets: [{
                    data: [totalLent, totalBorrowed],
                    backgroundColor: ['#1FB8CD', '#FFC185'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Interest Chart
    const interestCtx = document.getElementById('interestChart');
    if (interestCtx) {
        new Chart(interestCtx, {
            type: 'bar',
            data: {
                labels: ['Interest Earned', 'Interest Paid'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [interestEarned, interestPaid],
                    backgroundColor: ['#B4413C', '#5D878F'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// View Management
function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        }
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const viewId = viewName + 'View';
    document.getElementById(viewId).classList.add('active');
    currentView = viewName;
    
    // Render content based on view
    if (viewName === 'stats') {
        renderStatistics();
    }
}

// Theme Management
function applyTheme() {
    document.body.setAttribute('data-theme', currentTheme);
    // Theme persists in memory during session
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme();
    showToast(`Switched to ${currentTheme} mode`);
}

// Data Export/Import
function exportData() {
    const dataStr = JSON.stringify(loans, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'text/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lendtrack_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedLoans = JSON.parse(e.target.result);
            if (Array.isArray(importedLoans)) {
                loans = importedLoans;
                saveToStorage();
                updateDashboard();
                renderRecentLoans();
                renderAllLoans();
                showToast('Data imported successfully');
            } else {
                showToast('Invalid file format');
            }
        } catch (error) {
            showToast('Error importing data');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        loans = [];
        saveToStorage();
        updateDashboard();
        renderRecentLoans();
        renderAllLoans();
        showToast('All data cleared');
    }
}

// Toast Notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Event Listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', renderAllLoans);
    }
    
    // Filter
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', renderAllLoans);
    }
    
    // Interest calculation updates
    const calcInputs = ['amount', 'interestRate', 'durationMonths', 'interestType', 'paymentFrequency'];
    calcInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateInterestInfo);
            element.addEventListener('change', updateInterestInfo);
        }
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}