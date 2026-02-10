/**
 * WaterMesh - Three.js WebGPU Water Effect
 * 
 * Based on Three.js r176 WaterMesh example (examples/jsm/objects/WaterMesh.js)
 * Adapted for Freeciv-web WebGPU renderer with visibility and land awareness.
 * 
 * A basic flat, reflective water effect using TSL (Three.js Shading Language).
 * This class can only be used with WebGPURenderer.
 *
 * Features:
 * - Real-time planar reflections
 * - Normal map-based surface distortion for wave effects
 * - Visibility-aware rendering (black for unknown tiles)
 * - Land-aware rendering (black under land areas)
 * - Fresnel-based reflectance
 * - Sun specular highlights
 *
 * References:
 * - Flat mirror for three.js: https://github.com/Slayvin
 * - Water shader implementation: https://home.adelphi.edu/~stemkoski/
 * - Water shader explanations in WebGL: http://29a.ch/slides/2012/webglwater/
 *
 * License: MIT (Three.js license)
 */

import {
	Color,
	Mesh,
	Vector3,
	MeshLambertNodeMaterial
} from 'three/webgpu';

import {
	Fn, add, cameraPosition, div, normalize, positionWorld, sub, time, 
	texture, vec2, vec3, max, dot, reflect, pow, length, float, uniform,
	reflector, mul, mix, diffuseColor, uv, floor, step, clamp, min
} from 'three/tsl';

/**
 * WaterMesh - A mesh with realistic water shader for WebGPU
 * @extends Mesh
 */
class WaterMesh extends Mesh {

