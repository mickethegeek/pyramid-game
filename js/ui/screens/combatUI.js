// Combat screen — avatar-based layout: party left, enemies right (1200×640)

// ─── Layout constants ──────────────────────────────────────────────────────────

const COMBAT_LAYOUT = {
    // Single ground level — row is shown by horizontal position, not depth
    groundY: 375,

    // Party zone (left half): back row on the left, front row on the right
    partyZoneX:   0,
    partyZoneW:   595,
    partyRowDivX: 298,   // vertical split within party zone

    // Enemy zone (right half): front row on the left (close to party), back row on the right
    enemyZoneX:   605,
    enemyZoneW:   595,
    enemyRowDivX: 903,   // vertical split within enemy zone (605 + 298)

    // Vertical divider between party and enemy sides
    dividerX: 600,

    // Combat log
    logX:     10,
    logY:    435,
    logW:   1180,
    logLineH: 22,

    // 6 action buttons: ATTACK | SHIELD | ITEM | SWITCH ROW | base skill | slot-2 skill
    // btnW=130, gap=12 → total 840px, starts at (1200-840)/2 = 180
    btnY:  520,
    btnW:  130,
    btnH:   50,
    btn0X: 180,   // ATTACK
    btn1X: 322,   // SHIELD
    btn2X: 464,   // ITEM
    btn3X: 606,   // SWITCH ROW
    btn4X: 748,   // base skill  (gold border)
    btn5X: 890,   // slot-2 skill (blue border)
};

// ─── Item overlay state ────────────────────────────────────────────────────────

// Whether the potion selection panel is currently open
let combatItemOverlay  = false;

// Potion key waiting for an enemy target click (throwable non-AoE only)
let combatItemSelected = null;

// How many entries the player has scrolled UP from the bottom of the combat log (0 = latest)
let combatLogScroll = 0;

// Accumulated raw wheel delta — scroll only triggers when enough movement builds up
let combatLogScrollAccum = 0;

// Clickable rect of the active party member's row-switch button — set each frame, used for clicks
let combatMoveBtn = null;
let combatMoveVisible = false;  // show MOVE button only after clicking the active character
let combatSwapMode    = false;  // waiting for player to pick a swap target
let combatLastActor   = null;   // tracks actor changes to auto-reset move/swap state

// Skill key waiting for the player to click a valid target (single-target skills only)
let pendingSkill = null;

// True when an archer is in multi-arrow mode (Volley L2 or Eclipse) — used for targeting rings
let pendingMultiArrow = false;

// True when Radiant Word has fired its enemy hit and is awaiting an ally heal-target click
let pendingRadiantWord = false;

// Reset overlay state at the start of each new combat encounter
function resetCombatUIState() {
    combatItemOverlay    = false;
    combatItemSelected   = null;
    pendingSkill         = null;
    pendingMultiArrow    = false;
    combatLogScroll      = 0;
    combatLogScrollAccum = 0;
    combatMoveBtn        = null;
    combatMoveVisible    = false;
    combatSwapMode       = false;
    combatLastActor      = null;
    pendingRadiantWord   = false;
    // Clear any lingering multi-arrow or radiant word state on party members
    if (state.party) {
        for (const m of state.party) {
            m.volleyArrowsLeft      = 0;
            m.eclipseArrowsLeft     = 0;
            m.eclipseTargets        = [];
            m.radiantWordHealPending = false;
            m.radiantWordTarget      = null;
            m.radiantWordLevel       = null;
        }
    }
}

// Accepts raw wheel deltaY. Accumulates until threshold is crossed so trackpad gestures
// don't fire on every tiny movement — requires ~100px of movement per scroll step.
function handleCombatLogScroll(deltaY) {
    if (!state.combat) return;
    combatLogScrollAccum += deltaY;
    const threshold = 40;
    if (Math.abs(combatLogScrollAccum) < threshold) return;

    // Negative deltaY = wheel/swipe up = see older messages (increase offset)
    const dir           = combatLogScrollAccum < 0 ? 1 : -1;
    combatLogScrollAccum = 0;

    const visibleCount = 4;
    const maxScroll    = Math.max(0, state.combat.log.length - visibleCount);
    combatLogScroll    = Math.max(0, Math.min(combatLogScroll + dir, maxScroll));
}

// Heights from feet (groundY) to the very top of each avatar style
const PARTY_AVATAR_HEIGHTS = { fighter: 95, caster: 130, archer: 90 };
const ENEMY_AVATAR_HEIGHTS = { goblin: 80, skeleton: 100, mage: 130, brute: 100, boss: 160 };

// Column layout: ground-level Y range for stacked characters within each row half
const COLUMN_GROUND_TOP = 240;   // feet Y for the topmost character
const COLUMN_GROUND_BOT = 375;   // feet Y for the bottommost character

// ─── Main draw entry point ─────────────────────────────────────────────────────

// Draw the full combat screen for the current combat state
function drawCombatScreen(combat) {
    drawCombatBackground();
    drawCombatHeader(combat);
    drawCombatDivider();
    drawRowDividers();
    drawPartyAvatars(combat);
    drawEnemyAvatars(combat);
    drawCombatLog(combat.log);
    drawAggroPanel(combat);
    drawActionArea(combat);
    // Overlay draws on top of everything
    if (combatItemOverlay) drawCombatItemOverlay(combat);
}

// ─── Background & header ───────────────────────────────────────────────────────

// Fill the canvas with a dark stone background
function drawCombatBackground() {
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, 1200, 640);
}

// Draw the top header bar: title, enemy count, and whose turn it is
function drawCombatHeader(combat) {
    ctx.fillStyle = '#1e1a16';
    ctx.fillRect(0, 0, 1200, 70);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(1200, 70);
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('COMBAT', 20, 44);

    // Alive enemy count centred
    const alive = combat.enemies.filter(e => e.isAlive()).length;
    const total = combat.enemies.length;
    ctx.fillStyle = '#666';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(alive + ' / ' + total + ' enemies remaining', 600, 44);

    // Turn indicator on the right
    ctx.textAlign = 'right';
    if (combat.phase === 'player_turn') {
        const actor = getCurrentActor(combat);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(actor.name.toUpperCase() + "'S TURN", 1180, 44);
    } else if (combat.phase === 'enemy_turn') {
        const actor = getCurrentActor(combat);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(actor.name.toUpperCase() + "'S TURN", 1180, 44);
    } else if (combat.phase === 'victory') {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('VICTORY!', 1180, 44);
    } else if (combat.phase === 'defeat') {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('DEFEATED', 1180, 44);
    }
}

// Draw the thin vertical divider between party and enemy zones
function drawCombatDivider() {
    const L = COMBAT_LAYOUT;
    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.dividerX, 75);
    ctx.lineTo(L.dividerX, L.groundY + 55);
    ctx.stroke();
}

// Draw vertical dashed row-dividers inside both the party zone and the enemy zone,
// with BACK / FRONT zone labels so the layout reads at a glance.
function drawRowDividers() {
    const L = COMBAT_LAYOUT;

    ctx.save();
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);

    // Party zone divider (back | front)
    ctx.beginPath();
    ctx.moveTo(L.partyRowDivX, 75);
    ctx.lineTo(L.partyRowDivX, L.groundY + 50);
    ctx.stroke();

    // Enemy zone divider (front | back)
    ctx.beginPath();
    ctx.moveTo(L.enemyRowDivX, 75);
    ctx.lineTo(L.enemyRowDivX, L.groundY + 50);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    ctx.font      = 'bold 9px monospace';
    ctx.textAlign = 'center';

    // Party zone labels
    ctx.fillStyle = '#2e2a24';
    ctx.fillText('BACK',  (L.partyZoneX + L.partyRowDivX) / 2,        88);
    ctx.fillText('FRONT', (L.partyRowDivX + L.partyZoneX + L.partyZoneW) / 2, 88);

    // Enemy zone labels
    ctx.fillText('FRONT', (L.enemyZoneX + L.enemyRowDivX) / 2,        88);
    ctx.fillText('BACK',  (L.enemyRowDivX + L.enemyZoneX + L.enemyZoneW) / 2, 88);
}

// ─── Party avatars (left zone) ─────────────────────────────────────────────────

// Compute the centre X for a party member — all in the same row share one column centre.
// Back row = left half, front row = right half.
function getPartyCX(member, L) {
    if (member.row === 'back') return Math.round((L.partyZoneX + L.partyRowDivX) / 2);
    return Math.round((L.partyRowDivX + L.partyZoneX + L.partyZoneW) / 2);
}

// Compute the ground-level Y for a party member — members are stacked vertically within their column.
function getPartyCY(member, party) {
    const col   = party.filter(m => m.row === member.row);
    const idx   = col.indexOf(member);
    const count = col.length;
    const midY  = Math.round((COLUMN_GROUND_TOP + COLUMN_GROUND_BOT) / 2);
    if (count === 1) return midY;
    const spacing = Math.min(80, (COLUMN_GROUND_BOT - COLUMN_GROUND_TOP) / (count - 1));
    const totalH  = (count - 1) * spacing;
    return Math.round(midY - totalH / 2 + idx * spacing);
}

