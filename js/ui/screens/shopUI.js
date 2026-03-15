// Shop screen — buy, sell, and forge items

// ─── Prices ───────────────────────────────────────────────────────────────────

const SHOP_PRICES  = { common: 30, uncommon: 70, rare: 150, legendary: 400 };

// Fixed potion prices per key
const POTION_PRICES = {
    small_heal:      25,
    large_heal:      55,
    antidote:        40,
    damage_vial:     35,
    explosive_flask: 60,
};

// Return the sell value for an item (30% of buy price, floored)
function sellPrice(item) {
    return Math.floor((SHOP_PRICES[item.rarity] || 30) * 0.3);
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const SH = {
    headerH:      70,
    // Left panel: 2×2 card grid
    cardX:        [15, 300],
    cardY:        [100, 262],   // row 1 moved up to make room for relic card
    cardW:        270,
    cardH:        160,          // reduced to make room for relic card
    // Vertical divider
    divX:         586,
    // Right panel mode tabs (sit just below the header)
    tabY:         76,
    tabH:         30,
    shopTabX:     602,
    shopTabW:     130,
    forgerTabX:   738,
    forgerTabW:   155,
    // Right panel shared constants
    panelX:       600,
    panelW:       585,          // right edge = 1185
    contentY:     112,          // first content line below the tabs
    // ── Shop mode ──
    detailH:      318,          // detail panel height (contentY..contentY+detailH)
    buyBtnX:      975,
    buyBtnY:      388,
    buyBtnW:      195,
    buyBtnH:      38,
    sellLabelY:   440,
    sellStartY:   456,
    sellRowH:     30,
    sellMaxRows:  4,
    // ── Forger mode ──
    forgerRowH:   30,
    forgerMaxRows: 8,
    forgerRerollX:   612,
    forgerRerollY:   515,
    forgerRerollW:   220,
    forgerRerollH:   44,
    forgerUpgradeX:  848,
    forgerUpgradeY:  515,
    forgerUpgradeW:  255,
    forgerUpgradeH:  44,
    // ── Relic slot (left panel, below item cards) ──
    relicLabelY:  428,          // "── RELIC ──" section label y
    relicCardX:   15,
    relicCardY:   436,          // top of the relic card
    relicCardW:   556,
    relicCardH:   56,           // height of the relic card
    // ── Potion slots (left panel, below relic card) ──
    potLabelY:    498,          // "── POTIONS ──" section label y
    potRowY:      508,          // top of the 3 compact potion slots
    potSlotH:     56,           // height of each potion slot
    potSlotW:     180,          // width of each potion slot
    potSlotX:     [15, 200, 385], // x positions of the 3 slots
    // LEAVE button (bottom of left panel)
    leaveBtnX:    120,
    leaveBtnY:    572,
    leaveBtnW:    260,
    leaveBtnH:    40,
};

// ─── Module state ─────────────────────────────────────────────────────────────

let shopStock      = [];      // 4 Items (null = sold)
let shopPotions    = [];      // 3 potion keys (null = sold)
let shopSelected   = null;    // clicked shop item — persists when mouse moves to BUY
let shopMode       = 'shop';  // 'shop' | 'forger'
let forgerSelected = null;    // inventory item chosen for forging

// ─── Stock generation ─────────────────────────────────────────────────────────

// Generate 4 items and 3 random potions, reset all selection state — called on every shop entry
function stockShop() {
    shopStock      = [generateItem('weapon'), generateItem('armor'), generateItem('accessory'), generateItem()];
    const potKeys  = Object.keys(POTION_DATA);
    shopPotions    = [0, 1, 2].map(() => potKeys[Math.floor(Math.random() * potKeys.length)]);
    shopSelected   = null;
    shopMode       = 'shop';
    forgerSelected = null;
    // Increment act shop counter (guards against double-increment: called once per room entry)
    state.actShopCount = (state.actShopCount || 0) + 1;
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the complete shop screen
function drawShopScreen() {
    drawShopBackground();
    drawShopHeader();
    drawShopCards();
    drawShopDivider();
    drawRightPanelTabs();
    if (shopMode === 'forger') {
        drawForgerPanel();
    } else {
        drawShopRightPanel();
    }
    drawShopLeaveButton();
}

// Dark background
function drawShopBackground() {
    ctx.fillStyle = '#0e0c10';
    ctx.fillRect(0, 0, 1200, 640);
}

// Purple-tinted header with title and gold counter
function drawShopHeader() {
    ctx.fillStyle = '#1a0d2e';
    ctx.fillRect(0, 0, 1200, SH.headerH);

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, SH.headerH);
    ctx.lineTo(1200, SH.headerH);
    ctx.stroke();

    ctx.fillStyle = '#a855f7';
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SHOP', 30, 45);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + state.gold + ' gold', 1170, 45);
}

// ─── Left panel: item cards ───────────────────────────────────────────────────

// "FOR SALE" label + 4 item cards + relic slot (visits 1-8) + 3 potion slots
function drawShopCards() {
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 FOR SALE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', 15, SH.cardY[0] - 8);

    for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawShopCard(shopStock[i], SH.cardX[col], SH.cardY[row]);
    }

    // Relic slot is only shown for shop visits 1-8 of each act
    const count = state.actShopCount || 0;
    if (count >= 1 && count <= 8) drawShopRelicSlot();

    drawShopPotionSlots();
}

