export class Entity {
  constructor(x, y, t) {
    this.x = x;
    this.y = y;
    this.type = t;
    this.hp = 1;
    this.tx = x;
    this.ty = y;
    this.fast = false;
  }
}
