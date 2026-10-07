"use strict";

/* ---------- Game logic (pure functions, no DOM) ---------- */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

function getWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { player: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function isFull(board) {
  return board.every(Boolean);
}

function emptyCells(board) {
  const open = [];
  board.forEach((v, i) => { if (!v) open.push(i); });
  return open;
}

function otherPlayer(p) {
  return p === "X" ? "O" : "X";
}

// Minimax: positive scores favour `ai`. Faster wins and slower losses score higher.
function minimax(board, turn, ai, depth) {
  const win = getWinner(board);
  if (win) return win.player === ai ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;

  const scores = emptyCells(board).map(i => {
    board[i] = turn;
    const score = minimax(board, otherPlayer(turn), ai, depth + 1);
    board[i] = null;
    return score;
  });
  return turn === ai ? Math.max(...scores) : Math.min(...scores);
}

function bestMove(board, ai) {
  let best = -Infinity;
  let move = -1;
  for (const i of emptyCells(board)) {
    board[i] = ai;
    const score = minimax(board, otherPlayer(ai), ai, 1);
    board[i] = null;
    if (score > best) { best = score; move = i; }
  }
  return move;
}

function randomMove(board) {
  const open = emptyCells(board);
  return open[Math.floor(Math.random() * open.length)];
}

function chooseMove(board, ai, difficulty) {
  return difficulty === "easy" ? randomMove(board) : bestMove(board, ai);
}

/* ---------- Page behaviour (events + rendering) ---------- */

if (typeof document !== "undefined") {
  const MARKS = {
    X: '<svg class="mark x" viewBox="0 0 100 100" aria-hidden="true">' +
       '<path d="M25 25 L75 75" pathLength="1"/><path d="M75 25 L25 75" pathLength="1"/></svg>',
    O: '<svg class="mark o" viewBox="0 0 100 100" aria-hidden="true">' +
       '<circle cx="50" cy="50" r="26" pathLength="1"/></svg>'
  };
  const COMPUTER_DELAY_MS = 450;

  const boardEl = document.getElementById("board");
  const cells = Array.from(boardEl.querySelectorAll(".cell"));
  const statusEl = document.getElementById("status");
  const difficultyField = document.getElementById("difficulty-field");
  const difficultyEl = document.getElementById("difficulty");

  const state = {
    board: Array(9).fill(null),
    current: "X",
    starter: "X",
    over: false,
    winner: null,
    mode: "two",        // "two" or "cpu" (computer plays O)
    difficulty: "hard",
    scores: { X: 0, O: 0, draws: 0 },
    timer: null
  };

  function isComputerTurn() {
    return state.mode === "cpu" && !state.over && state.current === "O";
  }

  function names() {
    return state.mode === "cpu"
      ? { X: "You", O: "Computer" }
      : { X: "Player X", O: "Player O" };
  }

  function statusText() {
    const who = names();
    if (state.winner) {
      if (state.mode === "cpu") {
        return state.winner.player === "X" ? "You win this round" : "Computer wins this round";
      }
      return `${who[state.winner.player]} wins this round`;
    }
    if (state.over) return "Draw. Nobody wins this round";
    if (state.mode === "cpu") {
      return state.current === "X" ? "Your turn (X)" : "Computer is thinking…";
    }
    return `${who[state.current]}, your turn`;
  }

  function render() {
    const winLine = state.winner ? state.winner.line : [];
    cells.forEach((cell, i) => {
      const value = state.board[i] || "";
      if (cell.dataset.mark !== value) {
        cell.dataset.mark = value;
        cell.innerHTML = value ? MARKS[value] : "";
      }
      const row = Math.floor(i / 3) + 1;
      const col = (i % 3) + 1;
      cell.setAttribute("aria-label", `Row ${row}, column ${col}, ${value || "empty"}`);
      cell.setAttribute("aria-disabled", String(Boolean(value) || state.over || isComputerTurn()));
      cell.classList.toggle("win", winLine.includes(i));
    });

    statusEl.textContent = statusText();
    statusEl.classList.toggle("final", state.over);

    const who = names();
    document.getElementById("label-x").textContent = who.X;
    document.getElementById("label-o").textContent = who.O;
    document.getElementById("score-x").textContent = state.scores.X;
    document.getElementById("score-o").textContent = state.scores.O;
    document.getElementById("score-draws").textContent = state.scores.draws;
    difficultyField.hidden = state.mode !== "cpu";
  }

  function maybeComputerTurn() {
    clearTimeout(state.timer);
    if (!isComputerTurn()) return;
    state.timer = setTimeout(() => {
      place(chooseMove(state.board, "O", state.difficulty));
    }, COMPUTER_DELAY_MS);
  }

  function place(index) {
    state.board[index] = state.current;
    const result = getWinner(state.board);
    if (result) {
      state.over = true;
      state.winner = result;
      state.scores[result.player] += 1;
    } else if (isFull(state.board)) {
      state.over = true;
      state.scores.draws += 1;
    } else {
      state.current = otherPlayer(state.current);
    }
    render();
    maybeComputerTurn();
  }

  function play(index) {
    // Ignore taps on filled squares, after the round ends, or while the computer is moving.
    if (state.over || state.board[index] || isComputerTurn()) return;
    place(index);
  }

  function startRound({ alternateStarter }) {
    clearTimeout(state.timer);
    if (alternateStarter) state.starter = otherPlayer(state.starter);
    state.board = Array(9).fill(null);
    state.current = state.starter;
    state.over = false;
    state.winner = null;
    render();
    maybeComputerTurn();
  }

  function resetScores() {
    state.scores = { X: 0, O: 0, draws: 0 };
    state.starter = "X";
    startRound({ alternateStarter: false });
  }

  boardEl.addEventListener("click", event => {
    const cell = event.target.closest(".cell");
    if (cell) play(Number(cell.dataset.index));
  });

  document.getElementById("new-round").addEventListener("click", () => {
    startRound({ alternateStarter: true });
  });

  document.getElementById("reset-scores").addEventListener("click", resetScores);

  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener("change", () => {
      state.mode = radio.value;
      resetScores(); // scores from a different opponent don't carry over
    });
  });

  difficultyEl.addEventListener("change", () => {
    state.difficulty = difficultyEl.value;
    resetScores();
  });

  render();
}

if (typeof module !== "undefined") {
  module.exports = { LINES, getWinner, isFull, emptyCells, bestMove, randomMove, chooseMove };
}
