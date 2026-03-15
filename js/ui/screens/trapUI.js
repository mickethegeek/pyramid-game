// Trap room — full interactive phase-based encounter
// Replaces the old instant doTrap() function entirely.
//
// ─── state.currentTrap shape ──────────────────────────────────────────────────
//
// {
//   trapType:       string,       // key into TRAP_TYPES — 'spike_pit' | 'falling_log' | 'riddle' | 'lucky_doors'
//   phase:          string,       // 'intro' | 'rolling' | 'doors' | 'summary'
//   partyQueue:     Character[],  // members still waiting — popped automatically in order
//   currentMember:  Character,    // the member whose roll is currently active
//   results:        Array<{       // one entry per member who resolved
//                     member:  Character,
//                     immune:  bool,
//                     dodged:  bool,    // true if LUCK dodge fired — no roll needed
//                     roll:    number,  // raw d20 value (0 if immune/dodged)
//                     mod:     number,  // stat modifier applied
//                     total:   number,  // roll + mod
//                     passed:  bool,
//                     damage:  number,  // 0 if passed/immune/dodged
//                   }>,
//   dc:             number,       // DC for the current roll (set per-act in initTrap; overwritten for chained rolls)
//   chainedTrapKey: string|null,  // set while processing a bad-door chained roll (lucky_doors only)
//   subPhase:       string|null,  // 'secondary' during the falling_log STR halve roll
//
//   // lucky_doors only:
//   doorState: {
//     doors: Array<{
//       index:          number,
//       good:           bool,
//       hint:           string,
//       chainedTrapKey: string|null,  // pre-assigned chained trap for bad doors
//       chosen:         bool,          // true once any member has opened this door
//     }>
//   },
// }
//
// ─── Luck — individual only ───────────────────────────────────────────────────
//
//   Each member has a dodge chance = floor(getStat('luck') / 3) percent.
//   Rolled before their turn — if it fires they slip past with no damage.
//   Applies to spike_pit, falling_log, riddle only.  Not lucky_doors.
//
// ─────────────────────────────────────────────────────────────────────────────

// Member whose LUCK dodge just fired — shows popup until player clicks anywhere
let trapDodgePopupMember = null;

// ─── Trap type definitions ────────────────────────────────────────────────────

// Each trap type specifies: stat used, base DC per act, damage formula, and flavour text.
// dc: [act1, act2, act3]
// damage(member): function that returns HP lost on a failed roll

const TRAP_TYPES = {

    spike_pit: {
        key:        'spike_pit',
        name:       'Spike Pit',
        stat:       'dex',
        dc:         [10, 12, 14],
        // Failed roll: 15 damage + 5 per act above 1
        damage:     function(member, actNumber) {
            return 15 + (actNumber - 1) * 5;
        },
        intro:      'The floor shifts beneath your feet — slats of stone slide aside to reveal a pit of rusted iron spikes.',
        prompt:     'Each party member must leap across in turn.',
        rollPrompt: 'Who crosses the pit?',
        statDesc:   'Agility decides who clears the gap.',
        passLine:   'leaps across cleanly.',
        failLine:   'stumbles and falls in!',
    },

    falling_log: {
        key:        'falling_log',
        name:       'Falling Log',
        stat:       'spd',
        dcStat:     'str',          // secondary: if SPD fails, a STR roll halves the damage
        dc:         [10, 13, 16],
        // Failed SPD roll: 20 + 8 per act. If STR roll also fails, full damage. If STR passes, halved.
        damage:     function(member, actNumber) {
            return 20 + (actNumber - 1) * 8;
        },
        intro:      'A deep rumble echoes through the corridor — carved stone logs hang from the ceiling by fraying ropes.',
        prompt:     'Everyone must either dodge fast or brace for the impact.',
        rollPrompt: 'Who braces for the log?',
        statDesc:   'Speed lets you dodge. If you fail, Strength halves the blow.',
        passLine:   'rolls clear of the log.',
        failLine:   'takes the full impact!',
    },

    riddle: {
        key:        'riddle',
        name:       'The Riddling Door',
        stat:       'int',
        dc:         [11, 14, 17],
        // Failed roll: 12 damage + 6 per act above 1
        damage:     function(member, actNumber) {
            return 12 + (actNumber - 1) * 6;
        },
        intro:      'A sealed stone door bears an inscription that shifts each time you read it — the pyramid tests your mind.',
        prompt:     'Send your wisest to attempt the answer.',
        rollPrompt: 'Who reads the inscription?',
        statDesc:   'Intelligence determines who can decipher the shifting glyphs.',
        passLine:   'speaks the correct answer — the door swings open.',
        failLine:   'gives a wrong answer — the floor erupts with arcane fire!',
    },

    lucky_doors: {
        key:        'lucky_doors',
        name:       'Three Doors',
        stat:       'luck',
        dc:         [0, 0, 0],      // no DC roll — door choice is the mechanic
        damage:     function(member, actNumber) { return 0; },   // damage handled by chained trap
        intro:      'Three identical doors stand before you. Ancient script above them reads: "One path leads forward. Two paths lead to suffering."',
        prompt:     'Choose a door. Your instincts are your only guide.',
        rollPrompt: '',
        statDesc:   'The party\'s collective Luck shapes the reliability of the hints.',
        passLine:   '',
        failLine:   '',
        // Hint text pools — chosen based on avgLuck bracket
        hintAccurate:    ['This door feels warm.', 'Fresh air seeps through the cracks.', 'The carvings here are unbroken.'],
        hintNeutral:     ['Ancient marks cover the surface.', 'The stone here is worn smooth.', 'A faint hum emanates from within.'],
        hintMisleading:  ['This door feels warm.', 'Fresh air seeps through the cracks.', 'The carvings here are unbroken.'],
    },
};

