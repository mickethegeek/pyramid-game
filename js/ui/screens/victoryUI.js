// Victory screen — shown when the player defeats the boss

// Button bounds
const VICTORY_BTN = { x: 500, y: 430, w: 200, h: 50 };

// Draw the full victory screen
function drawVictoryScreen() {
    // Dark gold background
    ctx.fillStyle = '#0e0b00';
    ctx.fillRect(0, 0, 1200, 640);

    // Faint grid lines for atmosphere
    ctx.strokeStyle = '#2a2200';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 640);
        ctx.stroke();
    }

    // "VICTORY" title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY', 600, 200);

    // Subtitle
    ctx.fillStyle = '#c2855b';
    ctx.font = '20px monospace';
    ctx.fillText('The pyramid has been conquered.', 600, 260);

    // Flavour line
    ctx.fillStyle = '#666';
    ctx.font = '15px monospace';
    ctx.fillText('Your legend echoes through the ancient stones.', 600, 300);

    // Play Again button
    drawPlayAgainButton();
}

// Draw the Play Again button
function drawPlayAgainButton() {
    const b = VICTORY_BTN;

    ctx.fillStyle = '#1a1400';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Play Again', b.x + b.w / 2, b.y + 33);
}

// Return true if the Play Again button was clicked
function handleVictoryClick(x, y) {
    const b = VICTORY_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
