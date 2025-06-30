// backend/routes/announcements.js
const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { PublicKey } = require('@solana/web3.js'); // Required for Solana public key format validation

// --- External Utilities and Configuration (IMPORTANT: You need to set these up) ---

// 1. Solana Utility for Signature Verification:
//    You MUST create this file (e.g., backend/utils/solanaUtils.js)
//    Example content for backend/utils/solanaUtils.js:
/*
    const { PublicKey } = require('@solana/web3.js');
    const bs58 = require('bs58');
    const nacl = require('tweetnacl'); // For Ed25519 verification

    async function verifySignature(publicKeyString, message, signatureString) {
        try {
            const publicKey = new PublicKey(publicKeyString);
            const signature = bs58.decode(signatureString);
            const messageBytes = new TextEncoder().encode(message); // Ensure message encoding matches frontend

            // Perform cryptographic verification using nacl (Ed25519 for Solana)
            const isVerified = nacl.sign.detached.verify(
                messageBytes,
                signature,
                publicKey.toBytes()
            );
            return isVerified;
        } catch (error) {
            console.error('Error during signature verification:', error);
            // In production, handle specific errors (e.g., malformed signature)
            return false;
        }
    }
    module.exports = { verifySignature };
*/
// Uncomment the line below once you have created and implemented the utility:
// const { verifySignature } = require('../utils/solanaUtils');

// 2. Admin Wallets Configuration:
//    This should be loaded securely, ideally from environment variables.
//    In your .env, you'd have something like: ADMIN_WALLETS=address1,address2,address3
//    Then, in your main app.js or a config file, you'd load it:
//    const ADMIN_WALLETS_ENV = process.env.ADMIN_WALLETS;
//    const AUTHORIZED_ADMIN_WALLETS = ADMIN_WALLETS_ENV ? ADMIN_WALLETS_ENV.split(',') : [];
const AUTHORIZED_ADMIN_WALLETS = [
    "YOUR_ADMIN_SOLANA_WALLET_ADDRESS_1", // <<--- REPLACE WITH REAL ADMIN WALLET ADDRESSES
    "YOUR_ADMIN_SOLANA_WALLET_ADDRESS_2"  // <<--- MAKE SURE THESE MATCH YOUR DEPLOYED ADMIN WALLETS
];


// --- Middleware for Admin Authorization ---
// This middleware checks if the requesting wallet is an authorized administrator
// and optionally verifies the wallet's signature.
const authorizeAdmin = async (req, res, next) => {
    const { authorWallet, signature } = req.body;

    // Ensure authorWallet is provided for authorization attempt
    if (!authorWallet) {
        return res.status(401).json({ message: 'Authorization required: Author wallet address is missing in the request body.' });
    }

    // 1. Whitelist Check: Verify if the provided wallet address is in the list of authorized admins.
    if (!AUTHORIZED_ADMIN_WALLETS.includes(authorWallet)) {
        console.warn(`Unauthorized access attempt: Wallet ${authorWallet} is not an authorized administrator.`);
        return res.status(403).json({ message: 'Forbidden: Only authorized administrators can perform this action.' });
    }

    // 2. Web3 Signature Verification (CRUCIAL for proving actual wallet ownership)
    // This step verifies that the request was cryptographically signed by the 'authorWallet'.
    /*
    // Uncomment this entire block after implementing verifySignature utility
    if (!signature) {
        return res.status(401).json({ message: 'Authentication failed: Wallet signature is missing for this admin action.' });
    }

    // The message that was signed by the frontend. This must exactly match what was signed.
    // Consider adding a nonce for replay attack protection in production scenarios.
    const messageToVerify = JSON.stringify({ text, authorWallet }); // Example: Signing relevant data

    try {
        const isSignatureValid = await verifySignature(authorWallet, messageToVerify, signature);
        if (!isSignatureValid) {
            console.warn(`Signature verification failed for admin wallet: ${authorWallet}. Potentially spoofed request.`);
            return res.status(403).json({ message: 'Authentication failed: Invalid wallet signature.' });
        }
    } catch (sigError) {
        console.error('Server error during signature verification:', sigError);
        return res.status(500).json({ message: 'Internal server error during signature verification. Please try again later.' });
    }
    */

    // If all checks pass (whitelist and optional signature), proceed to the route handler
    next();
};


// --- Route: Get All Announcements ---
// Fetches all announcements from the database, sorted by their creation date (newest first).
router.get('/', async (req, res) => {
    try {
        // Using 'createdAt' for sorting, which is automatically added by Mongoose's `timestamps: true`
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error); // Log full error on the server
        res.status(500).json({ message: 'Failed to retrieve announcements. An unexpected error occurred.' }); // Generic message for client
    }
});


// --- Route: Post a New Announcement ---
// This route is protected by the `authorizeAdmin` middleware.
// Requires: 'text' (content of the announcement) and 'authorWallet' (admin's public key).
// Assumes 'signature' is also provided in the request body for verification by `authorizeAdmin`.
router.post('/', authorizeAdmin, async (req, res) => {
    const { text, authorWallet } = req.body; // 'signature' is consumed by authorizeAdmin middleware

    // 1. Basic Input Validation (early exit for obviously missing data)
    // Mongoose schema validation will catch more detailed issues.
    if (!text || !authorWallet) {
        return res.status(400).json({ message: 'Announcement text and author wallet address are both required fields.' });
    }

    // 2. Validate Solana Public Key Format: Ensure 'authorWallet' is syntactically correct.
    try {
        new PublicKey(authorWallet); // Throws an error if 'authorWallet' is not a valid base58-encoded 32-byte public key.
    } catch (pkError) {
        console.error('Invalid Solana wallet address format provided:', pkError.message);
        return res.status(400).json({ message: 'The provided author wallet address is not a valid Solana public key format.' });
    }

    // 3. Create a new Announcement document based on the Mongoose model.
    const newAnnouncement = new Announcement({
        text,
        authorWallet
        // 'createdAt' and 'updatedAt' will be automatically populated by Mongoose due to `timestamps: true`
        // The 'date' field will default to `Date.now` as per your schema. Consider if `createdAt` suffices.
    });

    // 4. Save the new announcement to the database.
    try {
        const savedAnnouncement = await newAnnouncement.save();
        res.status(201).json({
            message: 'Announcement successfully posted and saved!',
            announcement: savedAnnouncement // Return the newly created announcement object
        });
    } catch (error) {
        // 5. Handle Mongoose Validation Errors (e.g., from min/max length, custom validators in schema)
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.warn('Mongoose validation failed for new announcement:', errors);
            return res.status(400).json({ message: 'Validation failed for announcement data.', errors });
        }
        // 6. Handle Other Potential Server-Side Errors during the save operation.
        console.error('Error saving new announcement to database:', error);
        res.status(500).json({ message: 'Failed to post announcement due to an unexpected server error. Please try again.' });
    }
});

module.exports = router;