// Return the relic key to show in the shop for the current visit count, or null if none
function getActRelicKey() {
    const count = state.actShopCount || 0;
    if (count >= 1 && count <= 4) return state.actRelicA || null;
    if (count >= 5 && count <= 8) return state.actRelicB || null;
    return null;
}

// Draw the wide relic card spanning the full left-panel width
function drawShopRelicSlot() {
    const key  = getActRelicKey();
    const data = key ? RELIC_DATA[key] : null;

    // Section label
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 RELIC \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', 15, SH.relicLabelY);

    if (!data) return; // actRelicA/B not yet assigned — skip card

    const owned   = hasRelic(key);
    const price   = 400;
    const canBuy  = !owned && state.gold >= price;
    const hovered = !owned && inRect(mouseX, mouseY, SH.relicCardX, SH.relicCardY, SH.relicCardW, SH.relicCardH);

    // Card background + border
    ctx.fillStyle   = owned ? '#0a0910' : hovered ? '#1a1028' : '#130f1c';
    ctx.fillRect(SH.relicCardX, SH.relicCardY, SH.relicCardW, SH.relicCardH);
    ctx.strokeStyle = owned ? '#2a2035' : hovered ? '#ffd700' : '#5a3080';
    ctx.lineWidth   = hovered ? 2 : 1.5;
    ctx.strokeRect(SH.relicCardX, SH.relicCardY, SH.relicCardW, SH.relicCardH);

    // Relic name
    ctx.fillStyle = owned ? '#555' : '#e8c040';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(data.name, SH.relicCardX + 12, SH.relicCardY + 20);

    // Description (truncated to leave room for price on the right)
    ctx.fillStyle = owned ? '#444' : '#888';
    ctx.font      = '12px monospace';
    const maxDescW = SH.relicCardW - 190;
    let desc = data.description;
    while (ctx.measureText(desc).width > maxDescW && desc.length > 10) desc = desc.slice(0, -1);
    if (desc !== data.description) desc += '\u2026';
    ctx.fillText(desc, SH.relicCardX + 12, SH.relicCardY + 38);

    // Right side: price or "Already acquired"
    ctx.textAlign = 'right';
    const rx = SH.relicCardX + SH.relicCardW - 12;
    if (owned) {
        ctx.fillStyle = '#555';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Already acquired', rx, SH.relicCardY + 20);
    } else {
        ctx.fillStyle = canBuy ? '#ffd700' : '#555';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('\u25c6 ' + price + 'g', rx, SH.relicCardY + 20);
        ctx.fillStyle = canBuy ? '#a855f7' : '#3a3040';
        ctx.font      = '11px monospace';
        ctx.fillText(canBuy ? '[click to buy]' : 'need more gold', rx, SH.relicCardY + 38);
    }
}

// Potion section label + 3 compact potion slots
function drawShopPotionSlots() {
    const carried = (state.partyPotions || []).length;
    const limit   = getPartyPotionLimit();
    const full    = carried >= limit;

    // Section label with carry counter
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 POTIONS  ' + carried + '/' + limit + (full ? '  [FULL]' : '') + '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', 15, SH.potLabelY);

    for (let i = 0; i < 3; i++) {
        drawShopPotionSlot(shopPotions[i], i, full);
    }
}

