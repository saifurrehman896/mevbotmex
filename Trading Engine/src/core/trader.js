import { ethers } from "ethers";
import ERC20_ABI from "../abis/erc20-abi.json" with { type: "json" };

// Minimal Multicall3 ABI for aggregate3 function
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];

export default class Trader {
  constructor(privateKey, provider, multicallAddress = "0xf6737001144C05fe5B8CA8f05323102dc70F0143") {
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.multicallAddress = multicallAddress; // Multicall3 address (same on most chains)
    this.multicall = new ethers.Contract(multicallAddress, MULTICALL3_ABI, this.wallet);
  }

  async ensureApproval(token, spender, amount) {
    const contract = new ethers.Contract(token, ERC20_ABI, this.wallet);
    const allowance = await contract.allowance(this.wallet.address, spender);

    if (allowance < BigInt(amount)) {
      console.log(`🔏 Approving ${spender} to spend your tokens...`);
      const tx = await contract.approve(spender, ethers.MaxUint256);
      await tx.wait();
      console.log(`✅ Approval confirmed`);
    }
  }

  async execute(opp) {
    try {
      console.log(`\n🚀 Executing arbitrage: ${opp.buyFrom} → ${opp.sellTo}`);
      console.log(`   Token A: ${opp.tokenA}`);
      console.log(`   Token B: ${opp.tokenB}`);
      console.log(`   Amount In: ${opp.amountIn}`);
      console.log(`   Expected Buy Out: ${opp.buyAmountIn}`);
      console.log(`   Expected Sell Out: ${opp.sellAmountOut}`);


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
        console.error(`❌ Invalid parameters:`, {
          tokenA,
          tokenB,
          amount: amount?.toString(),
          buyAmountIn: buyAmountIn.toString()
        });
        return { success: false, error: "Invalid parameters" };
      }

      // Check token balances first
      console.log(`💰 Checking token balances...`);
      const tokenAContract = new ethers.Contract(tokenA, ERC20_ABI, this.wallet);
      const tokenBContract = new ethers.Contract(tokenB, ERC20_ABI, this.wallet);
      
      const balanceA = await tokenAContract.balanceOf(this.wallet.address);
      const balanceB = await tokenBContract.balanceOf(this.wallet.address);
      
      console.log(`   Token A balance: ${balanceA.toString()}`);
      console.log(`   Token B balance: ${balanceB.toString()}`);
      console.log(`   Token A needed: ${amount.toString()}`);
      console.log(`   Token B needed: ${buyAmountIn.toString()}`);
      
      // if (balanceA < BigInt(amount)) {
      //   throw new Error(`Insufficient Token A balance. Have: ${balanceA.toString()}, Need: ${amount.toString()}`);
      // }
      
      // if (balanceB < buyAmountIn) {
      //   throw new Error(`Insufficient Token B balance. Have: ${balanceB.toString()}, Need: ${buyAmountIn.toString()}`);
      // }


  //console.log(`🔓 Ensuring multicall can pull XRP (tokenA)...`);
 // await this.ensureApproval(tokenA, this.multicallAddress, amount);

      console.log(`� Building transaction data...`);
      const maxInbuy = (buyAmountIn * 1100n) / 1000n; // 0.5% slippage
      const minOutSell = (expectedOutSell * 850n) / 1000n;
      const amounttest = 1000000000000000n; // TestAmounnt
       const buyTxData = await buyDex.tradeBuy(
         tokenA,
         tokenB,
         amount,
         maxInbuy,
         this.multicallAddress
       );
       const sellTxData = await sellDex.tradeSell(
         tokenA,
         tokenB,
         amount,
         minOutSell,
         this.multicallAddress
       );
      // await sellTxData.wait();
       console.log(`📦 Buy TX - To: ${buyTxData.to}`);
       console.log(`� Sell TX - To: ${sellTxData.to}`);

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
             amount // Initial amount + expected profit
           ])
         }
      ];
      
// Call Multicall aggregate3
      console.log(`📡 Sending transactions...`)
      const tx = await this.multicall.aggregate3(calls, {
        gasLimit: 1000000
      });
      console.log(`� Transaction sent. Hash: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Arbitrage completed in block ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   Tx hash: ${receipt.hash}`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (err) {
      console.error("❌ Arbitrage failed:", err.message);
      console.error("Stack:", err.stack);
      return { success: false, error: err.message };
    }
  }
}
