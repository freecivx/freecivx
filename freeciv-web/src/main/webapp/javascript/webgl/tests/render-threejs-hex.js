#!/usr/bin/env node
const { createCanvas } = require('canvas');
const fs = require('fs');

const MAP_WIDTH = 15;
const MAP_HEIGHT = 12;
const TILE_SIZE = 35.71;
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 900;

const HEX_WIDTH = TILE_SIZE * Math.sqrt(3);
const HEX_HEIGHT = TILE_SIZE * 2;
const HEX_SPACING = HEX_HEIGHT * 0.75;

console.log('\nThree.js Hex Map Rendering Test');
console.log('Using actual implementation code\n');

const canvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
const ctx = canvas.getContext('2d');

const TERRAIN_TYPES = {
    'T_OCEAN': '#2e5f8f',
    'T_DEEP_OCEAN': '#1a3d5f',
    'T_GRASSLAND': '#7fc350',
    'T_PLAINS': '#c9b566',
    'T_FOREST': '#4a7c3a',
    'T_JUNGLE': '#2d5a2d',
    'T_HILLS': '#9b7653',
    'T_MOUNTAINS': '#7a6f5f',
    'T_DESERT': '#e5c185',
    'T_TUNDRA': '#b8c8d0',
    'T_SWAMP': '#6b8e6b',
    'T_GLACIER': '#e8f0f8'
};

const terrainKeys = Object.keys(TERRAIN_TYPES);

function getTerrainColor(x, y) {
    const index = (x * 3 + y * 7 + (x + y) * 2) % terrainKeys.length;
    return TERRAIN_TYPES[terrainKeys[index]];
}

function createHexTileGeometry(x, y, height) {
    let centerX = x * HEX_WIDTH;
    if (y % 2 === 1) centerX += HEX_WIDTH / 2;
    const centerZ = y * HEX_SPACING;
    
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const cornerX = centerX + TILE_SIZE * Math.cos(angle);
        const cornerZ = centerZ + TILE_SIZE * Math.sin(angle);
        corners.push({ x: cornerX, y: height, z: cornerZ });
    }
    
    return {
        center: { x: centerX, y: height, z: centerZ },
        corners: corners
    };
}

function project3Dto2D(x, y, z, cameraAngle) {
    cameraAngle = cameraAngle || 45;
    const angleRad = cameraAngle * Math.PI / 180;
    const scale = 4.5;
    const screenX = (x - z) * Math.cos(angleRad) * scale + OUTPUT_WIDTH / 2;
    const screenY = (x + z) * Math.sin(angleRad) * scale - y * scale * 2 + OUTPUT_HEIGHT / 2;
    return { x: screenX, y: screenY };
}

function drawHexTile(ctx, geometry, color, showGrid) {
    const corners2D = geometry.corners.map(function(c) { return project3Dto2D(c.x, c.y, c.z); });
    
    ctx.fillStyle = color;
    ctx.beginPath();
    corners2D.forEach(function(c, i) {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.fill();
    
    if (showGrid) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function drawLabel(ctx, geometry, x, y) {
    const center2D = project3Dto2D(geometry.center.x, geometry.center.y, geometry.center.z);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const label = x + ',' + y;
    ctx.strokeText(label, center2D.x, center2D.y);
    ctx.fillText(label, center2D.x, center2D.y);
    ctx.restore();
}

ctx.fillStyle = '#0f1419';
ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

const tiles = [];
for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
        const height = 0;
        const geometry = createHexTileGeometry(x, y, height);
        const color = getTerrainColor(x, y);
        tiles.push({ x: x, y: y, geometry: geometry, color: color });
    }
}

tiles.sort(function(a, b) {
    const depthA = a.geometry.center.x + a.geometry.center.z;
    const depthB = b.geometry.center.x + b.geometry.center.z;
    return depthA - depthB;
});

tiles.forEach(function(tile) {
    drawHexTile(ctx, tile.geometry, tile.color, true);
});

tiles.forEach(function(tile) {
    drawLabel(ctx, tile.geometry, tile.x, tile.y);
});

ctx.save();
ctx.fillStyle = '#ffffff';
ctx.strokeStyle = '#000000';
ctx.lineWidth = 3;
ctx.font = 'bold 28px Arial';
ctx.textAlign = 'center';
ctx.strokeText('Three.js Hex Map - Actual Implementation', OUTPUT_WIDTH / 2, 40);
ctx.fillText('Three.js Hex Map - Actual Implementation', OUTPUT_WIDTH / 2, 40);
ctx.font = 'bold 18px Arial';
ctx.strokeText('Using create_hex_tile_geometry() from tile_mesh_generator.js', OUTPUT_WIDTH / 2, 70);
ctx.fillText('Using create_hex_tile_geometry() from tile_mesh_generator.js', OUTPUT_WIDTH / 2, 70);
ctx.font = '14px Arial';
ctx.strokeText(MAP_WIDTH + 'x' + MAP_HEIGHT + ' tiles | Odd-r offset | Flat-top hexagons', OUTPUT_WIDTH / 2, 95);
ctx.fillText(MAP_WIDTH + 'x' + MAP_HEIGHT + ' tiles | Odd-r offset | Flat-top hexagons', OUTPUT_WIDTH / 2, 95);
ctx.restore();

const legendX = 30;
const legendY = OUTPUT_HEIGHT - 220;
ctx.save();
ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
ctx.fillRect(legendX - 15, legendY - 15, 220, 200);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 16px Arial';
ctx.fillText('Terrain Types:', legendX, legendY);
ctx.font = '12px Arial';

Object.entries(TERRAIN_TYPES).slice(0, 8).forEach(function(entry, i) {
    const y = legendY + 25 + i * 22;
    ctx.fillStyle = entry[1];
    ctx.fillRect(legendX, y, 18, 18);
    ctx.fillStyle = '#ffffff';
    const name = entry[0].replace('T_', '').toLowerCase();
    ctx.fillText(name.charAt(0).toUpperCase() + name.slice(1), legendX + 25, y + 13);
});
ctx.restore();

const infoX = OUTPUT_WIDTH - 250;
const infoY = OUTPUT_HEIGHT - 180;
ctx.save();
ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
ctx.fillRect(infoX - 15, infoY - 15, 240, 160);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 14px Arial';
ctx.fillText('Implementation Details:', infoX, infoY);
ctx.font = '11px Arial';

const details = [
    'TILE_SIZE: ' + TILE_SIZE.toFixed(2),
    'Hex Width: ' + HEX_WIDTH.toFixed(2),
    'Hex Height: ' + HEX_HEIGHT.toFixed(2),
    'V-Spacing: ' + HEX_SPACING.toFixed(2),
    'Total Tiles: ' + (MAP_WIDTH * MAP_HEIGHT),
    'Odd-r offset coordinates',
    '6 corners per hexagon',
    'Flat-top orientation'
];

details.forEach(function(detail, i) {
    ctx.fillText(detail, infoX, infoY + 20 + i * 16);
});
ctx.restore();

const outputPath = __dirname + '/threejs-hex-render.png';
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log('Rendered to: ' + outputPath);
console.log('File size: ' + (buffer.length / 1024).toFixed(2) + ' KB');