// Draw one compact potion slot card
function drawShopPotionSlot(potionKey, index, full) {
    const x = SH.potSlotX[index];
    const y = SH.potRowY;
    const w = SH.potSlotW;
    const h = SH.potSlotH;

    if (!potionKey) {
        // Sold out
        ctx.fillStyle   = '#0d0b0f';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#2a2030';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle   = '#3a3040';
        ctx.font        = '13px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText('SOLD', x + w / 2, y + h / 2 + 5);
        return;
    }

    const pd     = POTION_DATA[potionKey];
    const price  = POTION_PRICES[potionKey] || 30;
    const hovered = inRect(mouseX, mouseY, x, y, w, h);
    const canBuy  = !full && state.gold >= price;

    ctx.fillStyle   = hovered ? '#1a1228' : '#130f1c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hovered ? '#4ade80' : '#2d2040';
    ctx.lineWidth   = hovered ? 2 : 1;
    ctx.strokeRect(x, y, w, h);

    // Potion name
    ctx.fillStyle = '#c8f0c8';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    let name = pd ? pd.name : potionKey;
    while (ctx.measureText(name).width > w - 16 && name.length > 6) name = name.slice(0, -1);
    if (name !== (pd ? pd.name : potionKey)) name += '\u2026';
    ctx.fillText(name, x + 8, y + 18);

    // Short description (truncated)
    if (pd && pd.description) {
        ctx.fillStyle = '#666';
        ctx.font      = '10px monospace';
        let desc = pd.description;
        while (ctx.measureText(desc).width > w - 16 && desc.length > 10) desc = desc.slice(0, -1);
        if (desc !== pd.description) desc += '\u2026';
        ctx.fillText(desc, x + 8, y + 34);
    }

    // Price (grayed if can't afford or full)
    ctx.fillStyle = canBuy ? '#ffd700' : '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(full ? 'FULL' : ('\u25c6 ' + price + 'g'), x + w - 8, y + h - 8);
}

// Draw one item card with hover / selected highlight
function drawShopCard(item, x, y) {
    const hovered  = inRect(mouseX, mouseY, x, y, SH.cardW, SH.cardH);
    const selected = shopSelected === item;

    if (!item) {
        ctx.fillStyle   = '#0d0b0f';
        ctx.fillRect(x, y, SH.cardW, SH.cardH);
        ctx.strokeStyle = '#2a2030';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x, y, SH.cardW, SH.cardH);
        ctx.fillStyle   = '#3a3040';
        ctx.font        = '14px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText('SOLD', x + SH.cardW / 2, y + SH.cardH / 2 + 5);
        return;
    }

    ctx.fillStyle   = hovered ? '#1e1428' : '#130f1c';
    ctx.fillRect(x, y, SH.cardW, SH.cardH);
    ctx.strokeStyle = selected ? '#ffd700' : hovered ? rarityColor(item.rarity) : '#2d2040';
    ctx.lineWidth   = (selected || hovered) ? 2 : 1;
    ctx.strokeRect(x, y, SH.cardW, SH.cardH);

    // Name (truncated if needed)
    ctx.font = 'bold 14px monospace';
    let name = item.name;
    while (ctx.measureText(name).width > SH.cardW - 20 && name.length > 6) name = name.slice(0, -1);
    if (name !== item.name) name += '\u2026';
    ctx.fillStyle = rarityColor(item.rarity);
    ctx.textAlign = 'left';
    ctx.fillText(name, x + 10, y + 24);

    // Type (left) + rarity (right)
    ctx.fillStyle = '#555';
    ctx.font      = '11px monospace';
    ctx.fillText(item.type.toUpperCase(), x + 10, y + 40);
    ctx.fillStyle = rarityColor(item.rarity);
    ctx.textAlign = 'right';
    ctx.fillText(rarityLabel(item.rarity).toUpperCase(), x + SH.cardW - 10, y + 40);

    // Stat bonuses
    const parts = buildStatString(item.statBonus).split('  ');
    ctx.fillStyle = '#aaa';
    ctx.font      = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(parts.slice(0, 3).join('  '), x + 10, y + 62);
    if (parts.length > 3) ctx.fillText(parts.slice(3).join('  '), x + 10, y + 80);

    // Passive
    if (item.passiveDesc) {
        ctx.fillStyle = '#8bc4aa';
        ctx.font      = '11px monospace';
        ctx.fillText(item.passiveDesc, x + 10, y + 100);
    }

    // Negative suffix (red)
    if (item.suffixNegative) {
        const idx = item.name.indexOf(' of ');
        if (idx >= 0) {
            ctx.fillStyle = '#ef4444';
            ctx.font      = '11px monospace';
            ctx.fillText(item.name.slice(idx + 1), x + 10, item.passiveDesc ? y + 118 : y + 100);
        }
    }

    // Price
    const canAfford = state.gold >= SHOP_PRICES[item.rarity];
    ctx.fillStyle   = canAfford ? '#ffd700' : '#555';
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'right';
    ctx.fillText('\u25c6 ' + SHOP_PRICES[item.rarity] + 'g', x + SH.cardW - 10, y + SH.cardH - 10);
}