// Draw one avatar slot per party member — back row on the left, front row on the right, stacked vertically.
function drawPartyAvatars(combat) {
    const L     = COMBAT_LAYOUT;
    const party = combat.party;
    const actor = getCurrentActor(combat);

    // Auto-reset move/swap UI when the acting combatant changes
    if (actor !== combatLastActor) {
        combatMoveVisible = false;
        combatSwapMode    = false;
        combatLastActor   = actor;
    }

    for (const member of party) {
        const cx       = getPartyCX(member, L);
        const cy       = getPartyCY(member, party);
        const isActive = (member === actor && combat.phase === 'player_turn');
        drawPartySlot(member, cx, cy, isActive);
    }

    if (combat.phase === 'player_turn') {
        // Swap mode: highlight eligible targets in the opposite row with a cyan ring
        if (combatSwapMode) {
            const dest = actor.row === 'front' ? 'back' : 'front';
            for (const member of party) {
                if (member.isAlive() && member.row === dest) {
                    const cx = getPartyCX(member, L);
                    const cy = getPartyCY(member, party);
                    ctx.save();
                    ctx.strokeStyle = '#06b6d4';
                    ctx.lineWidth   = 2;
                    ctx.globalAlpha = 0.7;
                    ctx.strokeRect(cx - 36, cy - 112, 72, 122);
                    ctx.restore();
                }
            }
        }

        // Radiant Word heal-target mode: draw green rings on all living allies
        if (actor.radiantWordHealPending) {
            for (const member of party) {
                if (!member.isAlive()) continue;
                const cx = getPartyCX(member, L);
                const cy = getPartyCY(member, party);
                ctx.save();
                ctx.strokeStyle = '#86efac';
                ctx.lineWidth   = 2;
                ctx.globalAlpha = 0.8;
                ctx.strokeRect(cx - 36, cy - 112, 72, 122);
                ctx.restore();
            }
        }
        // MOVE button only when player has clicked the active character
        if (combatMoveVisible) {
            const cx = getPartyCX(actor, L);
            const cy = getPartyCY(actor, party);
            drawRowMoveButton(actor, cx, cy);
        } else {
            combatMoveBtn = null;
        }
    } else {
        combatMoveBtn = null;
    }
}

// Draw one party member — avatar figure + HP/mana labels
function drawPartySlot(member, cx, groundY, isActive) {
    if (isActive) drawActiveGlow(cx, groundY, '#ffd700');

    const style   = getPartyAvatarStyle(member.name);
    const color   = getPartyAvatarColor(member.name);
    const avatarH = PARTY_AVATAR_HEIGHTS[style];

    ctx.save();
    if (!member.isAlive()) ctx.globalAlpha = 0.3;

    if      (style === 'caster') drawCasterFigure(cx, groundY, color);
    else if (style === 'archer') drawArcherFigure(cx, groundY, color);
    else                         drawFighterFigure(cx, groundY, color);

    ctx.restore();

    if (!member.isAlive()) {
        drawDeadOverlay(cx, groundY, avatarH);
    } else if (isActive) {
        drawActiveArrow(cx, groundY - avatarH - 18, '#ffd700');
    }

    drawAvatarLabels(member, cx, groundY, true);
}

// Draw the row-switch button just above the active party member's avatar head.
// Arrow points toward the destination half: ← BACK or → FRONT.
// Updates combatMoveBtn each frame so handleCombatClick can detect the hit area.
function drawRowMoveButton(member, cx, cy) {
    const style   = getPartyAvatarStyle(member.name);
    const avatarH = PARTY_AVATAR_HEIGHTS[style];
    const label   = member.row === 'front' ? '\u2190 BACK' : '\u2192 FRONT';
    const btnW  = 74;
    const btnH  = 20;
    const btnX  = Math.round(cx - btnW / 2);
    const btnY  = cy - avatarH - 26;   // just above the avatar head

    combatMoveBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    const hovered = mouseX >= btnX && mouseX <= btnX + btnW
                 && mouseY >= btnY && mouseY <= btnY + btnH;

    ctx.fillStyle   = hovered ? '#2e2820' : '#1c1814';
    ctx.strokeStyle = hovered ? '#6a5030' : '#3a3020';
    ctx.lineWidth   = 1;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = hovered ? '#d4a040' : '#6a5030';
    ctx.font      = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, btnY + 14);
}

// Return the party member under a click — left half = back row, right half = front row,
// then pick which member based on Y position within that column.
function getPartyMemberAtClick(x, y, party, L) {
    if (x < L.partyZoneX || x >= L.partyZoneX + L.partyZoneW) return null;
    const col = party.filter(m => m.row === (x < L.partyRowDivX ? 'back' : 'front'));
    if (!col.length) return null;
    // Divide the column zone into equal Y slots and pick the member whose slot contains y
    const zoneTop = COLUMN_GROUND_TOP - 140;
    const zoneBot = COLUMN_GROUND_BOT + 50;
    const clamped = Math.max(zoneTop, Math.min(zoneBot - 1, y));
    const slotH   = (zoneBot - zoneTop) / col.length;
    const idx     = Math.max(0, Math.min(col.length - 1, Math.floor((clamped - zoneTop) / slotH)));
    return col[idx];
}

// ─── Enemy avatars (right zone) ───────────────────────────────────────────────

// Compute the centre X for an enemy — all in same row share one column centre.
// Front row = left half of enemy zone (closest to party), back row = right half.
// If all enemies are in one row, they share the full zone centre.
function getEnemyCX(enemy, enemies, L) {
    const mixed = enemies.some(e => e.row === 'front') && enemies.some(e => e.row === 'back');
    if (!mixed) return Math.round(L.enemyZoneX + L.enemyZoneW / 2);
    if (enemy.row === 'front') return Math.round((L.enemyZoneX + L.enemyRowDivX) / 2);
    return Math.round((L.enemyRowDivX + L.enemyZoneX + L.enemyZoneW) / 2);
}

// Compute the ground-level Y for an enemy — enemies are stacked vertically within their column.
function getEnemyCY(enemy, enemies) {
    const mixed = enemies.some(e => e.row === 'front') && enemies.some(e => e.row === 'back');
    const col   = mixed ? enemies.filter(e => e.row === enemy.row) : enemies;
    const idx   = col.indexOf(enemy);
    const count = col.length;
    const midY  = Math.round((COLUMN_GROUND_TOP + COLUMN_GROUND_BOT) / 2);
    if (count === 1) return midY;
    const spacing = Math.min(80, (COLUMN_GROUND_BOT - COLUMN_GROUND_TOP) / (count - 1));
    const totalH  = (count - 1) * spacing;
    return Math.round(midY - totalH / 2 + idx * spacing);
}

// Return the alive enemy under a click, using Y-based column detection.
function getEnemyAtClick(x, y, enemies, L) {
    const alive = enemies.filter(e => e.isAlive());
    if (!alive.length) return null;
    if (x < L.enemyZoneX || x >= L.enemyZoneX + L.enemyZoneW) return null;

    const mixed = alive.some(e => e.row === 'front') && alive.some(e => e.row === 'back');
    let col;
    if (!mixed) {
        col = alive;
    } else if (x < L.enemyRowDivX) {
        col = alive.filter(e => e.row === 'front');
    } else {
        col = alive.filter(e => e.row === 'back');
    }
    if (!col.length) return null;

    const zoneTop = COLUMN_GROUND_TOP - 160;
    const zoneBot = COLUMN_GROUND_BOT + 50;
    const clamped = Math.max(zoneTop, Math.min(zoneBot - 1, y));
    const slotH   = (zoneBot - zoneTop) / col.length;
    const idx     = Math.max(0, Math.min(col.length - 1, Math.floor((clamped - zoneTop) / slotH)));
    return col[idx];
}

// Draw one avatar slot per enemy — front row on the left (closest to party), back row on the right, stacked vertically.
function drawEnemyAvatars(combat) {
    const L       = COMBAT_LAYOUT;
    const enemies = combat.enemies;
    const actor   = getCurrentActor(combat);

    for (const enemy of enemies) {
        const cx         = getEnemyCX(enemy, enemies, L);
        const cy         = getEnemyCY(enemy, enemies);
        const isActive   = (enemy === actor && combat.phase === 'enemy_turn');
        const isSelected = (enemy === combat.selectedTarget);
        drawEnemySlot(enemy, cx, cy, isActive, isSelected);
        if (combat.phase === 'player_turn' && enemy.isAlive() && enemy.intendedAction) {
            drawEnemyTelegraph(enemy, cx, cy);
        }
    }
}

