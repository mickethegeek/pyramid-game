// Equipment screen — manage equipped items per party member

// ─── Layout constants ─────────────────────────────────────────────────────────

const EQ_BACK_BTN = { x: 500, y: 578, w: 200, h: 44 };

// Member tab bar sits between the header and the content panels
const EQ_TAB_Y = 66;
const EQ_TAB_H = 40;

// Left panel: three equipment slots (pushed down by tab bar height)
const EQ_SLOT_X = 15;
const EQ_SLOT_W = 555;
const EQ_SLOT_H = 110;
const EQ_SLOTS  = [
    { name: 'weapon',    label: 'WEAPON',    y: 116 },
    { name: 'armor',     label: 'ARMOR',     y: 236 },
    { name: 'accessory', label: 'ACCESSORY', y: 356 },
];

// Right panel: scrollable inventory list
const EQ_INV_X     = 590;
const EQ_INV_W     = 595;
const EQ_ROW_H     = 45;
const EQ_INV_START = 116;
const EQ_MAX_ROWS  = 8;   // reduced from 10 to accommodate sort buttons above the list

// ─── UI state ─────────────────────────────────────────────────────────────────

// Which party member is currently shown — index into state.party
let equipSelectedIdx   = 0;
// Scroll offset for the inventory list — how many items are hidden above the view
let eqInvScrollOffset  = 0;
// Active sort mode for the inventory list
let eqInvSort          = 'none'; // 'none' | 'rarity' | 'type'

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the full equipment screen
function drawEquipmentScreen() {
    // Guard against stale index when party changes — also reset scroll/sort when triggered
    if (equipSelectedIdx >= state.party.length) {
        equipSelectedIdx  = 0;
        eqInvScrollOffset = 0;
        eqInvSort         = 'none';
    }
    drawEquipBackground();
    drawEquipHeader();
    drawEquipMemberTabs();
    drawEquipSlots();
    drawEquipInventory();
    drawEquipBackButton();
}

// Dark background
function drawEquipBackground() {
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, 1200, 640);
}

// Gold-trimmed header bar with selected member's name and HP
function drawEquipHeader() {
    ctx.fillStyle = '#1a1408';
    ctx.fillRect(0, 0, 1200, 66);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 66);
    ctx.lineTo(1200, 66);
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPMENT', 20, 44);

    const member = state.party[equipSelectedIdx];
    if (member) {
        const hp = member.currentHP + ' / ' + member.getMaxHP() + ' HP';
        ctx.fillStyle = '#cccccc';
        ctx.font = '15px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(member.name + '   ' + hp, 1182, 44);
    }
}

