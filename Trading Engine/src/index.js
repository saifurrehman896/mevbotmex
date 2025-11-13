import ProtocolRegistry from "./core/registry.js";
import ArbitrageDetector from "./core/detector.js";
import UniswapV2Adapter from "./protocols/uniswapv2.js";
import settings from "./config/settings.js";
import PancakeswapV2Adapter from "./protocols/pancakeswapv2.js";
import UniswapV3Adapter from "./protocols/uniswapv3.js";
import Trader from "./core/trader.js";
import { getProvider } from "./core/blockchain.js";

async function main() {
  const registry = new ProtocolRegistry();

  // Initialize trader wallet first if configured
  let trader = null;
  let wallet = null;
  if (settings.privateKey) {
    const provider = getProvider("bsc");
    trader = new Trader(settings.privateKey, provider, settings.multicallAddress);
    wallet = trader.wallet;
    console.log("🔑 Trader initialized with wallet:", wallet.address);
    console.log("🔗 Multicall address:", settings.multicallAddress);
  }

  // Register protocols with wallet for trading
  const uniswap = new UniswapV3Adapter("bsc", settings.uniswap.factory, settings.uniswap_pair, wallet);
  const pancakeswap = new PancakeswapV2Adapter("bsc", settings.pancake.factory, settings.pancakeswap_pair, wallet);
  registry.register(uniswap);
  registry.register(pancakeswap);

  const detector = new ArbitrageDetector(registry.getAll(), settings.minSpread, settings.amount);

  console.log("🚀 Starting arbitrage monitor...");
  console.log("Press Ctrl+C to stop.\n");

  // Test mode: Create fake opportunity
  if (settings.testMode) {
    console.log("⚠️ TEST MODE ENABLED - Creating fake opportunity\n");
    
    const fakeOpportunity = {
      buyFrom: "UniswapV3",
      sellTo: "Pancakeswap",
      tokenPair: "XRP/USDT",
      profitPct: 5.0,
      timestamp: Date.now(),
      amountIn: BigInt(settings.amount) * 10n ** BigInt(settings.decimals),
      amountAfterBuy: BigInt(settings.amount) * 10n ** BigInt(settings.decimals) * 105n / 100n, // 5% more
      amountBack: BigInt(settings.amount) * 10n ** BigInt(settings.decimals) * 110n / 100n, // 10% profit
      tokenA: settings.tokens.XRP,
      tokenB: settings.tokens.USDT,
      buyAmountIn:  2487958361960316679n, // 2.4 USDT
      sellAmountOut: 2487958361960316679n,
      buyDex: uniswap,
      sellDex: pancakeswap,
    };

    console.log(`🎯 Test opportunity: Buy on ${fakeOpportunity.buyFrom}, Sell on ${fakeOpportunity.sellTo}`);
    console.log(`   Profit: ${fakeOpportunity.profitPct}%`);
    console.log(`   Token A (XRP): ${fakeOpportunity.tokenA}`);
    console.log(`   Token B (USDT): ${fakeOpportunity.tokenB}`);
    console.log(`   Amount In: ${fakeOpportunity.amountIn}`);
    console.log(`   Buy Amount Out: ${fakeOpportunity.buyAmountIn}`);
    console.log(`   Sell Amount Out: ${fakeOpportunity.sellAmountOut}\n`);

    if (trader) {
      await trader.execute(fakeOpportunity);
    }
    return; // Exit after test
  }

  // Continuous loop
  while (true) {
    try {
      const opportunities = await detector.scan("XRP", "USDT");

      if (opportunities.length > 0) {
        console.clear();
        console.log(`[${new Date().toLocaleTimeString()}] 💰 Detected ${opportunities.length} opportunities:`);
        for (const opp of opportunities) {
          console.log(
            `   → Buy on ${opp.buyFrom.padEnd(12)} | Sell on ${opp.sellTo.padEnd(12)} | Profit: ${opp.profitPct.toFixed(2)}%`
          );
        }

        // Execute best opportunity if trader is configured and auto-execute is enabled
        if (trader && settings.autoExecute) {
          const bestOpp = opportunities[0]; // highest profit
          console.log(`\n🎯 Executing best opportunity: ${bestOpp.profitPct.toFixed(2)}% profit`);
          
          // Protocol adapters are already attached in detector
          await trader.execute(bestOpp);
        }
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] No arbitrage found.`);
      }
    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] ⚠️ Error:`, err.message);
    }

    // Wait before next scan
    await new Promise((r) => setTimeout(r, settings.pollInterval || 5000));
  }
}

main().catch((e) => console.error("Fatal:", e));
