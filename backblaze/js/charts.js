// Backblaze Drive Stats Charts
// Loads quarterly_stats.json and renders Plotly charts

const DATA_URL = 'data/quarterly_stats.json';

// White→Red colorscale for failure rates (low=white, high=red)
const FAILURE_COLORSCALE = [
    [0, '#ffffff'],    // white (good - low failures)
    [0.5, '#fc8d59'],  // orange
    [1, '#b30000']     // dark red (bad - high failures)
];

// Color palette for manufacturers
const COLORS = {
    'Seagate': '#1f77b4',
    'Toshiba': '#ff7f0e',
    'HGST': '#2ca02c',
    'Western Digital': '#d62728',
    'Other': '#9467bd'
};

// Global state
let fullData = null;
let filteredData = null;

async function loadData() {
    const response = await fetch(DATA_URL);
    return await response.json();
}

// Filter data by date range
function filterByDateRange(data, startIdx, endIdx) {
    return {
        ...data,
        quarters: data.quarters.slice(startIdx, endIdx + 1)
    };
}

// Setup date range picker
function setupDatePicker(data) {
    const startSelect = document.getElementById('start-quarter');
    const endSelect = document.getElementById('end-quarter');

    // Populate options
    data.quarters.forEach((q, i) => {
        startSelect.add(new Option(q.label, i));
        endSelect.add(new Option(q.label, i));
    });

    // Default: show last 3 years (12 quarters) or all if less
    const defaultStart = Math.max(0, data.quarters.length - 12);
    startSelect.value = defaultStart;
    endSelect.value = data.quarters.length - 1;

    // Update handler
    const updateCharts = () => {
        const startIdx = parseInt(startSelect.value);
        const endIdx = parseInt(endSelect.value);

        if (startIdx <= endIdx) {
            filteredData = filterByDateRange(fullData, startIdx, endIdx);
            updateSliderForFilteredData(filteredData);
            renderAllCharts(filteredData);
        }
    };

    startSelect.addEventListener('change', updateCharts);
    endSelect.addEventListener('change', updateCharts);

    return { startIdx: defaultStart, endIdx: data.quarters.length - 1 };
}

function renderFleetGrowth(data) {
    const quarters = data.quarters;
    const labels = quarters.map(q => q.label);
    const drives = quarters.map(q => q.summary.drive_count);
    const petabytes = quarters.map(q => q.summary.total_pb);

    const trace1 = {
        x: labels,
        y: drives,
        name: 'Drive Count',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1f77b4', width: 3 },
        marker: { size: 8 }
    };

    const trace2 = {
        x: labels,
        y: petabytes,
        name: 'Total Capacity (PB)',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2',
        line: { color: '#ff7f0e', width: 3 },
        marker: { size: 8 }
    };

    const layout = {
        xaxis: { title: 'Quarter' },
        yaxis: {
            title: 'Drive Count',
            titlefont: { color: '#1f77b4' },
            tickfont: { color: '#1f77b4' },
            tickformat: ',d'
        },
        yaxis2: {
            title: 'Petabytes',
            titlefont: { color: '#ff7f0e' },
            tickfont: { color: '#ff7f0e' },
            overlaying: 'y',
            side: 'right'
        },
        legend: { x: 0.1, y: 1.1, orientation: 'h' },
        hovermode: 'x unified',
        margin: { t: 40 }
    };

    Plotly.newPlot('chart-fleet', [trace1, trace2], layout, { responsive: true });
}

