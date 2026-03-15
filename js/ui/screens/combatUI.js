// Combat screen — avatar-based layout: party left, enemies right (1200×640)

// ─── Layout constants ──────────────────────────────────────────────────────────

const COMBAT_LAYOUT = {
    // Ground line — all avatar feet stand here
    groundY: 375,

    // Party zone (left half of canvas)
    partyZoneX: 0,
    partyZoneW: 595,

    // Enemy zone (right half of canvas)
    enemyZoneX: 605,
    enemyZoneW: 595,

    // Vertical divider between the two zones
    dividerX: 600,

    // Combat log
    logX:     10,
    logY:    435,
    logW:   1180,
    logLineH: 22,

    // 5 action buttons: ATTACK | SHIELD | ITEM | ability 1 | ability 2
    // btnW=140, gap=16 → total 764px, starts at (1200-764)/2 = 218
    btnY:  520,
    btnW:  140,
    btnH:   50,
    btn0X: 218,   // ATTACK
    btn1X: 374,   // SHIELD
    btn2X: 530,   // ITEM
    btn3X: 686,   // ability 1
    btn4X: 842,   // ability 2
};

// ─── Item overlay state ────────────────────────────────────────────────────────

// Whether the potion selection panel is currently open
let combatItemOverlay  = false;

// Potion key waiting for an enemy target click (throwable non-AoE only)
let combatItemSelected = null;

// Reset overlay state at the start of each new combat encounter
function resetCombatUIState() {
    combatItemOverlay  = false;
    combatItemSelected = null;
}

// Heights from feet (groundY) to the very top of each avatar style
const PARTY_AVATAR_HEIGHTS = { fighter: 95, caster: 130, archer: 90 };
const ENEMY_AVATAR_HEIGHTS = { goblin: 80, skeleton: 100, mage: 130, brute: 100, boss: 160 };

// ─── Main draw entry point ─────────────────────────────────────────────────────

