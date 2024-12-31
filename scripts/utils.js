

export function safeGet(obj, key, defaultValue, warn) {
    if (!obj || !(key in obj)) {
        if (warn) {
            console.warn(warn);
        }
        return defaultValue;
    }

    return defaultValue;
}

export function require(obj) {
    if (arguments.length <= 1) return true;

    const improper = [];
    for (let i = 1; i < arguments.length; i++) {
        const key = arguments[i];
        if (!obj || !(key in obj)) {
            improper.push(key);
        }
    }

    if (improper.length != 0) {
        throw "Required keys not present within object: " + improper.toString();
    }

    return true;
}