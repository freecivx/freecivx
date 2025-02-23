/**********************************************************************
 FreecivX - the web version of Freeciv. http://www.FreecivX.net/
 Copyright (C) 2009-2025  The Freecivx project

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



/****************************************************************************
 Add planets and sun
****************************************************************************/
function add_planets() {
    // --- Add a moon to the scene ---
    const moonRadius = 65;
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
    const moonTexture = new THREE.TextureLoader().load('/textures/moon_texture.jpg');
    const moonMaterial = new THREE.MeshBasicMaterial({
        map: moonTexture
    });
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

    // Position the moon relative to the globe
    // Here it’s placed to the right of the globe with a slight upward offset.
    moonMesh.position.set(globe_radius + moonRadius + 1750, 300, 0);
    globescene.add(moonMesh);

    // --- Add a sun to the scene ---
    const sunRadius = 300; // Increase size for visibility
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
    const sunMaterial = new THREE.ShaderMaterial({
        uniforms: {
            lightColor: {value: new THREE.Color(1.0, 0.8, 0.3)} // Bright sun color
        },
        vertexShader: `
        varying vec3 vPosition;
        void main() {
            vPosition = position; // Store vertex position
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
        fragmentShader: `
        varying vec3 vPosition;
        uniform vec3 lightColor;

        void main() {
            float distanceFromCenter = length(vPosition) / 300.0; // Normalize using sun radius
            float intensity = exp(-distanceFromCenter * distanceFromCenter * 2.0); // Glowing effect
            intensity = clamp(intensity, 0.5, 1.0); // Ensure a bright core

            gl_FragColor = vec4(lightColor * intensity * 5.0, 1.0); // Increase brightness
        }
    `,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide, // Ensure we render the front
        transparent: false
    });


    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.position.set(-globe_radius - sunRadius - 17000, 1500, -globe_radius);
    globescene.add(sunMesh);


    // Mars
    const marsRadius = 220;
    const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
    const marsTexture = new THREE.TextureLoader().load('/textures/mars_texture.jpg');
    const marsMaterial = new THREE.MeshBasicMaterial({map: marsTexture});
    const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
    // Position Mars relative to the globe; adjust offsets as needed.
    marsMesh.position.set(globe_radius - marsRadius - 7000, 150, -400);
    globescene.add(marsMesh);

}