// Draw the full combat screen for the current combat state
function drawCombatScreen(combat) {
    drawCombatBackground();
    drawCombatHeader(combat);
    drawCombatDivider();
    drawPartyAvatars(combat);
    drawEnemyAvatars(combat);
    drawCombatLog(combat.log);
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

// ─── Party avatars (left zone) ─────────────────────────────────────────────────

// Draw one avatar slot per party member across the left zone
function drawPartyAvatars(combat) {
    const L     = COMBAT_LAYOUT;
    const party = combat.party;
    const count = party.length;
    const slotW = L.partyZoneW / count;
    const actor = getCurrentActor(combat);

    for (let i = 0; i < count; i++) {
        const member   = party[i];
        const cx       = L.partyZoneX + i * slotW + slotW / 2;
        const isActive = (member === actor && combat.phase === 'player_turn');
        drawPartySlot(member, cx, L.groundY, isActive);
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

// ─── Enemy avatars (right zone) ───────────────────────────────────────────────

// Draw one avatar slot per enemy across the right zone
function drawEnemyAvatars(combat) {
    const L       = COMBAT_LAYOUT;
    const enemies = combat.enemies;
    const count   = enemies.length;
    const slotW   = L.enemyZoneW / count;
    const actor   = getCurrentActor(combat);

    for (let i = 0; i < count; i++) {
        const enemy      = enemies[i];
        const cx         = L.enemyZoneX + i * slotW + slotW / 2;
        const isActive   = (enemy === actor && combat.phase === 'enemy_turn');
        const isSelected = (enemy === combat.selectedTarget);
        drawEnemySlot(enemy, cx, L.groundY, isActive, isSelected);
    }
}

// Draw one enemy — avatar figure + HP label
// isSelected: true when the player has clicked this enemy as their attack target
function drawEnemySlot(enemy, cx, groundY, isActive, isSelected) {
    if (isActive)   drawActiveGlow(cx, groundY, '#ef4444');
    if (isSelected) drawTargetRing(cx, groundY, getEnemyAvatarStyle(enemy.name));
    // Green pulsing ring when player is aiming a throwable potion
    if (combatItemSelected && enemy.isAlive()) drawThrowableTargetRing(cx, groundY, getEnemyAvatarStyle(enemy.name));

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

// Draw the last 4 combat messages in a log box
function drawCombatLog(log) {
    const L    = COMBAT_LAYOUT;
    const boxH = 98;
    const boxY = L.logY - 22;

    ctx.fillStyle = '#1a1614';
    ctx.fillRect(L.logX, boxY, L.logW, boxH);

    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1;
    ctx.strokeRect(L.logX, boxY, L.logW, boxH);

    ctx.font      = '14px monospace';
    ctx.textAlign = 'left';

    for (let i = 0; i < log.length; i++) {
        const alpha = 0.5 + (i / log.length) * 0.5;
        ctx.fillStyle = 'rgba(220, 220, 200, ' + alpha + ')';
        ctx.fillText(log[i], L.logX + 10, L.logY + i * L.logLineH);
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

// Draw all 5 action buttons for the currently-acting party member
function drawPlayerButtons(combat) {
    const L     = COMBAT_LAYOUT;
    const actor = getCurrentActor(combat);

    // ── Targeting mode — show instruction banner instead of buttons ───────────
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

    // ── Ability buttons ───────────────────────────────────────────────────────
    const abilities = actor.abilities || [];
    for (let i = 0; i < 2; i++) {
        const ability = abilities[i];
        const btnX    = i === 0 ? L.btn3X : L.btn4X;
        if (!ability) {
            drawActionButton(btnX, L.btnY, L.btnW, L.btnH, '\u2014', null, true);
        } else {
            const cooldown = ability.getCooldown ? ability.getCooldown(actor) : 0;
            const ready    = ability.isReady     ? ability.isReady(actor, combat) : true;
            const disabled = !actor.hasMana(ability.manaCost) || !ready;
            const label    = cooldown > 0 ? ability.name + ' [' + cooldown + ']' : ability.name;
            drawActionButton(btnX, L.btnY, L.btnW, L.btnH, label, ability.manaCost, disabled);
        }
    }

    // ── Tooltips (drawn last so they sit on top) ──────────────────────────────
    const hoverBtn = (bx) => mouseX >= bx && mouseX <= bx + L.btnW && mouseY >= L.btnY && mouseY <= L.btnY + L.btnH;

    if (hoverBtn(L.btn0X)) drawAttackTooltip(actor, L.btn0X, L.btnW);
    if (hoverBtn(L.btn1X)) drawShieldTooltip(actor, L.btn1X, L.btnW);

    for (let i = 0; i < 2; i++) {
        const ability = abilities[i];
        if (!ability) continue;
        const btnX = i === 0 ? L.btn3X : L.btn4X;
        if (hoverBtn(btnX)) drawAbilityTooltip(ability, actor, btnX, L.btnW);
    }
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

// Handle a click during combat — returns 'victory', 'defeat', or null
function handleCombatClick(x, y, combat) {
    const L = COMBAT_LAYOUT;

    // ── Potion overlay is open — route to its handler ─────────────────────────
    if (combatItemOverlay) {
        return handleCombatItemOverlayClick(x, y, combat);
    }

    // ── Waiting for the player to click a throwable target ────────────────────
    if (combatItemSelected) {
        if (x >= L.enemyZoneX && y < L.btnY) {
            const count   = combat.enemies.length;
            const slotW   = L.enemyZoneW / count;
            const slotIdx = Math.floor((x - L.enemyZoneX) / slotW);
            if (slotIdx >= 0 && slotIdx < count) {
                const enemy = combat.enemies[slotIdx];
                if (enemy.isAlive()) {
                    const key = combatItemSelected;
                    combatItemSelected = null;
                    executePlayerPotion(combat, key, enemy);
                    return combat.phase === 'victory' ? 'victory' : combat.phase === 'defeat' ? 'defeat' : null;
                }
            }
        }
        // Click anywhere else cancels targeting (turn not consumed)
        combatItemSelected = null;
        return null;
    }

    // ── Normal player turn input ───────────────────────────────────────────────
    if (combat.phase === 'player_turn') {
        // Enemy avatar click — pre-select attack target
        if (x >= L.enemyZoneX && y < L.btnY) {
            const count   = combat.enemies.length;
            const slotW   = L.enemyZoneW / count;
            const slotIdx = Math.floor((x - L.enemyZoneX) / slotW);
            if (slotIdx >= 0 && slotIdx < count) {
                const enemy = combat.enemies[slotIdx];
                if (enemy.isAlive()) { combat.selectedTarget = enemy; return null; }
            }
        }

        if (inButton(x, y, L.btn0X, L.btnY, L.btnW, L.btnH)) {
            executePlayerAttack(combat);
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn1X, L.btnY, L.btnW, L.btnH)) {
            executePlayerShield(combat);
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn2X, L.btnY, L.btnW, L.btnH)) {
            // Open item overlay only if potions are available
            if (state.partyPotions.length > 0) combatItemOverlay = true;
            return null;
        }
        if (inButton(x, y, L.btn3X, L.btnY, L.btnW, L.btnH)) {
            executePlayerAbility(combat, 0);
            return combat.phase === 'defeat' ? 'defeat' : null;
        }
        if (inButton(x, y, L.btn4X, L.btnY, L.btnW, L.btnH)) {
            executePlayerAbility(combat, 1);
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
