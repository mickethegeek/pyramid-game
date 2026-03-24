# PYRAMID — Project Brief

## What is this game?
Turn-based roguelite. Player builds a party of up to 6 characters and climbs a
triangular pyramid dungeon. 3 acts × 15 layers each. Die = lose run, keep
permanent upgrades and discovered classes/skills/enemies. Ancient civilisation
× fantasy aesthetic. Live at: https://mickethegeek.github.io/pyramid-game

## Tech Stack
HTML5 Canvas + vanilla JavaScript only. No frameworks, no npm, no build tools.
Runs via Live Server in browser. Future: Electron wrap for desktop.

## Core Rules — never break these
1. Data-driven. All definitions in data files, never hardcoded in logic.
2. One file, one responsibility.
3. No global variables except state.js.
4. Every function does one thing with a one-line comment.
5. When unsure about design — STOP and ask before writing code.
6. One file at a time. Tell the developer what to test after each file.
7. Developer is a beginner — explain what you're doing as you go.

## File Structure
```
pyramid-game/
  index.html, style.css, CLAUDE.md
  js/
    main.js, state.js, input.js, renderer.js
    pyramid/        pyramid.js, room.js, navigation.js, treasureRoom.js
    combat/         combat.js, actions.js, statusEffects.js, damageCalc.js
    characters/     character.js, familiar.js,
                    classes/(warrior/barbarian/cleric/archer/wizard/paladin/summoner).js
    enemies/        enemy.js, enemyData.js, enemyAI.js, roomCompositions.js
    items/          item.js, itemData.js, lootTable.js, itemGenerator.js,
                    potionData.js, potionLogic.js, relic.js, relicData.js
    skills/         skillData.js, skillLogic.js
    meta/           metaProgress.js, saveSystem.js
    ui/screens/     mainMenu.js, runStart.js, pyramidView.js, combatUI.js,
                    shopUI.js, eventUI.js, metaScreen.js, gameOver.js,
                    trapUI.js, treasureUI.js, relicPickUI.js
    ui/screens/events/  evHelpers.js, evBlackMarket.js, evDeserter.js,
                        evWoundedMerchant.js, evOracle.js, evAncientAltar.js,
                        evDyingScholar.js, evMirage.js, evPitFighter.js,
                        evTombForgotten.js, evWeaponCache.js, evGambler.js,
                        evHeroEncounter.js
    ui/components/  healthBar.js, statPanel.js, tooltip.js,
                    diceRoll.js, characterPicker.js
```

## Stats
HP, DEF, DMG, DEX, SPD, INT, LUCK. Three layers: base + permanent + runBonus.
Final = sum of all three. STR maps to DMG, WIS maps to INT throughout.