function renderManufacturers(data, metric = 'drives') {
    const quarters = data.quarters;
    const labels = quarters.map(q => q.label);
    const manufacturers = ['Seagate', 'Toshiba', 'HGST', 'Western Digital', 'Other'];

    const traces = manufacturers.map(mfr => {
        const values = quarters.map(q => {
            const m = q.manufacturers.find(m => m.name === mfr);
            if (!m) return 0;
            return metric === 'pb' ? m.pb : m.drives;
        });

        return {
            x: labels,
            y: values,
            name: mfr,
            type: 'scatter',
            mode: 'lines',
            stackgroup: 'one',
            line: { color: COLORS[mfr], width: 0 },
            fillcolor: COLORS[mfr]
        };
    });

    const yAxisTitle = metric === 'pb' ? 'Petabytes' : 'Drive Count';
    const tickFormat = metric === 'pb' ? ',.0f' : ',d';

    const layout = {
        xaxis: { title: 'Quarter' },
        yaxis: { title: yAxisTitle, tickformat: tickFormat },
        legend: { x: 1.02, y: 0.5 },
        hovermode: 'x unified',
        margin: { t: 40 }
    };

    Plotly.newPlot('chart-manufacturers', traces, layout, { responsive: true });
}

function renderDriveSize(data, byManufacturer = false) {
    const quarters = data.quarters;
    const labels = quarters.map(q => q.label);

    let traces, layout;

    if (byManufacturer) {
        // Show breakdown by manufacturer (top 4 + Other)
        const manufacturers = ['Seagate', 'Toshiba', 'Western Digital', 'HGST'];

        traces = manufacturers.map(mfr => {
            const values = quarters.map(q => {
                const m = q.manufacturers.find(m => m.name === mfr);
                if (m && m.drives > 0) {
                    return (m.pb * 1000) / m.drives; // PB to TB
                }
                return null;
            });

            return {
                x: labels,
                y: values,
                name: mfr,
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: COLORS[mfr], width: 2 },
                marker: { size: 6 },
                connectgaps: true
            };
        });

        // Add overall median as dashed line
        traces.push({
            x: labels,
            y: quarters.map(q => q.summary.median_drive_tb || q.summary.avg_drive_tb),
            name: 'Overall Median',
            type: 'scatter',
            mode: 'lines',
            line: { color: '#666', width: 2, dash: 'dash' }
        });

        const allValues = traces.flatMap(t => t.y.filter(v => v !== null));
        layout = {
            xaxis: { title: 'Quarter' },
            yaxis: { title: 'Avg Drive Size (TB)', range: [0, Math.max(...allValues) * 1.1] },
            legend: { x: 1.02, y: 0.5 },
            hovermode: 'x unified',
            margin: { t: 40 }
        };
    } else {
        // Show overall median (fallback to avg for old data)
        const medianSize = quarters.map(q => q.summary.median_drive_tb || q.summary.avg_drive_tb);

        traces = [{
            x: labels,
            y: medianSize,
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#2ca02c', width: 3 },
            marker: { size: 10 },
            fill: 'tozeroy',
            fillcolor: 'rgba(44, 160, 44, 0.2)'
        }];

        layout = {
            xaxis: { title: 'Quarter' },
            yaxis: { title: 'Median Drive Size (TB)', range: [0, Math.max(...medianSize) * 1.1] },
            hovertemplate: '%{x}<br>%{y:.2f} TB<extra></extra>',
            margin: { t: 40 }
        };
    }

    Plotly.newPlot('chart-drive-size', traces, layout, { responsive: true });
}

function renderTopModels(data, quarterIdx = null) {
    if (quarterIdx === null) quarterIdx = data.quarters.length - 1;
    const quarter = data.quarters[quarterIdx];
    const models = quarter.top_models;

    const trace = {
        x: models.map(m => m.count),
        y: models.map(m => m.model),
        type: 'bar',
        orientation: 'h',
        marker: {
            color: models.map((m, i) => `hsl(${210 + i * 15}, 70%, 50%)`)
        },
        text: models.map(m => `${m.size_tb} TB`),
        textposition: 'inside',
        insidetextanchor: 'middle'
    };

    const layout = {
        xaxis: { title: 'Drive Count', tickformat: ',d' },
        yaxis: { autorange: 'reversed' },
        margin: { l: 200, t: 40 }
    };

    Plotly.newPlot('chart-models', [trace], layout, { responsive: true });
}

