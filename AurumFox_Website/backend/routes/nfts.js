// backend/routes/nfts.js
const express = require('express');
const router = express.Router();
const NFT = require('../models/NFT'); // Import your improved NFT Mongoose model
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js File System module for file operations

// Import Solana Web3.js and SPL Token Library components
const { Connection, Keypair, PublicKey, clusterApiUrl, Transaction } = require('@solana/web3.js');
const { createMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58'); // For decoding base58 encoded private keys

// --- Utility Functions ---

// Helper function to validate Solana wallet addresses
// (It's best practice to put this in a shared utility file if used across multiple routes/models)
const isValidSolanaAddress = (address) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

// Helper function to format Mongoose validation errors
// This extracts user-friendly error messages from Mongoose ValidationError objects.
const formatMongooseErrors = (err) => {
    const errors = {};
    for (let field in err.errors) {
        errors[field] = err.errors[field].message;
    }
    return errors;
};

// --- Multer Configuration for File Uploads ---

const uploadDir = path.join(__dirname, '../uploads'); // Define upload directory path

// Create the 'uploads' directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // `recursive: true` creates parent directories if needed
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Set the destination to the 'uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename for uploaded files
    }
});
const upload = multer({ storage: storage });

// --- Solana Connection and Mint Authority Setup ---

// Initialize Solana Connection with a commitment level for reliable transaction confirmation
const solanaConnection = new Connection(clusterApiUrl(process.env.SOLANA_NETWORK || 'devnet'), 'confirmed');

// WARNING: DIRECT PRIVATE KEY USAGE IN PRODUCTION IS EXTREMELY DANGEROUS.
// For real-world applications, use secure Key Management Services (KMS) or ensure
// minting authority is controlled by a Program Derived Address (PDA) within a smart contract.
// This setup is for DEMONSTRATION/DEVELOPMENT PURPOSES ONLY.
let mintAuthorityKeypair;
try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
        // Decode private key from base58 string in environment variables
        mintAuthorityKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        console.log("Mint Authority Wallet Loaded:", mintAuthorityKeypair.publicKey.toBase58());
    } else {
        console.warn("PRIVATE_KEY is not set in .env. NFT minting will likely not work due to missing signing authority.");
        // Generate a temporary Keypair as a fallback, but it won't have SOL or be persisted
        mintAuthorityKeypair = Keypair.generate();
    }
} catch (e) {
    console.error("Error loading private key for mint authority:", e);
    mintAuthorityKeypair = Keypair.generate(); // Fallback in case of decoding error
}

// --- NFT API Routes ---

// GET /api/nfts/marketplace
// Retrieves all NFTs that are currently listed for sale.
router.get('/marketplace', async (req, res) => {
    try {
        // Find NFTs where `isListed` is true and sort them by creation date (newest first)
        const nfts = await NFT.find({ isListed: true }).sort({ createdAt: -1 });
        res.json({ nfts });
    } catch (err) {
        console.error('Error fetching marketplace NFTs:', err);
        res.status(500).json({ message: 'Internal Server Error: Could not retrieve marketplace NFTs.' });
    }
});

// GET /api/nfts/user/:walletAddress
// Retrieves all NFTs owned by a specific Solana wallet address.
router.get('/user/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        // Validate the provided wallet address format
        if (!isValidSolanaAddress(walletAddress)) {
            return res.status(400).json({ message: 'Invalid Solana wallet address format provided.' });
        }
        // Find NFTs owned by the specified wallet and sort by creation date
        const nfts = await NFT.find({ owner: walletAddress }).sort({ createdAt: -1 });
        res.json({ nfts });
    } catch (err) {
        console.error(`Error fetching NFTs for wallet ${req.params.walletAddress}:`, err);
        res.status(500).json({ message: 'Internal Server Error: Could not retrieve user NFTs.' });
    }
});

// POST /api/nfts/mint
// Handles the minting of a new NFT on Solana and records its details in MongoDB.
// Requires an image file upload via Multer.
router.post('/mint', upload.single('nftFile'), async (req, res) => {
    // 1. Initial Input & File Validation
    if (!req.file) {
        return res.status(400).json({ message: 'Image/video file is required for NFT minting.' });
    }

    const { name, description, creatorWallet, attributes } = req.body;

    // Parse attributes from a JSON string if provided, ensuring it's an array.
    let parsedAttributes = [];
    if (attributes) {
        try {
            parsedAttributes = JSON.parse(attributes);
            if (!Array.isArray(parsedAttributes)) {
                // If JSON is valid but not an array, treat as invalid attributes.
                throw new Error("Attributes must be a JSON array (e.g., '[{\"trait_type\": \"Color\", \"value\": \"Red\"}]').");
            }
        } catch (jsonErr) {
            // Clean up the uploaded file if attributes JSON is invalid
            if (req.file) { fs.unlinkSync(req.file.path); }
            return res.status(400).json({ message: `Invalid attributes format: ${jsonErr.message}` });
        }
    }

    // Perform Mongoose schema validation *before* interacting with the blockchain.
    // Create a temporary NFT instance to trigger schema validation rules.
    const tempNFT = new NFT({
        name,
        description,
        image: 'http://temp.url/for/validation', // Placeholder URL for schema validation
        mint: 'Abcdefghijklmnopqrstuvwxyz1234567890ABCDEF', // Placeholder mint for schema validation
        owner: creatorWallet,
        creatorWallet: creatorWallet,
        attributes: parsedAttributes,
        isListed: false,
        price: null,
        // acquisitionDate will be defaulted by the schema
    });

    try {
        await tempNFT.validate(); // Run Mongoose schema validation
    } catch (validationErr) {
        // If validation fails, delete the uploaded file and return 400 with detailed errors
        if (req.file) { fs.unlinkSync(req.file.path); }
        if (validationErr.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation Error: Please check your input fields.',
                errors: formatMongooseErrors(validationErr)
            });
        }
        console.error('Unexpected error during NFT data pre-validation:', validationErr);
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(500).json({ message: 'Internal Server Error during data validation before minting.' });
    }

    // 2. Solana NFT Minting Process
    try {
        // Ensure the mint authority Keypair is loaded and has sufficient SOL for transaction fees.
        if (!mintAuthorityKeypair || !mintAuthorityKeypair.publicKey) {
            if (req.file) { fs.unlinkSync(req.file.path); }
            return res.status(500).json({ message: 'Mint authority wallet not configured or invalid. Cannot proceed with minting.' });
        }
        const accountInfo = await solanaConnection.getAccountInfo(mintAuthorityKeypair.publicKey);
        const requiredSol = 0.005 * 1e9; // Estimate required SOL for gas (0.005 SOL as example)
        if (!accountInfo || accountInfo.lamports < requiredSol) {
             if (req.file) { fs.unlinkSync(req.file.path); }
             return res.status(500).json({ message: `Mint authority wallet has insufficient SOL for transaction fees. Requires at least ${requiredSol / 1e9} SOL.` });
        }

        // 2.1. Create a new SPL Token Mint for the NFT. NFTs always have 0 decimals.
        const mint = await createMint(
            solanaConnection,
            mintAuthorityKeypair,          // Payer for the transaction
            mintAuthorityKeypair.publicKey, // Mint Authority (entity with permission to mint tokens)
            null,                          // Freeze Authority (null means no one can freeze token accounts)
            0                              // Decimals (0 for NFTs, as they are non-fungible)
        );
        console.log(`Successfully created new NFT Mint: ${mint.toBase58()}`);

        // 2.2. Get or Create the Associated Token Account (ATA) for the NFT owner.
        // This is where the NFT token will be held.
        const ownerPublicKey = new PublicKey(creatorWallet);
        const associatedTokenAccount = await getAssociatedTokenAddress(
            mint,
            ownerPublicKey
        );

        // Check if the ATA exists. If not, create it within a transaction.
        try {
            await solanaConnection.getAccountInfo(associatedTokenAccount);
            console.log(`Associated Token Account (ATA) already exists for ${creatorWallet}: ${associatedTokenAccount.toBase58()}`);
        } catch (e) {
            console.log(`ATA does not exist for ${creatorWallet}. Creating it now...`);
            const createATAInstruction = createAssociatedTokenAccountInstruction(
                mintAuthorityKeypair.publicKey, // Payer for creating the ATA
                associatedTokenAccount,
                ownerPublicKey,
                mint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );

            const createATATransaction = new Transaction().add(createATAInstruction);
            createATATransaction.feePayer = mintAuthorityKeypair.publicKey;
            const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash();
            createATATransaction.recentBlockhash = blockhash;
            // Set maxBlockHeight for transaction expiration
            createATATransaction.lastValidBlockHeight = lastValidBlockHeight;

            const signedCreateATATransaction = await mintAuthorityKeypair.sign(createATATransaction); // Correctly sign the Transaction object
            const ataCreationSignature = await solanaConnection.sendRawTransaction(signedCreateATATransaction.serialize());
            await solanaConnection.confirmTransaction(ataCreationSignature, 'confirmed');
            console.log(`ATA created with transaction signature: ${ataCreationSignature}`);
        }

        // 2.3. Mint 1 token (the NFT itself) to the owner's Associated Token Account.
        await mintTo(
            solanaConnection,
            mintAuthorityKeypair,          // Payer for the transaction
            mint,                          // The NFT mint account
            associatedTokenAccount,        // The ATA where the NFT will be sent
            mintAuthorityKeypair,          // Authority with permission to mint (must match the mint authority used in createMint)
            1                              // Amount to mint (always 1 for a single NFT)
        );
        console.log(`Successfully minted 1 NFT token (${mint.toBase58()}) to ${creatorWallet}'s ATA.`);

        // 3. Save NFT Information to MongoDB
        // Construct the URL for the uploaded image. This assumes your Express server serves 'uploads'.
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const finalNFT = new NFT({
            name,
            description,
            image: imageUrl,
            mint: mint.toBase58(),      // Store the Solana mint address
            owner: creatorWallet,       // Current owner (initially the creator)
            creatorWallet: creatorWallet, // Original creator
            attributes: parsedAttributes
            // isListed and price will default to false and null respectively as per schema
            // acquisitionDate will default to Date.now as per schema
        });

        const savedNFT = await finalNFT.save(); // Save the NFT details to your database
        res.status(201).json(savedNFT); // Respond with the newly created NFT record

    } catch (err) {
        console.error('Error during NFT minting or database save:', err);
        // Clean up the uploaded file if any error occurred during the blockchain transaction or DB save
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        // Provide more user-friendly error messages based on the type of error
        let errorMessage = 'Failed to create NFT.';
        if (err.message.includes('insufficient funds')) {
             errorMessage = 'Mint authority wallet has insufficient SOL to cover transaction fees.';
        } else if (err.message.includes('already in use')) { // For mint address unique constraint error
            errorMessage = 'An NFT with this mint address already exists.';
        }
        res.status(500).json({ message: `${errorMessage} Details: ${err.message}` });
    }
});

