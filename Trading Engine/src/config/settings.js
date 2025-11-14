export default {
  rpc: {
    ethereum: "https://mainnet.infura.io/v3/e5b8e6eb8d9c42c89f88f954d1321ae4",
    bsc: "https://bsc-mainnet.infura.io/v3/e5b8e6eb8d9c42c89f88f954d1321ae4",
  },
  minSpread: 0.3, // %
  amount: 0.001, // USD
  decimals: 18,

  minProfitPct: 10, // Minimum profit percentage to execute trade
  
  // Token addresses on BSC
  tokens: {
    XRP: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
  
  // Trader configuration
  privateKey: process.env.PRIVATE_KEY, // Set your private key in .env file
  autoExecute: true, // Set to true to automatically execute trades (USE WITH CAUTION!)
  multicallAddress: "0xF20FC6628058876843Dbdb91a28824a0ac719a55",
  txTimeout: 60000, // Transaction timeout in milliseconds
  
  uniswap: {
    factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
  },
  pools: {
    weth_usdc: "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  },
  pancake: {
    factory: "0xBCfCcbde45cE874adCB698cC183deBcF17952812",
  },
  uniswap_pair: [
    {
      address: "0x0aDaF134Ae0c4583b3A38fc3168A83e33162651E",
      token0: "XRP",
      token1: "USDT",
      dex_version: "V3",
      router_address: "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2"
    }
  ],
  pancakeswap_pair: [{

    address: "0x3D15D4Fbe8a6ECd3AAdcfb2Db9DD8656c60Fb25c",
    token0: "XRP",
    token1: "USDT",
    dex_version: "V2",
    router_address: "0x10ED43C718714eb63d5aA57B78B54704E256024E"
  }]
};
