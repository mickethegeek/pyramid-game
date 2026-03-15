// ─── Event: The Pit Fighter ───────────────────────────────────────────────────

function drawPitFighter(ev) {
    // Title
    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE PIT FIGHTER', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A roaring crowd surrounds a sand pit where a scarred fighter waits, arms spread.', 60, 148);
    ctx.fillText('A promoter catches your eye and grins.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        // Left: Enter option
        drawEvCard(60, 200, 520, 200, '#f97316');
        ctx.fillStyle = '#f97316';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('ENTER THE PIT', 74, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('One hero steps into the sand.', 74, 252);
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Win (DC 13 SPD):  80 gold + Bless', 74, 284);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Lose:  30 damage + 20 gold consolation', 74, 306);

        // Right: Watch option
        drawEvCard(620, 200, 520, 200, '#3b82f6');
        ctx.fillStyle = '#3b82f6';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('WATCH AND LEAVE', 634, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('The crowd jeers as you walk away.', 634, 252);
        ctx.fillText('Nothing gained. Nothing lost.', 634, 272);

        drawEvBtn('ENTER THE PIT',    60,  460, 520, 50, 'orange');
        drawEvBtn('WATCH AND LEAVE',  620, 460, 520, 50, 'blue');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('spd') / 3);

        tickDiceRoll();

        // Left: fighter card
        drawEvCard(60, 200, 400, 210, '#f97316');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#f97316';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('YOUR FIGHTER', 74, 228);

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText(ch.name || ch.classKey, 74, 256);

        ctx.fillStyle = '#3b82f6';
        ctx.font      = '14px monospace';
        ctx.fillText('SPD  ' + ch.getStat('spd') + '   modifier: +' + mod, 74, 284);

        // Die
        drawDiceRoll(578, 375);

        // Right: DC + outcome preview
        const total  = ev.rollValue + mod;
        const won    = total >= 13;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (won ? '#4ade80' : '#ef4444') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 13', 674, 230);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 16px monospace';
            ctx.fillText('The crowd roars...', 674, 270);
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 258);
            if (won) {
                ctx.fillStyle = '#4ade80';
                ctx.font      = 'bold 18px monospace';
                ctx.fillText('VICTORY!', 674, 294);
                ctx.fillStyle = '#ffd700';
                ctx.font      = '14px monospace';
                ctx.fillText('+80 gold', 674, 322);
                ctx.fillStyle = '#fde68a';
                ctx.fillText('Bless on ' + (ch.name || ch.classKey), 674, 344);
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.font      = 'bold 18px monospace';
                ctx.fillText('DEFEATED.', 674, 294);
                ctx.fillStyle = '#ef4444';
                ctx.font      = '14px monospace';
                ctx.fillText('30 damage to ' + (ch.name || ch.classKey), 674, 322);
                ctx.fillStyle = '#ffd700';
                ctx.fillText('+20 gold consolation', 674, 344);
            }
        }

        if (done) {
            drawEvBtn('COLLECT AND LEAVE', 480, 555, 300, 44, 'blue');
        }

    } else if (ev.phase === 'result') {
        const ch  = ev.pickedChar;
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';

        if (ev.pitWon) {
            ctx.fillText('The crowd erupts. A champion walks free.', 60, 248);
            ctx.fillStyle = '#ffd700';
            ctx.font      = '15px monospace';
            ctx.fillText('+80 gold. Bless on ' + (ch.name || ch.classKey) + '.', 60, 286);
        } else {
            ctx.fillText('The sand drinks deep. You collect your consolation.', 60, 248);
            ctx.fillStyle = '#ef4444';
            ctx.font      = '15px monospace';
            ctx.fillText((ch.name || ch.classKey) + ' takes 30 damage.', 60, 286);
            ctx.fillStyle = '#ffd700';
            ctx.fillText('+20 gold.', 60, 310);
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handlePitFighterClick(x, y, ev) {
    if (ev.phase === 'intro') {
        if (evInRect(x, y, 60, 460, 520, 50)) {
            ev.phase = 'picking';
            initCharacterPicker('spd', 'Who fights in the pit?');
            return null;
        }
        if (evInRect(x, y, 620, 460, 520, 50)) return 'leave';
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('spd') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 13;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'SPD');
        }
        return null;
    }

    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        if (evInRect(x, y, 480, 555, 300, 44)) {
            const ch  = ev.pickedChar;
            const mod = Math.floor(ch.getStat('spd') / 3);
            const won = (ev.rollValue + mod) >= 13;
            ev.pitWon = won;

            if (won) {
                state.gold += 80;
                applyStatusEffect(ch, 'bless', () => {});
            } else {
                ch.currentHP = Math.max(1, ch.currentHP - 30);
                state.gold  += 20;
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