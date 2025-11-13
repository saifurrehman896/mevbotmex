import ProtocolRegistry from "./core/registry.js";
import ArbitrageDetector from "./core/detector.js";
import UniswapV2Adapter from "./protocols/uniswapv2.js";
import settings from "./config/settings.js";
import PancakeswapV2Adapter from "./protocols/pancakeswapv2.js";
import UniswapV3Adapter from "./protocols/uniswapv3.js";
import Trader from "./core/trader.js";
import { getProvider } from "./core/blockchain.js";
import { logger, tradeLogger } from "./utils/logger.js";

async function main() {
  const registry = new ProtocolRegistry();

  // Initialize trader wallet first if configured
  let trader = null;
  let wallet = null;
  if (settings.privateKey) {
    const provider = getProvider("bsc");
    trader = new Trader(settings.privateKey, provider, settings.multicallAddress, {
      txTimeout: settings.txTimeout,
      minProfitPct: settings.minProfitPct
    });
    wallet = trader.wallet;
    logger.info(`🔑 Trader initialized with wallet: ${wallet.address}`);
    logger.info(`🔗 Multicall address: ${settings.multicallAddress}`);
    logger.info(`⏱️  Transaction timeout: ${settings.txTimeout} ms`);
    if (settings.minProfitPct) {
      logger.info(`💵 Minimum profit threshold: ${settings.minProfitPct}%`);
    }
  }

  const uniswap = new UniswapV3Adapter("bsc", settings.uniswap.factory, settings.uniswap_pair, wallet);
  const pancakeswap = new PancakeswapV2Adapter("bsc", settings.pancake.factory, settings.pancakeswap_pair, wallet);
  registry.register(uniswap);
  registry.register(pancakeswap);

  const detector = new ArbitrageDetector(registry.getAll(), settings.minSpread, settings.amount);

  logger.info("🚀 Starting arbitrage monitor...");
  logger.info("Press Ctrl+C to stop.");
  // Continuous loop
  while (true) {
    try {
      const opportunities = await detector.scan("XRP", "USDT");

      if (opportunities.length > 0) {
        console.clear();
        logger.info(`💰 Detected ${opportunities.length} opportunities:`);
        for (const opp of opportunities) {
          logger.info(
            `   → Buy on ${opp.buyFrom.padEnd(12)} | Sell on ${opp.sellTo.padEnd(12)} | Profit: ${opp.profitPct.toFixed(2)}%`
          );
        }
        if (trader && settings.autoExecute) {
          const bestOpp = opportunities[0]; 
          tradeLogger.info(`🎯 Executing best opportunity: ${bestOpp.profitPct.toFixed(2)}% profit`);
          const result = await trader.execute(bestOpp);
          
          // Log the result
          if (result.skipped) {
            tradeLogger.warn(`⏭️  Trade skipped: ${result.error}`);
          } else if (!result.success) {
            tradeLogger.error(`❌ Trade failed: ${result.error}`);
          }
        }
      } else {
        logger.info("No arbitrage found.");
      }
    } catch (err) {
      logger.error(`⚠️ Error: ${err.message}`, { stack: err.stack });
    }
    await new Promise((r) => setTimeout(r, settings.pollInterval || 3000));
  }
}

main().catch((e) => logger.error(`Fatal: ${e.message}`, { stack: e.stack }));
