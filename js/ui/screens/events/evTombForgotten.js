// ─── Event: Tomb of the Forgotten King ────────────────────────────────────────

function drawTombForgotten(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TOMB OF THE FORGOTTEN KING', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A sealed tomb bears the cartouche of a forgotten ruler.', 60, 148);
    ctx.fillText('The lock is old — but the warnings carved around it are not.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        const colW = 340;
        const cols = [60, 430, 800];

        // Col 1: LOOT BLINDLY
        drawEvCard(cols[0], 200, colW, 220, '#f59e0b');
        ctx.fillStyle = '#f59e0b';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LOOT BLINDLY', cols[0] + 14, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Force the lock and take whatever', cols[0] + 14, 252);
        ctx.fillText('is inside.', cols[0] + 14, 270);
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Free item', cols[0] + 14, 298);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('40% curse risk', cols[0] + 14, 318);

        // Col 2: STUDY INSCRIPTIONS
        drawEvCard(cols[1], 200, colW, 220, '#a855f7');
        ctx.fillStyle = '#a855f7';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STUDY INSCRIPTIONS', cols[1] + 14, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Decipher the warnings first.', cols[1] + 14, 252);
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Pass DC 14 (INT): item safe,', cols[1] + 14, 282);
        ctx.fillText('no curse guaranteed', cols[1] + 14, 300);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fail: cursed if you loot it', cols[1] + 14, 320);

        // Col 3: LEAVE IT SEALED
        drawEvCard(cols[2], 200, colW, 220, '#22c55e');
        ctx.fillStyle = '#22c55e';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LEAVE IT SEALED', cols[2] + 14, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('The dead deserve their rest.', cols[2] + 14, 252);
        ctx.fillText('Walk away with wisdom.', cols[2] + 14, 270);
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('+25 Soul Shards', cols[2] + 14, 298);

        drawEvBtn('LOOT BLINDLY',       cols[0], 460, colW, 50, 'gold');
        drawEvBtn('STUDY INSCRIPTIONS', cols[1], 460, colW, 50, 'blue');
        drawEvBtn('LEAVE IT SEALED',    cols[2], 460, colW, 50, 'green');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('int') / 3);

        tickDiceRoll();

        // Left: item preview
        ctx.fillStyle = '#888';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('INSIDE THE TOMB', 74, 222);
        drawEvItemCard(ev.tombItem, 60, 232, 430, 120);

        // Die in centre
        drawDiceRoll(578, 375);

        // Right: character + DC + outcome
        const total  = ev.rollValue + mod;
        const passed = total >= 14;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (passed ? '#4ade80' : '#ef4444') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 15px monospace';
        ctx.fillText(ch.name || ch.classKey, 674, 232);

        ctx.fillStyle = '#a855f7';
        ctx.font      = '14px monospace';
        ctx.fillText('INT  ' + ch.getStat('int') + '   modifier: +' + mod, 674, 258);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 14', 674, 286);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 16px monospace';
            ctx.fillText('Reading the carvings...', 674, 322);
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 314);
            if (passed) {
                ctx.fillStyle = '#4ade80';
                ctx.font      = 'bold 15px monospace';
                ctx.fillText('No curse. Safe to loot.', 674, 348);
            } else {
                const relic = RELIC_DATA[ev.tombRelicKey];
                ctx.fillStyle = '#ef4444';
                ctx.font      = 'bold 14px monospace';
                ctx.fillText('Curse detected:', 674, 340);
                ctx.fillStyle = '#7c3aed';
                ctx.font      = 'bold 13px monospace';
                ctx.fillText(relic.name + ' — triggers if looted', 674, 362);
            }
        }

        if (done) {
            drawEvBtn('TAKE THE ITEM', 500, 555, 280, 44, 'gold');
            drawEvBtn('LEAVE',         800, 555, 150, 44, 'blue');
        }

    } else if (ev.phase === 'result') {
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ev.tombChoice === 'loot' ? 'The tomb yields its secret.' : 'Your reading paid off.', 60, 248);

        ctx.fillStyle = evRarityColor(ev.tombItem.rarity);
        ctx.font      = '15px monospace';
        ctx.fillText(ev.tombItem.name + ' added to your inventory.', 60, 284);

        if (ev.tombCursed) {
            ctx.fillStyle = '#7c3aed';
            ctx.fillText(RELIC_DATA[ev.tombRelicKey].name + ' now follows your party.', 60, 312);
        } else {
            ctx.fillStyle = '#4ade80';
            ctx.fillText('No curse. Clean haul.', 60, 312);
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleTombForgottenClick(x, y, ev) {
    // All cursed relic keys pulled dynamically from RELIC_DATA
    const CURSED_KEYS = Object.keys(RELIC_DATA).filter(k => RELIC_DATA[k].cursed);

    if (ev.phase === 'intro') {
        const colW = 340;
        const cols = [60, 430, 800];

        // LOOT BLINDLY: item + 40% curse chance, applied immediately
        if (evInRect(x, y, cols[0], 460, colW, 50)) {
            ev.tombRelicKey = CURSED_KEYS[Math.floor(Math.random() * CURSED_KEYS.length)];
            ev.tombItem     = generateItem();
            ev.tombCursed   = Math.random() < 0.40;
            ev.tombChoice   = 'loot';
            if (ev.tombCursed) acquireRelic(ev.tombRelicKey);
            state.inventory.push(ev.tombItem);
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }

        // STUDY INSCRIPTIONS: pre-generate item and relic, then pick character
        if (evInRect(x, y, cols[1], 460, colW, 50)) {
            ev.tombItem     = generateItem();
            ev.tombRelicKey = CURSED_KEYS[Math.floor(Math.random() * CURSED_KEYS.length)];
            ev.phase        = 'picking';
            initCharacterPicker('int', 'Who studies the inscriptions?');
            return null;
        }

        // LEAVE IT SEALED: grant 25 Soul Shards and exit
        if (evInRect(x, y, cols[2], 460, colW, 50)) {
            state.meta.soulShards   += 25;
            state.soulShardsThisRun += 25;
            saveMetaProgress(state.meta);
            return 'leave';
        }
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('int') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 14;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'INT');
        }
        return null;
    }

    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        const mod    = Math.floor(ev.pickedChar.getStat('int') / 3);
        const passed = (ev.rollValue + mod) >= 14;

        // TAKE THE ITEM: apply curse if failed, always add item
        if (evInRect(x, y, 500, 555, 280, 44)) {
            ev.tombCursed = !passed;
            ev.tombChoice = 'study';
            if (!passed) acquireRelic(ev.tombRelicKey);
            state.inventory.push(ev.tombItem);
            clearDiceRoll();
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }

        // LEAVE: walk away, no item, no curse regardless of roll
        if (evInRect(x, y, 800, 555, 150, 44)) {
            clearDiceRoll();
            return 'leave';
        }
    }

    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }

    return null;
}