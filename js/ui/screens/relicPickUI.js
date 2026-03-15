// Relic pick screen — shown at run start when the startingRelic meta upgrade is active

// ─── Module state ─────────────────────────────────────────────────────────────

let relicPickOptions  = [];   // 3 relic keys rolled for this run start
let relicPickSelected = [];   // keys the player has toggled on

// ─── Init ─────────────────────────────────────────────────────────────────────

// Roll 3 distinct positive relics and reset selection — call before switching to this scene
function initRelicPick() {
    const owned = (state.activeRelics || []).map(function (r) { return r.key; });
    const keys  = Object.keys(RELIC_DATA).filter(function (k) {
        return !RELIC_DATA[k].cursed && !owned.includes(k);
    });
    for (let i = keys.length - 1; i > 0; i--) {
        const j   = Math.floor(Math.random() * (i + 1));
        const tmp = keys[i]; keys[i] = keys[j]; keys[j] = tmp;
    }
    relicPickOptions  = keys.slice(0, 3);
    relicPickSelected = [];
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the full relic pick screen
function drawRelicPickScreen() {
    const tier   = getStartingRelicTier();
    const maxPick = tier;   // tier 1 = 1, tier 2 = 2, tier 3 = 3

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, 1200, 640);

    // Header
    ctx.fillStyle = '#1a0a2e';
    ctx.fillRect(0, 0, 1200, 70);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70); ctx.lineTo(1200, 70);
    ctx.stroke();
    ctx.fillStyle = '#a855f7';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CHOOSE YOUR RELICS', 30, 44);
    ctx.fillStyle = '#888';
    ctx.font      = '15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Pick ' + maxPick + ' of ' + relicPickOptions.length, 1170, 44);

    // Sub-label
    ctx.fillStyle = '#666';
    ctx.font      = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('These relics will accompany you from the very first room.', 600, 92);

    // Three relic cards
    const cardW  = 340;
    const cardH  = 310;
    const gap    = 30;
    const totalW = 3 * cardW + 2 * gap;
    const startX = (1200 - totalW) / 2;
    const cardY  = 110;

    for (let i = 0; i < relicPickOptions.length; i++) {
        const key      = relicPickOptions[i];
        const data     = RELIC_DATA[key];
        if (!data) continue;
        const cx       = startX + i * (cardW + gap);
        const selected = relicPickSelected.includes(key);
        const hovered  = evInRect(mouseX, mouseY, cx, cardY, cardW, cardH);
        const atMax    = relicPickSelected.length >= maxPick && !selected;

        // Card background
        ctx.fillStyle   = selected ? '#2a0a40' : hovered && !atMax ? '#1a0a28' : '#100820';
        ctx.fillRect(cx, cardY, cardW, cardH);
        ctx.strokeStyle = selected ? '#ffd700' : hovered && !atMax ? '#a855f7' : '#3a1a50';
        ctx.lineWidth   = selected || (hovered && !atMax) ? 2.5 : 1.5;
        ctx.strokeRect(cx, cardY, cardW, cardH);

        // Relic name
        ctx.fillStyle = selected ? '#ffd700' : '#e8c040';
        ctx.font      = 'bold 17px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(data.name, cx + 16, cardY + 36);

        // Separator
        ctx.strokeStyle = '#3a1a50';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 10, cardY + 50);
        ctx.lineTo(cx + cardW - 10, cardY + 50);
        ctx.stroke();

        // Description (wrapped)
        ctx.fillStyle = '#aaa';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'left';
        const lines = evWrapText(data.description, cardW - 32);
        for (let l = 0; l < lines.length; l++) {
            ctx.fillText(lines[l], cx + 16, cardY + 76 + l * 22);
        }

        // Selected badge
        if (selected) {
            ctx.fillStyle   = '#2a1040';
            ctx.fillRect(cx + 10, cardY + cardH - 38, cardW - 20, 28);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth   = 1.5;
            ctx.strokeRect(cx + 10, cardY + cardH - 38, cardW - 20, 28);
            ctx.fillStyle = '#ffd700';
            ctx.font      = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SELECTED', cx + cardW / 2, cardY + cardH - 18);
        } else if (atMax) {
            ctx.fillStyle = '#333';
            ctx.font      = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Max picks reached', cx + cardW / 2, cardY + cardH - 18);
        }
    }

    // Confirm button
    const ready  = relicPickSelected.length === maxPick || relicPickOptions.length === 0;
    const btnX   = 450;
    const btnY   = 560;
    const btnW   = 300;
    const btnH   = 52;
    const style  = ready ? 'orange' : 'gray';
    const label  = ready ? 'CONFIRM & BEGIN' : relicPickSelected.length + ' / ' + maxPick + ' selected';
    drawEvBtn(label, btnX, btnY, btnW, btnH, style);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Returns true when the player confirms their picks and the scene should advance
function handleRelicPickClick(x, y) {
    const tier    = getStartingRelicTier();
    const maxPick = tier;

    const cardW  = 340;
    const cardH  = 310;
    const gap    = 30;
    const totalW = 3 * cardW + 2 * gap;
    const startX = (1200 - totalW) / 2;
    const cardY  = 110;

    // Card toggles
    for (let i = 0; i < relicPickOptions.length; i++) {
        const key = relicPickOptions[i];
        const cx  = startX + i * (cardW + gap);
        if (evInRect(x, y, cx, cardY, cardW, cardH)) {
            if (relicPickSelected.includes(key)) {
                // Deselect
                relicPickSelected = relicPickSelected.filter(function (k) { return k !== key; });
            } else if (relicPickSelected.length < maxPick) {
                // Select
                relicPickSelected.push(key);
            }
            return false;
        }
    }

    // Confirm button
    const ready = relicPickSelected.length === maxPick || relicPickOptions.length === 0;
    if (ready && evInRect(x, y, 450, 560, 300, 52)) {
        // Acquire all selected relics
        for (const key of relicPickSelected) {
            acquireRelic(key);
        }
        relicPickSelected = [];
        relicPickOptions  = [];
        return true;
    }

    return false;
}
