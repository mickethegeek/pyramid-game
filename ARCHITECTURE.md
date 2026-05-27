# PYRAMID — Architecture Handoff

This file is a living document for Claude agents (and the developer). It describes the current
real state of the codebase — not the aspirational CLAUDE.md version. When you read CLAUDE.md,
cross-reference here to know what is actually done vs still pending.

---

## Tech Stack

- HTML5 Canvas (1200×640) + vanilla JavaScript. No frameworks, no build step.
- All JS loaded via ordered `<script>` tags in `index.html`. Order matters — see File Load Order.
- Runs via Live Server. Future: Electron wrap.
- Save/load via `localStorage` (two keys: run save + meta save).

---

## What Is Actually Done (as of last update)

- Triangle pyramid navigation (up/sideways, no backtracking)
- Full 7-class combat system with real skill `effect()` functions
- `skillLogic.js` — all 6 management functions implemented (canEquip, equip, unequip, upgrade, discover, getCompatible)
- All 6 familiar templates fully defined in `familiar.js` (Dog, Snake, Crow, Bat, Golem, Herald)
- Goremaw boss: Phase 1 + submerge transition + Phase 2 implemented
- Act 2 / Act 3 bosses: stub entries exist (see Pending below)
- Status effects system: 20+ effects with full onApply/onTick/onExpire hooks
- Procedural item generator (prefix/suffix, 4 rarities)
- Full shop, relic, potion, event, trap systems
- Meta progression + save system
- Row system + aggro + dodge + intercept in combat

---

## What Is Pending / Incomplete