function renderReliabilityBubble(data) {
    const quarters = data.quarters;
    const manufacturers = ['Seagate', 'Toshiba', 'HGST', 'Western Digital', 'Other'];

    // Create traces for each manufacturer
    const traces = manufacturers.map(mfr => {
        const x = [];
        const y = [];
        const sizes = [];
        const colors = [];
        const texts = [];

        quarters.forEach(q => {
            const m = q.manufacturers.find(m => m.name === mfr);
            if (m && m.drives > 0 && m.drive_days > 0) {
                // Calculate AFR from actual drive-days and failures
                // AFR = (failures / drive_days) * 365 * 100
                const afr = (m.failures / m.drive_days) * 365 * 100;

                x.push(q.label);
                y.push(mfr);
                sizes.push(Math.sqrt(m.drives) / 10); // Scale for visibility
                colors.push(Math.min(afr, 5)); // Cap at 5% for color scale
                texts.push(`${m.drives.toLocaleString()} drives<br>${m.failures} failures<br>${afr.toFixed(2)}% AFR`);
            }
        });

        return {
            x, y,
            mode: 'markers',
            name: mfr,
            marker: {
                size: sizes,
                color: colors,
                colorscale: FAILURE_COLORSCALE,
                cmin: 0,
                cmax: 5,
                showscale: mfr === 'Seagate', // Only show scale once
                colorbar: { title: 'AFR %' }
            },
            text: texts,
            hovertemplate: '%{y}<br>%{x}<br>%{text}<extra></extra>'
        };
    });

    const layout = {
        xaxis: { title: 'Quarter' },
        yaxis: { title: 'Manufacturer' },
        showlegend: false,
        hovermode: 'closest',
        margin: { t: 40, l: 120 }
    };

    Plotly.newPlot('chart-reliability-bubble', traces, layout, { responsive: true });
}

// Current UI state
let mfrMetric = 'drives';
let modelsQuarterIdx = null;
let driveSizeByMfr = false;

function renderAllCharts(data) {
    renderFleetGrowth(data);
    renderManufacturers(data, mfrMetric);
    renderDriveSize(data, driveSizeByMfr);
    renderTopModels(data, modelsQuarterIdx);
    renderReliabilityBubble(data);
}

function setupChartControls(data) {
    // Manufacturer metric toggle
    document.querySelectorAll('input[name="mfr-metric"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            mfrMetric = e.target.value;
            renderManufacturers(filteredData, mfrMetric);
        });
    });

    // Drive size by manufacturer toggle
    document.getElementById('drive-size-by-mfr').addEventListener('change', (e) => {
        driveSizeByMfr = e.target.checked;
        renderDriveSize(filteredData, driveSizeByMfr);
    });

    // Top models quarter slider
    const slider = document.getElementById('models-quarter-slider');
    const label = document.getElementById('models-quarter-label');

    slider.max = data.quarters.length - 1;
    slider.value = data.quarters.length - 1;
    modelsQuarterIdx = data.quarters.length - 1;
    label.textContent = data.quarters[modelsQuarterIdx].label;

    slider.addEventListener('input', (e) => {
        modelsQuarterIdx = parseInt(e.target.value);
        label.textContent = filteredData.quarters[modelsQuarterIdx].label;
        renderTopModels(filteredData, modelsQuarterIdx);
    });
}

function updateSliderForFilteredData(data) {
    const slider = document.getElementById('models-quarter-slider');
    const label = document.getElementById('models-quarter-label');

    slider.max = data.quarters.length - 1;
    modelsQuarterIdx = Math.min(modelsQuarterIdx, data.quarters.length - 1);
    slider.value = modelsQuarterIdx;
    label.textContent = data.quarters[modelsQuarterIdx].label;
}

// Main initialization
async function init() {
    try {
        fullData = await loadData();
        console.log(`Loaded ${fullData.quarters.length} quarters of data`);

        setupChartControls(fullData);

        const { startIdx, endIdx } = setupDatePicker(fullData);
        filteredData = filterByDateRange(fullData, startIdx, endIdx);

        updateSliderForFilteredData(filteredData);
        renderAllCharts(filteredData);
    } catch (error) {
        console.error('Failed to load data:', error);
        document.body.innerHTML += `<p style="color:red; text-align:center;">Error loading data: ${error.message}</p>`;
    }
}

init();
