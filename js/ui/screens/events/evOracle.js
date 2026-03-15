// ─── Event: The Oracle ───────────────────────────────────────────────────────

function drawOracle(ev) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE ORACLE', 60, 110);

    // Narrative
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    ctx.fillText('A blind woman sits perfectly still amid the ruins, her white eyes finding you unerringly.', 60, 148);
    ctx.fillText('"I have been waiting."', 60, 168);

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 186); ctx.lineTo(1140, 186); ctx.stroke();

    if (ev.phase === 'intro') {
        const canAfford = state.gold >= 30;

        ctx.fillStyle = '#cccccc';
        ctx.font      = '15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('She will reveal the next rooms on your path.', 60, 224);
        ctx.fillText('Her knowledge has a price.', 60, 244);

        ctx.fillStyle = canAfford ? '#ffd700' : '#ef4444';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText('Cost: 30 gold', 60, 282);

        drawEvBtn('CONSULT HER  —  30g', 330, 460, 280, 50, canAfford ? 'gold' : 'gray');
        drawEvBtn('LEAVE',               670, 460, 140, 50, 'blue');

    } else {  // result — show room types
        ctx.fillStyle = '#ffd700';
        ctx.font      = 'bold 18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('She has spoken. The path ahead reveals itself.', 60, 224);

        const rooms = state.adjacentRooms.slice(0, 3);
        if (rooms.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font      = '14px monospace';
            ctx.fillText('No rooms lie ahead — the summit is near.', 60, 270);
        } else {
            const cardW = 300;
            const cardH = 120;
            const gap   = 30;
            const totalW = rooms.length * cardW + (rooms.length - 1) * gap;
            const startX = (1200 - totalW) / 2;

            rooms.forEach((room, i) => {
                const cx  = startX + i * (cardW + gap);
                const cy  = 256;
                const col = evRoomColor(room.type);

                drawEvCard(cx, cy, cardW, cardH, col);

                // Colour stripe at top
                ctx.fillStyle = col;
                ctx.fillRect(cx, cy, cardW, 6);

                ctx.fillStyle = col;
                ctx.font      = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(evRoomTypeName(room.type), cx + cardW / 2, cy + 42);

                ctx.fillStyle = '#666';
                ctx.font      = '12px monospace';
                ctx.fillText('Layer ' + room.layer, cx + cardW / 2, cy + 65);
            });
        }

        drawEvBtn('CONTINUE', 500, 520, 200, 44, 'blue');
    }
}

function handleOracleClick(x, y, ev) {
    if (ev.phase === 'intro') {
        if (evInRect(x, y, 330, 460, 280, 50) && state.gold >= 30) {
            state.gold -= 30;
            saveRunProgress();
            ev.phase = 'result';
            return null;
        }
        if (evInRect(x, y, 670, 460, 140, 50)) return 'leave';
    }
    if (ev.phase === 'result') {
        if (evInRect(x, y, 500, 520, 200, 44)) return 'leave';
    }
    return null;
}