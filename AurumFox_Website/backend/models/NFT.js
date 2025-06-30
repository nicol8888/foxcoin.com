// backend/models/NFT.js
const mongoose = require('mongoose');

// Helper function for Solana address validation
// It's highly recommended to move this into a shared utility file (e.g., `utils/validators.js`)
// if you plan to use it across multiple Mongoose models (like DaoProposal and Game).
const isValidSolanaAddress = (address) => {
    // Basic validation for Solana public key format.
    // Solana addresses are base58 encoded and typically between 32 and 44 characters long.
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

// Define the Mongoose schema for an NFT
const nftSchema = new mongoose.Schema({
    // Name of the NFT (e.g., "My Awesome NFT #1")
    name: {
        type: String,
        required: [true, 'NFT name is required.'], // Name is mandatory
        trim: true, // Remove leading/trailing whitespace
        minlength: [1, 'NFT name must not be empty.'], // Ensure the name is not just whitespace
        maxlength: [100, 'NFT name cannot exceed 100 characters.'] // Limit name length for consistency
    },
    // Detailed description of the NFT, providing context and unique features
    description: {
        type: String,
        required: [true, 'NFT description is required.'], // Description is mandatory
        trim: true,
        minlength: [10, 'NFT description must be at least 10 characters long.'], // Ensure a meaningful description
        maxlength: [2000, 'NFT description cannot exceed 2000 characters.'] // Generous length for detailed descriptions
    },
    // URL pointing to the NFT's image (e.g., IPFS gateway link, Arweave URL, or your server's path)
    image: {
        type: String,
        required: [true, 'NFT image URL is required.'], // Image URL is mandatory
        trim: true,
        maxlength: [500, 'Image URL cannot exceed 500 characters.'], // Limit URL length
        validate: {
            validator: function(v) {
                // Basic regex validation for a URL format.
                // This does not guarantee the URL is accessible or points to an image.
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v);
            },
            message: props => `${props.value} is not a valid image URL.` // Custom error for invalid URL format
        }
    },
    // The unique Solana mint address (public key) for this NFT.
    // This is the on-chain identifier for the NFT.
    mint: {
        type: String,
        unique: true, // Ensures every NFT document has a unique mint address
        required: [true, 'NFT mint address is required.'], // Mint address is mandatory
        trim: true,
        validate: {
            validator: isValidSolanaAddress, // Validate format using the helper function
            message: props => `${props.value} is not a valid Solana mint address format.` // Custom error message
        }
    },
    // The Solana wallet address of the current owner of this NFT.
    owner: {
        type: String,
        required: [true, 'NFT owner wallet address is required.'], // Owner address is mandatory
        trim: true,
        validate: {
            validator: isValidSolanaAddress, // Validate format using the helper function
            message: props => `${props.value} is not a valid Solana owner wallet address format.` // Custom error message
        }
    },
    // The Solana wallet address of the original creator of the NFT.
    creatorWallet: {
        type: String,
        required: [true, 'NFT creator wallet address is required.'], // Creator address is mandatory
        trim: true,
        validate: {
            validator: isValidSolanaAddress, // Validate format using the helper function
            message: props => `${props.value} is not a valid Solana creator wallet address format.` // Custom error message
        }
    },
    // NFT attributes, typically stored as an array of objects (e.g., [{ "trait_type": "Color", "value": "Red" }]).
    // Using `mongoose.Schema.Types.Mixed` provides flexibility to store arbitrary data structures.
    // If attributes have a fixed structure, consider defining a sub-schema or a more specific array of objects.
    attributes: {
        type: [mongoose.Schema.Types.Mixed], // Array of mixed types allows varied attribute objects
        default: [], // Defaults to an empty array if no attributes are provided
        // Optional: Add custom validation here if you need to enforce specific structures for each attribute object.
        // For example, to ensure each attribute has `trait_type` and `value`.
    },
    // Boolean flag indicating whether the NFT is currently listed for sale on a marketplace.
    isListed: {
        type: Boolean,
        default: false // NFTs are not listed by default
    },
    // The price of the NFT in SOL (or other cryptocurrency) if it is listed for sale.
    price: {
        type: Number,
        default: null, // Price is null if not listed
        min: [0, 'Price cannot be negative.'], // Price must be zero or positive
        // Custom validator to enforce logical consistency between `isListed` and `price`.
        // If `isListed` is true, `price` must be a non-null number.
        // If `isListed` is false, `price` must be null.
        validate: {
            validator: function(value) {
                if (this.isListed && (value === null || value === undefined)) {
                    return false; // If listed, price cannot be null or undefined
                }
                if (!this.isListed && (value !== null && value !== undefined)) {
                    return false; // If not listed, price must be null or undefined
                }
                return true;
            },
            message: 'Price must be specified if listed for sale, and null if not listed.' // Custom error message
        }
    },
    // Date representing when the NFT was minted or acquired by the initial owner.
    // This is distinct from `createdAt` which tracks when the record was added to *this* database.
    acquisitionDate: {
        type: Date,
        default: Date.now // Defaults to the current date if not provided
    }
}, {
    // Schema options:
    // `timestamps: true` automatically adds two fields:
    // `createdAt`: Date the document was first created.
    // `updatedAt`: Date the document was last updated.
    // These are invaluable for tracking changes and auditing.
    timestamps: true
});

// Define indexes to improve query performance on frequently searched fields.
// Mongoose automatically creates a unique index for `mint` due to `unique: true`.
nftSchema.index({ owner: 1 }); // Index for efficient lookup of NFTs by owner
nftSchema.index({ creatorWallet: 1 }); // Index for efficient lookup of NFTs by creator
// Compound index for querying listed NFTs by price (e.g., for marketplace listings)
nftSchema.index({ isListed: 1, price: 1 });

module.exports = mongoose.model('NFT', nftSchema);
