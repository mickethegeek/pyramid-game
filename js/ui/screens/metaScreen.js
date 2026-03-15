// Meta screen — shown between runs for spending Soul Shards on permanent upgrades

// ─── Layout constants ──────────────────────────────────────────────────────────

const META = {
    headerH:    70,
    tabY:       90,
    tabH:       36,
    tabW:       110,
    tabStartX:  60,
    sectionY:   148,
    rowStartY:  185,
    rowStep:    46,
    labelX:     100,
    levelX:     270,
    costX:      360,
    buyX:       760,
    buyW:       110,
    buyH:       32,
    newRunBtnX: 480,
    newRunBtnY: 545,
    newRunBtnW: 240,
    newRunBtnH: 50,
};

// Stats shown in the upgrade menu, in display order
const META_STATS = ['hp', 'def', 'dmg', 'dex', 'spd', 'int', 'luck'];

const META_STAT_LABELS = {
    hp: 'HP', def: 'DEF', dmg: 'DMG',
    dex: 'DEX', spd: 'SPD', int: 'INT', luck: 'LUCK',
};

// Which class the player is currently viewing upgrades for — 'general' for the general tab
var metaSelectedClass = 'warrior';

// ─── Draw ──────────────────────────────────────────────────────────────────────

// Draw the full meta screen
function drawMetaScreen() {
    drawMetaBackground();
    drawMetaHeader();
    drawMetaClassTabs();
    if (metaSelectedClass === 'general') {
        drawMetaGeneralSection();
    } else {
        drawMetaUpgradeSection();
    }
    drawMetaNewRunButton();
}

// Dark neutral background
function drawMetaBackground() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 1200, 640);
}

// Header bar with title and shard totals
function drawMetaHeader() {
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, 1200, META.headerH);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, META.headerH);
    ctx.lineTo(1200, META.headerH);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BETWEEN RUNS', 30, 44);

    // Total shards
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + state.meta.soulShards + ' Soul Shards', 1170, 32);

    // Shards earned this run
    ctx.fillStyle = '#888';
    ctx.font = '13px monospace';
    ctx.fillText('(+' + state.soulShardsThisRun + ' this run)', 1170, 54);
}

// Clickable tabs — one per discovered class, plus the GENERAL tab on the right
function drawMetaClassTabs() {
    const discovered = state.meta.discoveredClasses;

    // Class tabs
    for (let i = 0; i < discovered.length; i++) {
        const key      = discovered[i];
        const x        = META.tabStartX + i * (META.tabW + 8);
        const selected = key === metaSelectedClass;

        ctx.fillStyle = selected ? '#ffd700' : '#1a1a2e';
        ctx.fillRect(x, META.tabY, META.tabW, META.tabH);

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = selected ? 0 : 1;
        ctx.strokeRect(x, META.tabY, META.tabW, META.tabH);

        ctx.fillStyle = selected ? '#000' : '#ffd700';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(key.toUpperCase(), x + META.tabW / 2, META.tabY + 23);
    }

    // GENERAL tab — always shown, pinned to the right side
    const gx       = 1200 - META.tabW - META.tabStartX;
    const selected = metaSelectedClass === 'general';
    ctx.fillStyle   = selected ? '#a855f7' : '#1a0a2e';
    ctx.fillRect(gx, META.tabY, META.tabW, META.tabH);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth   = selected ? 0 : 1;
    ctx.strokeRect(gx, META.tabY, META.tabW, META.tabH);
    ctx.fillStyle   = selected ? '#fff' : '#a855f7';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('GENERAL', gx + META.tabW / 2, META.tabY + 23);
}

// Section label + stat upgrade rows for the selected class
function drawMetaUpgradeSection() {
    // Section heading
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Permanent upgrades — ' + metaSelectedClass.toUpperCase(), META.labelX, META.sectionY);

    const upgrades = getUpgradesForClass(metaSelectedClass);

    for (let i = 0; i < META_STATS.length; i++) {
        const stat    = META_STATS[i];
        const y       = META.rowStartY + i * META.rowStep;
        const level   = upgrades[stat] || 0;
        const cost    = upgradeCost(level);
        const canAfford = state.meta.soulShards >= cost;

        drawMetaStatRow(stat, level, cost, canAfford, y);
    }
}

// Draw a single stat upgrade row
function drawMetaStatRow(stat, level, cost, canAfford, y) {
    // Stat name
    ctx.fillStyle = '#cccccc';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(META_STAT_LABELS[stat], META.labelX, y + 20);

    // Current permanent level
    ctx.fillStyle = level > 0 ? '#ffd700' : '#444';
    ctx.font = '15px monospace';
    ctx.fillText('+' + level, META.levelX, y + 20);

    // Cost
    ctx.fillStyle = canAfford ? '#aaffaa' : '#666';
    ctx.font = '14px monospace';
    ctx.fillText('\u25c6 ' + cost + ' to upgrade', META.costX, y + 20);

    // BUY button
    const bx = META.buyX;
    const by = y;
    ctx.fillStyle = canAfford ? '#1a2e1a' : '#111';
    ctx.fillRect(bx, by, META.buyW, META.buyH);

    ctx.strokeStyle = canAfford ? '#4ade80' : '#333';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, META.buyW, META.buyH);

    ctx.fillStyle = canAfford ? '#4ade80' : '#444';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUY', bx + META.buyW / 2, by + 21);
}

