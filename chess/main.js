const board = document.getElementById("board");

const pieces = {
    wK: "pieces/whiteking.svg",
    wQ: "pieces/whitequeen.svg",
    wR: "pieces/whiterook.svg",
    wB: "pieces/whitebishop.svg",
    wN: "pieces/whiteknight.svg",
    wP: "pieces/whitepawn.svg",

    bK: "pieces/blackking.svg",
    bQ: "pieces/blackqueen.svg",
    bR: "pieces/blackrook.svg",
    bB: "pieces/blackbishop.svg",
    bN: "pieces/blackknight.svg",
    bP: "pieces/blackpawn.svg"
};

const startingPosition = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
];

let currentPosition = startingPosition.map(row => [...row]);

let lastMove = null;
let halfmoveClock = 0;
let positionHistory = [];
const gameMode = {
    w: "player",
    b: "player"
};

let castlingRights = {
    wK: true,
    wQ: true,
    bK: true,
    bQ: true
};

for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {

        const square = document.createElement("div");

        square.classList.add("square");

        if ((row + col) % 2 === 0) {
            square.classList.add("light");
        } else {
            square.classList.add("dark");
        }

        const piece = currentPosition[row][col];

        if (piece) {
            const image = document.createElement("img");

            image.src = pieces[piece];
            image.alt = piece;

            square.appendChild(image);
        }

        board.appendChild(square);
    }
}

let selectedSquare = null;
let currentTurn = "w";
let gameOver = false;
let waitingForPromotion = false;
let promotionSquare = null;
let pgnMoves = [];

const gameOverScreen = document.getElementById("game-over");
const gameOverTitle = document.getElementById("game-over-title");
const gameOverMessage = document.getElementById("game-over-message");
const newGameButton = document.getElementById("new-game");
const promotionScreen = document.getElementById("promotion");
const promotionButtons = promotionScreen.querySelectorAll("button");
const squares = document.querySelectorAll(".square");

function getPositionKey() {
    const boardKey = currentPosition
        .map(row => row.join(","))
        .join("/");

    const turnKey = currentTurn;

    const castlingKey =
        (castlingRights.wK ? "K" : "") +
        (castlingRights.wQ ? "Q" : "") +
        (castlingRights.bK ? "k" : "") +
        (castlingRights.bQ ? "q" : "");

    let enPassantKey = "-";

    if (lastMove && lastMove.piece[1] === "P") {
        if (Math.abs(lastMove.toRow - lastMove.fromRow) === 2) {
            const enPassantRow =
                (lastMove.fromRow + lastMove.toRow) / 2;

            enPassantKey =
                `${enPassantRow},${lastMove.toCol}`;
        }
    }

    return `${boardKey} ${turnKey} ${castlingKey || "-"} ${enPassantKey}`;
}

positionHistory.push(getPositionKey());

function startBotIfNeeded() {
    if (
        !gameOver &&
        gameMode[currentTurn].slice(0, 4) === "bot/"
    ) {
        makeBotMove(
            gameMode[currentTurn].slice(4)
        );
    }
}

function getSquareName(row, col) {
    const files = "abcdefgh";
    const ranks = "87654321";

    return files[col] + ranks[row];
}

function getPieceLetter(piece) {
    const letters = {
        K: "K",
        Q: "Q",
        R: "R",
        B: "B",
        N: "N",
        P: ""
    };

    return letters[piece[1]];
}

function isCaptureMove(fromRow, fromCol, toRow, toCol, movingPiece) {
    // Normal capture
    if (currentPosition[toRow][toCol] !== null) {
        return true;
    }

    // En passant
    if (
        movingPiece[1] === "P" &&
        fromCol !== toCol
    ) {
        return true;
    }

    return false;
}

function getLegalMovesForPGN(row, col) {
    return getLegalMoves(row, col);
}

