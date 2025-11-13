import BaseProtocol from "./baseProtocol.js";
import { getProvider } from "../core/blockchain.js";
import { PoolData } from "../core/models.js";
import PANCAKE_V2_PAIR_ABI from "../abis/pancakeswapV2Pair.json" with { type: "json" };
import { Contract, ethers } from "ethers";
import settings from "../config/settings.js";

export default class PancakeswapV2Adapter extends BaseProtocol {
  constructor(chain = "bsc", factoryAddress, pairs, wallet = null) {
    super("Pancakeswap", chain);
    this.factoryAddress = factoryAddress;
    this.pairs = pairs; // [{address, token0, token1}]
    this.provider = getProvider(chain);
    this.routerAddress = pairs[0]?.router_address || "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    this.wallet = wallet;

    // Initialize router contract for trading
    const routerContract = new ethers.Contract(
      this.routerAddress,
      [
        "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
        "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[] amounts)"
      ],
      this.provider
    );

    // Connect to wallet if provided
    this.router = wallet ? routerContract.connect(wallet) : routerContract;
  }

  async getPools() {
    const pools = [];

    for (const pair of this.pairs) {
      if (pair.dex_version !== "V2") continue;

      const contract = new Contract(pair.address, PANCAKE_V2_PAIR_ABI, this.provider);

      try {
        console.log(`Fetching reserves for pair: ${pair.address}`);
        const [reserve0, reserve1] = await contract.getReserves();

        // Convert reserves to BigInt
        const r0 = BigInt(reserve0.toString());
        const r1 = BigInt(reserve1.toString());

        // Calculate approximate price ratio
        const price = Number(r1) / Number(r0);


        const amount = BigInt(settings.amount) * 10n ** BigInt(settings.deciamls); // 1 token (18 decimals)
        const amountOut = getAmountOut(amount, r0, r1);
        const amountIn = getAmountIn(amount, r1, r0);

        pools.push(
          new PoolData({
            protocol: this.name,
            chain: this.chain,
            token0: pair.token0,
            token1: pair.token1,
            token0Address: settings.tokens[pair.token0] || pair.token0,
            token1Address: settings.tokens[pair.token1] || pair.token1,
            reserve0: r0.toString(),
            reserve1: r1.toString(),
            price,
            amountIn: amountIn,
            amountOut: amountOut,
            requiredIn: amount,
          })
        );
      } catch (err) {
        console.error(`Error fetching data for ${pair.address}:`, err.message);
      }
    }

    return pools;
  }
  async tradeBuy(tokenA, tokenB, amountOut, amountIn, recipient) {
    // Token A To Token B - >  Sell
    // Token B To Token A - > Buy
    const path = [tokenA, tokenB];
    path.reverse();
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    return await this.router.swapTokensForExactTokens.populateTransaction(
      amountOut,
      amountIn,
      path,
      recipient,
      deadline,
      {
        gasLimit: 500000
      }
    );
  }

  async tradeSell(tokenA, tokenB, amountIn, amountOut, recipient) {
    // Token A To Token B - >  Sell
    // Token B To Token A - > Buy
    const path = [tokenA, tokenB];
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    return await this.router.swapExactTokensForTokens.populateTransaction(
      amountIn,
      amountOut,
      path,
      recipient,
      deadline,
      {
        gasLimit: 500000
      }
    );
  }
}

/**
 * Pancakeswap V2 (Uniswap V2 fork) formulas
 * BigInt-safe arithmetic
 */
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 9975n; // PancakeSwap uses 0.25% fee (2.5 / 1000)
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  return numerator / denominator;
}

function getAmountIn(amountOut, reserveIn, reserveOut) {
  const numerator = reserveIn * amountOut * 10000n;
  const denominator = (reserveOut - amountOut) * 9975n;
  return numerator / denominator + 1n;
}
