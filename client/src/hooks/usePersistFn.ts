import { useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type noop = (...args: any[]) => any;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>(null);
  if (!persistFn.current) {
    persistFn.current = function (this: unknown, ...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return fnRef.current!.apply(this, args);
    } as T;
  }

  return persistFn.current!;
}