// POST /api/nfts/list
// Endpoint to list an NFT for sale.
// IMPORTANT: In a production marketplace, this action should involve a blockchain transaction
// (e.g., transferring the NFT to an escrow smart contract) *before* updating the database.
router.post('/list', async (req, res) => {
    const { nftId, price, sellerWallet } = req.body;

    // Validate incoming data
    if (!nftId || !price || price <= 0 || !sellerWallet || !isValidSolanaAddress(sellerWallet)) {
        return res.status(400).json({ message: 'NFT ID, a positive price, and a valid seller wallet address are all required to list an NFT.' });
    }

    try {
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found in the database.' });
        }
        // Verify that the `sellerWallet` matches the NFT's current owner in the database.
        // Case-insensitive comparison for Solana addresses.
        if (nft.owner.toLowerCase() !== sellerWallet.toLowerCase()) {
            return res.status(403).json({ message: 'Forbidden: You are not the recorded owner of this NFT, or it is already associated with a different owner.' });
        }

        // --- Critical Security Consideration for Listing (Blockchain Integration) ---
        // For a secure marketplace, the listing process should involve an on-chain transaction:
        // 1. The seller signs a transaction to transfer the NFT from their wallet
        //    to a Program Derived Address (PDA) controlled by your marketplace smart contract.
        // 2. This backend endpoint would then receive the *signed transaction signature* from
        //    the frontend and *verify* its success on the Solana blockchain.
        // 3. ONLY AFTER successful on-chain escrow verification, the database record is updated.
        // Example (conceptual):
        // const { transactionSignature } = req.body; // Expect this from frontend
        // const confirmation = await solanaConnection.confirmTransaction(transactionSignature, 'confirmed');
        // if (confirmation.value.err) { /* handle blockchain transaction failure */ }
        // // Further parsing to ensure correct NFT was escrowed.

        // Update NFT status in MongoDB
        nft.isListed = true;
        nft.price = price;
        await nft.save(); // Mongoose schema validators will apply here for `price` and `isListed` consistency

        res.json({ message: 'NFT successfully listed for sale.', nft });
    } catch (err) {
        console.error('Error listing NFT:', err);
        // Provide detailed Mongoose validation errors if `nft.save()` fails
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation Error: Check price and listing status.',
                errors: formatMongooseErrors(err)
            });
        }
        res.status(500).json({ message: `Internal Server Error: Could not list NFT. Details: ${err.message}` });
    }
});

