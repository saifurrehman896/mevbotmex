import { ethers } from "ethers";
import ERC20_ABI from "../abis/erc20-abi.json" with { type: "json" };
import { logger, tradeLogger } from "../utils/logger.js";

// Minimal Multicall3 ABI for aggregate3 function
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];

export default class Trader {
  constructor(privateKey, provider, multicallAddress = "0xf6737001144C05fe5B8CA8f05323102dc70F0143", options = {}) {
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.multicallAddress = multicallAddress; // Multicall3 address (same on most chains)
    this.multicall = new ethers.Contract(multicallAddress, MULTICALL3_ABI, this.wallet);
    
    // Trading lock mechanism
    this.isTrading = false;
    this.pendingTxHash = null;
    this.tradingStartTime = null;
    this.txTimeout = options.txTimeout || 60000; // 
    
    this.minProfitPct = options.minProfitPct || 0;
  }

  async ensureApproval(token, spender, amount) {
    const contract = new ethers.Contract(token, ERC20_ABI, this.wallet);
    const allowance = await contract.allowance(this.wallet.address, spender);

    if (allowance < BigInt(amount)) {
      logger.info(`🔏 Approving ${spender} to spend your tokens...`);
      const tx = await contract.approve(spender, ethers.MaxUint256);
      await tx.wait();
      logger.info(`✅ Approval confirmed`);
    }
  }

  /**
   * Check if a trade can be executed based on lock status
   * @returns {Object} { canTrade: boolean, reason: string }
   */
  canExecuteTrade() {
    // Check if already trading
    if (!this.isTrading) {
      return { canTrade: true, reason: null };
    }

    // Check if timeout has elapsed (allow override)
    const now = Date.now();
    const elapsedTime = now - this.tradingStartTime;
    
    if (elapsedTime > this.txTimeout) {
      logger.warn(`⚠️ Previous trade timed out after ${elapsedTime}ms. Allowing new trade.`);
      logger.warn(`   Previous tx hash: ${this.pendingTxHash}`);
      // Reset the lock
      this.clearTradingLock();
      return { canTrade: true, reason: null };
    }

    return { 
      canTrade: false, 
      reason: `Trade already in progress (${elapsedTime}ms elapsed, tx: ${this.pendingTxHash})` 
    };
  }

  /**
   * Set trading lock before executing a trade
   */
  setTradingLock(txHash) {
    this.isTrading = true;
    this.pendingTxHash = txHash;
    this.tradingStartTime = Date.now();
    tradeLogger.info(`🔒 Trading lock activated - TX: ${txHash}`);
  }
  /**
   * Clear trading lock after trade completes or fails
   */
  clearTradingLock() {
    const wasTrading = this.isTrading;
    this.isTrading = false;
    this.pendingTxHash = null;
    this.tradingStartTime = null;
    if (wasTrading) {
      tradeLogger.info(`🔓 Trading lock released`);
    }
  }

