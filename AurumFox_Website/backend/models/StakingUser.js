// backend/models/StakingUser.js
const mongoose = require('mongoose');

const stakingUserSchema = new mongoose.Schema({
    // Unique identifier for the user's wallet address
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        trim: true // Added to remove whitespace from the wallet address edges
    },
    // The total amount of tokens currently staked by the user
    stakedAmount: {
        type: Number,
        default: 0,
        min: 0 // Ensures the staked amount will never be negative
    },
    // Accumulated rewards that the user has not yet claimed
    rewards: {
        type: Number,
        default: 0,
        min: 0 // Ensures rewards will never be negative
    },
    // Timestamp of the last time the user claimed their rewards
    lastClaimed: {
        type: Date,
        default: Date.now
    },
    // Timestamp of the last staking or unstaking action,
    // which is critically important for reward calculation
    lastStakedOrUnstaked: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically adds `createdAt` and `updatedAt` fields
});

module.exports = mongoose.model('StakingUser', stakingUserSchema);
