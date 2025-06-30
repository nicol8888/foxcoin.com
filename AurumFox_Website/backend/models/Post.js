// backend/models/Post.js
const mongoose = require('mongoose');

// Define a helper function for Solana wallet address validation.
// This function checks if the provided string conforms to the typical format
// of a Solana public key (base58 encoded, 32-44 characters, excluding specific problematic characters).
// For a production application, consider moving this to a shared utility file (e.g., `utils/validation.js`)
// if it's used in multiple models or routes.
const isValidSolanaAddress = (address) => {
    // Regular expression for Solana addresses.
    // It asserts that the string starts and ends with allowed characters and has a length between 32 and 44.
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

// Define the Mongoose schema for a 'Post' document.
const postSchema = new mongoose.Schema({
    // 'title' field:
    title: {
        type: String,
        required: [true, 'Post title is required.'], // Specifies that the field is mandatory, with a custom error message.
        trim: true, // Automatically removes whitespace from both ends of the string.
        minlength: [3, 'Post title must be at least 3 characters long.'], // Minimum length constraint.
        maxlength: [100, 'Post title cannot exceed 100 characters.'] // Maximum length constraint.
    },
    // 'content' field:
    content: {
        type: String,
        required: [true, 'Post content is required.'],
        trim: true,
        minlength: [10, 'Post content must be at least 10 characters long.'],
        maxlength: [5000, 'Post content cannot exceed 5000 characters.'] // Example maximum length for post content.
    },
    // 'authorWallet' field:
    authorWallet: {
        type: String,
        required: [true, 'Author wallet address is required.'],
        trim: true,
        // Custom validation using the `isValidSolanaAddress` helper function.
        validate: {
            validator: isValidSolanaAddress, // The function to use for validation.
            // Custom error message for validation failure. 'props.value' refers to the invalid value.
            message: props => `${props.value} is not a valid Solana wallet address.`
        }
    }
    // The `date` field from the original schema is intentionally removed.
    // Instead, Mongoose's `timestamps` option is used for automatic `createdAt` and `updatedAt` fields.
}, {
    // Schema options:
    timestamps: true // This option automatically adds `createdAt` and `updatedAt` Date fields to the schema.
                     // `createdAt` is set when the document is first created, and `updatedAt` is updated
                     // every time the document is modified.
});

// Export the Mongoose model named 'Post', based on the `postSchema`.
// This allows you to interact with the 'posts' collection in MongoDB.
module.exports = mongoose.model('Post', postSchema);
