// ─── Event: The Ancient Altar ─────────────────────────────────────────────────

function drawAncientAltar(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE ANCIENT ALTAR', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A stone altar pulses with golden light, carved symbols shifting as you approach.', 60, 148);
    ctx.fillText('It hungers for an offering.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        ctx.fillStyle = '#cccccc';
        ctx.font      = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Send a champion to the altar. They will bleed for the ritual.', 60, 228);
        ctx.fillText('If their mind is sharp enough, the altar may reveal its gift before you commit.', 60, 252);

        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('Cost: 30% max HP from the chosen character', 60, 290);
        ctx.fillStyle = '#4ade80';
        ctx.fillText('Reward: +2 to a random stat (this run only)', 60, 312);

        drawEvBtn('APPROACH THE ALTAR', 390, 460, 420, 50, 'gold');

    } else if (ev.phase === 'picking') {
        // Overlay handled by the component; nothing else to draw
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('int') / 3);

        // Advance the die animation each frame
        tickDiceRoll();

        // ── Left card: champion info ───────────────────────────────────────
        drawEvCard(60, 200, 400, 210, '#ffd700');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('CHAMPION', 74, 228);

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText(ch.name || ch.classKey, 74, 256);

        ctx.fillStyle = '#a855f7';
        ctx.font      = '14px monospace';
        ctx.fillText('INT  ' + ch.getStat('int') + '   modifier: +' + mod, 74, 284);

        const hpLoss = Math.floor(ch.getMaxHP() * 0.3);
        ctx.fillStyle = '#ef4444';
        ctx.font      = '14px monospace';
        ctx.fillText('HP sacrifice: ' + hpLoss, 74, 312);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText(ch.currentHP + ' HP  →  ' + Math.max(1, ch.currentHP - hpLoss) + ' HP', 74, 334);

        // ── Die centred between the two cards ─────────────────────────────
        drawDiceRoll(578, 375);

        // ── Right card: DC and reveal ──────────────────────────────────────
        const total  = ev.rollValue + mod;
        const passed = total >= 11;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (passed ? '#4ade80' : '#94a3b8') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 11', 674, 230);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 18px monospace';
            ctx.fillText('The altar watches...', 674, 270);
        } else if (passed) {
            ctx.fillStyle = '#4ade80';
            ctx.font      = 'bold 15px monospace';
            ctx.fillText('The altar reveals its gift:', 674, 258);
            ctx.fillStyle = '#ffd700';
            ctx.font      = 'bold 28px monospace';
            ctx.fillText('+2 ' + ev.altarStat.toUpperCase(), 674, 298);
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 326);
        } else {
            ctx.fillStyle = '#94a3b8';
            ctx.font      = 'bold 15px monospace';
            ctx.fillText("The altar's intention is obscured.", 674, 258);
            ctx.fillStyle = '#666';
            ctx.font      = '13px monospace';
            ctx.fillText('You may commit blind — gift unknown.', 674, 284);
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 314);
        }

        // Buttons appear once the die has settled
        if (done) {
            drawEvBtn('COMMIT  —  sacrifice ' + hpLoss + ' HP', 500, 555, 430, 44, 'gold');
            drawEvBtn('LEAVE',                                    950, 555, 150, 44, 'blue');
        }

    } else if (ev.phase === 'result') {
        const ch = ev.pickedChar;
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('The altar accepts the offering.', 60, 248);

        ctx.fillStyle = '#ef4444';
        ctx.font      = '16px monospace';
        ctx.fillText((ch.name || ch.classKey) + ' loses ' + ev.hpLost + ' HP.', 60, 286);

        ctx.fillStyle = '#4ade80';
        ctx.fillText('+2 ' + ev.altarStat.toUpperCase() + ' granted to ' + (ch.name || ch.classKey) + ' for this run.', 60, 314);

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleAncientAltarClick(x, y, ev) {
    // APPROACH button — open the character picker
    if (ev.phase === 'intro') {
        if (evInRect(x, y, 390, 460, 420, 50)) {
            ev.phase = 'picking';
            initCharacterPicker('int', 'Who approaches the altar?');
        }
        return null;
    }

    // Character picker — selecting a champion locks in the roll
    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            const STATS   = ['hp', 'def', 'dmg', 'dex', 'spd', 'int', 'luck'];
            ev.altarStat  = STATS[Math.floor(Math.random() * STATS.length)];
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('int') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 11;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'INT');
        }
        return null;
    }

    // Rolling phase — only interactive once the die has settled
    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        const ch = ev.pickedChar;

        // COMMIT: pay HP, apply stat bonus
        if (evInRect(x, y, 500, 555, 430, 44)) {
            const hpLoss = Math.floor(ch.getMaxHP() * 0.3);
            ch.currentHP = Math.max(1, ch.currentHP - hpLoss);
            ev.hpLost    = hpLoss;
            ch.runBonus[ev.altarStat] = (ch.runBonus[ev.altarStat] || 0) + 2;
            clearDiceRoll();
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }

        // LEAVE: no cost — back to pyramid
        if (evInRect(x, y, 950, 555, 150, 44)) {
            clearDiceRoll();
            return 'leave';
        }
    }

    // Result screen — CONTINUE returns to pyramid
    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }

    return null;
}