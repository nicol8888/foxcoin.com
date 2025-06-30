// backend/models/Ad.js
const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    // Title of the advertisement. Must be a string and is required.
    title: {
        type: String,
        required: [true, 'Ad title is required.'], // Custom error message
        trim: true, // Removes leading/trailing whitespace
        minlength: [3, 'Ad title must be at least 3 characters long.'], // Minimum length for quality
        maxlength: [100, 'Ad title cannot exceed 100 characters.'] // Maximum length to prevent bloat
    },
    // Main content or body of the advertisement. Must be a string and is required.
    content: {
        type: String,
        required: [true, 'Ad content is required.'], // Custom error message
        trim: true,
        minlength: [10, 'Ad content must be at least 10 characters long.'],
        maxlength: [500, 'Ad content cannot exceed 500 characters.'] // Reasonable length for ad content
    },
    // The wallet address of the advertiser. This should typically be a Solana public key.
    // Stored as a String, with a basic validator for base58 format.
    advertiser: {
        type: String,
        required: [true, 'Advertiser wallet address is required.'],
        trim: true,
        validate: {
            validator: function(v) {
                // Basic regex for a base58 string typical of Solana public keys (32 bytes / 44 chars base58).
                // For cryptographic validation, implement checks in your service layer using Solana's SDK.
                return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
            },
            message: props => `${props.value} is not a valid Solana wallet address!`
        }
    },
    // Optional URL link associated with the advertisement.
    link: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator: function(v) {
                if (v === '') return true; // Allow empty string
                // Simple regex for URL validation. Consider 'validator' package for more robust checks.
                return /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})$/i.test(v);
            },
            message: props => `${props.value} is not a valid URL!`
        }
    },
    // Optional URL to an image for the advertisement.
    imageUrl: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator: function(v) {
                if (v === '') return true; // Allow empty string
                // Same simple URL regex as above.
                return /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})$/i.test(v);
            },
            message: props => `${props.value} is not a valid image URL!`
        }
    },
    // Original creation date of the advertisement.
    // Note: The `timestamps: true` option below will also add `createdAt` and `updatedAt`.
    // You can remove this `date` field if `createdAt` suffices for your needs.
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically adds `createdAt` (creation date) and `updatedAt` (last modification date) fields.
});

module.exports = mongoose.model('Ad', adSchema);
