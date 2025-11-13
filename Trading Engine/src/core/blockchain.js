import { JsonRpcProvider } from "ethers";
import settings from "../config/settings.js";

const providers = {};
for (const [chain, rpc] of Object.entries(settings.rpc)) {
  const provider = new JsonRpcProvider(rpc, undefined, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
  
  // Override getTransactionCount to use 'latest' instead of 'pending' for BSC/Infura
  const originalGetTransactionCount = provider.getTransactionCount.bind(provider);
  provider.getTransactionCount = async function(address, blockTag) {
    // Replace 'pending' with 'latest' for compatibility
    if (blockTag === 'pending') {
      blockTag = 'latest';
    }
    return originalGetTransactionCount(address, blockTag);
  };
  
  providers[chain] = provider;
}

export function getProvider(chain = "ethereum") {
  return providers[chain];
}
