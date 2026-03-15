// Treasure screen — choice between chest rewards and a relic

// ─── Layout ───────────────────────────────────────────────────────────────────

const TR = {
    // Choice phase – two panels
    chestPanelX:    25,
    chestPanelW:    560,
    relicPanelX:    615,
    relicPanelW:    560,
    choicePanelY:   82,
    choicePanelH:   390,
    choiceBtnY:     488,
    choiceBtnW:     260,
    choiceBtnH:     52,
    // Chest result phase (re-uses choiceBtnY area for CONTINUE)
    goldY:          130,
    itemLabelY:     168,
    itemX:          200,
    itemY:          178,
    itemW:          800,
    itemH:          100,
    divider3Y:      290,
    potionsLabelY:  305,
    potionsStartY:  320,
    potionRowH:     27,
    continueBtnX:   450,
    continueBtnY:   535,
    continueBtnW:   300,
    continueBtnH:   50,
    // Relic pick phase
    relicPickY:     120,
    relicPickH:     290,
    relicTakeBtnX:  450,
    relicTakeBtnY:  488,
    relicTakeBtnW:  300,
    relicTakeBtnH:  52,
};

// ─── Module state ─────────────────────────────────────────────────────────────

let treasureRelicSelected = null;   // relic key selected in the relic-pick phase

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Route to the correct sub-screen based on treasurePhase
function drawTreasureScreen() {
    const t = state.currentTreasure;
    if (!t) return;

    drawEventBackground();
    drawTreasureHeader();

    if (t.treasurePhase === 'choice') {
        drawTreasureChoice(t);
    } else if (t.treasurePhase === 'chest') {
        drawTreasureChestResults(t);
    } else if (t.treasurePhase === 'relic') {
        drawTreasureRelicPick(t);
    }
}

// Gold-tinted header bar
function drawTreasureHeader() {
    ctx.fillStyle = '#1a1400';
    ctx.fillRect(0, 0, 1200, 70);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70); ctx.lineTo(1200, 70);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TREASURE', 30, 45);
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + state.gold + ' gold', 1170, 45);
}

// ─── Choice phase ─────────────────────────────────────────────────────────────

// Two panels side by side: chest (left) and relic (right)
function drawTreasureChoice(t) {
    // Vertical divider
    ctx.strokeStyle = '#3a3020';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(600, 75);
    ctx.lineTo(600, 620);
    ctx.stroke();

    drawTreasureChestPanel(t);
    drawTreasureRelicPanel(t);
}

// Left panel: chest contents summary + OPEN button
function drawTreasureChestPanel(t) {
    const px = TR.chestPanelX;
    const pw = TR.chestPanelW;
    const py = TR.choicePanelY;

    // Panel border
    ctx.strokeStyle = '#5a4a10';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(px, py, pw, TR.choicePanelH);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN THE CHEST', px + pw / 2, py + 34);

    // Divider under title
    ctx.strokeStyle = '#3a3020';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 44);
    ctx.lineTo(px + pw - 10, py + 44);
    ctx.stroke();

    // Gold preview
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u25c6 +' + t.gold + ' gold', px + 20, py + 76);

    // Item preview
    const rc = evRarityColor(t.item.rarity);
    ctx.fillStyle = '#888';
    ctx.font      = '14px monospace';
    ctx.fillText('Item:', px + 20, py + 112);
    ctx.fillStyle = rc;
    ctx.font      = 'bold 14px monospace';
    ctx.fillText(t.item.rarity.toUpperCase() + '  ' + t.item.type.toUpperCase(), px + 75, py + 112);
    ctx.fillStyle = '#aaa';
    ctx.font      = '13px monospace';
    let iname = t.item.name;
    while (ctx.measureText(iname).width > pw - 40 && iname.length > 6) iname = iname.slice(0, -1);
    if (iname !== t.item.name) iname += '\u2026';
    ctx.fillText(iname, px + 20, py + 132);

    // Potions preview
    ctx.fillStyle = '#888';
    ctx.font      = '14px monospace';
    ctx.fillText('Potions:', px + 20, py + 166);
    ctx.fillStyle = t.potions.length > 0 ? '#4ade80' : '#555';
    ctx.fillText(t.potions.length > 0 ? t.potions.length + ' found' : 'none', px + 100, py + 166);

    // Flavour note
    ctx.fillStyle = '#555';
    ctx.font      = 'italic 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Safe, reliable rewards.', px + pw / 2, py + 210);

    // OPEN button
    const bx = px + (pw - TR.choiceBtnW) / 2;
    drawEvBtn('OPEN THE CHEST', bx, TR.choiceBtnY, TR.choiceBtnW, TR.choiceBtnH, 'gold');
}

