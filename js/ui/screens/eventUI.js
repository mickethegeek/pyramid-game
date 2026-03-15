// Event screen — choice-based and roll-based encounters
// Group 1: Black Market, Deserter, Wounded Merchant, Oracle (+ Hero Encounter)
// Groups 2+ will add the remaining 7 events.



// ─── Event selection ──────────────────────────────────────────────────────────

// Group 1 + 2 temporary weights — equal distribution across implemented events.
// Final weights will be set after all groups are complete.
const EV_WEIGHTS = [
    ['heroEncounter',    20],
    ['black_market',     6],
    ['deserter',         7],
    ['wounded_merchant', 7],
    ['oracle',           7],
    ['ancient_altar',    8],
    ['dying_scholar',    8],
    ['mirage',           8],
    ['pit_fighter',      6],
    ['tomb_forgotten',   8],
    ['weapon_cache',     7],
    ['gambler',          8],
];

// Return a weighted-random event key
function pickEventKey() {
    const total = EV_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [key, w] of EV_WEIGHTS) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return EV_WEIGHTS[0][0];
}

// Build the correct event state object and return it — called from main.js
function pickAndCreateEvent() {
    const key = pickEventKey();
    if (key === 'heroEncounter') return generateHeroEncounterEvent();

    const ev = { type: 'narrative', eventKey: key, phase: 'intro', choice: null };

    switch (key) {
        case 'black_market':
            ev.item          = generateItem(null, 'legendary');
            ev.cursedRelicKey = Math.random() < 0.5 ? 'veil_of_greed' : 'blood_pact';
            break;
        case 'deserter':
            // Pre-generate the weapon so it's visible in the intro
            ev.weaponItem = generateItem('weapon', Math.random() < 0.4 ? 'uncommon' : 'common');
            break;
        case 'wounded_merchant':
            // Uncommon item = shop value ~70g, more than the 40g healing cost
            ev.healItem = generateItem(null, 'uncommon');
            break;
        case 'oracle':
            break;  // nothing to pre-generate
        case 'ancient_altar':
            break;  // altarStat and rollValue are set when the character is chosen
        case 'dying_scholar':
            break;  // scholarItem generated when player chooses to stay
        case 'mirage':
            break;  // no pre-generation needed
        case 'pit_fighter':
            break;  // no pre-generation needed
        case 'tomb_forgotten':
            break;  // tombItem and tombRelicKey set when player chooses to study
        case 'weapon_cache':
            break;  // no pre-generation needed
        case 'gambler':
            break;  // no pre-generation needed
    }

    return ev;
}

// ─── Main draw + click entry ──────────────────────────────────────────────────

// Route drawing to the correct event type
function drawEventScreen() {
    const ev = state.currentEvent;
    if (!ev) return;

    drawEventBackground();
    drawEventHeader();

    if (ev.type === 'heroEncounter') { drawHeroEncounterScreen(ev); return; }

    switch (ev.eventKey) {
        case 'black_market':     drawBlackMarket(ev);     break;
        case 'deserter':         drawDeserter(ev);         break;
        case 'wounded_merchant': drawWoundedMerchant(ev);  break;
        case 'oracle':           drawOracle(ev);           break;
        case 'ancient_altar':   drawAncientAltar(ev);    break;
        case 'dying_scholar':   drawDyingScholar(ev);   break;
        case 'mirage':          drawMirage(ev);          break;
        case 'pit_fighter':     drawPitFighter(ev);          break;
        case 'tomb_forgotten':  drawTombForgotten(ev);       break;
        case 'weapon_cache':    drawAncientWeaponCache(ev);  break;
        case 'gambler':         drawGambler(ev);             break;
        default:                drawStubEvent(ev);            break;
    }
}

// Returns 'recruit' | 'leave' | null
function handleEventClick(x, y) {
    const ev = state.currentEvent;
    if (!ev) return null;

    if (ev.type === 'heroEncounter') return handleHeroEncounterClick(x, y, ev);

    switch (ev.eventKey) {
        case 'black_market':     return handleBlackMarketClick(x, y, ev);
        case 'deserter':         return handleDeserterClick(x, y, ev);
        case 'wounded_merchant': return handleWoundedMerchantClick(x, y, ev);
        case 'oracle':           return handleOracleClick(x, y, ev);
        case 'ancient_altar':   return handleAncientAltarClick(x, y, ev);
        case 'dying_scholar':   return handleDyingScholarClick(x, y, ev);
        case 'mirage':          return handleMirageClick(x, y, ev);
        case 'pit_fighter':     return handlePitFighterClick(x, y, ev);
        case 'tomb_forgotten':  return handleTombForgottenClick(x, y, ev);
        case 'weapon_cache':    return handleAncientWeaponCacheClick(x, y, ev);
        case 'gambler':         return handleGamblerClick(x, y, ev);
        default: {
            // Stub: any click returns to pyramid
            if (x > 0) return 'leave';
            return null;
        }
    }
}

/*
// ─── Stub for unimplemented events ────────────────────────────────────────────

// Placeholder shown until the remaining groups are implemented
function drawStubEvent(ev) {
    ctx.fillStyle = '#cccccc';
    ctx.font      = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Event coming soon...', 600, 340);

    drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
}
*/ 
