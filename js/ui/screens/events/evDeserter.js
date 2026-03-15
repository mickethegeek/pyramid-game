// ─── Event: The Deserter ─────────────────────────────────────────────────────

function drawDeserter(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE DESERTER', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A soldier in tattered enemy colors crouches behind a crumbling wall, eyes wide with fear.', 60, 148);
    ctx.fillText('He raises his hands slowly.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        // Three option columns
        const colW = 340;
        const cols = [60, 430, 800];

        // ── Col 1: RECRUIT HIM ─────────────────────────────────────────────
        const partyFull = state.party.length >= 6;
        drawEvCard(cols[0], 200, colW, 230, partyFull ? '#444' : '#4ade80');
        ctx.fillStyle = partyFull ? '#555' : '#4ade80';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('RECRUIT HIM', cols[0] + 14, 224);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Adds a Warrior to your party.', cols[0] + 14, 248);
        ctx.fillText('No cost.', cols[0] + 14, 266);
        ctx.fillStyle = partyFull ? '#ef4444' : '#666';
        ctx.fillText('Party: ' + state.party.length + ' / 6', cols[0] + 14, 290);
        if (partyFull) ctx.fillText('Party is full!', cols[0] + 14, 308);

        // ── Col 2: TAKE HIS WEAPON ────────────────────────────────────────
        drawEvCard(cols[1], 200, colW, 230, '#f59e0b');
        ctx.fillStyle = '#f59e0b';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('TAKE HIS WEAPON', cols[1] + 14, 224);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('He surrenders his weapon.', cols[1] + 14, 248);
        // Show weapon name in its rarity color
        ctx.fillStyle = evRarityColor(ev.weaponItem.rarity);
        ctx.font      = 'bold 13px monospace';
        ctx.fillText(ev.weaponItem.name, cols[1] + 14, 274);
        // Stat preview
        const STAT_COLORS = { hp:'#ef4444', def:'#f97316', dmg:'#f59e0b', dex:'#22c55e', spd:'#3b82f6', int:'#a855f7', luck:'#ffd700' };
        let sx = cols[1] + 14;
        ctx.font = '12px monospace';
        for (const [stat, val] of Object.entries(ev.weaponItem.statBonus)) {
            if (!val) continue;
            ctx.fillStyle = STAT_COLORS[stat] || '#ccc';
            const lbl = (val > 0 ? '+' : '') + val + ' ' + stat.toUpperCase() + '  ';
            ctx.fillText(lbl, sx, 294);
            sx += ctx.measureText(lbl).width;
        }

        // ── Col 3: LET HIM GO ─────────────────────────────────────────────
        drawEvCard(cols[2], 200, colW, 230, '#a855f7');
        ctx.fillStyle = '#a855f7';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LET HIM GO', cols[2] + 14, 224);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('He disappears into the desert.', cols[2] + 14, 248);
        ctx.fillText('Your party feels a moment of grace.', cols[2] + 14, 266);
        ctx.fillStyle = '#fde68a';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Whole party gains Bless', cols[2] + 14, 292);
        ctx.fillStyle = '#888';
        ctx.font      = '12px monospace';
        ctx.fillText('(heals 4 HP / turn for 2 turns)', cols[2] + 14, 310);

        // Buttons
        drawEvBtn('RECRUIT HIM',     cols[0], 460, colW, 50, partyFull ? 'gray' : 'green');
        drawEvBtn('TAKE HIS WEAPON', cols[1], 460, colW, 50, 'gold');
        drawEvBtn('LET HIM GO',      cols[2], 460, colW, 50, 'blue');

    } else {  // result
        const msgs = {
            recruit: 'A Warrior joins your party.',
            weapon:  ev.weaponItem.name + ' added to your inventory.',
            letgo:   'The soldier vanishes into the desert. Your party feels a moment of grace. Bless applied.',
        };

        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Done.', 60, 240);

        ctx.fillStyle = '#cccccc';
        ctx.font      = '16px monospace';
        ctx.fillText(msgs[ev.choice] || '', 60, 275);

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleDeserterClick(x, y, ev) {
    if (ev.phase === 'intro') {
        const cols = [60, 430, 800];
        const colW = 340;

        // RECRUIT
        if (!state.party.length >= 6 || state.party.length < 6) {
            if (evInRect(x, y, cols[0], 460, colW, 50) && state.party.length < 6) {
                const warrior = createWarrior();
                applyPermanentBonus(warrior);
                state.party.push(warrior);
                if (!state.player) state.player = state.party[0];
                saveRunProgress();
                ev.choice = 'recruit';
                ev.phase  = 'result';
                return null;
            }
        }

        // TAKE WEAPON
        if (evInRect(x, y, cols[1], 460, colW, 50)) {
            state.inventory.push(ev.weaponItem);
            saveRunProgress();
            ev.choice = 'weapon';
            ev.phase  = 'result';
            return null;
        }

        // LET HIM GO
        if (evInRect(x, y, cols[2], 460, colW, 50)) {
            for (const m of state.party) {
                if (m.isAlive()) applyStatusEffect(m, 'bless', function () {});
            }
            saveRunProgress();
            ev.choice = 'letgo';
            ev.phase  = 'result';
            return null;
        }
    }
    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }
    return null;
}
