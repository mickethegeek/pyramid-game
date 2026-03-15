// Animated D20 roll component — draws a rolling die that settles on a pre-determined value
//
// Usage:
//   initDiceRoll(finalValue, modifier, statLabel)   — set up a new roll
//   tickDiceRoll()                                  — advance animation (call each frame)
//   drawDiceRoll(cx, cy)                            — render the die centred at (cx, cy)
//   isDiceRollDone()                                — true once settled
//   getDiceRollResult()                             — final die value (does NOT include modifier)

// ─── State ─────────────────────────────────────────────────────────────────────

const DR = {
    active:       false,
    finalValue:   1,        // the value the die will settle on
    displayValue: 1,        // the number currently shown
    modifier:     0,        // stat modifier shown below the die
    statLabel:    '',       // e.g. 'DEX'  shown as "+3 DEX"
    done:         false,    // true once the animation has fully settled
    startTime:    0,        // Date.now() when the roll began
    duration:     1400,     // total animation length in ms
    lastFlipTime: 0,        // last time the display value changed
};

// ─── Public API ────────────────────────────────────────────────────────────────

// Start a new dice roll animation.  finalValue is the pre-determined result (1–20).
// modifier: numeric stat bonus shown below; statLabel: abbreviated stat name.
function initDiceRoll(finalValue, modifier, statLabel) {
    DR.active       = true;
    DR.done         = false;
    DR.finalValue   = finalValue;
    DR.displayValue = Math.ceil(Math.random() * 20);
    DR.modifier     = modifier  || 0;
    DR.statLabel    = statLabel || '';
    DR.startTime    = Date.now();
    DR.lastFlipTime = Date.now();
}

// Advance animation state — call once per frame before drawing
function tickDiceRoll() {
    if (!DR.active || DR.done) return;

    const now     = Date.now();
    const elapsed = now - DR.startTime;
    const t       = elapsed / DR.duration;  // 0 → 1

    if (t >= 1.0) {
        DR.displayValue = DR.finalValue;
        DR.done         = true;
        return;
    }

    // Flip interval grows as the animation slows down
    let interval;
    if      (t < 0.55) interval = 55;
    else if (t < 0.78) interval = 110;
    else if (t < 0.92) interval = 220;
    else               interval = 400;

    if (now - DR.lastFlipTime >= interval) {
        // Show random values while rolling — avoid landing on final too early
        do {
            DR.displayValue = Math.ceil(Math.random() * 20);
        } while (t < 0.9 && DR.displayValue === DR.finalValue);
        DR.lastFlipTime = now;
    }
}

// Return true once the animation has fully settled
function isDiceRollDone() {
    return DR.done;
}

// Return the settled die value (before adding the modifier)
function getDiceRollResult() {
    return DR.finalValue;
}

// Reset — call when the die is no longer needed so it stops drawing
function clearDiceRoll() {
    DR.active = false;
    DR.done   = false;
}

// ─── Drawing ───────────────────────────────────────────────────────────────────

// Draw the die centred at (cx, cy) with outer radius r
function drawDiceRoll(cx, cy) {
    if (!DR.active) return;

    const r    = 82;    // outer polygon radius
    const r2   = 52;    // inner facet ring radius
    const sides = 10;   // decagon — looks like a D20 face-on

    const val   = DR.displayValue;
    const color = DR.done ? resultColor(val) : '#94a3b8';
    const glow  = DR.done;

    // Glow halo when settled
    if (glow) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 32;
    }

    // Outer polygon fill
    ctx.fillStyle = '#12100e';
    drawPolygon(cx, cy, r, sides, -Math.PI / 2);
    ctx.fill();

    // Outer polygon border
    ctx.strokeStyle = color;
    ctx.lineWidth   = glow ? 3.5 : 2;
    drawPolygon(cx, cy, r, sides, -Math.PI / 2);
    ctx.stroke();

    // Inner facet ring (gives the die its faceted look)
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth   = 1;
    drawPolygon(cx, cy, r2, sides, -Math.PI / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Spokes from inner ring to outer ring vertices (D20 triangle pattern)
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth   = 1;
    for (let i = 0; i < sides; i++) {
        const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
        const ox = cx + r  * Math.cos(angle);
        const oy = cy + r  * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ox, oy);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (glow) ctx.restore();

    // Big number in centre
    ctx.fillStyle  = color;
    ctx.font       = 'bold ' + (val >= 10 ? '36px' : '42px') + ' monospace';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, cx, cy);
    ctx.textBaseline = 'alphabetic';

    // "D20" label above the die
    ctx.fillStyle = '#888';
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('D20', cx, cy - r - 16);

    // Modifier label below the die
    if (DR.modifier !== 0 || DR.statLabel) {
        const sign   = DR.modifier >= 0 ? '+' : '';
        const modTxt = sign + DR.modifier + (DR.statLabel ? ' ' + DR.statLabel : '');
        ctx.fillStyle = '#aaaaaa';
        ctx.font      = '15px monospace';
        ctx.fillText(modTxt, cx, cy + r + 24);
    }

    // Total line when done and modifier is non-zero
    if (DR.done && DR.modifier !== 0) {
        const total = DR.finalValue + DR.modifier;
        ctx.fillStyle = color;
        ctx.font      = 'bold 17px monospace';
        ctx.fillText('= ' + total, cx, cy + r + 46);
    }

    // Result label when done
    if (DR.done) {
        const label = resultLabel(DR.finalValue);
        ctx.fillStyle = color;
        ctx.font      = 'bold 15px monospace';
        ctx.fillText(label, cx, cy + r + (DR.modifier !== 0 ? 68 : 46));
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Trace a regular polygon path (does not stroke/fill — caller decides)
function drawPolygon(cx, cy, radius, sides, startAngle) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = startAngle + (i / sides) * Math.PI * 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
    }
    ctx.closePath();
}

// Map die value to a colour
function resultColor(val) {
    if (val === 1)  return '#ef4444';   // critical fail — red
    if (val === 20) return '#ffd700';   // critical success — gold
    if (val >= 11)  return '#4ade80';   // success — green
    return '#94a3b8';                   // partial / fail — slate
}

// Map die value to a short flavour label shown when settled
function resultLabel(val) {
    if (val === 1)  return 'CRITICAL FAIL!';
    if (val === 20) return 'CRITICAL SUCCESS!';
    if (val >= 15)  return 'SUCCESS';
    if (val >= 10)  return 'PARTIAL SUCCESS';
    return 'FAIL';
}