  async execute(opp) {
    // Check if we can execute a trade
    const { canTrade, reason } = this.canExecuteTrade();
    if (!canTrade) {
      tradeLogger.info(`⏸️ Skipping trade: ${reason}`);
      return { success: false, error: reason, skipped: true };
    }

    try {
      tradeLogger.info(`🚀 Executing arbitrage: ${opp.buyFrom} → ${opp.sellTo}`);
      tradeLogger.info(`   Token A: ${opp.tokenA}`);
      tradeLogger.info(`   Token B: ${opp.tokenB}`);
      tradeLogger.info(`   Amount In: ${opp.amountIn}`);
      tradeLogger.info(`   Expected Buy Out: ${opp.buyAmountIn}`);
      tradeLogger.info(`   Expected Sell Out: ${opp.sellAmountOut}`);


      const buyDex = opp.buyDex;   // actual adapter instance
      const sellDex = opp.sellDex; // actual adapter instance

      // Token A To Token B - >  Sell
      // Token B To Token A - > Buy
      const tokenA = opp.tokenA;
      const tokenB = opp.tokenB;
      const amount = opp.amountIn;
      const buyAmountIn = BigInt(opp.buyAmountIn || 0);
      const expectedOutSell = BigInt(opp.sellAmountOut || 0);

      // Check if we have valid values
      if (!tokenA || !tokenB || !amount) {
        tradeLogger.error(`❌ Invalid parameters:`, {
          tokenA,
          tokenB,
          amount: amount?.toString(),
          buyAmountIn: buyAmountIn.toString()
        });
        return { success: false, error: "Invalid parameters" };
      }

      // Check token balances first
      tradeLogger.info(`💰 Checking token balances...`);
      const tokenAContract = new ethers.Contract(tokenA, ERC20_ABI, this.wallet);
      const tokenBContract = new ethers.Contract(tokenB, ERC20_ABI, this.wallet);

      const balanceA = await tokenAContract.balanceOf(this.wallet.address);
      const balanceB = await tokenBContract.balanceOf(this.wallet.address);

      tradeLogger.info(`   Token A balance: ${balanceA.toString()}`);
      tradeLogger.info(`   Token B balance: ${balanceB.toString()}`);
      tradeLogger.info(`   Token A needed: ${amount.toString()}`);
      tradeLogger.info(`   Token B needed: ${buyAmountIn.toString()}`);
      const profit = expectedOutSell - buyAmountIn;
      const profit_slippage = (profit * 50n) / 1000n; // accounting for slippage

      // Check profit percentage threshold
      if (this.minProfitPct > 0) {
        const profitPct = opp.profitPct;
        
        tradeLogger.info('Profit Analysis:',{profit_slippage});
        tradeLogger.info(`💰 Estimated profit: ${profitPct.toFixed(2)}%`);
        
        if (profitPct < this.minProfitPct) {
          const reason = `Profit below threshold. Need: ${this.minProfitPct}%, Got: ${profitPct.toFixed(2)}%`;
          tradeLogger.warn(`⚠️ ${reason}`);
          return { success: false, error: reason, skipped: true };
        }
        
        tradeLogger.info(`✅ Profit threshold met (${profitPct.toFixed(2)}% >= ${this.minProfitPct}%) - proceeding with trade`);
      }

      // if (balanceB < buyAmountIn) {
      //   throw new Error(`Insufficient Token B balance. Have: ${balanceB.toString()}, Need: ${buyAmountIn.toString()}`);
      // }


      //console.log(`🔓 Ensuring multicall can pull XRP (tokenA)...`);
      await this.ensureApproval(tokenA, this.multicallAddress, amount);

      tradeLogger.info(`🛠️ Building transaction data...`);
      const maxInbuy = (buyAmountIn * 1100n) / 1000n; // 0.5% slippage
      const minOutSell = (expectedOutSell * 850n) / 1000n;
      const amounttest = 1000000000000000n; // TestAmounnt

      const sellTxData = await sellDex.tradeSell(
        tokenA,
        tokenB,
        amount,
        minOutSell,
        this.multicallAddress
      );
      const buyTxData = await buyDex.tradeBuy(
        tokenA,
        tokenB,
        amount,
        maxInbuy,
        this.multicallAddress
      );
      // await sellTxData.wait();
      tradeLogger.info(`📦 Buy TX - To: ${buyTxData.to}`);
      tradeLogger.info(`📦 Sell TX - To: ${sellTxData.to}`);

      // Build multicall3 aggregate3 calls
      const erc20Iface = new ethers.Interface(ERC20_ABI);
      const multicallExtraIface = new ethers.Interface([
        "function approveToken(address token, address spender, uint256 amount)",
        "function withdrawToken(address token, uint256 amount)"
      ]);

      const calls = [
        // 1) Pull XRP (tokenA) from our wallet into Multicall via transferFrom
        {
          target: tokenA,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("transferFrom", [
            this.wallet.address,
            this.multicallAddress,
            amount
          ])
        },
        // 2) Approve SELL router to spend XRP from Multicall
        {
          target: tokenA,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("approve", [
            sellDex.routerAddress,
            amount
          ])
        },
        // // 3) Execute SELL swap (XRP -> tokenB) with recipient = Multicall
        {
          target: sellTxData.to,
          allowFailure: false,
          callData: sellTxData.data
        },
        // // 4) Approve BUY router to spend tokenB from Multicall
        {
          target: tokenB,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("approve", [
            buyDex.routerAddress,
            maxInbuy
          ])
        },
        // // 5) Execute BUY swap (tokenB -> XRP) with recipient = Multicall
        {
          target: buyTxData.to,
          allowFailure: false,
          callData: buyTxData.data
        },
        // 6) Transfer XRP from Multicall to wallet using ERC20 transfer
        // Multicall contract will execute this transfer of its own balance
        {
          target: tokenA,
          allowFailure: false,
          callData: erc20Iface.encodeFunctionData("transfer", [
            this.wallet.address,
            amount+profit_slippage // Initial amount +  profit
          ])
        }
      ];

      // Call Multicall aggregate3
      tradeLogger.info(`📡 Sending transactions...`)
      const tx = await this.multicall.aggregate3(calls, {
        gasLimit: 1000000
      });
      tradeLogger.info(`📤 Transaction sent. Hash: ${tx.hash}`);
      
      // Set trading lock immediately after sending transaction
      this.setTradingLock(tx.hash);
      
      const receipt = await tx.wait();

      tradeLogger.info(`✅ Arbitrage completed in block ${receipt.blockNumber}`);
      tradeLogger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
      tradeLogger.info(`   Tx hash: ${receipt.hash}`);

      // Clear trading lock on success
      this.clearTradingLock();

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (err) {
      tradeLogger.error(`❌ Arbitrage failed: ${err.message}`, { stack: err.stack });
      
      // Clear trading lock on failure
      this.clearTradingLock();
      
      return { success: false, error: err.message };
    }
  }
}
