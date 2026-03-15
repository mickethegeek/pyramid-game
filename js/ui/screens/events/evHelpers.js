// ─── Helpers ─────────────────────────────────────────────────────────────────

// True if point (x, y) is inside the rectangle defined by x0, y0, w, h
function evInRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// Rarity → display colour
function evRarityColor(rarity) {
    switch (rarity) {
        case 'common':    return '#94a3b8';
        case 'uncommon':  return '#4ade80';
        case 'rare':      return '#3b82f6';
        case 'legendary': return '#ffd700';
        default:          return '#ffffff';
    }
}

// Room type → friendly display name
function evRoomTypeName(type) {
    const names = {
        combat: 'Combat', elite: 'Elite Combat', ambush: 'Ambush', boss: 'Boss Fight',
        treasure: 'Treasure', rest: 'Rest Site', trap: 'Trap', warp: 'Warp Gate',
        shop: 'Shop', event: 'Event', camp: 'Camp',
    };
    return names[type] || type;
}

// Room type → colour (matches pyramid view palette)
function evRoomColor(type) {
    const colors = {
        combat: '#c0392b', elite: '#8e44ad', ambush: '#e74c3c', boss: '#e67e22',
        treasure: '#f1c40f', rest: '#27ae60', trap: '#d35400', warp: '#2980b9',
        shop: '#16a085', event: '#8e44ad', camp: '#2c3e50',
    };
    return colors[type] || '#888';
}

// Word-wrap text to fit within maxWidth pixels (uses current ctx.font)
function evWrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let   cur   = '';
    for (const word of words) {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = word; }
        else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
}

// ─── Shared chrome ────────────────────────────────────────────────────────────

// Dark background
function drawEventBackground() {
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, 1200, 640);
}

// Blue-tinted header bar with gold counter
function drawEventHeader() {
    ctx.fillStyle = '#0d1a2e';
    ctx.fillRect(0, 0, 1200, 70);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70); ctx.lineTo(1200, 70);
    ctx.stroke();

    ctx.fillStyle = '#3b82f6';
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('EVENT', 30, 45);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + state.gold + ' gold', 1170, 45);
}

// Draw a bordered button; style: 'green' | 'blue' | 'red' | 'gold' | 'gray'
function drawEvBtn(label, rx, ry, rw, rh, style) {
    const S = {
        green:  { bg: '#0d2818', border: '#4ade80', text: '#4ade80' },
        blue:   { bg: '#0d1a2e', border: '#3b82f6', text: '#3b82f6' },
        red:    { bg: '#2e0d0d', border: '#ef4444', text: '#ef4444' },
        gold:   { bg: '#1a1408', border: '#ffd700', text: '#ffd700' },
        orange: { bg: '#1a1000', border: '#f97316', text: '#f97316' },
        gray:   { bg: '#1a1a1a', border: '#444',    text: '#555'    },
    };
    const c = S[style] || S.blue;
    ctx.fillStyle   = c.bg;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = c.border;
    ctx.lineWidth   = 2;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle   = c.text;
    ctx.font        = 'bold 16px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(label, rx + rw / 2, ry + rh / 2 + 6);
}

// Draw a bordered card box with a dark fill
function drawEvCard(x, y, w, h, borderColor) {
    ctx.fillStyle   = '#1a1610';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = borderColor || '#3a3530';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x, y, w, h);
}

// Draw an item card showing name, type, rarity, and non-zero stat bonuses
function drawEvItemCard(item, x, y, w, h) {
    const rarityColor = evRarityColor(item.rarity);
    drawEvCard(x, y, w, h, rarityColor);

    // Name
    ctx.fillStyle = rarityColor;
    ctx.font      = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, x + 12, y + 24);

    // Type + rarity
    ctx.fillStyle = '#666';
    ctx.font      = '12px monospace';
    ctx.fillText(item.type.toUpperCase() + '  ·  ' + item.rarity.toUpperCase(), x + 12, y + 42);

    // Stat bonuses
    const STAT_ORDER  = ['hp', 'def', 'dmg', 'dex', 'spd', 'int', 'luck'];
    const STAT_COLORS = { hp:'#ef4444', def:'#f97316', dmg:'#f59e0b', dex:'#22c55e', spd:'#3b82f6', int:'#a855f7', luck:'#ffd700' };

    let sx = x + 12;
    const sy = y + 62;
    ctx.font = 'bold 13px monospace';
    for (const stat of STAT_ORDER) {
        const val = item.statBonus[stat];
        if (!val) continue;
        ctx.fillStyle = STAT_COLORS[stat];
        const label   = (val > 0 ? '+' : '') + val + ' ' + stat.toUpperCase();
        ctx.fillText(label, sx, sy);
        sx += ctx.measureText(label).width + 14;
        if (sx > x + w - 20) break;
    }

    // Passive
    if (item.passiveDesc) {
        ctx.fillStyle = '#888';
        ctx.font      = '12px monospace';
        ctx.fillText(item.passiveDesc, x + 12, y + 82);
    }
}