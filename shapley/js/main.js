// Main controller
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const seedInput = document.getElementById('seed');
    const iterationsSlider = document.getElementById('iterations');
    const iterationsValue = document.getElementById('iterations-value');
    const generateBtn = document.getElementById('generate-btn');
    const runBtn = document.getElementById('run-btn');
    const stepBtn = document.getElementById('step-btn');

    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');

    const currentHeightEl = document.getElementById('current-height');
    const currentIterationEl = document.getElementById('current-iteration');
    const totalIterationsEl = document.getElementById('total-iterations');
    const currentPieceEl = document.getElementById('current-piece');

    const boardCanvas = document.getElementById('board-canvas');
    const shapleyCanvas = document.getElementById('shapley-canvas');

    // Renderers
    const boardRenderer = new BoardRenderer(boardCanvas);
    const shapleyRenderer = new ShapleyBoardRenderer(shapleyCanvas);

    // State
    let board = null;
    let originalBoard = null;
    let simulation = null;
    let stepGenerator = null;
    let isRunning = false;

    // URL state management
    function loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('seed')) {
            seedInput.value = params.get('seed');
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
        params.set('iterations', iterationsSlider.value);
        params.set('delay', speedSlider.value);
        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newURL);
    }

    // Load initial state from URL
    loadFromURL();

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
        board = Board.generate(seed);
        originalBoard = board.clone();

        // Create simulation with seed offset for different random ordering
        simulation = new ShapleySimulation(originalBoard, seed + 1000);
        stepGenerator = null;

        updateURL();
        updateDisplay();
        renderBoard(board);
        renderShapleyBoard(new Map());
    }

    // Render board
    function renderBoard(b) {
        boardRenderer.render(b);
    }

    // Render Shapley board (opacity-based visualization)
    function renderShapleyBoard(contributions) {
        shapleyRenderer.render(originalBoard, contributions);
    }

    // Update info display
    function updateDisplay(stepData = null) {
        if (stepData) {
            currentHeightEl.textContent = stepData.heightAfter !== undefined ? stepData.heightAfter : stepData.height;
            currentIterationEl.textContent = stepData.iteration;
            currentPieceEl.textContent = stepData.pieceId !== undefined ? `#${stepData.pieceId}` : '-';
        } else if (board) {
            currentHeightEl.textContent = board.getHeight();
            currentIterationEl.textContent = simulation ? simulation.getTotalIterations() : 0;
            currentPieceEl.textContent = '-';
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
        generateBtn.disabled = true;

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
        generateBtn.disabled = false;

        renderBoard(originalBoard);
        updateDisplay({ iteration: simulation.getTotalIterations(), height: originalBoard.getHeight() });
    }

    // Event listeners
    generateBtn.addEventListener('click', generateBoard);
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