function getDisambiguation(
    fromRow,
    fromCol,
    toRow,
    toCol,
    movingPiece
) {
    const type = movingPiece[1];

    // Pawns don't need normal piece disambiguation.
    if (type === "P") {
        return "";
    }

    const alternatives = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (row === fromRow && col === fromCol) {
                continue;
            }

            const piece = currentPosition[row][col];

            if (
                !piece ||
                piece[0] !== movingPiece[0] ||
                piece[1] !== type
            ) {
                continue;
            }

            const legalMoves = getLegalMovesForPGN(row, col);

            const canReach = legalMoves.some(
                ([moveRow, moveCol]) =>
                    moveRow === toRow &&
                    moveCol === toCol
            );

            if (canReach) {
                alternatives.push([row, col]);
            }
        }
    }

    if (alternatives.length === 0) {
        return "";
    }

    const sameFile = alternatives.some(
        ([row, col]) => col === fromCol
    );

    const sameRank = alternatives.some(
        ([row, col]) => row === fromRow
    );

    const files = "abcdefgh";

    if (!sameFile) {
        return files[fromCol];
    }

    if (!sameRank) {
        return String(8 - fromRow);
    }

    return getSquareName(fromRow, fromCol);
}

function getCheckSuffix(color) {
    const enemyColor = color === "w" ? "b" : "w";

    if (isCheckmate(enemyColor)) {
        return "#";
    }

    if (isInCheck(enemyColor)) {
        return "+";
    }

    return "";
}

function createPGNMove(
    fromRow,
    fromCol,
    toRow,
    toCol,
    movingPiece,
    promotion = null,
    capturedPiece = null,
    wasEnPassant = false,
    wasCastling = false
) {
    const color = movingPiece[0];
    const type = movingPiece[1];

    /*
     * Castling
     */
    if (wasCastling) {
        if (toCol > fromCol) {
            return "O-O";
        }

        return "O-O-O";
    }

    const capture = capturedPiece !== null || wasEnPassant;

    let notation = "";

    /*
     * Pawn
     */
    if (type === "P") {
        if (capture) {
            const files = "abcdefgh";

            notation += files[fromCol];
            notation += "x";
        }

        notation += getSquareName(toRow, toCol);

        if (promotion) {
            notation += "=" + promotion;
        }
    }

    /*
     * Piece
     */
    else {
        notation += getPieceLetter(movingPiece);

        notation += getDisambiguation(
            fromRow,
            fromCol,
            toRow,
            toCol,
            movingPiece
        );

        if (capture) {
            notation += "x";
        }

        notation += getSquareName(toRow, toCol);
    }

    return notation;
}

function addPGNMove(
    fromRow,
    fromCol,
    toRow,
    toCol,
    movingPiece,
    promotion = null,
    capturedPiece = null,
    wasEnPassant = false,
    wasCastling = false
) {
    const notation = createPGNMove(
        fromRow,
        fromCol,
        toRow,
        toCol,
        movingPiece,
        promotion,
        capturedPiece,
        wasEnPassant,
        wasCastling
    );

    /*
     * movePiece() has already happened at this point,
     * so check/checkmate can be determined from the
     * current board.
     */
    const suffix = getCheckSuffix(movingPiece[0]);

    pgnMoves.push(notation + suffix);
}

function getPGNResult() {
    if (!gameOver) {
        return "*";
    }

    if (isCheckmate(currentTurn)) {
        // currentTurn is the player who got checkmated
        return currentTurn === "w" ? "0-1" : "1-0";
    }

    return "1/2-1/2";
}

function generatePGN() {
    let pgn = "";

    pgn += `[Event "Local Game"]\n`;
    pgn += `[Site "Local"]\n`;
    pgn += `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]\n`;
    pgn += `[Round "-"]\n`;
    pgn += `[White "Player"]\n`;
    pgn += `[Black "Minimax"]\n`;
    pgn += `[Result "${getPGNResult()}"]\n`;
    pgn += "\n";

    for (let i = 0; i < pgnMoves.length; i++) {
        if (i % 2 === 0) {
            pgn += `${Math.floor(i / 2) + 1}. `;
        }

        pgn += pgnMoves[i];

        if (i < pgnMoves.length - 1) {
            pgn += " ";
        }
    }

    pgn += ` ${getPGNResult()}`;

    return pgn;
}

function logPGN() {
    console.log(
        "%cPGN:",
        "font-weight: bold;"
    );

    console.log(generatePGN());
}

