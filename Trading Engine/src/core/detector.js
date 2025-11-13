import { Opportunity } from "./models.js";
import logger from "../utils/logger.js";

export default class ArbitrageDetector {
  constructor(protocols, minSpread = 0.3, amount = 10) {
    this.protocols = protocols;
    this.minSpread = minSpread; // in %
    this.amount = 1000000000000000000n; // in USD
  }

  async scan(token0, token1) {

    const poolData = [];

    for (const p of this.protocols) {
      const pools = await p.getPools(this.amount);
      for (const pool of pools) {
        poolData.push({
          protocol: p.name,
          protocolInstance: p, // Store protocol instance
          chain: p.chain,
          token0: pool.token0,
          token1: pool.token1,
          token0Address: pool.token0Address, // actual contract addresses
          token1Address: pool.token1Address,
          price: pool.price,
          amountIn: pool.amountIn,
          amountOut: pool.amountOut,

        });
      }
    }

    const opportunities = [];

    // 2️⃣ Compare all pool combinations
    for (let i = 0; i < poolData.length; i++) {
      for (let j = 0; j < poolData.length; j++) {
        if (i === j) continue;

        const buyPool = poolData[i];  // where we start (token0 → token1)
        const sellPool = poolData[j]; // where we exit (token1 → token0)

        // Skip same protocol-chain pair
        if (buyPool.protocol === sellPool.protocol && buyPool.chain === sellPool.chain)
          continue;


        const token1Received = buyPool.amountOut; // from first swap
        const reverseRate = sellPool.amountOut > buyPool.amountIn ? (sellPool.amountOut -buyPool.amountIn ) : 0n;  // token0/token1 price from sellPool
              // convert to Ether (still as BigInt ratio, not float)
        const reverseEther = Number(reverseRate) / 1e18;
        const amountEther = Number(this.amount) / 1e18;


        const profitPct = ((reverseEther / amountEther) * 100);

        if (profitPct >= this.minSpread) {
          logger.info(
            `→ Buy on ${buyPool.protocol.padEnd(12)} | Sell on ${sellPool.protocol.padEnd(
              12
            )} | Profit: ${profitPct.toFixed(2)}%`
          );

          opportunities.push(
            new Opportunity({
              buyFrom: buyPool.protocol,
              sellTo: sellPool.protocol,
              tokenPair: `${token0}/${token1}`,
              profitPct,
              amountIn: this.amount,
              amountAfterBuy: token1Received,
              amountBack: reverseRate,
              // Token addresses for actual trading
              tokenA: buyPool.token0Address,
              tokenB: buyPool.token1Address,
              // Expected amounts for slippage
              buyAmountIn: buyPool.amountOut,
              sellAmountOut: sellPool.amountOut,
              // Protocol instances
              buyDex: buyPool.protocolInstance,
              sellDex: sellPool.protocolInstance,
            })
          );
        }
      }
    }

    return opportunities;
  }
}
