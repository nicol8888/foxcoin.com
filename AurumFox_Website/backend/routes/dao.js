// backend/routes/dao.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Needed for mongoose.Types.ObjectId.isValid
const DaoProposal = require('../models/DaoProposal');
const { PublicKey } = require('@solana/web3.js'); // For Solana public key validation

// --- External Utility for Web3 Signature Verification (CRITICAL) ---

// IMPORTANT: You MUST create this file and implement the verifySignature function.
// This function cryptographically verifies that a message was signed by a given wallet's private key.
//
// Example backend/utils/solanaUtils.js content:
/*
    const { PublicKey } = require('@solana/web3.js');
    const bs58 = require('bs58'); // You might need to 'npm install bs58'
    const nacl = require('tweetnacl'); // You might need to 'npm install tweetnacl'

    async function verifySignature(publicKeyString, message, signatureString) {
        try {
            const publicKey = new PublicKey(publicKeyString);
            const signature = bs58.decode(signatureString); // Decode base58 signature
            const messageBytes = new TextEncoder().encode(message); // Encode message to bytes (match frontend encoding)

            // Use nacl.sign.detached.verify for Ed25519 signature verification (Solana uses Ed25519)
            const isVerified = nacl.sign.detached.verify(
                messageBytes,
                signature,
                publicKey.toBytes()
            );
            return isVerified;
        } catch (error) {
            console.error('Error during signature verification:', error);
            // In a production environment, you might differentiate between malformed inputs and actual verification failures.
            return false;
        }
    }
    module.exports = { verifySignature };
*/
// Uncomment the line below once you have created and implemented the `verifySignature` utility:
// const { verifySignature } = require('../utils/solanaUtils');


// --- Route: Get All DAO Proposals ---
// Fetches all DAO proposals from the database, sorted by their creation date (newest first).
router.get('/proposals', async (req, res) => {
    try {
        // Use 'createdAt' for sorting, which is automatically added by Mongoose's `timestamps: true`
        const proposals = await DaoProposal.find().sort({ createdAt: -1 });
        res.json({
            message: 'Successfully retrieved all DAO proposals.',
            proposals: proposals
        });
    } catch (error) {
        console.error('Error fetching DAO proposals:', error); // Log the detailed error for server-side debugging
        // Provide a generic, user-friendly error message to the client
        res.status(500).json({ message: 'Failed to retrieve DAO proposals. An unexpected server error occurred.' });
    }
});


// --- Route: Create a New DAO Proposal ---
// Allows a user to submit a new DAO proposal.
// Requires: 'title', 'description', 'creatorWallet', and a 'signature' for authentication.
router.post('/proposals', async (req, res) => {
    const { title, description, creatorWallet, signature } = req.body;

    // 1. Basic Input Validation: Quickly check for presence of required fields.
    if (!title || !description || !creatorWallet) {
        return res.status(400).json({ message: 'Request missing required fields: title, description, and creator wallet address.' });
    }

    // 2. Validate Solana Public Key Format for 'creatorWallet'.
    // This ensures the provided wallet string is syntactically correct for Solana.
    try {
        new PublicKey(creatorWallet); // This constructor throws an error if the string is not a valid Public Key format.
    } catch (pkError) {
        console.error('Invalid Solana creator wallet address format:', pkError.message);
        return res.status(400).json({ message: 'The provided creator wallet address is not a valid Solana public key format.' });
    }

    // 3. Web3 Security: Verify Creator Wallet Signature (CRITICAL FOR AUTHENTICITY)
    // This step is vital. It verifies that the request to create a proposal was indeed signed by the 'creatorWallet',
    // preventing unauthorized users from creating proposals under someone else's identity.
    /*
    // Uncomment this entire block after implementing verifySignature utility
    if (!signature) {
        return res.status(401).json({ message: 'Authentication required: Missing wallet signature for proposal creation.' });
    }

    // The message signed by the frontend must EXACTLY match this message string.
    // Consider using a unique nonce from the backend for each request to prevent replay attacks in production.
    const messageToVerify = JSON.stringify({ title, description, creatorWallet }); // Example: signing the core data of the proposal
    try {
        const isSignatureValid = await verifySignature(creatorWallet, messageToVerify, signature);
        if (!isSignatureValid) {
            console.warn(`Signature verification failed for creator wallet: ${creatorWallet}. Request might be spoofed.`);
            return res.status(403).json({ message: 'Authentication failed: Invalid wallet signature provided by creator.' });
        }
    } catch (sigError) {
        console.error('Server error during creator signature verification:', sigError);
        return res.status(500).json({ message: 'Internal server error while verifying creator signature. Please try again later.' });
    }
    */

    // Define proposal expiration (e.g., 7 days from the current time).
    // You might also allow the client to specify a `durationInDays` for more flexibility.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create a new DAO Proposal document instance.
    const newProposal = new DaoProposal({
        title,
        description,
        creatorWallet,
        expiresAt,
        status: 'active', // Initialize proposal status as 'active'
        votesFor: 0,
        votesAgainst: 0,
        voters: [] // Initialize an empty array to track unique voters
    });

    // Save the new proposal to the database.
    try {
        const savedProposal = await newProposal.save();
        res.status(201).json({
            message: 'DAO proposal successfully created and saved!',
            proposal: savedProposal // Return the newly created proposal object
        });
    } catch (error) {
        // Handle Mongoose validation errors (e.g., minlength, maxlength constraints from schema).
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.warn('Mongoose validation failed for new DAO proposal:', errors);
            return res.status(400).json({ message: 'Validation failed for proposal data.', errors });
        }
        // Handle other unexpected errors during the save operation.
        console.error('Error saving new DAO proposal to database:', error);
        res.status(500).json({ message: 'Failed to create DAO proposal due to an unexpected server error. Please check your input and try again.' });
    }
});


