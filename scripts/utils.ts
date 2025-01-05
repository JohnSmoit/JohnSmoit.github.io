

export function safeGet(obj: Object, key: string, defaultValue: any, warn: string | null) {
    if (!obj || !(key in obj)) {
        if (warn) {
            console.error(warn);
        }

        return defaultValue;
    }

    return obj[key];
}

export function require(obj: Object, ...keys: string[]) {
    if (arguments.length <= 1) return true;

    const improper: string[] = [];
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

export function degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
}