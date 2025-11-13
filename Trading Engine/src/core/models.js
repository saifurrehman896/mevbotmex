export class PoolData {
  constructor({ protocol, chain, token0, token1, token0Address, token1Address, reserve0, reserve1, price, amountIn, amountOut }) {
    this.protocol = protocol;
    this.chain = chain;
    this.token0 = token0; // Symbol like "XRP"
    this.token1 = token1; // Symbol like "USDC"
    this.token0Address = token0Address; // Actual contract address
    this.token1Address = token1Address; // Actual contract address
    this.reserve0 = reserve0;
    this.reserve1 = reserve1;
    this.amountIn = amountIn;
    this.amountOut = amountOut;
    this.price = price; // token1 per token0
  }
}

export class Opportunity {
  constructor({ buyFrom, sellTo, tokenPair, profitPct, amountIn, amountAfterBuy, amountBack, tokenA, tokenB, buyAmountIn, sellAmountOut, buyDex, sellDex }) {
    this.buyFrom = buyFrom;
    this.sellTo = sellTo;
    this.tokenPair = tokenPair;
    this.profitPct = profitPct;
    this.timestamp = Date.now();
    
    // Trade amounts
    this.amountIn = amountIn;
    this.amountAfterBuy = amountAfterBuy;
    this.amountBack = amountBack;
    
    // Token addresses
    this.tokenA = tokenA;
    this.tokenB = tokenB;
    
    // Expected outputs for slippage calculation
    this.buyAmountIn = buyAmountIn;
    this.sellAmountOut = sellAmountOut;
    
    // Protocol adapter instances
    this.buyDex = buyDex;
    this.sellDex = sellDex;
  }
}