function promotePawn(row, col, fromRow, fromCol, movingPiece) {
    const pawn = currentPosition[row][col];

    if (pawn[1] !== "P") {
        return;
    }

    promotionSquare = {
        row,
        col,
        fromRow,
        fromCol,
        movingPiece
    };

    promotionScreen.classList.remove("hidden");

    promotionButtons.forEach(button => {
        button.addEventListener("click", () => {
            const choice = button.dataset.piece;

            const {
                row,
                col,
                fromRow,
                fromCol,
                movingPiece
            } = promotionSquare;

            const color = currentPosition[row][col][0];

            currentPosition[row][col] = color + choice;

            renderBoard();

            pgnMoves.push(
                createPGNMove(
                    fromRow,
                    fromCol,
                    row,
                    col,
                    movingPiece,
                    choice,
                    null,
                    false,
                    false
                ) + getCheckSuffix(movingPiece[0])
            );

            promotionSquare = null;
            promotionScreen.classList.add("hidden");

            waitingForPromotion = false;

            completeMove(
                fromRow,
                fromCol,
                row,
                col,
                movingPiece,
                choice
            );
        });
    });
}

function showGameOver(title, message) {
    gameOverTitle.textContent = title;
    gameOverMessage.textContent = message;

    gameOverScreen.classList.remove("hidden");
    gameOver = true;
}

function updateCastlingRights(
    fromRow, fromCol,
    toRow, toCol
) {
    if (
        (fromRow === 7 && fromCol === 0) ||
        (toRow === 7 && toCol === 0)
    ) {
        castlingRights.wQ = false;
    }

    if (
        (fromRow === 0 && fromCol === 0) ||
        (toRow === 0 && toCol === 0)
    ) {
        castlingRights.bQ = false;
    }

    if (
        (fromRow === 7 && fromCol === 7) ||
        (toRow === 7 && toCol === 7)
    ) {
        castlingRights.wK = false;
    }

    if (
        (fromRow === 0 && fromCol === 7) ||
        (toRow === 0 && toCol === 7)
    ) {
        castlingRights.bK = false;
    }

    if (
        (fromRow === 0 && fromCol === 4) ||
        (toRow === 0 && toCol === 4)
    ) {
        castlingRights.bK = false;
        castlingRights.bQ = false;
    }

    if (
        (fromRow === 7 && fromCol === 4) ||
        (toRow === 7 && toCol === 4)
    ) {
        castlingRights.wK = false;
        castlingRights.wQ = false;
    }
}

function getSlidingAttacks(row, col, directions) {
    const moves = [];
    const piece = currentPosition[row][col];

    if (!piece) {
        return moves;
    }

    for (const [rowDirection, colDirection] of directions) {
        let newRow = row + rowDirection;
        let newCol = col + colDirection;

        while (
            newRow >= 0 &&
            newRow < 8 &&
            newCol >= 0 &&
            newCol < 8
        ) {
            const target = currentPosition[newRow][newCol];

            if (!target) {
                moves.push([newRow, newCol]);
            } else {
                moves.push([newRow, newCol]);
                break;
            }

            newRow += rowDirection;
            newCol += colDirection;
        }
    }

    return moves;
}

function getSlidingMoves(row, col, directions) {
    const moves = [];
    const piece = currentPosition[row][col];

    if (!piece) {
        return moves;
    }

    for (const [rowDirection, colDirection] of directions) {
        let newRow = row + rowDirection;
        let newCol = col + colDirection;

        while (
            newRow >= 0 &&
            newRow < 8 &&
            newCol >= 0 &&
            newCol < 8
        ) {
            const target = currentPosition[newRow][newCol];

            if (!target) {
                moves.push([newRow, newCol]);
            } else {
                if (target[0] !== piece[0]) {
                    moves.push([newRow, newCol]);
                }

                break;
            }

            newRow += rowDirection;
            newCol += colDirection;
        }
    }

    return moves;
}

