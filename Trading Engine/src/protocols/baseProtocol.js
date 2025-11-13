export default class BaseProtocol {
  constructor(name, chain) {
    this.name = name;
    this.chain = chain;
  }

  async getPools() {
    throw new Error("getPools() not implemented");
  }

  async getPrice(token0, token1) {
    throw new Error("getPrice() not implemented");
  }
}