// ─── initTrap ─────────────────────────────────────────────────────────────────

// Set up state.currentTrap and switch to the 'trap' scene.
// Called from main.js enterRoom() instead of the old doTrap().
function initTrap() {
    try { _initTrapImpl(); } catch(e) { console.error('initTrap failed:', e); state.roomMessage = 'Trap error: ' + e.message; }
}
function _initTrapImpl() {
    const trapKeys  = ['spike_pit', 'falling_log', 'riddle', 'lucky_doors'];
    const trapKey   = trapKeys[Math.floor(Math.random() * trapKeys.length)];
    const trapType  = TRAP_TYPES[trapKey];
    const actNumber = state.actNumber;
    const dc        = trapType.dc[actNumber - 1];

    // Queue up all living members; immunity and LUCK dodge handled when each member is processed
    const alive      = state.party.filter(function(m) { return m.isAlive(); });
    const partyQueue = alive.slice();

    // lucky_doors: build door state once — assignments fixed, each member picks independently
    let doorState = null;
    if (trapKey === 'lucky_doors') {
        const chainKeys = ['spike_pit', 'falling_log', 'riddle'];
        const goodIdx   = Math.floor(Math.random() * 3);
        const neutral   = trapType.hintNeutral;
        // Shuffle neutral hints so each door gets a different one
        const hints     = neutral.slice().sort(function() { return Math.random() - 0.5; });
        doorState = {
            doors: [0, 1, 2].map(function(i) {
                return {
                    index:          i,
                    good:           i === goodIdx,
                    hint:           hints[i % hints.length],
                    chainedTrapKey: i === goodIdx ? null : chainKeys[Math.floor(Math.random() * chainKeys.length)],
                    chosen:         false,
                };
            }),
        };
    }

    state.currentTrap = {
        trapType:       trapKey,
        phase:          'intro',
        partyQueue:     partyQueue,
        currentMember:  null,
        results:        [],
        dc:             dc,
        chainedTrapKey: null,
        subPhase:       null,
        doorState:      doorState,
    };

    state.currentScene = 'trap';
}

// ─── Header ───────────────────────────────────────────────────────────────────

// Orange-themed header bar — mirrors drawEventHeader() but styled for traps
function drawTrapHeader() {
    ctx.fillStyle = '#1a0d00';
    ctx.fillRect(0, 0, 1200, 70);

    ctx.strokeStyle = '#d35400';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(1200, 70); ctx.stroke();

    ctx.fillStyle = '#d35400';
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TRAP', 30, 45);

    // Act badge
    ctx.fillStyle = '#555';
    ctx.font      = '14px monospace';
    ctx.fillText('ACT ' + state.actNumber, 120, 45);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('\u25c6 ' + state.gold + ' gold', 1170, 45);
}

// ─── Main router ──────────────────────────────────────────────────────────────

// Top-level draw function — wired into the game loop when currentScene === 'trap'
function drawTrapScreen() {
    const trap = state.currentTrap;
    if (!trap) return;

    drawEventBackground();
    drawTrapHeader();

    const def        = TRAP_TYPES[trap.trapType];
    const rollingDef = TRAP_TYPES[trap.chainedTrapKey || trap.trapType];
    if      (trap.phase === 'intro')   drawTrapIntro(trap, def);
    else if (trap.phase === 'rolling') drawTrapRolling(trap, rollingDef);
    else if (trap.phase === 'summary') drawTrapResult(trap, def);
    else if (trap.phase === 'doors')   drawLuckyDoors(trap, def);

    if (trapDodgePopupMember) drawTrapDodgePopup(trapDodgePopupMember);
}

