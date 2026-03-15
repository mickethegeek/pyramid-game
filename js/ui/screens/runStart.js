// Character select screen — shown at the start of every run

// ─── Class roster ─────────────────────────────────────────────────────────────
// References the BASE_STATS constants defined in each class file.
// Only Warrior is unlocked at the start — others are discovered during runs.

const CLASS_ROSTER = [
    { key: 'warrior',   name: 'Warrior',   factory: createWarrior,   unlocked: true,  stats: WARRIOR_BASE_STATS,   role: 'Tank / CC'    },
    { key: 'barbarian', name: 'Barbarian', factory: createBarbarian, unlocked: false, stats: BARBARIAN_BASE_STATS, role: 'Berserker'    },
    { key: 'cleric',    name: 'Cleric',    factory: createCleric,    unlocked: false, stats: CLERIC_BASE_STATS,    role: 'Healer'       },
    { key: 'archer',    name: 'Archer',    factory: createArcher,    unlocked: false, stats: ARCHER_BASE_STATS,    role: 'Fast Sniper'  },
    { key: 'wizard',    name: 'Wizard',    factory: createWizard,    unlocked: false, stats: WIZARD_BASE_STATS,    role: 'Glass Cannon' },
    { key: 'paladin',   name: 'Paladin',   factory: createPaladin,   unlocked: false, stats: PALADIN_BASE_STATS,   role: 'Hybrid Tank'  },
    { key: 'summoner',  name: 'Summoner',  factory: createSummoner,  unlocked: false, stats: SUMMONER_BASE_STATS,  role: 'Summoner'     },
];

// ─── Layout constants ─────────────────────────────────────────────────────────

const RS = {
    boxW:       170,
    boxH:       165,
    gap:         10,
    row1Y:      110,   // top of the first row of boxes
    row2Y:      295,   // top of the second row (row1Y + boxH + 20 gap)
    row1StartX: 245,   // (1200 - 4*170 - 3*10) / 2 = 245
    row2StartX: 335,   // (1200 - 3*170 - 2*10) / 2 = 335
};

// ─── UI state ─────────────────────────────────────────────────────────────────

// Message shown at the bottom when the player clicks a locked class
let runStartMsg = '';

// Currently selected entries (for multi-pick mode) — array of CLASS_ROSTER entries
let runStartSelected = [];

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the full character select screen
function drawRunStartScreen() {
    drawRunStartBackground();
    drawRunStartHeader();

    // Sync unlocked status with meta discovery
    for (const entry of CLASS_ROSTER) {
        entry.unlocked = isClassDiscovered(entry.key);
    }

    // Row 1: Warrior, Barbarian, Cleric, Archer
    for (let i = 0; i < 4; i++) {
        const x = RS.row1StartX + i * (RS.boxW + RS.gap);
        drawClassBox(CLASS_ROSTER[i], x, RS.row1Y);
    }

    // Row 2: Wizard, Paladin, Summoner — centred
    for (let i = 0; i < 3; i++) {
        const x = RS.row2StartX + i * (RS.boxW + RS.gap);
        drawClassBox(CLASS_ROSTER[i + 4], x, RS.row2Y);
    }

    const maxPicks = getMaxStartingPartySize();

    // START RUN button in multi-pick mode (when at least 1 selected and maxPicks > 1)
    if (maxPicks > 1 && runStartSelected.length > 0) {
        drawRunStartButton(maxPicks);
    }

    // Status / error message at the bottom
    if (runStartMsg) {
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(runStartMsg, 600, 520);
    }
}

// Fill the background with the standard dark colour
function drawRunStartBackground() {
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, 1200, 640);
}

// Draw the top header bar with title and subtitle
function drawRunStartHeader() {
    ctx.fillStyle = '#1e1a16';
    ctx.fillRect(0, 0, 1200, 90);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(1200, 90);
    ctx.stroke();

    const maxPicks = getMaxStartingPartySize();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE YOUR CLASS' + (maxPicks > 1 ? 'ES' : ''), 600, 48);

    ctx.fillStyle = '#666';
    ctx.font = '13px monospace';
    if (maxPicks > 1) {
        ctx.fillText(
            'Pick up to ' + maxPicks + ' heroes  ·  ' + runStartSelected.length + ' selected',
            600, 72
        );
    } else {
        ctx.fillText('Discover new classes during your run to unlock them', 600, 72);
    }
}

// Draw one class box — unlocked shows stats, locked shows a mystery overlay
function drawClassBox(entry, x, y) {
    const selected = runStartSelected.includes(entry);

    // Background — selected boxes glow gold
    ctx.fillStyle = selected ? '#2a2000' : entry.unlocked ? '#1a1408' : '#0d0d0d';
    ctx.fillRect(x, y, RS.boxW, RS.boxH);

    // Border
    ctx.strokeStyle = selected ? '#ffd700' : entry.unlocked ? '#6a5a30' : '#333';
    ctx.lineWidth   = selected ? 3 : entry.unlocked ? 2 : 1;
    ctx.strokeRect(x, y, RS.boxW, RS.boxH);

    if (entry.unlocked) {
        drawUnlockedBox(entry, x, y, selected);
    } else {
        drawLockedBox(entry, x, y);
    }
}

// Return the displayed value of a stat for a class: base + permanent upgrades
function getClassDisplayStat(entry, stat) {
    const base     = entry.stats[stat] || 0;
    const upgrades = getUpgradesForClass(entry.key);
    return base + (upgrades[stat] || 0);
}