// Thin vertical divider
function drawShopDivider() {
    ctx.strokeStyle = '#2a2030';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(SH.divX, SH.headerH);
    ctx.lineTo(SH.divX, 640);
    ctx.stroke();
}

// ─── Right panel: mode tabs ───────────────────────────────────────────────────

// Draw the SHOP / FORGER toggle tabs at the top of the right panel
function drawRightPanelTabs() {
    drawModeTab('SHOP',        SH.shopTabX,   SH.tabY, SH.shopTabW,   shopMode === 'shop');
    drawModeTab('\u2692 FORGER', SH.forgerTabX, SH.tabY, SH.forgerTabW, shopMode === 'forger');
}

// Draw one mode tab button
function drawModeTab(label, x, y, w, active) {
    ctx.fillStyle   = active ? '#a855f7' : '#1a0d2e';
    ctx.fillRect(x, y, w, SH.tabH);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth   = active ? 0 : 1;
    ctx.strokeRect(x, y, w, SH.tabH);
    ctx.fillStyle   = active ? '#fff' : '#a855f7';
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(label, x + w / 2, y + 20);
}

// ─── Right panel: shop mode ───────────────────────────────────────────────────

// Detail panel + sell section
function drawShopRightPanel() {
    const item = getDetailItem();
    if (item) {
        drawItemDetail(item);
    } else {
        ctx.fillStyle = '#3a3040';
        ctx.font      = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Click an item to inspect', SH.panelX + SH.panelW / 2, SH.contentY + SH.detailH / 2);
    }
    drawSellSection();
}

// Return hovered card item, or last clicked (shopSelected) as fallback
function getDetailItem() {
    for (let i = 0; i < 4; i++) {
        if (!shopStock[i]) continue;
        const col = i % 2;
        const row = Math.floor(i / 2);
        if (inRect(mouseX, mouseY, SH.cardX[col], SH.cardY[row], SH.cardW, SH.cardH)) return shopStock[i];
    }
    return shopSelected;
}

