// Game over screen — shown when the player's Warrior is defeated

// Button bounds (exported as constants so main.js can check clicks)
const GAME_OVER_BTN = { x: 500, y: 380, w: 200, h: 50 };

// Draw the full game over screen
function drawGameOverScreen() {
    // Deep red background to signal death
    ctx.fillStyle = '#140202';
    ctx.fillRect(0, 0, 1200, 640);

    // Faint decorative lines
    ctx.strokeStyle = '#3a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 640);
        ctx.stroke();
    }

    // "YOU DIED" title
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', 600, 220);

    // Flavour subtitle
    ctx.fillStyle = '#888';
    ctx.font = '18px monospace';
    ctx.fillText('The pyramid claims another soul...', 600, 280);

    // Try Again button
    drawTryAgainButton();
}

// Draw the Try Again button
function drawTryAgainButton() {
    const b = GAME_OVER_BTN;

    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Try Again', b.x + b.w / 2, b.y + 33);
}

// Return true if the Try Again button was clicked
function handleGameOverClick(x, y) {
    const b = GAME_OVER_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
