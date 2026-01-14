class BoardRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = 30;
        this.highlightedPiece = null;
    }

    render(board) {
        const ctx = this.ctx;
        const cellSize = this.cellSize;

        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        for (let x = 0; x <= board.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, board.height * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= board.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(board.width * cellSize, y * cellSize);
            ctx.stroke();
        }

        // Draw cells (y=0 is bottom, so we flip for display)
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                const cell = board.grid[y][x];
                if (cell) {
                    const displayY = (board.height - 1 - y) * cellSize;
                    const displayX = x * cellSize;

                    // Fill with piece color
                    ctx.fillStyle = cell.color;
                    ctx.fillRect(displayX + 1, displayY + 1, cellSize - 2, cellSize - 2);

                    // Highlight if this is the highlighted piece
                    if (cell.pieceId === this.highlightedPiece) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(displayX + 2, displayY + 2, cellSize - 4, cellSize - 4);
                    }

                    // Add a subtle 3D effect
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(displayX + 1, displayY + 1, cellSize - 2, 3);
                    ctx.fillRect(displayX + 1, displayY + 1, 3, cellSize - 2);

                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(displayX + 1, displayY + cellSize - 4, cellSize - 2, 3);
                    ctx.fillRect(displayX + cellSize - 4, displayY + 1, 3, cellSize - 2);
                }
            }
        }

        // Draw height indicator
        const height = board.getHeight();
        if (height > 0) {
            const indicatorY = (board.height - height) * cellSize;
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, indicatorY);
            ctx.lineTo(board.width * cellSize, indicatorY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Height label
            ctx.fillStyle = '#ff6b6b';
            ctx.font = '12px sans-serif';
            ctx.fillText(`h=${height}`, board.width * cellSize + 5, indicatorY + 4);
        }
    }

    setHighlightedPiece(pieceId) {
        this.highlightedPiece = pieceId;
    }
}

class ShapleyBoardRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = 30;
    }

    // Parse hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
    }

    render(board, contributions) {
        const ctx = this.ctx;
        const cellSize = this.cellSize;

        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        for (let x = 0; x <= board.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, board.height * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= board.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(board.width * cellSize, y * cellSize);
            ctx.stroke();
        }

        // Calculate max contribution for scaling opacity
        const pieceIds = board.getPieceIds();
        let maxContrib = 0;
        for (const id of pieceIds) {
            const contrib = contributions.get(id) || 0;
            maxContrib = Math.max(maxContrib, Math.abs(contrib));
        }
        maxContrib = Math.max(maxContrib, 0.1); // Avoid division by zero

        // Draw cells with opacity based on contribution
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                const cell = board.grid[y][x];
                if (cell) {
                    const displayY = (board.height - 1 - y) * cellSize;
                    const displayX = x * cellSize;

                    // Get contribution for this piece
                    const contrib = contributions.get(cell.pieceId) || 0;
                    // Map contribution to opacity (0.15 to 1.0)
                    const opacity = 0.15 + (contrib / maxContrib) * 0.85;

                    // Parse color and apply opacity
                    const rgb = this.hexToRgb(cell.color);
                    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
                    ctx.fillRect(displayX + 1, displayY + 1, cellSize - 2, cellSize - 2);

                    // Add 3D effect with adjusted opacity
                    ctx.fillStyle = `rgba(255,255,255,${0.2 * opacity})`;
                    ctx.fillRect(displayX + 1, displayY + 1, cellSize - 2, 3);
                    ctx.fillRect(displayX + 1, displayY + 1, 3, cellSize - 2);

                    ctx.fillStyle = `rgba(0,0,0,${0.2 * opacity})`;
                    ctx.fillRect(displayX + 1, displayY + cellSize - 4, cellSize - 2, 3);
                    ctx.fillRect(displayX + cellSize - 4, displayY + 1, 3, cellSize - 2);

                    // Show contribution value on hover-sized pieces
                    if (contrib > 0) {
                        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
                        ctx.font = '9px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(contrib.toFixed(1), displayX + cellSize/2, displayY + cellSize/2 + 3);
                    }
                }
            }
        }
    }
}

window.BoardRenderer = BoardRenderer;
window.ShapleyBoardRenderer = ShapleyBoardRenderer;
