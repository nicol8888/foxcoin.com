// backend/routes/staking.js
const express = require('express');
const router = express.Router();
const StakingUser = require('../models/StakingUser');

const STAKING_APR = 0.10; // 10% annual percentage rate (0.10)

// Function to calculate rewards (server-side calculation)
function calculateRewards(stakedAmount, lastStakedOrUnstakedDate) {
    const now = Date.now();
    const lastDate = lastStakedOrUnstakedDate.getTime();
    const timeDiffHours = (now - lastDate) / (1000 * 60 * 60);
    const dailyRate = STAKING_APR / 365;
    const accruedRewards = stakedAmount * dailyRate * (timeDiffHours / 24); // Divide by 24 for daily rate

    return accruedRewards;
}

// Get user staking data
router.get('/:walletAddress', async (req, res) => {
    try {
        const user = await StakingUser.findOne({ walletAddress: req.params.walletAddress });
        if (user) {
            // Calculate current rewards with each request
            const currentRewards = user.rewards + calculateRewards(user.stakedAmount, user.lastStakedOrUnstaked);
            res.json({
                stakedAmount: user.stakedAmount,
                rewards: currentRewards,
                lastClaimed: user.lastClaimed,
                lastStakedOrUnstaked: user.lastStakedOrUnstaked
            });
        } else {
            res.json({ stakedAmount: 0, rewards: 0, lastClaimed: null, lastStakedOrUnstaked: null });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Stake AFOX
router.post('/stake', async (req, res) => {
    const { walletAddress, amount } = req.body;
    if (!walletAddress || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Wallet address and staking amount are required and must be positive.' });
    }

    try {
        let user = await StakingUser.findOne({ walletAddress });

        if (!user) {
            user = new StakingUser({ walletAddress });
        } else {
            // If the user already has a stake, add accrued rewards to their current reward balance
            // before updating stakedAmount (to avoid losing rewards from the previous period)
            user.rewards += calculateRewards(user.stakedAmount, user.lastStakedOrUnstaked);
        }

        user.stakedAmount += amount;
        user.lastStakedOrUnstaked = Date.now(); // Update the time of the last action for reward calculation

        await user.save();
        res.json({ message: 'Staking successful.', user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Claim rewards
router.post('/claim-rewards', async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required.' });
    }

    try {
        const user = await StakingUser.findOne({ walletAddress });
        if (!user) {
            return res.status(404).json({ message: 'Staking user not found.' });
        }

        const currentRewards = user.rewards + calculateRewards(user.stakedAmount, user.lastStakedOrUnstaked);

        if (currentRewards <= 0) {
            return res.status(400).json({ message: 'No rewards to claim.' });
        }

        // In a real dApp, there should be a smart contract call here to transfer AFOX to the user
        // For simulation, we just reset rewards on the backend
        user.rewards = 0;
        user.lastClaimed = Date.now();
        user.lastStakedOrUnstaked = Date.now(); // Update as rewards have been claimed

        await user.save();
        res.json({ message: `Successfully claimed ${currentRewards.toFixed(2)} AFOX rewards.`, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Unstake
router.post('/unstake', async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ message: 'Wallet address is required.' });
    }

    try {
        const user = await StakingUser.findOne({ walletAddress });
        if (!user) {
            return res.status(404).json({ message: 'Staking user not found.' });
        }
        if (user.stakedAmount <= 0) {
            return res.status(400).json({ message: 'You have no AFOX staked.' });
        }

        // Add all accrued rewards to the current reward balance before resetting
        user.rewards += calculateRewards(user.stakedAmount, user.lastStakedOrUnstaked);
        const totalUnstakedAmount = user.stakedAmount + user.rewards; // Return both stake and rewards

        // In a real dApp, there should be a smart contract call here to return AFOX to the user
        // For simulation, we just reset stake and rewards on the backend
        user.stakedAmount = 0;
        user.rewards = 0; // Rewards are reset upon unstaking
        user.lastStakedOrUnstaked = Date.now(); // Update time
        user.lastClaimed = Date.now();

        await user.save();
        res.json({ message: `Successfully unstaked ${totalUnstakedAmount.toFixed(2)} AFOX.`, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
