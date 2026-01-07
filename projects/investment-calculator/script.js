let mainChart;
let activePage = 'investments';
let activeTab = 'basic';
let assets = [
    { name: 'Real Estate', value: 1500000, cashFlow: 50000, year: 3, growth: 3 },
    { name: 'Business', value: 3000000, cashFlow: 300000, year: 3, growth: 5 }
];

// --- UPDATED FORMATTING HELPERS ---
function handleInput(el) {
    // 1. Remove all non-numeric characters except for the decimal point
    let value = el.value.replace(/[^0-9.]/g, '');
    
    if (value) {
        // 2. Remove leading zeros unless the number is "0" or starts with "0."
        if (value.length > 1 && value.startsWith('0') && value[1] !== '.') {
            value = value.replace(/^0+/, '');
        }
        
        // 3. Re-add commas for visual formatting
        let parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        el.value = parts.join('.');
    }
}

function getRawValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(el.value.replace(/,/g, '')) || 0;
}

function formatCurr(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// --- NAVIGATION ---
function switchPage(page) {
    activePage = page;
    document.getElementById('menu-invest').classList.toggle('active', page === 'investments');
    document.getElementById('menu-loans').classList.toggle('active', page === 'loans');
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id.includes(page)));
    
    if (page === 'investments') runCalculations();
    else runLoanCalc();
}

function switchTab(tab) {
    activeTab = tab;
    document.getElementById('btn-basic').classList.toggle('active', tab === 'basic');
    document.getElementById('btn-adv').classList.toggle('active', tab === 'advanced');
    document.getElementById('advanced-view').style.display = tab === 'advanced' ? 'block' : 'none';
    runCalculations();
}

// --- INVESTMENT LOGIC ---
function runCalculations() {
    const initial = getRawValue('initial');
    const stockRate = (parseFloat(document.getElementById('return').value) || 0) / 100;
    const monthly = getRawValue('contribution');
    const freq = parseFloat(document.getElementById('frequency').value) || 12;
    const years = parseInt(document.getElementById('years').value) || 10;

    let labels = [];
    let principalData = [];
    let interestData = [];
    let fixedData = [];
    let currentPortfolio = initial;
    let cumulativePrincipal = initial;
    let tableRows = "";

    let headerHTML = `<th>Year</th><th>Principal</th><th>Interest</th><th>Total Liquid</th>`;
    if (activeTab === 'advanced') {
        assets.forEach(a => headerHTML += `<th>${a.name} (Val)</th>`);
        headerHTML += `<th>Reinvested Cash Flow</th>`;
    }
    document.getElementById('table-header').innerHTML = headerHTML;

    for (let y = 0; y <= years; y++) {
        labels.push(`Y${y}`);
        let currentFixedVal = 0;
        let totalAnnualCashFlow = 0;
        const currentInterest = Math.max(0, currentPortfolio - cumulativePrincipal);

        let rowHTML = `<td>${y}</td><td>${formatCurr(cumulativePrincipal)}</td><td>${formatCurr(currentInterest)}</td><td style="font-weight:bold;">${formatCurr(currentPortfolio)}</td>`;

        if (activeTab === 'advanced') {
            assets.forEach(a => {
                let assetVal = 0;
                if (y >= a.year) {
                    const heldYears = y - a.year;
                    assetVal = a.value * Math.pow(1 + (a.growth/100), heldYears);
                    totalAnnualCashFlow += a.cashFlow * Math.pow(1 + (a.growth/100), heldYears);
                    currentFixedVal += assetVal;
                }
                rowHTML += `<td>${formatCurr(assetVal)}</td>`;
            });
            rowHTML += `<td style="color:#059669; font-weight:bold;">${formatCurr(totalAnnualCashFlow)}</td>`;
        }

        principalData.push(cumulativePrincipal);
        interestData.push(currentInterest);
        fixedData.push(currentFixedVal);
        tableRows += `<tr>${rowHTML}</tr>`;

        if (y < years) {
            currentPortfolio = (currentPortfolio * (1 + stockRate)) + (monthly * freq) + totalAnnualCashFlow;
            cumulativePrincipal += (monthly * freq);
        }
    }

    document.getElementById('table-body').innerHTML = tableRows;
    document.getElementById('total-display').innerText = formatCurr(currentPortfolio + (activeTab === 'advanced' ? fixedData[years] : 0));
    document.getElementById('result-label').innerText = activeTab === 'basic' ? "Liquid Future Value" : "Total Net Worth (Year 10)";
    
    updateChart(labels, [
        { label: 'Cumulative Principal', data: principalData, backgroundColor: '#2563eb' },
        { label: 'Interest Earned', data: interestData, backgroundColor: '#60a5fa' },
        { label: 'Asset Equity', data: fixedData, backgroundColor: '#059669', hidden: activeTab==='basic' }
    ]);
}

