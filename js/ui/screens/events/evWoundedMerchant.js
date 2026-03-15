// ─── Event: The Wounded Merchant ─────────────────────────────────────────────

function drawWoundedMerchant(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE WOUNDED MERCHANT', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A merchant lies against a pillar, clutching a bleeding wound.', 60, 148);
    ctx.fillText('His remaining wares are scattered around him.', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        const canAfford = state.gold >= 40;

        // ── Left panel: HEAL HIM ──────────────────────────────────────────
        drawEvCard(60, 200, 500, 220, canAfford ? '#4ade80' : '#444');

        ctx.fillStyle = canAfford ? '#4ade80' : '#555';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('HEAL HIM', 74, 224);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Cost: 40 gold', 74, 248);
        ctx.fillText('He rewards your mercy with one of his finest wares.', 74, 268);

        // Item preview
        drawEvItemCard(ev.healItem, 74, 282, 472, 110);

        if (!canAfford) {
            ctx.fillStyle = '#ef4444';
            ctx.font      = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Not enough gold.', 74, 248);
        }

        // ── Right panel: LOOT HIS WARES ──────────────────────────────────
        drawEvCard(640, 200, 500, 220, '#ef4444');

        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LOOT HIS WARES', 654, 224);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText('Free. Take what you need while he cannot stop you.', 654, 248);
        ctx.fillText('You will find a Common item.', 654, 268);

        ctx.fillStyle = '#7c3aed';
        ctx.font      = 'bold 13px monospace';
        ctx.fillText('Cursed by Doubt relic applied:', 654, 298);

        const cd = RELIC_DATA['cursed_by_doubt'];
        ctx.fillStyle = '#888';
        ctx.font      = '12px monospace';
        const lines = evWrapText(cd.description, 460);
        lines.forEach((line, i) => ctx.fillText(line, 654, 318 + i * 18));

        // Buttons
        drawEvBtn('HEAL HIM  —  40g', 60,  460, 500, 50, canAfford ? 'green' : 'gray');
        drawEvBtn('LOOT HIS WARES',   640, 460, 500, 50, 'red');

    } else {  // result
        const isHeal = ev.choice === 'heal';

        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(isHeal ? 'He thanks you weakly.' : 'You pocket what you can.', 60, 240);

        ctx.fillStyle = '#cccccc';
        ctx.font      = '16px monospace';
        if (isHeal) {
            ctx.fillText(ev.healItem.name + ' — the merchant\'s gratitude is genuine.', 60, 275);
        } else {
            ctx.fillText('A common item acquired.', 60, 275);
            ctx.fillStyle = '#7c3aed';
            ctx.fillText('Cursed by Doubt now follows your party.', 60, 300);
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleWoundedMerchantClick(x, y, ev) {
    if (ev.phase === 'intro') {
        // HEAL HIM
        if (evInRect(x, y, 60, 460, 500, 50) && state.gold >= 40) {
            state.gold -= 40;
            state.inventory.push(ev.healItem);
            saveRunProgress();
            ev.choice = 'heal';
            ev.phase  = 'result';
            return null;
        }
        // LOOT
        if (evInRect(x, y, 640, 460, 500, 50)) {
            state.inventory.push(generateItem(null, 'common'));
            acquireRelic('cursed_by_doubt');
            saveRunProgress();
            ev.choice = 'loot';
            ev.phase  = 'result';
            return null;
        }
    }
    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }
    return null;
}