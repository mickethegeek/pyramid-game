// Main menu — first screen shown on launch

// ─── Layout ───────────────────────────────────────────────────────────────────

const MM = {
    btnX: 490,   // (1200 - 220) / 2
    btnW: 220,
    btnH: 52,
    continueY: 340,
    newRunY:   420,
    soloY:     380,   // used when there is no save (single button, vertically centred)
};

// ─── Draw ──────────────────────────────────────────────────────────────────────

// Draw the full main menu
function drawMainMenuScreen() {
    drawMainMenuBackground();
    drawMainMenuTitle();
    drawMainMenuButtons();
}

// Dark background with a subtle gold vignette glow
function drawMainMenuBackground() {
    ctx.fillStyle = '#0a0804';
    ctx.fillRect(0, 0, 1200, 640);

    // Faint warm lines for texture
    ctx.strokeStyle = '#1a1200';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 640);
        ctx.stroke();
    }
}

// Title and tagline
function drawMainMenuTitle() {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 88px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PYRAMID', 600, 210);

    ctx.fillStyle = '#c2855b';
    ctx.font = '16px monospace';
    ctx.fillText('Climb. Die. Grow stronger.', 600, 258);
}

// Show "CONTINUE RUN" + "NEW RUN" if a save exists, otherwise just "NEW RUN"
function drawMainMenuButtons() {
    const hasSave = loadRunSave() !== null;

    if (hasSave) {
        drawMMButton('CONTINUE RUN', MM.btnX, MM.continueY, '#1a2e1a', '#4ade80', '#4ade80');
        drawMMButton('NEW RUN',      MM.btnX, MM.newRunY,   '#1a1400', '#ffd700', '#ffd700');
    } else {
        drawMMButton('NEW RUN', MM.btnX, MM.soloY, '#1a1400', '#ffd700', '#ffd700');
    }
}

// Draw a single labelled button
function drawMMButton(label, x, y, bg, border, textColor) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, MM.btnW, MM.btnH);

    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, MM.btnW, MM.btnH);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + MM.btnW / 2, y + 33);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Returns 'continue' | 'newRun' | null
function handleMainMenuClick(x, y) {
    const hasSave = loadRunSave() !== null;

    if (hasSave) {
        if (mmHit(x, y, MM.continueY)) return 'continue';
        if (mmHit(x, y, MM.newRunY))   return 'newRun';
    } else {
        if (mmHit(x, y, MM.soloY))     return 'newRun';
    }
    return null;
}

// Test whether (x, y) lands on a main-menu button at the given y
function mmHit(x, y, btnY) {
    return x >= MM.btnX && x <= MM.btnX + MM.btnW
        && y >= btnY    && y <= btnY + MM.btnH;
}