// ─── Intro phase ──────────────────────────────────────────────────────────────

// Show: trap name, flavour text, mechanics panel (stat/DC/luck), party stat preview, PROCEED button
function drawTrapIntro(trap, def) {
    // Title
    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(def.name.toUpperCase(), 60, 110);

    // DC / stat tag line
    ctx.fillStyle = '#666';
    ctx.font      = '13px monospace';
    const dcLabel = trap.dc > 0 ? 'DC ' + trap.dc + '  \u00b7  ' : '';
    ctx.fillText(dcLabel + def.stat.toUpperCase() + ' check', 60, 132);

    // Flavour intro (word-wrapped)
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    const introLines = evWrapText(def.intro, 1080);
    introLines.forEach(function(line, i) { ctx.fillText(line, 60, 155 + i * 22); });

    // Prompt line
    ctx.fillStyle = '#cccccc';
    ctx.font      = '15px monospace';
    ctx.fillText(def.prompt, 60, 155 + introLines.length * 22 + 20);

    // Divider
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    const divY = 155 + introLines.length * 22 + 44;
    ctx.beginPath(); ctx.moveTo(60, divY); ctx.lineTo(1140, divY); ctx.stroke();

    const panelY = divY + 14;

    // ── Left panel: mechanics ─────────────────────────────────────────────────
    drawEvCard(60, panelY, 490, 210, '#d35400');

    ctx.fillStyle = '#d35400';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TRAP MECHANICS', 76, panelY + 22);

    ctx.fillStyle = '#cccccc';
    ctx.font      = '14px monospace';
    ctx.fillText(def.statDesc, 76, panelY + 48);

    // Stat name (large) + DC value
    ctx.fillStyle = statColor(def.stat);
    ctx.font      = 'bold 34px monospace';
    ctx.fillText(def.stat.toUpperCase(), 76, panelY + 102);

    if (trap.dc > 0) {
        ctx.fillStyle = '#888';
        ctx.font      = '14px monospace';
        ctx.fillText('Difficulty Class  ' + trap.dc, 76, panelY + 128);
    } else {
        ctx.fillStyle = '#888';
        ctx.font      = '14px monospace';
        ctx.fillText('No roll — choose wisely.', 76, panelY + 128);
    }

    // Secondary stat note for falling_log
    if (def.dcStat) {
        ctx.fillStyle = statColor(def.dcStat);
        ctx.font      = '13px monospace';
        ctx.fillText('Fail dodge? Roll ' + def.dcStat.toUpperCase() + ' (DC 10) to halve damage.', 76, panelY + 152);
    }

    // Individual LUCK dodge note
    ctx.fillStyle = '#ffd700';
    ctx.font      = '12px monospace';
    ctx.fillText('\u2605 LUCK: each member has a floor(LUCK/3)% chance to slip past.', 76, panelY + 176);

    // ── Right panel: party stat preview ──────────────────────────────────────
    drawEvCard(580, panelY, 560, 210, '#3a3530');

    ctx.fillStyle = '#888';
    ctx.font      = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PARTY  \u2014  ' + def.stat.toUpperCase() + ' VALUES', 596, panelY + 22);

    const alive  = state.party.filter(function(m) { return m.isAlive(); });
    const colW   = 260;
    alive.forEach(function(member, i) {
        const col    = i % 2;
        const row    = Math.floor(i / 2);
        const mx     = 596 + col * colW;
        const my     = panelY + 50 + row * 50;
        const sv     = member.getStat(def.stat);
        const mod    = Math.floor(sv / 3);
        const immune = hasPassive(member, 'trap_immunity');

        ctx.fillStyle = immune ? '#555' : '#cccccc';
        ctx.font      = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(member.name || member.classKey, mx, my);

        if (immune) {
            ctx.fillStyle = '#f97316';
            ctx.font      = '12px monospace';
            ctx.fillText('IMMUNE', mx, my + 18);
        } else {
            ctx.fillStyle = statColor(def.stat);
            ctx.font      = '13px monospace';
            ctx.fillText(def.stat.toUpperCase() + ' ' + sv + '   mod +' + mod, mx, my + 18);
        }
    });

    // PROCEED button
    drawEvBtn('PROCEED', 460, 567, 280, 46, 'orange');
}

// ─── Rolling phase ────────────────────────────────────────────────────────────

