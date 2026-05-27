// All enemy definitions — data only, logic lives in enemyAI.js and class files
//
// New fields added to each entry:
//   personality        — targeting behaviour key (see getTarget in enemyAI.js)
//   passiveThreshold   — turnCount below which 'passive' personality defends; null otherwise
//   attackType         — 'melee' | 'ranged' | 'magic' (used by damageCalc row rules + Pinned)
//   resistances        — { damageType: multiplier | 'immune' }  e.g. { poison: 'immune', fire: 0.5 }
//   weaknesses         — { damageType: multiplier }             e.g. { fire: 1.5 }
//   actions            — weighted action table; each entry: { key, weight, condition?, use(self,target,log,combat) }
//   passive            — function(self, combat, log) called every turn; handles its own trigger internally
//   onDeath            — function(self, combat, log) called when this enemy dies

const ENEMY_DATA = {

    // ─── Act 1 Normal Enemies ─────────────────────────────────────────────────

    bogRat: {
        name:             'Bog Rat',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'random',
        resistances:      {},
        weaknesses:       { fire: 1.5 },
        stats: { hp: 45, def: 5, dmg: 12, dex: 14, spd: 16, int: 3, luck: 8 },

        actions: [
            {
                key: 'gnaw', weight: 50,
                // Single-target bite at full melee damage
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    log(self.name + ' gnaws ' + target.name + ' for ' + result.damage + ' damage!');
                },
            },
            {
                key: 'swarm_bite', weight: 30,
                // Hits two random alive party members for 7 each
                use(self, _target, log, combat) {
                    const alive = combat.party.filter(m => m.isAlive());
                    for (let i = 0; i < 2; i++) {
                        const hit = alive[Math.floor(Math.random() * alive.length)];
                        if (hit) {
                            hit.takeDamage(7, log);
                            log(self.name + ' bites ' + hit.name + ' for 7 damage!');
                        }
                    }
                },
            },
            {
                key: 'scatter', weight: 20, type: 'buff',
                // Self-buff: drops DEF to 0 and gains +8 SPD — becomes a speed threat
                use(self, _target, log, _combat) {
                    self.baseStats.def = 0;
                    self.baseStats.spd += 8;
                    log(self.name + ' scatters! (DEF → 0, SPD +8)');
                },
            },
        ],

        // When a Bog Rat dies, all surviving Bog Rats automatically Scatter
        onDeath(self, combat, log) {
            const otherRats = combat.enemies.filter(e => e.key === 'bogRat' && e.isAlive());
            if (!otherRats.length) return;
            for (const rat of otherRats) {
                rat.baseStats.def = 0;
                rat.baseStats.spd += 8;
                log(rat.name + ' scatters in a frenzy!');
            }
        },

        passive: null,
    },

    swampCrawler: {
        name:             'Swamp Crawler',
        personality:      'cautious',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'random',
        resistances:      { poison: 'immune' },
        weaknesses:       {},
        stats: { hp: 80, def: 12, dmg: 15, dex: 8, spd: 7, int: 5, luck: 6 },

        actions: [
            {
                key: 'venomous_bite', weight: 40,
                // Melee hit + 30% poison chance
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    log(self.name + ' bites ' + target.name + ' for ' + result.damage + ' damage!');
                    if (Math.random() < 0.30) applyStatusEffect(target, 'poison', log);
                },
            },
            {
                key: 'toxic_spit', weight: 35,
                // AoE 8 damage + 20% poison chance to every alive party member
                use(self, _target, log, combat) {
                    log(self.name + ' unleashes Toxic Spit on the whole party!');
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        member.takeDamage(8, log);
                        log(member.name + ' takes 8 toxic damage!');
                        if (Math.random() < 0.20) applyStatusEffect(member, 'poison', log);
                    }
                },
            },
            {
                key: 'bloat', weight: 25, type: 'buff',
                // Self: DEF +10, SPD -4 for 2 turns — effect reverses automatically on expire
                use(self, _target, log, _combat) {
                    applyStatusEffect(self, 'bloat', log);
                },
            },
        ],

        // On death: burst deals 10 damage + 15% poison chance to each party member
        onDeath(self, combat, log) {
            log(self.name + ' bursts! The party is drenched in venom!');
            for (const member of combat.party.filter(m => m.isAlive())) {
                member.takeDamage(10, log);
                log(member.name + ' takes 10 burst damage!');
                if (Math.random() < 0.15) applyStatusEffect(member, 'poison', log);
            }
        },

        passive: null,
    },

    vineStrangler: {
        name:             'Vine Strangler',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'front',
        resistances:      { bleed: 'immune', physical: 0.75 },
        weaknesses:       { fire: 1.5 },
        stats: { hp: 95, def: 18, dmg: 18, dex: 6, spd: 5, int: 4, luck: 4 },

        actions: [
            {
                key: 'constrict', weight: 45,
                // Melee damage + silence 1 turn (isSilenced checked in executePlayerAbility)
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    if (target.isSilenced !== undefined) target.isSilenced = true;
                    log(self.name + ' constricts ' + target.name + ' for ' + result.damage + '! They are silenced!');
                },
            },
            {
                key: 'thorned_lash', weight: 30,
                // 14 damage + bleed
                use(self, target, log, _combat) {
                    // Multiplier tuned to roughly 14 raw damage at base stats
                    const result = calculateDamage(self, target, 0.78, false, 'melee');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'bleed', log);
                    log(self.name + "'s thorns lash " + target.name + ' for ' + result.damage + ' damage!');
                },
            },
            {
                key: 'root_grasp', weight: 25, type: 'debuff',
                // AoE: no damage, silences the entire alive party for 1 turn
                use(self, _target, log, combat) {
                    log(self.name + "'s roots seize the party! All party members are silenced!");
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        if (member.isSilenced !== undefined) member.isSilenced = true;
                    }
                },
            },
        ],

        // When Vine Strangler dies, immediately remove the DEF aura from all allies
        onDeath(self, combat, log) {
            for (const ally of combat.enemies) {
                if (ally._vineDefBonus) {
                    ally.baseStats.def -= ally._vineDefBonus;
                    ally._vineDefBonus  = 0;
                    log(ally.name + " loses the Vine Strangler's protection.");
                }
            }
        },

        // Aura: applied once on the first turn — all other alive enemies gain +10% DEF.
        // Reversed when the Vine Strangler dies (handled via _vineDefBonus tracking).
        passive(self, combat, log) {
            if (self._vineAuraApplied) return;
            for (const ally of combat.enemies) {
                if (ally !== self && ally.isAlive()) {
                    const bonus = Math.max(1, Math.floor(ally.getStat('def') * 0.10));
                    ally.baseStats.def         += bonus;
                    ally._vineDefBonus          = (ally._vineDefBonus || 0) + bonus;
                }
            }
            self._vineAuraApplied = true;
            log("Vine Strangler's aura strengthens its allies' armor!");
        },

    },

    bogWitch: {
        name:             'Bog Witch',
        personality:      'smart',
        passiveThreshold: null,
        attackType:       'magic',
        row:              'back',
        resistances:      { magic: 0.70 },
        weaknesses:       {},
        stats: { hp: 70, def: 8, dmg: 20, dex: 10, spd: 9, int: 18, luck: 10 },

        actions: [
            {
                key: 'hex', weight: 35, type: 'debuff',
                // Hexes target: applies Curse (DMG penalty) as proxy for highest-stat reduction
                // TODO: upgrade to full stat-scouting hex when the debuff system is expanded
                use(self, target, log, _combat) {
                    applyStatusEffect(target, 'curse', log);
                    log(self.name + ' hexes ' + target.name + '! Their power wanes!');
                },
            },
            {
                key: 'poison_bolt', weight: 30,
                // 20 magic damage + poison 8/turn for 3 turns (uses arcane_burn as proxy)
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'magic');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'poison', log);
                    applyStatusEffect(target, 'arcane_burn', log);
                    log(self.name + "'s Poison Bolt hits " + target.name + ' for ' + result.damage + '!');
                },
            },
            {
                key: 'wither', weight: 20, type: 'debuff',
                // Target DEF -20 for 2 turns (applied to baseStats; enemy-only safe to mutate)
                // On party members: uses slow as a debuff proxy to avoid persisting runBonus changes
                use(self, target, log, _combat) {
                    if (target.baseStats) {
                        // Enemy target: safe to modify directly
                        target.baseStats.def = Math.max(0, (target.baseStats.def || 0) - 20);
                    } else {
                        // Party member: apply slow as debuff proxy (TODO: proper DEF debuff effect)
                        applyStatusEffect(target, 'slow', log);
                    }
                    log(self.name + ' withers ' + target.name + "'s armor! (-20 DEF for 2 turns)");
                },
            },
            {
                key: 'cackle', weight: 15, type: 'buff',
                // All living swamp allies gain +15% of their own DMG for 2 turns.
                // Each ally gets an independent embolden stack that reverses its own bonus on expire.
                use(self, _target, log, combat) {
                    const allies = combat.enemies.filter(e => e.isAlive() && e !== self);
                    if (!allies.length) { log(self.name + ' cackles but has no allies to buff!'); return; }
                    for (const ally of allies) {
                        const bonus = Math.max(1, Math.floor(ally.getStat('dmg') * 0.15));
                        applyStatusEffect(ally, 'embolden', log, { bonus });
                    }
                    log(self.name + ' cackles! Allies are emboldened! (+15% DMG for 2 turns)');
                },
            },
        ],

        onDeath: null,

        // Every 3 turns, automatically cast Cackle regardless of action roll
        passive(self, combat, log) {
            if (self.turnCount <= 0 || self.turnCount % 3 !== 0) return;
            const allies = combat.enemies.filter(e => e.isAlive() && e !== self);
            if (!allies.length) return;
            for (const ally of allies) {
                const bonus = Math.max(1, Math.floor(ally.getStat('dmg') * 0.15));
                applyStatusEffect(ally, 'embolden', log, { bonus });
            }
            log(self.name + "'s ritual Cackle empowers the swarm! (+15% DMG for 2 turns)");
        },
    },

    mudGolem: {
        name:             'Mud Golem',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'front',
        resistances:      { physical: 0.60, bleed: 'immune' },
        weaknesses:       { lightning: 1.5 },
        stats: { hp: 130, def: 30, dmg: 25, dex: 4, spd: 3, int: 2, luck: 3 },

        actions: [
            {
                key: 'slam', weight: 45,
                // Heavy melee hit + 30% stun chance
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    log(self.name + ' slams ' + target.name + ' for ' + result.damage + ' damage!');
                    if (Math.random() < 0.30) applyStatusEffect(target, 'stun', log);
                },
            },
            {
                key: 'mudslide', weight: 35,
                // AoE 15 damage + SPD -3 to each alive party member (slow as proxy)
                use(self, _target, log, combat) {
                    log(self.name + ' unleashes a Mudslide on the whole party!');
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        member.takeDamage(15, log);
                        log(member.name + ' takes 15 mudslide damage!');
                        applyStatusEffect(member, 'slow', log);
                    }
                },
            },
            {
                key: 'harden', weight: 20, type: 'buff',
                // Self DEF +15 for 2 turns — effect reverses automatically on expire
                use(self, _target, log, _combat) {
                    applyStatusEffect(self, 'harden', log);
                },
            },
        ],

        onDeath: null,

        // Passive: if two Mud Golems are present, damage is shared (60/40 split).
        // TODO: implement as a damage intercept hook when takeDamage is extended.
        passive: null,
    },

    // ─── Act 1 Elite Enemies ──────────────────────────────────────────────────

    bogShaman: {
        name:             'Bog Shaman',
        personality:      'smart',
        passiveThreshold: null,
        attackType:       'magic',
        row:              'back',
        resistances:      { poison: 'immune', magic: 0.60 },
        weaknesses:       { fire: 1.30 },
        stats: { hp: 160, def: 15, dmg: 28, dex: 11, spd: 10, int: 24, luck: 12 },

        actions: [
            {
                key: 'swamp_heal', weight: 30, type: 'heal',
                // Heal the lowest-HP living ally for 40 HP
                use(self, _target, log, combat) {
                    const allies = combat.enemies.filter(e => e.isAlive());
                    if (!allies.length) return;
                    const lowest = allies.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
                    lowest.currentHP = Math.min(lowest.getMaxHP(), lowest.currentHP + 40);
                    log(self.name + ' performs Swamp Heal! ' + lowest.name + ' recovers 40 HP!');
                },
            },
            {
                key: 'plague_bolt', weight: 25,
                // Magic damage + poison + 25% curse chance
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'magic');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'poison', log);
                    log(self.name + "'s Plague Bolt infects " + target.name + ' for ' + result.damage + '!');
                    if (Math.random() < 0.25) {
                        applyStatusEffect(target, 'curse', log);
                    }
                },
            },
            {
                key: 'summon_spores', weight: 25, type: 'summon',
                // TODO: spawn a Bog Rat or Swamp Crawler into the combat queue
                use(self, _target, log, _combat) {
                    log(self.name + ' releases a cloud of spores! (Summoning — coming soon)');
                },
            },
            {
                key: 'ritual_curse', weight: 20, type: 'debuff',
                // All party members take a -10% effective debuff (curse as proxy for stat reduction)
                use(self, _target, log, combat) {
                    log(self.name + ' invokes a Ritual Curse on the whole party!');
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        applyStatusEffect(member, 'curse', log);
                        applyStatusEffect(member, 'slow', log);
                    }
                },
            },
        ],

        onDeath: null,

        // Every 3 turns, automatically cast Swamp Heal on the lowest-HP ally
        passive(self, combat, log) {
            if (self.turnCount <= 0 || self.turnCount % 3 !== 0) return;
            const allies = combat.enemies.filter(e => e.isAlive());
            if (!allies.length) return;
            const lowest = allies.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
            lowest.currentHP = Math.min(lowest.getMaxHP(), lowest.currentHP + 40);
            log(self.name + "'s ritual heals " + lowest.name + ' for 40 HP!');
        },
    },

    stranglingHorror: {
        name:             'Strangling Horror',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'front',
        resistances:      { bleed: 'immune', physical: 0.80 },
        weaknesses:       { fire: 1.40 },
        stats: { hp: 220, def: 22, dmg: 35, dex: 9, spd: 8, int: 6, luck: 5 },

        actions: [
            {
                key: 'death_roll', weight: 35,
                // Heavy hit + bleed + silence — available always
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'bleed', log);
                    if (target.isSilenced !== undefined) target.isSilenced = true;
                    log(self.name + "'s Death Roll crushes " + target.name + ' for ' + result.damage + '! Bleed + Silence applied!');
                },
            },
            {
                key: 'crushing_coil', weight: 30,
                // 28 damage + stun + armor shred (-15 DEF to enemy baseStats or party runBonus)
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 0.80, false, 'melee');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'stun', log);
                    // Armor shred: reduce DEF directly on the target
                    if (target.runBonus) {
                        target.runBonus.def = (target.runBonus.def || 0) - 15;
                    } else {
                        target.baseStats.def = Math.max(0, (target.baseStats.def || 0) - 15);
                    }
                    log(self.name + "'s Crushing Coil hits " + target.name + ' for ' + result.damage + '! Armor shredded! (-15 DEF)');
                },
            },
            {
                key: 'regenerate', weight: 20, type: 'heal',
                // Heals self for 30 HP
                use(self, _target, log, _combat) {
                    const restored = Math.min(30, self.getMaxHP() - self.currentHP);
                    self.currentHP += restored;
                    log(self.name + ' regenerates ' + restored + ' HP!');
                },
            },
            {
                key: 'enrage', weight: 15,
                // Only available below 50% HP — always executes Death Roll
                condition: (self) => self.currentHP / self.getMaxHP() <= 0.5,
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'bleed', log);
                    if (target.isSilenced !== undefined) target.isSilenced = true;
                    log(self.name + ' ENRAGES and Death Rolls ' + target.name + ' for ' + result.damage + '!');
                },
            },
        ],

        onDeath: null,

        // Below 50% HP, minimum damage on all attacks increases by 40%
        // TODO: enforce minimum damage floor in calculateDamage when this flag is checked
        passive: null,
    },

    // ─── Act bosses ───────────────────────────────────────────────────────────

    goremaw: {
        name:             'Goremaw',
        intro:            'The water stirs. The ground trembles. Goremaw, the Sunken King, rises from the deep.',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        row:              'front',
        tags:             ['boss', 'serpent'],
        resistances:      { poison: 'immune', bleed: -0.50 },
        weaknesses:       { fire: 1.35 },
        armorShredDouble: true, // armor shred is doubly effective against Goremaw — checked in damageCalc.js
        stats: { hp: 800, def: 25, dmg: 40, dex: 12, spd: 11, int: 10, luck: 8 },

        // Phase tracking fields — initial values, mutated during combat
        phase:       1,
        coilActive:  false,  // true after Coil is used, consumed on next attack
        submerging:  false,  // true during the submerge turn
        turnCount:   0,      // incremented each time Goremaw takes a turn
        bogRatBuff:  0,      // +5 DMG per living Bog Rat spawned by Swamp Summon

        phase1Actions: [
            { weight: 30, key: 'crushing_bite' },
            { weight: 25, key: 'tail_sweep'    },
            { weight: 25, key: 'venom_surge'   },
            { weight: 20, key: 'coil'          },
        ],

        phase2Actions: [
            { weight: 35, key: 'death_lunge' },
            { weight: 25, key: 'swamp_surge' },
            { weight: 25, key: 'thrash'      },
            { weight: 15, key: 'swallow'     },
        ],

        actionDefs: {

            crushing_bite: {
                // Single target, physical. 40 base damage + bleed (10/turn, 3 turns). Target: highest aggro.
                use(self, target, log, _combat) {
                    const result = calculateDamage(self, target, 1.0, false, 'melee');
                    target.takeDamage(result.damage, log);
                    applyStatusEffect(target, 'bleed', log, { damagePerTurn: 10, duration: 3 });
                    log(self.name + ' crushes ' + target.name + ' for ' + result.damage + ' damage! Bleed applied!');
                },
            },

            tail_sweep: {
                // AoE all party, physical. 25 damage each. 30% stun chance per target (duration 1).
                use(self, _target, log, combat) {
                    log(self.name + "'s Tail Sweep crashes through the party!");
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        member.takeDamage(25, log);
                        log(member.name + ' takes 25 damage!');
                        if (Math.random() < 0.30) applyStatusEffect(member, 'stun', log, { duration: 1 });
                    }
                },
            },

            venom_surge: {
                // AoE all party, magic. 20 damage each. Poison (8/turn, 3 turns) to all targets.
                use(self, _target, log, combat) {
                    log(self.name + "'s Venom Surge floods the chamber!");
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        member.takeDamage(20, log);
                        log(member.name + ' takes 20 venom damage!');
                        applyStatusEffect(member, 'poison', log, { damagePerTurn: 8, duration: 3 });
                    }
                },
            },

            coil: {
                // Self only. Drop DEF to 10 and set coilActive — next attack will be devastating.
                use(self, _target, log, _combat) {
                    self.baseStats.def = 10;
                    self.coilActive    = true;
                    log('Goremaw coils — DEF drops to 10 but its next strike will be devastating!');
                },
            },

            death_lunge: {
                // Single target, physical. 55 damage. Bleed (12/turn, 3 turns) + armor shred (-20 DEF, stacks). Target: highest aggro.
                use(self, target, log, _combat) {
                    target.takeDamage(55, log);
                    applyStatusEffect(target, 'bleed', log, { damagePerTurn: 12, duration: 3 });
                    // Armor shred: reduce DEF directly; stacks on repeated hits
                    if (target.runBonus) {
                        target.runBonus.def = Math.max(0, (target.runBonus.def || 0) - 20);
                    } else {
                        target.baseStats.def = Math.max(0, (target.baseStats.def || 0) - 20);
                    }
                    log(self.name + "'s Death Lunge hits " + target.name + ' for 55 damage! Bleed applied! Armor shredded (-20 DEF)!');
                },
            },

            swamp_surge: {
                // AoE all party, physical. 35 damage each. Poison (10/turn, 3 turns) to all targets.
                use(self, _target, log, combat) {
                    log(self.name + "'s Swamp Surge engulfs the party!");
                    for (const member of combat.party.filter(m => m.isAlive())) {
                        member.takeDamage(35, log);
                        log(member.name + ' takes 35 damage!');
                        applyStatusEffect(member, 'poison', log, { damagePerTurn: 10, duration: 3 });
                    }
                },
            },

            thrash: {
                // Hits 3 random living party members for 30 each. Same target can be hit multiple times — rolled independently.
                use(self, _target, log, combat) {
                    log(self.name + ' thrashes wildly!');
                    const alive = combat.party.filter(m => m.isAlive());
                    for (let i = 0; i < 3; i++) {
                        const hit = alive[Math.floor(Math.random() * alive.length)];
                        if (hit) {
                            hit.takeDamage(30, log);
                            log(hit.name + ' takes 30 thrash damage!');
                        }
                    }
                },
            },

            swallow: {
                // Target lowest HP living party member. Instant KO if below 25% HP at execution time; else 55 damage.
                use(self, target, log, _combat) {
                    if (target.currentHP < target.getMaxHP() * 0.25) {
                        target.currentHP = 0;
                        log('Goremaw swallows ' + target.name + ' whole!');
                    } else {
                        target.takeDamage(55, log);
                        log('Goremaw cannot swallow ' + target.name + ' whole — they slip free! (55 damage)');
                    }
                },
            },
        },

        passive: {
            swampSummonInterval: 3,  // every 3 turns in phase 1, spawn 2 Bog Rats. Swamp Summon trigger checked in enemyAI.js.
            phase2Regen:         20, // Goremaw regens 20 HP per turn in phase 2, capped at max HP. Phase 2 regen applied in combat.js onRoundEnd.
            bogRatDmgBonus:       5, // per living Bog Rat spawned by Swamp Summon. bogRatBuff tracked and applied in enemyAI.js.
        },

        onDeath(self, combat, log) {
            const rats = combat.enemies.filter(e => e.key === 'bogRat' && e.spawnedByGoremaw && e.isAlive());
            for (const rat of rats) rat.currentHP = 0;
            if (rats.length) log('Goremaw falls — the Bog Rats scatter into the swamp!');
        },
    },

    sandPharaoh: {
        name:             'Sand Pharaoh',
        intro:            'The Sand Pharaoh stirs from eternal sleep. His curse has claimed countless souls.',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        resistances:      {},
        weaknesses:       {},
        onDeath:          null,
        passive:          null,
        actions:          [],
        stats: { hp: 150, def: 5, dmg: 15, dex: 6, spd: 6, int: 8, luck: 5 },
    },

    pyramidColossus: {
        name:             'Pyramid Colossus',
        intro:            'The Pyramid Colossus shakes the chamber as it rises. Stone grinds against stone.',
        personality:      'aggressive',
        passiveThreshold: null,
        attackType:       'melee',
        resistances:      {},
        weaknesses:       {},
        onDeath:          null,
        passive:          null,
        actions:          [],
        stats: { hp: 180, def: 12, dmg: 12, dex: 4, spd: 4, int: 3, luck: 3 },
    },

    theApex: {
        name:             'The Apex',
        intro:            'The Apex manifests at the summit — ancient, perfect, and utterly merciless.',
        personality:      'smart',
        passiveThreshold: null,
        attackType:       'magic',
        resistances:      {},
        weaknesses:       {},
        onDeath:          null,
        passive:          null,
        actions:          [],
        stats: { hp: 160, def: 8, dmg: 14, dex: 8, spd: 9, int: 8, luck: 8 },
    },
};