## Classes
Warrior, Barbarian, Cleric, Archer, Wizard, Paladin, Summoner.
Discovered during runs. Multiple of same class allowed. Permanent upgrades
affect all instances of that class.
Cleric starts as Light Cleric (Radiant Word). War Cleric (Zealot's Strike)
unlocked via in-run event/item, then choosable via meta progression.
Warrior loadout: weapon+shield enables Shield Bash, dual wield enables
Double Strike. Detected automatically from equipment at combat start.

## Combat System
Turn-based, SPD-ordered initiative queue. Party + enemies + familiars all
slot into the same queue by SPD stat.

### Resources
- Physical classes (warrior, barbarian, paladin): Stamina only.
  maxStamina=10, regens 3/turn.
- Hybrid classes (archer, summoner): Stamina (max 6, regen 2) + Mana.
- Caster classes (wizard, cleric): Mana only.
- All mana/stamina costs currently placeholder value of 3.

### Rows
Every combatant has row: 'front' | 'back'.
- Front row: +20% damage dealt, +30% damage received.
- Back row: -10% damage dealt.
- Melee attacks on back row trigger front row interception (free basic
  attack from highest aggro front row ally, undodgeable).
- Switching rows costs an action (free action for Warrior stance switch).
- attackType: 'melee' | 'ranged' | 'magic' | 'aoe' on every attack.

### Dodge
- Single target: floor(SPD/4)% dodge chance. No threshold.
- AoE: floor(SPD/8)% dodge chance per target. No threshold.
- Magic: never misses.
- Interception hit: SPD ≤ 25 = 0% dodge. SPD > 25 = floor(SPD/8)%.

### Aggro
Every combatant has aggro value. Generates from:
- Dealing damage: +damageDone * 0.5
- Using any ability: +10
- Being in front row at combat start: +20
- Healing: healer.aggro += healAmount * 0.8 — added inside each
  healing ability's use() function, NOT in combat.js.
- Decay: -5% end of each full round, minimum 0.

### Enemy AI Personalities
- aggressive: targets highest aggro
- cautious: targets lowest HP
- smart: targets highest INT
- passive: defends until passiveThreshold turns, then targets highest aggro
- Taunt overrides all personalities.

### Enemy Telegraphing
Before each enemy acts, intended action stored as:
enemy.intendedAction = { name, targetName, type }
type: 'attack' | 'heal' | 'buff' | 'debuff' | 'summon'
Displayed in combatUI above enemy avatar during player turn.

### Charge-up Abilities
Two-turn execution. Turn 1: sets caster.charging = { ability, turnsLeft: 2 }.
Caster cannot act while charging. Turn 2: fires automatically.
If caster dies while charging: ability lost, log interrupted message.
Charge-up skills: martyrs_resolve, summon_herald, singularity.

### Familiars (Summoner)
Separate combatants in initiative queue, slot in by SPD stat.
Act autonomously — attack highest aggro enemy each turn.
Have HP, DMG, SPD, On-Death and On-Recall hooks.
Only one active at a time (state.activeFamiliar).
Familiars: Dog, Snake, Crow, Bats, Golem — unlocked per Call Familiar level.
Soul Burst detonates active familiar for burst damage + triggers On-Death.

### Warrior Stances
Battle Stance: +20% damage dealt. Guard Stance: +25% damage reduction.
Switching stance is a free action that costs the turn.
Shield Bash available with weapon+shield loadout.
Double Strike available with dual wield loadout.
Loadout detected automatically at combat start via updateWarriorLoadout().

### Barbarian Enraged State
Enraged = currentHP < 50% maxHP.
Certain skills deal bonus damage or trigger extra effects when Enraged.
Self-damage abilities (Blood Price, Ragnarok) interact with Enraged threshold.

### Wizard Overcharge
arcane_bolt and arcane_storm have overcharge: true flag.
Spending extra mana beyond base cost increases damage.
Can burn beyond max mana pool into HP (1% max HP per mana point over cap).
Logic pending implementation.

## Enemy System
### Act 1 Roster
Normal: Bog Rat (aggressive), Swamp Crawler (cautious), Vine Strangler
(aggressive), Bog Witch (smart), Mud Golem (aggressive)
Elites: Bog Shaman (smart), Strangling Horror (aggressive)
Boss: Goremaw — two phase (pending full implementation)

### On-Death Hooks
- Bog Rat: surviving Bog Rats all Scatter (DEF→0, SPD+8 for 2 turns)
- Swamp Crawler: 10 dmg + 15% poison to all party
- Vine Strangler: removes +10% DEF passive from remaining allies
- Mud Golem: damage share passive (60/40 split between two Golems)
- Vine Strangler passive: while alive all allies gain +10% DEF

### Room Compositions — Act 1
7 compositions guaranteed once each per act in random order. Carried
forward if player skips room. After all 7 used: random 2-4 enemies.
Queue stored in state.act1CompositionsRemaining.
Compositions: The Pack, The Bloat, The Warden, The Hex Room,
The Slow Death, The Wall, The Spiral.
Elite rooms bypass composition queue entirely.

## Skill System
24 skills defined in skillData.js across all 7 classes.
Skill structure: key, name, class, rarity, maxLevel, currentLevel,
scalingStat, attackType, chargeUp, upgradeChain, levels{}, effect().

### Skill Slots
- Slot 1: base skill, class-locked, always equipped, upgradeable
- Slot 2: open, any compatible skill from sharedSkillInventory
- Meta upgrade unlocks slot 3

### Rarities & Max Levels
- Common: max level 5
- Uncommon: max level 3
- Rare: max level 2
- Legendary: max level 1 (no upgrade path)

### Upgrade Chain
Each level up changes skill name and description within upgradeChain array.
Skills do not cross into different upgrade chains on upgrade.

### Skill Management (skillLogic.js — stubs, logic pending)
canEquipSkill, equipSkill, unequipSkill, upgradeSkill,
discoverSkill, getCompatibleSkills, updateWarriorLoadout

### State Fields
- state.sharedSkillInventory = []
- state.meta.discoveredSkills = []
- character.baseSkill = null
- character.equippedSkills = []

### Sources (pending implementation)
Treasure chest (slim chance), elite kill #10, Wandering Master event,
Gym room (6 rooms, base skill upgrade only),
Dojo room (8 rooms, upgrade or new skill).
Training absence: character missing from combat/traps/events while away.
If return would miss boss: capped to campsite, full buff still applies.

## Status Effects
Existing: Poison, Burn, Stun, Bleed, Taunt, Rage, Shield, Slow, Bless, Curse
New: Blind (35% miss chance), Arcane Burn (magic DoT ignores armor),
Pinned (melee enemies lose attack that turn),
Sacred (holy bonus dmg on enemies / bonus healing on allies),
Retribution (reflects % damage back at attacker), Enraged(buffs barbarian)

## Key Systems Built
- Triangle pyramid navigation (up/sideways only, no backtracking)
- Turn-based combat: SPD-ordered initiative, click-to-target
- 7 classes with unique abilities and status effects
- 11 events + hero encounter (split into individual files)
- Interactive trap system: spike pit, falling log, riddle, lucky doors
- Potion system: 5 types, combat item button, INT/DEX affects potions
- Shield combat action (70% damage block, 2x mana regen)
- Treasure room: chest vs relic choice, act-scaled loot, potion drops
- Shop: items + potions + 1 relic slot (rotates per act, 400g)
- Relic system: positive + cursed, 2-col display with hover tooltips
- Meta relic pick at run start (unlockable, 3 tiers)
- Procedural item generator (prefix + base + suffix, 4 rarities)
- Soul Shards + meta progression + permanent upgrades
- Save system (localStorage), 3-act structure, unique bosses
- Pyramid Awareness (rumble → damage/weight shift/boss buff)
- Inventory screen: scroll + sort by rarity/type
- GitHub Pages deployment

## Room Types & Weights
Combat 35%, Elite 10%, Shop 12%, Event 12%, Treasure 8%, Rest 8%,
Trap 6%, Ambush 5%, Warp 4%, Boss fixed at apex.
Pyramid Awareness shifts trap/combat weight up as rooms increase.

## Pending Implementation (in order)
- skillLogic.js real implementations (equip, upgrade, discover, transfer)
- skillUI.js (equipment screen integration)
- Familiar definitions in familiar.js (Dog, Snake, Crow, Bats, Golem)
- Skill effect() real implementations per class
- Goremaw full two-phase boss
- Pre-combat room preview (relic/meta unlock)
- Gym + Dojo rooms, Wandering Master event, trainingUI.js
- Cleric War archetype discovery event
- More relics (5 positive + 5 cursed designed, need adding to relicData.js)
- Charisma stat
- Mob codex + Skill codex (meta discovery tracking)
- Sprites (last)