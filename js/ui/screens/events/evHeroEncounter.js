// ─── Hero encounter data (moved here from main.js) ────────────────────────────

const HERO_CLASS_DATA = {
    warrior:   { name: 'Warrior',   stats: { hp: 120, def:  8, dmg: 10, dex:  6, spd:  7, int:  3, luck:  5 } },
    barbarian: { name: 'Barbarian', stats: { hp: 140, def:  4, dmg: 16, dex:  4, spd: 10, int:  2, luck:  5 } },
    cleric:    { name: 'Cleric',    stats: { hp:  70, def:  4, dmg: 12, dex:  6, spd:  5, int: 16, luck:  6 } },
    archer:    { name: 'Archer',    stats: { hp:  85, def:  3, dmg: 13, dex: 16, spd: 14, int:  4, luck: 10 } },
    wizard:    { name: 'Wizard',    stats: { hp:  55, def:  2, dmg:  8, dex:  4, spd:  6, int: 20, luck:  4 } },
    paladin:   { name: 'Paladin',   stats: { hp: 110, def: 10, dmg:  9, dex:  4, spd:  5, int:  8, luck: 10 } },
    summoner:  { name: 'Summoner',  stats: { hp:  65, def:  3, dmg:  6, dex:  6, spd:  8, int: 14, luck: 12 } },
};

const HERO_NAMES = [
    'Aldric', 'Seraphina', 'Torben', 'Mira', 'Draven', 'Lysa', 'Orion',
    'Vesper', 'Cain', 'Theron', 'Isla', 'Remy', 'Corvin', 'Zara', 'Brom',
];

// Pick a hero class — undiscovered classes get 3× weight
function pickHeroClass() {
    const classes = Object.keys(HERO_CLASS_DATA);
    const weights = classes.map(k => isClassDiscovered(k) ? 1 : 3);
    const total   = weights.reduce((a, b) => a + b, 0);
    let   roll    = Math.random() * total;
    for (let i = 0; i < classes.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return classes[i];
    }
    return classes[0];
}

// Build a hero encounter event object
function generateHeroEncounterEvent() {
    const classKey  = pickHeroClass();
    const classData = HERO_CLASS_DATA[classKey];
    const firstName = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
    return {
        type:      'heroEncounter',
        classKey:  classKey,
        className: classData.name,
        heroName:  firstName + ' the ' + classData.name,
        stats:     classData.stats,
    };
}

// ─── Hero encounter screen ────────────────────────────────────────────────────

function drawHeroEncounterScreen(ev) {
    drawHeroIntroText();
    drawHeroCard(ev);
    drawHeroEncounterButtons(ev);
}

function drawHeroIntroText() {
    ctx.fillStyle = '#c2855b';
    ctx.font      = '18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('A wandering hero appears before you...', 600, 115);
}

function drawHeroCard(ev) {
    const px = 300, py = 138, pw = 600, ph = 210;

    ctx.fillStyle   = '#1a1408';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(ev.heroName.toUpperCase(), px + 20, py + 38);

    const roles = {
        warrior:'Tank / CC', barbarian:'Berserker', cleric:'Healer',
        archer:'Fast Sniper', wizard:'Glass Cannon', paladin:'Hybrid Tank', summoner:'Summoner',
    };
    ctx.fillStyle = '#888';
    ctx.font      = '14px monospace';
    ctx.fillText('Class: ' + ev.className + '  ·  ' + (roles[ev.classKey] || ''), px + 20, py + 60);

    ctx.strokeStyle = '#3a3530'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 16, py + 74); ctx.lineTo(px + pw - 16, py + 74); ctx.stroke();

    const s = ev.stats;
    const SC = { HP:'#ef4444', DEF:'#f97316', DMG:'#f59e0b', DEX:'#22c55e', SPD:'#3b82f6', INT:'#a855f7', LUCK:'#ffd700' };
    const row1 = [['HP',s.hp],['DEF',s.def],['DMG',s.dmg],['DEX',s.dex]];
    const row2 = [['SPD',s.spd],['INT',s.int],['LUCK',s.luck]];

    ctx.font = '15px monospace'; ctx.textAlign = 'left';
    row1.forEach(([l, v], i) => { ctx.fillStyle = SC[l]; ctx.fillText(l + '  ' + v, px + 20 + i * 140, py + 108); });
    row2.forEach(([l, v], i) => { ctx.fillStyle = SC[l]; ctx.fillText(l + '  ' + v, px + 20 + i * 140, py + 134); });

    if (!isClassDiscovered(ev.classKey)) {
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
        ctx.fillText('\u2605 NEW CLASS  —  +25 Soul Shards on recruit', px + pw - 16, py + 178);
    }

    const partyFull = state.party.length >= 6;
    const canAfford = state.gold >= 50;
    ctx.fillStyle = '#666'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Party: ' + state.party.length + ' / 6 members  ·  Recruit cost: 50 gold', 600, py + ph + 30);
    if (partyFull || !canAfford) {
        ctx.fillStyle = '#ef4444'; ctx.font = '13px monospace';
        ctx.fillText(partyFull ? 'Your party is full' : 'Not enough gold to recruit', 600, py + ph + 52);
    }
}

function drawHeroEncounterButtons(ev) {
    const canRecruit = state.gold >= 50 && state.party.length < 6;
    const rl = { x: 360, y: 530, w: 210, h: 50 };
    const ll = { x: 630, y: 530, w: 160, h: 50 };

    drawEvBtn(
        state.party.length >= 6 ? 'PARTY FULL' : !canRecruit ? 'NEED MORE GOLD' : 'RECRUIT  —  50g',
        rl.x, rl.y, rl.w, rl.h, canRecruit ? 'green' : 'gray'
    );
    drawEvBtn('LEAVE', ll.x, ll.y, ll.w, ll.h, 'blue');
}

function handleHeroEncounterClick(x, y, ev) {
    if (state.gold >= 50 && state.party.length < 6 && evInRect(x, y, 360, 530, 210, 50)) return 'recruit';
    if (evInRect(x, y, 630, 530, 160, 50)) return 'leave';
    return null;
}

