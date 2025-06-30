// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurumfox';

// Middleware
app.use(cors()); // Allows requests from your frontend
app.use(express.json()); // Allows parsing JSON request bodies
app.use(express.urlencoded({ extended: true })); // For parsing URL-encoded data

// Static content for uploaded files (e.g., NFT images)
// Ensure this folder exists and is writable
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Import and use API routes
const announcementsRoutes = require('./routes/announcements');
const gamesRoutes = require('./routes/games');
const adsRoutes = require('./routes/ads');
const nftsRoutes = require('./routes/nfts');
const daoRoutes = require('./routes/dao');
const stakingRoutes = require('./routes/staking');
const postsRoutes = require('./routes/posts'); // For the "News" section

app.use('/api/announcements', announcementsRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/nfts', nftsRoutes);
app.use('/api/dao', daoRoutes);
app.use('/api/staking', stakingRoutes);
app.use('/api/posts', postsRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at: http://localhost:${PORT}/api`);
});