// Full item detail panel
function drawItemDetail(item) {
    const px = SH.panelX + 14;
    const py = SH.contentY;

    ctx.fillStyle   = '#130f1c';
    ctx.fillRect(SH.panelX, py, SH.panelW - 10, SH.detailH);
    ctx.strokeStyle = rarityColor(item.rarity);
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(SH.panelX, py, SH.panelW - 10, SH.detailH);

    // Name
    ctx.fillStyle = rarityColor(item.rarity);
    ctx.font      = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, px, py + 28);

    // Rarity · type
    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.fillText(rarityLabel(item.rarity) + '  \u00b7  ' + item.type.charAt(0).toUpperCase() + item.type.slice(1), px, py + 48);

    drawDetailDivider(px, py + 58);

    // Stats in two columns
    const STAT_COLORS = { hp: '#ef4444', def: '#f97316', dmg: '#f59e0b', dex: '#22c55e', spd: '#3b82f6', int: '#a855f7', luck: '#ffd700' };
    const STAT_LABELS = { hp: 'HP', def: 'DEF', dmg: 'DMG', dex: 'DEX', spd: 'SPD', int: 'INT', luck: 'LUCK' };
    let col = 0, row = 0;
    for (const [key, val] of Object.entries(item.statBonus)) {
        if (!val) continue;
        ctx.fillStyle = val < 0 ? '#ef4444' : (STAT_COLORS[key] || '#ccc');
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText((val > 0 ? '+' : '') + val + ' ' + STAT_LABELS[key], px + col * 160, py + 80 + row * 24);
        col++;
        if (col >= 4) { col = 0; row++; }
    }

    const statRows = row + (col > 0 ? 1 : 0);
    let nextY = py + 80 + statRows * 24 + 10;

    // Passive
    if (item.passiveDesc) {
        drawDetailDivider(px, nextY);
        nextY += 14;
        ctx.fillStyle = '#8bc4aa';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Passive: ' + item.passiveDesc, px, nextY + 6);
        nextY += 24;
    }

    // Negative suffix warning
    if (item.suffixNegative) {
        const ofIdx = item.name.indexOf(' of ');
        if (ofIdx >= 0) {
            ctx.fillStyle = '#ef4444';
            ctx.font      = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('\u26a0 Cursed: ' + item.name.slice(ofIdx + 1), px, nextY + 6);
            nextY += 22;
        }
    }

    // Flavour text
    drawDetailDivider(px, nextY + 4);
    ctx.fillStyle = '#555';
    ctx.font      = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.description, px, nextY + 22);

    // BUY button — only for shop stock items
    if (shopStock.includes(item)) {
        const price     = SHOP_PRICES[item.rarity];
        const canAfford = state.gold >= price;
        ctx.fillStyle   = canAfford ? '#1a2e1a' : '#111';
        ctx.fillRect(SH.buyBtnX, SH.buyBtnY, SH.buyBtnW, SH.buyBtnH);
        ctx.strokeStyle = canAfford ? '#4ade80' : '#333';
        ctx.lineWidth   = 2;
        ctx.strokeRect(SH.buyBtnX, SH.buyBtnY, SH.buyBtnW, SH.buyBtnH);
        ctx.fillStyle   = canAfford ? '#4ade80' : '#555';
        ctx.font        = 'bold 15px monospace';
        ctx.textAlign   = 'center';
        ctx.fillText(canAfford ? 'BUY  \u25c6 ' + price + 'g' : 'NEED MORE GOLD', SH.buyBtnX + SH.buyBtnW / 2, SH.buyBtnY + 24);
    }
}

// Horizontal rule inside detail panel
function drawDetailDivider(x, y) {
    ctx.strokeStyle = '#2d2040';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(SH.panelX + SH.panelW - 24, y);
    ctx.stroke();
}

// Compact inventory sell list below the detail panel
function drawSellSection() {
    const inv = state.inventory || [];
    const px  = SH.panelX + 14;

    ctx.fillStyle = '#555';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2500\u2500 SELL INVENTORY (' + inv.length + ') \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500', px, SH.sellLabelY);

    if (inv.length === 0) {
        ctx.fillStyle = '#3a3040';
        ctx.font      = '13px monospace';
        ctx.fillText('Inventory is empty', px + 8, SH.sellStartY + 18);
        return;
    }

    const visible = Math.min(inv.length, SH.sellMaxRows);
    for (let i = 0; i < visible; i++) drawSellRow(inv[i], i);

    if (inv.length > SH.sellMaxRows) {
        ctx.fillStyle = '#555';
        ctx.font      = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u2026 and ' + (inv.length - SH.sellMaxRows) + ' more', SH.panelX + SH.panelW / 2, SH.sellStartY + (SH.sellMaxRows + 0.6) * SH.sellRowH);
    }
}

// One row in the sell list
function drawSellRow(item, index) {
    const y  = SH.sellStartY + index * SH.sellRowH;
    const px = SH.panelX + 14;
    const re = SH.panelX + SH.panelW - 10;

    ctx.fillStyle = index % 2 === 0 ? '#130f1c' : '#100c18';
    ctx.fillRect(px, y, SH.panelW - 24, SH.sellRowH - 2);

    ctx.fillStyle = item.suffixNegative ? '#ef4444' : rarityColor(item.rarity);
    ctx.font      = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, px + 6, y + 19);

    ctx.fillStyle = '#c2a020';
    ctx.font      = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + sellPrice(item) + 'g', re - 66, y + 19);

    const bx = re - 60;
    ctx.fillStyle   = '#1a1000';
    ctx.fillRect(bx, y + 2, 50, SH.sellRowH - 6);
    ctx.strokeStyle = '#a07000';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx, y + 2, 50, SH.sellRowH - 6);
    ctx.fillStyle   = '#ffd700';
    ctx.font        = 'bold 12px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('SELL', bx + 25, y + 17);
}

