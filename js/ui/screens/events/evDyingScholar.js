// ─── Event: The Dying Scholar ─────────────────────────────────────────────────

function drawDyingScholar(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE DYING SCHOLAR', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A robed man slumps against a pillar covered in inscriptions, his lamp nearly extinguished.', 60, 148);
    ctx.fillText('He looks up with desperate eyes.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        // Left: Stay option
        drawEvCard(60, 200, 520, 200, '#4ade80');
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STAY AND LISTEN', 74, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('He shares his last discovery. You receive a Rare item.', 74, 252);
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('INT roll DC 12 — success upgrades it to Legendary.', 74, 284);

        // Right: Leave option
        drawEvCard(620, 200, 520, 200, '#3b82f6');
        ctx.fillStyle = '#3b82f6';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LEAVE QUICKLY', 634, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('You have no time for this.', 634, 252);
        ctx.fillText('Nothing gained. Nothing lost.', 634, 272);

        drawEvBtn('STAY AND LISTEN', 60,  460, 520, 50, 'green');
        drawEvBtn('LEAVE QUICKLY',   620, 460, 520, 50, 'blue');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('int') / 3);

        tickDiceRoll();

        // Left: item card
        ctx.fillStyle = '#888';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText("THE SCHOLAR'S FIND", 74, 222);
        drawEvItemCard(ev.scholarItem, 60, 232, 430, 120);

        // Die in centre
        drawDiceRoll(578, 375);

        // Right: champion info + DC
        const total  = ev.rollValue + mod;
        const passed = total >= 12;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (passed ? '#ffd700' : '#94a3b8') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 15px monospace';
        ctx.fillText(ch.name || ch.classKey, 674, 232);

        ctx.fillStyle = '#a855f7';
        ctx.font      = '14px monospace';
        ctx.fillText('INT  ' + ch.getStat('int') + '   modifier: +' + mod, 674, 258);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 12', 674, 286);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 16px monospace';
            ctx.fillText('He whispers his secrets...', 674, 322);
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 314);
            if (passed) {
                ctx.fillStyle = '#ffd700';
                ctx.font      = 'bold 16px monospace';
                ctx.fillText('His words unlock its true power!', 674, 346);
                ctx.font      = 'bold 20px monospace';
                ctx.fillText('UPGRADED TO LEGENDARY', 674, 372);
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.font      = 'bold 14px monospace';
                ctx.fillText('You grasp only fragments.', 674, 346);
                ctx.fillStyle = '#888';
                ctx.font      = '13px monospace';
                ctx.fillText('Item remains Rare.', 674, 370);
            }
        }

        if (done) {
            drawEvBtn('TAKE THE ITEM', 480, 555, 300, 44, 'green');
        }

    } else if (ev.phase === 'result') {
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('He exhales slowly as you take his find.', 60, 248);

        ctx.fillStyle = evRarityColor(ev.scholarItem.rarity);
        ctx.font      = '16px monospace';
        ctx.fillText(ev.scholarItem.name + ' added to your inventory.', 60, 286);

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleDyingScholarClick(x, y, ev) {
    if (ev.phase === 'intro') {
        // STAY: generate the rare item then open picker
        if (evInRect(x, y, 60, 460, 520, 50)) {
            ev.scholarItem = generateItem(null, 'rare');
            ev.phase       = 'picking';
            initCharacterPicker('int', 'Who listens to the scholar?');
            return null;
        }
        if (evInRect(x, y, 620, 460, 520, 50)) return 'leave';
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('int') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 12;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'INT');
        }
        return null;
    }

    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        if (evInRect(x, y, 480, 555, 300, 44)) {
            // Upgrade to legendary on success
            const mod = Math.floor(ev.pickedChar.getStat('int') / 3);
            if ((ev.rollValue + mod) >= 12) {
                ev.scholarItem = generateItem(null, 'legendary');
            }
            state.inventory.push(ev.scholarItem);
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