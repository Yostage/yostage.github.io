// Backblaze Drive Stats Charts
// Loads quarterly_stats.json and renders Plotly charts

const DATA_URL = 'data/quarterly_stats.json';

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

function renderManufacturers(data) {
    const quarters = data.quarters;
    const labels = quarters.map(q => q.label);
    const manufacturers = ['Seagate', 'Toshiba', 'HGST', 'Western Digital', 'Other'];

    const traces = manufacturers.map(mfr => {
        const values = quarters.map(q => {
            const m = q.manufacturers.find(m => m.name === mfr);
            return m ? m.drives : 0;
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

    const layout = {
        xaxis: { title: 'Quarter' },
        yaxis: { title: 'Drive Count', tickformat: ',d' },
        legend: { x: 1.02, y: 0.5 },
        hovermode: 'x unified',
        margin: { t: 40 }
    };

    Plotly.newPlot('chart-manufacturers', traces, layout, { responsive: true });
}

function renderDriveSize(data) {
    const quarters = data.quarters;
    const labels = quarters.map(q => q.label);
    const avgSize = quarters.map(q => q.summary.avg_drive_tb);

    const trace = {
        x: labels,
        y: avgSize,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#2ca02c', width: 3 },
        marker: { size: 10 },
        fill: 'tozeroy',
        fillcolor: 'rgba(44, 160, 44, 0.2)'
    };

    const layout = {
        xaxis: { title: 'Quarter' },
        yaxis: { title: 'Average Drive Size (TB)', range: [0, Math.max(...avgSize) * 1.1] },
        hovertemplate: '%{x}<br>%{y:.2f} TB<extra></extra>',
        margin: { t: 40 }
    };

    Plotly.newPlot('chart-drive-size', [trace], layout, { responsive: true });
}

function renderTopModels(data) {
    const latestQuarter = data.quarters[data.quarters.length - 1];
    const models = latestQuarter.top_models;

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
        title: `Top 10 Drive Models (${latestQuarter.label})`,
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
            if (m && m.drives > 0) {
                // Calculate annualized failure rate (AFR)
                // failures per quarter * 4 / drive count * 100 = AFR%
                const failures = q.summary.failures || 0;
                const totalDrives = q.summary.drive_count;
                const mfrShare = m.drives / totalDrives;
                const estimatedFailures = failures * mfrShare;
                const afr = (estimatedFailures * 4 / m.drives) * 100;

                x.push(q.label);
                y.push(mfr);
                sizes.push(Math.sqrt(m.drives) / 10); // Scale for visibility
                colors.push(Math.min(afr, 5)); // Cap at 5% for color scale
                texts.push(`${m.drives.toLocaleString()} drives<br>AFR: ${afr.toFixed(2)}%`);
            }
        });

        return {
            x, y,
            mode: 'markers',
            name: mfr,
            marker: {
                size: sizes,
                color: colors,
                colorscale: 'RdYlGn',
                reversescale: true,
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

function renderReliabilityHeatmap(data) {
    const quarters = data.quarters;
    const manufacturers = ['Seagate', 'Toshiba', 'HGST', 'Western Digital', 'Other'];

    const labels = quarters.map(q => q.label);

    // Build z matrix (failure rates) and annotations (drive counts)
    const z = [];
    const annotations = [];

    manufacturers.forEach((mfr, mfrIdx) => {
        const row = [];

        quarters.forEach((q, qIdx) => {
            const m = q.manufacturers.find(m => m.name === mfr);

            if (m && m.drives > 0) {
                // Estimate AFR for this manufacturer
                const failures = q.summary.failures || 0;
                const totalDrives = q.summary.drive_count;
                const mfrShare = m.drives / totalDrives;
                const estimatedFailures = failures * mfrShare;
                const afr = (estimatedFailures * 4 / m.drives) * 100;

                row.push(afr);

                // Add annotation with drive count
                const countStr = m.drives >= 1000
                    ? `${Math.round(m.drives / 1000)}K`
                    : m.drives.toString();

                annotations.push({
                    x: labels[qIdx],
                    y: mfr,
                    text: countStr,
                    showarrow: false,
                    font: { size: 10, color: afr > 2.5 ? 'white' : 'black' }
                });
            } else {
                row.push(null);
            }
        });

        z.push(row);
    });

    const trace = {
        x: labels,
        y: manufacturers,
        z: z,
        type: 'heatmap',
        colorscale: 'RdYlGn',
        reversescale: true,
        zmin: 0,
        zmax: 5,
        colorbar: { title: 'AFR %' },
        hovertemplate: '%{y}<br>%{x}<br>AFR: %{z:.2f}%<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'Quarter', side: 'bottom' },
        yaxis: { title: 'Manufacturer' },
        annotations: annotations,
        margin: { t: 40, l: 120 }
    };

    Plotly.newPlot('chart-reliability-heatmap', [trace], layout, { responsive: true });
}

function renderAllCharts(data) {
    renderFleetGrowth(data);
    renderManufacturers(data);
    renderDriveSize(data);
    renderTopModels(data);
    renderReliabilityBubble(data);
    renderReliabilityHeatmap(data);
}

// Main initialization
async function init() {
    try {
        fullData = await loadData();
        console.log(`Loaded ${fullData.quarters.length} quarters of data`);

        const { startIdx, endIdx } = setupDatePicker(fullData);
        filteredData = filterByDateRange(fullData, startIdx, endIdx);

        renderAllCharts(filteredData);
    } catch (error) {
        console.error('Failed to load data:', error);
        document.body.innerHTML += `<p style="color:red; text-align:center;">Error loading data: ${error.message}</p>`;
    }
}

init();
