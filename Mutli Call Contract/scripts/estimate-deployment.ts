import { network } from "hardhat";
import axios from "axios";

const { ethers } = await network.connect();

async function estimateDeploymentCost() {
    // Get contract factories
    const Multicall3Factory = await ethers.getContractFactory("Multicall3");
    const CounterFactory = await ethers.getContractFactory("Counter");
    
    // Get contract creation bytecode
    const multicallBytecode = Multicall3Factory.bytecode;
    const counterBytecode = CounterFactory.bytecode;
    
    // Estimate gas for deployment
    const multicallGas = await ethers.provider.estimateGas({
        data: multicallBytecode
    });
    
    const counterGas = await ethers.provider.estimateGas({
        data: counterBytecode
    });
    
    // Use fixed gas price of 0.05 Gwei
    const gasPrice = ethers.parseUnits("0.05", "gwei");
    
    // Calculate costs in BNB
    const multicallCostWei = multicallGas * gasPrice;
    const counterCostWei = counterGas * gasPrice;
    
    const totalCostWei = multicallCostWei + counterCostWei;
    
    // Convert to BNB (1 BNB = 10^18 wei)
    const multicallCostBNB = Number(multicallCostWei) / 1e18;
    const counterCostBNB = Number(counterCostWei) / 1e18;
    const totalCostBNB = Number(totalCostWei) / 1e18;
    
    // Get current BNB price in USD
    const bnbPriceResponse = await axios.get<{symbol: string, price: string}>('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
    const bnbPrice = parseFloat(bnbPriceResponse.data.price);
    
    console.log("\nDeployment Cost Estimation on BSC:");
    console.log("--------------------------------");
    console.log(`Multicall3 Contract:`);
    console.log(`- Gas Required: ${multicallGas.toString()} units`);
    console.log(`- Cost in BNB: ${multicallCostBNB.toFixed(6)} BNB`);
    console.log(`- Cost in USD: $${(multicallCostBNB * bnbPrice).toFixed(2)}`);
    console.log("\nCounter Contract:");
    console.log(`- Gas Required: ${counterGas.toString()} units`);
    console.log(`- Cost in BNB: ${counterCostBNB.toFixed(6)} BNB`);
    console.log(`- Cost in USD: $${(counterCostBNB * bnbPrice).toFixed(2)}`);
    console.log("\nTotal Deployment Cost:");
    console.log(`- Total BNB: ${totalCostBNB.toFixed(6)} BNB`);
    console.log(`- Total USD: $${(totalCostBNB * bnbPrice).toFixed(2)}`);
}

// Run the estimation
estimateDeploymentCost()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });