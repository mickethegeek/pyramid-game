// Equipment screen — manage equipped items per party member

// ─── Layout constants ─────────────────────────────────────────────────────────

const EQ_BACK_BTN      = { x: 500, y: 578, w: 200, h: 44 };
const EQ_POSITION_BTN  = { x: 500, y: 14, w: 140, h: 38 };

// Member tab bar sits between the header and the content panels
const EQ_TAB_Y = 66;
const EQ_TAB_H = 40;

// Left panel: four equipment slots (pushed down by tab bar height)
// Slot heights reduced to 100 to fit four slots above the BACK button
const EQ_SLOT_X = 15;
const EQ_SLOT_W = 555;
const EQ_SLOT_H = 100;
const EQ_SLOTS  = [
    { name: 'weapon',    label: 'WEAPON',    y: 116 },
    { name: 'armor',     label: 'ARMOR',     y: 222 },
    { name: 'accessory', label: 'ACCESSORY', y: 328 },
    { name: 'offhand',   label: 'OFFHAND',   y: 434 },
];

// Right panel: scrollable inventory / skills list
const EQ_INV_X          = 590;
const EQ_INV_W          = 595;
const EQ_ROW_H          = 45;
const EQ_INV_START      = 116;
const EQ_MAX_ROWS       = 8;   // max item rows visible at once
const EQ_SKILL_MAX_ROWS = 6;   // max skill rows visible (less space due to slot boxes above)
const EQ_TOGGLE_H       = 28;  // height of the ITEMS / SKILLS toggle buttons
const EQ_SKILL_SLOT_H   = 60;  // height of each equipped-skill slot box
// Skill-panel Y positions (computed from EQ_INV_START=116 + toggle + gaps)
const EQ_SKILL_SLOT1_Y  = EQ_INV_START + EQ_TOGGLE_H + 6;           // 150
const EQ_SKILL_SLOT2_Y  = EQ_SKILL_SLOT1_Y + EQ_SKILL_SLOT_H + 6;  // 216
const EQ_SKILL_SLOT3_Y  = EQ_SKILL_SLOT2_Y + EQ_SKILL_SLOT_H + 6;  // 282
const EQ_SKILL_LIST_Y   = EQ_SKILL_SLOT3_Y + EQ_SKILL_SLOT_H + 14; // 356

// ─── UI state ─────────────────────────────────────────────────────────────────

// Which party member is currently shown — index into state.party
let equipSelectedIdx   = 0;
// Scroll offset for the inventory list — how many items are hidden above the view
let eqInvScrollOffset  = 0;
// Active sort mode for the inventory list
let eqInvSort          = 'none'; // 'none' | 'rarity' | 'type'
// Whether the formation panel is shown instead of equipment slots
let eqShowFormation    = false;
// Index in state.party of the character selected in the formation editor (null = none)
let eqFormationSelected = null;
// Which right panel is active — 'items' or 'skills'
let equipRightPanel = 'items';
// Scroll offset for the skills list
let eqSkillScrollOffset = 0;

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the full equipment screen
function drawEquipmentScreen() {
    if (equipSelectedIdx >= state.party.length) {
        equipSelectedIdx  = 0;
        eqInvScrollOffset = 0;
        eqInvSort         = 'none';
    }
    drawEquipBackground();
    drawEquipHeader();
    drawEquipMemberTabs();
    drawFormationToggleButton();
    if (eqShowFormation) {
        drawFormationPanel();
    } else {
        drawEquipSlots();
    }
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

// Draw all four equipment slots for the selected party member
function drawEquipSlots() {
    const member = state.party[equipSelectedIdx];
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('── EQUIPPED ──────────────────', EQ_SLOT_X, EQ_TAB_Y + EQ_TAB_H + 10);

    for (const slot of EQ_SLOTS) {
        drawEquipSlot(slot, member);
    }

    // Show a rejection message when an offhand equip attempt was blocked by class rules
    if (eqStatusMessage) {
        ctx.fillStyle = '#ef4444';
        ctx.font      = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(eqStatusMessage, EQ_SLOT_X + 10, 554);
    }
}

// Draw the POSITION toggle button at the top of the left panel
function drawFormationToggleButton() {
    const b       = EQ_POSITION_BTN;
    const active  = eqShowFormation;
    ctx.fillStyle   = active ? '#1a2a0a' : '#1a1408';
    ctx.strokeStyle = active ? '#4ade80' : '#ffd700';
    ctx.lineWidth   = 1.5;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = active ? '#4ade80' : '#ffd700';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FORMATION', b.x + b.w / 2, b.y + 17);
}

// Draw the 3+3 formation grid in the left panel area
function drawFormationPanel() {
    const midX   = 290;
    const startY = EQ_TAB_Y + EQ_TAB_H + 40;
    const slotW  = 258;
    const slotH  = 78;
    const gap    = 10;
    const backX  = EQ_SLOT_X + 4;
    const frontX = midX + 4;

    // Column header labels
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a3530';
    ctx.fillText('\u25c4 BACK',  backX  + slotW / 2, startY - 8);
    ctx.fillText('FRONT \u25ba', frontX + slotW / 2, startY - 8);

    // Vertical divider
    ctx.save();
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(midX, EQ_TAB_Y + EQ_TAB_H + 20);
    ctx.lineTo(midX, startY + 3 * (slotH + gap) - gap + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Hint text below the grid
    if (eqFormationSelected !== null) {
        ctx.fillStyle = '#06b6d4';
        ctx.font      = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Click a character on the other side to swap rows, or same character to cancel.',
            backX + slotW / 2, startY + 3 * (slotH + gap) + 10);
    }

    const back  = state.party.filter(m => m.row === 'back');
    const front = state.party.filter(m => m.row === 'front');

    for (let i = 0; i < 3; i++) {
        const slotY = startY + i * (slotH + gap);
        drawFormationSlot(back[i]  || null, backX,  slotY, slotW, slotH);
        drawFormationSlot(front[i] || null, frontX, slotY, slotW, slotH);
    }
}

// Draw one formation slot card — empty or occupied by a party member
function drawFormationSlot(member, x, y, w, h) {
    const isSelected = member !== null && eqFormationSelected !== null
                    && state.party[eqFormationSelected] === member;

    ctx.fillStyle   = !member    ? '#141210'
                    : isSelected ? '#2a1a04'
                    :              '#1c1810';
    ctx.strokeStyle = isSelected ? '#ffd700'
                    : member     ? '#3a3530'
                    :              '#252220';
    ctx.lineWidth   = isSelected ? 2 : 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    if (!member) {
        ctx.fillStyle = '#2a2520';
        ctx.font      = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EMPTY', x + w / 2, y + h / 2 + 4);
        return;
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isSelected ? '#ffd700' : '#cccccc';
    ctx.font      = 'bold 14px monospace';
    ctx.fillText(member.name, x + 10, y + 22);

    ctx.fillStyle = '#666';
    ctx.font      = '11px monospace';
    ctx.fillText(member.currentHP + ' / ' + member.getMaxHP() + ' HP', x + 10, y + 40);

    const barW = w - 20;
    const pct  = member.currentHP / member.getMaxHP();
    ctx.fillStyle = '#3a0000';
    ctx.fillRect(x + 10, y + 50, barW, 8);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(x + 10, y + 50, Math.floor(barW * pct), 8);

    ctx.fillStyle = isSelected ? '#d97706' : '#484440';
    ctx.font      = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(member.row.toUpperCase() + ' ROW', x + w - 8, y + h - 8);
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

    // Offhand slot: show which item types this class can equip, top-right of the box
    if (slot.name === 'offhand' && member) {
        const rules = OFFHAND_RULES[member.classKey];
        if (rules) {
            ctx.fillStyle = '#555';
            ctx.font      = '11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(rules.join(' / ').toUpperCase(), EQ_SLOT_X + EQ_SLOT_W - 8, slot.y + 17);
            ctx.textAlign = 'left';   // reset so item text below draws correctly
        }
    }

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

// Draw the right panel — dispatches to items or skills based on the active toggle
function drawEquipInventory() {
    // Vertical divider
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(580, EQ_TAB_Y + EQ_TAB_H);
    ctx.lineTo(580, 640);
    ctx.stroke();

    drawEquipPanelToggle();

    const member = state.party[equipSelectedIdx];
    if (equipRightPanel === 'skills') {
        drawEquipSkillsPanel(member);
    } else {
        drawEquipItemsPanel();
    }
}

// Draw the ITEMS / SKILLS toggle buttons at the top of the right panel
function drawEquipPanelToggle() {
    const y = EQ_INV_START;
    const h = EQ_TOGGLE_H;

    const itemsActive = equipRightPanel === 'items';
    ctx.fillStyle   = itemsActive ? '#1a1408' : '#161210';
    ctx.strokeStyle = itemsActive ? '#ffd700' : '#444';
    ctx.lineWidth   = 1.5;
    ctx.fillRect(EQ_INV_X, y, 100, h);
    ctx.strokeRect(EQ_INV_X, y, 100, h);
    ctx.fillStyle = itemsActive ? '#ffd700' : '#555';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ITEMS', EQ_INV_X + 50, y + 18);

    const skillsActive = equipRightPanel === 'skills';
    ctx.fillStyle   = skillsActive ? '#1a1408' : '#161210';
    ctx.strokeStyle = skillsActive ? '#ffd700' : '#444';
    ctx.lineWidth   = 1.5;
    ctx.fillRect(EQ_INV_X + 110, y, 100, h);
    ctx.strokeRect(EQ_INV_X + 110, y, 100, h);
    ctx.fillStyle = skillsActive ? '#ffd700' : '#555';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SKILLS', EQ_INV_X + 160, y + 18);
}

// Draw the scrollable item inventory list (items mode)
function drawEquipItemsPanel() {
    const inv       = state.inventory || [];
    const sortBtnY  = EQ_SKILL_SLOT1_Y;          // 150 — directly below toggle
    const rowStartY = sortBtnY + 28 + 6;          // 184

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

    // Item count
    ctx.fillStyle = '#555';
    ctx.font      = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('INVENTORY (' + inv.length + ')', EQ_INV_X + 200, sortBtnY + 18);

    if (inv.length === 0) {
        ctx.fillStyle = '#3a3530';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('No items in inventory', EQ_INV_X + 10, rowStartY + 28);
        return;
    }

    const maxOffset = Math.max(0, inv.length - EQ_MAX_ROWS);
    if (eqInvScrollOffset > maxOffset) eqInvScrollOffset = maxOffset;

    const sorted  = eqInvGetSorted(inv);
    const visible = Math.min(inv.length - eqInvScrollOffset, EQ_MAX_ROWS);

    if (eqInvScrollOffset > 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25b2', EQ_INV_X + EQ_INV_W / 2, rowStartY - 4);
    }

    for (let i = 0; i < visible; i++) {
        drawInventoryRow(sorted[eqInvScrollOffset + i], i, rowStartY);
    }

    if (eqInvScrollOffset + EQ_MAX_ROWS < inv.length) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25bc', EQ_INV_X + EQ_INV_W / 2, rowStartY + visible * EQ_ROW_H + 14);
    }
}

// Draw the skills panel — equipped slots + scrollable shared-pool list
function drawEquipSkillsPanel(member) {
    if (!member) return;

    // Slot 1 — base skill (gold border, never unequippable from here)
    drawEquipSkillSlot('BASE SKILL', member.baseSkill, member, EQ_SKILL_SLOT1_Y, '#ffd700', false);

    // Slot 2 — open equip slot (blue border when filled)
    const s2key = member.equippedSkills[0] || null;
    drawEquipSkillSlot('SKILL SLOT 2', s2key, member, EQ_SKILL_SLOT2_Y, s2key ? '#3b82f6' : '#383430', true);

    // Slot 3 — locked unless meta-unlocked
    const slot3Unlocked = state.meta && state.meta.skillSlot3Unlocked;
    if (slot3Unlocked) {
        const s3key = member.equippedSkills[1] || null;
        drawEquipSkillSlot('SKILL SLOT 3', s3key, member, EQ_SKILL_SLOT3_Y, s3key ? '#3b82f6' : '#383430', true);
    } else {
        ctx.fillStyle   = '#141210';
        ctx.strokeStyle = '#333';
        ctx.lineWidth   = 1.5;
        ctx.fillRect(EQ_INV_X, EQ_SKILL_SLOT3_Y, EQ_INV_W, EQ_SKILL_SLOT_H);
        ctx.strokeRect(EQ_INV_X, EQ_SKILL_SLOT3_Y, EQ_INV_W, EQ_SKILL_SLOT_H);
        ctx.fillStyle = '#444';
        ctx.font      = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SKILL SLOT 3', EQ_INV_X + 10, EQ_SKILL_SLOT3_Y + 17);
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Unlock via Meta Progression', EQ_INV_X + EQ_INV_W / 2, EQ_SKILL_SLOT3_Y + 40);
    }

    // Horizontal divider above the skill list
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(EQ_INV_X, EQ_SKILL_LIST_Y - 8);
    ctx.lineTo(EQ_INV_X + EQ_INV_W, EQ_SKILL_LIST_Y - 8);
    ctx.stroke();

    // Shared skill pool list
    const skills     = state.sharedSkillInventory || [];
    const compatible = skills.filter(k => canEquipSkill(member, k));
    const incompatible = skills.filter(k => !canEquipSkill(member, k));
    const allSkills  = [...compatible, ...incompatible];

    if (allSkills.length === 0) {
        ctx.fillStyle = '#3a3530';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('No skills in shared pool', EQ_INV_X + 10, EQ_SKILL_LIST_Y + 28);
        return;
    }

    const maxOffset = Math.max(0, allSkills.length - EQ_SKILL_MAX_ROWS);
    if (eqSkillScrollOffset > maxOffset) eqSkillScrollOffset = maxOffset;

    const visible = Math.min(allSkills.length - eqSkillScrollOffset, EQ_SKILL_MAX_ROWS);

    if (eqSkillScrollOffset > 0) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25b2', EQ_INV_X + EQ_INV_W / 2, EQ_SKILL_LIST_Y - 2);
    }

    for (let i = 0; i < visible; i++) {
        const skillKey = allSkills[eqSkillScrollOffset + i];
        drawSkillRow(skillKey, member, i, EQ_SKILL_LIST_Y, compatible.includes(skillKey));
    }

    if (eqSkillScrollOffset + EQ_SKILL_MAX_ROWS < allSkills.length) {
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u25bc', EQ_INV_X + EQ_INV_W / 2, EQ_SKILL_LIST_Y + visible * EQ_ROW_H + 14);
    }
}

// Draw one equipped-skill slot box
function drawEquipSkillSlot(label, skillKey, character, y, borderColor, canUnequip) {
    const skill = skillKey ? SKILL_DATA[skillKey] : null;

    ctx.fillStyle   = skill ? '#1c1810' : '#161412';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth   = 1.5;
    ctx.fillRect(EQ_INV_X, y, EQ_INV_W, EQ_SKILL_SLOT_H);
    ctx.strokeRect(EQ_INV_X, y, EQ_INV_W, EQ_SKILL_SLOT_H);

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, EQ_INV_X + 10, y + 17);

    if (!skill) {
        ctx.fillStyle = '#3a3530';
        ctx.font      = '13px monospace';
        ctx.fillText('Empty', EQ_INV_X + 10, y + 42);
        return;
    }

    const level     = character.skillLevels[skillKey] || 1;
    const levelData = skill.levels[level];

    ctx.fillStyle = rarityColor(skill.rarity);
    ctx.font      = 'bold 14px monospace';
    ctx.fillText(levelData.name, EQ_INV_X + 10, y + 38);

    ctx.fillStyle = '#666';
    ctx.font      = '11px monospace';
    ctx.fillText('Lv.' + level + '  ' + skill.scalingStat.toUpperCase() + '  ' + rarityLabel(skill.rarity).toUpperCase(), EQ_INV_X + 10, y + 54);

    if (canUnequip) {
        ctx.fillStyle = '#484440';
        ctx.font      = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('[click to unequip]', EQ_INV_X + EQ_INV_W - 8, y + EQ_SKILL_SLOT_H - 7);
    }
}

// Draw a single skill row in the shared pool list
function drawSkillRow(skillKey, character, index, listStartY, isCompatible) {
    const skill = SKILL_DATA[skillKey];
    if (!skill) return;

    const y         = listStartY + index * EQ_ROW_H;
    const level     = character.skillLevels[skillKey] || 1;
    const name      = skill.levels[level].name;

    ctx.fillStyle = index % 2 === 0 ? '#181410' : '#141210';
    ctx.fillRect(EQ_INV_X, y, EQ_INV_W, EQ_ROW_H);
    ctx.strokeStyle = '#242018';
    ctx.lineWidth   = 1;
    ctx.strokeRect(EQ_INV_X, y, EQ_INV_W, EQ_ROW_H);

    ctx.fillStyle = isCompatible ? rarityColor(skill.rarity) : '#555';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(name, EQ_INV_X + 10, y + 18);

    if (isCompatible) {
        ctx.fillStyle = '#666';
        ctx.font      = '11px monospace';
        ctx.fillText(skill.scalingStat.toUpperCase() + '  ' + rarityLabel(skill.rarity).toUpperCase(), EQ_INV_X + 10, y + 35);
        ctx.fillStyle = '#c2855b';
        ctx.font      = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('[equip]', EQ_INV_X + EQ_INV_W - 8, y + 26);
    } else {
        const classTag = skill.class
            ? skill.class.charAt(0).toUpperCase() + skill.class.slice(1) + ' only'
            : 'No open slot';
        ctx.fillStyle = '#444';
        ctx.font      = '11px monospace';
        ctx.fillText(classTag, EQ_INV_X + 10, y + 35);
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
            equipSelectedIdx    = idx;
            equipRightPanel     = 'items';
            eqInvScrollOffset   = 0;
            eqSkillScrollOffset = 0;
            return null;
        }
    }

    // Back button
    const b = EQ_BACK_BTN;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'back';

    // POSITION toggle button
    const pb = EQ_POSITION_BTN;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
        eqShowFormation    = !eqShowFormation;
        eqFormationSelected = null;
        return null;
    }

    // Formation panel clicks
    if (eqShowFormation) {
        const midX   = 290;
        const startY = EQ_TAB_Y + EQ_TAB_H + 40;
        const slotW  = 258;
        const slotH  = 78;
        const gap    = 10;
        const backX  = EQ_SLOT_X + 4;
        const frontX = midX + 4;
        const back   = state.party.filter(m => m.row === 'back');
        const front  = state.party.filter(m => m.row === 'front');

        for (let i = 0; i < 3; i++) {
            const slotY = startY + i * (slotH + gap);
            if (y >= slotY && y <= slotY + slotH) {
                if (x >= backX && x <= backX + slotW) {
                    handleFormationSlotClick(back[i] || null, 'back');
                    return null;
                }
                if (x >= frontX && x <= frontX + slotW) {
                    handleFormationSlotClick(front[i] || null, 'front');
                    return null;
                }
            }
        }
        return null;
    }

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

    // ITEMS / SKILLS toggle buttons
    if (x >= EQ_INV_X && y >= EQ_INV_START && y <= EQ_INV_START + EQ_TOGGLE_H) {
        if (x <= EQ_INV_X + 100) {
            equipRightPanel   = 'items';
            eqInvScrollOffset = 0;
            return null;
        }
        if (x >= EQ_INV_X + 110 && x <= EQ_INV_X + 210) {
            equipRightPanel     = 'skills';
            eqSkillScrollOffset = 0;
            return null;
        }
    }

    if (equipRightPanel === 'skills') {
        // Slot 2 — click to unequip
        if (x >= EQ_INV_X && x <= EQ_INV_X + EQ_INV_W &&
            y >= EQ_SKILL_SLOT2_Y && y <= EQ_SKILL_SLOT2_Y + EQ_SKILL_SLOT_H) {
            const skillKey = member.equippedSkills[0];
            if (skillKey) unequipSkill(member, skillKey);
            return null;
        }

        // Slot 3 — click to unequip (only if meta-unlocked)
        const slot3Unlocked = state.meta && state.meta.skillSlot3Unlocked;
        if (slot3Unlocked && x >= EQ_INV_X && x <= EQ_INV_X + EQ_INV_W &&
            y >= EQ_SKILL_SLOT3_Y && y <= EQ_SKILL_SLOT3_Y + EQ_SKILL_SLOT_H) {
            const skillKey = member.equippedSkills[1];
            if (skillKey) unequipSkill(member, skillKey);
            return null;
        }

        // Skill list rows — click to equip (compatible only)
        const skills       = state.sharedSkillInventory || [];
        const compatible   = skills.filter(k => canEquipSkill(member, k));
        const incompatible = skills.filter(k => !canEquipSkill(member, k));
        const allSkills    = [...compatible, ...incompatible];
        const visible      = Math.min(allSkills.length - eqSkillScrollOffset, EQ_SKILL_MAX_ROWS);

        for (let i = 0; i < visible; i++) {
            const rowY     = EQ_SKILL_LIST_Y + i * EQ_ROW_H;
            const skillKey = allSkills[eqSkillScrollOffset + i];
            if (x >= EQ_INV_X && x <= EQ_INV_X + EQ_INV_W &&
                y >= rowY      && y <= rowY + EQ_ROW_H) {
                if (compatible.includes(skillKey)) equipSkill(member, skillKey);
                return null;
            }
        }
    } else {
        // Items mode — sort buttons and inventory rows
        const _sortBtnY  = EQ_SKILL_SLOT1_Y;          // 150
        const _rowStartY = _sortBtnY + 28 + 6;         // 184

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
    }

    return null;
}

