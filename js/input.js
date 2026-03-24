// Mouse and keyboard input handler

let inputCanvas = null;
let clickCallback = null;

// Current mouse position — updated on every mousemove, read by UI screens for hover effects
let mouseX = 0;
let mouseY = 0;

// Initialize input handling
function initInput(canvasElement, onClickCallback) {
    inputCanvas = canvasElement;
    clickCallback = onClickCallback;

    inputCanvas.addEventListener('click', handleClick);
    inputCanvas.addEventListener('mousemove', handleMouseMove);
    inputCanvas.addEventListener('wheel', handleWheel, { passive: false });
}

// Handle canvas click events
function handleClick(event) {
    const rect = inputCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (clickCallback) {
        clickCallback(x, y);
    }
}

// Scroll the equipment inventory or combat log when the wheel is used over the canvas
function handleWheel(event) {
    if (state.currentScene === 'equipment') {
        event.preventDefault();
        handleEquipmentScroll(event.deltaY > 0 ? 1 : -1);
    } else if (state.currentScene === 'combat') {
        event.preventDefault();
        handleCombatLogScroll(event.deltaY);
    }
}

// Track mouse position so UI screens can implement hover effects
function handleMouseMove(event) {
    const rect = inputCanvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
}

// Check if a point (x, y) is inside a triangle room
function isPointInRoom(x, y, room) {
    const vertices = getRoomVertices(room);
    return isPointInTriangle(x, y, vertices[0], vertices[1], vertices[2]);
}

// Get the three vertices of a triangle room
function getRoomVertices(room) {
    const size = room.size;
    const height = size * Math.sqrt(3) / 2;

    if (room.orientation === 'up') {
        // Upward triangle: top point at center, base at bottom
        return [
            { x: room.x, y: room.y },                    // Top vertex
            { x: room.x - size / 2, y: room.y + height }, // Bottom left
            { x: room.x + size / 2, y: room.y + height }  // Bottom right
        ];
    } else {
        // Downward triangle: base at top, bottom point at center
        return [
            { x: room.x - size / 2, y: room.y },          // Top left
            { x: room.x + size / 2, y: room.y },          // Top right
            { x: room.x, y: room.y + height }             // Bottom vertex
        ];
    }
}

// Check if point P is inside triangle ABC using barycentric coordinates
function isPointInTriangle(px, py, a, b, c) {
    const v0x = c.x - a.x;
    const v0y = c.y - a.y;
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = px - a.x;
    const v2y = py - a.y;

    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0) && (v >= 0) && (u + v <= 1);
}

// Find which room was clicked from a list of rooms
function findClickedRoom(x, y, rooms) {
    for (let room of rooms) {
        if (isPointInRoom(x, y, room)) {
            return room;
        }
    }
    return null;
}