	/**
	 * Constructs a new water mesh.
	 *
	 * @param {BufferGeometry} geometry - The water mesh's geometry.
	 * @param {Object} [options] - The configuration options.
	 * @param {number} [options.resolution=0.5] - The resolution scale for reflections.
	 * @param {Texture} [options.waterNormals] - The water's normal map.
	 * @param {number} [options.alpha=1] - The alpha value.
	 * @param {number} [options.size=1] - The size value for normal map scaling.
	 * @param {number|Color|string} [options.sunColor=0xffffff] - The sun color.
	 * @param {Vector3} [options.sunDirection=(0.70707,0.70707,0.0)] - The sun direction.
	 * @param {number|Color|string} [options.waterColor=0x7f7f7f] - The water color.
	 * @param {number} [options.distortionScale=20] - The distortion scale.
	 * @param {DataTexture} [options.maptilesTex] - The maptiles texture for visibility/land data.
	 * @param {number} [options.mapXSize] - Map width in tiles.
	 * @param {number} [options.mapYSize] - Map height in tiles.
	 */
	constructor( geometry, options = {} ) {

		const material = new MeshLambertNodeMaterial();

		super( geometry, material );

		/**
		 * This flag can be used for type testing.
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isWaterMesh = true;

		/**
		 * The effect's resolution scale.
		 * @type {number}
		 * @default 0.5
		 */
		this.resolution = options.resolution !== undefined ? options.resolution : 0.5;

		// Uniforms

		/**
		 * The water's normal map.
		 * @type {TextureNode}
		 */
		this.waterNormals = texture( options.waterNormals );

		/**
		 * The alpha value.
		 * @type {UniformNode<float>}
		 * @default 1
		 */
		this.alpha = uniform( options.alpha !== undefined ? options.alpha : 1.0 );

		/**
		 * The size value.
		 * @type {UniformNode<float>}
		 * @default 1
		 */
		this.size = uniform( options.size !== undefined ? options.size : 1.0 );

		/**
		 * The sun color.
		 * @type {UniformNode<color>}
		 * @default 0xffffff
		 */
		this.sunColor = uniform( new Color( options.sunColor !== undefined ? options.sunColor : 0xffffff ) );

		/**
		 * The sun direction.
		 * @type {UniformNode<vec3>}
		 * @default (0.70707,0.70707,0.0)
		 */
		this.sunDirection = uniform( options.sunDirection !== undefined ? options.sunDirection : new Vector3( 0.70707, 0.70707, 0.0 ) );

		/**
		 * The water color.
		 * @type {UniformNode<color>}
		 * @default 0x7f7f7f
		 */
		this.waterColor = uniform( new Color( options.waterColor !== undefined ? options.waterColor : 0x7f7f7f ) );

		/**
		 * The distortion scale.
		 * @type {UniformNode<float>}
		 * @default 20
		 */
		this.distortionScale = uniform( options.distortionScale !== undefined ? options.distortionScale : 20.0 );

		// Map tile data for visibility and land awareness
		const hasMaptiles = options.maptilesTex !== undefined;
		const maptilesTex = hasMaptiles ? texture( options.maptilesTex ) : null;
		const mapXSize = uniform( options.mapXSize !== undefined ? options.mapXSize : 1 );
		const mapYSize = uniform( options.mapYSize !== undefined ? options.mapYSize : 1 );

		// TSL Shader Implementation

		const getNoise = Fn( ( [ uvCoord ] ) => {

			const offset = time;

			const uv0 = add( div( uvCoord, 103 ), vec2( div( offset, 17 ), div( offset, 29 ) ) ).toVar();
			const uv1 = div( uvCoord, 107 ).sub( vec2( div( offset, - 19 ), div( offset, 31 ) ) ).toVar();
			const uv2 = add( div( uvCoord, vec2( 8907.0, 9803.0 ) ), vec2( div( offset, 101 ), div( offset, 97 ) ) ).toVar();
			const uv3 = sub( div( uvCoord, vec2( 1091.0, 1027.0 ) ), vec2( div( offset, 109 ), div( offset, - 113 ) ) ).toVar();

			const sample0 = this.waterNormals.sample( uv0 );
			const sample1 = this.waterNormals.sample( uv1 );
			const sample2 = this.waterNormals.sample( uv2 );
			const sample3 = this.waterNormals.sample( uv3 );

			const noise = sample0.add( sample1 ).add( sample2 ).add( sample3 );

			return noise.mul( 0.5 ).sub( 1 );

		} );

		const noise = getNoise( positionWorld.xz.mul( this.size ) );
		const surfaceNormal = normalize( noise.xzy.mul( 1.5, 1.0, 1.5 ) );

		const worldToEye = cameraPosition.sub( positionWorld );
		const eyeDirection = normalize( worldToEye );

		const reflection = normalize( reflect( this.sunDirection.negate(), surfaceNormal ) );
		const direction = max( 0.0, dot( eyeDirection, reflection ) );
		const specularLight = pow( direction, 100 ).mul( this.sunColor ).mul( 2.0 );
		const diffuseLight = max( dot( this.sunDirection, surfaceNormal ), 0.0 ).mul( this.sunColor ).mul( 0.5 );

		const distance = length( worldToEye );

		const distortion = surfaceNormal.xz.mul( float( 0.001 ).add( float( 1.0 ).div( distance ) ) ).mul( this.distortionScale );

		// Material configuration

		material.transparent = true;

		material.receivedShadowPositionNode = positionWorld.add( distortion );

		material.setupOutgoingLight = () => diffuseColor.rgb; // backwards compatibility

		material.colorNode = Fn( () => {

			const mirrorSampler = reflector();
			mirrorSampler.uvNode = mirrorSampler.uvNode.add( distortion );
			mirrorSampler.resolution = this.resolution;

			this.add( mirrorSampler.target );

			const theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
			const rf0 = float( 0.3 );
			const reflectance = mul( pow( float( 1.0 ).sub( theta ), 5.0 ), float( 1.0 ).sub( rf0 ) ).add( rf0 );
			const scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ).mul( this.waterColor );
			const albedo = mix( this.sunColor.mul( diffuseLight ).mul( 0.3 ).add( scatter ), mirrorSampler.rgb.mul( specularLight ).add( mirrorSampler.rgb.mul( 0.9 ) ).add( vec3( 0.1 ) ), reflectance );

			// If maptiles texture is available, apply visibility and land masking
			if ( hasMaptiles ) {
				// Get UV coordinates for sampling maptiles texture
				const uvNode = uv();
				
				// Calculate tile center UV for texture sampling
				// Account for hex stagger offset (odd-r coordinate system)
				const tileYRaw = mul( mapYSize, uvNode.y );
				const tileY = floor( tileYRaw );
				const isOddRow = sub( sub( mapYSize, 1.0 ), tileY );
				const hexOffset = mul( step( 0.5, sub( isOddRow, mul( floor( div( isOddRow, 2.0 ) ), 2.0 ) ) ), div( 0.5, mapXSize ) );
				const hexUvX = sub( uvNode.x, hexOffset );
				const tileCenterU = div( add( floor( mul( mapXSize, hexUvX ) ), 0.5 ), mapXSize );
				const tileCenterV = div( add( tileY, 0.5 ), mapYSize );
				const tileCenterUStaggered = add( tileCenterU, hexOffset );
				const tileCenterUV = vec2( tileCenterUStaggered, tileCenterV );
				
				// Sample tile data
				// Red channel: terrain type (multiplied by 10 in game data)
				// Alpha channel: visibility (0=unknown, ~0.54=fogged, 1.0=visible)
				const tileData = maptilesTex.sample( tileCenterUV );
				const visibility = tileData.a;
				const terrainType = floor( mul( tileData.r, 256.0 ) );
				
				// Land detection: terrain types >= 40 are land-based
				// Water types: INACCESSIBLE(0), LAKE(10), COAST(20), OCEAN/FLOOR(30)
				// Land types: ARCTIC(40), DESERT(50), FOREST(60), GRASSLAND(70), etc.
				const isLand = step( 39.5, terrainType );
				
				// Visibility factor: unknown tiles (0) show black, visible tiles show water
				// The 1.5 multiplier amplifies fogged tiles for better visibility
				const visibilityFactor = clamp( mul( visibility, 1.5 ), 0.0, 1.0 );
				
				// Combine visibility and land masking
				// If land OR unknown, show black; otherwise show water
				const showWater = mul( visibilityFactor, sub( 1.0, isLand ) );
				
				// Black color for unknown/land areas
				const blackColor = vec3( 0.0, 0.0, 0.0 );
				
				return mix( blackColor, albedo, showWater );
			}

			return albedo;

		} )();

