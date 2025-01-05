
/* STATICS/GLOBALS */
// TODO: Optimize access patterns of components by systems
//  - Maybe creating memory layouts depending on the overall access of components by every system
//  - which queries an archetype
// TODO: Implement Add/Remove functionality for both entities and components to entities
// TODO (Maybe): Make entity IDs occupy 64-bit id space
// TODO: Implement better error checking
//  - Better config warnings/errors for System and Entity Gen
//  - Better overall error checking for systems (stuff like exception handling)


/* GENERAL */
const instantiators = new Map();

// resource (type) identifiers
const seed = 0x9327;

function nextChars(key, index) {
    return key.charCodeAt(index) +
        (key.charCodeAt(index + 1) << 8) + 
        (key.charCodeAt(index + 2) << 8) + 
        (key.charCodeAt(index + 3) << 8);
}

function murmurScramble(k) {
    k *= 0xcc9e2d51;
    k = (k << 15) | (k >> 17);
    k *= 0x1b873593;
    return k;
}

// This function uses the Murmur hash algorithm to hash strings to
// 32-bit integer values.
// Murmur3Hash (Ported from C code): https://en.wikipedia.org/wiki/MurmurHash
function makeTypeId(key) {
    let h = seed;
    let k;
    let index = 0;

    if (key.length === 0) return 0;

    for (let i = key.length >> 2; i; i--) {
        k = nextChars(key, index);
        index += 4;
        h ^= murmurScramble(k);
        h = (h << 13) | (h >> 19);
        h = h * 5 + 0xe6546b64;
    }

    // hash and scramble trailing characters
    k = 0;
    for (let i = key.length % 4; i; i--) {
        k <<= 8;
        k |= key.charCodeAt(i - 1);
    }

    h ^= murmurScramble(k);
	h ^= key.length;
	h ^= h >> 16;
	h *= 0x85ebca6b;
	h ^= h >> 13;
	h *= 0xc2b2ae35;
	h ^= h >> 16;

	return h;
}

function makeArchetypeId(typeIds) {
    let v = "";
    for (let i = 0; i < typeIds.length; i++) {
        v += String.fromCharCode((typeIds[i] >> 24) & 0xff);
        v += String.fromCharCode((typeIds[i] >> 16) & 0xff);
        v += String.fromCharCode((typeIds[i] >> 8) & 0xff);
        v += String.fromCharCode(typeIds[i] & 0xff);
    }

    // console.log(`Secondary hash: (${v})`);
    return makeTypeId(v);
}


/* COMPONENT MANAGEMENT */
function instantiateComponentArrays(entityId, compDescriptors) {
    const components = [];
    const typeIds = [];

    for (let i = 0; i < compDescriptors.length; i++) {
        const descriptor = compDescriptors[i];
        const descriptorId = makeTypeId(descriptor.name);
        const instantiator = instantiators.get(descriptorId);

        typeIds.push(descriptorId);

        if (!instantiator) {
            components.push(descriptor[i]);
            continue;
        }

        try {
            //console.log(descriptor);
            components.push(instantiator(entityId, descriptor.v));
        } catch (e) {
            console.error(`Failed to initialize component: ${descriptor.name}\nReason: ${e}`);
            components.push(null);
        }
    }

    return {compInstances: components, typeIds: typeIds};
}
/* ENTITY MANAGEMENT*/
class Entity {
    constructor(id) {
        this.id = id;
    }
}

/* SYSTEM MANAGEMENT */

//TODO: Systems will need to re-query once component add/remove is implemented
// as well as addition of entities with new archetypes
// TODO: Add support for custom system execution routines

class System {
    constructor(world, name, queryComps, func, compBindings) {
        this.func = func;
        this.id = makeTypeId(name);
        this.query = null; //Lazily load query
        this.queryComps = queryComps;
        this.world = world;

        // Array Map (Alongside queryResults archetypes) -> <Archetype, Map -> <Comp Type, Column Id>>
        this.typeColumnMap = null; //Map -> <Comp Type, Column Id)
        this.compBindings = []

        for(let i = 0; i < compBindings.length; i++) {
            this.compBindings.push(compBindings[i]);
        }
    }
    
    dispatch(dispatchParams) {
        dispatchParams.id = 0;

        if (!this.query) {
            this.query = this.world.query(this.queryComps);

            this.typeColumnMap = [];
            for (const arch of this.query.archetypes) {
                const archMap = new Map();
                for (let i = 0; i < arch.numColumns; i++) {
                    archMap.set(arch.typeIds[i], i);
                }

                this.typeColumnMap.push(archMap);
            }
        }

        for (let i = 0; i < this.query.length; i++) {
            // get Comp id to archetype column mapping
            const compIdMap = this.typeColumnMap[i];
            const archetype = this.query.get(i);

            // Iterate trhough componnets of archetype and execute dispatch function on them
            for (let j = 0; j < archetype.length; j++) {
                const args = System.getDispatchArgsFor(archetype, compIdMap, this.compBindings, j);

                this.func(dispatchParams, ...args);
            }
        }
    }