| Gap | File | Severity |
|-----|------|----------|
| `sandPharaoh` has no action table | enemyData.js | High — Act 2 boss is inert |
| `pyramidColossus` has no action table | enemyData.js | High — Act 3 boss is inert |
| `theApex` has no action table | enemyData.js | High — final boss is inert |
| bogShaman `summon_spores` action is a stub | enemyData.js | Medium |
| stranglingHorror `passive` is null | enemyData.js | Medium |
| No Skill UI — players can't equip skills from UI | (missing skillUI.js) | High |
| Gym + Dojo rooms don't exist | (missing) | Medium |
| War Cleric event/unlock not implemented | (missing) | Low |
| Only Act 1 has room compositions | roomCompositions.js | Medium |
| combat.js is 1100+ lines — needs splitting | combat.js | Tech debt |
| `state.activeFamiliars` not in state.js (lazy-init'd in familiar.js) | state.js | Low |
| 8 relics total — runs feel same each time | relicData.js | Content gap |
| 11 events — thin for 3-act game | ui/screens/events/ | Content gap |
| Sprites — all avatars are placeholder | everywhere | Known last |

---

## Stat System

Seven stats: `hp`, `def`, `dmg`, `dex`, `spd`, `int`, `luck`.

**IMPORTANT NAMING RULE**: Code uses `dmg` and `int` everywhere. CLAUDE.md mentions
`STR → DMG` and `WIS → INT` as aliases — ignore this. Those alias names do NOT exist in code.
Any comment still saying "STR" or "WIS" is stale and should be read as `dmg`/`int`.

Three layers on Character instances:
```
finalStat = base[stat] + permanent[stat] + runBonus[stat]
```
Enemies have `baseStats` only — no permanent/runBonus layers.

Crit chance: `(dex + luck) / 100`. Crit multiplier: random between 1.5× and 2.5×.
Dodge chance: `floor(spd / 4)%` single-target, `floor(spd / 8)%` AoE, never for magic.

---

## Combat System Architecture

**Entry point**: `initCombat(party, enemies)` in `combat.js` — returns a `combat` object.

**Turn loop**: `nextTurn(combat)` advances `turnIndex` through a sorted queue. Queue is sorted
by SPD descending. Familiars slot in by SPD when summoned.

**Phase flow**:
```
combat.phase: 'player_turn' | 'enemy_turn' | 'victory' | 'defeat'
```

**Enemy turn delay**: `scheduleEnemyTurn(combat)` sets `combat.pendingEnemyTurn = true` and
`combat.enemyTurnTime = performance.now() + state.settings.enemyTurnDelay`. The game loop in
`main.js` fires `executeEnemyTurn` when time elapses.

**Key combat.js functions**:
- `initCombat` — build queue, apply relic effects, pre-roll intentions
- `nextTurn` — advance index, trigger round-end on full cycle
- `processRoundEnd` — Sacred Aura tick, damage reduction expiry, Goremaw regen, Herald echo
- `prerollEnemyIntentions` — caches enemy actions for telegraph display
- `executeEnemyTurn` — dispatches to Goremaw handler or generic enemy handler
- `executePlayerAttack/Skill/Shield/Potion/RowSwitch` — player action executors
- `handleFamiliarDeath` — fires onDeath hook, prunes queue, updates state.activeFamiliars
- `recallFamiliarGroup` — fires onRecall, removes group from queue + state

---

## Skill System

### Data flow
```
skillData.js         → defines skill keys, levels, effect() functions
skillLogic.js        → manages equip/unequip/upgrade/discover
character.skillLevels → { skillKey: level } — per-character level tracking
character.baseSkill  → string key — class-locked, slot 1, always equipped
character.equippedSkills → string[] — slots 2+ from sharedSkillInventory
state.sharedSkillInventory → string[] — skills found but not yet slotted
```

### Skill execution
`useSkill(character, skillKey, target, log)` in `actions.js`:
1. Validates skill exists
2. Checks/spends resource (stamina if maxStamina > 0, else mana)
3. Handles charge-up initiation
4. Calls `skillDef.effect(character, target, level, log)`

### Resource system
- Stamina classes (warrior, barbarian, paladin): `maxStamina=10`, regens 3/turn
- Mana classes (cleric, wizard, archer, summoner): `maxMana` varies, no passive regen;
  basic attack restores 2 mana
- Hybrid classes (archer, summoner): stamina 6 + mana

### Charge-up skills
Turn 1: sets `character.charging = { abilityKey, abilityName, turnsLeft: 2 }`.
Turn 2: `scheduleChargeTick` auto-fires `executeChargeUpTick` which calls the effect.

---

## Familiar System

All familiar logic lives in `familiar.js`. Template objects in `FAMILIAR_TEMPLATES`.
Units created by `createFamiliarUnit(template, summoner, hpMult, dmgMult)`.
Groups summoned by `summonFamiliarGroup(summoner, key, combat, log, skipRecall)`.

**State fields**:
- `state.activeFamiliar` — legacy single-familiar reference (backward compat)
- `state.activeFamiliars` — array of all active familiar units (added to state.js)
- `state.batAuraActive` — true when any bat is alive (enemies lose 20% DEF)
- `state.heraldActive` — true when Herald is alive (death echoes on round end)

**Familiar stats scale off Summoner INT**:
- `maxHP = template.hpMultiplier × summoner.INT`
- `dmg = template.dmgMultiplier × summoner.INT`

**Death cleanup**: always go through `handleFamiliarDeath(unit, combat, log)` — it fires
the onDeath hook, handles Dark Covenant double-fire, prunes the queue, and corrects turnIndex.

---

## Enemy System

**Entry**: `createEnemy(key, actNumber)` scales HP/DEF/DMG by act multiplier (1×/1.5×/2×).

**AI dispatch**:
- `getEnemyAction(enemy, aliveParty)` → returns `{ type, target, ability? }`
- Goremaw has its own handler: `executeGoremawTurn(combat)`

**Personality types**: `aggressive` (highest aggro), `cautious` (lowest HP), `smart` (highest INT),
`passive` (defends until `passiveThreshold` turns, then becomes aggressive).

**Passive abilities**: `checkEnemyPassive(enemy, combat, log)` fires at turn start before action
selection. The passive function handles its own trigger condition internally.

**On-death hooks**: called via `handleEnemyDeath(enemy, combat, log)` → `enemy.onDeath(party, enemies, log)`.

---

## Status Effect System

All definitions in `STATUS_EFFECTS` object in `statusEffects.js`.
Applied via `applyStatusEffect(combatant, key, log, options)`.
Ticked via `tickStatusEffects(combatant, log)` — called at start of each turn.

Instance data: each effect instance is `{ key, turnsLeft, ...options }`. The instance is passed
as a third argument to `onApply`/`onExpire` so dynamic effects (embolden, iron_will_buff, etc.)
can store and retrieve data per-stack.

`modStat(combatant, stat, delta)` targets the right layer: `runBonus` for characters,
`baseStats` for enemies. Always reversed on expire.

---

## Damage Formula

```
raw     = attacker.DMG × abilityMultiplier × attackRowMult × defenseRowMult × stanceMult
base    = max(1, raw − effectiveDEF)        // skip if ignoreArmor
damage  = floor(base × critMult)            // critMult: 1.0 or random [1.5, 2.5]
damage  = floor(damage × 0.75)             // if defender in guard stance
damage  = floor(damage × (1 - DR))         // if damageReduction active
```

Row modifiers: attacker back row → ×0.9; attacker front row → ×1.2; defender front row → ×1.3.
`armorDebuff` on defender: `effectiveDEF = DEF × (1.0 + armorDebuff)` where debuff is negative.

Temp-HP (temp_shield): absorbs incoming damage first, with optional `shieldDamageReduction`.
Retribution: reflects `rawDamage × reflectFraction` back at attacker, optionally armor-piercing.

---

## Item System

`generateItem(type?, rarity?)` in `itemGenerator.js`:
1. Pick base item (filtered by type if provided)
2. Roll rarity (60% common → 3% legendary)
3. Pick prefix from category-specific pool (metalWeapon / rangedWeapon / etc.)
4. 40% chance of positive suffix on rare/legendary; 20% negative on common/uncommon

`restoreItem(data)` in `lootTable.js` handles backward compat: old key-based saves are
converted to full generated items at restore time.

Passive suffix effects (`burn_on_hit`, `poison_on_hit`, `stun_chance`, `lifesteal_on_kill`)
are checked in `applyOnHitPassives(attacker, defender, log)` in `actions.js`.
`hasPassive(character, key)` checks equipped items for matching suffix key.

---

## Save System

Two localStorage keys:
- `SAVE_KEY_META` — discovered classes/skills, soul shards, permanent upgrades, general upgrades
- `SAVE_KEY_RUN` — current room, pyramid state, serialized party, inventory, gold, relics, potions

Party restoration: `CLASS_FACTORIES` map in `saveSystem.js` maps `classKey → factory function`.
Items: serialized as full objects; restored by `restoreItem()`.

---

## File Load Order (critical — must be respected in index.html)

```
state.js → renderer.js → input.js
→ pyramid/* → meta/*
→ statusEffects.js
→ characters/character.js → characters/familiar.js → characters/classes/*
→ items/item.js → items/itemData.js → items/lootTable.js → items/itemGenerator.js
→ items/potionData.js → items/potionLogic.js
→ enemies/enemy.js → enemies/enemyData.js → enemies/enemyAI.js → enemies/roomCompositions.js
→ skills/skillData.js → skills/skillLogic.js
→ combat/statusEffects.js → combat/damageCalc.js → combat/actions.js → combat/combat.js
→ ui/screens/* → main.js
```

---

## Known Technical Debt

1. **combat.js (1100+ lines)**: Violates one-file-one-responsibility. Priority split:
   - `turnQueue.js` → buildInitiativeQueue, nextTurn, decayAggro, getCurrentActor
   - `roundManager.js` → processRoundEnd, prerollEnemyIntentions, addToLog
   - `combat.js` → orchestrator only (initCombat + player/enemy action dispatchers)

2. **Script tag load order**: Fragile manual dependency ordering. Safe to leave until ~60+ files.
   At that point: write a simple bash concatenation script to bundle in correct order.

3. **STR/WIS aliasing**: Stale comments in skillData.js say "STR maps to DMG" — code already
   uses `dmg`/`int` everywhere. Remove stale comments when editing those files.

4. **`state.activeFamiliars`**: Was lazy-initialized in familiar.js; now declared in state.js.
   All access patterns already guard with `(state.activeFamiliars || [])` — safe.

5. **bogWitch `wither` on party members**: Uses `slow` as a DEF-debuff proxy. Correct fix is a
   proper `armor_debuff` status effect that sets `target.armorDebuff = -0.20` for 2 turns.
   Low priority — functionally it still applies a meaningful debuff.

---

## Priority Order for Next Work

1. **Skill UI** (`skillUI.js`) — the logic exists in skillLogic.js but there is no screen to equip/swap skills. This is the highest-impact missing feature.
2. **Room compositions for Acts 2 & 3** — currently all 3 acts reuse Act 1 enemy groups in the spawn table fallback.
3. **More relics** (at least 20 more) — run variance is too low with only 8.
4. **More events** (target 25+) — 11 events is too thin for a 3-act game.
5. **Gym + Dojo rooms + trainingUI.js** — skill progression mid-run.
6. **War Cleric discovery** — event/item unlock path.
7. **Split combat.js** — only after the content gaps above are addressed.
8. **Balance pass** — stats, damage numbers, act scaling.
9. **Sprites** — last.

---

## Design Decisions Made (that are not obvious from the code)

- **`isUndeadOrDemon(enemy)`** is called in Cleric skills but the function must exist in scope.
  Check that it's defined before adding undead/demon enemies.
- **`applySacred(target, log)`** is a helper called from multiple Cleric skills — it wraps
  `applyStatusEffect(target, 'sacred', log)`. Should be defined in skillData.js or statusEffects.js.
- **Goremaw bogRatBuff** is per-instance not per-definition — copied onto the instance in
  `createEnemy()` line 147-157. The base `ENEMY_DATA.goremaw` object is NOT mutated.
- **Charge-up timing**: Two-turn charges spend the resource on Turn 1, fire on Turn 2.
  The executing code in `executeChargeUpTick` fires automatically via the game loop.
- **Radiant Word two-step**: The Cleric clicks skill → `radiantWordHealPending = true` →
  player clicks an ally → `resolveRadiantWord()` in skillData.js fires. combatUI holds the turn.
- **Eclipse / Volley L2**: Player-aimed multi-arrow mode. combatUI tracks `volleyArrowsLeft` /
  `eclipseArrowsLeft`; each enemy click fires one arrow.
- **Overcharge (Wizard)**: `pendingOvercharge` is set on the caster by combatUI slider before
  `useSkill` is called. `useSkill` calls `effect()` which reads and clears it.