// ─── Equip / unequip logic ────────────────────────────────────────────────────

// Status message shown when an equip attempt is rejected — drawn in the next UI pass
let eqStatusMessage = '';

// Equip an item from the inventory onto a specific party member.
// Offhand-type items (shield, tome, orb, quiver, focus) are routed to the offhand slot
// and validated against OFFHAND_RULES via canEquipOffhand().
function equipItem(item, player) {
    player = player || state.player;

    // Decide which slot this item belongs in
    const isOffhand = OFFHAND_TYPES.includes(item.type);
    const slotName  = isOffhand ? 'offhand' : item.type;

    // Validate class permission for offhand items
    if (isOffhand && !canEquipOffhand(player, item)) {
        eqStatusMessage = 'This class cannot use that offhand.';
        console.warn(`[equipItem] ${player.name} cannot equip ${item.name} in offhand`);
        return false;
    }

    // Return any item currently in the target slot to the shared inventory
    if (player.equipment[slotName]) {
        state.inventory.push(player.equipment[slotName]);
    }
    player.equipment[slotName] = item;
    state.inventory = state.inventory.filter(i => i !== item);

    // Warrior loadout may change after any equip (dual-wield vs shield detection)
    if (player.classKey === 'warrior') updateWarriorLoadout(player);

    eqStatusMessage = '';
    clampResourcesToMax(player);
    saveRunProgress();
    return true;
}