// Right panel: relic option cards + TAKE A RELIC button
function drawTreasureRelicPanel(t) {
    const px = TR.relicPanelX;
    const pw = TR.relicPanelW;
    const py = TR.choicePanelY;

    // Panel border
    ctx.strokeStyle = '#5a2a80';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(px, py, pw, TR.choicePanelH);

    // Title
    ctx.fillStyle = '#c084fc';
    ctx.font      = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TAKE A RELIC', px + pw / 2, py + 34);

    // Divider under title
    ctx.strokeStyle = '#3a2050';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 44);
    ctx.lineTo(px + pw - 10, py + 44);
    ctx.stroke();

    // Relic preview cards
    const opts = t.relicOptions || [];
    if (opts.length === 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No relics available.', px + pw / 2, py + 150);
    } else {
        const cardH  = 80;
        const gap    = 12;
        const cardW  = pw - 30;
        const startY = py + 58;
        for (let i = 0; i < opts.length; i++) {
            const data = RELIC_DATA[opts[i]];
            if (!data) continue;
            const cy = startY + i * (cardH + gap);
            ctx.fillStyle   = '#1a0d2e';
            ctx.fillRect(px + 15, cy, cardW, cardH);
            ctx.strokeStyle = '#7c3aed';
            ctx.lineWidth   = 1;
            ctx.strokeRect(px + 15, cy, cardW, cardH);
            ctx.fillStyle = '#e8c040';
            ctx.font      = 'bold 14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(data.name, px + 27, cy + 22);
            ctx.fillStyle = '#888';
            ctx.font      = '12px monospace';
            let desc = data.description;
            while (ctx.measureText(desc).width > cardW - 24 && desc.length > 10) desc = desc.slice(0, -1);
            if (desc !== data.description) desc += '\u2026';
            ctx.fillText(desc, px + 27, cy + 44);
        }
    }

    // Flavour note
    ctx.fillStyle = '#555';
    ctx.font      = 'italic 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('High risk, high reward.', px + pw / 2, py + 340);

    // TAKE A RELIC button — gray out if no relics available
    const bx    = px + (pw - TR.choiceBtnW) / 2;
    const style = opts.length > 0 ? 'orange' : 'gray';
    drawEvBtn('TAKE A RELIC', bx, TR.choiceBtnY, TR.choiceBtnW, TR.choiceBtnH, style);
}

// ─── Chest result phase ───────────────────────────────────────────────────────

// Show all chest rewards (applied immediately on entering this phase)
function drawTreasureChestResults(t) {
    const cx = 600;

    ctx.fillStyle = '#888';
    ctx.font      = 'italic 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('The chest yields its secrets.', cx, 96);

    drawTreasureDivider(100, 108, 1000);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u25c6 +' + t.gold + ' gold', cx, TR.goldY);

    drawTreasureDivider(100, 148, 1000);

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 ITEM FOUND \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', TR.itemX, TR.itemLabelY);
    drawEvItemCard(t.item, TR.itemX, TR.itemY, TR.itemW, TR.itemH);

    drawTreasureDivider(100, TR.divider3Y, 1000);

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 POTIONS FOUND \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', TR.itemX, TR.potionsLabelY);

    if (!t.potions || t.potions.length === 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('No potions found.', TR.itemX, TR.potionsStartY + 16);
    } else {
        for (let i = 0; i < t.potions.length; i++) {
            const pd = POTION_DATA[t.potions[i]];
            ctx.fillStyle = '#4ade80';
            ctx.font      = '15px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('\u25cf ' + (pd ? pd.name : t.potions[i]), TR.itemX, TR.potionsStartY + i * TR.potionRowH + 16);
        }
    }

    drawEvBtn('CONTINUE', TR.continueBtnX, TR.continueBtnY, TR.continueBtnW, TR.continueBtnH, 'gold');
}

// ─── Relic pick phase ─────────────────────────────────────────────────────────