// Draw one tab per party member across the full canvas width
function drawEquipMemberTabs() {
    const count = state.party.length;
    if (count === 0) return;
    const tabW = Math.floor(1200 / count);

    for (let i = 0; i < count; i++) {
        const member   = state.party[i];
        const x        = i * tabW;
        const selected = (i === equipSelectedIdx);

        ctx.fillStyle   = selected ? '#2a1a08' : '#161210';
        ctx.fillRect(x, EQ_TAB_Y, tabW, EQ_TAB_H);

        ctx.strokeStyle = selected ? '#ffd700' : '#3a3530';
        ctx.lineWidth   = selected ? 2 : 1;
        ctx.strokeRect(x, EQ_TAB_Y, tabW, EQ_TAB_H);

        // HP colour dot
        const hpPct = member.currentHP / member.getMaxHP();
        ctx.fillStyle = !member.isAlive()  ? '#555'
                      : hpPct > 0.50       ? '#22c55e'
                      : hpPct > 0.25       ? '#eab308'
                      :                      '#ef4444';
        ctx.beginPath();
        ctx.arc(x + 14, EQ_TAB_Y + EQ_TAB_H / 2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle   = selected ? '#ffd700' : '#888';
        ctx.font        = 'bold 13px monospace';
        ctx.textAlign   = 'left';
        ctx.fillText(member.name.toUpperCase(), x + 26, EQ_TAB_Y + 25);

        if (!member.isAlive()) {
            ctx.fillStyle = '#555';
            ctx.font      = '11px monospace';
            ctx.fillText('[FALLEN]', x + 26 + member.name.length * 9 + 4, EQ_TAB_Y + 25);
        }
    }
}

// Draw all three equipment slots for the selected party member
function drawEquipSlots() {
    const member = state.party[equipSelectedIdx];
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('── EQUIPPED ──────────────────', EQ_SLOT_X, EQ_TAB_Y + EQ_TAB_H + 10);

    for (const slot of EQ_SLOTS) {
        drawEquipSlot(slot, member);
    }
}

// Draw one equipment slot box for the given member
function drawEquipSlot(slot, member) {
    const item = member ? member.equipment[slot.name] : null;

    ctx.fillStyle   = item ? '#1c1810' : '#161412';
    ctx.fillRect(EQ_SLOT_X, slot.y, EQ_SLOT_W, EQ_SLOT_H);

    ctx.strokeStyle = item ? rarityColor(item.rarity) : '#383430';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(EQ_SLOT_X, slot.y, EQ_SLOT_W, EQ_SLOT_H);

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(slot.label, EQ_SLOT_X + 10, slot.y + 17);

    if (item) {
        ctx.fillStyle = rarityColor(item.rarity);
        ctx.font      = 'bold 16px monospace';
        ctx.fillText(item.name, EQ_SLOT_X + 10, slot.y + 42);

        ctx.fillStyle = '#aaa';
        ctx.font      = '13px monospace';
        ctx.fillText(buildStatString(item.statBonus), EQ_SLOT_X + 10, slot.y + 62);

        if (item.passiveDesc) {
            ctx.fillStyle = '#8bc4aa';
            ctx.font      = '12px monospace';
            ctx.fillText(item.passiveDesc, EQ_SLOT_X + 10, slot.y + 80);
        }

        ctx.fillStyle  = '#484440';
        ctx.font       = '11px monospace';
        ctx.textAlign  = 'right';
        ctx.fillText('[click to unequip]', EQ_SLOT_X + EQ_SLOT_W - 8, slot.y + EQ_SLOT_H - 7);
    } else {
        ctx.fillStyle = '#3a3530';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Empty', EQ_SLOT_X + 10, slot.y + 50);
    }
}

// Return a sorted copy of the inventory — never mutates state.inventory
function eqInvGetSorted(inv) {
    if (eqInvSort === 'none') return inv.slice();
    const RARITY_ORDER = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const TYPE_ORDER   = { weapon: 0, armor: 1, accessory: 2 };
    return inv.slice().sort((a, b) =>
        eqInvSort === 'rarity'
            ? (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4)
            : (TYPE_ORDER[a.type]     ?? 3) - (TYPE_ORDER[b.type]     ?? 3)
    );
}

// Draw the inventory list on the right side — shared across all party members
function drawEquipInventory() {
    const inv    = state.inventory || [];
    const labelY = EQ_TAB_Y + EQ_TAB_H + 10;

    // Vertical divider
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(580, EQ_TAB_Y + EQ_TAB_H);
    ctx.lineTo(580, 640);
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('── INVENTORY (' + inv.length + ') ────────────────', EQ_INV_X, labelY);

    // ── Sort buttons ───────────────────────────────────────────────────────────
    const sortBtnY  = labelY + 14;           // sits just below the label text
    const rowStartY = sortBtnY + 28 + 6;     // rows begin below the buttons + gap

    // RARITY button
    const rarityActive = eqInvSort === 'rarity';
    ctx.fillStyle   = rarityActive ? '#1a1408' : '#161210';
    ctx.fillRect(EQ_INV_X, sortBtnY, 80, 28);
    ctx.strokeStyle = rarityActive ? '#ffd700' : '#444';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(EQ_INV_X, sortBtnY, 80, 28);
    ctx.fillStyle   = rarityActive ? '#ffd700' : '#555';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('RARITY', EQ_INV_X + 40, sortBtnY + 18);

    // TYPE button
    const typeActive = eqInvSort === 'type';
    ctx.fillStyle   = typeActive ? '#1a1408' : '#161210';
    ctx.fillRect(EQ_INV_X + 90, sortBtnY, 80, 28);
    ctx.strokeStyle = typeActive ? '#ffd700' : '#444';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(EQ_INV_X + 90, sortBtnY, 80, 28);
    ctx.fillStyle   = typeActive ? '#ffd700' : '#555';
    ctx.font        = 'bold 11px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('TYPE', EQ_INV_X + 130, sortBtnY + 18);

    if (inv.length === 0) {
        ctx.fillStyle = '#3a3530';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('No items in inventory', EQ_INV_X + 10, rowStartY + 28);
        return;
    }

    // Clamp scroll offset to valid range
    const maxOffset = Math.max(0, inv.length - EQ_MAX_ROWS);
    if (eqInvScrollOffset > maxOffset) eqInvScrollOffset = maxOffset;

    const sorted  = eqInvGetSorted(inv);
    const visible = Math.min(inv.length - eqInvScrollOffset, EQ_MAX_ROWS);

    // Scroll-up indicator
    if (eqInvScrollOffset > 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25b2', EQ_INV_X + EQ_INV_W / 2, rowStartY - 4);
    }

    for (let i = 0; i < visible; i++) {
        drawInventoryRow(sorted[eqInvScrollOffset + i], i, rowStartY);
    }

    // Scroll-down indicator
    if (eqInvScrollOffset + EQ_MAX_ROWS < inv.length) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25bc', EQ_INV_X + EQ_INV_W / 2, rowStartY + visible * EQ_ROW_H + 14);
    }
}

