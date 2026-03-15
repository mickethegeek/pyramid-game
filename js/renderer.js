// All canvas drawing functions

let ctx = null;
let canvas = null;

// Initialize renderer with canvas context
function initRenderer(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
}

// Clear the entire canvas
function clearCanvas() {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw the entire pyramid with type colours and adjacency highlighting.
// Two-pass approach: fills first, then highlighted borders on top.
// This prevents later triangles' fills from covering adjacent rooms' borders.
function drawPyramid(pyramid, currentRoom, adjacentRooms) {
    const allRooms = getAllRoomsFlat(pyramid);

    // Pass 1: draw every room's fill and a plain dark border
    for (const room of allRooms) {
        const color = isSameRoom(room, currentRoom) ? '#ffd700' : getRoomColor(room.type);
        drawRoom(room, color);

        // Dim visited rooms with a dark overlay so they read as spent/disabled
        if (room.visited && !isSameRoom(room, currentRoom)) {
            drawRoomOverlay(room, 'rgba(0, 0, 0, 0.6)');
        }
    }

    // Pass 2: redraw borders for adjacent rooms on top so they aren't obscured
    for (const room of adjacentRooms) {
        drawRoomBorder(room, '#ffffff', 2.5);
    }
}

// Draw the bright border for a single room without touching its fill
function drawRoomBorder(room, strokeColor, lineWidth) {
    const vertices = getRoomVertices(room);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = lineWidth;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();
    ctx.stroke();
}

// Draw a semi-transparent colour overlay on a room (used to dim visited rooms)
function drawRoomOverlay(room, overlayColor) {
    const vertices = getRoomVertices(room);
    ctx.fillStyle = overlayColor;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();
    ctx.fill();
}

// Draw a single room (triangle) with a fill and a plain dark border
function drawRoom(room, fillColor) {
    const vertices = getRoomVertices(room);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
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

// Check if two rooms are the same
function isSameRoom(room1, room2) {
    if (!room1 || !room2) return false;
    return room1.layer === room2.layer && room1.index === room2.index;
}

// Check if a room is in a list of rooms
function isRoomInList(room, roomList) {
    return roomList.some(r => isSameRoom(r, room));
}

// Draw a message overlay on the pyramid after an instant room event (Rest, Trap, etc.)
function drawRoomMessage(message) {
    const pw      = 560;
    const padX    = 20;
    const maxW    = pw - padX * 2;
    const lineH   = 22;

    // Word-wrap message into lines that fit inside the panel
    ctx.font = '15px monospace';
    const words = message.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && cur) {
            lines.push(cur);
            cur = word;
        } else {
            cur = test;
        }
    }
    if (cur) lines.push(cur);

    const ph = lines.length * lineH + 60;  // text block + padding + dismiss line
    const px = (1200 - pw) / 2;
    const py = Math.round((640 - ph) / 2);

    // Semi-transparent backing panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(px, py, pw, ph);

    // Gold border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // Wrapped message text
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    const textStartY = py + 28;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 600, textStartY + i * lineH);
    }

    // Dismiss prompt
    ctx.fillStyle = '#666';
    ctx.font = '13px monospace';
    ctx.fillText('Click anywhere to continue', 600, py + ph - 16);
}

// Draw a small act indicator in the top-left corner of the pyramid view
function drawActBadge(actNumber) {
    const labels = ['', 'ACT  I', 'ACT  II', 'ACT  III'];
    const colors  = ['', '#c2855b', '#a855f7', '#ef4444']; // terracotta / purple / red
    const label   = labels[actNumber] || '';
    const color   = colors[actNumber] || '#fff';

    const pw = 90, ph = 30, px = 8, py = 8;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(px, py, pw, ph);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = color;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, px + pw / 2, py + 20);
}

// GEAR button shown on the pyramid map — opens the equipment screen
const GEAR_BTN = { x: 8, y: 598, w: 70, h: 34 };

// Draw the GEAR button in the bottom-left corner of the pyramid view
function drawGearButton() {
    const b = GEAR_BTN;
    ctx.fillStyle = 'rgba(20, 16, 10, 0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = '#c2855b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = '#c2855b';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GEAR', b.x + b.w / 2, b.y + 22);
}

