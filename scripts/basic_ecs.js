
/* STATICS/GLOBALS */

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

    if (key.length == 0) return 0;

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

    // Note: Update to add new IDS
    get nextIdSlot() {
        if (this.columns.length == 0) return 0;

        return this.spareIds.length == 0 ? this.columns[0].values.length : this.spareIds.pop();
    }

    get length() {
        if (this.columns.length == 0) return 0;
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
        // TODO: Emplace base "Componentless" archetype
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
    constructor() {
        this.archetypes = [];
    }

    addArchetype(archetype) {
        this.archetypes.push(archetype);
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
        
    }

    query(compIds) {
        // traverse archetypes via each comp ID
        const results = []
    }
}

/* EXPORTS */

// entity-based exports
export class EntityGen {
    constructor() {
        // blah blah
        this.compDescriptors = [];
    }

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

        // TODO: don't forget to actually add the entity once archetypes are sort of implemented.

        return newEntity;
    }
}

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