// Draw a single inventory row — rowStartY is the y coordinate of the first row
function drawInventoryRow(item, index, rowStartY) {
    const y = rowStartY + index * EQ_ROW_H;

    ctx.fillStyle = index % 2 === 0 ? '#181410' : '#141210';
    ctx.fillRect(EQ_INV_X, y, EQ_INV_W, EQ_ROW_H);

    ctx.strokeStyle = '#242018';
    ctx.lineWidth   = 1;
    ctx.strokeRect(EQ_INV_X, y, EQ_INV_W, EQ_ROW_H);

    ctx.fillStyle  = rarityColor(item.rarity);
    ctx.font       = 'bold 14px monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(item.name, EQ_INV_X + 10, y + 18);

    ctx.fillStyle = '#777';
    ctx.font      = '12px monospace';
    ctx.fillText(buildStatString(item.statBonus), EQ_INV_X + 10, y + 35);

    ctx.fillStyle  = '#c2855b';
    ctx.font       = 'bold 11px monospace';
    ctx.textAlign  = 'right';
    ctx.fillText('[equip]', EQ_INV_X + EQ_INV_W - 8, y + 26);
}

// Draw the BACK button
function drawEquipBackButton() {
    const b = EQ_BACK_BTN;
    ctx.fillStyle   = '#1a1408';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle   = '#ffd700';
    ctx.font        = 'bold 20px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('BACK', b.x + b.w / 2, b.y + 30);
}

// ─── Stat string helper ───────────────────────────────────────────────────────

