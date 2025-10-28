// LendTrack - Personal Lending Manager
// All data stored in memory and synchronized with localStorage

let loans = [];
let currentView = 'dashboard';
let currentTheme = 'light';
let editingLoanId = null;
let todayDate = new Date();

// Initialize app
function initApp() {
    todayDate = new Date();
    // Start with empty loans array - no sample data
    // Data persists in memory during the session only
    applyTheme();
    setCurrentDate();
    updateDashboard();
    renderPerPersonSummary();
    renderRecentLoans();
    renderAllLoans();
    setTodayDate();
    setupEventListeners();
}

// Set current date display
function setCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = todayDate.toLocaleDateString('en-IN', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

// In-Memory Storage Management
// NOTE: Data is stored in memory only and will be lost on page refresh
// This is intentional - no localStorage/sessionStorage due to sandbox restrictions
function saveToStorage() {
    // Data persists in memory during session only
    // In a production app, this would save to a backend API
    console.log('Data saved to memory. Loans count:', loans.length);
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
function getDaysElapsed(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function calculateSimpleInterest(principal, rate, timeMonths) {
    const timeYears = timeMonths / 12;
    return (principal * rate * timeYears) / 100;
}

function calculateSimpleInterestByDays(principal, rate, days) {
    const timeYears = days / 365;
    return (principal * rate * timeYears) / 100;
}

function calculateCompoundInterest(principal, rate, timeMonths, frequency) {
    const timeYears = timeMonths / 12;
    const n = getCompoundFrequencyValue(frequency);
    const amount = principal * Math.pow((1 + rate / (100 * n)), n * timeYears);
    return amount - principal;
}

function calculateCompoundInterestByDays(principal, rate, days, frequency) {
    const timeYears = days / 365;
    const n = getCompoundFrequencyValue(frequency);
    const amount = principal * Math.pow((1 + rate / (100 * n)), n * timeYears);
    return amount - principal;
}

function getCompoundFrequencyValue(frequency) {
    switch(frequency) {
        case 'daily': return 365;
        case 'weekly': return 52;
        case 'monthly': return 12;
        case 'quarterly': return 4;
        case 'annually': return 1;
        default: return 12;
    }
}

function getCompoundFrequencyName(frequency) {
    switch(frequency) {
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        case 'quarterly': return 'Quarterly';
        case 'annually': return 'Annually';
        default: return 'Monthly';
    }
}

// Calculate accrued interest from start date to a specific date
function calculateAccruedInterest(loan, asOfDate) {
    const daysElapsed = getDaysElapsed(loan.startDate, asOfDate);
    let interest = 0;
    
    if (loan.interestType === 'simple') {
        interest = calculateSimpleInterestByDays(loan.amount, loan.interestRate, daysElapsed);
    } else {
        const frequency = loan.compoundFrequency || 'monthly';
        interest = calculateCompoundInterestByDays(loan.amount, loan.interestRate, daysElapsed, frequency);
    }
    
    return interest;
}

// Calculate current outstanding amount with breakdown
function calculateCurrentOutstanding(loan) {
    const principal = loan.amount;
    const accruedInterest = calculateAccruedInterest(loan, todayDate);
    const totalPayments = loan.paymentsMade.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = principal + accruedInterest - totalPayments;
    
    return {
        principal: principal,
        interest: accruedInterest,
        payments: totalPayments,
        outstanding: Math.max(0, outstanding)
    };
}

function calculateTotalAmount(loan) {
    let interest = 0;
    if (loan.interestType === 'simple') {
        interest = calculateSimpleInterest(loan.amount, loan.interestRate, loan.durationMonths);
    } else {
        const frequency = loan.compoundFrequency || loan.paymentFrequency || 'monthly';
        interest = calculateCompoundInterest(loan.amount, loan.interestRate, loan.durationMonths, frequency);
    }
    return loan.amount + interest;
}

function calculateRemainingAmount(loan) {
    const breakdown = calculateCurrentOutstanding(loan);
    return breakdown.outstanding;
}

// Get maturity date
function getMaturityDate(loan) {
    const start = new Date(loan.startDate);
    const maturity = new Date(start);
    maturity.setMonth(maturity.getMonth() + loan.durationMonths);
    return maturity;
}

// Get days remaining until maturity
function getDaysRemaining(loan) {
    const maturityDate = getMaturityDate(loan);
    const today = todayDate;
    const diffTime = maturityDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Get person summary
function getPersonSummary(personName) {
    const personLoans = loans.filter(l => l.personName === personName);
    
    const lentLoans = personLoans.filter(l => l.type === 'lent');
    const borrowedLoans = personLoans.filter(l => l.type === 'borrowed');
    
    const totalLent = lentLoans.reduce((sum, l) => sum + l.amount, 0);
    const totalBorrowed = borrowedLoans.reduce((sum, l) => sum + l.amount, 0);
    
    const outstandingLent = lentLoans.reduce((sum, loan) => {
        if (loan.status === 'active') {
            return sum + calculateCurrentOutstanding(loan).outstanding;
        }
        return sum;
    }, 0);
    
    const outstandingBorrowed = borrowedLoans.reduce((sum, loan) => {
        if (loan.status === 'active') {
            return sum + calculateCurrentOutstanding(loan).outstanding;
        }
        return sum;
    }, 0);
    
    const netOutstanding = outstandingLent - outstandingBorrowed;
    let netPosition = 'settled';
    if (netOutstanding > 0) {
        netPosition = 'owes-you';
    } else if (netOutstanding < 0) {
        netPosition = 'you-owe';
    }
    
    return {
        name: personName,
        totalLent: totalLent,
        totalBorrowed: totalBorrowed,
        outstandingLent: outstandingLent,
        outstandingBorrowed: outstandingBorrowed,
        netOutstanding: Math.abs(netOutstanding),
        netPosition: netPosition,
        loanCount: personLoans.length,
        activeLoans: personLoans.filter(l => l.status === 'active').length,
        loans: personLoans
    };
}

// Get all unique persons
function getAllPersons() {
    const persons = new Set();
    loans.forEach(loan => persons.add(loan.personName));
    return Array.from(persons).map(name => getPersonSummary(name));
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

// Render Per Person Summary
function renderPerPersonSummary() {
    const container = document.getElementById('perPersonList');
    const persons = getAllPersons();
    
    if (persons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">people_outline</span>
                <h3>No People Yet</h3>
                <p>Add loans to see person-wise summaries</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = persons.map(person => `
        <div class="person-summary-card" onclick="switchView('people')">
            <div class="person-summary-header">
                <div class="person-summary-name">
                    <div class="person-summary-avatar">${getInitials(person.name)}</div>
                    <div class="person-summary-info">
                        <h3>${person.name}</h3>
                        <p>${person.activeLoans} active loan${person.activeLoans !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <span class="person-net-position ${person.netPosition}">
                    ${person.netPosition === 'owes-you' ? 'Owes You' : person.netPosition === 'you-owe' ? 'You Owe' : 'Settled'}
                </span>
            </div>
            <div class="person-summary-body">
                ${person.outstandingLent > 0 ? `
                    <div class="person-summary-stat">
                        <div class="person-summary-stat-label">They Owe</div>
                        <div class="person-summary-stat-value" style="color: var(--color-success);">${formatCurrency(person.outstandingLent)}</div>
                    </div>
                ` : ''}
                ${person.outstandingBorrowed > 0 ? `
                    <div class="person-summary-stat">
                        <div class="person-summary-stat-label">You Owe</div>
                        <div class="person-summary-stat-value" style="color: var(--color-error);">${formatCurrency(person.outstandingBorrowed)}</div>
                    </div>
                ` : ''}
                <div class="person-summary-stat">
                    <div class="person-summary-stat-label">Net Outstanding</div>
                    <div class="person-summary-stat-value">${formatCurrency(person.netOutstanding)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Render People View
function renderPeopleView() {
    const container = document.getElementById('peopleList');
    const persons = getAllPersons();
    
    if (persons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">people_outline</span>
                <h3>No People Found</h3>
                <p>Add a loan to get started and track people</p>
                <button class="btn btn--primary" onclick="showLoanModal('lent')" style="margin-top: 16px;">
                    <span class="material-icons">add</span>
                    Add Loan
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = persons.map(person => `
        <div class="person-detail-card">
            <div class="person-detail-header">
                <div class="person-summary-name">
                    <div class="person-summary-avatar" style="width: 56px; height: 56px; font-size: 22px;">${getInitials(person.name)}</div>
                    <div class="person-summary-info">
                        <h3 style="font-size: 20px;">${person.name}</h3>
                        <p>${person.loanCount} total loan${person.loanCount !== 1 ? 's' : ''} • ${person.activeLoans} active</p>
                    </div>
                </div>
                <span class="person-net-position ${person.netPosition}" style="padding: 10px 20px; font-size: 14px;">
                    ${person.netPosition === 'owes-you' ? '↑ Owes You' : person.netPosition === 'you-owe' ? '↓ You Owe' : '• Settled'}
                </span>
            </div>
            
            <div class="person-summary-body" style="margin-bottom: 20px;">
                <div class="person-summary-stat">
                    <div class="person-summary-stat-label">Total Lent</div>
                    <div class="person-summary-stat-value">${formatCurrency(person.totalLent)}</div>
                </div>
                <div class="person-summary-stat">
                    <div class="person-summary-stat-label">Total Borrowed</div>
                    <div class="person-summary-stat-value">${formatCurrency(person.totalBorrowed)}</div>
                </div>
                ${person.outstandingLent > 0 ? `
                    <div class="person-summary-stat">
                        <div class="person-summary-stat-label">They Owe</div>
                        <div class="person-summary-stat-value" style="color: var(--color-success);">${formatCurrency(person.outstandingLent)}</div>
                    </div>
                ` : ''}
                ${person.outstandingBorrowed > 0 ? `
                    <div class="person-summary-stat">
                        <div class="person-summary-stat-label">You Owe</div>
                        <div class="person-summary-stat-value" style="color: var(--color-error);">${formatCurrency(person.outstandingBorrowed)}</div>
                    </div>
                ` : ''}
            </div>
            
            <h4 style="margin-bottom: 12px; font-size: 16px;">All Loans</h4>
            <div class="person-loans-list">
                ${person.loans.map(loan => {
                    const outstanding = calculateCurrentOutstanding(loan);
                    return `
                        <div class="person-loan-item" onclick="showLoanDetails('${loan.id}')">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span class="loan-type-badge ${loan.type}" style="margin-right: 8px;">${loan.type}</span>
                                    <span style="font-weight: 500;">${formatCurrency(loan.amount)}</span>
                                    <span style="color: var(--color-text-secondary); font-size: 12px; margin-left: 8px;">
                                        ${loan.interestType === 'compound' ? 'Compound' : 'Simple'} @ ${loan.interestRate}%
                                    </span>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 600; color: ${loan.status === 'active' ? 'var(--color-success)' : 'var(--color-info)'};">
                                        ${loan.status === 'active' ? formatCurrency(outstanding.outstanding) : 'Completed'}
                                    </div>
                                    <div style="font-size: 11px; color: var(--color-text-secondary);">
                                        ${formatDate(loan.startDate)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
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
                <span class="material-icons">account_balance_wallet</span>
                <h3>No Loans Yet</h3>
                <p>Start tracking your lending by adding your first loan</p>
                <button class="btn btn--primary" onclick="showLoanModal('lent')" style="margin-top: 16px;">
                    <span class="material-icons">add</span>
                    Add Your First Loan
                </button>
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
    
    if (loans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">receipt_long</span>
                <h3>Your Loan List is Empty</h3>
                <p>Create your first loan to start tracking</p>
                <button class="btn btn--primary" onclick="showLoanModal('lent')" style="margin-top: 16px;">
                    <span class="material-icons">add</span>
                    Add Loan
                </button>
            </div>
        `;
        return;
    }
    
    if (filteredLoans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">search_off</span>
                <h3>No Loans Found</h3>
                <p>Try adjusting your search or filter</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredLoans.map(loan => createLoanCard(loan)).join('');
}

// Create Loan Card HTML
function createLoanCard(loan) {
    const outstanding = calculateCurrentOutstanding(loan);
    const daysElapsed = getDaysElapsed(loan.startDate, todayDate);
    const daysRemaining = getDaysRemaining(loan);
    const isOverdue = daysRemaining < 0 && loan.status === 'active';
    
    return `
        <div class="loan-card" onclick="showLoanDetails('${loan.id}')">
            <div class="loan-card-header">
                <div class="loan-person">
                    <div class="loan-avatar">${getInitials(loan.personName)}</div>
                    <div class="loan-person-info">
                        <h3>${loan.personName}</h3>
                        <p>${formatDate(loan.startDate)} • ${daysElapsed} days ago</p>
                    </div>
                </div>
                <span class="loan-type-badge ${loan.type}">${loan.type}</span>
            </div>
            
            ${loan.status === 'active' ? `
                <div class="loan-outstanding">
                    <div class="loan-outstanding-label">Current Outstanding</div>
                    <div class="loan-outstanding-value">${formatCurrency(outstanding.outstanding)}</div>
                    <div class="loan-outstanding-date">as of ${formatDate(todayDate.toISOString().split('T')[0])}</div>
                </div>
            ` : ''}
            
            <div class="loan-card-body">
                <div class="loan-detail">
                    <span class="loan-detail-label">Principal</span>
                    <span class="loan-detail-value">${formatCurrency(outstanding.principal)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">Interest Accrued</span>
                    <span class="loan-detail-value">${formatCurrency(outstanding.interest)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">Total Repayments</span>
                    <span class="loan-detail-value">${formatCurrency(outstanding.payments)}</span>
                </div>
                <div class="loan-detail">
                    <span class="loan-detail-label">${isOverdue ? 'Overdue' : daysRemaining > 0 ? 'Days Remaining' : 'Status'}</span>
                    <span class="loan-detail-value" style="color: ${isOverdue ? 'var(--color-error)' : 'var(--color-text)'}">
                        ${isOverdue ? Math.abs(daysRemaining) + ' days' : daysRemaining > 0 ? daysRemaining + ' days' : 'Due'}
                    </span>
                </div>
            </div>
            <div class="loan-card-footer">
                <span class="loan-status ${isOverdue ? 'overdue' : loan.status}">
                    <span class="material-icons" style="font-size: 16px;">
                        ${isOverdue ? 'warning' : loan.status === 'active' ? 'schedule' : 'check_circle'}
                    </span>
                    ${isOverdue ? 'overdue' : loan.status}
                </span>
                <div class="loan-actions" onclick="event.stopPropagation();">
                    ${loan.status === 'active' ? `
                        <button class="loan-action-btn" onclick="showPaymentModal('${loan.id}')">
                            <span class="material-icons">payment</span>
                            Pay
                        </button>
                    ` : ''}
                    <button class="loan-action-btn" onclick="editLoan('${loan.id}')">
                        <span class="material-icons">edit</span>
                        Edit
                    </button>
                    <button class="loan-action-btn" onclick="deleteLoan('${loan.id}')" style="color: var(--color-error);">
                        <span class="material-icons">delete</span>
                        Delete
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
    document.getElementById('compoundFrequency').value = loan.compoundFrequency || 'monthly';
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
        compoundFrequency: document.getElementById('compoundFrequency').value,
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
    renderPerPersonSummary();
    renderRecentLoans();
    renderAllLoans();
    closeLoanModal();
}

function updateInterestInfo() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const rate = parseFloat(document.getElementById('interestRate').value) || 0;
    const months = parseInt(document.getElementById('durationMonths').value) || 0;
    const type = document.getElementById('interestType').value;
    const compoundFreq = document.getElementById('compoundFrequency').value;
    
    // Show/hide compound frequency based on interest type
    const compoundFreqGroup = document.getElementById('compoundFrequencyGroup');
    if (type === 'compound') {
        compoundFreqGroup.style.display = 'block';
    } else {
        compoundFreqGroup.style.display = 'none';
    }
    
    if (amount && rate && months) {
        let interest = 0;
        let formula = '';
        
        if (type === 'simple') {
            interest = calculateSimpleInterest(amount, rate, months);
            formula = `Simple Interest: SI = (P × R × T) / 100<br>SI = (${formatCurrency(amount)} × ${rate}% × ${(months/12).toFixed(2)} years) / 100`;
        } else {
            interest = calculateCompoundInterest(amount, rate, months, compoundFreq);
            const years = (months / 12).toFixed(2);
            const n = getCompoundFrequencyValue(compoundFreq);
            const freqName = getCompoundFrequencyName(compoundFreq);
            formula = `Compound Interest (${freqName}): A = P × (1 + r/n)^(n×t)<br>A = ${formatCurrency(amount)} × (1 + ${rate/100}/€{n})^(${n}×${years})`;
        }
        
        const total = amount + interest;
        const previewText = `
            ${formula}<br><br>
            <strong>Interest Amount at Maturity:</strong> ${formatCurrency(interest)}<br>
            <strong>Total Repayment:</strong> ${formatCurrency(total)}<br>
            <small style="color: var(--color-text-secondary);">Based on ${months} months duration</small>
        `;
        
        document.getElementById('previewText').innerHTML = previewText;
    }
}

// Loan Details Modal
function showLoanDetails(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const outstanding = calculateCurrentOutstanding(loan);
    const totalAmount = calculateTotalAmount(loan);
    const daysElapsed = getDaysElapsed(loan.startDate, todayDate);
    const daysRemaining = getDaysRemaining(loan);
    const maturityDate = getMaturityDate(loan);
    const isOverdue = daysRemaining < 0 && loan.status === 'active';
    const progress = Math.min(100, (daysElapsed / (daysElapsed + Math.max(0, daysRemaining))) * 100);
    
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
            
            ${loan.status === 'active' ? `
                <div class="loan-outstanding" style="margin-bottom: 20px;">
                    <div class="loan-outstanding-label">Current Outstanding</div>
                    <div class="loan-outstanding-value">${formatCurrency(outstanding.outstanding)}</div>
                    <div class="loan-outstanding-date">as of ${formatDate(todayDate.toISOString().split('T')[0])}</div>
                </div>
            ` : ''}
            
            <div class="interest-breakdown">
                <h4>Amount Breakdown</h4>
                <div class="interest-breakdown-row">
                    <span>Original Principal:</span>
                    <span>${formatCurrency(outstanding.principal)}</span>
                </div>
                <div class="interest-breakdown-row">
                    <span>Interest Accrued (to date):</span>
                    <span>${formatCurrency(outstanding.interest)}</span>
                </div>
                <div class="interest-breakdown-row">
                    <span>Total Repayments:</span>
                    <span>${formatCurrency(outstanding.payments)}</span>
                </div>
                <div class="interest-breakdown-row">
                    <span>Current Outstanding:</span>
                    <span style="font-size: 18px;">${formatCurrency(outstanding.outstanding)}</span>
                </div>
            </div>
            
            ${loan.status === 'active' ? `
                <div class="days-counter">
                    <div class="days-counter-item">
                        <span class="days-counter-value">${daysElapsed}</span>
                        <span class="days-counter-label">Days Elapsed</span>
                    </div>
                    <div class="days-counter-item">
                        <span class="days-counter-value" style="color: ${isOverdue ? 'var(--color-error)' : 'var(--color-text)'}">
                            ${isOverdue ? Math.abs(daysRemaining) : daysRemaining}
                        </span>
                        <span class="days-counter-label">${isOverdue ? 'Days Overdue' : 'Days Remaining'}</span>
                    </div>
                </div>
                
                <div class="loan-progress">
                    <div class="loan-progress-bar">
                        <div class="loan-progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="loan-progress-label">
                        <span>${formatDate(loan.startDate)}</span>
                        <span>${formatDate(maturityDate.toISOString().split('T')[0])}</span>
                    </div>
                </div>
            ` : ''}
            
            <div style="margin-bottom: 16px; margin-top: 20px;">
                <h4 style="margin-bottom: 12px;">Loan Details</h4>
                <div style="display: grid; gap: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Interest Type:</span>
                        <span style="font-weight: 500;">${loan.interestType === 'simple' ? 'Simple' : 'Compound'} @ ${loan.interestRate}%</span>
                    </div>
                    ${loan.interestType === 'compound' ? `
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-text-secondary);">Compound Frequency:</span>
                            <span style="font-weight: 500;">${getCompoundFrequencyName(loan.compoundFrequency || 'monthly')}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Start Date:</span>
                        <span style="font-weight: 500;">${formatDate(loan.startDate)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Maturity Date:</span>
                        <span style="font-weight: 500;">${formatDate(maturityDate.toISOString().split('T')[0])}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Duration:</span>
                        <span style="font-weight: 500;">${loan.durationMonths} months</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-secondary);">Expected at Maturity:</span>
                        <span style="font-weight: 500;">${formatCurrency(totalAmount)}</span>
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
                        <span style="font-weight: 700; font-size: 18px;">${formatCurrency(outstanding.payments)}</span>
                    </div>
                </div>
            ` : '<p style="color: var(--color-text-secondary); text-align: center; padding: 16px;">No payments recorded yet</p>'}
        </div>
    `;
    
    document.getElementById('loanDetailsContent').innerHTML = content;
    
    const actions = `
        <button class="btn btn--outline" onclick="closeLoanDetailsModal()">Close</button>
        ${loan.status === 'active' ? `<button class="btn btn--primary" onclick="showPaymentModal('${loan.id}'); closeLoanDetailsModal();">Record Payment</button>` : ''}
        ${loan.status === 'active' ? `<button class="btn btn--secondary" onclick="markAsCompleted('${loan.id}')">Mark as Completed</button>` : ''}
        <button class="btn btn--error" onclick="deleteLoan('${loan.id}')" style="background-color: var(--color-error); color: white;">
            <span class="material-icons">delete</span>
            Delete Loan
        </button>
    `;
    
    document.getElementById('loanDetailsActions').innerHTML = actions;
    document.getElementById('loanDetailsModal').classList.add('active');
}

function closeLoanDetailsModal() {
    document.getElementById('loanDetailsModal').classList.remove('active');
}

function deleteLoan(loanId) {
    // Find the loan first
    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
        showToast('Loan not found', 'error');
        return;
    }
    
    // Show confirmation dialog with person name
    const confirmed = confirm(`Are you sure you want to delete the loan for ${loan.personName}? This action cannot be undone.`);
    
    if (confirmed) {
        // Remove from array
        loans = loans.filter(l => l.id !== loanId);
        
        // Save to storage
        saveToStorage();
        
        // Close any open modals
        closeLoanDetailsModal();
        closePaymentModal();
        
        // Refresh all views
        updateDashboard();
        renderPerPersonSummary();
        renderRecentLoans();
        renderAllLoans();
        renderPeopleView();
        
        // Show success message
        showToast('Loan deleted successfully');
    }
}

function markAsCompleted(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
        loan.status = 'completed';
        saveToStorage();
        updateDashboard();
        renderPerPersonSummary();
        renderRecentLoans();
        renderAllLoans();
        closeLoanDetailsModal();
        showToast('Loan marked as completed');
    }
}

// Payment Modal
function showPaymentModal(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    document.getElementById('paymentLoanId').value = loanId;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentNotes').value = '';
    setTodayDate();
    
    const outstanding = calculateCurrentOutstanding(loan);
    const summaryBefore = `
        <h4 style="margin-bottom: 12px;">Current Status</h4>
        <div class="payment-summary-row">
            <span class="payment-summary-label">Principal Amount:</span>
            <span class="payment-summary-value">${formatCurrency(outstanding.principal)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">Interest Accrued (to date):</span>
            <span class="payment-summary-value">${formatCurrency(outstanding.interest)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">Previous Payments:</span>
            <span class="payment-summary-value">${formatCurrency(outstanding.payments)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">Outstanding Amount:</span>
            <span class="payment-summary-value" style="color: var(--color-success); font-size: 18px;">${formatCurrency(outstanding.outstanding)}</span>
        </div>
    `;
    
    document.getElementById('paymentSummaryBefore').innerHTML = summaryBefore;
    document.getElementById('paymentSummaryAfter').innerHTML = '';
    document.getElementById('paymentModal').classList.add('active');
}

function updatePaymentPreview() {
    const loanId = document.getElementById('paymentLoanId').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    
    if (!loanId || !paymentAmount) {
        document.getElementById('paymentSummaryAfter').innerHTML = '';
        return;
    }
    
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const outstanding = calculateCurrentOutstanding(loan);
    const newOutstanding = Math.max(0, outstanding.outstanding - paymentAmount);
    const interestPortion = Math.min(paymentAmount, outstanding.interest);
    const principalPortion = paymentAmount - interestPortion;
    
    const summaryAfter = `
        <h4 style="margin-bottom: 12px;">After Payment</h4>
        <div class="payment-summary-row">
            <span class="payment-summary-label">Payment Amount:</span>
            <span class="payment-summary-value">${formatCurrency(paymentAmount)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">• Interest Portion:</span>
            <span class="payment-summary-value">${formatCurrency(interestPortion)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">• Principal Portion:</span>
            <span class="payment-summary-value">${formatCurrency(principalPortion)}</span>
        </div>
        <div class="payment-summary-row">
            <span class="payment-summary-label">New Outstanding:</span>
            <span class="payment-summary-value" style="color: ${newOutstanding === 0 ? 'var(--color-info)' : 'var(--color-success)'}; font-size: 18px;">
                ${newOutstanding === 0 ? 'PAID IN FULL' : formatCurrency(newOutstanding)}
            </span>
        </div>
    `;
    
    document.getElementById('paymentSummaryAfter').innerHTML = summaryAfter;
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
    renderPerPersonSummary();
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
    } else if (viewName === 'people') {
        renderPeopleView();
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
        renderPerPersonSummary();
        renderRecentLoans();
        renderAllLoans();
        renderPeopleView();
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
    const calcInputs = ['amount', 'interestRate', 'durationMonths', 'interestType', 'paymentFrequency', 'compoundFrequency'];
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