// Show the animated dice roll for the current party member
// Mirrors the evAncientAltar layout: left card / centre die / right card
function drawTrapRolling(trap, def) {
    const member      = trap.currentMember;
    const isSecondary = trap.subPhase === 'secondary';
    if (!member) return;

    // Which stat is being rolled this frame
    const rollStat = isSecondary ? def.dcStat : def.stat;
    const rollDC   = isSecondary ? 10 : trap.dc;
    const sv       = member.getStat(rollStat);
    const mod      = Math.floor(sv / 3);

    // Trap name + progress
    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(def.name.toUpperCase(), 60, 110);

    // Member progress counter (e.g. "1 of 4")
    const memberCount = trap.results.length + trap.partyQueue.length + 1;
    const current     = trap.results.length + 1;
    ctx.fillStyle  = '#666';
    ctx.font       = '13px monospace';
    ctx.fillText('Member ' + current + ' of ' + memberCount, 60, 132);

    if (isSecondary) {
        ctx.fillStyle = '#f97316';
        ctx.font      = '13px monospace';
        ctx.fillText('SPD dodge failed — rolling STR to halve damage', 300, 132);
    }

    // Advance the die animation (same pattern as evAncientAltar)
    tickDiceRoll();

    // ── Left card: member info ────────────────────────────────────────────────
    drawEvCard(60, 200, 400, 210, '#f97316');
    ctx.textAlign = 'left';

    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 13px monospace';
    ctx.fillText(isSecondary ? 'BRACING' : 'ATTEMPTING', 76, 228);

    ctx.fillStyle = '#cccccc';
    ctx.font      = 'bold 18px monospace';
    ctx.fillText(member.name || member.classKey, 76, 256);

    ctx.fillStyle = statColor(rollStat);
    ctx.font      = '14px monospace';
    ctx.fillText(rollStat.toUpperCase() + '  ' + sv + '   modifier: +' + mod, 76, 284);

    const hpPct   = member.currentHP / member.getMaxHP();
    const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = '#555';
    ctx.font      = '13px monospace';
    ctx.fillText('HP', 76, 360);
    // HP bar
    ctx.fillStyle = '#222';
    ctx.fillRect(104, 347, 200, 14);
    ctx.fillStyle = hpColor;
    ctx.fillRect(104, 347, Math.floor(200 * hpPct), 14);
    ctx.fillStyle = '#888';
    ctx.font      = '11px monospace';
    ctx.fillText(member.currentHP + ' / ' + member.getMaxHP(), 210, 380);

    // ── Die centred ───────────────────────────────────────────────────────────
    drawDiceRoll(578, 375);

    // ── Right card: DC + result ───────────────────────────────────────────────
    const rollValue = getDiceRollResult();
    const total     = rollValue + mod;
    const passed    = total >= rollDC;
    const done      = isDiceRollDone();

    drawEvCard(660, 200, 480, 210, done ? (passed ? '#4ade80' : '#ef4444') : '#3a3530');
    ctx.textAlign = 'left';

    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.fillText('Difficulty  DC ' + rollDC, 676, 228);

    ctx.fillStyle = '#555';
    ctx.font      = '13px monospace';
    ctx.fillText('Roll + mod \u2265 ' + rollDC + ' to pass', 676, 250);

    if (!done) {
        ctx.fillStyle = '#555';
        ctx.font      = 'bold 18px monospace';
        ctx.fillText('Rolling...', 676, 298);
    } else if (passed) {
        ctx.fillStyle = '#4ade80';
        ctx.font      = 'bold 16px monospace';
        ctx.fillText('SUCCESS', 676, 282);
        ctx.fillStyle = '#cccccc';
        ctx.font      = '14px monospace';
        ctx.fillText((member.name || member.classKey) + ' ' + def.passLine, 676, 306);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText(rollValue + ' + ' + mod + ' = ' + total, 676, 330);
    } else {
        // Failed — show damage
        const fullDmg = def.damage(member, state.actNumber);
        const dmg     = isSecondary ? Math.floor(fullDmg / 2) : fullDmg;
        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 16px monospace';
        ctx.fillText(isSecondary ? 'DAMAGE HALVED' : 'FAILED', 676, 282);
        ctx.fillStyle = '#cccccc';
        ctx.font      = '14px monospace';
        ctx.fillText((member.name || member.classKey) + ' ' + def.failLine, 676, 306);
        ctx.fillStyle = '#ef4444';
        ctx.font      = 'bold 20px monospace';
        ctx.fillText('\u2212' + dmg + ' HP', 676, 336);
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText(rollValue + ' + ' + mod + ' = ' + total, 676, 358);
        // If SPD failed on falling_log, hint about STR secondary
        if (!isSecondary && def.dcStat) {
            ctx.fillStyle = '#f97316';
            ctx.font      = '13px monospace';
            ctx.fillText('Roll STR to reduce damage...', 676, 382);
        }
    }

    // Buttons appear only once the die has settled
    if (done) {
        const moreMembers = trap.partyQueue.length > 0;
        // For falling_log failing SPD: show secondary roll button
        if (!isSecondary && !passed && def.dcStat) {
            drawEvBtn('BRACE  \u2014  roll STR', 450, 557, 300, 44, 'orange');
        } else if (moreMembers) {
            drawEvBtn('NEXT', 540, 557, 200, 44, 'blue');
        } else {
            drawEvBtn('CONTINUE', 500, 557, 200, 44, 'blue');
        }
    }
}

