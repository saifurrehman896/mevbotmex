import { network } from "hardhat";
import fs from "fs";

async function main() {
    const { ethers } = await network.connect();
    console.log("Starting token withdrawal...");

    // The contract address where you sent the USDT
    const multicallAddress = "0x8B6B008A0073D34D04ff00210E7200Ab00003300";

    // Get the deployer's address
    const [deployer] = await ethers.getSigners();
    console.log(`Withdrawing with account: ${deployer.address}`);

    // USDT on BSC
    const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

    // Get contract instance
    const multicall = await ethers.getContractAt("Multicall3", multicallAddress);

    // Check USDT balance
    const usdtAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const usdt = new ethers.Contract(USDT_ADDRESS, usdtAbi, deployer);
    
    const balance = await usdt.balanceOf(multicallAddress);
    const decimals = await usdt.decimals();
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    
    console.log(`\nContract USDT balance: ${balanceFormatted} USDT`);

    if (balance === 0n) {
        console.log("No USDT to withdraw.");
        return;
    }

    // Withdraw all USDT (passing 0 withdraws all)
    console.log("\nWithdrawing USDT...");
    const tx = await multicall.withdrawToken(USDT_ADDRESS, 0);
    console.log(`Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt not found");
    console.log(`✅ Withdrawal successful! Gas used: ${receipt.gasUsed.toString()}`);
    
    // Check new balance
    const newBalance = await usdt.balanceOf(multicallAddress);
    const newBalanceFormatted = ethers.formatUnits(newBalance, decimals);
    console.log(`Remaining contract balance: ${newBalanceFormatted} USDT`);
    
    // Check owner balance
    const ownerBalance = await usdt.balanceOf(deployer.address);
    const ownerBalanceFormatted = ethers.formatUnits(ownerBalance, decimals);
    console.log(`Your wallet balance: ${ownerBalanceFormatted} USDT`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
