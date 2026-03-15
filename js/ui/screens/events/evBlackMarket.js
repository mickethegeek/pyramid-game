// ─── Event: The Black Market ──────────────────────────────────────────────────

function drawBlackMarket(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE BLACK MARKET', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A cloaked figure emerges from the shadows, laying a magnificent weapon before you.', 60, 148);
    ctx.fillText('The price? A binding pact that will follow your party to the summit.', 60, 168);

    // Divider
    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        // ── Left panel: THE OFFER ──────────────────────────────────────────
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('THE OFFER', 60, 212);

        drawEvItemCard(ev.item, 60, 220, 500, 110);

        // ── Right panel: THE PRICE ─────────────────────────────────────────
        const relic = RELIC_DATA[ev.cursedRelicKey];

        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('THE PRICE', 640, 212);

        drawEvCard(640, 220, 500, 110, '#ef4444');

        // Cursed badge
        ctx.fillStyle = '#7c3aed';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CURSED RELIC', 652, 242);

        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 15px monospace';
        ctx.fillText(relic.name, 652, 262);

        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        // Wrap description across 2 lines at ~450px
        const lines = evWrapText(relic.description, 460);
        lines.forEach((line, i) => ctx.fillText(line, 652, 284 + i * 18));

        // Warning
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('The relic takes hold the moment you reach for the item.', 600, 365);

        // Buttons
        drawEvBtn('ACCEPT THE DEAL', 330, 460, 240, 50, 'green');
        drawEvBtn('WALK AWAY',       630, 460, 180, 50, 'blue');

    } else {  // result
        const relic = RELIC_DATA[ev.cursedRelicKey];

        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Deal struck.', 60, 240);

        ctx.fillStyle = '#cccccc';
        ctx.font      = '16px monospace';
        ctx.fillText(ev.item.name + ' added to your inventory.', 60, 275);

        ctx.fillStyle = '#ef4444';
        ctx.fillText(relic.name + ' now follows your party.', 60, 300);

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleBlackMarketClick(x, y, ev) {
    if (ev.phase === 'intro') {
        if (evInRect(x, y, 330, 460, 240, 50)) {
            state.inventory.push(ev.item);
            acquireRelic(ev.cursedRelicKey);
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }
        if (evInRect(x, y, 630, 460, 180, 50)) return 'leave';
    }
    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }
    return null;
}