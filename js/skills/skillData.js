// All skill definitions — one entry per skill key, all 7 classes.
// effect() functions are placeholders; real logic added per class in follow-up prompts.

const SKILL_DATA = {

    // ── ARCHER ───────────────────────────────────────────────────────────────

    piercing_shot: {
        key: 'piercing_shot',
        class: 'archer',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'dex',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['piercing_shot', 'keen_shot', 'puncture', 'armor_splitter', 'rending_arrow'],
        levels: {
            1: { name: 'Piercing Shot',   description: '1.5x DEX. Ignores armor.',                                        manaCost: 3 },
            2: { name: 'Keen Shot',        description: '1.8x DEX. Ignores armor + 10% bleed chance.',                     manaCost: 3 },
            3: { name: 'Puncture',         description: '2.2x DEX. Ignores armor + 20% bleed chance.',                     manaCost: 3 },
            4: { name: 'Armor Splitter',   description: '2.6x DEX. Ignores armor + -20% armor debuff.',                    manaCost: 3 },
            5: { name: 'Rending Arrow',    description: '3.0x DEX. Ignores armor + stackable -20% armor debuff.',          manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS     = [0, 1.5, 1.8, 2.2, 2.6, 3.0];
            const BLEED_CH  = [0, 0,   0.10, 0.20, 0.20, 0.20];
            const BLEED_DMG = [0, 0,   3,    5,    5,    5   ];

            // Back row requirement — front row reduces output by 30%
            const rowMult = caster.row !== 'back' ? 0.7 : 1.0;
            if (caster.row !== 'back') log(caster.name + ' is in the front row — accuracy reduced!');

            if (rollDodge(target, 'single')) { log(target.name + ' dodged!'); return; }

            // DEX-scaled: express dex*mult as an effective DMG multiplier for calculateDamage
            const dex          = caster.getStat('dex');
            const dmgStat      = Math.max(1, caster.getStat('dmg'));
            const effectiveMult = (dex / dmgStat) * MULTS[level];

            const result   = calculateDamage(caster, target, effectiveMult, false, 'ranged', { ignoreArmor: true });
            const finalDmg = Math.max(1, Math.floor(result.damage * rowMult));
            target.takeDamage(finalDmg, log);
            const msg = result.isCrit
                ? 'CRITICAL! ' + caster.name + ' pierces ' + target.name + ' for ' + finalDmg + '!'
                : caster.name + ' pierces ' + target.name + ' for ' + finalDmg + ' damage!';
            log(msg);
            caster.aggro += Math.floor(finalDmg * 0.5);

            if (level >= 2 && Math.random() < BLEED_CH[level]) {
                applyStatusEffect(target, 'bleed', log, { damage: BLEED_DMG[level] });
            }

            // Level 4+: armor debuff stacks on every hit — no cap
            if (level >= 4) {
                target.armorDebuff = (target.armorDebuff || 0) - 0.20;
                log(target.name + "'s armor is cracked! (" + Math.abs(target.armorDebuff * 100).toFixed(0) + '% reduced DEF)');
            }
        },
    },

    pinning_shot: {
        key: 'pinning_shot',
        class: 'archer',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'dex',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['pinning_shot', 'hobbling_shot', 'immobilizing_bolt'],
        levels: {
            1: { name: 'Pinning Shot',       description: '1.2x DEX. Applies Pinned — melee enemies lose their attack.',             manaCost: 3 },
            2: { name: 'Hobbling Shot',       description: '1.5x DEX. Applies Pinned + Slow for 1 turn.',                            manaCost: 3 },
            3: { name: 'Immobilizing Bolt',   description: '1.8x DEX. Applies Pinned + Slow for 2 turns.',                           manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS = [0, 1.0, 1.3, 1.6];

            const rowMult = caster.row !== 'back' ? 0.7 : 1.0;
            if (caster.row !== 'back') log(caster.name + ' is in the front row — accuracy reduced!');

            if (rollDodge(target, 'single')) { log(target.name + ' dodged!'); return; }

            const dex           = caster.getStat('dex');
            const dmgStat       = Math.max(1, caster.getStat('dmg'));
            const effectiveMult = (dex / dmgStat) * MULTS[level];

            const result   = calculateDamage(caster, target, effectiveMult, false, 'ranged');
            const finalDmg = Math.max(1, Math.floor(result.damage * rowMult));
            target.takeDamage(finalDmg, log);
            const msg = result.isCrit
                ? 'CRITICAL! ' + caster.name + ' pins ' + target.name + ' for ' + finalDmg + '!'
                : caster.name + ' fires at ' + target.name + ' for ' + finalDmg + ' damage!';
            log(msg);
            caster.aggro += Math.floor(finalDmg * 0.5);

            // Pin duration: 1 turn at level 1, 2 turns at levels 2-3
            const pinnedDuration = level === 1 ? 1 : 2;
            applyStatusEffect(target, 'pinned', log, { turnsLeft: pinnedDuration });

            // Warn if this enemy type is immune to the mechanical effect of Pinned
            if (target.attackType === 'ranged' || target.attackType === 'magic') {
                log('Pinned has no effect on this enemy type.');
            }

            // Level 3: bleed linked to pin — expires automatically when the pin wears off
            if (level >= 3) {
                applyStatusEffect(target, 'bleed', log, { damage: 6, bleedLinkedToPin: true, turnsLeft: pinnedDuration });
            }
        },
    },

    volley: {
        key: 'volley',
        class: 'archer',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'dex',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['volley', 'storm_of_arrows'],
        levels: {
            1: { name: 'Volley',            description: '0.8x DEX to all enemies.',                                          manaCost: 3 },
            2: { name: 'Storm of Arrows',   description: '1.2x DEX to all enemies + 15% bleed chance each.',                  manaCost: 3 },
        },
        effect: (caster, targets, level, log) => {
            const rowMult = caster.row !== 'back' ? 0.7 : 1.0;
            if (caster.row !== 'back') log(caster.name + ' is in the front row — accuracy reduced!');

            const dex     = caster.getStat('dex');
            const dmgStat = Math.max(1, caster.getStat('dmg'));

            if (level === 1) {
                // 3 random arrows — each picks a living target independently
                for (let i = 0; i < 3; i++) {
                    const living = targets.filter(e => e.isAlive());
                    if (!living.length) break;
                    const t = living[Math.floor(Math.random() * living.length)];
                    if (rollDodge(t, 'single')) { log(t.name + ' dodged!'); continue; }

                    const result   = calculateDamage(caster, t, (dex / dmgStat) * 0.8, false, 'ranged');
                    const finalDmg = Math.max(1, Math.floor(result.damage * rowMult));
                    t.takeDamage(finalDmg, log);
                    const hit = result.isCrit
                        ? 'CRITICAL! ' + caster.name + ' hits ' + t.name + ' for ' + finalDmg + '!'
                        : caster.name + ' hits ' + t.name + ' for ' + finalDmg + ' damage!';
                    log(hit);
                    caster.aggro += Math.floor(finalDmg * 0.5);
                    if (Math.random() < 0.25) applyStatusEffect(t, 'bleed', log);
                }
            } else {
                // Level 2: 5 player-aimed arrows — combatUI handles each click
                caster.volleyArrowsLeft  = 5;
                caster.volleyDamage      = dex / dmgStat;   // effective mult at 1.0× dex
                caster.volleyRowMult     = rowMult;
                log(caster.name + ' nocks a volley — aim 5 arrows!');
            }
        },
    },

    eclipse: {
        key: 'eclipse',
        class: 'archer',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'dex',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['eclipse'],
        levels: {
            1: { name: 'Eclipse',   description: '2.0x DEX to all enemies. Applies Blind to all for 2 turns.',    manaCost: 3 },
        },
        effect: (caster, _targets, level, log) => {
            const rowMult = caster.row !== 'back' ? 0.7 : 1.0;
            if (caster.row !== 'back') log(caster.name + ' is in the front row — accuracy reduced!');

            const dex     = caster.getStat('dex');
            const dmgStat = Math.max(1, caster.getStat('dmg'));

            // 3 player-aimed arrows — combatUI fires each on click; stun check fires after arrow 3
            caster.eclipseArrowsLeft = 3;
            caster.eclipseDamage     = (dex / dmgStat) * 2.0;
            caster.eclipseRowMult    = rowMult;
            caster.eclipseTargets    = [];
            log(caster.name + ' draws Eclipse — aim 3 arrows!');
        },
    },

    // ── CLERIC (Light) ────────────────────────────────────────────────────────

    radiant_word: {
        key: 'radiant_word',
        class: 'cleric',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['radiant_word', 'healing_light', 'mending_prayer', 'restoration', 'divine_renewal'],
        levels: {
            1: { name: 'Radiant Word',    description: 'Heal one ally for 1.5x INT.',                                                      manaCost: 3 },
            2: { name: 'Healing Light',   description: 'Heal one ally for 2.0x INT. Grants Sacred for 1 turn.',                            manaCost: 3 },
            3: { name: 'Mending Prayer',  description: 'Heal one ally for 2.5x INT. Grants Sacred + cleanses 1 debuff.',                   manaCost: 3 },
            4: { name: 'Restoration',     description: 'Heal one ally for 3.0x INT. Grants Sacred + cleanses all debuffs.',                manaCost: 3 },
            5: { name: 'Divine Renewal',  description: 'Heal one ally for 3.5x INT. Grants Sacred + cleanses all debuffs + Bless.',        manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            // Step 1: enemy clicked — store it and hold the turn open for ally selection
            caster.radiantWordTarget      = target;
            caster.radiantWordHealPending = true;
            caster.radiantWordLevel       = level;
            log(caster.name + ' speaks the Radiant Word — select an ally to receive healing!');
        },
    },

    consecrate: {
        key: 'consecrate',
        class: 'cleric',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['consecrate', 'holy_ground', 'sanctified_zone'],
        levels: {
            1: { name: 'Consecrate',        description: 'INT×0.8 holy damage to all enemies. INT×0.5 heal to all allies.',                                       manaCost: 3 },
            2: { name: 'Holy Ground',        description: 'INT×1.1 holy damage to all enemies. INT×0.8 heal to all allies. Marks enemies Sacred.',               manaCost: 3 },
            3: { name: 'Sanctified Zone',    description: 'INT×1.4 holy damage to all enemies. INT×1.1 heal to all allies. Sacred all enemies + 20% DR party.', manaCost: 3 },
        },
        effect: (caster, targets, level, log) => {
            const DMG_MULTS  = [0, 0.8, 1.1, 1.4];
            const HEAL_MULTS = [0, 0.5, 0.8, 1.1];
            const intStat    = caster.getStat('int');

            // ── Damage all enemies ────────────────────────────────────────────
            for (const enemy of targets) {
                if (!enemy.isAlive()) continue;
                let dmg = Math.floor(intStat * DMG_MULTS[level]);
                // 3x damage to undead/demon targets
                if (isUndeadOrDemon(enemy)) dmg *= 3;
                enemy.takeDamage(dmg, log);
                log(caster.name + ' consecrates ' + enemy.name + ' for ' + dmg + ' holy damage!');
                caster.aggro += Math.floor(dmg * 0.5);
                // Level 2+: mark each enemy as Sacred
                if (level >= 2) applySacred(enemy, log);
            }

            // ── Heal all living party members ─────────────────────────────────
            let totalHeal = 0;
            const living  = state.party.filter(m => m.isAlive());
            for (const member of living) {
                let healAmount = Math.floor(intStat * HEAL_MULTS[level]);
                if (member.isSacred) healAmount = Math.floor(healAmount * 1.3);
                member.currentHP = Math.min(member.getMaxHP(), member.currentHP + healAmount);
                log(member.name + ' is healed for ' + healAmount + ' HP!');
                totalHeal += healAmount;
            }
            caster.aggro += Math.floor(totalHeal * 0.8);

            // Level 3: party gains 20% damage reduction for 2 turns
            if (level >= 3) {
                for (const member of living) {
                    member.damageReduction = 0.20;
                    member.damageReductionTurns = 2;
                }
                log('Sanctified Zone — party is shielded by holy light! (20% DR for 2 turns)');
            }
        },
    },

    smite: {
        key: 'smite',
        class: 'cleric',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'magic',
        chargeUp: false,
        upgradeChain: ['smite', 'divine_smite'],
        levels: {
            1: { name: 'Smite',         description: '2.5x INT radiant damage to one enemy. 30% stun chance.',                           manaCost: 3 },
            2: { name: 'Divine Smite',  description: '3.5x INT radiant damage to one enemy. 50% stun + Arcane Burn for 2 turns.',        manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS   = [0, 2.5, 3.5];
            const intStat = caster.getStat('int');

            // Check if the target is already Sacred BEFORE applying damage
            const targetIsSacred = target.activeEffects &&
                target.activeEffects.some(e => e.key === 'sacred');

            let dmg = Math.floor(intStat * MULTS[level]);
            // Always 4x damage vs undead/demon
            if (isUndeadOrDemon(target)) {
                dmg *= 4;
                log('Smite obliterates the unholy!');
            }

            // Smite always ignores armor (pure holy power)
            target.takeDamage(dmg, log);
            log(caster.name + ' smites ' + target.name + ' for ' + dmg + ' holy damage!');
            caster.aggro += Math.floor(dmg * 0.5);

            // Level 2: if target was already Sacred, stun for 2 turns
            if (level >= 2 && targetIsSacred) {
                applyStatusEffect(target, 'stun', log, { turnsLeft: 2 });
                log('Divine Smite — Sacred target is stunned for 2 turns!');
            }
        },
    },

    divine_intervention: {
        key: 'divine_intervention',
        class: 'cleric',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['divine_intervention'],
        levels: {
            1: { name: 'Divine Intervention',   description: 'INT×2 holy damage all enemies. Full heal lowest ally + INT×1.5 to rest. Crisis: Sacred+Stun all enemies.', manaCost: 3 },
        },
        effect: (caster, targets, level, log) => {
            const intStat = caster.getStat('int');

            // Check for crisis BEFORE any healing changes HP
            const crisisActive = state.party.some(
                m => m.isAlive() && m.currentHP < m.getMaxHP() * 0.25
            );

            // ── Damage all enemies ─────────────────────────────────────────────
            for (const enemy of targets) {
                if (!enemy.isAlive()) continue;
                let dmg = Math.floor(intStat * 2.0);
                if (isUndeadOrDemon(enemy)) dmg *= 4;
                enemy.takeDamage(dmg, log);
                log(caster.name + ' calls down Divine Intervention on ' + enemy.name + ' for ' + dmg + ' holy damage!');
                caster.aggro += Math.floor(dmg * 0.5);
            }

            // ── Heal allies ────────────────────────────────────────────────────
            const living = state.party.filter(m => m.isAlive());
            if (!living.length) return;

            // Lowest HP ally gets a full heal
            const lowestHP  = living.slice().sort((a, b) => a.currentHP - b.currentHP)[0];
            const fullHeal  = lowestHP.getMaxHP() - lowestHP.currentHP;
            lowestHP.currentHP = lowestHP.getMaxHP();
            log('Divine Intervention fully restores ' + lowestHP.name + '!');

            // All other living allies heal INT×1.5
            let totalHeal = fullHeal;
            for (const member of living) {
                if (member === lowestHP) continue;
                const healAmount = Math.floor(intStat * 1.5);
                member.currentHP = Math.min(member.getMaxHP(), member.currentHP + healAmount);
                log(member.name + ' is healed for ' + healAmount + ' HP!');
                totalHeal += healAmount;
            }
            caster.aggro += Math.floor(totalHeal * 0.8);

            // ── Crisis bonus: Sacred + Stun all enemies if any ally was critically low ──
            if (crisisActive) {
                log('DIVINE INTERVENTION — Crisis averted! Enemies are struck down!');
                for (const enemy of targets) {
                    if (!enemy.isAlive()) continue;
                    applySacred(enemy, log);
                    applyStatusEffect(enemy, 'stun', log);
                }
            }
        },
    },

    // ── PALADIN ───────────────────────────────────────────────────────────────

    retribution_strike: {
        key: 'retribution_strike',
        class: 'paladin',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['retribution_strike', 'righteous_blow', 'crusader_strike', 'holy_retribution', 'wrath_of_the_just'],
        levels: {
            1: { name: 'Retribution Strike',    description: '1.5x DMG. Bonus holy damage equal to 0.5x INT.',                         manaCost: 3 },
            2: { name: 'Righteous Blow',         description: '1.8x DMG. Bonus holy damage equal to 0.8x INT.',                        manaCost: 3 },
            3: { name: 'Crusader Strike',        description: '2.0x DMG. Bonus holy damage equal to 1.0x INT. 15% Blind.',             manaCost: 3 },
            4: { name: 'Holy Retribution',       description: '2.3x DMG. Bonus holy damage equal to 1.2x INT. 20% Blind.',             manaCost: 3 },
            5: { name: 'Wrath of the Just',      description: '2.8x DMG. Bonus holy damage equal to 1.5x INT. 30% Blind.',             manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[retribution_strike] ${caster.name} uses Retribution Strike (level ${level})`);
        },
    },

    aegis: {
        key: 'aegis',
        class: 'paladin',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'def',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['aegis', 'stalwart_shield', 'fortress_stance'],
        levels: {
            1: { name: 'Aegis',             description: 'Grant Shield to self or one ally. Absorbs the next hit.',                         manaCost: 3 },
            2: { name: 'Stalwart Shield',    description: 'Grant Shield to self and one ally. +10% DEF for 2 turns.',                       manaCost: 3 },
            3: { name: 'Fortress Stance',    description: 'Grant Shield to all allies. +15% DEF to all for 2 turns.',                       manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[aegis] ${caster.name} uses Aegis (level ${level})`);
        },
    },

    holy_aura: {
        key: 'holy_aura',
        class: 'paladin',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['holy_aura', 'divine_aura'],
        levels: {
            1: { name: 'Holy Aura',      description: 'Apply Sacred to all allies for 2 turns. Heal all allies for 1.0x INT.',             manaCost: 3 },
            2: { name: 'Divine Aura',    description: 'Apply Sacred + Bless to all allies for 3 turns. Heal all for 1.5x INT.',            manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[holy_aura] ${caster.name} uses Holy Aura (level ${level})`);
        },
    },

    martyrs_resolve: {
        key: 'martyrs_resolve',
        class: 'paladin',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'hp',
        attackType: 'single',
        chargeUp: true,
        upgradeChain: ['martyrs_resolve'],
        levels: {
            1: { name: "Martyr's Resolve",  description: 'Charge 1 turn. Next turn: sacrifice 40% current HP to deal 3x that value as holy damage to one enemy. Heal all allies for half the damage dealt.', manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[martyrs_resolve] ${caster.name} uses Martyr's Resolve (level ${level})`);
        },
    },

    // ── SUMMONER ──────────────────────────────────────────────────────────────

    call_familiar: {
        key: 'call_familiar',
        class: 'summoner',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['call_familiar', 'bond_creature', 'strengthen_bond', 'pact_bond', 'eternal_familiar'],
        levels: {
            1: { name: 'Call Familiar',     description: 'Summon a Dog familiar. Attacks highest aggro enemy.',        manaCost: 3, familiarKey: 'dog'   },
            2: { name: 'Bond Creature',     description: 'Summon a Snake familiar. Attacks and poisons enemies.',      manaCost: 3, familiarKey: 'snake' },
            3: { name: 'Strengthen Bond',   description: 'Summon a Crow familiar. Attacks and blinds enemies.',        manaCost: 3, familiarKey: 'crow'  },
            4: { name: 'Pact Bond',         description: 'Summon Bats familiar. Attacks and drains enemy HP.',         manaCost: 3, familiarKey: 'bats'  },
            5: { name: 'Eternal Familiar',  description: 'Summon a Golem familiar. Heavy attacks, high HP.',           manaCost: 3, familiarKey: 'golem' },
        },
        effect: (caster, target, level) => {
            console.log(`[call_familiar] ${caster.name} uses Call Familiar (level ${level})`);
        },
    },

    soul_burst: {
        key: 'soul_burst',
        class: 'summoner',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['soul_burst', 'soul_explosion', 'soul_detonation'],
        levels: {
            1: { name: 'Soul Burst',       description: '1.5x INT magic damage to one enemy. Familiar gains +2 DMG until recalled.',   manaCost: 3 },
            2: { name: 'Soul Explosion',   description: '2.0x INT magic damage to one enemy. Familiar gains +4 DMG until recalled.',   manaCost: 3 },
            3: { name: 'Soul Detonation',  description: '2.5x INT magic damage to one enemy. Familiar gains +6 DMG until recalled.',   manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[soul_burst] ${caster.name} uses Soul Burst (level ${level})`);
        },
    },

    blood_pact: {
        key: 'blood_pact',
        class: 'summoner',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['blood_pact', 'crimson_covenant'],
        levels: {
            1: { name: 'Blood Pact',        description: 'Sacrifice 15% max HP. Familiar gains +50% DMG and +2 SPD for 3 turns.',    manaCost: 3 },
            2: { name: 'Crimson Covenant',  description: 'Sacrifice 10% max HP. Familiar gains +80% DMG and +3 SPD for 3 turns.',    manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[blood_pact] ${caster.name} uses Blood Pact (level ${level})`);
        },
    },

    summon_herald: {
        key: 'summon_herald',
        class: 'summoner',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'single',
        chargeUp: true,
        upgradeChain: ['summon_herald'],
        levels: {
            1: { name: 'Summon Herald',  description: 'Charge 1 turn. Next turn: replace current familiar with a Herald — a powerful spirit that deals 3x INT magic damage per turn.', manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[summon_herald] ${caster.name} uses Summon Herald (level ${level})`);
        },
    },

    // ── WARRIOR ───────────────────────────────────────────────────────────────

    power_strike: {
        key: 'power_strike',
        class: 'warrior',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['power_strike', 'heavy_blow', 'crushing_strike', 'overwhelming_force', 'titan_strike'],
        levels: {
            1: { name: 'Power Strike',          description: '2.0x DMG.',                                                               manaCost: 3 },
            2: { name: 'Heavy Blow',             description: '2.5x DMG. 15% stun chance.',                                             manaCost: 3 },
            3: { name: 'Crushing Strike',        description: '3.0x DMG. 20% stun chance.',                                             manaCost: 3 },
            4: { name: 'Overwhelming Force',     description: '3.5x DMG. 25% stun chance + -10% DEF debuff.',                          manaCost: 3 },
            5: { name: 'Titan Strike',           description: '4.0x DMG. 30% stun chance + -20% DEF debuff.',                          manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS   = [0, 2.0, 2.5, 3.0, 3.5, 4.0];
            const STUN_CH = [0, 0,   0.15, 0.20, 0.25, 0.30];
            const ARM_DEB = [0, 0,   0,    0,   -0.10, -0.20];
            // Consume Iron Will's guaranteed crit flag if set
            const forceCrit = !!caster.ironWillCrit;
            if (forceCrit) caster.ironWillCrit = false;
            const result = calculateDamage(caster, target, MULTS[level], forceCrit, 'melee');
            target.takeDamage(result.damage, log);
            if (log) {
                const msg = result.isCrit
                    ? 'CRITICAL! ' + caster.name + ' smashes ' + target.name + ' for ' + result.damage + '!'
                    : caster.name + ' strikes ' + target.name + ' for ' + result.damage + ' damage!';
                log(msg);
            }
            caster.aggro += Math.floor(result.damage * 0.5);
            if (level >= 2 && Math.random() < STUN_CH[level]) applyStatusEffect(target, 'stun', log);
            if (level >= 4 && ARM_DEB[level] !== 0) {
                target.armorDebuff = (target.armorDebuff || 0) + ARM_DEB[level];
                if (log) log(target.name + "'s armor is weakened!");
            }
        },
    },

    shield_bash: {
        key: 'shield_bash',
        class: 'warrior',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'single',
        chargeUp: false,
        loadoutVariant: 'shield',   // only available when warrior has weapon + shield equipped
        upgradeChain: ['shield_bash', 'shield_charge', 'bulwark_smash'],
        levels: {
            1: { name: 'Shield Bash',    description: '1.2x DMG. Stuns target for 1 turn.',                                                manaCost: 3 },
            2: { name: 'Shield Charge',  description: '1.5x DMG. Stuns target for 1 turn + 10% DEF buff to self.',                        manaCost: 3 },
            3: { name: 'Bulwark Smash',  description: '2.0x DMG. Stuns target for 1 turn + 20% DEF buff to self.',                        manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS = [0, 1.2, 1.5, 2.0];
            const DEF_R = [0, 0,   0.10, 0.20];   // damage reduction self-buff levels 2+
            const result = calculateDamage(caster, target, MULTS[level], false, 'melee');
            target.takeDamage(result.damage, log);
            if (log) {
                const msg = result.isCrit
                    ? 'CRITICAL! ' + caster.name + ' bashes ' + target.name + ' for ' + result.damage + '!'
                    : caster.name + ' bashes ' + target.name + ' for ' + result.damage + ' damage!';
                log(msg);
            }
            caster.aggro += Math.floor(result.damage * 0.5);
            // Shield bash always stuns
            applyStatusEffect(target, 'stun', log);
            // Levels 2+ grant a brief damage reduction buff to self
            if (level >= 2) applyStatusEffect(caster, 'battle_hardened', log, { damageReduction: DEF_R[level] });
        },
    },

    double_strike: {
        key: 'double_strike',
        class: 'warrior',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'single',
        chargeUp: false,
        loadoutVariant: 'dualwield',    // only available when warrior has dual weapons equipped
        upgradeChain: ['double_strike', 'flurry', 'whirlwind_slash'],
        levels: {
            1: { name: 'Double Strike',      description: 'Two hits of 1.0x DMG each.',                                                    manaCost: 3 },
            2: { name: 'Flurry',             description: 'Two hits of 1.3x DMG each. 15% bleed chance per hit.',                         manaCost: 3 },
            3: { name: 'Whirlwind Slash',    description: 'Two hits of 1.6x DMG each. 20% bleed chance per hit.',                         manaCost: 3 },
        },
        effect: (caster, target, level, log) => {
            const MULTS    = [0, 1.0, 1.3, 1.6];
            const BLEED_CH = [0, 0,   0.15, 0.20];
            for (let i = 0; i < 2; i++) {
                const result = calculateDamage(caster, target, MULTS[level], false, 'melee');
                target.takeDamage(result.damage, log);
                if (log) {
                    const msg = result.isCrit
                        ? 'CRITICAL! ' + caster.name + ' hits ' + target.name + ' for ' + result.damage + '!'
                        : caster.name + ' hits ' + target.name + ' for ' + result.damage + ' damage!';
                    log(msg);
                }
                caster.aggro += Math.floor(result.damage * 0.5);
                if (level >= 2 && Math.random() < BLEED_CH[level]) applyStatusEffect(target, 'bleed', log);
                if (!target.isAlive()) break;
            }
        },
    },

    iron_will: {
        key: 'iron_will',
        class: 'warrior',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'hp',
        attackType: 'self',
        chargeUp: false,
        upgradeChain: ['iron_will', 'unbreakable'],
        levels: {
            1: { name: 'Iron Will',    description: 'Reduce all incoming damage by 40% until next turn. Regen 3 stamina.',              manaCost: 3 },
            2: { name: 'Unbreakable',  description: 'Reduce all incoming damage by 60% until next turn. Regen 5 stamina. +10% DEF.',   manaCost: 3 },
        },
        effect: (caster, _target, level, log) => {
            const DR    = [0, 0.40, 0.60];
            const REGEN = [0, 3, 5];
            // Level 2 adds a brief DEF bonus — stored in the instance for clean reversal on expiry
            const defBonus = level >= 2 ? Math.max(1, Math.floor(caster.getStat('def') * 0.10)) : 0;
            applyStatusEffect(caster, 'iron_will_buff', log, { damageReduction: DR[level], defBonus });
            caster.currentStamina = Math.min(caster.maxStamina, caster.currentStamina + REGEN[level]);
            if (log) log(caster.name + ' regains ' + REGEN[level] + ' stamina!');
        },
    },

    last_stand: {
        key: 'last_stand',
        class: 'warrior',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'hp',
        attackType: 'self',
        chargeUp: false,
        upgradeChain: ['last_stand'],
        levels: {
            1: { name: 'Last Stand',  description: 'Until next turn: immune to death (survive at 1 HP once). Gain +50% DMG.',    manaCost: 3 },
        },
        effect: (caster, _target, _level, log) => {
            applyStatusEffect(caster, 'last_stand_buff', log);
        },
    },

    // ── BARBARIAN ─────────────────────────────────────────────────────────────

    cleave: {
        key: 'cleave',
        class: 'barbarian',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['cleave', 'wild_cleave', 'berserker_cleave', 'savage_cleave', 'massacre'],
        levels: {
            1: { name: 'Cleave',             description: '1.0x DMG to all enemies.',                                                              manaCost: 3, enragedBonus: false },
            2: { name: 'Wild Cleave',         description: '1.3x DMG to all enemies.',                                                             manaCost: 3, enragedBonus: false },
            3: { name: 'Berserker Cleave',    description: '1.6x DMG to all enemies. +0.4x bonus DMG if Enraged (HP < 50%).',                      manaCost: 3, enragedBonus: true  },
            4: { name: 'Savage Cleave',       description: '2.0x DMG to all enemies. +0.5x bonus DMG if Enraged.',                                 manaCost: 3, enragedBonus: true  },
            5: { name: 'Massacre',            description: '2.4x DMG to all enemies. +0.6x bonus DMG if Enraged. 20% bleed each.',                 manaCost: 3, enragedBonus: true  },
        },
        effect: (caster, targets, level, log) => {
            // Multipliers and per-level tables
            const MULTS        = [0, 1.4, 1.7, 2.0, 2.4, 2.8];
            const BLEED_CH     = [0, 0,   0.20, 0.30, 0.30, 0.40];
            const ENRAGE_BONUS = [0, 0,   0,    0.4,  0.6,  1.0 ];

            // Enraged bonus applies once to the multiplier, shared across all targets
            let mult = MULTS[level];
            if (level >= 3 && isEnraged(caster)) mult += ENRAGE_BONUS[level];

            for (const target of targets) {
                if (!target.isAlive()) continue;
                // Each target rolls AoE dodge independently
                if (rollDodge(target, 'aoe')) { log(target.name + ' dodged!'); continue; }

                const result = calculateDamage(caster, target, mult, false, 'aoe');
                target.takeDamage(result.damage, log);
                const msg = result.isCrit
                    ? 'CRITICAL! ' + caster.name + ' cleaves ' + target.name + ' for ' + result.damage + '!'
                    : caster.name + ' cleaves ' + target.name + ' for ' + result.damage + ' damage!';
                log(msg);
                caster.aggro += Math.floor(result.damage * 0.5);
                if (level >= 2 && Math.random() < BLEED_CH[level]) applyStatusEffect(target, 'bleed', log);
            }
        },
    },

    blood_price: {
        key: 'blood_price',
        class: 'barbarian',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'hp',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['blood_price', 'blood_toll', 'life_tithe'],
        levels: {
            1: { name: 'Blood Price',  description: 'Sacrifice 10% max HP to deal 2.0x DMG.',                                                         manaCost: 3, enragedBonus: false },
            2: { name: 'Blood Toll',   description: 'Sacrifice 10% max HP to deal 2.5x DMG + 20% bleed chance.',                                      manaCost: 3, enragedBonus: false },
            3: { name: 'Life Tithe',   description: 'Sacrifice 10% max HP to deal 3.0x DMG + 30% bleed. +0.5x bonus DMG if Enraged.',                 manaCost: 3, enragedBonus: true  },
        },
        effect: (caster, target, level, log) => {
            const HP_COST_FRACS = [0, 0.08, 0.12, 0.15];
            const MULTS         = [0, 2.2,  2.8,  3.5 ];
            const STUN_CH       = [0, 0,    0.25, 0.40];

            // Level 3 + currently enraged: HP cost is halved before deducting
            let costFrac = HP_COST_FRACS[level];
            if (level >= 3 && isEnraged(caster)) costFrac *= 0.5;
            const hpCost = Math.floor(caster.getMaxHP() * costFrac);

            // Deduct HP first — Barbarian cannot die from their own cost
            const wasEnraged = isEnraged(caster);
            caster.currentHP = Math.max(1, caster.currentHP - hpCost);
            log(caster.name + ' sacrifices ' + hpCost + ' HP!');

            // Log if HP cost pushed caster into Enraged for the first time
            if (!wasEnraged && isEnraged(caster)) log(caster.name + ' is ENRAGED!');

            // Single-target dodge check after HP cost, before damage
            if (rollDodge(target, 'single')) { log(target.name + ' dodged!'); return; }

            // Armor-ignoring strike
            const result = calculateDamage(caster, target, MULTS[level], false, 'melee', { ignoreArmor: true });
            target.takeDamage(result.damage, log);
            const msg = result.isCrit
                ? 'CRITICAL! ' + caster.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
                : caster.name + ' strikes ' + target.name + ' for ' + result.damage + ' damage!';
            log(msg);
            caster.aggro += Math.floor(result.damage * 0.5);

            if (level >= 2 && Math.random() < STUN_CH[level]) applyStatusEffect(target, 'stun', log);
        },
    },

    frenzy: {
        key: 'frenzy',
        class: 'barbarian',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'single',
        chargeUp: false,
        upgradeChain: ['frenzy', 'war_frenzy'],
        levels: {
            1: { name: 'Frenzy',      description: '+30% DMG and +2 SPD for 3 turns. Bonus +20% DMG if Enraged.',     manaCost: 3, enragedBonus: true },
            2: { name: 'War Frenzy',  description: '+50% DMG and +4 SPD for 3 turns. Bonus +30% DMG if Enraged.',     manaCost: 3, enragedBonus: true },
        },
        effect: (caster, target, level, log) => {
            const HITS       = [0, 3, 4];
            const BASE_MULTS = [0, 0.9, 1.1];
            const RAGE_BONUS = [0, 0.2, 0.3];   // added per-hit from hit 2 onward when Enraged
            const BLEED_CH   = [0, 0,   0.20];

            for (let i = 0; i < HITS[level]; i++) {
                if (!target.isAlive()) break;
                // Each hit rolls its own dodge using single-target rules
                if (rollDodge(target, 'single')) { log(target.name + ' dodged!'); continue; }

                // Hits after the first gain an Enraged bonus to their multiplier
                const mult = BASE_MULTS[level] + (i > 0 && isEnraged(caster) ? RAGE_BONUS[level] : 0);
                const result = calculateDamage(caster, target, mult, false, 'melee');
                target.takeDamage(result.damage, log);
                const msg = result.isCrit
                    ? 'CRITICAL! ' + caster.name + ' hits ' + target.name + ' for ' + result.damage + '!'
                    : caster.name + ' hits ' + target.name + ' for ' + result.damage + ' damage!';
                log(msg);
                caster.aggro += Math.floor(result.damage * 0.5);
                // Bleed stacks — each hit can independently apply a fresh bleed
                if (level >= 2 && Math.random() < BLEED_CH[level]) applyStatusEffect(target, 'bleed', log);
            }
        },
    },

    ragnarok: {
        key: 'ragnarok',
        class: 'barbarian',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'dmg',
        attackType: 'aoe',
        chargeUp: false,
        upgradeChain: ['ragnarok'],
        levels: {
            1: { name: 'Ragnarok',  description: '3.0x DMG to all enemies. +1.0x bonus DMG if Enraged. 30% bleed each.',  manaCost: 3, enragedBonus: true },
        },
        effect: (caster, targets, level, log) => {
            // Check third-hit threshold BEFORE the HP cost is deducted
            const extraHit = caster.currentHP < caster.getMaxHP() * 0.25;

            // HP cost — if fatal, defer death until after all damage resolves
            const hpCost = Math.floor(caster.getMaxHP() * 0.20);
            if ((caster.currentHP - hpCost) <= 0) caster.ragnarokDeath = true;
            caster.currentHP = Math.max(1, caster.currentHP - hpCost);
            log(caster.name + ' channels RAGNAROK, sacrificing ' + hpCost + ' HP!');

            // Enraged check after cost is paid (cost may push caster into Enraged)
            const enraged  = isEnraged(caster);
            const baseMult = 2.0 + (enraged ? 1.0 : 0);
            const numHits  = extraHit ? 3 : 2;

            for (let hit = 0; hit < numHits; hit++) {
                for (const target of targets) {
                    if (!target.isAlive()) continue;
                    // Each target rolls AoE dodge independently per hit
                    if (rollDodge(target, 'aoe')) { log(target.name + ' dodged!'); continue; }

                    const result = calculateDamage(caster, target, baseMult, false, 'aoe');
                    target.takeDamage(result.damage, log);
                    const msg = result.isCrit
                        ? 'CRITICAL! ' + caster.name + ' annihilates ' + target.name + ' for ' + result.damage + '!'
                        : caster.name + ' strikes ' + target.name + ' for ' + result.damage + ' damage!';
                    log(msg);
                    caster.aggro += Math.floor(result.damage * 0.5);
                    if (Math.random() < 0.50) applyStatusEffect(target, 'bleed', log);
                }
            }

            // Process deferred Ragnarok death after all damage is applied
            if (caster.ragnarokDeath) {
                caster.ragnarokDeath = false;
                caster.currentHP = 0;
                log('RAGNAROK — ' + caster.name + ' falls.');
            }
        },
    },

    // ── WIZARD ────────────────────────────────────────────────────────────────

    arcane_bolt: {
        key: 'arcane_bolt',
        class: 'wizard',
        rarity: 'common',
        maxLevel: 5,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'magic',
        chargeUp: false,
        overcharge: true,   // overcharge bonus damage logic implemented later
        upgradeChain: ['arcane_bolt', 'arcane_lance', 'arcane_spike', 'arcane_beam', 'arcane_annihilation'],
        levels: {
            1: { name: 'Arcane Bolt',          description: '1.5x INT magic damage to one enemy.',                                              manaCost: 3 },
            2: { name: 'Arcane Lance',          description: '2.0x INT magic damage to one enemy.',                                             manaCost: 3 },
            3: { name: 'Arcane Spike',          description: '2.5x INT magic damage to one enemy. 15% Arcane Burn chance.',                     manaCost: 3 },
            4: { name: 'Arcane Beam',           description: '3.0x INT magic damage to one enemy. 20% Arcane Burn chance.',                     manaCost: 3 },
            5: { name: 'Arcane Annihilation',   description: '3.5x INT magic damage to one enemy. 30% Arcane Burn chance.',                     manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[arcane_bolt] ${caster.name} uses Arcane Bolt (level ${level})`);
        },
    },

    arcane_storm: {
        key: 'arcane_storm',
        class: 'wizard',
        rarity: 'uncommon',
        maxLevel: 3,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'aoe',
        chargeUp: false,
        overcharge: true,   // overcharge bonus damage logic implemented later
        upgradeChain: ['arcane_storm', 'arcane_tempest', 'arcane_cataclysm'],
        levels: {
            1: { name: 'Arcane Storm',      description: '1.2x INT magic damage to all enemies.',                                               manaCost: 3 },
            2: { name: 'Arcane Tempest',    description: '1.6x INT magic damage to all enemies. 20% Arcane Burn chance each.',                  manaCost: 3 },
            3: { name: 'Arcane Cataclysm',  description: '2.0x INT magic damage to all enemies. 30% Arcane Burn chance each.',                  manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[arcane_storm] ${caster.name} uses Arcane Storm (level ${level})`);
        },
    },

    siphon: {
        key: 'siphon',
        class: 'wizard',
        rarity: 'rare',
        maxLevel: 2,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'magic',
        chargeUp: false,
        upgradeChain: ['siphon', 'soul_siphon'],
        levels: {
            1: { name: 'Siphon',       description: '1.5x INT magic damage. Restore mana equal to 50% of damage dealt.',       manaCost: 3 },
            2: { name: 'Soul Siphon',  description: '2.0x INT magic damage. Restore mana equal to 75% of damage dealt.',       manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[siphon] ${caster.name} uses Siphon (level ${level})`);
        },
    },

    singularity: {
        key: 'singularity',
        class: 'wizard',
        rarity: 'legendary',
        maxLevel: 1,
        currentLevel: 1,
        scalingStat: 'int',
        attackType: 'aoe',
        chargeUp: true,
        upgradeChain: ['singularity'],
        levels: {
            1: { name: 'Singularity',  description: 'Charge 1 turn. Next turn: deal 4.0x INT magic damage to all enemies. Applies Arcane Burn for 3 turns to each.', manaCost: 3 },
        },
        effect: (caster, target, level) => {
            console.log(`[singularity] ${caster.name} uses Singularity (level ${level})`);
        },
    },

};

// ─── Radiant Word resolution ───────────────────────────────────────────────────

// Step 2 of Radiant Word two-step targeting: apply damage to the stored enemy and heal the chosen ally.
// Called from combatUI when the player clicks an ally after the Radiant Word effect() set pending state.
function resolveRadiantWord(actor, healTarget, level, log) {
    const DMG_MULTS  = [0, 1.0, 1.2, 1.4, 1.7, 2.0];
    const HEAL_MULTS = [0, 0.8, 1.0, 1.2, 1.4, 1.6];

    const enemy   = actor.radiantWordTarget;
    const intStat = actor.getStat('int');

    // Clear pending state before resolving so the turn can advance normally
    actor.radiantWordHealPending = false;
    actor.radiantWordTarget      = null;
    actor.radiantWordLevel       = null;

    // ── Damage the enemy ─────────────────────────────────────────────────────
    let dmg         = Math.floor(intStat * DMG_MULTS[level]);
    const isUndead  = isUndeadOrDemon(enemy);

    // Level 3+: undead/demon take double damage
    if (level >= 3 && isUndead) {
        dmg *= 2;
        log('Radiant Word sears the unholy — double damage!');
    }

    // Store HP before damage for overflow calc at level 5
    const preDamageHP = enemy.currentHP;

    enemy.takeDamage(dmg, log);
    log(actor.name + ' strikes ' + enemy.name + ' with Radiant Word for ' + dmg + ' holy damage!');
    actor.aggro += Math.floor(dmg * 0.5);

    // Level 4+: 20% blind chance on the enemy
    if (level >= 4 && Math.random() < 0.20) {
        applyStatusEffect(enemy, 'blind', log);
    }

    // ── Heal the selected ally ────────────────────────────────────────────────
    let healAmount = Math.floor(intStat * HEAL_MULTS[level]);
    // Sacred allies receive 30% stronger heals (per Sacred status effect definition)
    if (healTarget.isSacred) healAmount = Math.floor(healAmount * 1.3);

    healTarget.currentHP = Math.min(healTarget.getMaxHP(), healTarget.currentHP + healAmount);
    log(actor.name + ' heals ' + healTarget.name + ' for ' + healAmount + ' HP!');
    actor.aggro += Math.floor(healAmount * 0.8);

    // Level 2+: mark the heal target as Sacred
    if (level >= 2) applySacred(healTarget, log);

    // Level 5: excess damage from killing an undead/demon overflows as party heal
    if (level >= 5 && isUndead) {
        const overflow = Math.max(0, dmg - preDamageHP);
        if (overflow > 0) {
            const living    = state.party.filter(m => m.isAlive());
            const splitHeal = Math.floor(overflow / living.length);
            if (splitHeal > 0 && living.length > 0) {
                for (const member of living) {
                    member.currentHP = Math.min(member.getMaxHP(), member.currentHP + splitHeal);
                }
                log('Holy overflow heals the party for ' + splitHeal + ' HP each!');
                actor.aggro += Math.floor(overflow * 0.8);
            }
        }
    }
}