// Draw one enemy — avatar figure + HP label
// isSelected: true when the player has clicked this enemy as their attack target
function drawEnemySlot(enemy, cx, groundY, isActive, isSelected) {
    if (isActive)   drawActiveGlow(cx, groundY, '#ef4444');
    if (isSelected) drawTargetRing(cx, groundY, getEnemyAvatarStyle(enemy.name));
    // Green ring when player is aiming a throwable potion, a single-target skill, or a multi-arrow
    if ((combatItemSelected || pendingSkill || pendingMultiArrow) && enemy.isAlive()) drawThrowableTargetRing(cx, groundY, getEnemyAvatarStyle(enemy.name));

    const style   = getEnemyAvatarStyle(enemy.name);
    const color   = getEnemyAvatarColor(enemy.name);
    const avatarH = ENEMY_AVATAR_HEIGHTS[style];

    ctx.save();
    if (!enemy.isAlive()) ctx.globalAlpha = 0.3;

    if      (style === 'goblin')   drawGoblinFigure(cx, groundY, color);
    else if (style === 'skeleton') drawSkeletonFigure(cx, groundY, color);
    else if (style === 'mage')     drawCasterFigure(cx, groundY, color);
    else if (style === 'boss')     drawBossFigure(cx, groundY, color);
    else                           drawBruteFigure(cx, groundY, color);

    ctx.restore();

    if (!enemy.isAlive()) {
        drawDeadOverlay(cx, groundY, avatarH);
    } else if (isActive) {
        drawActiveArrow(cx, groundY - avatarH - 18, '#ef4444');
    }

    drawAvatarLabels(enemy, cx, groundY, false);
}

// ─── Avatar figure drawing functions ──────────────────────────────────────────

// Fighter figure — warrior / barbarian / paladin: armored, wide shoulders, shield
function drawFighterFigure(cx, gy, color) {
    const dark = shadeColor(color, -50);

    // Legs
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 11, gy - 28, 9, 28);
    ctx.fillRect(cx + 2,  gy - 28, 9, 28);

    // Body — trapezoid, wider at shoulders
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 20, gy - 66);
    ctx.lineTo(cx + 20, gy - 66);
    ctx.lineTo(cx + 10, gy - 28);
    ctx.lineTo(cx - 10, gy - 28);
    ctx.closePath();
    ctx.fill();

    // Shield on left
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 30, gy - 62, 8, 22);
    ctx.strokeStyle = shadeColor(color, 20);
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 30, gy - 62, 8, 22);

    // Sword on right (vertical line + crossguard)
    ctx.strokeStyle = '#c8c8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 28, gy - 30);
    ctx.lineTo(cx + 28, gy - 72);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 23, gy - 60);
    ctx.lineTo(cx + 33, gy - 60);
    ctx.stroke();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 80, 12, 0, Math.PI * 2);
    ctx.fill();

    // Helmet visor stripe
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 12, gy - 85, 24, 5);
}

// Caster figure — wizard / cleric / summoner: robes, staff, pointed hat
function drawCasterFigure(cx, gy, color) {
    const dark  = shadeColor(color, -50);
    const light = shadeColor(color, 40);

    // Robe — wide at base, narrow at waist
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 22, gy);
    ctx.lineTo(cx + 22, gy);
    ctx.lineTo(cx + 13, gy - 55);
    ctx.lineTo(cx - 13, gy - 55);
    ctx.closePath();
    ctx.fill();

    // Robe hem detail
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 22, gy - 6, 44, 6);

    // Upper body / chest
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 11, gy - 80, 22, 25);

    // Staff
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 20, gy - 10);
    ctx.lineTo(cx + 20, gy - 100);
    ctx.stroke();

    // Staff orb
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx + 20, gy - 103, 5, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 93, 12, 0, Math.PI * 2);
    ctx.fill();

    // Pointed hat
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(cx - 14, gy - 105);
    ctx.lineTo(cx + 14, gy - 105);
    ctx.lineTo(cx,      gy - 128);
    ctx.closePath();
    ctx.fill();
}

// Archer figure — slim, carries a bow on the right side
function drawArcherFigure(cx, gy, color) {
    const dark = shadeColor(color, -50);

    // Slim legs
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 8, gy - 26, 6, 26);
    ctx.fillRect(cx + 2, gy - 26, 6, 26);

    // Slim body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 12, gy - 62);
    ctx.lineTo(cx + 12, gy - 62);
    ctx.lineTo(cx + 7,  gy - 26);
    ctx.lineTo(cx - 7,  gy - 26);
    ctx.closePath();
    ctx.fill();

    // Bow (arc on the right)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + 24, gy - 48, 24, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#c8a86b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 24, gy - 24);
    ctx.lineTo(cx + 24, gy - 72);
    ctx.stroke();

    // Arrow nocked
    ctx.strokeStyle = '#c8a86b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, gy - 48);
    ctx.lineTo(cx + 20, gy - 48);
    ctx.stroke();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 76, 11, 0, Math.PI * 2);
    ctx.fill();
}

// Goblin figure — small, hunched, wide head, pointy ears
function drawGoblinFigure(cx, gy, color) {
    const dark = shadeColor(color, -40);

    // Short stubby legs
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 8, gy - 18, 6, 18);
    ctx.fillRect(cx + 2, gy - 18, 6, 18);

    // Hunched little body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 12, gy - 40);
    ctx.lineTo(cx + 12, gy - 40);
    ctx.lineTo(cx + 7,  gy - 18);
    ctx.lineTo(cx - 7,  gy - 18);
    ctx.closePath();
    ctx.fill();

    // Big head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 54, 14, 0, Math.PI * 2);
    ctx.fill();

    // Pointy ears
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(cx - 14, gy - 58);
    ctx.lineTo(cx - 22, gy - 76);
    ctx.lineTo(cx - 5,  gy - 62);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 14, gy - 58);
    ctx.lineTo(cx + 22, gy - 76);
    ctx.lineTo(cx + 5,  gy - 62);
    ctx.closePath();
    ctx.fill();

    // Glowing eyes
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(cx - 4, gy - 55, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, gy - 55, 2.5, 0, Math.PI * 2);
    ctx.fill();
}

// Skeleton figure — thin bony frame, skull head with hollow eyes
function drawSkeletonFigure(cx, gy, color) {
    // Thin leg bones
    ctx.fillStyle = color;
    ctx.fillRect(cx - 7, gy - 30, 4, 30);
    ctx.fillRect(cx + 3, gy - 30, 4, 30);

    // Ribcage torso
    ctx.fillRect(cx - 9, gy - 66, 18, 36);

    // Rib lines
    ctx.strokeStyle = '#0d0d0d';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 8, gy - 58 + i * 10);
        ctx.lineTo(cx + 8, gy - 58 + i * 10);
        ctx.stroke();
    }

    // Skull
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 78, 12, 0, Math.PI * 2);
    ctx.fill();

    // Jaw (bottom arc)
    ctx.fillStyle = shadeColor(color, -20);
    ctx.beginPath();
    ctx.arc(cx, gy - 74, 8, 0, Math.PI);
    ctx.fill();

    // Hollow eye sockets
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    ctx.arc(cx - 4, gy - 80, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, gy - 80, 3, 0, Math.PI * 2);
    ctx.fill();
}

// Brute figure — desert warrior / sphinx guard: wide armored form
function drawBruteFigure(cx, gy, color) {
    const dark = shadeColor(color, -50);

    // Wide armored legs
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 15, gy - 32, 12, 32);
    ctx.fillRect(cx + 3,  gy - 32, 12, 32);

    // Wide armored torso
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 25, gy - 74);
    ctx.lineTo(cx + 25, gy - 74);
    ctx.lineTo(cx + 14, gy - 32);
    ctx.lineTo(cx - 14, gy - 32);
    ctx.closePath();
    ctx.fill();

    // Shoulder pauldrons
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 35, gy - 80, 12, 14);
    ctx.fillRect(cx + 23, gy - 80, 12, 14);

    // Chest emblem
    ctx.fillStyle = shadeColor(color, 30);
    ctx.beginPath();
    ctx.arc(cx, gy - 56, 6, 0, Math.PI * 2);
    ctx.fill();

    // Head with helmet
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 88, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dark;
    ctx.fillRect(cx - 13, gy - 96, 26, 9);
}

// Boss figure — large, imposing form with crown
function drawBossFigure(cx, gy, color) {
    const dark  = shadeColor(color, -50);
    const light = shadeColor(color, 40);

    // Massive legs
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 22, gy - 44, 18, 44);
    ctx.fillRect(cx + 4,  gy - 44, 18, 44);

    // Massive torso
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 40, gy - 106);
    ctx.lineTo(cx + 40, gy - 106);
    ctx.lineTo(cx + 20, gy - 44);
    ctx.lineTo(cx - 20, gy - 44);
    ctx.closePath();
    ctx.fill();

    // Chest emblem
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(cx, gy - 78, 9, 0, Math.PI * 2);
    ctx.fill();

    // Wide shoulder pads
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 54, gy - 114, 16, 20);
    ctx.fillRect(cx + 38, gy - 114, 16, 20);

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, gy - 122, 17, 0, Math.PI * 2);
    ctx.fill();

    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(cx - 17, gy - 139);
    ctx.lineTo(cx - 10, gy - 152);
    ctx.lineTo(cx,      gy - 158);
    ctx.lineTo(cx + 10, gy - 152);
    ctx.lineTo(cx + 17, gy - 139);
    ctx.closePath();
    ctx.fill();
}

// ─── Active turn & dead indicators ────────────────────────────────────────────

