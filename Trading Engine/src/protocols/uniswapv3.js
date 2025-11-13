import BaseProtocol from "./baseProtocol.js";
import { getProvider } from "../core/blockchain.js";
import { PoolData } from "../core/models.js";
import QUOTER_V3_ABI from "../abis/quoter_v3.json" with { type: "json" };
import { Contract } from "ethers";
import { ethers } from "ethers";
import settings from "../config/settings.js";
import logger from "../utils/logger.js";

export default class UniswapV3Adapter extends BaseProtocol {

    constructor(chain = "ethereum", quoterAddress, pairs, wallet = null) {
        super("UniswapV3", chain);
        this.quoterAddress = "0x78D78E420Da98ad378D7799bE8f4AF69033EB077";
        this.pairs = pairs || [];
        this.provider = getProvider(chain);
        this.quoter = new Contract(this.quoterAddress, QUOTER_V3_ABI, this.provider);
        this.routerAddress = pairs[0]?.router_address || "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2";
        this.wallet = wallet;

        const routerContract = new ethers.Contract(this.routerAddress, [{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}],"internalType":"struct IV3SwapRouter.ExactInputParams","name":"params","type":"tuple"}],"name":"exactInput","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"bytes","name":"path","type":"bytes"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amountOut","type":"uint256"},{"internalType":"uint256","name":"amountInMaximum","type":"uint256"}],"internalType":"struct IV3SwapRouter.ExactOutputParams","name":"params","type":"tuple"}],"name":"exactOutput","outputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"}],"stateMutability":"payable","type":"function"}], this.provider);

        // Connect to wallet if provided
        this.routerV3 = wallet ? routerContract.connect(wallet) : routerContract;
    }

    async getPools() {
        const pools = [];

        for (const pair of this.pairs) {
            // only handle V3 pools
            if (pair.dex_version && pair.dex_version !== "V3") continue;

            const poolAddress = pair.address;

            try {

            const amount = BigInt(Math.floor(settings.amount * 1e18)); // Convert decimal to wei (18 decimals)
                const fee = pair.fee || 3000;
                const paramsIn = {
                    tokenIn: settings.tokens[pair.token0] || pair.token0,
                    tokenOut: settings.tokens[pair.token1] || pair.token1,
                    amountIn: amount,
                    fee: fee,
                    sqrtPriceLimitX96: 0,
                };
                const paramsOut = {
                    tokenIn: settings.tokens[pair.token1] || pair.token1,
                    tokenOut: settings.tokens[pair.token0] || pair.token0,
                    amount: amount,
                    fee: fee,
                    sqrtPriceLimitX96: 0,
                };

                let amountOut = 0n;
                let amountIn = 0n;

                try {
                    const result = await this.quoter.quoteExactInputSingle.staticCall(paramsIn);
                    amountOut = result[0];
                    const result2 = await this.quoter.quoteExactOutputSingle.staticCall(paramsOut);
                    amountIn = result2[0];
                    logger.info(`Quoted amounts for pool ${poolAddress}: amountOut=${amountOut}, amountIn=${amountIn}`);

                } catch (qerr) {
                    // Quoter can revert for some pools; log and continue
                    logger.error(`Quoter failed for pool ${poolAddress}: ${qerr.message || qerr}`);
                }
                pools.push(
                    new PoolData({
                        protocol: this.name,
                        chain: this.chain,
                        token0: pair.token0,
                        token1: pair.token1,
                        token0Address: settings.tokens[pair.token0] || pair.token0,
                        token1Address: settings.tokens[pair.token1] || pair.token1,
                        // V3 doesn't expose simple reserves; include liquidity in reserve0 as a hint and leave reserve1 empty
                        reserve0: "0",
                        reserve1: "0",
                        price: 0,
                        amountIn: amountIn,
                        amountOut: amountOut,
                    })
                );
            } catch (err) {
                logger.error(`Error processing V3 pool ${pair.address}: ${err.message || err}`);
            }
        }

        return pools;
    }
    encodePath(tokens, fees) {
        const FEE_SIZE = 3; // uint24
        const ADDRESS_SIZE = 20;

        let path = "0x";
        for (let i = 0; i < tokens.length; i++) {
            path += tokens[i].slice(2); // remove 0x
            if (i < fees.length) {
                const feeHex = fees[i].toString(16).padStart(FEE_SIZE * 2, "0");
                path += feeHex;
            }
        }
        return path.toLowerCase();
    }

    async tradeBuy(tokenA,tokenB, amountOut , amountIn, recipient) {
        // Get fee from pair config, default to 3000 (0.3%)
        const fee = this.pairs[0]?.fee || 3000;
        // Token A To Token B - >  Sell
        // Token B To Token A - > Buy
        const tokens = [tokenA,tokenB];

        const fees = [fee];
        
        const encodedPath = this.encodePath(tokens, fees);

        const params = {
            path: encodedPath,
            recipient,
            amountOut: amountOut,
            amountInMaximum: amountIn,
            
        };

        // For testing: send transaction directly
        return await this.routerV3.exactOutput.populateTransaction(params, {
            gasLimit: 500000
        });
    }

    async tradeSell(tokenA,tokenB, amountIn, minOut, recipient) {
        const fee = this.pairs[0]?.fee || 3000;

            // Token A To Token B - >  Sell
            // Token B To Token A - > Buy
        const tokens = [tokenA, tokenB];
        tokens.reverse();
        fees.reverse();
        const fees = [fee];
        const encodedPath = this.encodePath(tokens, fees);

        const params = {
            path: encodedPath,
            recipient,
            amountIn,
            amountOutMinimum: minOut,
        };

        // For testing: send transaction directly
        return await this.routerV3.exactInput.populateTransaction(params, {
            gasLimit: 500000
        });
    }
}
