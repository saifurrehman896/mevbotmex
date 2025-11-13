import BaseProtocol from "./baseProtocol.js";
import { getProvider } from "../core/blockchain.js";
import { PoolData } from "../core/models.js";
import UNISWAP_V2_PAIR_ABI from "../abis/uniswapV2Pair.json" with { type: "json" };
import { Contract } from "ethers";
import logger from "../utils/logger.js";

export default class UniswapV2Adapter extends BaseProtocol {
  constructor(chain = "ethereum", factoryAddress, pairs) {
    super("UniswapV2", chain);
    this.factoryAddress = factoryAddress;
    this.pairs = pairs; // [{address, token0, token1}]
    this.provider = getProvider(chain);
  }

  async getPools() {
    const pools = [];

    for (const pair of this.pairs) {
      if (pair.dex_version !== "V2") continue;

      const contract = new Contract(pair.address, UNISWAP_V2_PAIR_ABI, this.provider);

      try {
        const [reserve0, reserve1] = await contract.getReserves();

        // Convert to BigInt
        const r0 = BigInt(reserve0.toString());
        const r1 = BigInt(reserve1.toString());

        // Basic price ratio (approximate numeric)
        const price = Number(r1) / Number(r0);

        // Example trade amount: 1 token0 (assuming 18 decimals)
        const amount = BigInt(settings.amount) * 10n ** BigInt(settings.deciamls); // 1 token (18 decimals)
        const amountOut = getAmountOut(amount, r0, r1);
        const amountIn = getAmountIn(amount, r1, r0);

        pools.push(
          new PoolData({
            protocol: this.name,
            chain: this.chain,
            token0: pair.token0,
            token1: pair.token1,
            reserve0: r0.toString(),
            reserve1: r1.toString(),
            price,
            amountIn: amountIn,
            amountOut: amountOut,
            requiredIn: amount,
          })
        );
      } catch (err) {
        logger.error(`Error loading pair ${pair.address}: ${err.message}`);
      }
    }

    return pools;
  }
  async tradeBuy(tokenIn, tokenOut, amountIn, minOut, recipient) {
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 60;

    return this.router.populateTransaction.swapExactTokensForTokens(
      amountIn,
      minOut,
      path,
      recipient,
      deadline
    );
  }

  async tradeSell(tokenIn, tokenOut, amountIn, minOut, recipient) {
    // same method — buy/sell is symmetric in V2
    return this.tradeBuy(tokenIn, tokenOut, amountIn, minOut, recipient);
  }
}

/**
 * Uniswap V2 formulas (BigInt safe)
 */
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

function getAmountIn(amountOut, reserveIn, reserveOut) {
  const numerator = reserveIn * amountOut * 1000n;
  const denominator = (reserveOut - amountOut) * 997n;
  return numerator / denominator + 1n;
}