// Draw a glowing ellipse at the combatant's feet to show it's their turn
function drawActiveGlow(cx, gy, color) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, gy, 32, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Draw a dashed gold rectangle around a targeted enemy
function drawTargetRing(cx, groundY, style) {
    const avatarH = ENEMY_AVATAR_HEIGHTS[style] || 100;
    const pad = 8;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(cx - 40, groundY - avatarH - pad, 80, avatarH + pad * 2);
    ctx.setLineDash([]);
}

// Draw a green dashed ring to highlight enemies as valid throwable targets
function drawThrowableTargetRing(cx, groundY, style) {
    const avatarH = ENEMY_AVATAR_HEIGHTS[style] || 100;
    const pad = 10;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cx - 42, groundY - avatarH - pad, 84, avatarH + pad * 2);
    ctx.setLineDash([]);
}

// Draw a downward arrow above the combatant's head to mark active turn
function drawActiveArrow(cx, arrowTip, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 9, arrowTip - 14);
    ctx.lineTo(cx + 9, arrowTip - 14);
    ctx.lineTo(cx,     arrowTip);
    ctx.closePath();
    ctx.fill();
}

// Draw a red X over a dead combatant
function drawDeadOverlay(cx, gy, avatarH) {
    const top  = gy - avatarH;
    const half = 24;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - half, top + 10);
    ctx.lineTo(cx + half, gy - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + half, top + 10);
    ctx.lineTo(cx - half, gy - 8);
    ctx.stroke();
    ctx.restore();
}

// ─── Enemy telegraph ───────────────────────────────────────────────────────────

// Draw a badge above an enemy showing what action they took last turn (visible during player turn)
function drawEnemyTelegraph(enemy, cx, groundY) {
    const action  = enemy.intendedAction;
    const style   = getEnemyAvatarStyle(enemy.name);
    const avatarH = ENEMY_AVATAR_HEIGHTS[style];

    // Color-code by action type
    const typeColors = {
        attack: '#ef4444',
        heal:   '#4ade80',
        buff:   '#ffd700',
        debuff: '#a855f7',
        summon: '#f97316',
    };
    const color = typeColors[action.type] || '#ffffff';

    const badgeW = 120;
    const badgeH = 32;
    const badgeX = cx - badgeW / 2;
    // Position above the top of the avatar with a small gap
    const badgeY = groundY - avatarH - 52;

    // Semi-transparent dark background
    ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    // Colored left-edge accent strip
    ctx.fillStyle = color;
    ctx.fillRect(badgeX, badgeY, 3, badgeH);

    // Action name
    ctx.fillStyle = color;
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(action.name, cx + 1, badgeY + 13);

    // Target name in gray
    ctx.fillStyle = '#888';
    ctx.font      = '10px monospace';
    ctx.fillText('\u2192 ' + action.targetName, cx + 1, badgeY + 26);
}

// ─── Aggro / Threat panel ──────────────────────────────────────────────────────

// Draw a compact threat panel showing all alive party members' aggro values.
// Positioned at the left of the combat log row. Highest-aggro member is highlighted red.
function drawAggroPanel(combat) {
    const aliveParty = combat.party.filter(m => m.isAlive());
    if (!aliveParty.length) return;

    // Sort highest → lowest aggro
    const sorted   = [...aliveParty].sort((a, b) => b.aggro - a.aggro);
    const topMember = sorted[0];

    const panX  = 10;
    const panY  = COMBAT_LAYOUT.logY - 22;   // aligned with the log box top
    const panW  = 160;
    const panH  = 98;                         // same height as the log box

    // Opaque background
    ctx.fillStyle = '#0e0c0a';
    ctx.fillRect(panX, panY, panW, panH);

    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1;
    ctx.strokeRect(panX, panY, panW, panH);

    // Title
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THREAT', panX + 8, panY + 14);

    // One row per alive party member (up to what fits in the panel)
    const rowH    = 12;
    const startY  = panY + 22;
    const maxRows = Math.floor((panH - 22) / rowH);
    const visible = sorted.slice(0, maxRows);

    for (let i = 0; i < visible.length; i++) {
        const member = visible[i];
        const isTop  = (member === topMember);
        const rowY   = startY + i * rowH + rowH - 2;   // baseline for this row

        ctx.fillStyle = isTop ? '#ef4444' : '#999';
        ctx.font      = '10px monospace';

        // Name (truncate to 9 chars to fit)
        const name = member.name.length > 9 ? member.name.slice(0, 9) : member.name;
        ctx.textAlign = 'left';
        ctx.fillText(name, panX + 8, rowY);

        // Aggro value right-aligned
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(member.aggro), panX + panW - 8, rowY);

        // Small triangle marker on the highest-aggro member
        if (isTop) {
            ctx.fillText('\u25c4', panX + panW - 22, rowY);
        }
    }
}

// ─── Avatar info labels ────────────────────────────────────────────────────────

// Draw HP bar, name, and optional mana bar below the avatar's feet
function drawAvatarLabels(combatant, cx, groundY, isParty) {
    const barW = 80;
    const barH = 9;
    const barX = cx - barW / 2;
    const barY = groundY + 5;

    // HP bar
    drawHPBar(combatant, barX, barY, barW, barH);

    // Name
    ctx.fillStyle = combatant.isAlive() ? '#ccc' : '#555';
    ctx.font      = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(combatant.name, cx, groundY + 24);

    // Mana bar (party only)
    if (isParty && combatant.getMaxMana && combatant.getMaxMana() > 0) {
        const manaBarW = 50;
        const manaBarH = 6;
        const manaBarX = cx - manaBarW / 2;
        const manaBarY = groundY + 29;
        const pct      = combatant.currentMana / combatant.getMaxMana();

        ctx.fillStyle = '#000033';
        ctx.fillRect(manaBarX, manaBarY, manaBarW, manaBarH);

        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(manaBarX, manaBarY, Math.floor(manaBarW * pct), manaBarH);

        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth   = 1;
        ctx.strokeRect(manaBarX, manaBarY, manaBarW, manaBarH);
    }
}

// ─── Style & colour lookups ────────────────────────────────────────────────────

// Return the avatar style key for a party member based on class name
function getPartyAvatarStyle(name) {
    const n = name.toLowerCase();
    if (n.includes('wizard') || n.includes('cleric') || n.includes('summoner')) return 'caster';
    if (n.includes('archer')) return 'archer';
    return 'fighter';
}

// Return the primary fill colour for a party member
function getPartyAvatarColor(name) {
    const n = name.toLowerCase();
    if (n.includes('warrior'))   return '#c2855b';
    if (n.includes('barbarian')) return '#ef4444';
    if (n.includes('cleric'))    return '#ffd700';
    if (n.includes('archer'))    return '#22c55e';
    if (n.includes('wizard'))    return '#a855f7';
    if (n.includes('paladin'))   return '#3b82f6';
    if (n.includes('summoner'))  return '#f97316';
    return '#c2855b';
}

// Return the avatar style key for an enemy based on name
function getEnemyAvatarStyle(name) {
    const n = name.toLowerCase();
    if (n.includes('goblin'))   return 'goblin';
    if (n.includes('skeleton')) return 'skeleton';
    if (n.includes('mage'))     return 'mage';
    if (n.includes('pharaoh') || n.includes('colossus') || n.includes('apex')) return 'boss';
    return 'brute';   // desert warrior, sphinx guard
}

// Return the primary fill colour for an enemy
// More specific names must be checked before generic substrings (e.g. 'pharaoh' before 'sand')
function getEnemyAvatarColor(name) {
    const n = name.toLowerCase();
    if (n.includes('goblin'))   return '#3a7a32';
    if (n.includes('skeleton')) return '#8ca0a8';
    if (n.includes('pharaoh'))  return '#c2855b';   // before 'sand'
    if (n.includes('colossus')) return '#6b7280';
    if (n.includes('apex'))     return '#9f1239';
    if (n.includes('desert'))   return '#78350f';
    if (n.includes('sand'))     return '#92400e';   // Sand Mage (after Sand Pharaoh)
    if (n.includes('sphinx'))   return '#4b5563';
    return '#555555';
}

