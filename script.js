/**
 * AquaPure Industries - CVP Analysis Engine
 * Developed by: Senior Full Stack Developer & Financial Analyst
 */

// Initialize Chart instances to destroy them before re-rendering
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    initApp();
    setupEventListeners();
});

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString(undefined, options);
}

function setupEventListeners() {
    // Automatic calculation on input change
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => calculateCVP(), 500));
    });

    // Buttons
    document.getElementById('btn-calculate').addEventListener('click', calculateCVP);
    document.getElementById('btn-reset').addEventListener('click', resetInputs);
    document.getElementById('btn-export').addEventListener('click', exportCSV);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');
    if (body.classList.contains('light-mode')) {
        body.classList.replace('light-mode', 'dark-mode');
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        body.classList.replace('dark-mode', 'light-mode');
        icon.classList.replace('fa-sun', 'fa-moon');
    }
    // Re-render charts for color consistency
    calculateCVP();
}

function calculateCVP() {
    // 1. Get Inputs
    const sp = parseFloat(document.getElementById('input-sp').value);
    const vc = parseFloat(document.getElementById('input-vc').value);
    const fc = parseFloat(document.getElementById('input-fc').value);
    const sales = parseFloat(document.getElementById('input-sales').value);
    const target = parseFloat(document.getElementById('input-target').value);
    const taxRate = parseFloat(document.getElementById('input-tax').value) / 100;
    const maxUnits = parseFloat(document.getElementById('input-max-units').value);

    // 2. Validation
    if (sp <= vc) {
        showError("Selling Price must be higher than Variable Cost!");
        return;
    }
    if (sp <= 0 || vc < 0 || fc < 0 || sales < 0) {
        showError("Please enter valid positive numbers.");
        return;
    }

    // 3. Core Calculations
    const contribution = sp - vc;
    const cmRatio = (contribution / sp) * 100;
    const bepUnits = fc / contribution;
    const bepSales = bepUnits * sp;
    const mosUnits = sales - bepUnits;
    const mosSales = mosUnits * sp;
    const mosPercent = (sales > 0) ? (mosUnits / sales) * 100 : 0;
    
    const totalRevenue = sales * sp;
    const totalVC = sales * vc;
    const totalCost = totalVC + fc;
    const npbt = totalRevenue - totalCost;
    const npat = npbt > 0 ? npbt * (1 - taxRate) : npbt;
    
    const targetUnits = (fc + target) / contribution;
    const dol = contribution * sales / npbt;

    // 4. Update KPI Cards
    updateKPI('kpi-contribution', `₹${contribution.toFixed(2)}`);
    updateKPI('kpi-cm-ratio', `${cmRatio.toFixed(2)}%`);
    updateKPI('kpi-bep-units', Math.ceil(bepUnits).toLocaleString());
    updateKPI('kpi-bep-sales', `₹${bepSales.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    updateKPI('kpi-mos', `${mosPercent.toFixed(1)}%`);
    updateKPI('kpi-target-units', Math.ceil(targetUnits).toLocaleString());
    updateKPI('kpi-profit', `₹${npat.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
    updateKPI('kpi-dol', isFinite(dol) ? dol.toFixed(2) : 'N/A');

    // 5. Update Visuals
    renderCharts(sp, vc, fc, sales, bepUnits, maxUnits);
    renderSensitivityTable(sp, vc, fc, sales);
    generateInsights(mosPercent, cmRatio, npbt, dol);
}

function updateKPI(id, value) {
    const el = document.getElementById(id);
    el.innerText = value;
    el.parentElement.parentElement.classList.add('pulse');
    setTimeout(() => el.parentElement.parentElement.classList.remove('pulse'), 500);
}

function renderCharts(sp, vc, fc, sales, bepUnits, maxUnits) {
    const ctxBep = document.getElementById('bepChart').getContext('2d');
    const ctxRev = document.getElementById('revenueCostChart').getContext('2d');
    const ctxPie = document.getElementById('contributionDoughnut').getContext('2d');
    const ctxProfit = document.getElementById('profitChart').getContext('2d');
    
    const labels = [];
    const revenueData = [];
    const totalCostData = [];
    const profitData = [];
    
    const step = maxUnits / 10;
    for (let i = 0; i <= maxUnits; i += step) {
        labels.push(i);
        revenueData.push(i * sp);
        totalCostData.push(fc + (i * vc));
        profitData.push((i * sp) - (fc + (i * vc)));
    }

    // Helper to get theme colors
    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // 1. BEP Chart (Line)
    destroyChart('bepChart');
    charts['bepChart'] = new Chart(ctxBep, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Revenue', data: revenueData, borderColor: '#2563eb', fill: false, tension: 0.1 },
                { label: 'Total Cost', data: totalCostData, borderColor: '#ef4444', fill: false, tension: 0.1 },
                { 
                    label: 'Break-Even Point', 
                    data: labels.map(l => (Math.abs(l - bepUnits) < step) ? (bepUnits * sp) : null), 
                    pointBackgroundColor: '#f59e0b', 
                    pointRadius: 8,
                    showLine: false
                }
            ]
        },
        options: chartOptions(gridColor, textColor)
    });

    // 2. Contribution Doughnut
    destroyChart('contributionDoughnut');
    charts['contributionDoughnut'] = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Variable Cost', 'Fixed Cost', 'Net Profit'],
            datasets: [{
                data: [vc * sales, fc, (sp - vc) * sales - fc],
                backgroundColor: ['#6366f1', '#f43f5e', '#10b981']
            }]
        }
    });

    // 3. Profit Chart
    destroyChart('profitChart');
    charts['profitChart'] = new Chart(ctxProfit, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit/Loss',
                data: profitData,
                backgroundColor: profitData.map(v => v >= 0 ? '#10b981' : '#ef4444')
            }]
        },
        options: chartOptions(gridColor, textColor)
    });
