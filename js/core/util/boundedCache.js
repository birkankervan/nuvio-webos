// Result entries only: pending requests keep their existing ownership/lifetime.
export class BoundedCache extends Map {
  constructor(maxEntries) {
    super();
    this.maxEntries = Math.max(1, Math.floor(Number(maxEntries) || 1));
  }

  get(key) {
    // Reads promote entries; snapshot keys before reading during an iteration.
    if (!super.has(key)) return undefined;
    const value = super.get(key);
    super.delete(key);
    super.set(key, value);
    return value;
  }

  set(key, value) {
    super.delete(key);
    super.set(key, value);
    while (this.size > this.maxEntries) super.delete(this.keys().next().value);
    return this;
  }
}