// Lighten or darken a hex color — negative amount darkens, positive lightens
function shadeColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = Math.min(255, Math.max(0, (num >> 16)         + amount));
    const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b   = Math.min(255, Math.max(0, (num & 0xff)        + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─── HP bar ───────────────────────────────────────────────────────────────────

// Draw a health bar — green → yellow → red as HP drops
function drawHPBar(combatant, x, y, w, h) {
    const pct = combatant.currentHP / combatant.getMaxHP();

    ctx.fillStyle = '#3a0000';
    ctx.fillRect(x, y, w, h);

    if      (pct > 0.50) ctx.fillStyle = '#22c55e';
    else if (pct > 0.25) ctx.fillStyle = '#eab308';
    else                 ctx.fillStyle = '#ef4444';

    ctx.fillRect(x, y, Math.floor(w * pct), h);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);
}

// ─── Combat log ───────────────────────────────────────────────────────────────

// Draw the combat log. Supports scrolling through full history via combatLogScroll.
// The leftmost 165px is reserved for the aggro panel — log box starts at logX+165.
function drawCombatLog(log) {
    const L      = COMBAT_LAYOUT;
    const boxH   = 98;
    const boxY   = L.logY - 22;
    // Log box starts immediately after the aggro panel (165px wide at x=10)
    const logX   = L.logX + 165;
    const logW   = L.logW - 165;

    ctx.fillStyle = '#1a1614';
    ctx.fillRect(logX, boxY, logW, boxH);

    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1;
    ctx.strokeRect(logX, boxY, logW, boxH);

    // Determine which 4 messages to show based on scroll offset
    const visibleCount = 4;
    const maxScroll    = Math.max(0, log.length - visibleCount);
    const scroll       = Math.min(combatLogScroll, maxScroll);
    const end          = log.length - scroll;
    const start        = Math.max(0, end - visibleCount);
    const visible      = log.slice(start, end);

    ctx.font      = '14px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i < visible.length; i++) {
        // Older messages fade out more; newest message is fully opaque
        const alpha = 0.4 + ((i + 1) / visibleCount) * 0.6;
        ctx.fillStyle = scroll > 0
            ? 'rgba(220, 220, 200, 0.85)'   // uniform opacity when scrolled (all are "history")
            : 'rgba(220, 220, 200, ' + alpha + ')';
        ctx.fillText(visible[i], logX + 10, L.logY + i * L.logLineH);
    }

    // Scroll indicators — shown only when there is history to navigate
    if (maxScroll > 0) {
        ctx.font      = '11px monospace';
        ctx.textAlign = 'right';
        // Up arrow: more messages above
        ctx.fillStyle = scroll < maxScroll ? '#666' : '#2a2a2a';
        ctx.fillText('\u25b2', logX + logW - 8, boxY + 14);
        // Down arrow: more messages below
        ctx.fillStyle = scroll > 0 ? '#666' : '#2a2a2a';
        ctx.fillText('\u25bc', logX + logW - 8, boxY + boxH - 5);
        // Position indicator
        if (scroll > 0) {
            ctx.fillStyle = '#444';
            ctx.font      = '10px monospace';
            ctx.fillText((scroll) + ' older', logX + logW - 22, boxY + boxH - 5);
        }
    }
}

// ─── Action area ──────────────────────────────────────────────────────────────

// Draw buttons appropriate to the current combat phase
function drawActionArea(combat) {
    if (combat.phase === 'player_turn') {
        drawPlayerButtons(combat);
    } else if (combat.phase === 'victory') {
        drawContinueButton();
    }
    // enemy_turn and defeat show nothing — waiting on AI or transition
}

// Draw all 6 action buttons for the currently-acting party member
function drawPlayerButtons(combat) {
    const L     = COMBAT_LAYOUT;
    const actor = getCurrentActor(combat);

    // ── Radiant Word ally-select mode — show heal target banner ──────────────
    pendingRadiantWord = !!actor.radiantWordHealPending;
    if (pendingRadiantWord) {
        ctx.fillStyle = '#86efac';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RADIANT WORD — click an ally to heal', 600, L.btnY + 24);
        ctx.fillStyle = '#666';
        ctx.font      = '12px monospace';
        ctx.fillText('Click anywhere else to cancel', 600, L.btnY + 45);
        return;
    }

    // ── Multi-arrow mode (Volley L2 / Eclipse) — show arrow counter banner ──────
    pendingMultiArrow = actor.volleyArrowsLeft > 0 || actor.eclipseArrowsLeft > 0;
    if (pendingMultiArrow) {
        const arrowsLeft = actor.volleyArrowsLeft > 0 ? actor.volleyArrowsLeft : actor.eclipseArrowsLeft;
        const skillLabel = actor.volleyArrowsLeft > 0 ? 'VOLLEY' : 'ECLIPSE';
        ctx.fillStyle = '#f97316';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(skillLabel + ' — click an enemy to fire (' + arrowsLeft + ' arrow' + (arrowsLeft !== 1 ? 's' : '') + ' remaining)', 600, L.btnY + 24);
        return;
    }

    // ── Skill targeting mode — show instruction banner instead of buttons ─────
    if (pendingSkill) {
        const skillDef  = SKILL_DATA && SKILL_DATA[pendingSkill];
        const level     = skillDef ? (actor.skillLevels[pendingSkill] || 1) : 1;
        const skillName = skillDef ? skillDef.levels[level].name : pendingSkill;
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELECT TARGET — click an enemy to use ' + skillName, 600, L.btnY + 24);
        ctx.fillStyle = '#666';
        ctx.font      = '12px monospace';
        ctx.fillText('Click anywhere else to cancel', 600, L.btnY + 45);
        return;
    }

    // ── Potion targeting mode — show instruction banner instead of buttons ────
    if (combatItemSelected) {
        const potionName = POTION_DATA[combatItemSelected] ? POTION_DATA[combatItemSelected].name : 'Potion';
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELECT TARGET — click an enemy to throw ' + potionName, 600, L.btnY + 24);
        ctx.fillStyle = '#666';
        ctx.font      = '12px monospace';
        ctx.fillText('Click anywhere else to cancel', 600, L.btnY + 45);
        return;
    }

    // ── Header label ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#4ade80';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(actor.name.toUpperCase() + ' — choose action:', 600, L.btnY - 10);

    // ── Fixed buttons: ATTACK, SHIELD, ITEM ──────────────────────────────────
    drawActionButton(L.btn0X, L.btnY, L.btnW, L.btnH, 'ATTACK', null, false);
    drawActionButton(L.btn1X, L.btnY, L.btnW, L.btnH, 'SHIELD', null, false);

    const hasItems = state.partyPotions.length > 0;
    drawActionButton(L.btn2X, L.btnY, L.btnW, L.btnH, 'ITEM' + (hasItems ? ' (' + state.partyPotions.length + ')' : ''), null, !hasItems);

    // ── Btn3: STANCE for Warrior, SWITCH ROW for everyone else ───────────────
    if (actor.classKey === 'warrior') {
        const stanceLabel = actor.stance === 'battle' ? 'GUARD STANCE' : 'BATTLE STANCE';
        const stanceColor = actor.stance === 'battle' ? '#60a5fa' : '#f97316';
        drawActionButton(L.btn3X, L.btnY, L.btnW, L.btnH, stanceLabel, stanceColor, false);
    } else {
        const rowLabel = actor.row === 'front' ? '\u2190 BACK' : '\u2192 FRONT';
        drawActionButton(L.btn3X, L.btnY, L.btnW, L.btnH, rowLabel, null, false);
    }

    // ── Skill buttons: base skill (gold) + slot-2 skill (blue) ───────────────
    const slot2Key = actor.equippedSkills && actor.equippedSkills[0];
    drawSkillButton(L.btn4X, L.btnY, L.btnW, L.btnH, actor.baseSkill, actor, '#ffd700');
    drawSkillButton(L.btn5X, L.btnY, L.btnW, L.btnH, slot2Key || null, actor, '#3b82f6');

    // ── Tooltips (drawn last so they sit on top) ──────────────────────────────
    const hoverBtn = (bx) => mouseX >= bx && mouseX <= bx + L.btnW && mouseY >= L.btnY && mouseY <= L.btnY + L.btnH;

    if (hoverBtn(L.btn0X)) drawAttackTooltip(actor, L.btn0X, L.btnW);
    if (hoverBtn(L.btn1X)) drawShieldTooltip(actor, L.btn1X, L.btnW);
    if (hoverBtn(L.btn3X) && actor.classKey === 'warrior') drawStanceTooltip(actor, L.btn3X, L.btnW);
    if (hoverBtn(L.btn4X) && actor.baseSkill) drawSkillTooltip(actor.baseSkill, actor, L.btn4X, L.btnW);
    if (hoverBtn(L.btn5X) && slot2Key)        drawSkillTooltip(slot2Key,        actor, L.btn5X, L.btnW);
}

// Return the computed damage value for abilities that deal a fixed amount, or null otherwise
function getAbilityComputedDamage(ability, actor) {
    switch (ability.key) {
        case 'reckless_strike': return actor.getStat('dmg') * 2;
        case 'smite':           return Math.floor(actor.getStat('int') * 1.5);
        case 'piercing_shot':   return Math.floor(actor.getStat('dmg') * 1.5);
        case 'fireball':        return Math.floor(actor.getStat('int') * 2);
        case 'consecrate':      return Math.floor(actor.getStat('int') * 1.2);
        default:                return null;
    }
}