// GET /api/nfts/listing/:nftId
// Retrieves details of a specific NFT listing, primarily for display before purchase.
router.get('/listing/:nftId', async (req, res) => {
    try {
        const nft = await NFT.findById(req.params.nftId);
        // Ensure the NFT exists and is currently listed for sale
        if (!nft || !nft.isListed) {
            return res.status(404).json({ message: 'Listing not found or this NFT is not currently listed for sale.' });
        }
        res.json(nft);
    } catch (err) {
        console.error('Error fetching NFT listing details:', err);
        res.status(500).json({ message: `Internal Server Error: Could not retrieve listing details. Details: ${err.message}` });
    }
});

// POST /api/nfts/buy
// Processes the purchase of an NFT.
// CRITICAL: This endpoint MUST verify the on-chain transaction before updating the database.
router.post('/buy', async (req, res) => {
    // Expecting the Solana transaction signature from the frontend after it's sent to the cluster.
    const { nftId, newOwnerWallet, transactionSignature } = req.body;

    // Validate required inputs
    if (!nftId || !newOwnerWallet || !isValidSolanaAddress(newOwnerWallet) || !transactionSignature) {
        return res.status(400).json({ message: 'NFT ID, the new owner\'s wallet address, and a valid blockchain transaction signature are all required for purchase.' });
    }

    try {
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found in the database.' });
        }
        if (!nft.isListed) {
            return res.status(400).json({ message: 'This NFT is not currently listed for sale.' });
        }

        // --- CRITICAL ON-CHAIN TRANSACTION VERIFICATION ---
        // This is the most crucial part for marketplace integrity. You MUST confirm and parse
        // the Solana transaction to ensure the NFT was actually transferred and funds exchanged.
        // Steps involved:
        // 1. Confirm the transaction by signature to ensure it's finalized on-chain.
        // 2. Fetch and parse the confirmed transaction details (`solanaConnection.getParsedTransaction`).
        // 3. Verify that:
        //    a. The correct NFT (by `mint` address) was transferred.
        //    b. The transfer originated from the seller (or marketplace escrow PDA).
        //    c. The `newOwnerWallet` is the recipient of the NFT.
        //    d. For a purchase, the correct amount of SOL (or other token) was sent to the seller.
        //    e. The transaction was signed by the `newOwnerWallet` (buyer).

        console.log(`Attempting to confirm Solana purchase transaction: ${transactionSignature}`);
        const confirmation = await solanaConnection.confirmTransaction(transactionSignature, 'confirmed');

        if (confirmation.value.err) {
            console.error('Blockchain purchase transaction failed:', confirmation.value.err);
            return res.status(400).json({ message: 'Blockchain transaction failed. NFT ownership was not transferred on-chain. Please check the transaction on Solana explorer.' });
        }

        // // Optional but highly recommended: Deep parse transaction for full verification
        // const txDetails = await solanaConnection.getParsedTransaction(transactionSignature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
        // if (!txDetails || txDetails.meta.logMessages.some(log => log.includes('error'))) {
        //     console.error('Parsed blockchain transaction has errors or is invalid:', txDetails);
        //     return res.status(400).json({ message: 'Blockchain transaction appears invalid upon parsing. NFT ownership not verified.' });
        // }
        // // Example verification (simplified, real logic is more complex):
        // const tokenBalanceChanges = txDetails.meta.postTokenBalances.filter(b => b.mint === nft.mint && b.owner === newOwnerWallet);
        // if (!tokenBalanceChanges.some(b => b.uiTokenAmount.uiAmount === 1)) {
        //     return res.status(400).json({ message: 'NFT transfer to new owner not confirmed on blockchain.' });
        // }
        // // Add logic to verify SOL transfer to seller here.

        // If blockchain verification passes, update MongoDB to reflect new ownership and delist.
        nft.owner = newOwnerWallet;
        nft.isListed = false; // Delist the NFT after purchase
        nft.price = null;     // Clear the price after sale
        // You might also update `nft.acquisitionDate = new Date();` here if desired.
        await nft.save();

        res.json({ message: 'NFT ownership successfully updated and delisted in the database.', nft });
    } catch (err) {
        console.error('Error processing NFT purchase:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation Error during NFT purchase update.',
                errors: formatMongooseErrors(err)
            });
        }
        res.status(500).json({ message: `Internal Server Error: Could not complete NFT purchase. Details: ${err.message}` });
    }
});