// --- Route: Vote on a Proposal ---
// Allows a user to cast a vote ('for' or 'against') on an active DAO proposal.
// Requires: 'proposalId', 'voteType', 'voterWallet', and a 'signature' for authentication.
router.post('/vote', async (req, res) => {
    const { proposalId, voteType, voterWallet, signature } = req.body;

    // 1. Basic Input Validation: Ensure all necessary fields are present.
    if (!proposalId || !voteType || !voterWallet) {
        return res.status(400).json({ message: 'Request missing required fields: proposal ID, vote type, and voter wallet address.' });
    }

    // 2. Validate 'proposalId' format: Ensure it's a valid MongoDB ObjectId.
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
        return res.status(400).json({ message: 'Invalid Proposal ID format provided.' });
    }

    // 3. Validate Solana Public Key Format for 'voterWallet'.
    try {
        new PublicKey(voterWallet);
    } catch (pkError) {
        console.error('Invalid Solana voter wallet address format:', pkError.message);
        return res.status(400).json({ message: 'The provided voter wallet address is not a valid Solana public key format.' });
    }

    // 4. Validate 'voteType': Must be either 'for' or 'against'.
    if (!['for', 'against'].includes(voteType)) {
        return res.status(400).json({ message: 'Invalid vote type. Please use "for" or "against".' });
    }

    // 5. Web3 Security: Verify Voter Wallet Signature (CRITICAL FOR AUTHENTICITY)
    // This step ensures that the vote truly originates from the 'voterWallet', preventing fraudulent votes.
    /*
    // Uncomment this entire block after implementing verifySignature utility
    if (!signature) {
        return res.status(401).json({ message: 'Authentication required: Missing wallet signature for voting.' });
    }

    // The message signed by the frontend for this vote must EXACTLY match this message string.
    const messageToVerify = JSON.stringify({ proposalId, voteType, voterWallet }); // Example: signing the specific vote data
    try {
        const isSignatureValid = await verifySignature(voterWallet, messageToVerify, signature);
        if (!isSignatureValid) {
            console.warn(`Signature verification failed for voter wallet: ${voterWallet}. Vote might be unauthorized.`);
            return res.status(403).json({ message: 'Authentication failed: Invalid wallet signature provided by voter.' });
        }
    } catch (sigError) {
        console.error('Server error during voter signature verification:', sigError);
        return res.status(500).json({ message: 'Internal server error while verifying voter signature. Please try again later.' });
    }
    */

    try {
        const proposal = await DaoProposal.findById(proposalId);

        // Check if the proposal exists.
        if (!proposal) {
            return res.status(404).json({ message: 'DAO Proposal not found with the provided ID.' });
        }

        // Check if the proposal has expired. If so, update its status if not already 'completed'.
        if (new Date() >= proposal.expiresAt) {
            if (proposal.status === 'active') {
                proposal.status = 'completed'; // Update status to 'completed'
                await proposal.save(); // Save the status change
            }
            return res.status(400).json({ message: 'Voting for this proposal has already ended.' });
        }

        // Check if the voter has already cast a vote on this specific proposal.
        if (proposal.voters.includes(voterWallet)) {
            return res.status(409).json({ message: 'You have already cast a vote on this proposal. Each wallet can vote only once.' });
        }

        // Record the vote based on 'voteType'.
        if (voteType === 'for') {
            proposal.votesFor += 1;
        } else { // 'voteType' is 'against' due to prior validation
            proposal.votesAgainst += 1;
        }

        // Add the voter's wallet to the list of those who have voted.
        proposal.voters.push(voterWallet);
        await proposal.save(); // Save the updated proposal with the new vote and voter.

        res.json({
            message: 'Your vote has been successfully cast!',
            proposal: proposal // Return the updated proposal details
        });
    } catch (error) {
        console.error('Error processing vote for DAO proposal:', error); // Log the detailed error
        res.status(500).json({ message: 'Failed to cast vote due to an unexpected server error. Please try again later.' });
    }
});

module.exports = router;