// ─── Summary / Result phase ────────────────────────────────────────────────────

// Show all results in a table, total HP lost, then CONTINUE button
function drawTrapResult(trap, def) {
    // Title
    ctx.fillStyle = trap.results.every(function(r) { return r.passed || r.immune; })
        ? '#4ade80' : '#f97316';
    ctx.font      = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TRAP RESOLVED  \u2014  ' + def.name.toUpperCase(), 60, 110);

    // Divider
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(60, 128); ctx.lineTo(1140, 128); ctx.stroke();

    // ── Column headers ────────────────────────────────────────────────────────
    const COL = { name: 60, roll: 300, mod: 380, total: 454, dc: 530, result: 600, dmg: 810 };
    ctx.fillStyle = '#555';
    ctx.font      = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CHARACTER',  COL.name,   152);
    ctx.fillText('ROLL',       COL.roll,   152);
    ctx.fillText('MOD',        COL.mod,    152);
    ctx.fillText('TOTAL',      COL.total,  152);
    ctx.fillText('DC',         COL.dc,     152);
    ctx.fillText('OUTCOME',    COL.result, 152);
    ctx.fillText('DAMAGE',     COL.dmg,    152);

    // Thin rule under header
    ctx.strokeStyle = '#2a2520';
    ctx.beginPath(); ctx.moveTo(60, 158); ctx.lineTo(1100, 158); ctx.stroke();

    // ── Result rows ───────────────────────────────────────────────────────────
    trap.results.forEach(function(r, i) {
        const ry = 174 + i * 46;

        // Subtle row background for failed members
        if (!r.passed && !r.immune) {
            ctx.fillStyle = 'rgba(239,68,68,0.06)';
            ctx.fillRect(56, ry - 14, 1088, 42);
        }

        // Name
        ctx.fillStyle = r.immune ? '#555' : '#cccccc';
        ctx.font      = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(r.member.name || r.member.classKey, COL.name, ry);

        if (r.immune) {
            ctx.fillStyle = '#f97316';
            ctx.font      = 'bold 12px monospace';
            ctx.fillText('IMMUNE', COL.roll, ry);
            ctx.fillText('Pyramid Eye wards off the trap.', COL.result, ry);
            return;
        }

        if (r.dodged) {
            ctx.fillStyle = '#ffd700';
            ctx.font      = 'bold 12px monospace';
            ctx.fillText('DODGED', COL.roll, ry);
            ctx.fillStyle = '#ffd700';
            ctx.fillText('Luck favoured this one.', COL.result, ry);
            return;
        }

        // Roll
        ctx.fillStyle = '#888';
        ctx.font      = '13px monospace';
        ctx.fillText(r.roll, COL.roll, ry);

        // Mod
        ctx.fillStyle = '#ffd700';
        ctx.fillText('+' + r.mod, COL.mod, ry);

        // Total
        const passedColor = r.passed ? '#4ade80' : '#ef4444';
        ctx.fillStyle = passedColor;
        ctx.font      = 'bold 13px monospace';
        ctx.fillText(r.total, COL.total, ry);

        // DC
        ctx.fillStyle = '#555';
        ctx.font      = '13px monospace';
        ctx.fillText(trap.dc, COL.dc, ry);

        // Outcome
        ctx.fillStyle = passedColor;
        ctx.font      = 'bold 13px monospace';
        ctx.fillText(r.passed ? 'PASSED' : 'FAILED', COL.result, ry);

        // Damage
        if (!r.passed && r.damage > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('\u2212' + r.damage + ' HP', COL.dmg, ry);
            // Show current HP after damage
            ctx.fillStyle = '#555';
            ctx.font      = '11px monospace';
            ctx.fillText('(' + r.member.currentHP + ' / ' + r.member.getMaxHP() + ' remaining)', COL.dmg + 70, ry);
        } else if (r.passed) {
            ctx.fillStyle = '#4ade80';
            ctx.font      = '13px monospace';
            ctx.fillText('none', COL.dmg, ry);
        }
    });

    // ── Summary totals ────────────────────────────────────────────────────────
    const sumY      = 174 + trap.results.length * 46 + 14;
    const totalDmg  = trap.results.reduce(function(s, r) { return s + r.damage; }, 0);
    const casualties = trap.results.filter(function(r) { return !r.isAlive && !r.immune; });

    ctx.strokeStyle = '#2a2520';
    ctx.beginPath(); ctx.moveTo(60, sumY); ctx.lineTo(1100, sumY); ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Total damage dealt: ', 60, sumY + 24);
    ctx.fillStyle = totalDmg > 0 ? '#ef4444' : '#4ade80';
    ctx.font      = 'bold 13px monospace';
    ctx.fillText(totalDmg + ' HP', 240, sumY + 24);

    // Flavour line
    const allPassed = trap.results.every(function(r) { return r.passed || r.immune; });
    ctx.fillStyle   = allPassed ? '#4ade80' : '#888';
    ctx.font        = '13px monospace';
    ctx.textAlign   = 'left';
    ctx.fillText(
        allPassed
            ? 'The party navigates the trap without injury.'
            : 'Wounds and bruises — but you press onward.',
        60, sumY + 46
    );

    drawEvBtn('CONTINUE', 500, 572, 200, 44, 'blue');
}

