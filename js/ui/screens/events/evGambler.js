// ─── Event: The Gambler ───────────────────────────────────────────────────────

function drawGambler(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE GAMBLER', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A grinning figure sits alone at a stone table, a single coin spinning between his fingers.', 60, 148);
    ctx.fillText('He does not look surprised to see you.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        const canAfford = state.gold >= 60;

        ctx.fillStyle = '#cccccc';
        ctx.font      = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('"Simple game. 60 gold to play. Win — you get 180. Lose — you walk."', 60, 228);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Base win chance: 40%.  Each point of LUCK modifier adds +2%.', 60, 260);
        ctx.fillText('Choose your best gambler — their LUCK shifts the odds.', 60, 280);

        ctx.fillStyle = canAfford ? '#ffd700' : '#ef4444';
        ctx.font      = 'bold 16px monospace';
        ctx.fillText('Cost: 60 gold', 60, 316);

        drawEvBtn('PLAY  —  60g', 340, 460, 300, 50, canAfford ? 'gold' : 'gray');
        drawEvBtn('WALK AWAY',    680, 460, 200, 50, 'blue');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'confirm') {
        const ch  = ev.gamblerChar;
        const mod = ev.gamblerMod;
        const pct = Math.round(ev.gamblerChance * 100);

        drawEvCard(330, 190, 540, 230, '#ffd700');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('YOUR GAMBLER', 344, 218);

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 20px monospace';
        ctx.fillText(ch.name || ch.classKey, 344, 250);

        ctx.fillStyle = '#ffd700';
        ctx.font      = '14px monospace';
        ctx.fillText('LUCK  ' + ch.getStat('luck') + '   modifier: +' + mod, 344, 280);

        ctx.fillStyle = pct >= 50 ? '#4ade80' : '#f59e0b';
        ctx.font      = 'bold 26px monospace';
        ctx.fillText('Win chance: ' + pct + '%', 344, 330);

        ctx.fillStyle = '#666';
        ctx.font      = '13px monospace';
        ctx.fillText('(base 40% + ' + mod + ' \u00d7 2%)', 344, 354);

        drawEvBtn('GAMBLE', 330, 460, 260, 50, 'gold');
        drawEvBtn('BACK',   630, 460, 180, 50, 'blue');

    } else if (ev.phase === 'result') {
        const ch  = ev.gamblerChar;
        const won = ev.gamblerWon;

        ctx.fillStyle = won ? '#4ade80' : '#ef4444';
        ctx.font      = 'bold 30px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(won ? 'YOU WIN!' : 'YOU LOSE.', 60, 252);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText((ch.name || ch.classKey) + '  ·  LUCK ' + ch.getStat('luck') + '  ·  ' + Math.round(ev.gamblerChance * 100) + '% win chance', 60, 284);

        if (won) {
            ctx.fillStyle = '#ffd700';
            ctx.font      = 'bold 22px monospace';
            ctx.fillText('+180 gold', 60, 318);
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('"Double or nothing? Pay 180g back for a shot at 360g."', 60, 352);
            drawEvBtn('TAKE WINNINGS',     330, 460, 280, 50, 'green');
            drawEvBtn('DOUBLE OR NOTHING', 650, 460, 280, 50, 'gold');
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('"Better luck next time," he says, pocketing your coins.', 60, 318);
            drawEvBtn('WALK AWAY', 500, 460, 200, 50, 'blue');
        }

    } else if (ev.phase === 'doubleResult') {
        const won = ev.doubleWon;

        ctx.fillStyle = won ? '#ffd700' : '#ef4444';
        ctx.font      = 'bold 28px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(won ? 'DOUBLED UP!' : 'LOST IT ALL.', 60, 252);

        ctx.fillStyle = '#cccccc';
        ctx.font      = '15px monospace';
        ctx.fillText(won ? '+360 gold total. The gambler tips his hat.' : 'The gambler smiles and sweeps the table clean.', 60, 288);

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleGamblerClick(x, y, ev) {
    if (ev.phase === 'intro') {
        // PLAY: deduct entry fee and open character picker
        if (evInRect(x, y, 340, 460, 300, 50) && state.gold >= 60) {
            state.gold -= 60;
            ev.phase = 'picking';
            initCharacterPicker('luck', 'Who gambles at the table?');
            return null;
        }
        if (evInRect(x, y, 680, 460, 200, 50)) return 'leave';
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            const mod = Math.floor(chosen.getStat('luck') / 3);
            ev.gamblerChar   = chosen;
            ev.gamblerMod    = mod;
            ev.gamblerChance = Math.min(0.90, 0.40 + mod * 0.02);
            ev.phase = 'confirm';
        }
        return null;
    }

    if (ev.phase === 'confirm') {
        // GAMBLE: roll and immediately show result
        if (evInRect(x, y, 330, 460, 260, 50)) {
            const won     = Math.random() < ev.gamblerChance;
            ev.gamblerWon = won;
            if (won) state.gold += 180;
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }
        // BACK: refund entry fee and re-open picker
        if (evInRect(x, y, 630, 460, 180, 50)) {
            state.gold += 60;
            ev.phase = 'picking';
            initCharacterPicker('luck', 'Who gambles at the table?');
            return null;
        }
    }

    if (ev.phase === 'result') {
        if (ev.gamblerWon) {
            // TAKE WINNINGS: keep the 180g and leave
            if (evInRect(x, y, 330, 460, 280, 50)) {
                saveRunProgress();
                return 'leave';
            }
            // DOUBLE OR NOTHING: pay back winnings, re-roll, possibly get 360g
            if (evInRect(x, y, 650, 460, 280, 50)) {
                state.gold -= 180;
                const doubleWon = Math.random() < ev.gamblerChance;
                ev.doubleWon    = doubleWon;
                if (doubleWon) state.gold += 360;
                saveRunProgress();
                ev.phase = 'doubleResult';
                return null;
            }
        } else {
            if (evInRect(x, y, 500, 460, 200, 50)) return 'leave';
        }
    }

    if (ev.phase === 'doubleResult') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }

    return null;
}