// ─── Right panel: forger mode ─────────────────────────────────────────────────

// Draw the full Forger panel
function drawForgerPanel() {
    const px  = SH.panelX + 14;
    const inv = state.inventory || [];

    // Header
    ctx.fillStyle = '#c2855b';
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2692 THE FORGER', px, SH.contentY + 18);

    ctx.fillStyle = '#555';
    ctx.font      = '12px monospace';
    ctx.fillText('Select an item from your inventory, then choose a service.', px, SH.contentY + 36);

    // Inventory list
    const listY = SH.contentY + 46;
    if (inv.length === 0) {
        ctx.fillStyle = '#3a3040';
        ctx.font      = '14px monospace';
        ctx.fillText('Your inventory is empty', px + 8, listY + 30);
    } else {
        const visible = Math.min(inv.length, SH.forgerMaxRows);
        for (let i = 0; i < visible; i++) drawForgerRow(inv[i], i, listY);
        if (inv.length > SH.forgerMaxRows) {
            ctx.fillStyle = '#555';
            ctx.font      = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('\u2026 and ' + (inv.length - SH.forgerMaxRows) + ' more', SH.panelX + SH.panelW / 2, listY + (SH.forgerMaxRows + 0.6) * SH.forgerRowH);
        }
    }

    // Selected item preview
    const previewY = SH.contentY + 46 + SH.forgerMaxRows * SH.forgerRowH + 10;
    if (forgerSelected) {
        drawForgerPreview(forgerSelected, previewY);
    } else {
        ctx.fillStyle = '#3a3040';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('No item selected', px, previewY + 18);
    }

    // Service buttons
    drawForgerButtons();
}

// One row in the forger inventory picker
function drawForgerRow(item, index, listY) {
    const y        = listY + index * SH.forgerRowH;
    const px       = SH.panelX + 14;
    const selected = forgerSelected === item;
    const hovered  = inRect(mouseX, mouseY, px, y, SH.panelW - 28, SH.forgerRowH - 2);

    ctx.fillStyle = selected ? '#2a1a3a' : hovered ? '#1a1228' : (index % 2 === 0 ? '#130f1c' : '#100c18');
    ctx.fillRect(px, y, SH.panelW - 28, SH.forgerRowH - 2);

    ctx.strokeStyle = selected ? '#a855f7' : 'transparent';
    ctx.lineWidth   = selected ? 1.5 : 0;
    ctx.strokeRect(px, y, SH.panelW - 28, SH.forgerRowH - 2);

    ctx.fillStyle = item.suffixNegative ? '#ef4444' : rarityColor(item.rarity);
    ctx.font      = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, px + 8, y + 19);

    // Rarity badge
    ctx.fillStyle = rarityColor(item.rarity);
    ctx.font      = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(rarityLabel(item.rarity), SH.panelX + SH.panelW - 24, y + 19);
}

// Preview panel showing the selected item's current name and stats
function drawForgerPreview(item, y) {
    const px = SH.panelX + 14;

    ctx.strokeStyle = '#3a2050';
    ctx.lineWidth   = 1;
    ctx.strokeRect(px, y, SH.panelW - 28, 52);

    ctx.fillStyle = rarityColor(item.rarity);
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, px + 8, y + 18);

    ctx.fillStyle = '#888';
    ctx.font      = '12px monospace';
    ctx.fillText(buildStatString(item.statBonus), px + 8, y + 36);

    if (item.passiveDesc) {
        ctx.fillStyle = '#8bc4aa';
        ctx.font      = '11px monospace';
        ctx.fillText(item.passiveDesc, px + 8, y + 50);
    }
}

