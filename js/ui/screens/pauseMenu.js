// Pause menu — persistent corner button + overlay panel

// ─── Corner button ────────────────────────────────────────────────────────────

const PAUSE_CORNER_BTN = { x: 1148, y: 8, w: 44, h: 32 };

// Draw the small ≡ button in the top-right corner
function drawMenuButton() {
    const b = PAUSE_CORNER_BTN;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u2261', b.x + b.w / 2, b.y + 22); // ≡
}

// Return true if the corner button was clicked
function isMenuButtonClick(x, y) {
    const b = PAUSE_CORNER_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// ─── Pause overlay ────────────────────────────────────────────────────────────

const PAUSE_PANEL = { x: 460, y: 165, w: 280, h: 300 };

// Four actions in display order — label, return value, colours
const PAUSE_ITEMS = [
    { label: 'RESUME',        value: 'resume',     bg: '#1a2e1a', border: '#4ade80', text: '#4ade80' },
    { label: 'MAIN MENU',     value: 'mainMenu',   bg: '#1a1400', border: '#ffd700', text: '#ffd700' },
    { label: 'RESET RUN',     value: 'resetRun',   bg: '#1a1208', border: '#c2855b', text: '#c2855b' },
    { label: 'FULL RESET',    value: 'fullReset',  bg: '#2a0a0a', border: '#ef4444', text: '#ef4444' },
];

const PAUSE_BTN_H    = 40;
const PAUSE_BTN_GAP  = 12;
const PAUSE_BTN_PAD  = 28;   // horizontal inset from panel edge

// Draw the full pause overlay
function drawPauseOverlay() {
    // Dim everything behind the panel
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, 1200, 640);

    // Panel background
    const p = PAUSE_PANEL;
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    // "PAUSED" heading
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', p.x + p.w / 2, p.y + 42);

    // Buttons
    const bx = p.x + PAUSE_BTN_PAD;
    const bw = p.w - PAUSE_BTN_PAD * 2;
    let   by = p.y + 68;

    for (const item of PAUSE_ITEMS) {
        drawPauseButton(item, bx, by, bw, PAUSE_BTN_H);
        by += PAUSE_BTN_H + PAUSE_BTN_GAP;
    }
}

// Draw a single button inside the pause panel
function drawPauseButton(item, x, y, w, h) {
    ctx.fillStyle = item.bg;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = item.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = item.text;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x + w / 2, y + 26);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Returns one of the PAUSE_ITEMS values, or null if nothing was hit
function handlePauseOverlayClick(x, y) {
    const bx = PAUSE_PANEL.x + PAUSE_BTN_PAD;
    const bw = PAUSE_PANEL.w - PAUSE_BTN_PAD * 2;
    let   by = PAUSE_PANEL.y + 68;

    for (const item of PAUSE_ITEMS) {
        if (pauseHit(x, y, bx, by, bw, PAUSE_BTN_H)) return item.value;
        by += PAUSE_BTN_H + PAUSE_BTN_GAP;
    }
    return null;
}

// Simple hit-test helper used only within this file
function pauseHit(x, y, bx, by, bw, bh) {
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}