// ─── Lucky doors phase ────────────────────────────────────────────────────────

// Show three mystery doors with hint text — player clicks one to proceed
function drawLuckyDoors(trap, def) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 26px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THREE DOORS', 60, 110);

    // Flavour text
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = '15px monospace';
    const introLines = evWrapText(def.intro, 1080);
    introLines.forEach(function(line, i) { ctx.fillText(line, 60, 138 + i * 22); });

    ctx.fillStyle = '#cccccc';
    ctx.font      = '15px monospace';
    ctx.fillText(def.prompt, 60, 138 + introLines.length * 22 + 16);

    // Divider
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth   = 1;
    const divY = 138 + introLines.length * 22 + 40;
    ctx.beginPath(); ctx.moveTo(60, divY); ctx.lineTo(1140, divY); ctx.stroke();

    // ── Three door cards ──────────────────────────────────────────────────────
    const cardW   = 310;
    const cardH   = 260;
    const cardGap = 25;
    const totalW  = 3 * cardW + 2 * cardGap;
    const startX  = Math.floor((1200 - totalW) / 2);
    const cardY   = divY + 16;

    const labels = ['I', 'II', 'III'];

    trap.doorState.doors.forEach(function(door, i) {
        const dx      = startX + i * (cardW + cardGap);
        const hovered = mouseX >= dx && mouseX <= dx + cardW && mouseY >= cardY && mouseY <= cardY + cardH;
        const chosen  = door.chosen;

        // Card fill and border
        let borderColor = hovered ? '#ffd700' : '#3a3530';
        if (chosen && door.good)  borderColor = '#4ade80';
        if (chosen && !door.good) borderColor = '#ef4444';

        ctx.fillStyle = chosen ? (door.good ? '#0d2818' : '#2e0d0d') : (hovered ? '#1e1a14' : '#161210');
        ctx.fillRect(dx, cardY, cardW, cardH);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = chosen || hovered ? 2 : 1;
        ctx.strokeRect(dx, cardY, cardW, cardH);

        // Door label (Roman numeral)
        ctx.fillStyle = chosen ? (door.good ? '#4ade80' : '#ef4444') : (hovered ? '#ffd700' : '#888');
        ctx.font      = 'bold 52px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], dx + cardW / 2, cardY + 82);

        // Door arch icon (simple arc decoration)
        ctx.strokeStyle = hovered ? '#ffd700' : '#3a3530';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(dx + cardW / 2, cardY + 82, 44, Math.PI, 0);
        ctx.stroke();

        // "DOOR" sub-label
        ctx.fillStyle = '#444';
        ctx.font      = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DOOR', dx + cardW / 2, cardY + 106);

        // Divider inside card
        ctx.strokeStyle = '#2a2520';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(dx + 20, cardY + 118); ctx.lineTo(dx + cardW - 20, cardY + 118); ctx.stroke();

        // Hint text (word-wrapped to fit card width)
        ctx.font = '13px monospace';
        const hintLines = evWrapText(door.hint, cardW - 40);
        hintLines.forEach(function(line, li) {
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(line, dx + cardW / 2, cardY + 140 + li * 20);
        });

        // Reveal overlay once chosen
        if (chosen) {
            ctx.fillStyle = door.good ? '#4ade80' : '#ef4444';
            ctx.font      = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(door.good ? 'SAFE PASSAGE' : 'TRAPPED!', dx + cardW / 2, cardY + cardH - 24);
        } else if (!hovered) {
            ctx.fillStyle = '#333';
            ctx.font      = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('click to choose', dx + cardW / 2, cardY + cardH - 14);
        }
    });

    // ── LUCK bracket panel ────────────────────────────────────────────────────
    const luckPanelY = cardY + cardH + 16;
    drawEvCard(60, luckPanelY, 580, 64, '#ffd700');

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THREE DOORS', 76, luckPanelY + 24);

    // Member indicator
    const memberLabel = trap.currentMember
        ? (trap.currentMember.name || trap.currentMember.classKey) + ' is choosing...'
        : 'Choose a door.';
    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.fillText(memberLabel, 76, luckPanelY + 46);

    ctx.fillStyle = '#888';
    ctx.font      = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Opened doors remain visible for the rest of the party.', 660, luckPanelY + 24);
}

