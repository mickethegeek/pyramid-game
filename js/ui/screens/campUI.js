// Camp screen — placeholder until camp mechanics are built
// Camp always appears directly below the boss room and never disables.

// ─── Layout ───────────────────────────────────────────────────────────────────
const CAMP_BTN = { x: 520, y: 540, w: 160, h: 50 };

// ─── Draw ─────────────────────────────────────────────────────────────────────

// Draw the placeholder camp screen
function drawCampScreen() {
    drawCampBackground();
    drawCampHeader();
    drawCampBody();
    drawCampLeaveButton();
}

// Dark background
function drawCampBackground() {
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, 1200, 640);
}

// Terracotta-tinted header bar matching the camp room colour
function drawCampHeader() {
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(0, 0, 1200, 70);

    ctx.strokeStyle = '#c2855b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(1200, 70);
    ctx.stroke();

    ctx.fillStyle = '#c2855b';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CAMP', 30, 45);

    // Small label on the right — signals this is the pre-boss room
    ctx.fillStyle = '#666';
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Before the boss', 1170, 45);
}

// Coming-soon body text
function drawCampBody() {
    ctx.fillStyle = '#cccccc';
    ctx.font = '22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Camp — coming soon', 600, 310);

    ctx.fillStyle = '#555';
    ctx.font = '14px monospace';
    ctx.fillText('Rest, repair gear, and prepare before facing the boss.', 600, 345);

    ctx.fillStyle = '#3a3530';
    ctx.font = '13px monospace';
    ctx.fillText('Full camp mechanics arrive in a future milestone.', 600, 375);
}

// Leave button
function drawCampLeaveButton() {
    const b = CAMP_BTN;
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#c2855b';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#c2855b';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEAVE', b.x + b.w / 2, b.y + 32);
}

// ─── Click handling ───────────────────────────────────────────────────────────

// Return true if the LEAVE button was clicked
function handleCampClick(x, y) {
    const b = CAMP_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
