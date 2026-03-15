# PYRAMID — Project Brief

## What is this game?
Turn-based roguelite. Player builds a party of up to 6 characters and climbs a triangular pyramid dungeon. 3 acts per run, each a 15-layer pyramid. Die = lose run but keep permanent upgrades and discovered classes. Ancient civilisation × fantasy aesthetic.

## Tech Stack
HTML5 Canvas + vanilla JavaScript only. No frameworks, no npm, no build tools. Runs via Live Server in browser. Future: Electron wrap for desktop.

## Core Rules — never break these
1. Data-driven. Enemies/items/classes defined in data files, never hardcoded in logic.
2. One file, one responsibility.
3. No global variables except state.js.
4. Every function does one thing. Add a one-line comment explaining it.
5. When unsure about design — STOP and ask before writing code.
6. One file at a time. Tell the developer what to test after each file.
7. Developer is a beginner — explain what you're doing as you go.

## File Structure
```
pyramid-game/
  index.html, style.css, CLAUDE.md
  js/
    main.js, state.js, input.js, renderer.js
    pyramid/        pyramid.js, room.js, navigation.js
    combat/         combat.js, actions.js, statusEffects.js, damageCalc.js
    characters/     character.js, classes/(warrior/barbarian/cleric/archer/wizard/paladin/summoner).js
    enemies/        enemy.js, enemyData.js, enemyAI.js
    items/          item.js, itemData.js, lootTable.js, potionData.js, potionLogic.js, relic.js, relicData.js 
    meta/           metaProgress.js, saveSystem.js
    ui/screens/     mainMenu, runStart, pyramidView, combatUI, shopUI, eventUI, metaScreen, gameOver
    ui/components/  healthBar, statPanel, tooltip
```

## Stats
HP, DEF, DMG, DEX, SPD, INT, LUCK. Three layers: base + permanent + runBonus. Final = sum of all three.

## Classes
Warrior, Barbarian, Cleric, Archer, Wizard, Paladin, Summoner. Discovered during runs. Multiple of same class allowed in party. Permanent upgrades affect all instances.

## Completed Milestones
- M1: Canvas + game loop
- M2: Clickable triangle pyramid navigation
- M3: Basic combat (Warrior vs enemy, turn loop, win/lose)
- M4: All 7 classes, mana, status effects, enemy AI, character select
- M5: All room types, lazy generation, correct room responses
- M6: Soul Shards, permanent upgrades, save system, meta screen
- M6.5: Items/loot, equipment slots, party system, hero recruitment
- M7: 15 layer lazy generation, 3 acts (unique bosses + modifiers to ennemies), victory screen after 3rd boss -> meta screen

## Current: Overall fixes, quality of usage, maybe new implementation 
- Making every relic attainable 
- adding relics to shops and treasure room 
- add starting with a relic as a meta progress 

