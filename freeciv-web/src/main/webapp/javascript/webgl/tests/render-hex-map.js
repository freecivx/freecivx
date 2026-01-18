#!/usr/bin/env node
const { createCanvas } = require('canvas');
const fs = require('fs');

const MAP_WIDTH = 12;
const MAP_HEIGHT = 10;
const TILE_SIZE = 40;
const HEX_WIDTH = TILE_SIZE * Math.sqrt(3);
const HEX_HEIGHT = TILE_SIZE * 2;
const HEX_SPACING = HEX_HEIGHT * 0.75;

const canvasWidth = MAP_WIDTH * HEX_WIDTH + HEX_WIDTH;
const canvasHeight = MAP_HEIGHT * HEX_SPACING + HEX_SPACING;
const canvas = createCanvas(canvasWidth, canvasHeight);
const ctx = canvas.getContext('2d');

const TERRAIN_COLORS = {
    'ocean': '#1e90ff',
    'grassland': '#7cfc00',
    'plains': '#9acd32',
    'forest': '#228b22',
    'hills': '#8b7355',
    'mountains': '#696969',
    'desert': '#f4a460',
    'tundra': '#dcdcdc'
};

const terrains = Object.keys(TERRAIN_COLORS);

function getTerrainColor(x, y) {
    const terrainIndex = (x + y * 2) % terrains.length;
    return TERRAIN_COLORS[terrains[terrainIndex]];
}

function drawHexagon(ctx, centerX, centerY, size, color, showGrid) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = centerX + size * Math.cos(angle);
        const y = centerY + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (showGrid) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();
}

function drawCoordinates(ctx, centerX, centerY, x, y) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(x + ',' + y, centerX, centerY);
    ctx.restore();
}

function getHexCenter(x, y) {
    let centerX = x * HEX_WIDTH;
    if (y % 2 === 1) centerX += HEX_WIDTH / 2;
    const centerY = y * HEX_SPACING;
    return { x: centerX + HEX_WIDTH / 2, y: centerY + HEX_SPACING / 2 };
}

ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, canvasWidth, canvasHeight);

console.log('Rendering hex map...');

for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
        const center = getHexCenter(x, y);
        const color = getTerrainColor(x, y);
        drawHexagon(ctx, center.x, center.y, TILE_SIZE, color, true);
        drawCoordinates(ctx, center.x, center.y, x, y);
    }
}

ctx.save();
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 24px Arial';
ctx.textAlign = 'center';
ctx.fillText('Hexagonal Map Tiles - Odd-R Offset Coordinates', canvasWidth / 2, 30);
ctx.font = '14px Arial';
ctx.fillText(MAP_WIDTH + 'x' + MAP_HEIGHT + ' Flat-Top Hexagons', canvasWidth / 2, 55);
ctx.restore();

const legendX = 20;
const legendY = canvasHeight - 120;
ctx.save();
ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
ctx.fillRect(legendX - 10, legendY - 10, 180, 110);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 14px Arial';
ctx.fillText('Legend:', legendX, legendY);
ctx.font = '12px Arial';

let offsetY = 0;
Object.entries(TERRAIN_COLORS).slice(0, 4).forEach(function(entry, i) {
    offsetY = 20 + i * 20;
    ctx.fillStyle = entry[1];
    ctx.fillRect(legendX, legendY + offsetY, 15, 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(entry[0].charAt(0).toUpperCase() + entry[0].slice(1), legendX + 20, legendY + offsetY + 12);
});

ctx.restore();

const outputPath = __dirname + '/hex-map-render.png';
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('Hex map rendered to: ' + outputPath);
console.log('Image size: ' + (buffer.length / 1024).toFixed(2) + ' KB');