// REROLL and UPGRADE buttons at the bottom of the forger panel
function drawForgerButtons() {
    const hasItem = forgerSelected !== null;

    // REROLL — 25g, always available if item selected
    const canReroll = hasItem && state.gold >= 25;
    ctx.fillStyle   = canReroll ? '#1a1000' : '#0d0d0d';
    ctx.fillRect(SH.forgerRerollX, SH.forgerRerollY, SH.forgerRerollW, SH.forgerRerollH);
    ctx.strokeStyle = canReroll ? '#c2855b' : '#333';
    ctx.lineWidth   = 2;
    ctx.strokeRect(SH.forgerRerollX, SH.forgerRerollY, SH.forgerRerollW, SH.forgerRerollH);
    ctx.fillStyle   = canReroll ? '#c2855b' : '#444';
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('REROLL  \u25c6 25g', SH.forgerRerollX + SH.forgerRerollW / 2, SH.forgerRerollY + 18);
    ctx.fillStyle = canReroll ? '#888' : '#333';
    ctx.font      = '11px monospace';
    ctx.fillText('Random tier — can go up or down', SH.forgerRerollX + SH.forgerRerollW / 2, SH.forgerRerollY + 34);

    // UPGRADE — 80g, disabled if legendary
    const atLegendary  = hasItem && forgerSelected.rarity === 'legendary';
    const canUpgrade   = hasItem && !atLegendary && state.gold >= 80;
    ctx.fillStyle      = canUpgrade ? '#0a1a2a' : '#0d0d0d';
    ctx.fillRect(SH.forgerUpgradeX, SH.forgerUpgradeY, SH.forgerUpgradeW, SH.forgerUpgradeH);
    ctx.strokeStyle    = canUpgrade ? '#60a5fa' : '#333';
    ctx.lineWidth      = 2;
    ctx.strokeRect(SH.forgerUpgradeX, SH.forgerUpgradeY, SH.forgerUpgradeW, SH.forgerUpgradeH);
    ctx.fillStyle      = canUpgrade ? '#60a5fa' : '#444';
    ctx.font           = 'bold 14px monospace';
    ctx.textAlign      = 'center';
    ctx.fillText(
        atLegendary ? 'UPGRADE  (MAX)' : 'UPGRADE  \u25c6 80g',
        SH.forgerUpgradeX + SH.forgerUpgradeW / 2, SH.forgerUpgradeY + 18
    );
    ctx.fillStyle = canUpgrade ? '#888' : '#333';
    ctx.font      = '11px monospace';
    ctx.fillText('Prefix one tier up — Common\u2192Legendary', SH.forgerUpgradeX + SH.forgerUpgradeW / 2, SH.forgerUpgradeY + 34);
}

// ─── Left panel: LEAVE button ─────────────────────────────────────────────────