// POST /api/nfts/transfer
// Updates NFT ownership in the database after an on-chain transfer.
// CRITICAL: Like `/buy`, this endpoint MUST verify the on-chain transaction.
router.post('/transfer', async (req, res) => {
    // Expecting the Solana transaction signature from the frontend after it's sent to the cluster.
    const { nftId, newOwnerWallet, transactionSignature } = req.body;

    // Validate required inputs
    if (!nftId || !newOwnerWallet || !isValidSolanaAddress(newOwnerWallet) || !transactionSignature) {
        return res.status(400).json({ message: 'NFT ID, the new owner\'s wallet address, and a valid blockchain transaction signature are all required for transfer.' });
    }

    try {
        const nft = await NFT.findById(nftId);
        if (!nft) {
            return res.status(404).json({ message: 'NFT not found in the database.' });
        }

        // --- CRITICAL ON-CHAIN TRANSACTION VERIFICATION ---
        // This is paramount for data integrity. You MUST confirm and parse the Solana transaction
        // to ensure the NFT was actually transferred from the *current owner* to `newOwnerWallet`.
        console.log(`Attempting to confirm Solana transfer transaction: ${transactionSignature}`);
        const confirmation = await solanaConnection.confirmTransaction(transactionSignature, 'confirmed');

        if (confirmation.value.err) {
            console.error('Blockchain transfer transaction failed:', confirmation.value.err);
            return res.status(400).json({ message: 'Blockchain transaction failed. NFT ownership not transferred on-chain. Please check the transaction on Solana explorer.' });
        }

        // // Optional but highly recommended: Deep parse transaction for full verification
        // const txDetails = await solanaConnection.getParsedTransaction(transactionSignature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
        // if (!txDetails || txDetails.meta.logMessages.some(log => log.includes('error'))) {
        //     console.error('Parsed blockchain transfer transaction has errors or is invalid:', txDetails);
        //     return res.status(400).json({ message: 'Blockchain transfer transaction appears invalid upon parsing. NFT ownership not verified.' });
        // }
        // // Example verification (simplified):
        // const tokenBalanceChanges = txDetails.meta.postTokenBalances.filter(b => b.mint === nft.mint && b.owner === newOwnerWallet);
        // if (!tokenBalanceChanges.some(b => b.uiTokenAmount.uiAmount === 1)) {
        //     return res.status(400).json({ message: 'NFT transfer to new owner not confirmed on blockchain.' });
        // }
        // // Also verify the token was transferred *from* the old owner's ATA.

        // If blockchain verification passes, update MongoDB
        nft.owner = newOwnerWallet;
        nft.isListed = false; // Delist upon transfer
        nft.price = null;     // Clear price upon transfer
        // Update acquisitionDate if appropriate
        await nft.save();

        res.json({ message: 'NFT owner successfully updated (transferred) in the database.', nft });
    } catch (err) {
        console.error('Error processing NFT transfer:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation Error during NFT transfer update.',
                errors: formatMongooseErrors(err)
            });
        }
        res.status(500).json({ message: `Internal Server Error: Could not process NFT transfer. Details: ${err.message}` });
    }
});

module.exports = router;
