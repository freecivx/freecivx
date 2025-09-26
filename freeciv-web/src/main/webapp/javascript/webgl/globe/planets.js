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

    globescene.add(moonMesh);

    // --- Add a sun to the scene ---
    const sunRadius = 1200;
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
    globescene.add(sunMesh);




// Mercury
    const mercuryRadius = 50;
    const mercuryGeometry = new THREE.SphereGeometry(mercuryRadius, 32, 32);
    const mercuryMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    const mercuryMesh = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
    globescene.add(mercuryMesh);

// Venus
    const venusRadius = 120;
    const venusGeometry = new THREE.SphereGeometry(venusRadius, 32, 32);
    const venusMaterial = new THREE.MeshBasicMaterial({ color: 0xffddaa });
    const venusMesh = new THREE.Mesh(venusGeometry, venusMaterial);
    globescene.add(venusMesh);

    // Mars
    const marsRadius = 220;
    const marsGeometry = new THREE.SphereGeometry(marsRadius, 32, 32);
    const marsTexture = new THREE.TextureLoader().load('/textures/mars_texture.jpg');
    const marsMaterial = new THREE.MeshBasicMaterial({map: marsTexture});
    const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
    globescene.add(marsMesh);


// Jupiter
    const jupiterRadius = 500;
    const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 32, 32);
    const jupiterMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa88 });
    const jupiterMesh = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
    globescene.add(jupiterMesh);

// Saturn
    const saturnRadius = 400;
    const saturnGeometry = new THREE.SphereGeometry(saturnRadius, 32, 32);
    const saturnMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const saturnMesh = new THREE.Mesh(saturnGeometry, saturnMaterial);
    globescene.add(saturnMesh);

// Uranus
    const uranusRadius = 300;
    const uranusGeometry = new THREE.SphereGeometry(uranusRadius, 32, 32);
    const uranusMaterial = new THREE.MeshBasicMaterial({ color: 0x66bbff });
    const uranusMesh = new THREE.Mesh(uranusGeometry, uranusMaterial);
    globescene.add(uranusMesh);

// Neptune
    const neptuneRadius = 290;
    const neptuneGeometry = new THREE.SphereGeometry(neptuneRadius, 32, 32);
    const neptuneMaterial = new THREE.MeshBasicMaterial({ color: 0x3366ff });
    const neptuneMesh = new THREE.Mesh(neptuneGeometry, neptuneMaterial);

    globescene.add(neptuneMesh);

// Sun (positioned further left of Earth, larger and brighter)
    sunMesh.position.set(-25000, 2000, -6000);
    sunMesh.scale.set(2.5, 2.5, 2.5);

// Mercury (slightly smaller, closer)
    mercuryMesh.position.set(-9000, -150, 300);
    mercuryMesh.scale.set(0.5, 0.5, 0.5);

// Venus (slightly smaller, closer)
    venusMesh.position.set(-4500, 250, 600);
    venusMesh.scale.set(0.9, 0.9, 0.9);

// Moon (relative to Earth)
    moonMesh.position.set(earth_radius + moonRadius + 600, 50, 0);


// Mars (slightly smaller, closer)
    marsMesh.position.set(5500, 100, -850);
    marsMesh.scale.set(0.75, 0.75, 0.75);

// Jupiter (slightly larger, further)
    jupiterMesh.position.set(13000, -400, -3200);
    jupiterMesh.scale.set(1.2, 1.2, 1.2);

// Saturn (slightly smaller, further)
    saturnMesh.position.set(19000, 700, 3500);
    saturnMesh.scale.set(0.85, 0.85, 0.85);

// Uranus (smaller, further)
    uranusMesh.position.set(26000, 1000, -4500);
    uranusMesh.scale.set(0.65, 0.65, 0.65);

// Neptune (smaller, further)
    neptuneMesh.position.set(32000, -1300, 5500);
    neptuneMesh.scale.set(0.65, 0.65, 0.65);



}