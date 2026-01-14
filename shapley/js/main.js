// Main controller
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const seedInput = document.getElementById('seed');
    const widthSlider = document.getElementById('width');
    const widthValue = document.getElementById('width-value');
    const iterationsSlider = document.getElementById('iterations');
    const iterationsValue = document.getElementById('iterations-value');
    const resetBtn = document.getElementById('reset-btn');
    const newBoardBtn = document.getElementById('new-board-btn');
    const runBtn = document.getElementById('run-btn');
    const stepBtn = document.getElementById('step-btn');

    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');

    const currentIterationEl = document.getElementById('current-iteration');
    const totalIterationsEl = document.getElementById('total-iterations');

    const boardHeightEl = document.getElementById('board-height');
    const sumShapleyEl = document.getElementById('sum-shapley');
    const sumMarginalEl = document.getElementById('sum-marginal');
    const sumCriticalEl = document.getElementById('sum-critical');

    const boardCanvas = document.getElementById('board-canvas');
    const shapleyCanvas = document.getElementById('shapley-canvas');
    const marginalCanvas = document.getElementById('marginal-canvas');
    const criticalCanvas = document.getElementById('critical-canvas');

    // Renderers
    const boardRenderer = new BoardRenderer(boardCanvas);
    const shapleyRenderer = new ShapleyBoardRenderer(shapleyCanvas);
    const marginalRenderer = new ShapleyBoardRenderer(marginalCanvas);
    const criticalRenderer = new ShapleyBoardRenderer(criticalCanvas);

    // State
    let board = null;
    let originalBoard = null;
    let simulation = null;
    let stepGenerator = null;
    let isRunning = false;
    let marginalContributions = new Map();
    let criticalContributions = new Map();

    // URL state management
    function loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('seed')) {
            seedInput.value = params.get('seed');
        }
        if (params.has('width')) {
            widthSlider.value = params.get('width');
            widthValue.textContent = params.get('width');
        }
        if (params.has('iterations')) {
            iterationsSlider.value = params.get('iterations');
            iterationsValue.textContent = params.get('iterations');
        }
        if (params.has('delay')) {
            speedSlider.value = params.get('delay');
            speedValue.textContent = params.get('delay');
        }
    }

    function updateURL() {
        const params = new URLSearchParams();
        params.set('seed', seedInput.value);
        params.set('width', widthSlider.value);
        params.set('iterations', iterationsSlider.value);
        params.set('delay', speedSlider.value);
        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newURL);
    }

    // Load initial state from URL
    loadFromURL();

    // Update width display and URL
    widthSlider.addEventListener('input', () => {
        widthValue.textContent = widthSlider.value;
        updateURL();
    });

    // Update iterations display and URL
    iterationsSlider.addEventListener('input', () => {
        iterationsValue.textContent = iterationsSlider.value;
        updateURL();
    });

    // Update speed display and URL
    speedSlider.addEventListener('input', () => {
        speedValue.textContent = speedSlider.value;
        updateURL();
    });

    // Update URL when seed changes
    seedInput.addEventListener('input', updateURL);

    // Generate board
    function generateBoard() {
        const seed = parseInt(seedInput.value) || 12345;
        const width = parseInt(widthSlider.value) || 6;
        board = Board.generate(seed, width);
        originalBoard = board.clone();

        // Update canvas sizes based on board dimensions
        const cellSize = 30;
        const canvasWidth = width * cellSize;
        const canvasHeight = 20 * cellSize;
        boardCanvas.width = canvasWidth;
        boardCanvas.height = canvasHeight;
        shapleyCanvas.width = canvasWidth;
        shapleyCanvas.height = canvasHeight;
        marginalCanvas.width = canvasWidth;
        marginalCanvas.height = canvasHeight;
        criticalCanvas.width = canvasWidth;
        criticalCanvas.height = canvasHeight;

        // Calculate marginal contributions (static, once per board)
        marginalContributions = originalBoard.calculateMarginalContributions();

        // Calculate critical path contributions (static, once per board)
        criticalContributions = originalBoard.calculateCriticalPath();

        // Create simulation with seed offset for different random ordering
        simulation = new ShapleySimulation(originalBoard, seed + 1000);
        stepGenerator = null;

        updateURL();
        updateDisplay();
        renderBoard(board);
        renderShapleyBoard(new Map());
        renderMarginalBoard();
        renderCriticalBoard();
    }

    // Render marginal board (static, calculated once)
    function renderMarginalBoard() {
        marginalRenderer.render(originalBoard, marginalContributions);
    }

    // Render critical path board (static, calculated once)
    function renderCriticalBoard() {
        criticalRenderer.render(originalBoard, criticalContributions);
        // Update critical sum
        let sumCritical = 0;
        for (const value of criticalContributions.values()) {
            sumCritical += value;
        }
        sumCriticalEl.textContent = sumCritical;
    }

    // Update verification display
    function updateVerification(shapleyContributions) {
        const height = originalBoard ? originalBoard.getHeight() : 0;
        boardHeightEl.textContent = height;

        // Sum of Shapley values
        let sumShapley = 0;
        if (shapleyContributions) {
            for (const value of shapleyContributions.values()) {
                sumShapley += value;
            }
        }
        sumShapleyEl.textContent = sumShapley.toFixed(2);

        // Sum of marginal values
        let sumMarginal = 0;
        for (const value of marginalContributions.values()) {
            sumMarginal += value;
        }
        sumMarginalEl.textContent = sumMarginal;
    }

    // Render board
    function renderBoard(b) {
        boardRenderer.render(b);
    }

    // Render Shapley board (opacity-based visualization)
    function renderShapleyBoard(contributions) {
        shapleyRenderer.render(originalBoard, contributions);
        updateVerification(contributions);
    }

    // Update info display
    function updateDisplay(stepData = null) {
        if (stepData) {
            currentIterationEl.textContent = stepData.iteration;
        } else if (simulation) {
            currentIterationEl.textContent = simulation.getTotalIterations();
        } else {
            currentIterationEl.textContent = 0;
        }
        totalIterationsEl.textContent = iterationsSlider.value;
    }

    // Step through simulation
    function step() {
        if (!simulation) return;

        if (!stepGenerator) {
            stepGenerator = simulation.runIteration();
        }

        const result = stepGenerator.next();

        if (result.done) {
            stepGenerator = null;
            boardRenderer.setHighlightedPiece(null);
            renderBoard(originalBoard);
            renderShapleyBoard(simulation.getAverageContributions());
            updateDisplay({ iteration: simulation.getTotalIterations(), height: originalBoard.getHeight() });
            return;
        }

        const data = result.value;

        if (data.type === 'start') {
            board = data.board;
            renderBoard(board);
            updateDisplay(data);
        } else if (data.type === 'step') {
            board = data.board;
            boardRenderer.setHighlightedPiece(null);
            renderBoard(board);
            renderShapleyBoard(data.currentContributions);
            updateDisplay(data);
        } else if (data.type === 'end') {
            renderShapleyBoard(data.contributions);
        }
    }

    // Run simulation with animation
    async function runSimulation() {
        if (!simulation || isRunning) return;

        isRunning = true;
        runBtn.textContent = 'Stop';
        stepBtn.disabled = true;
        resetBtn.disabled = true;
        newBoardBtn.disabled = true;

        const targetIterations = parseInt(iterationsSlider.value);
        const currentIterations = simulation.getTotalIterations();
        const remaining = targetIterations - currentIterations;

        if (remaining <= 0) {
            simulation.reset();
        }

        const iterationsToRun = remaining > 0 ? remaining : targetIterations;

        // Run step-by-step with animation
        for (let i = 0; i < iterationsToRun && isRunning; i++) {
            const generator = simulation.runIteration();

            for (const data of generator) {
                if (!isRunning) break;

                const delay = parseInt(speedSlider.value);

                if (data.type === 'start') {
                    board = data.board;
                    renderBoard(board);
                    updateDisplay(data);
                } else if (data.type === 'step') {
                    board = data.board;
                    renderBoard(board);
                    renderShapleyBoard(data.currentContributions);
                    updateDisplay(data);

                    // Wait for the delay
                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                } else if (data.type === 'end') {
                    renderShapleyBoard(data.contributions);
                    // Reset board view for next iteration
                    renderBoard(originalBoard);
                }
            }

            // Small delay between iterations even if speed is 0
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        isRunning = false;
        runBtn.textContent = 'Run Simulation';
        runBtn.disabled = false;
        stepBtn.disabled = false;
        resetBtn.disabled = false;
        newBoardBtn.disabled = false;

        renderBoard(originalBoard);
        updateDisplay({ iteration: simulation.getTotalIterations(), height: originalBoard.getHeight() });
    }

    // Generate new random seed and create board
    function newBoard() {
        seedInput.value = Math.floor(Math.random() * 1000000);
        generateBoard();
    }

    // Event listeners
    resetBtn.addEventListener('click', generateBoard);
    newBoardBtn.addEventListener('click', newBoard);
    runBtn.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false; // Stop the simulation
        } else {
            runSimulation();
        }
    });
    stepBtn.addEventListener('click', step);

    // Initial generation
    generateBoard();
});
