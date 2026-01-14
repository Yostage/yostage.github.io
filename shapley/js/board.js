// Seeded PRNG - Mulberry32
function mulberry32(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Tetris piece definitions (relative coordinates)
const PIECE_SHAPES = {
    I: { cells: [[0,0], [1,0], [2,0], [3,0]], color: '#00f0f0' },  // Cyan
    O: { cells: [[0,0], [1,0], [0,1], [1,1]], color: '#f0f000' },  // Yellow
    T: { cells: [[0,0], [1,0], [2,0], [1,1]], color: '#a000f0' },  // Purple
    S: { cells: [[1,0], [2,0], [0,1], [1,1]], color: '#00f000' },  // Green
    Z: { cells: [[0,0], [1,0], [1,1], [2,1]], color: '#f00000' },  // Red
    J: { cells: [[0,0], [0,1], [1,1], [2,1]], color: '#0000f0' },  // Blue
    L: { cells: [[2,0], [0,1], [1,1], [2,1]], color: '#f0a000' }   // Orange
};

const PIECE_TYPES = Object.keys(PIECE_SHAPES);

class Board {
    constructor(width = 10, height = 20) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.pieces = new Map(); // pieceId -> { type, color, cells: [{x, y}] }
        this.nextPieceId = 0;
        this.clear();
    }

    clear() {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            this.grid.push(new Array(this.width).fill(null));
        }
        this.pieces.clear();
        this.nextPieceId = 0;
    }

    clone() {
        const newBoard = new Board(this.width, this.height);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x]) {
                    newBoard.grid[y][x] = { ...this.grid[y][x] };
                }
            }
        }
        for (const [id, piece] of this.pieces) {
            newBoard.pieces.set(id, {
                type: piece.type,
                color: piece.color,
                cells: piece.cells.map(c => ({ ...c }))
            });
        }
        newBoard.nextPieceId = this.nextPieceId;
        return newBoard;
    }

    getHeight() {
        for (let y = this.height - 1; y >= 0; y--) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] !== null) {
                    return y + 1;
                }
            }
        }
        return 0;
    }

    canPlacePiece(type, baseX, baseY) {
        const shape = PIECE_SHAPES[type];
        for (const [dx, dy] of shape.cells) {
            const x = baseX + dx;
            const y = baseY + dy;
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return false;
            }
            if (this.grid[y][x] !== null) {
                return false;
            }
        }
        return true;
    }

    placePiece(type, baseX, baseY) {
        if (!this.canPlacePiece(type, baseX, baseY)) {
            return null;
        }

        const shape = PIECE_SHAPES[type];
        const pieceId = this.nextPieceId++;
        const cells = [];

        for (const [dx, dy] of shape.cells) {
            const x = baseX + dx;
            const y = baseY + dy;
            this.grid[y][x] = { pieceId, color: shape.color };
            cells.push({ x, y });
        }

        this.pieces.set(pieceId, {
            type,
            color: shape.color,
            cells
        });

        return pieceId;
    }

    removePiece(pieceId) {
        const piece = this.pieces.get(pieceId);
        if (!piece) return false;

        for (const { x, y } of piece.cells) {
            this.grid[y][x] = null;
        }
        this.pieces.delete(pieceId);
        return true;
    }

    // Drop a single piece as far as it can go
    dropPiece(pieceId) {
        const piece = this.pieces.get(pieceId);
        if (!piece) return 0;

        // Find the minimum drop distance for all cells
        let minDrop = this.height;
        for (const { x, y } of piece.cells) {
            let drop = 0;
            for (let testY = y - 1; testY >= 0; testY--) {
                const cell = this.grid[testY][x];
                if (cell !== null && cell.pieceId !== pieceId) {
                    break;
                }
                drop++;
            }
            // Also check for bottom of board
            drop = Math.min(drop, y);
            minDrop = Math.min(minDrop, drop);
        }

        if (minDrop === 0) return 0;

        // Remove piece from current positions
        for (const { x, y } of piece.cells) {
            this.grid[y][x] = null;
        }

        // Place piece at new positions
        for (const cell of piece.cells) {
            cell.y -= minDrop;
            this.grid[cell.y][cell.x] = { pieceId, color: piece.color };
        }

        return minDrop;
    }

    applyGravity() {
        // Sort pieces by their lowest cell (bottom-up processing)
        const pieceIds = [...this.pieces.keys()];
        pieceIds.sort((a, b) => {
            const pieceA = this.pieces.get(a);
            const pieceB = this.pieces.get(b);
            const minYA = Math.min(...pieceA.cells.map(c => c.y));
            const minYB = Math.min(...pieceB.cells.map(c => c.y));
            return minYA - minYB;
        });

        let totalDropped = 0;
        let changed = true;
        while (changed) {
            changed = false;
            for (const pieceId of pieceIds) {
                const dropped = this.dropPiece(pieceId);
                if (dropped > 0) {
                    totalDropped += dropped;
                    changed = true;
                }
            }
        }
        return totalDropped;
    }

    getPieceIds() {
        return [...this.pieces.keys()];
    }

    getPiece(pieceId) {
        return this.pieces.get(pieceId);
    }

    // Generate a mostly-filled board
    static generate(seed, width = 10, fillRatio = 0.7) {
        const rand = mulberry32(seed);
        const board = new Board(width, 20);

        // Place a full-width yellow base block in bottom 2 rows
        const basePieceId = board.nextPieceId++;
        const baseColor = '#f0f000'; // Yellow like O piece
        const baseCells = [];
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < width; x++) {
                board.grid[y][x] = { pieceId: basePieceId, color: baseColor };
                baseCells.push({ x, y });
            }
        }
        board.pieces.set(basePieceId, {
            type: 'BASE',
            color: baseColor,
            cells: baseCells
        });

        // Generate other pieces only above the base (y >= 2)
        let attempts = 0;
        const maxAttempts = 1000;
        const targetCells = Math.floor(board.width * board.height * fillRatio);

        while (board.getFilledCellCount() < targetCells && attempts < maxAttempts) {
            attempts++;

            // Pick a random piece type
            const type = PIECE_TYPES[Math.floor(rand() * PIECE_TYPES.length)];

            // Try to place it at a random position, but only y >= 2
            const x = Math.floor(rand() * (board.width - 3));
            const y = 2 + Math.floor(rand() * (board.height - 4));

            board.placePiece(type, x, y);
        }

        // Apply gravity to settle pieces (they'll rest on the base)
        board.applyGravity();

        return board;
    }

    getFilledCellCount() {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] !== null) count++;
            }
        }
        return count;
    }

    // Calculate marginal contribution of each piece if removed alone
    calculateMarginalContributions() {
        const contributions = new Map();
        const heightBefore = this.getHeight();

        for (const pieceId of this.getPieceIds()) {
            const testBoard = this.clone();
            testBoard.removePiece(pieceId);
            testBoard.applyGravity();
            const heightAfter = testBoard.getHeight();
            contributions.set(pieceId, heightBefore - heightAfter);
        }

        return contributions;
    }

    // Calculate critical path - trace row by row from top to bottom
    // Each row gives +1 credit to the piece occupying that position
    calculateCriticalPath() {
        const contributions = new Map();
        for (const id of this.getPieceIds()) {
            contributions.set(id, 0);
        }

        const height = this.getHeight();
        if (height === 0) return contributions;

        // Find starting position (leftmost cell at highest row)
        const maxY = height - 1;
        let currentX = 0;
        for (let x = 0; x < this.width; x++) {
            if (this.grid[maxY][x]) {
                currentX = x;
                break;
            }
        }

        // Trace down row by row from top to bottom
        for (let y = maxY; y >= 0; y--) {
            let cell = this.grid[y][currentX];

            // If no cell at currentX, find the leftmost cell in this row
            if (!cell) {
                for (let x = 0; x < this.width; x++) {
                    if (this.grid[y][x]) {
                        currentX = x;
                        cell = this.grid[y][x];
                        break;
                    }
                }
            }

            if (cell) {
                // Credit this row to the piece
                const current = contributions.get(cell.pieceId) || 0;
                contributions.set(cell.pieceId, current + 1);
            }
        }

        return contributions;
    }
}

// Export for use in other modules
window.Board = Board;
window.mulberry32 = mulberry32;
window.PIECE_SHAPES = PIECE_SHAPES;