// Draw a tooltip above an ability button with its description and current computed values
function drawAbilityTooltip(ability, actor, btnX, btnW) {
    const L     = COMBAT_LAYOUT;
    const padX  = 14;
    const padY  = 10;
    const lineH = 17;
    const tipW  = 280;

    // Build the description lines (word-wrap to fit tipW - 2*padX)
    ctx.font = '12px monospace';
    const maxLineW  = tipW - padX * 2;
    const words     = ability.description.split(' ');
    const descLines = [];
    let   cur       = '';
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxLineW) { descLines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) descLines.push(cur);

    // Computed damage line (if applicable)
    const dmgVal = getAbilityComputedDamage(ability, actor);
    if (dmgVal !== null) descLines.push('\u25b6 Deals ' + dmgVal + ' damage at current stats.');

    // Mana regen note (player sees how fast mana regens)
    const regen = Math.max(1, Math.floor(actor.getStat('int') / 10));
    descLines.push('\u25b6 Mana: ' + actor.currentMana + ' / ' + actor.getMaxMana() + '  (+' + regen + '/turn)');

    const tipH  = padY * 2 + 22 + descLines.length * lineH;
    const tipCX = btnX + btnW / 2;
    const tipX  = Math.max(8, Math.min(1200 - tipW - 8, tipCX - tipW / 2));
    const tipY  = L.btnY - tipH - 8;

    // Background + border
    ctx.fillStyle   = 'rgba(10, 8, 6, 0.96)';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 1;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    // Title row: name + cost
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(ability.name, tipX + padX, tipY + padY + 13);

    const costLabel = ability.manaCost + ' MP';
    ctx.font        = '12px monospace';
    ctx.fillStyle   = actor.hasMana(ability.manaCost) ? '#93c5fd' : '#ef4444';
    ctx.textAlign   = 'right';
    ctx.fillText(costLabel, tipX + tipW - padX, tipY + padY + 13);

    // Description lines
    ctx.fillStyle = '#cccccc';
    ctx.font      = '12px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < descLines.length; i++) {
        // Computed/stat lines get a lighter tint
        const isComputed = descLines[i].startsWith('\u25b6');
        ctx.fillStyle = isComputed ? '#888888' : '#cccccc';
        ctx.fillText(descLines[i], tipX + padX, tipY + padY + 13 + 20 + i * lineH);
    }
}

// Draw a tooltip for the basic ATTACK button showing computed damage range
function drawAttackTooltip(actor, btnX, btnW) {
    const dmg      = actor.getStat('dmg');
    const def      = 0;  // can't know enemy DEF at tooltip time — show raw DMG
    const critPct  = Math.min(100, Math.round((actor.getStat('dex') + actor.getStat('luck'))));
    const lines = [
        'Attack the targeted enemy.',
        'Damage: DMG \u2212 enemy DEF (min 1).',
        '\u25b6 Your DMG: ' + dmg + '  \u2502  Crit chance: ' + critPct + '%',
    ];
    drawSimpleTooltip('BASIC ATTACK', lines, btnX, btnW);
}

// Draw a tooltip for the SHIELD button
function drawShieldTooltip(actor, btnX, btnW) {
    const regen   = Math.max(1, Math.floor(actor.getStat('int') / 10));
    const lines = [
        'Enter a defensive stance.',
        'Blocks 70% of incoming damage this turn.',
        'Grants 2\xd7 mana regen instead of normal.',
        '\u25b6 Mana regen this turn: +' + (regen * 2),
    ];
    drawSimpleTooltip('SHIELD', lines, btnX, btnW);
}

// Draw a tooltip for the STANCE button (Warrior only)
function drawStanceTooltip(actor, btnX, btnW) {
    const isInBattle = actor.stance === 'battle';
    const title      = isInBattle ? 'GUARD STANCE' : 'BATTLE STANCE';
    const lines = isInBattle
        ? [
            'Switch to Guard Stance.',
            '-25% incoming damage until switched back.',
            '-20% outgoing damage (no Battle Stance bonus).',
            '\u25b6 Click again to return to Battle Stance.',
          ]
        : [
            'Switch to Battle Stance.',
            '+20% outgoing damage.',
            'No incoming damage reduction.',
            '\u25b6 Click again to return to Guard Stance.',
          ];
    drawSimpleTooltip(title, lines, btnX, btnW);
}

// Shared tooltip renderer used by attack and shield (no mana cost header variant)
function drawSimpleTooltip(title, lines, btnX, btnW) {
    const L    = COMBAT_LAYOUT;
    const padX = 14;
    const padY = 10;
    const lineH = 17;
    const tipW  = 280;
    const tipH  = padY * 2 + 22 + lines.length * lineH;
    const tipCX = btnX + btnW / 2;
    const tipX  = Math.max(8, Math.min(1200 - tipW - 8, tipCX - tipW / 2));
    const tipY  = L.btnY - tipH - 8;

    ctx.fillStyle   = 'rgba(10, 8, 6, 0.96)';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 1;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(title, tipX + padX, tipY + padY + 13);

    ctx.font      = '12px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
        ctx.fillStyle = lines[i].startsWith('\u25b6') ? '#888888' : '#cccccc';
        ctx.fillText(lines[i], tipX + padX, tipY + padY + 13 + 20 + i * lineH);
    }
}

// ─── Item overlay ──────────────────────────────────────────────────────────────

// Return a colour dot for each potion type
function getPotionColor(key) {
    const colors = {
        small_heal:      '#22c55e',
        large_heal:      '#4ade80',
        antidote:        '#a855f7',
        damage_vial:     '#ef4444',
        explosive_flask: '#f97316',
    };
    return colors[key] || '#ffffff';
}

// Draw the potion selection panel on top of the combat screen
function drawCombatItemOverlay(combat) {
    const uniqueTypes = [...new Set(state.partyPotions)];
    const rowH   = 66;
    const headH  = 54;
    const footH  = 54;
    const panelW = 660;
    const panelH = headH + Math.max(1, uniqueTypes.length) * rowH + footH;
    const panelX = Math.round((1200 - panelW) / 2);
    const panelY = Math.round((640  - panelH) / 2);

    // Dark backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, 1200, 640);

    // Panel background + border
    ctx.fillStyle   = '#12100e';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POTIONS  (' + state.partyPotions.length + ' / ' + getPartyPotionLimit() + ')', panelX + panelW / 2, panelY + 33);

    // Divider below title
    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + headH);
    ctx.lineTo(panelX + panelW, panelY + headH);
    ctx.stroke();

    if (uniqueTypes.length === 0) {
        // Empty state
        ctx.fillStyle = '#666';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No potions available.', panelX + panelW / 2, panelY + headH + rowH / 2 + 6);
    } else {
        for (let i = 0; i < uniqueTypes.length; i++) {
            const key    = uniqueTypes[i];
            const count  = state.partyPotions.filter(k => k === key).length;
            const potion = POTION_DATA[key];
            const rowY   = panelY + headH + i * rowH;
            const isHov  = mouseX >= panelX + 2 && mouseX <= panelX + panelW - 2 &&
                           mouseY >= rowY && mouseY < rowY + rowH;

            // Row background
            ctx.fillStyle = isHov ? '#1e1a14' : '#161210';
            ctx.fillRect(panelX + 2, rowY, panelW - 4, rowH - 1);

            // Colour dot
            ctx.fillStyle = getPotionColor(key);
            ctx.beginPath();
            ctx.arc(panelX + 32, rowY + rowH / 2, 10, 0, Math.PI * 2);
            ctx.fill();

            // Name + count
            ctx.fillStyle = isHov ? '#ffd700' : '#cccccc';
            ctx.font      = 'bold 14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(potion.name + '  \xd7' + count, panelX + 54, rowY + 22);

            // Description
            ctx.fillStyle = '#888';
            ctx.font      = '11px monospace';
            ctx.fillText(potion.description, panelX + 54, rowY + 42);

            // Row separator
            ctx.strokeStyle = '#222';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(panelX + 2, rowY + rowH - 1);
            ctx.lineTo(panelX + panelW - 2, rowY + rowH - 1);
            ctx.stroke();
        }
    }

    // CLOSE button
    const closeW = 120;
    const closeH = 32;
    const closeX = panelX + Math.round((panelW - closeW) / 2);
    const closeY = panelY + panelH - footH + Math.round((footH - closeH) / 2);
    const closeHov = mouseX >= closeX && mouseX <= closeX + closeW && mouseY >= closeY && mouseY <= closeY + closeH;
    ctx.fillStyle   = closeHov ? '#2a1a0a' : '#1a1008';
    ctx.fillRect(closeX, closeY, closeW, closeH);
    ctx.strokeStyle = closeHov ? '#ffd700' : '#555';
    ctx.lineWidth   = 1;
    ctx.strokeRect(closeX, closeY, closeW, closeH);
    ctx.fillStyle = closeHov ? '#ffd700' : '#888';
    ctx.font      = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLOSE', closeX + closeW / 2, closeY + 21);
}

// Handle a click inside the potion overlay — returns combat outcome or null
function handleCombatItemOverlayClick(x, y, combat) {
    const uniqueTypes = [...new Set(state.partyPotions)];
    const rowH   = 66;
    const headH  = 54;
    const footH  = 54;
    const panelW = 660;
    const panelH = headH + Math.max(1, uniqueTypes.length) * rowH + footH;
    const panelX = Math.round((1200 - panelW) / 2);
    const panelY = Math.round((640  - panelH) / 2);

    // Click outside panel = cancel
    if (x < panelX || x > panelX + panelW || y < panelY || y > panelY + panelH) {
        combatItemOverlay = false;
        return null;
    }

    // CLOSE button
    const closeW = 120;
    const closeH = 32;
    const closeX = panelX + Math.round((panelW - closeW) / 2);
    const closeY = panelY + panelH - footH + Math.round((footH - closeH) / 2);
    if (x >= closeX && x <= closeX + closeW && y >= closeY && y <= closeY + closeH) {
        combatItemOverlay = false;
        return null;
    }

    // Potion row click
    for (let i = 0; i < uniqueTypes.length; i++) {
        const key  = uniqueTypes[i];
        const rowY = panelY + headH + i * rowH;
        if (x >= panelX + 2 && x <= panelX + panelW - 2 && y >= rowY && y < rowY + rowH) {
            const potion = POTION_DATA[key];
            combatItemOverlay = false;

            if (potion.selfOnly || potion.aoe) {
                // Execute immediately — self or all-enemies, no target selection needed
                const firstEnemy = getAliveEnemies(combat)[0];
                executePlayerPotion(combat, key, firstEnemy);
                return combat.phase === 'victory' ? 'victory' : combat.phase === 'defeat' ? 'defeat' : null;
            } else {
                // Throwable single-target — wait for enemy click
                combatItemSelected = key;
                return null;
            }
        }
    }

    return null;
}