// Return true if the click landed on the GEAR button
function isGearButtonClick(x, y) {
    const b = GEAR_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

// Draw relics in a 2-column grid anchored to the bottom-right of the pyramid view.
// Box size scales down when many relics are active. Shows a tooltip on hover.
function drawRelicStrip() {
    const relics = state.activeRelics;
    if (!relics || relics.length === 0) return;

    const n = relics.length;

    // Scale box dimensions and column count based on relic count
    let boxW, boxH, fontSize, numCols;
    if (n <= 8) {
        boxW = 140; boxH = 22; fontSize = '11px'; numCols = 2;
    } else if (n <= 16) {
        boxW = 98;  boxH = 15; fontSize = '9px';  numCols = 2;
    } else {
        boxW = 70;  boxH = 11; fontSize = '8px';  numCols = 3;
    }

    const colGap  = 6;   // gap between columns
    const rowGap  = 4;   // gap between rows
    const padX    = 8;   // horizontal text padding inside a box
    const bottomY = 636; // bottom edge of the relic panel

    // Build column X positions anchored right at x=1192
    const colXs = [];
    for (let c = numCols - 1; c >= 0; c--) {
        colXs[c] = 1192 - (numCols - c) * boxW - (numCols - c - 1) * colGap;
    }

    const numRows = Math.ceil(n / numCols);
    const totalH  = numRows * boxH + (numRows - 1) * rowGap;
    const gridTop = bottomY - totalH;

    let hoveredRelic = null;

    for (let i = 0; i < n; i++) {
        const relic = relics[i];
        const col   = i % numCols;
        const row   = Math.floor(i / numCols);
        const bx    = colXs[col];
        const by    = gridTop + row * (boxH + rowGap);

        // Hover detection — record for tooltip drawn after all boxes
        const hovered = mouseX >= bx && mouseX <= bx + boxW
                     && mouseY >= by && mouseY <= by + boxH;
        if (hovered) hoveredRelic = relic;

        // Background fill
        ctx.fillStyle = relic.cursed ? 'rgba(100,10,10,0.85)' : 'rgba(10,50,20,0.85)';
        ctx.fillRect(bx, by, boxW, boxH);

        // Border — brighter when hovered
        ctx.strokeStyle = hovered
            ? (relic.cursed ? '#ff7675' : '#abebc6')
            : (relic.cursed ? '#c0392b' : '#2ecc71');
        ctx.lineWidth = hovered ? 1.5 : 1;
        ctx.strokeRect(bx, by, boxW, boxH);

        // Label — truncate with ellipsis if wider than the box
        ctx.font      = fontSize + ' monospace';
        ctx.fillStyle = relic.cursed ? '#ff7675' : '#abebc6';
        ctx.textAlign = 'center';
        let label = relic.name;
        while (ctx.measureText(label).width > boxW - padX * 2 && label.length > 3) {
            label = label.slice(0, -1);
        }
        if (label !== relic.name) label += '\u2026';
        ctx.fillText(label, bx + boxW / 2, by + boxH * 0.72);
    }

    // Tooltip drawn last so it renders on top of all boxes
    if (hoveredRelic) drawRelicTooltip(hoveredRelic);
}

// Draw a floating tooltip near the cursor describing a hovered relic
function drawRelicTooltip(relic) {
    const tipW  = 240;
    const padX  = 10;
    const padY  = 10;
    const lineH = 18;

    // Relic name: gold for positive, purple for cursed
    const nameColor = relic.cursed ? '#a855f7' : '#ffd700';

    // Pull description from RELIC_DATA if available
    const data = (typeof RELIC_DATA !== 'undefined' && relic.key) ? RELIC_DATA[relic.key] : null;
    const desc = data ? data.description : (relic.description || '');

    // Word-wrap both name and description using the shared evWrapText helper
    ctx.font = 'bold 13px monospace';
    const nameLines = evWrapText(relic.name, tipW - padX * 2);

    ctx.font = '12px monospace';
    const descLines = desc ? evWrapText(desc, tipW - padX * 2) : [];

    const tipH = padY * 2
               + nameLines.length * lineH
               + (descLines.length ? 6 + descLines.length * lineH : 0);

    // Keep tooltip inside the canvas; flip above cursor if near the bottom
    const tipX = Math.min(mouseX + 14, 1200 - tipW - 4);
    const tipY = mouseY + 24 + tipH > 640 ? mouseY - tipH - 8 : mouseY + 24;

    // Background box
    ctx.fillStyle   = '#1a1610';
    ctx.fillRect(tipX, tipY, tipW, tipH);
    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(tipX, tipY, tipW, tipH);

    // Name
    ctx.font      = 'bold 13px monospace';
    ctx.fillStyle = nameColor;
    ctx.textAlign = 'left';
    for (let i = 0; i < nameLines.length; i++) {
        ctx.fillText(nameLines[i], tipX + padX, tipY + padY + (i + 1) * lineH - 4);
    }

    // Description
    if (descLines.length) {
        ctx.font      = '12px monospace';
        ctx.fillStyle = '#aaa';
        const descY = tipY + padY + nameLines.length * lineH + 6;
        for (let i = 0; i < descLines.length; i++) {
            ctx.fillText(descLines[i], tipX + padX, descY + i * lineH + lineH - 4);
        }
    }
}

// Flatten pyramid structure into a single array of rooms
function getAllRoomsFlat(pyramid) {
    const rooms = [];
    for (let layer of pyramid) {
        for (let room of layer) {
            rooms.push(room);
        }
    }
    return rooms;
}
