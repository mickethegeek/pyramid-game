// ─── Event: The Mirage ────────────────────────────────────────────────────────

function drawMirage(ev) {
    // Title
    ctx.fillStyle = '#3b82f6';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE MIRAGE', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('An impossibly beautiful oasis shimmers ahead, cool water reflecting the pyramid walls.', 60, 148);
    ctx.fillText('Your party moves toward it instinctively.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        ctx.fillStyle = '#cccccc';
        ctx.font      = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Someone must assess the oasis before the party rushes in.', 60, 228);
        ctx.fillText('A sharp mind may see through the illusion.', 60, 252);

        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Pass (DC 13): illusion detected — whole party heals 25% HP safely.', 60, 290);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fail: the party drinks — Poisoned for 2 fights.', 60, 312);

        drawEvBtn('SEND A SCOUT', 390, 460, 420, 50, 'blue');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('int') / 3);

        tickDiceRoll();

        // Left: scout card
        drawEvCard(60, 200, 400, 210, '#3b82f6');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#3b82f6';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('SCOUT', 74, 228);

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText(ch.name || ch.classKey, 74, 256);

        ctx.fillStyle = '#a855f7';
        ctx.font      = '14px monospace';
        ctx.fillText('INT  ' + ch.getStat('int') + '   modifier: +' + mod, 74, 284);

        // Die
        drawDiceRoll(578, 375);

        // Right: DC + outcome preview
        const total  = ev.rollValue + mod;
        const passed = total >= 13;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (passed ? '#4ade80' : '#ef4444') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 13', 674, 230);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 16px monospace';
            ctx.fillText('They approach carefully...', 674, 270);
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 258);
            if (passed) {
                ctx.fillStyle = '#4ade80';
                ctx.font      = 'bold 16px monospace';
                ctx.fillText('Illusion detected!', 674, 292);
                ctx.fillStyle = '#888';
                ctx.font      = '13px monospace';
                ctx.fillText('Party warned. All heroes heal 25% HP.', 674, 318);
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.font      = 'bold 16px monospace';
                ctx.fillText('They drink deeply...', 674, 292);
                ctx.fillStyle = '#888';
                ctx.font      = '13px monospace';
                ctx.fillText('The water is tainted.', 674, 318);
                ctx.fillText('Whole party Poisoned for 2 fights.', 674, 340);
            }
        }

        if (done) {
            drawEvBtn('CONTINUE', 480, 555, 240, 44, 'blue');
        }

    } else if (ev.phase === 'result') {
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';

        if (ev.miragePassed) {
            ctx.fillText('"It is not real!" The party pulls back.', 60, 248);
            ctx.fillStyle = '#4ade80';
            ctx.font      = '15px monospace';
            ctx.fillText('All living heroes healed for 25% of their max HP.', 60, 286);
        } else {
            ctx.fillText('The water burns going down.', 60, 248);
            ctx.fillStyle = '#ef4444';
            ctx.font      = '15px monospace';
            ctx.fillText('All living heroes are Poisoned.', 60, 286);
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleMirageClick(x, y, ev) {
    if (ev.phase === 'intro') {
        if (evInRect(x, y, 390, 460, 420, 50)) {
            ev.phase = 'picking';
            initCharacterPicker('int', 'Who scouts the oasis?');
        }
        return null;
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('int') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 13;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'INT');
        }
        return null;
    }

    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        if (evInRect(x, y, 480, 555, 240, 44)) {
            const ch     = ev.pickedChar;
            const mod    = Math.floor(ch.getStat('int') / 3);
            const passed = (ev.rollValue + mod) >= 13;
            ev.miragePassed = passed;

            if (passed) {
                // Heal all living party members 25% max HP
                for (const m of state.party) {
                    if (m.isAlive()) {
                        const heal = Math.floor(m.getMaxHP() * 0.25);
                        m.currentHP = Math.min(m.getMaxHP(), m.currentHP + heal);
                    }
                }
            } else {
                // Poison all living party members — duration 6 ticks (~2 fights)
                for (const m of state.party) {
                    if (m.isAlive()) {
                        applyStatusEffect(m, 'poison', () => {});
                        const eff = m.activeEffects.find(e => e.key === 'poison');
                        if (eff) eff.turnsLeft = 6;
                    }
                }
            }

            clearDiceRoll();
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }
    }

    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }

    return null;
}