// Build a compact "DMG+5  DEF+2" string from an item's statBonus object
function buildStatString(statBonus) {
    const labels = { hp: 'HP', def: 'DEF', dmg: 'DMG', dex: 'DEX', spd: 'SPD', int: 'INT', luck: 'LUCK' };
    const parts  = [];
    for (const [key, val] of Object.entries(statBonus)) {
        if (val) parts.push(labels[key] + '+' + val);
    }
    return parts.length ? parts.join('  ') : 'No stat bonuses';
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Handle a click on the equipment screen — returns 'back' or null
function handleEquipmentClick(x, y) {
    // Member tab clicks
    const count = state.party.length;
    if (count > 0 && y >= EQ_TAB_Y && y <= EQ_TAB_Y + EQ_TAB_H) {
        const tabW = Math.floor(1200 / count);
        const idx  = Math.floor(x / tabW);
        if (idx >= 0 && idx < count) {
            equipSelectedIdx = idx;
            return null;
        }
    }

    // Back button
    const b = EQ_BACK_BTN;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'back';

    const member = state.party[equipSelectedIdx];
    if (!member) return null;

    // Equipment slot — click to unequip
    for (const slot of EQ_SLOTS) {
        if (x >= EQ_SLOT_X && x <= EQ_SLOT_X + EQ_SLOT_W &&
            y >= slot.y    && y <= slot.y + EQ_SLOT_H) {
            unequipSlot(slot.name, member);
            return null;
        }
    }

    // Compute the same row-start position used by drawEquipInventory
    const _labelY    = EQ_TAB_Y + EQ_TAB_H + 10;
    const _sortBtnY  = _labelY + 14;
    const _rowStartY = _sortBtnY + 28 + 6;

    // Sort button clicks — toggle sort mode and reset scroll
    if (y >= _sortBtnY && y <= _sortBtnY + 28) {
        if (x >= EQ_INV_X && x <= EQ_INV_X + 80) {
            eqInvSort         = eqInvSort === 'rarity' ? 'none' : 'rarity';
            eqInvScrollOffset = 0;
            return null;
        }
        if (x >= EQ_INV_X + 90 && x <= EQ_INV_X + 170) {
            eqInvSort         = eqInvSort === 'type' ? 'none' : 'type';
            eqInvScrollOffset = 0;
            return null;
        }
    }

    // Inventory row — click to equip onto the selected member
    const inv     = state.inventory || [];
    const sorted  = eqInvGetSorted(inv);
    const visible = Math.min(inv.length - eqInvScrollOffset, EQ_MAX_ROWS);
    for (let i = 0; i < visible; i++) {
        const rowY = _rowStartY + i * EQ_ROW_H;
        if (x >= EQ_INV_X && x <= EQ_INV_X + EQ_INV_W &&
            y >= rowY      && y <= rowY + EQ_ROW_H) {
            equipItem(sorted[eqInvScrollOffset + i], member);
            return null;
        }
    }

    return null;
}

// ─── Equip / unequip logic ────────────────────────────────────────────────────

// Equip an item from the inventory onto a specific party member
function equipItem(item, player) {
    player = player || state.player;
    const slotName = item.type;

    if (player.equipment[slotName]) {
        state.inventory.push(player.equipment[slotName]);
    }
    player.equipment[slotName] = item;
    state.inventory = state.inventory.filter(i => i !== item);

    clampResourcesToMax(player);
    saveRunProgress();
}

// Move the item in a slot back to the inventory for a specific party member
function unequipSlot(slotName, player) {
    player = player || state.player;
    const item = player.equipment[slotName];
    if (!item) return;

    state.inventory.push(item);
    player.equipment[slotName] = null;

    clampResourcesToMax(player);
    saveRunProgress();
}

// Scroll the inventory list by delta rows — clamped to valid range
function handleEquipmentScroll(delta) {
    const inv = state.inventory || [];
    const max = Math.max(0, inv.length - EQ_MAX_ROWS);
    eqInvScrollOffset = Math.max(0, Math.min(max, eqInvScrollOffset + delta));
}

// Clamp HP and mana down to their new maxima after equipment changes
function clampResourcesToMax(player) {
    player.currentHP   = Math.min(player.currentHP,   player.getMaxHP());
    player.currentMana = Math.min(player.currentMana, player.getMaxMana());
}
