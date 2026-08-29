const bots = {
    random: randomBotMove,
    greedy: greedyBotMove,
    piecetable: piecetableBotMove,
    sixseven: sixsevenBotMove,
    minimax: minimaxBotMove,
};

const pieceValues = {
    P: 100,
    N: 300,
    B: 300,
    R: 500,
    Q: 900,
    K: 100000000000
};

const PAWN_TABLE = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-30,-35, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-45,-50]
];

const KING_OPENING_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const BISHOP_TABLE = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_TABLE = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_TABLE = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
];

const pstTables = {
    P: PAWN_TABLE,
    N: KNIGHT_TABLE,
    B: BISHOP_TABLE,
    R: ROOK_TABLE,
    Q: QUEEN_TABLE,
    K: KING_OPENING_TABLE
};

function getPieceSquareValue(pieceStr, row, col) {
    const color = pieceStr[0]; // 'w' or 'b'
    const type = pieceStr[1];  // 'P', 'N', 'B', etc.
    
    const table = pstTables[type];
    if (!table) return 0;

    // Flip the row for Black pieces
    const tableRow = (color === 'w') ? row : (7 - row);
    
    return table[tableRow][col];
}

function evaluatePosition() {
    let score = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = currentPosition[row][col];

            if (!piece) {
                continue;
            }

            const type = piece[1];
            const value =
                pieceValues[type] +
                getPieceSquareValue(piece, row, col);

            if (piece[0] === "w") {
                score += value;
            } else {
                score -= value;
            }
        }
    }

    return score;
}

function makeSearchMove(move) {
    const [fromRow, fromCol] = move.from;
    const [toRow, toCol] = move.to;

    const movingPiece = currentPosition[fromRow][fromCol];

    const undo = {
        fromRow,
        fromCol,
        toRow,
        toCol,

        movingPiece,

        capturedPiece: currentPosition[toRow][toCol],

        promotion: move.promotion,

        previousLastMove: lastMove,

        previousHalfmoveClock: halfmoveClock,

        previousCastlingRights: {
            ...castlingRights
        },

        enPassantCapturedPiece: null,

        rookFrom: null,
        rookTo: null,
        rookPiece: null
    };

    const isPawn = movingPiece[1] === "P";

    const isCapture =
        undo.capturedPiece !== null;

    const isEnPassant =
        isPawn &&
        fromCol !== toCol &&
        undo.capturedPiece === null;

    const isCastling =
        movingPiece[1] === "K" &&
        Math.abs(toCol - fromCol) === 2;

    // Save the en passant captured pawn
    if (isEnPassant) {
        const capturedRow = fromRow;

        undo.enPassantCapturedPiece =
            currentPosition[capturedRow][toCol];

        currentPosition[capturedRow][toCol] = null;
    }

    // Move the piece
    currentPosition[toRow][toCol] = movingPiece;
    currentPosition[fromRow][fromCol] = null;

    // Promotion
    if (move.promotion) {
        currentPosition[toRow][toCol] =
            movingPiece[0] + move.promotion;
    }

    // Castling
    if (isCastling) {
        if (toCol === 6) {
            undo.rookFrom = [fromRow, 7];
            undo.rookTo = [fromRow, 5];

            undo.rookPiece =
                currentPosition[fromRow][7];

            currentPosition[fromRow][5] =
                currentPosition[fromRow][7];

            currentPosition[fromRow][7] = null;
        }

        if (toCol === 2) {
            undo.rookFrom = [fromRow, 0];
            undo.rookTo = [fromRow, 3];

            undo.rookPiece =
                currentPosition[fromRow][0];

            currentPosition[fromRow][3] =
                currentPosition[fromRow][0];

            currentPosition[fromRow][0] = null;
        }
    }

    // Update castling rights
    updateCastlingRights(
        fromRow,
        fromCol,
        toRow,
        toCol
    );

    // Halfmove clock
    if (isPawn || isCapture || isEnPassant) {
        halfmoveClock = 0;
    } else {
        halfmoveClock++;
    }

    // Update last move
    lastMove = {
        fromRow,
        fromCol,
        toRow,
        toCol,
        piece: movingPiece
    };

    return undo;
}

