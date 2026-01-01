const listeners = new Set();

export function emit(event) {
  for (const cb of listeners) cb(event);
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
