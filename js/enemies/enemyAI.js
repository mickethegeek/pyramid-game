// AI decision logic — determines what action an enemy takes on its turn

// Choose and return an action for the enemy
// Returns an action descriptor { type, target }
function getEnemyAction(enemy, target) {
    // 70% chance to attack, 30% chance to defend
    if (Math.random() < 0.7) {
        return { type: 'attack', target: target };
    } else {
        return { type: 'defend', target: enemy };
    }
}
