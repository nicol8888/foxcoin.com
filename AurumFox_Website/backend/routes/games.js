// backend/routes/games.js
const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Helper function to format Mongoose validation errors
// This function extracts the specific error messages from Mongoose's ValidationError object,
// making them more readable and useful for client-side feedback.
const formatMongooseErrors = (err) => {
    const errors = {};
    for (let field in err.errors) {
        errors[field] = err.errors[field].message;
    }
    return errors;
};

// GET /api/games
// Route to retrieve all games from the database.
// Games are sorted by 'releaseDate' in descending order (most recent first).
// This route can be extended to include query parameters for filtering, sorting by different fields,
// and pagination for larger datasets.
router.get('/', async (req, res) => {
    try {
        // Retrieve all games and sort them.
        // 'releaseDate' is the field defined in your updated Mongoose schema.
        const games = await Game.find().sort({ releaseDate: -1 });
        // Send the retrieved games as a JSON response.
        res.json(games);
    } catch (err) {
        // Log the full error for server-side debugging purposes.
        // This is crucial for understanding unexpected issues.
        console.error('Error fetching games:', err);
        // Send a 500 Internal Server Error status with a generic message to the client.
        // Avoid sending raw error details to the client in production for security reasons.
        res.status(500).json({ message: 'Internal Server Error: Could not retrieve games.' });
    }
});

// POST /api/games
// Route to add a new game to the database.
// It leverages the comprehensive validation built into the Mongoose Game schema.
router.post('/', async (req, res) => {
    // Create a new Game instance using data from the request body.
    // Mongoose will automatically apply schema validations (required fields, min/max lengths,
    // custom validators like Solana address format, enums, etc.).
    const newGame = new Game(req.body);

    try {
        // Attempt to save the new game document to the database.
        const savedGame = await newGame.save();
        // If successful, send a 201 Created status code and the saved game object.
        res.status(201).json(savedGame);
    } catch (err) {
        // Check if the error is a Mongoose validation error.
        if (err.name === 'ValidationError') {
            // If it's a validation error, send a 400 Bad Request status.
            // Use the helper function to format validation messages for better client feedback.
            return res.status(400).json({
                message: 'Validation Error: Please check your input.',
                errors: formatMongooseErrors(err) // Provides specific field-level error messages
            });
        }
        // For any other type of error (e.g., database connection issues, server-side logic errors),
        // log the error and send a 500 Internal Server Error.
        console.error('Error saving game:', err); // Log for debugging
        res.status(500).json({ message: 'Internal Server Error: Could not save the game.' });
    }
});

module.exports = router;
