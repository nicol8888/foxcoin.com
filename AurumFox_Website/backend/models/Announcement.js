// backend/models/Announcement.js
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    // The main text content of the announcement. Must be a string and is required.
    text: {
        type: String,
        required: [true, 'Announcement text is required.'], // Custom error message for validation failure
        trim: true, // Automatically removes leading/trailing whitespace
        minlength: [5, 'Announcement text must be at least 5 characters long.'], // Enforce minimum length
        maxlength: [1000, 'Announcement text cannot exceed 1000 characters.'] // Enforce maximum length
    },
    // The wallet address of the author/admin who posted the announcement.
    // This field holds the public key string.
    authorWallet: {
        type: String,
        required: [true, 'Author wallet address is required.'], // Custom error message
        trim: true,
        // Basic validation: Ensures the string loosely matches the format of a Solana public key (base58 encoded).
        // More robust authorization (e.g., checking against a whitelist of admin wallets,
        // verifying cryptographic signatures) should be performed in the backend routes/service layer.
        validate: {
            validator: function(v) {
                // Regex for typical base58 encoded Solana public key length (32 bytes usually results in 44 characters).
                return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
            },
            message: props => `${props.value} is not a valid Solana wallet address format!` // Custom validation error message
        }
    },
    // Optional: Original creation date of the announcement.
    // Consider whether `createdAt` (automatically added by `timestamps: true`) is sufficient for your needs.
    // If this 'date' field has a distinct business purpose (e.g., a scheduled publish date), keep it.
    date: {
        type: Date,
        default: Date.now // Defaults to the current date/time
    }
}, {
    // Schema options:
    // timestamps: true automatically adds `createdAt` and `updatedAt` fields to your documents.
    // `createdAt` stores the creation timestamp, and `updatedAt` stores the last modification timestamp.
    timestamps: true
});

module.exports = mongoose.model('Announcement', announcementSchema);