// ─── Luck dodge popup ─────────────────────────────────────────────────────────

// Dimmed overlay + centred card shown when a member's LUCK dodge fires
function drawTrapDodgePopup(member) {
    // Dim the background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, 1200, 640);

    // Card
    const cw = 480, ch = 160;
    const cx = Math.floor((1200 - cw) / 2);
    const cy = Math.floor((640  - ch) / 2);
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Star icon
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u2605', 600, cy + 40);

    // Member name
    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 16px monospace';
    ctx.fillText(member.name || member.classKey, 600, cy + 68);

    // Flavour line
    ctx.fillStyle = '#cccccc';
    ctx.font      = '14px monospace';
    ctx.fillText('passes through without a scratch.', 600, cy + 92);
    ctx.fillStyle = '#aaaaaa';
    ctx.font      = 'italic 13px monospace';
    ctx.fillText('How lucky you must be.', 600, cy + 112);

    // Dismiss hint
    ctx.fillStyle = '#444';
    ctx.font      = '11px monospace';
    ctx.fillText('click anywhere to continue', 600, cy + 142);
}

// ─── Click handler ────────────────────────────────────────────────────────────

// Route clicks to the correct phase handler.  Returns 'done' | 'defeat' | null.
// main.js calls returnToPyramid() on 'done' and handleDefeat() on 'defeat'.
function handleTrapClick(x, y) {
    const trap = state.currentTrap;
    if (!trap) return null;

    // Dodge popup is modal — any click dismisses it and resumes the queue
    if (trapDodgePopupMember) {
        trapDodgePopupMember = null;
        trapStartNextMember(trap);
        return null;
    }

    const def = TRAP_TYPES[trap.trapType];

    // ── intro: PROCEED button ─────────────────────────────────────────────────
    if (trap.phase === 'intro') {
        if (!evInRect(x, y, 460, 567, 280, 46)) return null;
        trapStartNextMember(trap);
        return null;
    }

    // ── rolling: wait for die to settle, then act on result ──────────────────
    if (trap.phase === 'rolling') {
        if (!isDiceRollDone()) return null;

        const activeDef   = TRAP_TYPES[trap.chainedTrapKey || trap.trapType];
        const member      = trap.currentMember;
        const isSecondary = trap.subPhase === 'secondary';
        const rollStat    = isSecondary ? activeDef.dcStat : activeDef.stat;
        const rollDC      = isSecondary ? 10               : trap.dc;
        const sv          = member.getStat(rollStat);
        const mod         = Math.floor(sv / 3);
        const roll        = getDiceRollResult();
        const total       = roll + mod;
        const passed      = total >= rollDC;
        const fullDmg     = activeDef.damage(member, state.actNumber);
        const moreMembers = trap.partyQueue.length > 0;

        // falling_log only: SPD failed → BRACE button triggers secondary STR roll
        if (!isSecondary && !passed && activeDef.dcStat) {
            if (!evInRect(x, y, 450, 557, 300, 44)) return null;
            trap.subPhase = 'secondary';
            const strMod  = Math.floor(member.getStat(activeDef.dcStat) / 3);
            const strRoll = Math.ceil(Math.random() * 20);
            clearDiceRoll();
            initDiceRoll(strRoll, strMod, activeDef.dcStat.toUpperCase());
            return null;
        }

        // NEXT / CONTINUE button
        const btnX = moreMembers ? 540 : 500;
        if (!evInRect(x, y, btnX, 557, 200, 44)) return null;

        // Compute damage from this roll's outcome
        let damage = 0;
        if (isSecondary) {
            // STR brace: pass = halved, fail = full
            damage = passed ? Math.floor(fullDmg / 2) : fullDmg;
        } else {
            damage = passed ? 0 : fullDmg;
        }

        // Apply damage (can reduce HP to 0 — death is checked on summary continue)
        if (damage > 0) {
            member.currentHP = Math.max(0, member.currentHP - damage);
        }

        // Record result — 'passed' reflects whether the member escaped unharmed
        trap.results.push({
            member:  member,
            immune:  false,
            dodged:  false,
            roll:    roll,
            mod:     mod,
            total:   total,
            passed:  !isSecondary && passed,
            damage:  damage,
        });

        clearDiceRoll();
        trap.currentMember = null;
        trap.subPhase      = null;
        trapStartNextMember(trap);
        return null;
    }

    // ── doors: click a door card ──────────────────────────────────────────────
    if (trap.phase === 'doors') {
        // Compute door card geometry — must match drawLuckyDoors exactly
        ctx.font = '15px monospace';
        const introLines = evWrapText(def.intro, 1080);
        const divY   = 138 + introLines.length * 22 + 40;
        const cardY  = divY + 16;
        const cardW  = 310;
        const cardH  = 260;
        const cardGap = 25;
        const startX = Math.floor((1200 - (3 * cardW + 2 * cardGap)) / 2);

        for (let i = 0; i < 3; i++) {
            const dx = startX + i * (cardW + cardGap);
            if (!evInRect(x, y, dx, cardY, cardW, cardH)) continue;

            const door = trap.doorState.doors[i];
            // Mark door as opened (visual) — members can still pick a revealed door
            door.chosen = true;

            if (door.good) {
                // Safe path — this member passes unharmed
                trap.results.push({
                    member: trap.currentMember, immune: false, dodged: false,
                    roll: 20, mod: 0, total: 20, passed: true, damage: 0,
                });
                trapStartNextMember(trap);
            } else {
                // Bad door — chain a trap roll scoped to this member only
                const chainKey = door.chainedTrapKey;
                const chainDef = TRAP_TYPES[chainKey];
                trap.chainedTrapKey = chainKey;
                trap.dc             = chainDef.dc[state.actNumber - 1];
                trap.subPhase       = null;
                const sv   = trap.currentMember.getStat(chainDef.stat);
                const mod  = Math.floor(sv / 3);
                const roll = Math.ceil(Math.random() * 20);
                initDiceRoll(roll, mod, chainDef.stat.toUpperCase());
                trap.phase = 'rolling';
            }
            return null;
        }
        return null;
    }

    // ── summary: CONTINUE button ──────────────────────────────────────────────
    if (trap.phase === 'summary') {
        if (!evInRect(x, y, 500, 572, 200, 44)) return null;

        clearDiceRoll();
        state.currentTrap = null;

        // Party fully wiped → game over
        if (state.party.every(function(m) { return !m.isAlive(); })) {
            return 'defeat';
        }
        return 'done';
    }

    return null;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

// Advance to the next party member automatically, handling immunity and LUCK dodge.
// Sets trap.phase = 'rolling' | 'doors' | 'summary' and returns immediately.
function trapStartNextMember(trap) {
    // Clear any active chained-trap state before processing next member
    trap.chainedTrapKey = null;

    const baseDef = TRAP_TYPES[trap.trapType];

    while (trap.partyQueue.length > 0) {
        const member = trap.partyQueue.shift();

        // Immune members auto-pass silently
        if (hasPassive(member, 'trap_immunity')) {
            trap.results.push({ member: member, immune: true, dodged: false, roll: 0, mod: 0, total: 0, passed: true, damage: 0 });
            continue;
        }

        // lucky_doors: each member picks independently from the same 3 doors
        if (trap.trapType === 'lucky_doors') {
            trap.currentMember = member;
            trap.phase         = 'doors';
            return;
        }

        // LUCK dodge check — fires before any roll (not for lucky_doors)
        const dodgeChance = Math.floor(member.getStat('luck') / 3);
        if (Math.random() * 100 < dodgeChance) {
            trap.results.push({ member: member, immune: false, dodged: true, roll: 0, mod: 0, total: 0, passed: true, damage: 0 });
            trapDodgePopupMember = member;   // show popup; click will resume the queue
            return;
        }

        // Start dice roll for this member
        trap.currentMember = member;
        trap.subPhase      = null;
        const sv   = member.getStat(baseDef.stat);
        const mod  = Math.floor(sv / 3);
        const roll = Math.ceil(Math.random() * 20);
        initDiceRoll(roll, mod, baseDef.stat.toUpperCase());
        trap.phase = 'rolling';
        return;
    }

    // All members resolved
    trap.currentMember = null;
    trap.phase         = 'summary';
}
