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
        uniforms: {},
        vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
        fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.5 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
            gl_FragColor = vec4(1.0, 0.8, 0.3, 0.6) * intensity;
        }
    `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
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
    marsMesh.position.set(globe_radius - marsRadius - 10000, 150, -900);
    globescene.add(marsMesh);

}