// 4. Revenue vs Total Cost Chart (Line Chart with Fill)
    destroyChart('revenueCostChart');
    charts['revenueCostChart'] = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Revenue',
                    data: revenueData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2
                },
                {
                    label: 'Total Cost',
                    data: totalCostData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2
                }
            ]
        },
        options: {
            ...chartOptions(gridColor, textColor),
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `₹${context.parsed.y.toLocaleString()}`
                    }
                }
            }
        }
    });

    // 5. Sensitivity Analysis Chart (Bar Chart showing Profit impact of Price changes)
    const ctxSensitivity = document.getElementById('sensitivityBar').getContext('2d');
    destroyChart('sensitivityBar');

    const sensitivityLabels = ['-20%', '-10%', 'Base', '+10%', '+20%'];
    const profitImpactData = [0.8, 0.9, 1, 1.1, 1.2].map(multiplier => {
        // Calculating profit impact based on Selling Price variation
        return ((sp * multiplier) - vc) * sales - fc;
    });

    charts['sensitivityBar'] = new Chart(ctxSensitivity, {
        type: 'bar',
        data: {
            labels: sensitivityLabels,
            datasets: [{
                label: 'Profit impact per Price Change',
                data: profitImpactData,
                backgroundColor: profitImpactData.map(val => val >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor: profitImpactData.map(val => val >= 0 ? '#10b981' : '#ef4444'),
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            ...chartOptions(gridColor, textColor),
            scales: {
                y: {
                    grid: { color: gridColor },
                    ticks: { 
                        color: textColor,
                        callback: (value) => '₹' + value.toLocaleString() 
                    }
                },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

function chartOptions(grid, text) {
    return {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
            legend: {
                labels: {
                    color: text
                }
            }
        },

        scales: {
            x: {
                grid: {
                    color: grid
                },
                ticks: {
                    color: text
                }
            },

            y: {
                grid: {
                    color: grid
                },
                ticks: {
                    color: text
                }
            }
        }
    };
}

function renderSensitivityTable(sp, vc, fc, sales) {
    const tbody = document.getElementById('sensitivity-body');
    tbody.innerHTML = '';
    const percentages = [-0.2, -0.1, 0, 0.1, 0.2];
    const factors = [
        { name: 'Selling Price', key: 'sp' },
        { name: 'Variable Cost', key: 'vc' },
        { name: 'Fixed Cost', key: 'fc' }
    ];

    factors.forEach(factor => {
        let row = `<tr><td>Change in ${factor.name}</td>`;
        percentages.forEach(p => {
            let nSp = sp, nVc = vc, nFc = fc;
            if (factor.key === 'sp') nSp = sp * (1 + p);
            if (factor.key === 'vc') nVc = vc * (1 + p);
            if (factor.key === 'fc') nFc = fc * (1 + p);
            
            const profit = (nSp - nVc) * sales - nFc;
            const colorClass = profit >= 0 ? 'text-success' : 'text-danger';
            row += `<td class="${p === 0 ? 'base-val' : ''}">₹${Math.round(profit).toLocaleString()}</td>`;
        });
        row += '</tr>';
        tbody.innerHTML += row;
    });
}

function generateInsights(mos, cm, profit, dol) {
    const container = document.getElementById('insights-list');
    container.innerHTML = '';

    const insights = [];
    
    // Profitability
    if (profit > 0) insights.push({ type: 'positive', text: "Business is currently profitable at the expected sales volume.", icon: 'fa-check-circle' });
    else insights.push({ type: 'danger', text: "Operation is currently at a loss. Increase sales or reduce costs.", icon: 'fa-exclamation-triangle' });

    // MoS
    if (mos > 30) insights.push({ type: 'positive', text: `Healthy Margin of Safety (${mos.toFixed(1)}%). High protection against sales drop.`, icon: 'fa-shield-heart' });
    else insights.push({ type: 'warning', text: "Low Margin of Safety. A small dip in sales could lead to losses.", icon: 'fa-triangle-exclamation' });

    // CM Ratio
    if (cm > 40) insights.push({ type: 'positive', text: `Strong Contribution Ratio (${cm.toFixed(1)}%). Good efficiency per bottle sold.`, icon: 'fa-chart-pie' });

    // DOL
    if (dol > 3) insights.push({ type: 'warning', text: "High Operating Leverage: Profits will grow fast with sales, but so will losses if sales drop.", icon: 'fa-gauge-high' });

    insights.forEach(ins => {
        container.innerHTML += `
            <div class="insight-item ${ins.type}">
                <i class="fas ${ins.icon}"></i>
                <span>${ins.text}</span>
            </div>
        `;
    });
}

function destroyChart(id) {
    if (charts[id]) charts[id].destroy();
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function resetInputs() {
    document.getElementById('input-sp').value = 30;
    document.getElementById('input-vc').value = 18;
    document.getElementById('input-fc').value = 50000;
    document.getElementById('input-sales').value = 8000;
    calculateCVP();
}

function showError(msg) {
    const toast = document.getElementById('error-toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function exportCSV() {
    const sp = document.getElementById('input-sp').value;
    const profit = document.getElementById('kpi-profit').innerText;
    const bep = document.getElementById('kpi-bep-units').innerText;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Factor,Value\n";
    csvContent += `Selling Price,${sp}\n`;
    csvContent += `Break-even Units,${bep}\n`;
    csvContent += `Current Net Profit,${profit}\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "AquaPure_Analysis.csv");
    document.body.appendChild(link);
    link.click();
}

function initApp() {
    calculateCVP();
}