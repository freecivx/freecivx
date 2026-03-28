/**********************************************************************
    Freecivx.com - the web version of Freeciv. http://www.freecivx.com/
    Copyright (C) 2009-2024  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * Mapview Common - Square Map Geometry and Rendering
 * 
 * This module handles the creation and update of the terrain mesh with
 * square tile topology. Key features:
 * - Standard grid layout (no staggering)
 * - Proper UV coordinate mapping for square tile sampling
 * - Height-based terrain with interpolation between neighbors
 */

/****************************************************************************
  Initialize land geometry with square tile grid
  
  Creates a mesh with square tiling using standard grid coordinates.
  
  Grid properties:
  - Each tile has 8 neighbors (square topology with diagonals)
  - No row staggering
  - UV coordinates map directly to tile positions
  
  @param {THREE.BufferGeometry} geometry - Geometry to initialize
  @param {number} mesh_quality - Quality multiplier (1=standard, 2=low-res for raycasting)
****************************************************************************/
function init_land_geometry_square(geometry, mesh_quality)
{
  const xquality = map.xsize * mesh_quality + 1;
  const yquality = map.ysize * mesh_quality + 1;

  const width_half = mapview_model_width / 2;
  const height_half = mapview_model_height / 2;

  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  // Square tile dimensions - no height factor adjustment
  const segment_width = mapview_model_width / gridX;
  const segment_height = mapview_model_height / gridY;

  const indices = [];
  const uvs = [];
  const vertices = [];
  let heightmap_scale = (mesh_quality === 2) ? (mesh_quality * 2) : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;

  // Create vertices for square grid
  for ( let iy = 0; iy < gridY1; iy ++ ) {
    const y = iy * segment_height - height_half;
    
    for ( let ix = 0; ix < gridX1; ix ++ ) {
      const x = ix * segment_width - width_half;
      var sx = ix % xquality, sy = iy % yquality;

      // Calculate 1D index for heightmap array
      const heightmap_index = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightmap_index] !== undefined ? heightmap[heightmap_index] * 100 : 0;
      
      vertices.push( x, -y, height_value );
      
      // UV coordinates for square sampling - direct mapping
      uvs.push( ix / gridX );
      uvs.push( 1 - ( iy / gridY ) );
    }
  }

  // Create triangles connecting the square grid
  for ( let iy = 0; iy < gridY; iy ++ ) {
    for ( let ix = 0; ix < gridX; ix ++ ) {
      const a = ix + gridX1 * iy;
      const b = ix + gridX1 * ( iy + 1 );
      const c = ( ix + 1 ) + gridX1 * ( iy + 1 );
      const d = ( ix + 1 ) + gridX1 * iy;

      indices.push( a, b, d );
      indices.push( b, c, d );
    }
  }

  if (mesh_quality === 2) {
    lofibufferattribute = new THREE.Float32BufferAttribute( vertices, 3 );
    geometry.setAttribute( 'position', lofibufferattribute);
  } else {
    landbufferattribute = new THREE.Float32BufferAttribute( vertices, 3 );
    geometry.setAttribute( 'position', landbufferattribute);
  }

  geometry.setIndex( indices );
  geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Update the land terrain geometry with square tiling
  
  Updates vertex positions based on current heightmap values while maintaining
  square grid layout.
  
  @param {THREE.BufferGeometry} geometry - Geometry to update
  @param {number} mesh_quality - Quality multiplier matching init_land_geometry_square
****************************************************************************/
function update_land_geometry_square(geometry, mesh_quality) {
  const xquality = map.xsize * mesh_quality + 1;
  const yquality = map.ysize * mesh_quality + 1;

  const gridX = Math.floor(xquality);
  const gridY = Math.floor(yquality);

  // Square tile dimensions
  const segment_width = mapview_model_width / gridX;
  const segment_height = mapview_model_height / gridY;

  const width_half = mapview_model_width / 2;
  const height_half = mapview_model_height / 2;

  const heightmap_scale = (mesh_quality === 2) ? 2 : 1;
  const heightmap_resolution_x = map.xsize * mesh_quality + 1;
  const bufferAttribute = mesh_quality === 2 ? lofibufferattribute : landbufferattribute;

  for (let iy = 0; iy <= gridY; iy++) {
    const y = iy * segment_height - height_half;
    
    for (let ix = 0; ix <= gridX; ix++) {
      const x = ix * segment_width - width_half;
      const sx = ix % xquality, sy = iy % yquality;
      const index = iy * (gridX + 1) + ix;
      // Calculate 1D index for heightmap array
      const heightIndex = (sy * heightmap_scale) * heightmap_resolution_x + (sx * heightmap_scale);
      const height_value = heightmap && heightmap[heightIndex] !== undefined ? heightmap[heightIndex] * 100 : 0;

      bufferAttribute.setXYZ(index, x, -y, height_value);
    }
  }

  bufferAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

/****************************************************************************
  Get tile center offsets for square tiles (no offset needed)
****************************************************************************/
function getSquareCenterOffsets() {
  return { x: 0, y: 0 };
}

/****************************************************************************
  Update square center offsets (no-op for square tiles)
****************************************************************************/
function updateSquareCenterOffsets() {
  // Square tiles don't need center offsets
}