// Full-screen relic pick: click a card to select, then TAKE to confirm
function drawTreasureRelicPick(t) {
    const opts = t.relicOptions || [];
    const cx   = 600;

    ctx.fillStyle = '#c084fc';
    ctx.font      = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE YOUR RELIC', cx, 100);

    if (opts.length === 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '14px monospace';
        ctx.fillText('No relics available.', cx, 200);
        drawEvBtn('LEAVE', TR.relicTakeBtnX, TR.relicTakeBtnY, TR.relicTakeBtnW, TR.relicTakeBtnH, 'gray');
        return;
    }

    const cardW = opts.length === 1 ? 600 : opts.length === 2 ? 540 : 350;
    const totalW = opts.length * cardW + (opts.length - 1) * 20;
    const startX = (1200 - totalW) / 2;

    for (let i = 0; i < opts.length; i++) {
        const data     = RELIC_DATA[opts[i]];
        if (!data) continue;
        const cx2      = startX + i * (cardW + 20);
        const selected = treasureRelicSelected === opts[i];
        const hovered  = evInRect(mouseX, mouseY, cx2, TR.relicPickY, cardW, TR.relicPickH);

        ctx.fillStyle   = selected ? '#2a1040' : hovered ? '#1a0d30' : '#130a20';
        ctx.fillRect(cx2, TR.relicPickY, cardW, TR.relicPickH);
        ctx.strokeStyle = selected ? '#ffd700' : hovered ? '#c084fc' : '#5a2a80';
        ctx.lineWidth   = selected || hovered ? 2 : 1.5;
        ctx.strokeRect(cx2, TR.relicPickY, cardW, TR.relicPickH);

        // Relic name
        ctx.fillStyle = selected ? '#ffd700' : '#e8c040';
        ctx.font      = 'bold 18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(data.name, cx2 + 16, TR.relicPickY + 34);

        // Description (word-wrapped)
        ctx.fillStyle = '#aaa';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'left';
        const lines = evWrapText(data.description, cardW - 32);
        for (let l = 0; l < lines.length; l++) {
            ctx.fillText(lines[l], cx2 + 16, TR.relicPickY + 68 + l * 22);
        }

        if (selected) {
            ctx.fillStyle = '#ffd700';
            ctx.font      = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SELECTED', cx2 + cardW / 2, TR.relicPickY + TR.relicPickH - 16);
        }
    }

    // Auto-select if only 1 option
    if (opts.length === 1 && !treasureRelicSelected) treasureRelicSelected = opts[0];

    const canTake = treasureRelicSelected !== null;
    drawEvBtn(canTake ? 'TAKE IT' : 'SELECT A RELIC', TR.relicTakeBtnX, TR.relicTakeBtnY, TR.relicTakeBtnW, TR.relicTakeBtnH, canTake ? 'orange' : 'gray');
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Thin horizontal divider
function drawTreasureDivider(x, y, w) {
    ctx.strokeStyle = '#3a3020';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Returns true when the screen should be dismissed (return to pyramid)
function handleTreasureClick(x, y) {
    const t = state.currentTreasure;
    if (!t) return false;

    if (t.treasurePhase === 'choice') {
        // Left panel OPEN button
        const lbx = TR.chestPanelX + (TR.chestPanelW - TR.choiceBtnW) / 2;
        if (evInRect(x, y, lbx, TR.choiceBtnY, TR.choiceBtnW, TR.choiceBtnH)) {
            applyTreasureChest(t);
            t.treasurePhase = 'chest';
            saveRunProgress();
            return false;
        }
        // Right panel TAKE button
        const rbx = TR.relicPanelX + (TR.relicPanelW - TR.choiceBtnW) / 2;
        if ((t.relicOptions || []).length > 0 &&
            evInRect(x, y, rbx, TR.choiceBtnY, TR.choiceBtnW, TR.choiceBtnH)) {
            treasureRelicSelected = null;
            t.treasurePhase = 'relic';
            saveRunProgress();
            return false;
        }
    }

    if (t.treasurePhase === 'chest') {
        if (evInRect(x, y, TR.continueBtnX, TR.continueBtnY, TR.continueBtnW, TR.continueBtnH)) {
            state.currentTreasure = null;
            return true;
        }
    }

    if (t.treasurePhase === 'relic') {
        const opts = t.relicOptions || [];
        const cardW  = opts.length === 1 ? 600 : opts.length === 2 ? 540 : 350;
        const totalW = opts.length * cardW + (opts.length - 1) * 20;
        const startX = (1200 - totalW) / 2;

        // Click a relic card to select
        for (let i = 0; i < opts.length; i++) {
            const cx = startX + i * (cardW + 20);
            if (evInRect(x, y, cx, TR.relicPickY, cardW, TR.relicPickH)) {
                treasureRelicSelected = opts[i];
                return false;
            }
        }

        // TAKE button
        if (treasureRelicSelected &&
            evInRect(x, y, TR.relicTakeBtnX, TR.relicTakeBtnY, TR.relicTakeBtnW, TR.relicTakeBtnH)) {
            acquireRelic(treasureRelicSelected);
            treasureRelicSelected  = null;
            state.currentTreasure  = null;
            return true;
        }
    }

    return false;
}