function drawShopLeaveButton() {
    ctx.fillStyle   = '#1a0d2e';
    ctx.fillRect(SH.leaveBtnX, SH.leaveBtnY, SH.leaveBtnW, SH.leaveBtnH);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth   = 2;
    ctx.strokeRect(SH.leaveBtnX, SH.leaveBtnY, SH.leaveBtnW, SH.leaveBtnH);
    ctx.fillStyle   = '#a855f7';
    ctx.font        = 'bold 18px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('LEAVE SHOP', SH.leaveBtnX + SH.leaveBtnW / 2, SH.leaveBtnY + 26);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Returns true if LEAVE was clicked — all other interactions handled internally
function handleShopClick(x, y) {
    // LEAVE
    if (inRect(x, y, SH.leaveBtnX, SH.leaveBtnY, SH.leaveBtnW, SH.leaveBtnH)) return true;

    // Mode tabs
    if (inRect(x, y, SH.shopTabX, SH.tabY, SH.shopTabW, SH.tabH)) {
        shopMode = 'shop'; shopSelected = null; return null;
    }
    if (inRect(x, y, SH.forgerTabX, SH.tabY, SH.forgerTabW, SH.tabH)) {
        shopMode = 'forger'; forgerSelected = null; return null;
    }

    if (shopMode === 'shop') return handleShopModeClick(x, y);
    if (shopMode === 'forger') return handleForgerModeClick(x, y);
    return null;
}

// Click handling for shop mode
function handleShopModeClick(x, y) {
    // Card click — toggle selection
    for (let i = 0; i < 4; i++) {
        if (!shopStock[i]) continue;
        const col = i % 2;
        const row = Math.floor(i / 2);
        if (inRect(x, y, SH.cardX[col], SH.cardY[row], SH.cardW, SH.cardH)) {
            shopSelected = shopSelected === shopStock[i] ? null : shopStock[i];
            return null;
        }
    }

    // Potion slot click — buy immediately on click
    for (let i = 0; i < 3; i++) {
        if (!shopPotions[i]) continue;
        if (inRect(x, y, SH.potSlotX[i], SH.potRowY, SH.potSlotW, SH.potSlotH)) {
            const key   = shopPotions[i];
            const price = POTION_PRICES[key] || 30;
            const full  = (state.partyPotions || []).length >= getPartyPotionLimit();
            if (!full && state.gold >= price) {
                state.gold -= price;
                addPotionToParty(key);
                shopPotions[i] = null;
                saveRunProgress();
            }
            return null;
        }
    }

    // Relic card click — buy the act relic (visits 1-8 only)
    const relicKey = getActRelicKey();
    const count    = state.actShopCount || 0;
    if (relicKey && count >= 1 && count <= 8 &&
        inRect(x, y, SH.relicCardX, SH.relicCardY, SH.relicCardW, SH.relicCardH)) {
        if (!hasRelic(relicKey) && state.gold >= 400) {
            state.gold -= 400;
            acquireRelic(relicKey); // acquireRelic calls saveRunProgress() internally
        }
        return null;
    }

    // BUY button
    if (inRect(x, y, SH.buyBtnX, SH.buyBtnY, SH.buyBtnW, SH.buyBtnH)) {
        const item = shopSelected;
        if (!item || !shopStock.includes(item)) return null;
        const price = SHOP_PRICES[item.rarity];
        if (state.gold >= price) {
            state.gold -= price;
            state.inventory.push(item);
            shopStock[shopStock.indexOf(item)] = null;
            shopSelected = null;
            saveRunProgress();
        }
        return null;
    }

    // SELL buttons
    const inv     = state.inventory || [];
    const visible = Math.min(inv.length, SH.sellMaxRows);
    const re      = SH.panelX + SH.panelW - 10;
    for (let i = 0; i < visible; i++) {
        const ry = SH.sellStartY + i * SH.sellRowH;
        const bx = re - 60;
        if (inRect(x, y, bx, ry + 2, 50, SH.sellRowH - 6)) {
            state.gold += sellPrice(inv[i]);
            if (shopSelected === inv[i]) shopSelected = null;
            state.inventory.splice(i, 1);
            saveRunProgress();
            return null;
        }
    }

    return null;
}

// Click handling for forger mode
function handleForgerModeClick(x, y) {
    const inv     = state.inventory || [];
    const listY   = SH.contentY + 46;
    const px      = SH.panelX + 14;
    const visible = Math.min(inv.length, SH.forgerMaxRows);

    // Inventory row click — select item for forging
    for (let i = 0; i < visible; i++) {
        const ry = listY + i * SH.forgerRowH;
        if (inRect(x, y, px, ry, SH.panelW - 28, SH.forgerRowH - 2)) {
            forgerSelected = forgerSelected === inv[i] ? null : inv[i];
            return null;
        }
    }

    if (!forgerSelected) return null;

    // REROLL button
    if (inRect(x, y, SH.forgerRerollX, SH.forgerRerollY, SH.forgerRerollW, SH.forgerRerollH)) {
        if (state.gold >= 25) {
            state.gold -= 25;
            const idx     = state.inventory.indexOf(forgerSelected);
            const newItem = rerollItemPrefix(forgerSelected);
            state.inventory[idx] = newItem;
            forgerSelected = newItem;
            saveRunProgress();
        }
        return null;
    }

    // UPGRADE button
    if (inRect(x, y, SH.forgerUpgradeX, SH.forgerUpgradeY, SH.forgerUpgradeW, SH.forgerUpgradeH)) {
        if (state.gold >= 80 && forgerSelected.rarity !== 'legendary') {
            state.gold -= 80;
            const idx     = state.inventory.indexOf(forgerSelected);
            const newItem = upgradeItemPrefix(forgerSelected);
            if (newItem) {
                state.inventory[idx] = newItem;
                forgerSelected = newItem;
            }
            saveRunProgress();
        }
        return null;
    }

    return null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

// Return true if point (px, py) is inside rectangle (rx, ry, rw, rh)
function inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
