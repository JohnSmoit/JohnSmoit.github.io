
let configsJSON = null;


function isLoaded() {
    return configsJSON != null;
}

async function loadLazy() {
    if (isLoaded()) return;

    const baseURL = window.location.origin;
    const resourceLocation = `${baseURL}/public/planet-params.json`;

    const result = await fetch(resourceLocation);
    configsJSON = await result.json();
}

export async function loadConfigs() {
    await loadLazy();
}

export function tryGetConfigBlock(name) {

    if (!name || !(name in configsJSON)) {
        console.error("Failed to find config block key of " + name);
        return [];
    }

    return configsJSON[name];
}