// ─── Spawn group tables ────────────────────────────────────────────────────────
// Placeholder groups using Act 1 keys — full room compositions in next prompt.

const ENEMY_SPAWN_GROUPS = {
    normal: {
        1: [
            ['bogRat'],
            ['swampCrawler'],
            ['vineStrangler'],
            ['bogRat', 'bogRat'],
            ['bogRat', 'swampCrawler'],
            ['bogWitch'],
            ['mudGolem'],
        ],
        2: [
            ['bogRat', 'bogRat'],
            ['swampCrawler', 'bogRat'],
            ['bogWitch', 'bogRat'],
            ['mudGolem', 'bogRat'],
            ['vineStrangler', 'bogRat'],
        ],
        3: [
            ['mudGolem', 'mudGolem'],
            ['bogWitch', 'swampCrawler'],
            ['vineStrangler', 'bogWitch'],
            ['mudGolem', 'bogWitch'],
            ['swampCrawler', 'vineStrangler'],
        ],
    },
    elite: {
        1: [
            ['bogShaman'],
            ['stranglingHorror'],
        ],
        2: [
            ['bogShaman', 'bogRat'],
            ['stranglingHorror', 'swampCrawler'],
            ['bogShaman', 'bogShaman'],
        ],
        3: [
            ['stranglingHorror', 'bogShaman'],
            ['stranglingHorror', 'stranglingHorror'],
            ['bogShaman', 'mudGolem'],
        ],
    },
    // Boss rooms always spawn exactly one boss — key indexed by act number
    boss: {
        1: ['goremaw'],
        2: ['pyramidColossus'],
        3: ['theApex'],
    },
};

// Pick and return a random enemy key array for the given room type and act number
function pickEnemyGroup(roomType, actNumber) {
    if (roomType === 'boss') {
        return ENEMY_SPAWN_GROUPS.boss[actNumber] || ENEMY_SPAWN_GROUPS.boss[1];
    }
    const table    = ENEMY_SPAWN_GROUPS[roomType] || ENEMY_SPAWN_GROUPS.normal;
    const actTable = table[actNumber] || table[1];
    return actTable[Math.floor(Math.random() * actTable.length)];
}