// Draw the content of an available (unlocked) class box
function drawUnlockedBox(entry, x, y, selected) {
    const cx = x + RS.boxW / 2;

    // Class name
    ctx.fillStyle  = selected ? '#ffd700' : '#ccaa44';
    ctx.font       = 'bold 15px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(entry.name.toUpperCase(), cx, y + 26);

    // Role label
    ctx.fillStyle = '#888';
    ctx.font      = '11px monospace';
    ctx.fillText(entry.role, cx, y + 42);

    // Horizontal divider
    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 50);
    ctx.lineTo(x + RS.boxW - 12, y + 50);
    ctx.stroke();

    // Stats — base + permanent upgrades, each in a distinct colour
    ctx.textAlign = 'left';
    ctx.font      = '13px monospace';

    ctx.fillStyle = '#ef4444';
    ctx.fillText('HP  ' + getClassDisplayStat(entry, 'hp'),  x + 18, y + 72);

    ctx.fillStyle = '#f97316';
    ctx.fillText('DMG ' + getClassDisplayStat(entry, 'dmg'), x + 18, y + 92);

    ctx.fillStyle = '#22c55e';
    ctx.fillText('SPD ' + getClassDisplayStat(entry, 'spd'), x + 18, y + 112);

    // Select / deselect prompt at bottom of box
    const maxPicks = getMaxStartingPartySize();
    if (maxPicks > 1) {
        ctx.fillStyle  = selected ? '#ffd700' : '#4ade80';
        ctx.font       = 'bold 12px monospace';
        ctx.textAlign  = 'center';
        ctx.fillText(selected ? '[ \u2713 SELECTED ]' : '[ SELECT ]', cx, y + 148);
    } else {
        ctx.fillStyle  = '#4ade80';
        ctx.font       = 'bold 12px monospace';
        ctx.textAlign  = 'center';
        ctx.fillText('[ SELECT ]', cx, y + 148);
    }
}

// Draw the locked overlay for a class that has not yet been discovered
function drawLockedBox(entry, x, y) {
    const cx = x + RS.boxW / 2;

    // Semi-transparent dimming overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, RS.boxW, RS.boxH);

    // Class name — greyed out so the player knows a class exists here
    ctx.fillStyle = '#444';
    ctx.font      = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(entry.name.toUpperCase(), cx, y + 26);

    // Mystery symbol
    ctx.fillStyle = '#333';
    ctx.font      = 'bold 40px monospace';
    ctx.fillText('?', cx, y + 90);

    // Locked label
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.fillText('LOCKED', cx, y + 118);

    // Discovery hint
    ctx.fillStyle = '#3a3a3a';
    ctx.font      = '10px monospace';
    ctx.fillText('Discover in run', cx, y + 136);
}

// Draw the START RUN confirmation button (multi-pick mode only)
function drawRunStartButton(maxPicks) {
    const bx = 490, by = 545, bw = 220, bh = 48;
    ctx.fillStyle   = '#1a2e1a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth   = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle   = '#4ade80';
    ctx.font        = 'bold 18px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('START RUN  (' + runStartSelected.length + '/' + maxPicks + ')', bx + bw / 2, by + 31);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Handle a click on the character select screen.
// Returns true if the party is ready to start, null otherwise.
function handleRunStartClick(x, y) {
    const maxPicks = getMaxStartingPartySize();

    // START RUN button (multi-pick mode, at least 1 selection)
    if (maxPicks > 1 && runStartSelected.length > 0) {
        if (x >= 490 && x <= 710 && y >= 545 && y <= 593) {
            return confirmRunStart();
        }
    }

    // Row 1
    for (let i = 0; i < 4; i++) {
        const bx = RS.row1StartX + i * (RS.boxW + RS.gap);
        if (inClassBox(x, y, bx, RS.row1Y)) return resolveClassClick(CLASS_ROSTER[i]);
    }

    // Row 2
    for (let i = 0; i < 3; i++) {
        const bx = RS.row2StartX + i * (RS.boxW + RS.gap);
        if (inClassBox(x, y, bx, RS.row2Y)) return resolveClassClick(CLASS_ROSTER[i + 4]);
    }

    return null;
}

// Return true if (x, y) falls inside a class box at (bx, by)
function inClassBox(x, y, bx, by) {
    return x >= bx && x <= bx + RS.boxW
        && y >= by && y <= by + RS.boxH;
}

// Handle a click on one class entry — single-pick starts immediately, multi-pick toggles
function resolveClassClick(entry) {
    if (!entry.unlocked) {
        runStartMsg = entry.name + ' is locked — discover this class during a run to unlock it.';
        return null;
    }

    runStartMsg = '';
    const maxPicks = getMaxStartingPartySize();

    // Single-pick: start immediately
    if (maxPicks === 1) {
        runStartSelected = [entry];
        return confirmRunStart();
    }

    // Multi-pick: toggle selection
    const idx = runStartSelected.indexOf(entry);
    if (idx >= 0) {
        // Deselect
        runStartSelected.splice(idx, 1);
    } else if (runStartSelected.length < maxPicks) {
        // Select if slots remain
        runStartSelected.push(entry);
    } else {
        runStartMsg = 'You can only pick ' + maxPicks + ' heroes. Deselect one first.';
    }
    return null;
}

// Build state.party from the confirmed selection and signal that the run is ready
function confirmRunStart() {
    if (runStartSelected.length === 0) return null;

    state.party  = runStartSelected.map(function (e) { return e.factory(); });
    state.player = state.party[0];
    runStartSelected = [];
    return true;
}
