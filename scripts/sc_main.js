import * as THREE from 'three';
import * as CONFIGS from './configs.js'
import * as PLANET from './planet.js';

import { makeWorld } from './basic_ecs.js'

const canvas = document.getElementById("main-canvas");
const renderer = new THREE.WebGLRenderer({antialias: true, canvas});

// camera constants
const fov = 75;
const aspect = 2;
const near = 0.1;
const far = 5;

// mesh data
const boxDim = 1;
const geometry = new THREE.BoxGeometry(boxDim, boxDim, boxDim);
const material = new THREE.MeshPhongMaterial({color: 0x44aa88});

const spRadius = 0.125;
const spOrbitRadius = 1.6;
const spOrbitSpeed = 0.35;
const spGeometry = new THREE.SphereGeometry(spRadius);
const spMaterial = new THREE.MeshPhongMaterial({color: 0xaa6644});

const cube = new THREE.Mesh(geometry, material);
const sphere = new THREE.Mesh(spGeometry, spMaterial);

// scene and camera
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
const scene = new THREE.Scene();

// lighting
const color = 0xFFFFFF;
const intensity = 3;
const light = new THREE.DirectionalLight(color, intensity);

// game ECS world
const world = makeWorld();

const onInitEventBus = world.createEventBus("PostInit");

function resizeRendererToDisplay(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const resize = canvas.width != width || canvas.height != height;

    if (resize) {
        renderer.setSize(width, height, false);
    }

    return resize;
}


function render(time) {
    time *= 0.001;

    cube.rotation.x = time * spOrbitSpeed;
    cube.rotation.y = time * spOrbitSpeed;

    sphere.position.x = spOrbitRadius * Math.cos(spOrbitSpeed * time);
    sphere.position.z = spOrbitRadius * Math.sin(spOrbitSpeed * time);

    // dynamic scaling/ basic responsive design
    if (resizeRendererToDisplay(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

async function main() {
    await CONFIGS.loadConfigs();
    PLANET.init();

    camera.position.z = 2;
    camera.position.y = 1;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    light.position.set(-1, 2, 4);

    scene.add(cube);
    scene.add(light);
    scene.add(sphere);

    // test planets
    // TODO: Possibly cut out the middle man and directly serialize components from JSON
    const planet1 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("fractal"));
    const planet2 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("game"));
    const planet3 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("other"));

    const testEntities = [];

    testEntities.push(planet1.buildAndAddTo(world));
    testEntities.push(planet2.buildAndAddTo(world));
    testEntities.push(planet3.buildAndAddTo(world));

    testEntities.forEach((entity) => {console.log(entity.id)});

    onInitEventBus.Dispatch(null);

    requestAnimationFrame(render);
}

main();