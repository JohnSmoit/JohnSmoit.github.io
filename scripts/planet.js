import * as ECS from './basic_ecs.js'
import * as CONFIGS from './configs.js'
import * as UTILS from './utils.js'
import * as THREE from 'three'

/* Constants */

// Mesh related
const sphereGeom = new THREE.SphereGeometry(1.0);
const testMat = new THREE.MeshPhongMaterial({color: 0x44aa88});

// Hacky fix for world not being avaiable
// TODO: Replace with static Entity Functionality
let scene = null;

/**
 * NOTES:
 * - Component names will hashed along with any lifecycle function names to produce a component
 *   type id.
 * 
 */
export function genPlanet(params) {
    return ECS.newEntity()
        .withComp({name: "sphereMesh", v: {radius: params.radius}})
        .withComp({name: "orbiter", v: {radius: params.orbitRadius, progress: params.orbitProgress, tilt: params.orbitTilt}})
        .withComp({name: "matSingleColor", v: {color: params.color}});
}

export class PlanetGenParams {
    constructor(radius, orbitRadius, orbitProgress, orbitTilt, color) {
        this.radius = radius;
        this.orbitRadius = orbitRadius;
        this.orbitProgress = orbitProgress;
        this.orbitTilt = orbitTilt;
        this.color = color;
    }

    static fromJSON(planetName) {
        const block = CONFIGS.tryGetConfigBlock("planets");

        for (let i = 0; i < block.length; i++) {
            const configArea = block[i];
            if (configArea.name == planetName) {
                const radius = UTILS.safeGet(configArea, "radius", 1.0, "unspecified radius");
                const orbit = UTILS.safeGet(configArea, "orbit", [0, 0, 0], "unspecified orbit");
                const color = UTILS.safeGet(configArea, "color", 0, "unspecified color");

                if (orbit.length != 3) {
                    console.warn("Improper orbit detail array (expects an array of length 3 composed of numeric values");
                    break;
                }

                return new PlanetGenParams(
                    radius,
                    orbit[0],
                    orbit[1],
                    orbit[2],
                    color //TODO: parse color as hex string
                )
            }
        }
        return new PlanetGenParams(0, 0, 0, 0, 0);
    }
}

// planet component definitions

function instantiateSphereMesh(id, desc) {
    //console.log(desc);
    UTILS.require(desc, "radius");

    const mesh = new THREE.Mesh(sphereGeom, testMat);
    mesh.scale.set(desc.radius * 0.1, desc.radius * 0.1, desc.radius * 0.1);
    //console.log("Instantiating sphere mesh");
    return mesh;
}

function instantiateOrbiter(id, desc) {
    UTILS.require(desc, "radius", "progress", "tilt");
    //console.log("Instantiating orbiter");
    return new Float32Array([desc.radius, desc.progress, desc.tilt]);
}

function instantateMatSingleColor(id, desc) {
    UTILS.require(desc, "color");
    //console.log("Instantiating single color phong material");
    const intColor = parseInt(desc.color, 16);
    return new THREE.MeshPhongMaterial({color: 0x44aa88});
}

// planet systems

function printOrbitRadiusSystem(id, sphereMesh, orbiter) {
    console.log(`entity id: ${id}, radius: ${sphereMesh.scale.x}, oRadius: ${orbiter[0]}, oProgress: ${orbiter[1]}, oTilt: ${orbiter[2]}`)
}

function initPlanets(id, sphereMesh, orbiter, mat) {
    const startVector = new THREE.Vector3();

    startVector.setX(orbiter[0] * 0.01 * Math.cos(UTILS.degreesToRadians(orbiter[1])));
    startVector.setZ(orbiter[0] * 0.01 * Math.sin(UTILS.degreesToRadians(orbiter[1])));

    console.log(startVector);

    sphereMesh.position.copy(startVector);
    //sphereMesh.material = mat;
    scene.add(sphereMesh);
}

function orbitPlanets(id, sphereMesh, orbiter) {
    sphereMesh.position.setX()
}

// Pre-initialization phase
ECS.makeCompInstantiator("sphereMesh", instantiateSphereMesh);
ECS.makeCompInstantiator("orbiter", instantiateOrbiter);
ECS.makeCompInstantiator("matSingleColor", instantateMatSingleColor);

export function init(world, sc) {
    scene = sc;
    world.addSystem()
        .withName("PrintOrbitRadius")
        .withQueryComps("sphereMesh", "orbiter")
        .withFunction(printOrbitRadiusSystem)
        .withCompBindings("sphereMesh", "orbiter")
        .subscribeToBus("PostInit")
    .create();

    world.addSystem()
        .withName("PlanetInit")
        .withQueryComps("sphereMesh", "orbiter", "matSingleColor")
        .withFunction(initPlanets)
        .withCompBindings("sphereMesh", "orbiter", "matSingleColor")
        .subscribeToBus("PostInit")
    .create();

    world.addSystem()
        .withName("PlanetOrbit")
        .withQueryComps("sphereMesh", "orbiter")
        .withFunction(orbitPlanets)
        .withCompBindings("sphereMesh", "orbiter")
        .subscribeToBus("OnUpdate")
    .create();
}