    static getDispatchArgsFor(archetype, compIdMap, bindings, row) {
        const args = new Array(bindings.length);
        
        for (let i = 0; i < bindings.length; i++) {
            const column = compIdMap.get(bindings[i]);
            args[i] = archetype.get(column, row);
        }

        return args;
    }
}

/*
NOTE: Special Case Section
- No comp Bindings -> Warn + generate bindings from array indices
 */

class SystemGen {
    constructor(world) {
        this.world = world;
        this.name = null;
        this.queryComps = [];
        this.func = null;
        this.busNames = [];
        this.compBindings = [];
    }

    withName(name) {
        this.name = name;
        return this;
    }

    withQueryComps(...compNames) {
        this.queryComps = this.queryComps.concat(compNames);
        return this;
    }

    withFunction(func) {
        this.func = func;
        return this;
    }

    withCompBindings(...compBindings) {
        this.compBindings = this.compBindings.concat(compBindings);
        return this;
    }

    subscribeToBus(busName) {
        this.busNames.push(busName);
        return this;
    }

    create() {
        const compIds = [];

        for (let i = 0; i < this.queryComps.length; i++) {
            compIds.push(makeTypeId(this.queryComps[i]));
        }
        const bindingMaps = [];
        for (let i = 0; i < this.compBindings.length; i++) {
            bindingMaps.push(makeTypeId(this.compBindings[i]));
        }
        const newSystem = new System(this.world, this.name, compIds, this.func, bindingMaps);

        for (const name of this.busNames) {
            const bus = this.world.getBus(name);
            if (!bus) {
                console.error("Invalid bus name: " + name);
                continue;
            }

            bus.subscribe(newSystem);
        }

        addSystemToWorld(this.world, newSystem);

        return newSystem;
    }
}

function addSystemToWorld(world, system) {
    world.systemIndex.set(system.id, system);
}

/* ECS WORLD MANAGEMENT */

class Column {
    constructor() {
        this.values = [];
    }
}

// Archetype Structure
// NOTE: The current plan is to ignore adding and removing components for now, 
// and focus on simply storing things in the correct archetype
class Archetype {
    constructor( id, typeIds) {
        this.id = id;
        this.typeIds = typeIds;

        this.columns = new Array(typeIds.length);
        for (let i = 0; i < this.columns.length; i++) {
            this.columns[i] = new Column();
        }
        this.spareIds = [];
    }

    get (columnIndex, rowIndex) {
        return this.columns[columnIndex].values[rowIndex];
    }

    get numColumns() {
        return this.columns.length;
    }

    // Note: Update to add new IDS
    get nextIdSlot() {
        if (this.columns.length === 0) return 0;

        return this.spareIds.length === 0 ? this.columns[0].values.length : this.spareIds.pop();
    }

    get length() {
        if (this.columns.length === 0) return 0;
        return this.columns[0].values.length - this.spareIds.length;
    }

    pushNew() {
        for (let i = 0; i < this.columns.length; i++) {
            this.columns[i].values.push(null);
        }
    }

    set(columnIndex, rowIndex, value) {
        this.columns[columnIndex].values[rowIndex] = value;
    }
}

/*
Needed Operations:
    - Entity.getComponent (typeId) -> Component Instance
    - World.query(componentTypes) -> Array<Archetypes>
 */
// map of archetypes
class ArchetypeMap {
    constructor() {
        this.archetypeIndex = new Map();

        // maps components to their archetype indices
        // component id -> (archetype_id -> column index)
        this.archetypeColumnIndex = new Map();

        this.addArchetype([]);

        // I'm thinking we also store query cache information here (LATER)
    }

    get(id) {
        return this.archetypeIndex.get(id);
    }

    getForComp(compId) {
        const ids = this.archetypeColumnIndex.get(compId).keys();
        const archs = [];
        for (const id of ids) {
            archs.push(this.get(id));
        }
        return archs;
    }

    setColumnMapping(compId, archetypeId, columnIndex) {
        if (!this.archetypeColumnIndex.has(compId)) {
            this.archetypeColumnIndex.set(compId, new Map());
        }

        const compIdMap = this.archetypeColumnIndex.get(compId);
        if (!compIdMap.has(archetypeId)) {
            compIdMap.set(archetypeId, columnIndex);
        }
    }

