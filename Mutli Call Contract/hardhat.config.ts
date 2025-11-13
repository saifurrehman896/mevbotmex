import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import dotenv from "dotenv";

// Load .env variables (for BSC_PRIVATE_KEY, BSCSCAN_API_KEY, etc.)
dotenv.config();
import hardhatVerify from "@nomicfoundation/hardhat-verify";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin,hardhatVerify],
  solidity: {
    profiles: {
      default: {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    bsc: {
      type: "http",
      chainType: "l1",
      url: "https://bsc-dataseed1.binance.org",
      accounts: configVariable("BSC_PRIVATE_KEY") ? [configVariable("BSC_PRIVATE_KEY")] : [],
      chainId: 56,
    },
  },
  verify: {
    etherscan: {
      apiKey: (configVariable("BSCSCAN_API_KEY") as unknown) as string,
    },
  },
});
