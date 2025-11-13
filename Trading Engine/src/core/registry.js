export default class ProtocolRegistry {
  constructor() {
    this.protocols = [];
  }

  register(protocol) {
    this.protocols.push(protocol);
  }

  getAll() {
    return this.protocols;
  }
}
