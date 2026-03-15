// Character picker overlay — lets the player choose a party member for a stat roll
//
// Usage (event system drives this):
//   initCharacterPicker(statKey, prompt)   — open the picker
//   drawCharacterPicker()                  — render the overlay (call every frame while active)
//   handleCharacterPickerClick(x, y)       — returns the chosen Character, or null
//   isCharacterPickerActive()              — true while the overlay is showing
//   clearCharacterPicker()                 — dismiss without a selection

// ─── State ─────────────────────────────────────────────────────────────────────

const CP = {
    active:  false,
    statKey: '',     // stat being rolled, e.g. 'dex'
    prompt:  '',     // question shown at top, e.g. 'Who attempts to pick the lock?'
};

// ─── Public API ────────────────────────────────────────────────────────────────

// Open the picker for the given stat and prompt text
function initCharacterPicker(statKey, prompt) {
    CP.active  = true;
    CP.statKey = statKey;
    CP.prompt  = prompt;
}

// Returns true while the overlay is visible
function isCharacterPickerActive() {
    return CP.active;
}

// Dismiss without selecting anyone
function clearCharacterPicker() {
    CP.active = false;
}

// ─── Drawing ───────────────────────────────────────────────────────────────────

// Render the full overlay — call every frame while CP.active is true
function drawCharacterPicker() {
    if (!CP.active) return;

    const party = state.party.filter(m => m.isAlive());
    if (party.length === 0) return;

    // Dark backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, 1200, 640);

    // ── Panel dimensions ──────────────────────────────────────────────────────
    const cols    = Math.min(party.length, 3);
    const rows    = Math.ceil(party.length / cols);
    const cardW   = 220;
    const cardH   = 180;
    const cardGap = 18;
    const padX    = 40;
    const padTop  = 80;   // space for header inside panel
    const padBot  = 24;

    const panelW  = cols * cardW + (cols - 1) * cardGap + padX * 2;
    const panelH  = padTop + rows * cardH + (rows - 1) * cardGap + padBot;
    const panelX  = (1200 - panelW) / 2;
    const panelY  = (640  - panelH) / 2;

    // Panel background
    ctx.fillStyle = '#12100e';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // Panel border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Prompt text
    ctx.fillStyle    = '#ffd700';
    ctx.font         = 'bold 18px monospace';
    ctx.textAlign    = 'center';
    ctx.fillText(CP.prompt, panelX + panelW / 2, panelY + 30);

    // Stat being rolled
    const statName = CP.statKey.toUpperCase();
    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.fillText('Rolling D20 + ' + statName, panelX + panelW / 2, panelY + 52);

    // Draw each member card
    const gridStartX = panelX + padX;
    const gridStartY = panelY + padTop;

    for (let i = 0; i < party.length; i++) {
        const col  = i % cols;
        const row  = Math.floor(i / cols);

        // Centre the last row if it's incomplete
        const rowCount  = (row === rows - 1) ? party.length - row * cols : cols;
        const rowOffset = row === rows - 1 ? ((cols - rowCount) * (cardW + cardGap)) / 2 : 0;

        const cx = gridStartX + col * (cardW + cardGap) + rowOffset;
        const cy = gridStartY + row * (cardH + cardGap);

        drawPickerCard(party[i], cx, cy, cardW, cardH);
    }
}

// Draw a single member card at (cx, cy)
function drawPickerCard(member, cx, cy, w, h) {
    const isHovered = cpIsHovered(cx, cy, w, h);
    const statVal   = member.getStat(CP.statKey);

    // Card background
    ctx.fillStyle = isHovered ? '#1e1a14' : '#161210';
    ctx.fillRect(cx, cy, w, h);

    // Card border — brighter when hovered
    ctx.strokeStyle = isHovered ? '#ffd700' : '#3a3530';
    ctx.lineWidth   = isHovered ? 2 : 1;
    ctx.strokeRect(cx, cy, w, h);

    // Class name
    ctx.fillStyle = isHovered ? '#ffd700' : '#cccccc';
    ctx.font      = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(member.name || member.classKey, cx + w / 2, cy + 26);

    // Big stat value
    ctx.fillStyle = statColor(CP.statKey);
    ctx.font      = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(statVal, cx + w / 2, cy + 88);

    // Stat label below the number
    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.fillText(CP.statKey.toUpperCase(), cx + w / 2, cy + 108);

    // HP bar
    drawPickerHPBar(member, cx + 14, cy + 124, w - 28, 14);

    // "Click" hint when hovered
    if (isHovered) {
        ctx.fillStyle = '#ffd700';
        ctx.font      = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK TO SELECT', cx + w / 2, cy + h - 10);
    }
}

// Draw a compact HP bar inside a picker card
function drawPickerHPBar(member, x, y, w, h) {
    const pct     = Math.max(0, member.currentHP / member.getMaxHP());
    const fillCol = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';

    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = fillCol;
    ctx.fillRect(x, y, Math.floor(w * pct), h);

    ctx.fillStyle = '#555';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(member.currentHP + ' / ' + member.getMaxHP(), x + w / 2, y + h - 2);
}

// ─── Click handling ────────────────────────────────────────────────────────────

// Returns the clicked Character (alive members only), or null if no card was hit
function handleCharacterPickerClick(x, y) {
    if (!CP.active) return null;

    const party = state.party.filter(m => m.isAlive());
    if (party.length === 0) return null;

    const cols    = Math.min(party.length, 3);
    const rows    = Math.ceil(party.length / cols);
    const cardW   = 220;
    const cardH   = 180;
    const cardGap = 18;
    const padX    = 40;
    const padTop  = 80;

    const panelW  = cols * cardW + (cols - 1) * cardGap + padX * 2;
    const panelH  = padTop + rows * cardH + (rows - 1) * cardGap + 24;
    const panelX  = (1200 - panelW) / 2;
    const panelY  = (640  - panelH) / 2;

    const gridStartX = panelX + padX;
    const gridStartY = panelY + padTop;

    for (let i = 0; i < party.length; i++) {
        const col  = i % cols;
        const row  = Math.floor(i / cols);

        const rowCount  = (row === rows - 1) ? party.length - row * cols : cols;
        const rowOffset = row === rows - 1 ? ((cols - rowCount) * (cardW + cardGap)) / 2 : 0;

        const cx = gridStartX + col * (cardW + cardGap) + rowOffset;
        const cy = gridStartY + row * (cardH + cardGap);

        if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
            CP.active = false;  // auto-dismiss once selected
            return party[i];
        }
    }

    return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// True if mouseX/mouseY (from input.js) is inside the card bounds
function cpIsHovered(cx, cy, w, h) {
    return mouseX >= cx && mouseX <= cx + w && mouseY >= cy && mouseY <= cy + h;
}

// Return a colour matching the stat's combat UI colour
function statColor(statKey) {
    const colors = {
        hp:   '#ef4444',
        def:  '#f97316',
        dmg:  '#f59e0b',
        dex:  '#22c55e',
        spd:  '#3b82f6',
        int:  '#a855f7',
        luck: '#ffd700',
        str:  '#f59e0b',
    };
    return colors[statKey] || '#ffffff';
}
