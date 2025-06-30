// backend/routes/ads.js
const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const { PublicKey } = require('@solana/web3.js'); // Required for Solana public key validation

// IMPORTANT: You will need to create this utility file for signature verification
// This function verifies that a signed message truly originated from the specified wallet.
// Example content for backend/utils/solanaUtils.js:
/*
    const { PublicKey, Transaction } = require('@solana/web3.js');
    const bs58 = require('bs58');
    const nacl = require('tweetnacl'); // For Ed25519 verification

    async function verifySignature(publicKeyString, message, signatureString) {
        try {
            const publicKey = new PublicKey(publicKeyString);
            const signature = bs58.decode(signatureString);
            const messageBytes = new TextEncoder().encode(message); // Encode message to bytes

            // Perform cryptographic verification
            const isVerified = nacl.sign.detached.verify(
                messageBytes,
                signature,
                publicKey.toBytes()
            );
            return isVerified;
        } catch (error) {
            console.error('Error during signature verification:', error);
            return false;
        }
    }
    module.exports = { verifySignature };
*/
// Uncomment the line below once you have created the utility:
// const { verifySignature } = require('../utils/solanaUtils');

// --- Get All Advertisements ---
// Fetches all advertisements from the database, sorted by their creation date (newest first).
router.get('/', async (req, res) => {
    try {
        // Use 'createdAt' field for sorting, which is automatically added by Mongoose's 'timestamps: true'
        const ads = await Ad.find().sort({ createdAt: -1 });
        res.json(ads);
    } catch (error) {
        console.error('Error fetching advertisements:', error); // Log the detailed error on the server
        // Return a generic error message to the client for security
        res.status(500).json({ message: 'Failed to retrieve advertisements. Please try again later.' });
    }
});

// --- Place a New Advertisement ---
// Allows a user to submit a new advertisement.
// Requires: title, content, advertiser's wallet address.
// Optional: link, imageUrl, and a crucial 'signature' for Web3 authentication.
router.post('/', async (req, res) => {
    const { title, content, advertiser, link, imageUrl, signature } = req.body;

    // 1. Basic Input Validation: Check for required fields upfront
    if (!title || !content || !advertiser) {
        return res.status(400).json({ message: 'Title, content, and advertiser wallet address are all required fields.' });
    }

    // 2. Validate Solana Public Key Format: More robust check than schema regex alone
    try {
        new PublicKey(advertiser); // Throws an error if 'advertiser' is not a valid Solana Public Key format
    } catch (pkError) {
        console.error('Invalid Solana wallet address format:', pkError.message);
        return res.status(400).json({ message: 'The provided advertiser wallet address is not a valid Solana public key format.' });
    }

    // 3. Web3 Security Enhancement: Verify Wallet Signature
    // This is CRUCIAL for a Web3 application to ensure the request is truly from the 'advertiser' wallet.
    // The frontend should send a signed message (e.g., a hash of the ad data, or a unique nonce)
    // using the 'advertiser's private key via their wallet (like Phantom).
    /*
    // Uncomment this block and ensure verifySignature utility is available
    if (!signature) {
        return res.status(401).json({ message: 'Authentication required: Missing wallet signature.' });
    }

    // Define the message that was signed on the frontend.
    // It's often best practice to use a clear, consistent message or a nonce for signature verification.
    const messageToVerify = JSON.stringify({ title, content, advertiser }); // Example message structure
    // Or if you send a nonce from backend for signing:
    // const messageToVerify = `Verify ad post for: ${title} by ${advertiser} - Nonce: ${req.body.nonce}`;

    try {
        // Assume verifySignature function takes publicKeyString, message, signatureString
        const isSignatureValid = await verifySignature(advertiser, messageToVerify, signature);
        if (!isSignatureValid) {
            console.warn(`Signature verification failed for wallet: ${advertiser}`);
            return res.status(403).json({ message: 'Invalid wallet signature. Authentication failed for the advertiser.' });
        }
    } catch (sigError) {
        console.error('An error occurred during signature verification:', sigError);
        return res.status(500).json({ message: 'Failed to verify wallet signature due to a server error.' });
    }
    */

    // 4. Create and Save New Ad Document
    const newAd = new Ad({
        title,
        content,
        advertiser,
        link,
        imageUrl
        // 'createdAt' and 'updatedAt' fields will be automatically handled by Mongoose due to 'timestamps: true'
        // If your 'date' field in the schema has a unique business meaning beyond creation time, keep it.
        // Otherwise, 'createdAt' might be sufficient and 'date' could be removed from the schema.
    });

    try {
        const savedAd = await newAd.save();
        res.status(201).json({
            message: 'Advertisement successfully posted and saved!',
            ad: savedAd // Return the saved advertisement object
        });
    } catch (error) {
        // 5. Handle Mongoose Validation Errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.warn('Mongoose validation failed for new ad:', errors);
            return res.status(400).json({ message: 'Validation failed for advertisement data.', errors });
        }
        // 6. Handle Other Server Errors
        console.error('Error saving new advertisement:', error);
        res.status(500).json({ message: 'Failed to post advertisement due to a server error. Please try again.' });
    }
});

module.exports = router;
