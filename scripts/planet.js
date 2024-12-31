import * as ECS from './basic_ecs.js'
import * as CONFIGS from './configs.js'
import * as UTILS from './utils.js'
import * as THREE from 'three'

/* Constants */

// Mesh related
const sphereGeom = new THREE.SphereGeometry(1.0, 24, 24);

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

    const mesh = new THREE.Mesh(sphereGeom);
    mesh.scale.set(desc.radius, desc.radius, desc.radius);
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

function printOrbitRadiusSystem(id, sphereMesh, orbiter) {
    console.log(`entity id: ${id}, radius: ${sphereMesh.scale.x}, oRadius: ${orbiter[0]}, oProgress: ${orbiter[1]}, oTilt: ${orbiter[2]}`)
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
        .subscribeToBus("PostInit")
    .create();
}