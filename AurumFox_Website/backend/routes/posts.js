// backend/routes/posts.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // Import the Post Mongoose model

// Assuming isValidSolanaAddress is now exported from '../models/Post.js'
// or ideally, it should be in a separate utility file.
// For this example, we import it directly from the Post model file.
const { isValidSolanaAddress } = require('../models/Post'); 

// Helper function to format Mongoose validation errors into a more readable object.
// This function is useful for returning structured error messages to the client.
// In a larger application, this helper could be extracted into a shared `utils/errorHandler.js` file.
const formatMongooseErrors = (err) => {
    const errors = {};
    for (let field in err.errors) {
        errors[field] = err.errors[field].message;
    }
    return errors;
};

// GET /api/posts
// Route to fetch all posts.
// Posts are sorted by their creation date in descending order (newest first).
router.get('/', async (req, res) => {
    try {
        // Use `createdAt` for sorting, which is automatically added by `timestamps: true` in the Post schema.
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts); // Respond with the fetched posts.
    } catch (err) {
        console.error('Error fetching posts:', err); // Log the detailed error for server-side debugging.
        // Send a generic 500 Internal Server Error response to the client for unexpected errors.
        res.status(500).json({ message: 'Internal Server Error: Could not retrieve posts.' });
    }
});

// GET /api/posts/:id
// Route to fetch a single post by its MongoDB `_id`.
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            // If no post is found with the given ID, return a 404 Not Found status.
            return res.status(404).json({ message: 'Post not found.' });
        }
        res.json(post); // Respond with the found post.
    } catch (err) {
        // Handle `CastError` specifically, which occurs if the provided `id` is not a valid MongoDB ObjectId format.
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Post ID format. Please provide a valid ObjectId.' });
        }
        console.error(`Error fetching post with ID ${req.params.id}:`, err);
        res.status(500).json({ message: 'Internal Server Error: Could not retrieve post.' });
    }
});

// POST /api/posts
// Route to create a new post.
// IMPORTANT: For a production application, robust user authentication and authorization
// mechanisms are crucial here. You should verify that `authorWallet` truly belongs
// to the authenticated user attempting to create the post.
router.post('/', async (req, res) => {
    const { title, content, authorWallet } = req.body;

    // Basic pre-validation: Check for the presence of required fields.
    // Mongoose schema validation will provide more detailed error messages.
    if (!title || !content || !authorWallet) {
        return res.status(400).json({ message: 'Title, content, and author wallet are all required fields.' });
    }

    // Additional direct validation for `authorWallet` format.
    // This provides an immediate response without relying solely on Mongoose schema validation for this specific format.
    if (!isValidSolanaAddress(authorWallet)) {
        return res.status(400).json({ message: 'Invalid author wallet address format. Please provide a valid Solana address.' });
    }

    // Create a new Post document instance.
    const newPost = new Post({ title, content, authorWallet });

    try {
        const savedPost = await newPost.save(); // Attempt to save the new post to the database.
        // On successful creation, respond with 201 Created status and the saved post data.
        res.status(201).json(savedPost);
    } catch (err) {
        console.error('Error creating post:', err); // Log the detailed error.
        if (err.name === 'ValidationError') {
            // If the error is a Mongoose `ValidationError` (e.g., due to schema constraints),
            // return a 400 Bad Request with specific validation error details.
            return res.status(400).json({
                message: 'Validation Error: Please check your input fields.',
                errors: formatMongooseErrors(err)
            });
        }
        // For any other unexpected errors during save, return a generic 500 Internal Server Error.
        res.status(500).json({ message: 'Internal Server Error: Could not create post.' });
    }
});

// PUT /api/posts/:id
// Route to update an existing post by its ID.
// IMPORTANT: Authentication and authorization checks are paramount here.
// Only the original author or an authorized administrator should be able to update a post.
router.put('/:id', async (req, res) => {
    // Destructure fields that can be updated. `authorWallet` is generally not meant to be updated via PUT.
    const { title, content } = req.body;
    // For authorization purposes, you might pass the `authorWallet` from the frontend
    // but its value should be verified against the authenticated user's identity.
    const { authorWallet } = req.body; // Keeping it for the authorization check example below.

    // Allow partial updates: at least one field (title or content) must be provided.
    if (!title && !content) {
        return res.status(400).json({ message: 'At least one field (title or content) is required for updating the post.' });
    }

    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        // Basic Authorization Check (should be replaced with proper authentication/authorization middleware):
        // This checks if the `authorWallet` provided in the request body matches the post's recorded author.
        // A real system would use a JWT or session to determine the authenticated user's wallet.
        if (authorWallet && post.authorWallet.toLowerCase() !== authorWallet.toLowerCase()) {
             return res.status(403).json({ message: 'Forbidden: You are not authorized to update this post.' });
        }

        // Update fields only if they are present in the request body.
        if (title !== undefined) post.title = title;
        if (content !== undefined) post.content = content;
        // The `updatedAt` timestamp will be automatically updated by `timestamps: true` on `save()`.

        const updatedPost = await post.save(); // Save the updated post. Mongoose schema validation will run here.
        res.json(updatedPost); // Respond with the updated post.
    } catch (err) {
        console.error(`Error updating post with ID ${req.params.id}:`, err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Post ID format.' });
        }
        if (err.name === 'ValidationError') {
            // If validation fails during save (e.g., new title/content violates schema rules).
            return res.status(400).json({
                message: 'Validation Error: Invalid data provided for update.',
                errors: formatMongooseErrors(err)
            });
        }
        res.status(500).json({ message: 'Internal Server Error: Could not update post.' });
    }
});

// DELETE /api/posts/:id
// Route to delete a post by its ID.
// IMPORTANT: Authentication and authorization checks are crucial here.
// Only the original author or an authorized administrator should be able to delete a post.
router.delete('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found.' });
        }

        // Basic Authorization Check (similar to PUT route, should be proper middleware):
        // You might pass a `requesterWallet` in the body or extract it from an auth token.
        // For demonstration, uncommenting this and passing `requesterWallet` in body:
        // if (req.body.requesterWallet && post.authorWallet.toLowerCase() !== req.body.requesterWallet.toLowerCase()) {
        //     return res.status(403).json({ message: 'Forbidden: You are not authorized to delete this post.' });
        // }

        // Use `deleteOne` on the model or `findByIdAndDelete` for a more direct approach.
        await Post.deleteOne({ _id: req.params.id });
        // Respond with a success message. No content (204 No Content) is also a valid response for DELETE.
        res.json({ message: 'Post successfully deleted.' });
    } catch (err) {
        console.error(`Error deleting post with ID ${req.params.id}:`, err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Post ID format.' });
        }
        res.status(500).json({ message: 'Internal Server Error: Could not delete post.' });
    }
});

module.exports = router;
