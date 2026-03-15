// ─── Event: The Ancient Weapon Cache ─────────────────────────────────────────

function drawAncientWeaponCache(ev) {
    // Title
    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE ANCIENT WEAPON CACHE', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('Behind a false wall you find a sealed armory, weapons still gleaming after centuries.', 60, 148);
    ctx.fillText('One blade at the center radiates power.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        // Left: random weapon
        drawEvCard(60, 200, 520, 200, '#f59e0b');
        ctx.fillStyle = '#f59e0b';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('TAKE A RANDOM WEAPON', 74, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Grab whatever you can carry.', 74, 252);
        ctx.fillText('Free. Any rarity.', 74, 272);
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Weapon added to inventory', 74, 300);

        // Right: legendary blade
        drawEvCard(620, 200, 520, 200, '#3b82f6');
        ctx.fillStyle = '#3b82f6';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CLAIM THE LEGENDARY BLADE', 634, 228);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('The central blade calls to you.', 634, 252);
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Pass DC 15 (DMG): Rare+ weapon', 634, 282);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Fail: next room becomes Ambush', 634, 302);

        drawEvBtn('TAKE A RANDOM WEAPON',      60,  460, 520, 50, 'gold');
        drawEvBtn('CLAIM THE LEGENDARY BLADE', 620, 460, 520, 50, 'blue');

    } else if (ev.phase === 'picking') {
        drawCharacterPicker();

    } else if (ev.phase === 'rolling') {
        const ch  = ev.pickedChar;
        const mod = Math.floor(ch.getStat('dmg') / 3);

        tickDiceRoll();

        // Left: wielder card
        drawEvCard(60, 200, 400, 210, '#f97316');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#f97316';
        ctx.font      = 'bold 14px monospace';
        ctx.fillText('WIELDER', 74, 228);

        ctx.fillStyle = '#cccccc';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText(ch.name || ch.classKey, 74, 256);

        ctx.fillStyle = '#f59e0b';
        ctx.font      = '14px monospace';
        ctx.fillText('DMG  ' + ch.getStat('dmg') + '   modifier: +' + mod, 74, 284);

        // Die
        drawDiceRoll(578, 375);

        // Right: DC + outcome
        const total  = ev.rollValue + mod;
        const passed = total >= 15;
        const done   = isDiceRollDone();
        drawEvCard(660, 200, 480, 210, done ? (passed ? '#4ade80' : '#ef4444') : '#3a3530');
        ctx.textAlign = 'left';

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Difficulty  DC 15', 674, 230);

        if (!done) {
            ctx.fillStyle = '#555';
            ctx.font      = 'bold 16px monospace';
            ctx.fillText('Reaching for the blade...', 674, 270);
        } else {
            ctx.fillStyle = '#888';
            ctx.font      = '13px monospace';
            ctx.fillText('Total: ' + ev.rollValue + ' + ' + mod + ' = ' + total, 674, 258);
            if (passed) {
                ctx.fillStyle = '#4ade80';
                ctx.font      = 'bold 16px monospace';
                ctx.fillText('The blade yields to you!', 674, 292);
                ctx.fillStyle = '#ffd700';
                ctx.font      = '14px monospace';
                ctx.fillText('Rare+ weapon incoming.', 674, 318);
            } else {
                ctx.fillStyle = '#ef4444';
                ctx.font      = 'bold 16px monospace';
                ctx.fillText('The cache seals itself!', 674, 292);
                ctx.fillStyle = '#888';
                ctx.font      = '13px monospace';
                ctx.fillText('Enemies were alerted.', 674, 318);
                ctx.fillText('Next room: AMBUSH.', 674, 340);
            }
        }

        if (done) {
            drawEvBtn('CONTINUE', 480, 555, 240, 44, 'blue');
        }

    } else if (ev.phase === 'result') {
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';

        if (ev.cacheChoice === 'random') {
            ctx.fillText('You grab what you can carry.', 60, 248);
            ctx.fillStyle = evRarityColor(ev.cacheWeapon.rarity);
            ctx.font      = '15px monospace';
            ctx.fillText(ev.cacheWeapon.name + ' added to your inventory.', 60, 284);
        } else if (ev.cachePass) {
            ctx.fillText('The ancient blade is yours.', 60, 248);
            ctx.fillStyle = evRarityColor(ev.cacheWeapon.rarity);
            ctx.font      = '15px monospace';
            ctx.fillText(ev.cacheWeapon.name + ' added to your inventory.', 60, 284);
        } else {
            ctx.fillText('The cache is sealed. A trap springs.', 60, 248);
            ctx.fillStyle = '#ef4444';
            ctx.font      = '15px monospace';
            ctx.fillText('Enemies wait in the next room. Prepare for an Ambush.', 60, 284);
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleAncientWeaponCacheClick(x, y, ev) {
    if (ev.phase === 'intro') {
        // TAKE A RANDOM WEAPON: free item, immediate result
        if (evInRect(x, y, 60, 460, 520, 50)) {
            ev.cacheWeapon = generateItem('weapon');
            ev.cacheChoice = 'random';
            state.inventory.push(ev.cacheWeapon);
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }

        // CLAIM THE LEGENDARY BLADE: open picker for DMG stat
        if (evInRect(x, y, 620, 460, 520, 50)) {
            ev.phase = 'picking';
            initCharacterPicker('dmg', 'Who claims the blade?');
            return null;
        }
    }

    if (ev.phase === 'picking') {
        const chosen = handleCharacterPickerClick(x, y);
        if (chosen) {
            ev.pickedChar = chosen;
            ev.rollValue  = Math.ceil(Math.random() * 20);
            const mod     = Math.floor(chosen.getStat('dmg') / 3);
            ev.rollPassed = (ev.rollValue + mod) >= 15;
            ev.phase      = 'rolling';
            initDiceRoll(ev.rollValue, mod, 'DMG');
        }
        return null;
    }

    if (ev.phase === 'rolling') {
        if (!isDiceRollDone()) return null;
        if (evInRect(x, y, 480, 555, 240, 44)) {
            const mod    = Math.floor(ev.pickedChar.getStat('dmg') / 3);
            const passed = (ev.rollValue + mod) >= 15;
            ev.cachePass   = passed;
            ev.cacheChoice = 'claim';

            if (passed) {
                // Rare+ weapon: 30% legendary, 70% rare
                const rarity = Math.random() < 0.30 ? 'legendary' : 'rare';
                ev.cacheWeapon = generateItem('weapon', rarity);
                state.inventory.push(ev.cacheWeapon);
            } else {
                // Set all unvisited adjacent rooms to ambush by mutating the objects
                for (const room of state.adjacentRooms) {
                    if (!room.visited) room.type = 'ambush';
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