// Draw a single action button with an optional mana cost sub-label
function drawActionButton(x, y, w, h, label, manaCost, disabled) {
    ctx.fillStyle = disabled ? '#1a1a1a' : '#2a1a0a';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = disabled ? '#444' : '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = disabled ? '#555' : '#ffd700';
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'center';

    const labelY = manaCost !== null ? y + 22 : y + 32;
    ctx.fillText(label, x + w / 2, labelY);

    if (manaCost !== null) {
        ctx.fillStyle = disabled ? '#334' : '#93c5fd';
        ctx.font      = '12px monospace';
        ctx.fillText(manaCost + ' MP', x + w / 2, y + 40);
    }
}

// Draw a skill action button with a coloured border for its slot type (gold = base, blue = slot 2)
function drawSkillButton(x, y, w, h, skillKey, character, borderColor) {
    if (!skillKey) {
        // Empty slot — greyed out placeholder
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth   = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#444';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No Skill', x + w / 2, y + 32);
        return;
    }

    const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
    if (!skillDef) {
        drawActionButton(x, y, w, h, skillKey, null, true);
        return;
    }

    const level     = character.skillLevels[skillKey] || 1;
    const levelData = skillDef.levels[level];
    const cost      = levelData.manaCost || 3;
    const useStam   = character.maxStamina > 0;
    const disabled  = useStam ? !character.hasStamina(cost) : !character.hasMana(cost);

    ctx.fillStyle   = disabled ? '#1a1a1a' : '#0a1a2a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = disabled ? '#444' : borderColor;
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    // Skill name (top line)
    ctx.fillStyle = disabled ? '#555' : '#ffffff';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(levelData.name, x + w / 2, y + 22);

    // Resource cost (bottom line)
    const resLabel = useStam ? cost + ' ST' : cost + ' MP';
    ctx.fillStyle  = disabled ? '#334' : (useStam ? '#86efac' : '#93c5fd');
    ctx.font       = '11px monospace';
    ctx.fillText(resLabel, x + w / 2, y + 40);
}

// Draw a tooltip above a skill button showing name, description, resource, scaling stat, and charge-up info
function drawSkillTooltip(skillKey, character, btnX, btnW) {
    const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
    if (!skillDef) return;

    const L         = COMBAT_LAYOUT;
    const level     = character.skillLevels[skillKey] || 1;
    const levelData = skillDef.levels[level];
    const cost      = levelData.manaCost || 3;
    const useStam   = character.maxStamina > 0;
    const padX      = 14;
    const padY      = 10;
    const lineH     = 17;
    const tipW      = 290;

    // Word-wrap the description
    ctx.font = '12px monospace';
    const maxLineW  = tipW - padX * 2;
    const words     = levelData.description.split(' ');
    const descLines = [];
    let   cur       = '';
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxLineW) { descLines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) descLines.push(cur);

    // Resource line
    const have = useStam ? character.currentStamina : character.currentMana;
    descLines.push('\u25b6 Cost: ' + cost + (useStam ? ' ST' : ' MP') + '  (have ' + have + ')');

    // Scaling stat line — colour-coded
    const STAT_COLORS = { dmg: '#f97316', dex: '#4ade80', int: '#93c5fd', luck: '#fbbf24', spd: '#a78bfa', def: '#60a5fa', hp: '#f87171' };
    descLines.push('\u25b6 Scales with: ' + skillDef.scalingStat.toUpperCase());

    // Charge-up warning
    if (skillDef.chargeUp) descLines.push('\u26a0 Charge-up: 2 turns');

    // Skill level
    descLines.push('\u25b6 Level: ' + level + ' / ' + skillDef.maxLevel);

    const tipH  = padY * 2 + 22 + descLines.length * lineH;
    const tipCX = btnX + btnW / 2;
    const tipX  = Math.max(8, Math.min(1200 - tipW - 8, tipCX - tipW / 2));
    const tipY  = L.btnY - tipH - 8;

    ctx.fillStyle   = 'rgba(10, 8, 6, 0.96)';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    // Border colour matches the button slot
    const isBase = character.baseSkill === skillKey;
    ctx.strokeStyle = isBase ? '#ffd700' : '#3b82f6';
    ctx.lineWidth   = 1;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    // Skill name
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(levelData.name, tipX + padX, tipY + padY + 13);

    // Attack type label (top-right)
    ctx.fillStyle = '#666';
    ctx.font      = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(skillDef.attackType.toUpperCase(), tipX + tipW - padX, tipY + padY + 13);

    // Description + info lines
    ctx.textAlign = 'left';
    for (let i = 0; i < descLines.length; i++) {
        const line = descLines[i];
        if (line.startsWith('\u26a0')) {
            ctx.fillStyle = '#f97316';  // orange for charge-up warning
        } else if (line.includes('Scales with:')) {
            ctx.fillStyle = STAT_COLORS[skillDef.scalingStat] || '#cccccc';
        } else if (line.startsWith('\u25b6')) {
            ctx.fillStyle = '#888888';
        } else {
            ctx.fillStyle = '#cccccc';
        }
        ctx.font = '12px monospace';
        ctx.fillText(line, tipX + padX, tipY + padY + 13 + 20 + i * lineH);
    }
}

// Draw the CONTINUE button shown after a victory
function drawContinueButton() {
    const L = COMBAT_LAYOUT;
    const x = Math.round((1200 - L.btnW) / 2);

    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(x, L.btnY, L.btnW, L.btnH);

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, L.btnY, L.btnW, L.btnH);

    ctx.fillStyle = '#4ade80';
    ctx.font      = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTINUE', x + L.btnW / 2, L.btnY + 32);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Return true if (x, y) falls inside a button rectangle
function inButton(x, y, btnX, btnY, btnW, btnH) {
    return x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH;
}

// Fire one arrow in multi-arrow mode (Volley L2 or Eclipse).
// Decrements the actor's arrow counter; advances the turn when the last arrow is fired.
function fireMultiArrow(combat, actor, target) {
    const log = msg => addToLog(combat, msg);

    if (actor.volleyArrowsLeft > 0) {
        const isLast = actor.volleyArrowsLeft === 1;
        // Final arrow ignores armor — reward for committing all shots
        const opts = isLast ? { ignoreArmor: true } : {};

        if (rollDodge(target, 'single')) {
            log(target.name + ' dodged!');
        } else {
            const result   = calculateDamage(actor, target, actor.volleyDamage, false, 'ranged', opts);
            const finalDmg = Math.max(1, Math.floor(result.damage * actor.volleyRowMult));
            target.takeDamage(finalDmg, log);
            const msg = result.isCrit
                ? 'CRITICAL! ' + actor.name + ' hits ' + target.name + ' for ' + finalDmg + '!'
                : actor.name + ' hits ' + target.name + ' for ' + finalDmg + ' damage!';
            log(msg);
            actor.aggro += Math.floor(finalDmg * 0.5);
            if (Math.random() < 0.35) applyStatusEffect(target, 'bleed', log);
        }

        actor.volleyArrowsLeft--;
        if (!target.isAlive()) log(target.name + ' is defeated!');

        if (isAllEnemiesDefeated(combat)) {
            actor.volleyArrowsLeft = 0;
            combat.phase = 'victory';
            addToLog(combat, 'All enemies defeated!');
            return;
        }
        if (actor.volleyArrowsLeft === 0) {
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        }

    } else if (actor.eclipseArrowsLeft > 0) {
        actor.eclipseTargets = actor.eclipseTargets || [];
        actor.eclipseTargets.push(target);

        if (rollDodge(target, 'single')) {
            log(target.name + ' dodged!');
        } else {
            const result   = calculateDamage(actor, target, actor.eclipseDamage, false, 'ranged', { ignoreArmor: true });
            const finalDmg = Math.max(1, Math.floor(result.damage * actor.eclipseRowMult));
            target.takeDamage(finalDmg, log);
            const msg = result.isCrit
                ? 'CRITICAL! ' + actor.name + ' hits ' + target.name + ' for ' + finalDmg + '!'
                : actor.name + ' hits ' + target.name + ' for ' + finalDmg + ' damage!';
            log(msg);
            actor.aggro += Math.floor(finalDmg * 0.5);
            if (Math.random() < 0.40) applyStatusEffect(target, 'bleed', log);
        }

        actor.eclipseArrowsLeft--;
        if (!target.isAlive()) log(target.name + ' is defeated!');

        if (isAllEnemiesDefeated(combat)) {
            actor.eclipseArrowsLeft = 0;
            actor.eclipseTargets    = [];
            combat.phase = 'victory';
            addToLog(combat, 'All enemies defeated!');
            return;
        }

        if (actor.eclipseArrowsLeft === 0) {
            // Stun only if all 3 arrows were aimed at the same target and it survived
            const hits = actor.eclipseTargets;
            if (hits.length === 3 && hits.every(t => t === hits[0]) && hits[0].isAlive()) {
                applyStatusEffect(hits[0], 'stun', log);
                log('Eclipse — perfect focus. ' + hits[0].name + ' is stunned.');
            }
            actor.eclipseTargets = [];
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        }
    }
}

