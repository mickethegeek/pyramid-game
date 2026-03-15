// All relic definitions — data only, no Relic instances
// onApply(party) is called when the relic is acquired.
// onRemove(party) reverses additive bonuses on run end/reset.

const RELIC_DATA = {

    // ─── Positive relics ──────────────────────────────────────────────────────

    ancestors_blessing: {
        key:         'ancestors_blessing',
        name:        "Ancestor's Blessing",
        description: 'The whole party gains +2 LUCK.',
        cursed:      false,
        onApply:  function (party) { for (const m of party) m.runBonus.luck = (m.runBonus.luck || 0) + 2; },
        onRemove: function (party) { for (const m of party) m.runBonus.luck = (m.runBonus.luck || 0) - 2; },
    },

    war_banner: {
        key:         'war_banner',
        name:        'War Banner',
        description: 'The whole party gains +3 DMG.',
        cursed:      false,
        onApply:  function (party) { for (const m of party) m.runBonus.dmg = (m.runBonus.dmg || 0) + 3; },
        onRemove: function (party) { for (const m of party) m.runBonus.dmg = (m.runBonus.dmg || 0) - 3; },
    },

    iron_discipline: {
        key:         'iron_discipline',
        name:        'Iron Discipline',
        description: 'The whole party gains +2 DEF.',
        cursed:      false,
        onApply:  function (party) { for (const m of party) m.runBonus.def = (m.runBonus.def || 0) + 2; },
        onRemove: function (party) { for (const m of party) m.runBonus.def = (m.runBonus.def || 0) - 2; },
    },

    swift_winds: {
        key:         'swift_winds',
        name:        'Swift Winds',
        description: 'The whole party gains +2 SPD.',
        cursed:      false,
        onApply:  function (party) { for (const m of party) m.runBonus.spd = (m.runBonus.spd || 0) + 2; },
        onRemove: function (party) { for (const m of party) m.runBonus.spd = (m.runBonus.spd || 0) - 2; },
    },

    sages_codex: {
        key:         'sages_codex',
        name:        "Sage's Codex",
        description: 'The whole party gains +3 INT.',
        cursed:      false,
        onApply:  function (party) { for (const m of party) m.runBonus.int = (m.runBonus.int || 0) + 3; },
        onRemove: function (party) { for (const m of party) m.runBonus.int = (m.runBonus.int || 0) - 3; },
    },

    blood_oath: {
        key:         'blood_oath',
        name:        'Blood Oath',
        description: 'Whole party gains +15 max HP but loses -3 DEF.',
        cursed:      false,
        onApply: function (party) {
            for (const m of party) {
                m.runBonus.hp  = (m.runBonus.hp  || 0) + 15;
                m.runBonus.def = (m.runBonus.def || 0) - 3;
                m.currentHP = Math.min(m.currentHP + 15, m.getMaxHP());
            }
        },
        onRemove: function (party) {
            for (const m of party) {
                m.runBonus.hp  = (m.runBonus.hp  || 0) - 15;
                m.runBonus.def = (m.runBonus.def || 0) + 3;
                m.currentHP = Math.min(m.currentHP, m.getMaxHP());
            }
        },
    },

    // ─── Cursed relics ────────────────────────────────────────────────────────

    veil_of_greed: {
        key:         'veil_of_greed',
        name:        'Veil of Greed',
        description: 'All gold drops are reduced by 40%.',
        cursed:      true,
        // Effect applied in awardCombatGold via hasRelic('veil_of_greed')
        onApply:  function () {},
        onRemove: function () {},
    },

    blood_pact: {
        key:         'blood_pact',
        name:        'Blood Pact',
        description: 'One random party member permanently loses 20% max HP for this run.',
        cursed:      true,
        onApply: function (party) {
            const living = party.filter(function (m) { return m.isAlive(); });
            if (living.length === 0) return;
            const target = living[Math.floor(Math.random() * living.length)];
            const loss   = Math.floor(target.getMaxHP() * 0.20);
            target.runBonus.hp = (target.runBonus.hp || 0) - loss;
            target.currentHP   = Math.min(target.currentHP, target.getMaxHP());
        },
        // Loss amount varies per target so onRemove is a no-op — run is discarded anyway
        onRemove: function () {},
    },

    cursed_by_doubt: {
        key:         'cursed_by_doubt',
        name:        'Cursed by Doubt',
        description: 'The whole party suffers -2 to all stats.',
        cursed:      true,
        onApply: function (party) {
            const stats = ['def', 'dmg', 'dex', 'spd', 'int', 'luck'];
            for (const m of party) {
                for (const s of stats) m.runBonus[s] = (m.runBonus[s] || 0) - 2;
            }
        },
        onRemove: function (party) {
            const stats = ['def', 'dmg', 'dex', 'spd', 'int', 'luck'];
            for (const m of party) {
                for (const s of stats) m.runBonus[s] = (m.runBonus[s] || 0) + 2;
            }
        },
    },

    mark_of_suffering: {
        key:         'mark_of_suffering',
        name:        'Mark of Suffering',
        description: 'The whole party takes 5 damage at the start of every combat.',
        cursed:      true,
        // Effect applied in initCombat via hasRelic('mark_of_suffering')
        onApply:  function () {},
        onRemove: function () {},
    },

};