    addArchetype(typeIds) {
        const id = makeArchetypeId(typeIds);
        const newArchetype = new Archetype(id, typeIds);
        this.archetypeIndex.set(id, newArchetype);

        for (let i = 0; i < typeIds.length; i++) {
            this.setColumnMapping(typeIds[i], id, i);
        }

        return newArchetype;
    }

    getCompColumn(compId, archetypeId) {
        return this.archetypeColumnIndex.get(compId).get(archetypeId);
    }

    addEntry(slot, archetype, comps, typeIds) {
        if (slot >= archetype.length) {
            archetype.pushNew();
        }

        for (let i = 0; i < typeIds.length; i++) {
            const comp = comps[i];
            const compId = typeIds[i];
            const columnIndex = this.getCompColumn(compId, archetype.id);

            archetype.set(columnIndex, slot, comp);
        }
    }
}

function makeRecord(archetype, index) {
    return {archetype: archetype, index: index};
}

// a linked list of archetypes returned by a query
class QueryResults {
    constructor(world, typeIds) {
        this.world = world;
        this.archetypes = [];
        this.typeIds = typeIds;
    }

    addArchetype(archetype) {
        this.archetypes.push(archetype);
    }

    get(index) {
        return this.archetypes[index];
    }

    get length() {
        return this.archetypes.length;
    }

}

class EventBus {
    constructor(name) {
        this.name = name;
        this.subscribers = [];
    }

    subscribe(system) {
        this.subscribers.push(system);
    }

    dispatch(params) {
        for (const system of this.subscribers) {
            system.dispatch(params);
        }
    }
}

class World {
    constructor() {
        this.baseId = 0;

        // entity ID index
        this.entityIndex = new Map();
        // entity Archetype Index
        this.archetypes = new ArchetypeMap();
        // system registry
        this.eventBuses = new Map();
        this.systemIndex = new Map();
    }

    get nextId() {
        const next = this.baseId;
        this.baseId++;

        return next;
    }

    //NOTE: Starting comps is the descriptors, prior to instantiation.
    addEntity(entityWrapper, startingComps) {
        if (this.entityIndex.has(entityWrapper.id)) return false;
        const { compInstances, typeIds } = instantiateComponentArrays(entityWrapper.id, startingComps);

        // find the appropriate archetype
        const archetypeId = makeArchetypeId(typeIds);
        let foundArchetype = this.archetypes.get(archetypeId);
        if (!foundArchetype) {
            foundArchetype = this.archetypes.addArchetype(typeIds);
        }

        const slot = foundArchetype.nextIdSlot;

        this.entityIndex.set(entityWrapper.id, makeRecord(foundArchetype, slot));
        this.archetypes.addEntry(slot, foundArchetype, compInstances, typeIds);

        return true;
    }

    createEventBus(name) {
        const bus = new EventBus(name);
        this.eventBuses.set(name, bus);

        return bus;
    }

    getBus(name) {
        return this.eventBuses.get(name);
    }

    query(compIds) {
        // traverse archetypes via each comp ID
        const results = [];
        for (const arch of this.archetypes.getForComp(compIds[0])) {
            let valid = true;
            for (const compId of compIds) {
                if (!arch.typeIds.includes(compId)) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                results.push(arch);
            }
        }

        const res = new QueryResults(this, compIds);

        for (const result of results) {
            res.addArchetype(result);
        }

        console.log(res);

        return res;
    }

    addSystem() {
        return new SystemGen(this);
    }
}

/* EXPORTS */

// entity-based exports
/**
 * A builder class meant for chaining function calls which compose new entities.
 * Essentially, defines entities in code
 */
export class EntityGen {
    constructor() {
        // blah blah
        this.compDescriptors = [];
    }

    /**
     * Adds a component descriptor to the list of components the entity will be initialized with.
     * @param {{name: string, v: Object}} comp component type name and initialization parameters
     * @returns Builder instance
     */
    withComp(comp) {
        // add component descriptor to local registry array
        this.compDescriptors.push(comp);
        return this;
    }

    buildAndAddTo(world) {

        /** returns an entity ID wrapper */
        //console.log(this.compDescriptors);
        const newEntity = new Entity(world.nextId);
        world.addEntity(newEntity, this.compDescriptors);

        return newEntity;
    }
}

/**
 * Starts a new entity builder call chain.
 * Used when defining entities in code.
 * @returns {EntityGen} an entity builder
 */
export function newEntity() {
    return new EntityGen();
}

// world-based exports
export function makeWorld() {
    return new World();
}

// component-based exports
export function makeCompInstantiator(compName, instantiatorFunc) {
    const id = makeTypeId(compName);
    instantiators.set(id, instantiatorFunc);
}