function undoSearchMove(undo) {
    const {
        fromRow,
        fromCol,
        toRow,
        toCol,
        movingPiece,
        capturedPiece,
        enPassantCapturedPiece,
        rookFrom,
        rookTo,
        rookPiece,
        previousLastMove,
        previousHalfmoveClock,
        previousCastlingRights
    } = undo;

    // Undo castling rook
    if (rookFrom && rookTo) {
        currentPosition[rookFrom[0]][rookFrom[1]] = rookPiece;
        currentPosition[rookTo[0]][rookTo[1]] = null;
    }

    // Undo main piece
    currentPosition[fromRow][fromCol] = movingPiece;
    currentPosition[toRow][toCol] = capturedPiece;

    // Undo en passant
    if (enPassantCapturedPiece) {
        currentPosition[fromRow][toCol] =
            enPassantCapturedPiece;
    }

    // Restore game state
    lastMove = previousLastMove;

    halfmoveClock = previousHalfmoveClock;

    castlingRights = {
        ...previousCastlingRights
    };
}

function minimax(
    depth,
    alpha,
    beta,
    maximizingPlayer
) {
    if (depth === 0) {
        return evaluatePosition();
    }

    const color =
        maximizingPlayer ? "w" : "b";

    const moves = getAllLegalMoves(color);

    // Checkmate / stalemate
    if (moves.length === 0) {
        if (isInCheck(color)) {
            if (maximizingPlayer) {
                return -pieceValues.K + depth * 10000;
            } else {
                return pieceValues.K - depth * 10000;
            }
        }

        return 0;
    }

    if (maximizingPlayer) {
        let bestValue = -Infinity;

        for (const move of moves) {
            const undo = makeSearchMove(move);

            const value = minimax(
                depth - 1,
                alpha,
                beta,
                false
            );

            undoSearchMove(undo);

            bestValue = Math.max(
                bestValue,
                value
            );

            alpha = Math.max(
                alpha,
                bestValue
            );

            if (beta <= alpha) {
                break;
            }
        }

        return bestValue;
    }

    let bestValue = Infinity;

    for (const move of moves) {
        const undo = makeSearchMove(move);

        const value = minimax(
            depth - 1,
            alpha,
            beta,
            true
        );

        undoSearchMove(undo);

        bestValue = Math.min(
            bestValue,
            value
        );

        beta = Math.min(
            beta,
            bestValue
        );

        if (beta <= alpha) {
            break;
        }
    }

    return bestValue;
}

function makeBotMove(botName) {
    const bot = bots[botName] || randomBotMove;

    const move = bot(currentTurn);

    if (!move) {
        return;
    }

    const { from, to, promotion } = move;

    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;

    const movingPiece = currentPosition[fromRow][fromCol];

    movePiece(
        fromRow,
        fromCol,
        toRow,
        toCol,
        promotion
    );

    renderBoard();

    completeMove(
        fromRow,
        fromCol,
        toRow,
        toCol,
        movingPiece
    );
}

function getAllLegalMoves(color) {
    const moves = [];

    for (let pieceRow = 0; pieceRow < 8; pieceRow++) {
        for (let pieceCol = 0; pieceCol < 8; pieceCol++) {
            const piece = currentPosition[pieceRow][pieceCol];

            if (!piece || piece[0] !== color) {
                continue;
            }

            const pieceMoves = getLegalMoves(pieceRow, pieceCol);

            for (const move of pieceMoves) {
                const [toRow, toCol] = move;

                const isPromotion =
                    piece[1] === "P" &&
                    (toRow === 0 || toRow === 7);

                if (isPromotion) {
                    for (const promotion of ["Q", "R", "B", "N"]) {
                        moves.push({
                            from: [pieceRow, pieceCol],
                            to: [toRow, toCol],
                            promotion: promotion
                        });
                    }
                } else {
                    moves.push({
                        from: [pieceRow, pieceCol],
                        to: [toRow, toCol],
                        promotion: null
                    });
                }
            }
        }
    }

    return moves;
}

