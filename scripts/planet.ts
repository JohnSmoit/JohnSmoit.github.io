import * as ECS from './basic_ecs.ts'
import * as CONFIGS from './configs.ts'
import * as UTILS from './utils.ts'
import * as THREE from 'three'

/* Constants */

// Mesh related
const sphereGeom = new THREE.SphereGeometry(1.0);

// TODO: Replace with static Entity Functionality
// NOTE: Current status -- Using dispatch params for access to static data

/**
 * NOTES:
 * - Component names will hashed along with any lifecycle function names to produce a component
 *   type id.
 * 
 */
export function genPlanet(params: PlanetGenParams) {
    return ECS.newEntity()
        .withComp({name: "sphereMesh", v: {radius: params.radius}})
        .withComp({name: "orbiter", v: {radius: params.orbitRadius, progress: params.orbitProgress, tilt: params.orbitTilt}})
        .withComp({name: "matSingleColor", v: {color: params.color}});
}

export class PlanetGenParams {
    radius: number;
    orbitRadius: number;
    orbitProgress: number;
    orbitTilt: number;
    color: string;
    constructor(radius: number, orbitRadius: number, orbitProgress: number, orbitTilt: number, color: string) {
        this.radius = radius;
        this.orbitRadius = orbitRadius;
        this.orbitProgress = orbitProgress;
        this.orbitTilt = orbitTilt;
        this.color = color;
    }

    static fromJSON(planetName: string) {
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

    const mesh = new THREE.Mesh(sphereGeom);
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
    return new THREE.MeshPhongMaterial({color: intColor});
}

// planet systems

function printOrbitRadiusSystem(params, sphereMesh, orbiter) {
    console.log(`entity id: ${params.id}, radius: ${sphereMesh.scale.x}, oRadius: ${orbiter[0]}, oProgress: ${orbiter[1]}, oTilt: ${orbiter[2]}`)
}

function initPlanets(params, sphereMesh, orbiter, mat) {
    const startVector = new THREE.Vector3();

    startVector.setX(orbiter[0] * 0.01 * Math.cos(UTILS.degreesToRadians(orbiter[1])));
    startVector.setZ(orbiter[0] * 0.01 * Math.sin(UTILS.degreesToRadians(orbiter[1])));

    console.log(startVector);

    sphereMesh.position.copy(startVector);
    sphereMesh.material = mat;
    params.scene.add(sphereMesh);
}

function orbitPlanets(params, sphereMesh, orbiter) {
    sphereMesh.position.setX(orbiter[0] * 0.01 * Math.cos(orbiter[1] + params.time));
    sphereMesh.position.setZ(orbiter[0] * 0.01 * Math.sin(orbiter[1] + params.time));
}

// Pre-initialization phase
ECS.makeCompInstantiator("sphereMesh", instantiateSphereMesh);
ECS.makeCompInstantiator("orbiter", instantiateOrbiter);
ECS.makeCompInstantiator("matSingleColor", instantateMatSingleColor);

export function init(world) {
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