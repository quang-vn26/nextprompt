import React from "react";

export function useMounted(): { readonly isMounted: boolean } {
    const state = React.useRef<{
        isMounted: boolean;
        mountId: object | undefined;
    }>({
        get isMounted() {
            return this.mountId !== undefined;
        },
        mountId: undefined,
    });
    React.useEffect(() => {
        const obj = state.current;
        const mountId = {};
        obj.mountId = mountId;
        return () => {
            if (obj.mountId === mountId) {
                obj.mountId = undefined;
            }
        };
    }, []);
    const obj = state.current;
    if (obj.mountId === undefined) {
        obj.mountId = {};
    }
    return obj;
}

/**
 * For `prev` that was passed as `next` in a previous render:
 * - If `condition(prev, next)` is true, returns `prev`.
 * - Otherwise, assigns `prev` to be `next` and returns it.
 *
 * @example
 * // Memoize using deep equality of the result:
 * const value = usePreviousIf(React.useMemo(() => {...compute value...}, [...deps...]), valueEquals);
 * @example
 * // Update state only after a condition is met:
 * const state = usePreviousIf(nextState, () => {...check arbitrary condition...})
 */
export function usePreviousIf<T>(next: T, condition: (prev: T, next: T) => boolean): T {
    const prevRef = React.useRef<readonly [T]>();
    return (prevRef.current = prevRef.current && condition(prevRef.current[0], next) ? prevRef.current : [next])[0];
}

/**
 * Compares dependencies for equality using React's algorithm, in the sense that for any given `deps1` and `deps2`, if
 * React's algorithm returns `true` or `false`, `depsEqual` returns the same value.
 *
 * (React's algorithm throws an error if the dependencies change length, but `depsEqual` doesn't.)
 */
export function depsEqual(deps1: React.DependencyList, deps2: React.DependencyList) {
    if (deps1.length !== deps2.length) return false;
    for (let i = 0; i < deps1.length; i++) {
        if (!Object.is(deps1[i], deps2[i])) return false;
    }
    return true;
}