function getRandomMove(moves) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];

    return randomMove;
}

function randomBotMove(color) {
    const moves = getAllLegalMoves(color);
    const move = getRandomMove(moves);

    return move;
}

function greedyBotMove(color) {
    const moves = getAllLegalMoves(color);

    let bestValue = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
        const [toRow, toCol] = move.to;
        const capturedPiece = currentPosition[toRow][toCol];

        let value = 0;

        if (capturedPiece) {
            value += pieceValues[capturedPiece[1]];
        }

        if (move.promotion) {
            value = value + pieceValues[move.promotion] -1;
        }

        if (value > bestValue) {
            bestValue = value;
            bestMoves = [move];
        } else if (value === bestValue) {
            bestMoves.push(move);
        }
    }

    return getRandomMove(bestMoves);
}

function piecetableBotMove(color) {
    const moves = getAllLegalMoves(color);

    let bestValue = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
        const [fromRow, fromCol] = move.from;
        const [toRow, toCol] = move.to;

        const movingPiece = currentPosition[fromRow][fromCol];
        const movingType = movingPiece[1];
        const capturedPiece = currentPosition[toRow][toCol];

        let value = 0;

        const fromPst = getPieceSquareValue(
            movingPiece,
            fromRow,
            fromCol
        );

        let toPst = getPieceSquareValue(
            movingPiece,
            toRow,
            toCol
        );

        // Promotion
        if (move.promotion) {
            const promoType = move.promotion.toUpperCase();
            const promoPiece = color + promoType;

            value += pieceValues[promoType] - pieceValues[movingType];

            toPst = getPieceSquareValue(
                promoPiece,
                toRow,
                toCol
            );
        }

        // Moving piece's PST improvement
        value += toPst - fromPst;

        // Capture
        if (capturedPiece) {
            const capturedType = capturedPiece[1];

            value += pieceValues[capturedType];

            // Remove the captured piece's positional contribution
            value -= getPieceSquareValue(
                capturedPiece,
                toRow,
                toCol
            );
        }

        if (value > bestValue) {
            bestValue = value;
            bestMoves = [move];
        } else if (value === bestValue) {
            bestMoves.push(move);
        }
    }

    return getRandomMove(bestMoves);
}

function sixsevenBotMove(color) {
    const moves = getAllLegalMoves(color);

    if (moves.length === 0) {
        return null;
    }

    const rank7Moves = moves.filter(move => move.to[0] === 1);

    if (rank7Moves.length > 0) {
        return getRandomMove(rank7Moves);
    }

    const rank6Moves = moves.filter(move => move.to[0] === 2);

    if (rank6Moves.length > 0) {
        return getRandomMove(rank6Moves);
    }

    return getRandomMove(moves);
}

function minimaxBotMove(color) {
    const moves = getAllLegalMoves(color);

    if (moves.length === 0) {
        return null;
    }

    const depth = 4;

    let bestValue =
        color === "w"
            ? -Infinity
            : Infinity;

    let bestMoves = [];

    for (const move of moves) {
        const undo = makeSearchMove(move);

        const value = minimax(
            depth - 1,
            -Infinity,
            Infinity,
            color === "b"
        );

        undoSearchMove(undo);

        if (color === "w") {
            if (value > bestValue) {
                bestValue = value;
                bestMoves = [move];
            } else if (value === bestValue) {
                bestMoves.push(move);
            }
        } else {
            if (value < bestValue) {
                bestValue = value;
                bestMoves = [move];
            } else if (value === bestValue) {
                bestMoves.push(move);
            }
        }
    }

    console.log(
        "Minimax:",
        color,
        "score:",
        bestValue,
        "moves:",
        bestMoves
    );

    return getRandomMove(bestMoves);
}

startBotIfNeeded();