// Draw the GENERAL tab section — one row per general upgrade
function drawMetaGeneralSection() {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('General upgrades — apply to every run', META.labelX, META.sectionY);

    for (let i = 0; i < GENERAL_UPGRADES.length; i++) {
        const upgrade = GENERAL_UPGRADES[i];
        const level   = getGeneralUpgradeLevel(upgrade.key);
        const atMax   = level >= upgrade.maxLevel;
        const cost    = atMax ? 0 : upgrade.costs[level];
        const canAfford = !atMax && state.meta.soulShards >= cost;
        const y       = META.rowStartY + i * META.rowStep;

        drawMetaGeneralRow(upgrade, level, cost, canAfford, atMax, y);
    }
}

// Draw a single general upgrade row
function drawMetaGeneralRow(upgrade, level, cost, canAfford, atMax, y) {
    // Upgrade label and description
    ctx.fillStyle = '#cccccc';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(upgrade.label, META.labelX, y + 20);

    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText(upgrade.desc, META.labelX, y + 36);

    // Current effect
    ctx.fillStyle = level > 0 ? '#a855f7' : '#444';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(upgrade.effectLabel(level), META.levelX + 20, y + 20);

    // Level indicator
    ctx.fillStyle = '#555';
    ctx.font = '11px monospace';
    ctx.fillText('Lv ' + level + ' / ' + upgrade.maxLevel, META.levelX + 20, y + 35);

    // Cost
    if (!atMax) {
        ctx.fillStyle = canAfford ? '#aaffaa' : '#666';
        ctx.font = '14px monospace';
        ctx.fillText('\u25c6 ' + cost + ' to upgrade', META.costX, y + 20);
    }

    // BUY / MAX button
    const bx = META.buyX;
    ctx.fillStyle   = atMax ? '#0a1a0a' : canAfford ? '#1a2e1a' : '#111';
    ctx.fillRect(bx, y, META.buyW, META.buyH);
    ctx.strokeStyle = atMax ? '#444' : canAfford ? '#4ade80' : '#333';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, y, META.buyW, META.buyH);
    ctx.fillStyle   = atMax ? '#444' : canAfford ? '#4ade80' : '#444';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(atMax ? 'MAX' : 'BUY', bx + META.buyW / 2, y + 21);
}

// Start New Run button at the bottom
function drawMetaNewRunButton() {
    const b = { x: META.newRunBtnX, y: META.newRunBtnY, w: META.newRunBtnW, h: META.newRunBtnH };

    ctx.fillStyle = '#1a1400';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START NEW RUN', b.x + b.w / 2, b.y + 33);
}

// ─── Click handling ────────────────────────────────────────────────────────────

// Handle all clicks on the meta screen — returns 'newRun' if the player is done
function handleMetaClick(x, y) {
    // Class tab clicks
    const discovered = state.meta.discoveredClasses;
    for (let i = 0; i < discovered.length; i++) {
        const tx = META.tabStartX + i * (META.tabW + 8);
        if (x >= tx && x <= tx + META.tabW && y >= META.tabY && y <= META.tabY + META.tabH) {
            metaSelectedClass = discovered[i];
            return null;
        }
    }

    // GENERAL tab click
    const gx = 1200 - META.tabW - META.tabStartX;
    if (x >= gx && x <= gx + META.tabW && y >= META.tabY && y <= META.tabY + META.tabH) {
        metaSelectedClass = 'general';
        return null;
    }

    // BUY button clicks — class upgrades
    if (metaSelectedClass !== 'general') {
        for (let i = 0; i < META_STATS.length; i++) {
            const stat = META_STATS[i];
            const by   = META.rowStartY + i * META.rowStep;
            if (x >= META.buyX && x <= META.buyX + META.buyW && y >= by && y <= by + META.buyH) {
                purchaseUpgrade(metaSelectedClass, stat);
                return null;
            }
        }
    }

    // BUY button clicks — general upgrades
    if (metaSelectedClass === 'general') {
        for (let i = 0; i < GENERAL_UPGRADES.length; i++) {
            const by = META.rowStartY + i * META.rowStep;
            if (x >= META.buyX && x <= META.buyX + META.buyW && y >= by && y <= by + META.buyH) {
                purchaseGeneralUpgrade(GENERAL_UPGRADES[i].key);
                return null;
            }
        }
    }

    // Start New Run button
    const b = { x: META.newRunBtnX, y: META.newRunBtnY, w: META.newRunBtnW, h: META.newRunBtnH };
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return 'newRun';
    }

    return null;
}