function getAttackSquares(row, col) {
    const piece = currentPosition[row][col];

    if (!piece) {
        return [];
    }

    const moves = [];

    if (piece === "wK" || piece === "bK") {
        const directions = [[0, 1],[0, -1],[-1, 0],[1, 0],[1, 1],[1, -1],[-1, 1],[-1, -1],];

        for (const [rowDirection, colDirection] of directions) {
            let newRow = row + rowDirection;
            let newCol = col + colDirection;

            if (
                newRow >= 0 &&
                newRow < 8 &&
                newCol >= 0 &&
                newCol < 8
            ) {
                const target = currentPosition[newRow][newCol];
                moves.push([newRow, newCol]);
            }
        }

        return moves;
    }

    if (piece === "wN" || piece === "bN") {
        const directions = [[2, 1],[2, -1],[-2, 1],[-2, -1],[1, 2],[1, -2],[-1, 2],[-1, -2],];

        for (const [rowDirection, colDirection] of directions) {
            let newRow = row + rowDirection;
            let newCol = col + colDirection;

            if (
                newRow >= 0 &&
                newRow < 8 &&
                newCol >= 0 &&
                newCol < 8
            ) {
                const target = currentPosition[newRow][newCol];
                moves.push([newRow, newCol]);
            }
        }

        return moves;
    }

    if (piece === "wR" || piece === "bR") {
        return getSlidingAttacks(row, col, [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]);
    }

    if (piece === "wB" || piece === "bB") {
        return getSlidingAttacks(row, col, [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1]
        ]);
    }

    if (piece === "wQ" || piece === "bQ") {
        return getSlidingAttacks(row, col, [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]);
    }

    if (piece === "wP" || piece === "bP") {
        const direction = piece === "wP" ? -1 : 1;
        const oneRow = row + direction;

        for (const columnChange of [-1, 1]) {
            const targetCol = col + columnChange;

            if (
                oneRow >= 0 &&
                oneRow < 8 &&
                targetCol >= 0 &&
                targetCol < 8
            ) {
                const target = currentPosition[oneRow][targetCol];
                moves.push([oneRow, targetCol]);
            }
        }
    }

    return moves;
}

