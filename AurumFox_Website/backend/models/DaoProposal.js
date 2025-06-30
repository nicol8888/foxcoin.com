// backend/models/DaoProposal.js
const mongoose = require('mongoose');

const daoProposalSchema = new mongoose.Schema({
    // Title of the DAO proposal.
    title: {
        type: String,
        required: [true, 'Proposal title is required.'], // Custom error message for clarity
        trim: true, // Removes leading/trailing whitespace
        minlength: [5, 'Proposal title must be at least 5 characters long.'], // Minimum length for meaningful titles
        maxlength: [200, 'Proposal title cannot exceed 200 characters.'] // Maximum length to prevent excessively long titles
    },
    // Detailed description of the DAO proposal.
    description: {
        type: String,
        required: [true, 'Proposal description is required.'], // Custom error message
        trim: true,
        minlength: [20, 'Proposal description must be at least 20 characters long.'], // Minimum length for detailed descriptions
        maxlength: [5000, 'Proposal description cannot exceed 5000 characters.'] // Generous maximum length for comprehensive proposals
    },
    // The wallet address of the proposal's creator. This should be a Solana public key.
    creatorWallet: {
        type: String,
        required: [true, 'Creator wallet address is required.'], // Custom error message
        trim: true,
        // Basic format validation for a Solana public key (base58 encoded).
        // Actual authentication (e.g., signature verification) should happen in the route/service layer.
        validate: {
            validator: function(v) {
                // Regex checks for typical length and characters of a base58 encoded Solana public key.
                return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
            },
            message: props => `${props.value} is not a valid Solana wallet address format for the creator!` // Custom validation error message
        }
    },
    // Count of 'for' votes received.
    votesFor: {
        type: Number,
        default: 0, // Defaults to zero
        min: [0, 'Votes for cannot be negative.'] // Ensures the count is non-negative
    },
    // Count of 'against' votes received.
    votesAgainst: {
        type: Number,
        default: 0, // Defaults to zero
        min: [0, 'Votes against cannot be negative.'] // Ensures the count is non-negative
    },
    // An array of wallet addresses that have already voted on this proposal.
    // This helps in preventing duplicate votes from the same wallet.
    voters: {
        type: [String], // An array where each element is a string (wallet address)
        default: [], // Defaults to an empty array
        validate: {
            validator: function(votersArray) {
                // If the array is empty or null, it's valid (no voters yet).
                if (!votersArray || votersArray.length === 0) return true;
                // Otherwise, validate that every wallet address in the array conforms to the Solana format.
                return votersArray.every(wallet => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet));
            },
            message: 'One or more wallet addresses in the voters list are not in a valid Solana address format.' // Custom error message for array validation
        }
    },
    // The date and time when the voting period for the proposal ends.
    expiresAt: {
        type: Date,
        required: [true, 'The expiration date for the proposal is required.'], // Must be provided
        validate: {
            validator: function(value) {
                // When creating a new proposal, the expiration date must be in the future.
                // This check applies specifically at the time of document creation/validation.
                return value > Date.now();
            },
            message: props => `The expiration date (${props.value}) must be in the future for an active proposal.` // Custom validation error message
        }
    },
    // The current status of the proposal, restricting it to predefined values.
    status: {
        type: String,
        enum: {
            values: ['active', 'completed'], // Only 'active' or 'completed' are allowed statuses
            message: 'Proposal status must be either "active" or "completed".' // Custom error message for invalid enum value
        },
        default: 'active' // New proposals default to 'active'
    }
}, {
    // Schema options:
    // `timestamps: true` automatically adds `createdAt` and `updatedAt` fields to your documents.
    // `createdAt` stores the timestamp when the document was first created.
    // `updatedAt` stores the timestamp of the last update to the document.
    // This is a standard and highly recommended practice for tracking document lifecycle.
    timestamps: true
});

module.exports = mongoose.model('DaoProposal', daoProposalSchema);
