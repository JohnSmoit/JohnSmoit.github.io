import * as THREE from 'three';
import * as CONFIGS from './configs.js'
import * as PLANET from './planet.js';
import * as UTILS from './utils.js'
import { CanvasMouseInputHandler } from './mouse.js';

import * as ECS from './basic_ecs.js'

const canvas = document.getElementById("main-canvas");
const renderer = new THREE.WebGLRenderer({antialias: true, canvas});
const mouseInput = new CanvasMouseInputHandler();

const clock = new THREE.Clock(true);

// camera constants
const fov = 75;
const aspect = 2;
const near = 0.1;
const far = 250;

// mesh data
const boxDim = 0.3;
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
let camera = null;//new THREE.PerspectiveCamera(fov, aspect, near, far);
const scene = new THREE.Scene();

// lighting
const color = 0xFFFFFF;
const intensity = 3;
const light = new THREE.DirectionalLight(color, intensity);

// game ECS world
const world = ECS.makeWorld();

const onInitEventBus = world.createEventBus("PostInit");
const onUpdateEventBus = world.createEventBus("OnUpdate");

function resizeRendererToDisplay(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const resize = canvas.width != width || canvas.height != height;

    if (resize) {
        renderer.setSize(width, height, false);
        mouseInput.updateCanvasParams();
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

    //TODO: Fixed update loop needed
    onUpdateEventBus.dispatch({time: time, dt: clock.getDelta()});
    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

function rotateCamera(params, cam) {
    const camera = cam.camera;
    const radius = cam.radius;

    if (mouseInput.down) {
        cam.rotations.x += mouseInput.mouseX * cam.speed.x * params.dt;
        cam.rotations.y += mouseInput.mouseY * cam.speed.y * params.dt;
    }

    camera.position.x = radius * Math.cos(cam.rotations.x);
    camera.position.z = radius * Math.sin(cam.rotations.x);

    camera.lookAt(new THREE.Vector3(0, 0, 0));
}

ECS.makeCompInstantiator("cameraRotator", (id, desc) => {
    UTILS.require(desc, "radius");

    return {
        camera: new THREE.PerspectiveCamera(fov, aspect, near, far),
        radius: desc.radius,
        rotations: new THREE.Vector2(0, 0),
        speed: new THREE.Vector2(5, 2.5)
    };
});

function initMainEntities() {
    const cameraEntity = ECS.newEntity()
        .withComp({name: "cameraRotator", v:{radius: 75.0}})
    .buildAndAddTo(world);

    world.addSystem()
        .withName("CameraRotating")
        .withQueryComps("cameraRotator")
        .withCompBindings("cameraRotator")
        .subscribeToBus("OnUpdate")
        .withFunction(rotateCamera)
    .create();

    //NOTE: Temporary camera access
    camera = cameraEntity.getComp("cameraRotator").camera;
}

async function main() {
    await CONFIGS.loadConfigs();
    PLANET.init(world, scene);

    initMainEntities();

    camera.position.z = 75;
    camera.position.y = 5;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    light.position.set(-1, 2, 4);

    scene.add(light);
    scene.add(cube);

    // test planets
    // TODO: Possibly cut out the middle man and directly serialize components from JSON
    const planet1 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("fractal"));
    planet1.buildAndAddTo(world);
    // const planet2 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("game"));
    // const planet3 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("other"));
    // const planet4 = PLANET.genPlanet(PLANET.PlanetGenParams.fromJSON("other"));

    // const testEntities = [];

    // testEntities.push(planet1.buildAndAddTo(world));
    // testEntities.push(planet2.buildAndAddTo(world));
    // testEntities.push(planet3.buildAndAddTo(world));
    // testEntities.push(planet4.buildAndAddTo(world));

    // testEntities.forEach((entity) => {console.log(entity.id)});

    onInitEventBus.dispatch({scene: scene});

    requestAnimationFrame(render);
}

main();