// Handle a click during combat — returns 'victory', 'defeat', or null
function handleCombatClick(x, y, combat) {
    const L = COMBAT_LAYOUT;

    // ── Potion overlay is open — route to its handler ─────────────────────────
    if (combatItemOverlay) {
        return handleCombatItemOverlayClick(x, y, combat);
    }

    // ── Radiant Word ally-select: click a living party member to receive the heal ─
    if (combat.phase === 'player_turn') {
        const rwActor = getCurrentActor(combat);
        if (rwActor.radiantWordHealPending) {
            const ally = getPartyMemberAtClick(x, y, combat.party, L);
            if (ally && ally.isAlive()) {
                const level       = rwActor.radiantWordLevel || 1;
                const enemyTarget = rwActor.radiantWordTarget;   // save ref before resolve clears it
                resolveRadiantWord(rwActor, ally, level, msg => addToLog(combat, msg));
                // Log enemy defeat if the holy damage killed them
                if (enemyTarget && !enemyTarget.isAlive()) {
                    addToLog(combat, enemyTarget.name + ' is defeated!');
                }
                if (isAllEnemiesDefeated(combat)) {
                    combat.phase = 'victory';
                    addToLog(combat, 'All enemies defeated!');
                    return 'victory';
                }
                nextTurn(combat);
                if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
                return combat.phase === 'defeat' ? 'defeat' : null;
            }
            // Clicked outside a valid ally — cancel and log
            rwActor.radiantWordHealPending = false;
            rwActor.radiantWordTarget      = null;
            rwActor.radiantWordLevel       = null;
            addToLog(combat, 'Radiant Word — ally selection cancelled. Turn skipped.');
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return null;
        }
    }

    // ── Multi-arrow mode (Volley L2 / Eclipse): each enemy click fires one arrow ─
    if (combat.phase === 'player_turn') {
        const multiActor = getCurrentActor(combat);
        if (multiActor.volleyArrowsLeft > 0 || multiActor.eclipseArrowsLeft > 0) {
            if (x >= L.enemyZoneX && y < L.btnY) {
                const enemy = getEnemyAtClick(x, y, combat.enemies, L);
                if (enemy && enemy.isAlive()) {
                    fireMultiArrow(combat, multiActor, enemy);
                    return combat.phase === 'victory' ? 'victory' : combat.phase === 'defeat' ? 'defeat' : null;
                }
            }
            // Click outside enemy zone — stay in arrow mode (turn not consumed)
            return null;
        }
    }

    // ── Waiting for the player to click a skill target ────────────────────────
    if (pendingSkill) {
        if (x >= L.enemyZoneX && y < L.btnY) {
            const enemy = getEnemyAtClick(x, y, combat.enemies, L);
            if (enemy && enemy.isAlive()) {
                combat.selectedTarget = enemy;
                const sk = pendingSkill;
                pendingSkill = null;
                executePlayerSkill(combat, sk);
                return combat.phase === 'victory' ? 'victory' : combat.phase === 'defeat' ? 'defeat' : null;
            }
        }
        // Click anywhere else cancels targeting (turn not consumed)
        pendingSkill = null;
        return null;
    }

    // ── Waiting for the player to click a throwable target ────────────────────
    if (combatItemSelected) {
        if (x >= L.enemyZoneX && y < L.btnY) {
            const enemy = getEnemyAtClick(x, y, combat.enemies, L);
            if (enemy) {
                const key = combatItemSelected;
                combatItemSelected = null;
                executePlayerPotion(combat, key, enemy);
                return combat.phase === 'victory' ? 'victory' : combat.phase === 'defeat' ? 'defeat' : null;
            }
        }
        // Click anywhere else cancels targeting (turn not consumed)
        combatItemSelected = null;
        return null;
    }

    // ── Normal player turn input ───────────────────────────────────────────────
    if (combat.phase === 'player_turn') {
        const actor = getCurrentActor(combat);

        // Swap mode: player must pick a character in the opposite row to swap with
        if (combatSwapMode) {
            const dest    = actor.row === 'front' ? 'back' : 'front';
            const clicked = getPartyMemberAtClick(x, y, combat.party, L);
            if (clicked && clicked.isAlive() && clicked !== actor && clicked.row === dest) {
                combatSwapMode    = false;
                combatMoveVisible = false;
                executePlayerRowSwap(combat, clicked);
            } else {
                combatSwapMode    = false;
                combatMoveVisible = false;
                addToLog(combat, 'Swap cancelled.');
            }
            return combat.phase === 'defeat' ? 'defeat' : null;
        }

        // Enemy zone: pre-select attack target
        if (x >= L.enemyZoneX && y < L.btnY) {
            const enemy = getEnemyAtClick(x, y, combat.enemies, L);
            if (enemy) { combat.selectedTarget = enemy; return null; }
        }

        // MOVE button — checked BEFORE party zone so it isn't swallowed by the party click handler
        if (combatMoveVisible && combatMoveBtn) {
            const b = combatMoveBtn;
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                const dest      = actor.row === 'front' ? 'back' : 'front';
                const destCount = combat.party.filter(m => m.row === dest).length;
                if (destCount < 3) {
                    combatMoveVisible = false;
                    executePlayerRowSwitch(combat);
                } else {
                    combatSwapMode = true;
                    addToLog(combat, actor.name + ': ' + dest + ' row is full — pick an ally to swap with.');
                }
                return combat.phase === 'defeat' ? 'defeat' : null;
            }
        }

        // Party zone: clicking the active character toggles the MOVE button
        if (x < L.partyZoneX + L.partyZoneW && y >= COLUMN_GROUND_TOP - 140 && y < COLUMN_GROUND_BOT + 50) {
            const clicked = getPartyMemberAtClick(x, y, combat.party, L);
            combatMoveVisible = (clicked === actor);
            return null;
        }

        // Clicking action buttons clears the move button
        combatMoveVisible = false;

        if (inButton(x, y, L.btn0X, L.btnY, L.btnW, L.btnH)) {
            executePlayerAttack(combat);
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn1X, L.btnY, L.btnW, L.btnH)) {
            executePlayerShield(combat);
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn2X, L.btnY, L.btnW, L.btnH)) {
            if (state.partyPotions.length > 0) combatItemOverlay = true;
            return null;
        }
        if (inButton(x, y, L.btn3X, L.btnY, L.btnW, L.btnH)) {
            if (actor.classKey === 'warrior') {
                // STANCE SWITCH — Warrior-exclusive free action (costs the turn)
                executePlayerStanceSwitch(combat);
            } else {
                // SWITCH ROW — same logic as the floating MOVE button
                const dest      = actor.row === 'front' ? 'back' : 'front';
                const destCount = combat.party.filter(m => m.row === dest).length;
                if (destCount < 3) {
                    executePlayerRowSwitch(combat);
                } else {
                    combatSwapMode = true;
                    addToLog(combat, actor.name + ': ' + dest + ' row is full — pick an ally to swap with.');
                }
            }
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn4X, L.btnY, L.btnW, L.btnH)) {
            // BASE SKILL
            const skillKey = actor.baseSkill;
            if (!skillKey) return null;
            const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
            if (!skillDef) return null;
            // AoE, self-targeting, and charge-up (turn 1) execute immediately; others need a target click
            if (skillDef.attackType === 'aoe' || skillDef.attackType === 'self' || (skillDef.chargeUp && !actor.charging)) {
                executePlayerSkill(combat, skillKey);
            } else {
                pendingSkill = skillKey;
            }
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn5X, L.btnY, L.btnW, L.btnH)) {
            // SLOT-2 SKILL
            const skillKey = actor.equippedSkills && actor.equippedSkills[0];
            if (!skillKey) return null;
            const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
            if (!skillDef) return null;
            if (skillDef.attackType === 'aoe' || skillDef.attackType === 'self' || (skillDef.chargeUp && !actor.charging)) {
                executePlayerSkill(combat, skillKey);
            } else {
                pendingSkill = skillKey;
            }
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        return null;
    }

    // ── Victory: CONTINUE button ───────────────────────────────────────────────
    if (combat.phase === 'victory') {
        const contX = Math.round((1200 - L.btnW) / 2);
        if (inButton(x, y, contX, L.btnY, L.btnW, L.btnH)) return 'victory';
    }

    return null;
}
