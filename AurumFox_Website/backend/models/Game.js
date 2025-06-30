// backend/models/Game.js
const mongoose = require('mongoose');

// Can be extracted to a separate utility file if used repeatedly
const isValidSolanaAddress = (address) => {
    // Basic validation for Solana address format (base58)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

const gameSchema = new mongoose.Schema({
    // Title of the game
    title: {
        type: String,
        required: [true, 'Game title is required.'], // Custom error message
        trim: true, // Remove leading/trailing whitespace
        minlength: [3, 'Game title must be at least 3 characters long.'], // Minimum length for meaningful titles
        maxlength: [100, 'Game title cannot exceed 100 characters.'] // Maximum length to prevent excessively long titles
    },
    // Detailed description of the game
    description: {
        type: String,
        required: [true, 'Game description is required.'], // Custom error message
        trim: true,
        minlength: [20, 'Game description must be at least 20 characters long.'], // Minimum length for detailed descriptions
        maxlength: [5000, 'Game description cannot exceed 5000 characters.'] // Generous maximum length for comprehensive descriptions
    },
    // The wallet address of the developer. Assumed to be a Solana public key.
    developer: {
        type: String,
        required: [true, 'Developer wallet address is required.'], // Custom error message
        trim: true,
        validate: {
            validator: isValidSolanaAddress, // Using the validation function
            message: props => `${props.value} is not a valid Solana wallet address format for the developer!` // Custom validation error message
        }
    },
    // URL of the game's page or official website
    url: {
        type: String,
        trim: true,
        default: '', // Defaults to an empty string
        maxlength: [500, 'URL cannot exceed 500 characters.'], // Maximum length for URL
        // Basic URL validation (more strict regex or npm packages can be used)
        validate: {
            validator: function(v) {
                if (v === '') return true; // Empty string is allowed by default
                return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v); // Regex for basic URL format
            },
            message: props => `${props.value} is not a valid URL.` // Custom validation error message
        }
    },
    // Release date of the game (if not the record creation date in the DB)
    releaseDate: { // Renamed for clarity
        type: Date,
        default: Date.now, // Defaults to the current date
        // Optional: Add validation that the date is not in the future, if it's a release date
        // validate: {
        //     validator: function(value) {
        //         return value <= Date.now();
        //     },
        //     message: 'Release date cannot be in the future.'
        // }
    },
    // Additional fields
    genres: {
        type: [String], // Array of strings for game genres
        default: [], // Defaults to an empty array
        enum: {
            values: ['Action', 'Adventure', 'RPG', 'Strategy', 'Simulation', 'Sports', 'Puzzle', 'Horror', 'Sci-Fi', 'Fantasy', 'Indie', 'MMO', 'Racing', 'Fighting'], // Example of possible genres
            message: '{VALUE} is not a valid genre.' // Custom error message for invalid enum value
        }
    },
    platforms: {
        type: [String], // Array of strings for platforms
        default: [], // Defaults to an empty array
        enum: {
            values: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile (iOS)', 'Mobile (Android)', 'Browser'], // Example of platforms
            message: '{VALUE} is not a valid platform.' // Custom error message for invalid enum value
        }
    },
    screenshots: {
        type: [String], // Array of URL strings for screenshots
        default: [], // Defaults to an empty array
        validate: {
            validator: function(urls) {
                if (!urls || urls.length === 0) return true; // Empty array is valid
                return urls.every(url => /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url)); // Validate each URL in the array
            },
            message: 'One or more screenshot URLs are invalid.' // Custom error message for array validation
        }
    }
}, {
    // Schema options:
    // `timestamps: true` automatically adds `createdAt` and `updatedAt` fields to your documents.
    // `createdAt` stores the timestamp when the document was first created.
    // `updatedAt` stores the timestamp of the last update to the document.
    // This is a standard and highly recommended practice for tracking document lifecycle.
    timestamps: true
});

module.exports = mongoose.model('Game', gameSchema);