// Move the item in a slot back to the inventory for a specific party member
function unequipSlot(slotName, player) {
    player = player || state.player;
    const item = player.equipment[slotName];
    if (!item) return;

    state.inventory.push(item);
    player.equipment[slotName] = null;

    // Warrior loadout may change after unequipping (e.g. removing main weapon kills dual-wield)
    if (player.classKey === 'warrior') updateWarriorLoadout(player);

    eqStatusMessage = '';
    clampResourcesToMax(player);
    saveRunProgress();
}

// Handle a click on a formation slot — select, swap rows, or move to empty slot
function handleFormationSlotClick(member, slotRow) {
    if (!member) {
        // Empty slot: if a character from the other row is selected, move them here
        if (eqFormationSelected !== null) {
            const selected = state.party[eqFormationSelected];
            if (selected && selected.row !== slotRow) {
                const destCount = state.party.filter(m => m.row === slotRow).length;
                if (destCount < 3) {
                    selected.row        = slotRow;
                    eqFormationSelected = null;
                    saveRunProgress();
                }
            }
        }
        return;
    }
    if (eqFormationSelected === null) {
        eqFormationSelected = state.party.indexOf(member);
    } else {
        const selected = state.party[eqFormationSelected];
        if (selected === member) {
            eqFormationSelected = null;
        } else if (selected.row !== member.row) {
            const tmp   = member.row;
            member.row  = selected.row;
            selected.row = tmp;
            eqFormationSelected = null;
            saveRunProgress();
        } else {
            eqFormationSelected = state.party.indexOf(member);
        }
    }
}

// Scroll the active right panel list by delta rows — clamped to valid range
function handleEquipmentScroll(delta) {
    if (equipRightPanel === 'skills') {
        const skills = state.sharedSkillInventory || [];
        const max    = Math.max(0, skills.length - EQ_SKILL_MAX_ROWS);
        eqSkillScrollOffset = Math.max(0, Math.min(max, eqSkillScrollOffset + delta));
    } else {
        const inv = state.inventory || [];
        const max = Math.max(0, inv.length - EQ_MAX_ROWS);
        eqInvScrollOffset = Math.max(0, Math.min(max, eqInvScrollOffset + delta));
    }
}

// Clamp HP and mana down to their new maxima after equipment changes
function clampResourcesToMax(player) {
    player.currentHP   = Math.min(player.currentHP,   player.getMaxHP());
    player.currentMana = Math.min(player.currentMana, player.getMaxMana());
}