function isSquareAttacked(row, col, byColor) {
    for (let pieceRow = 0; pieceRow < 8; pieceRow++) {
        for (let pieceCol = 0; pieceCol < 8; pieceCol++) {
            const piece = currentPosition[pieceRow][pieceCol];

            if (!piece || piece[0] !== byColor) {
                continue;
            }

            const attacks = getAttackSquares(pieceRow, pieceCol);

            if (
                attacks.some(
                    ([attackRow, attackCol]) =>
                        attackRow === row && attackCol === col
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function findKing(color) {
    const king = color + "K";

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (currentPosition[row][col] === king) {
                return [row, col];
            }
        }
    }

    return null;
}

function getCastlingMoves(row, col) {
    const moves = [];
    const piece = currentPosition[row][col];

    if (piece !== "wK" && piece !== "bK") {
        return moves;
    }

    const color = piece[0];
    const enemyColor = color === "w" ? "b" : "w";

    if ((((color === "w" && castlingRights.wK === true) || (color === "b" && castlingRights.bK === true)) && currentPosition[row][7] === color + "R") && 
        !isSquareAttacked(row,4,enemyColor) && 
        !isSquareAttacked(row,5,enemyColor) && 
        !isSquareAttacked(row,6,enemyColor)) {
        const squareA = currentPosition[row][5];
        const squareB = currentPosition[row][6];
        if (!squareA && !squareB) {
            moves.push([row, 6]);
        }
    }

    if ((((color === "w" && castlingRights.wQ === true) || (color === "b" && castlingRights.bQ === true)) && currentPosition[row][0] === color + "R") && 
        !isSquareAttacked(row,4,enemyColor) && 
        !isSquareAttacked(row,3,enemyColor) && 
        !isSquareAttacked(row,2,enemyColor)) {
        const squareA = currentPosition[row][3];
        const squareB = currentPosition[row][2];
        const squareC = currentPosition[row][1];
        if (!squareA && !squareB && !squareC) {
            moves.push([row, 2]);
        }
    }
    
    return moves;
}

function isInCheck(color) {
    const kingPosition = findKing(color);

    if (!kingPosition) {
        return false;
    }

    const [kingRow, kingCol] = kingPosition;

    const enemyColor = color === "w" ? "b" : "w";

    return isSquareAttacked(kingRow, kingCol, enemyColor);
}

function moveLeavesKingInCheck(fromRow, fromCol, toRow, toCol) {
    const movingPiece = currentPosition[fromRow][fromCol];
    const capturedPiece = currentPosition[toRow][toCol];

    // Make the temporary move
    currentPosition[toRow][toCol] = movingPiece;
    currentPosition[fromRow][fromCol] = null;

    const inCheck = isInCheck(movingPiece[0]);

    // Undo the move
    currentPosition[fromRow][fromCol] = movingPiece;
    currentPosition[toRow][toCol] = capturedPiece;

    return inCheck;
}

function getEnPassantMoves(row, col) {
    const moves = [];
    const piece = currentPosition[row][col];

    if (!piece || piece[1] !== "P") {
        return moves;
    }

    if (!lastMove || lastMove.piece[1] !== "P") {
        return moves;
    }

    if (Math.abs(lastMove.toRow - lastMove.fromRow) !== 2) {
        return moves;
    }

    if (lastMove.piece[0] === piece[0]) {
        return moves;
    }

    if (
        Math.abs(lastMove.toCol - col) !== 1 ||
        lastMove.toRow !== row
    ) {
        return moves;
    }

    const direction = piece[0] === "w" ? -1 : 1;

    moves.push([
        row + direction,
        lastMove.toCol
    ]);

    return moves;
}

function getPseudoLegalMoves(row, col) {
    const piece = currentPosition[row][col];

    if (!piece) {
        return [];
    }

    const moves = [];

    if (piece === "wK" || piece === "bK") {
        const directions = [[0, 1],[0, -1],[-1, 0],[1, 0],[1, 1],[1, -1],[-1, 1],[-1, -1],];

        for (const [rowDirection, colDirection] of directions) {
            let newRow = row + rowDirection;
            let newCol = col + colDirection;

            if (
                newRow >= 0 &&
                newRow < 8 &&
                newCol >= 0 &&
                newCol < 8
            ) {
                const target = currentPosition[newRow][newCol];

                if (!target) {
                    moves.push([newRow, newCol]);
                } else {
                    if (target[0] !== piece[0]) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
        }

        moves.push(...getCastlingMoves(row, col));
        
        return moves;
    }

    if (piece === "wN" || piece === "bN") {
        const directions = [[2, 1],[2, -1],[-2, 1],[-2, -1],[1, 2],[1, -2],[-1, 2],[-1, -2],];

        for (const [rowDirection, colDirection] of directions) {
            let newRow = row + rowDirection;
            let newCol = col + colDirection;

            if (
                newRow >= 0 &&
                newRow < 8 &&
                newCol >= 0 &&
                newCol < 8
            ) {
                const target = currentPosition[newRow][newCol];

                if (!target) {
                    moves.push([newRow, newCol]);
                } else {
                    if (target[0] !== piece[0]) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
        }

        return moves;
    }

    if (piece === "wR" || piece === "bR") {
        return getSlidingMoves(row, col, [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]);
    }

    if (piece === "wB" || piece === "bB") {
        return getSlidingMoves(row, col, [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1]
        ]);
    }

    if (piece === "wQ" || piece === "bQ") {
        return getSlidingMoves(row, col, [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]);
    }

    if (piece === "wP" || piece === "bP") {
        const direction = piece === "wP" ? -1 : 1;
        const startRow = piece === "wP" ? 6 : 1;

        const oneRow = row + direction;

        if (
            oneRow >= 0 &&
            oneRow < 8 &&
            currentPosition[oneRow][col] === null
        ) {
            moves.push([oneRow, col]);

            const twoRow = row + direction * 2;

            if (
                row === startRow &&
                currentPosition[twoRow][col] === null
            ) {
                moves.push([twoRow, col]);
            }
        }

        for (const columnChange of [-1, 1]) {
            const targetCol = col + columnChange;

            if (
                oneRow >= 0 &&
                oneRow < 8 &&
                targetCol >= 0 &&
                targetCol < 8
            ) {
                const target = currentPosition[oneRow][targetCol];

                if (
                    target &&
                    target[0] !== piece[0]
                ) {
                    moves.push([oneRow, targetCol]);
                }
            }
        }
        moves.push(...getEnPassantMoves(row, col));
    }

    return moves;
}

function getLegalMoves(row, col) {
    const moves = getPseudoLegalMoves(row, col);

    return moves.filter(([moveRow, moveCol]) => {
        return !moveLeavesKingInCheck(
            row,
            col,
            moveRow,
            moveCol
        );
    });
}

function hasLegalMoves(color) {
    for (let pieceRow = 0; pieceRow < 8; pieceRow++) {
        for (let pieceCol = 0; pieceCol < 8; pieceCol++) {
            const piece = currentPosition[pieceRow][pieceCol];

            if (!piece || piece[0] !== color) {
                continue;
            }

            const moves = getLegalMoves(pieceRow, pieceCol);

            if (moves.length > 0) {
                return true;
            }
        }
    }

    return false;
}

function isCheckmate(color) {
    return isInCheck(color) && !hasLegalMoves(color);
}

function isStalemate(color) {
    return !isInCheck(color) && !hasLegalMoves(color);
}

function isInsufficientMaterial() {
    const piecesOnBoard = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = currentPosition[row][col];

            if (piece) {
                piecesOnBoard.push({
                    piece,
                    row,
                    col
                });
            }
        }
    }

    // King vs King
    if (piecesOnBoard.length === 2) {
        return true;
    }

    // King + Bishop/Knight vs King
    if (piecesOnBoard.length === 3) {
        return piecesOnBoard.some(({ piece }) =>
            piece[1] === "B" || piece[1] === "N"
        );
    }

    const nonKings = piecesOnBoard.filter(
        ({ piece }) => piece[1] !== "K"
    );

    if (nonKings.every(({ piece }) => piece[1] === "B")) {
        const bishopColors = nonKings.map(
            ({ row, col }) => (row + col) % 2
        );

        return bishopColors.every(
            color => color === bishopColors[0]
        );
    }

    return false;
}

function isThreefoldRepetition() {
    const currentKey = getPositionKey();

    let count = 0;

    for (const key of positionHistory) {
        if (key === currentKey) {
            count++;
        }
    }

    return count >= 3;
}

function isDraw() {
    return (
        isStalemate(currentTurn) ||
        isInsufficientMaterial() ||
        halfmoveClock >= 100 ||
        isThreefoldRepetition()
    );
}

function clearMoveHighlights() {
    squares.forEach(square => {
        square.classList.remove("move-option");
    });
}

function showMoveHighlights(moves) {
    clearMoveHighlights();

    for (const [row, col] of moves) {
        const index = row * 8 + col;
        squares[index].classList.add("move-option");
    }
}

function resetGame() {
    currentPosition = startingPosition.map(row => [...row]);

    currentTurn = "w";
    lastMove = null;

    castlingRights = {
        wK: true,
        wQ: true,
        bK: true,
        bQ: true
    };

    selectedSquare = null;
    gameOver = false;
    halfmoveClock = 0;
    positionHistory = [];
    pgnMoves = [];

    clearMoveHighlights();

    squares.forEach((square, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;

        square.innerHTML = "";

        const piece = currentPosition[row][col];

        if (piece) {
            const image = document.createElement("img");

            image.src = pieces[piece];
            image.alt = piece;

            square.appendChild(image);
        }

        square.classList.remove("selected");
    });

    positionHistory.push(getPositionKey());
    gameOverScreen.classList.add("hidden");

    if (
        !gameOver &&
        gameMode[currentTurn].slice(0, 4) === "bot/"
    ) {
        makeBotMove(
            gameMode[currentTurn].slice(4)
        );
    }
}

function renderBoard() {
    squares.forEach((square, index) => {
        const row = Math.floor(index / 8);
        const col = index % 8;

        square.innerHTML = "";

        const piece = currentPosition[row][col];

        if (piece) {
            const image = document.createElement("img");

            image.src = pieces[piece];
            image.alt = piece;

            square.appendChild(image);
        }

        square.classList.remove("selected");
    });
}

function completeMove(fromRow, fromCol, toRow, toCol, movingPiece) {
    lastMove = {
        fromRow,
        fromCol,
        toRow,
        toCol,
        piece: movingPiece
    };

    currentTurn = currentTurn === "w" ? "b" : "w";

    positionHistory.push(getPositionKey());

    if (isCheckmate(currentTurn)) {
        const winner = currentTurn === "w" ? "Black" : "White";

        showGameOver(
            "Checkmate!",
            `${winner} wins.`
        );
    } else if (isDraw()) {
        showGameOver(
            "Draw",
            "The game is drawn."
        );
    }

    if (
        !gameOver &&
        gameMode[currentTurn].slice(0, 4) === "bot/"
    ) {
        setTimeout(() => {
            makeBotMove(
                gameMode[currentTurn].slice(4)
            );
        }, 0);
    }
}

function movePiece(
    fromRow,
    fromCol,
    toRow,
    toCol,
    promotionPiece = null
) {
    const movingPiece = currentPosition[fromRow][fromCol];

    const capturedPiece = currentPosition[toRow][toCol];

    const isPawnMove = movingPiece[1] === "P";

    const isCapture = capturedPiece !== null;

    const isCastling =
        movingPiece[1] === "K" &&
        Math.abs(toCol - fromCol) === 2;

    const isEnPassant =
        movingPiece[1] === "P" &&
        toCol !== fromCol &&
        currentPosition[toRow][toCol] === null;

    /*
     * Remember the captured pawn for en passant.
     */
    let enPassantCapturedPiece = null;

    if (isEnPassant) {
        enPassantCapturedPiece =
            currentPosition[fromRow][toCol];
    }

    updateCastlingRights(
        fromRow,
        fromCol,
        toRow,
        toCol
    );

    currentPosition[toRow][toCol] = movingPiece;

    if (promotionPiece) {
        currentPosition[toRow][toCol] =
            movingPiece[0] + promotionPiece;
    }

    currentPosition[fromRow][fromCol] = null;

    if (isPawnMove || isCapture || isEnPassant) {
        halfmoveClock = 0;
    } else {
        halfmoveClock++;
    }

    /*
     * En passant capture.
     */
    if (isEnPassant) {
        currentPosition[fromRow][toCol] = null;
    }

    /*
     * Castling.
     */
    if (isCastling) {
        if (toCol === 6) {
            // Kingside
            currentPosition[toRow][5] =
                currentPosition[toRow][7];

            currentPosition[toRow][7] = null;
        } else if (toCol === 2) {
            // Queenside
            currentPosition[toRow][3] =
                currentPosition[toRow][0];

            currentPosition[toRow][0] = null;
        }
    }

    /*
     * Generate PGN notation BEFORE changing the turn.
     */
    if (!(
        movingPiece[1] === "P" &&
        (toRow === 0 || toRow === 7) &&
        !promotionPiece
    )) {
        addPGNMove(
            fromRow,
            fromCol,
            toRow,
            toCol,
            movingPiece,
            promotionPiece,
            capturedPiece || enPassantCapturedPiece,
            isEnPassant,
            isCastling
        );
    }

    return {
        promotion:
            movingPiece[1] === "P" &&
            (toRow === 0 || toRow === 7)
    };
}

squares.forEach((square, index) => {
    square.addEventListener("click", () => {

        if (gameOver) {
            return;
        }
        const row = Math.floor(index / 8);
        const col = index % 8;

        if (!selectedSquare) {
            const piece = currentPosition[row][col];

            if (piece && piece[0] === currentTurn) {
                selectedSquare = square;
                square.classList.add("selected");

                const legalMoves = getLegalMoves(row, col);
                showMoveHighlights(legalMoves);
            }

            return;
        }

        const selectedIndex = [...squares].indexOf(selectedSquare);
        const selectedRow = Math.floor(selectedIndex / 8);
        const selectedCol = selectedIndex % 8;

        const legalMoves = getLegalMoves(selectedRow, selectedCol);

        const isLegal = legalMoves.some(
            ([moveRow, moveCol]) =>
                moveRow === row && moveCol === col
        );

        if (isLegal) {

            console.time("player move");

            const movingPiece = currentPosition[selectedRow][selectedCol];

            const moveResult = movePiece(
                selectedRow,
                selectedCol,
                row,
                col
            );

            console.timeLog("player move", "after movePiece");

            renderBoard()

            console.timeLog("player move", "after renderBoard");

            if (moveResult.promotion) {
                waitingForPromotion = true;
                promotePawn(
                    row,
                    col,
                    selectedRow,
                    selectedCol,
                    movingPiece
                );
            }

            if (!moveResult.promotion) {
                completeMove(
                selectedRow,
                selectedCol,
                row,
                col,
                movingPiece
                );
            }

            console.timeEnd("player move");
        }

        selectedSquare.classList.remove("selected");
        clearMoveHighlights();
        selectedSquare = null;    
    });
});

newGameButton.addEventListener("click", () => {
    console.log("New Game clicked");
    resetGame();
    console.log(currentPosition);
});
