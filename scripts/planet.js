import * as ECS from './basic_ecs.js'
import * as CONFIGS from './configs.js'
import * as UTILS from './utils.js'
import * as THREE from 'three'

/* Constants */

// Mesh related
const sphereGeom = new THREE.SphereGeometry(1.0, 32, 32);

// File loading related
const fileLoader = new THREE.FileLoader();

// TODO: Replace with static Entity Functionality
// NOTE: Current status -- Using dispatch params for access to static data

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

function instantiatePlanetGenerator(id, desc) {
    UTILS.require(desc, "genProfile");

    return getGenProfile(desc.genProfile);
}

// planet systems

function printOrbitRadiusSystem(params, sphereMesh, orbiter) {
    console.log(`entity id: ${params.id}, radius: ${sphereMesh.scale.x}, oRadius: ${orbiter[0]}, oProgress: ${orbiter[1]}, oTilt: ${orbiter[2]}`)
}

function initPlanets(params, sphereMesh, orbiter, mat) {
    const startVector = new THREE.Vector3();

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
ECS.makeCompInstantiator("planetGenerator", instantiatePlanetGenerator);

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

    // world.addSystem()
    //     .withName("PlanetOrbit")
    //     .withQueryComps("sphereMesh", "orbiter")
    //     .withFunction(orbitPlanets)
    //     .withCompBindings("sphereMesh", "orbiter")
    //     .subscribeToBus("OnUpdate")
    // .create();

    const pass = getGenPass("sin_wobble");
    console.log(pass);
}

/* PLANET GENERATION AND GPU COMPUTE */

/**
 * Planet Generation:
 * Planet generation produces heightmaps based on a cube sphere. Each vertex
 *  on the cube sphere is given a height value calculated using a series of generation passes
 *  to progressively build up terrain detail. 
 * 
 * 
 * Generation Passes: 
 * Generation passes are batches of work applied to each vertex of a planet. Generally,
 * a pass will consist of some application of noise or another mathematical function in order
 * to create natural looking terrain. Each fragment of terrain will consist of a single
 * 32-bit float value representing the terrain height difference from the base point. 
 * Generation passes are performed on the GPU using WebGL's GPGPU feature, which essentially
 * repurposes vertex and fragment shaders to output arbitrary data in the form of a texture.
 * 
 * There are 2 built-in Generation Passes:
 * Sphere Generation: Generates a cuboid sphere with the given number of subdivisions.
 * Ouputs a series of 32-bit 3 component vectors as a texture. and takes no texture input
 * 
 * Height application:
 * Applies height buffer to cuboid vertex buffer and outputs the final vertices
 * which are fed into a BufferedMesh
 * Takes heights and the vertices as input and produces the vertices
 * 
 * Height is applied as an offset to the base radius of the sphere
 * 
 * User-defined step input: 
 * - Inputs are the height and vertex buffer, as well as whatever uniforms
 * are passed as parameters
 * - Either vertices or heights are output, specified in options 
 * (this changes which texture is written to).
 * 
 * User Defined Step Execution:
 * Sphere generation is always applied first.
 * 
 * User defined steps are executed in sequence.
 * 
 * Height application is executed last.
 */

// Planet Surface Material
class PlanetSurfaceMaterial extends THREE.ShaderMaterial {

}

// Generation Passes (GenStep)
const genPassMap = new Map();

// hardcoded vertex shader
const gpVertShader = `
attribute vec4 position;
void main() {
    gl_Position = position;
}
`

function initGenPassMap() {
    const genPassBlock = CONFIGS.tryGetConfigBlock("genSteps");

    for (const passData of genPassBlock) {
        try {
            UTILS.require(passData, "name", "file", "output", "uniforms");
        } catch (e) {
            console.error("Failed to load gen pass: " + e);
            continue;
        }

        genPassMap.set(passData.name, new GenerationPass(passData.file, passData.output, passData.uniforms));

    }
}

function getGenPass(name) {
    if (genPassMap.size === 0) {
        initGenPassMap();
    }

    return genPassMap.get(name); 
}

function getGenProfile(name) {

}

class GenPassShader {
    constructor(outputType) {
        this.rawSource = "";
        this.uniforms = [];
        this.outputType = outputType;

        this.completeSource = "";
    }

    setRawSource(rawSource) {
        this.rawSource = rawSource;
    }

    addUniform(name, type) {
        this.uniforms.push(`uniform ${type} ${name};`);
    }

    reload() {
        this.completeSource += "precision highp float;\n" + 
            "uniform sampler2D positions;\n" + 
            "uniform sampler2D heights; \n";
        
        for (const uniformDecl of this.uniforms) {
            this.completeSource += uniformDecl + '\n';
        }

        this.completeSource += this.rawSource + '\n';

        this.completeSource += "void main() {\n"
            + "vec3 p = texture2D(positions, gl_fragCoord).xyz;\n"
            + "float h = texture2D(heights, gl_fragCoord).x;\n"
            + "vec4 oCol = ";
        if (this.outputType === "height") {
            this.completeSource += "vec4(genMain(p, h), 0, 0, 0);\n";
        } else {
            this.completeSource += "vec4(genMain(p, h), 0);\n";
        }

        this.completeSource += "gl_fragColor = oCol;\n"
            + "}\n";
    }

    getFragSource() {
        this.reload();
        return this.completeSource;
    }

    getVertexSource() {
        return gpVertShader;
    }
}

class GenerationPass {
    constructor(shaderFile, output, uniforms) {
        this.passShader = new GenPassShader(output);
        
        for (const n in uniforms) {
            this.passShader.addUniform(n, uniforms[n]);
        }

        fileLoader.load(shaderFile, (data) => {
            this.passShader.setRawSource(data);
            console.log(this.passShader.getFragSource());
        })
    }
}

// Terrain Generator
async function generateTerrain(profile, planetMesh) {
    return true;
}