// --- LOAN LOGIC ---
function runLoanCalc() {
    const balance = getRawValue('loan-balance');
    const monthlyRate = ((parseFloat(document.getElementById('loan-rate').value) || 0) / 100) / 12;
    const totalMonths = (parseFloat(document.getElementById('loan-years').value) || 0) * 12;
    const extra = getRawValue('extra-monthly');
    const lump = getRawValue('lump-sum');

    const standardPmt = (balance > 0 && monthlyRate > 0) ? 
        (balance * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)) : 0;
    
    let labels = ["Y0"];
    let remainingBalanceData = [balance - lump];
    let curBal = balance - lump;
    let actualMonths = 0;
    let totalInterestPaid = 0;
    let tableRows = "";

    document.getElementById('table-header').innerHTML = `<th>Year</th><th>Monthly Pmt</th><th>Principal (Yr)</th><th>Interest (Yr)</th><th>Balance</th>`;

    for(let y = 1; y <= Math.ceil(totalMonths/12); y++) {
        let yrInt = 0;
        let yrPrin = 0;
        for(let m = 0; m < 12; m++) {
            if (curBal > 0) {
                let int = curBal * monthlyRate;
                let prin = (standardPmt - int) + extra;
                if(prin > curBal) prin = curBal;
                yrInt += int;
                yrPrin += prin;
                curBal -= prin;
                totalInterestPaid += int;
                actualMonths++;
            }
        }
        labels.push(`Y${y}`);
        remainingBalanceData.push(curBal > 0 ? curBal : 0);
        tableRows += `<tr><td>${y}</td><td>${formatCurr(standardPmt + extra)}</td><td>${formatCurr(yrPrin)}</td><td>${formatCurr(yrInt)}</td><td style="font-weight:bold;">${formatCurr(curBal > 0 ? curBal : 0)}</td></tr>`;
        if (curBal <= 0) break;
    }

    document.getElementById('table-body').innerHTML = tableRows;
    document.getElementById('total-display').innerText = formatCurr(curBal > 0 ? curBal : 0);
    document.getElementById('result-label').innerText = "Remaining Balance";
    document.getElementById('interest-saved').innerText = formatCurr(Math.max(0, (standardPmt * totalMonths) - (totalInterestPaid + (balance - lump))));
    document.getElementById('time-saved').innerText = `${Math.max(0, totalMonths - actualMonths)} Mos`;

    updateChart(labels, [{ label: 'Remaining Balance', data: remainingBalanceData, backgroundColor: '#ef4444' }]);
}

// --- ASSET MANAGEMENT ---
function renderAssets() {
    const list = document.getElementById('events-list');
    list.innerHTML = assets.map((a, i) => `
        <div class="asset-card">
            <input type="text" value="${a.name}" oninput="assets[${i}].name=this.value;runCalculations();" style="margin-bottom:12px; font-weight:800; border:none; background:transparent; padding:0; font-size: 16px; width: 100%;">
            <div class="flex-row">
                <div class="input-group"><label>Acq. Year</label><input type="number" value="${a.year}" oninput="assets[${i}].year=parseInt(this.value)||0;runCalculations();"></div>
                <div class="input-group">
                    <label>Initial Value ($)</label>
                    <input type="text" inputmode="decimal" value="${a.value.toLocaleString()}" oninput="handleInput(this); assets[${i}].value=parseFloat(this.value.replace(/,/g,''))||0; runCalculations();">
                </div>
            </div>
            <div class="flex-row">
                <div class="input-group">
                    <label>Initial Cashflow</label>
                    <input type="text" inputmode="decimal" value="${a.cashFlow.toLocaleString()}" oninput="handleInput(this); assets[${i}].cashFlow=parseFloat(this.value.replace(/,/g,''))||0; runCalculations();">
                </div>
                <div class="input-group"><label>Growth %</label><input type="number" value="${a.growth}" oninput="assets[${i}].growth=parseFloat(this.value)||0;runCalculations();"></div>
            </div>
            <div class="asset-card-footer">
                <button class="remove-btn" onclick="assets.splice(${i},1);renderAssets();runCalculations();">REMOVE ASSET</button>
            </div>
        </div>
    `).join('');
}

function addAsset() {
    assets.push({ name: 'New Asset', value: 0, cashFlow: 0, year: 1, growth: 0 });
    renderAssets();
    runCalculations();
}

function updateChart(labels, datasets) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (mainChart) mainChart.destroy();
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { 
                x: { stacked: activePage === 'investments' }, 
                y: { stacked: activePage === 'investments', ticks: { callback: v => '$' + v.toLocaleString() } } 
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => { renderAssets(); runCalculations(); });