		// Opacity: if maptiles available, use dynamic opacity; otherwise use base alpha
		if ( hasMaptiles ) {
			material.opacityNode = Fn( () => {
				const uvNode = uv();
				
				// Calculate tile center UV (same as color calculation)
				const tileYRaw = mul( mapYSize, uvNode.y );
				const tileY = floor( tileYRaw );
				const isOddRow = sub( sub( mapYSize, 1.0 ), tileY );
				const hexOffset = mul( step( 0.5, sub( isOddRow, mul( floor( div( isOddRow, 2.0 ) ), 2.0 ) ) ), div( 0.5, mapXSize ) );
				const hexUvX = sub( uvNode.x, hexOffset );
				const tileCenterU = div( add( floor( mul( mapXSize, hexUvX ) ), 0.5 ), mapXSize );
				const tileCenterV = div( add( tileY, 0.5 ), mapYSize );
				const tileCenterUStaggered = add( tileCenterU, hexOffset );
				const tileCenterUV = vec2( tileCenterUStaggered, tileCenterV );
				
				const tileData = maptilesTex.sample( tileCenterUV );
				const visibility = tileData.a;
				const terrainType = floor( mul( tileData.r, 256.0 ) );
				const isLand = step( 39.5, terrainType );
				
				// Unknown or land tiles are fully opaque (solid black)
				// Visible water tiles use the configured alpha
				const isUnknown = step( visibility, 0.01 );
				const shouldBeOpaque = max( isUnknown, isLand );
				
				return mix( this.alpha, float( 1.0 ), shouldBeOpaque );
			} )();
		} else {
			material.opacityNode = this.alpha;
		}

	}

}

export { WaterMesh };
