export const LEAF_COUNT = 48;

export class BookMotion {
  constructor(leafCount = LEAF_COUNT) { this.leafCount = Math.max(LEAF_COUNT, Math.ceil(leafCount)); }
  phase = 'closed'; page = 0; progress = 0; turnProgress = 0; direction = 1; index = 0; closeQueued = false;
  get openness() { return this.progress ** 2 * (3 - 2 * this.progress); }
  get busy() { return this.phase !== 'closed' && this.phase !== 'open'; }
  get opened() { return this.phase !== 'closed' && this.phase !== 'closing'; }
  open() {
    if (this.phase !== 'closed' && this.phase !== 'closing') return false;
    this.phase = 'opening'; this.closeQueued = false; return true;
  }
  close() {
    if (this.phase === 'closed' || this.phase === 'closing') return false;
    if (this.phase === 'turning') this.closeQueued = true;
    else this.phase = 'closing';
    return true;
  }
  turn(direction) {
    if (this.phase !== 'open' || ![-1, 1].includes(direction)) return false;
    if (this.page + direction < 0 || this.page + direction > this.leafCount) return false;
    this.direction = direction; this.index = direction > 0 ? this.page : this.page - 1;
    this.turnProgress = 0; this.phase = 'turning'; return true;
  }
  step(delta, reducedMotion) {
    const changed = this.busy;
    if (this.phase === 'turning') {
      this.turnProgress = Math.min(1, this.turnProgress + (reducedMotion ? 1 : delta / .95));
      if (this.turnProgress === 1) {
        this.page += this.direction; this.phase = this.closeQueued ? 'closing' : 'open'; this.closeQueued = false;
      }
    }
    if (this.phase === 'opening' || this.phase === 'closing') {
      const direction = this.phase === 'opening' ? 1 : -1;
      this.progress = Math.min(1, Math.max(0, this.progress + direction * (reducedMotion ? 1 : delta / 1.2)));
      if (this.progress === 1) this.phase = 'open';
      if (this.progress === 0) { this.phase = 'closed'; this.page = 0; }
    }
    return { changed, unsettled: this.busy };
  }
}
