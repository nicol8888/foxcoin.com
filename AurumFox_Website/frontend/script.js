// --- CONFIGURATION ---
// ATTENTION: You need to configure this URL for your real backend.
// For local development: 'http://localhost:3000/api'
// For production: 'https://your-api-domain.com/api'
const API_BASE_URL = 'http://localhost:3000/api';

// --- Solana Web3 and Wallet Adapters Initialization ---
let solanaConnection = null;
let phantomWallet = null;
let currentWalletAddress = null;

// Initialize Wallet Adapter
const initializeWallet = async () => {
    try {
        // Set 'mainnet-beta' for the real Solana network
        solanaConnection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'));

        // Use Phantom Wallet Adapter
        phantomWallet = new solanaWalletAdapterPhantom.PhantomWalletAdapter();

        // Check if Phantom is installed and try to auto-connect
        if (phantomWallet.readyState === solanaWalletAdapterBase.WalletReadyState.Installed || phantomWallet.readyState === solanaWalletAdapterBase.WalletReadyState.Loadable) {
            console.log("Phantom wallet detected.");
            try {
                // Try to connect automatically if the user previously authorized it
                await phantomWallet.connect();
                if (phantomWallet.publicKey) {
                    currentWalletAddress = phantomWallet.publicKey.toBase58();
                    updateWalletUI(currentWalletAddress);
                    showNotification(`Wallet connected: ${truncateAddress(currentWalletAddress)}`, 'success');
                    // Load user data after connection
                    loadUserNfts();
                    loadUserAfoxBalance();
                }
            } catch (error) {
                console.warn("Auto-connection to Phantom failed or user declined:", error);
                // This is normal if the user does not want auto-connection
            }
        } else {
            showNotification('Phantom wallet not found. Please install it.', 'warning');
        }

    } catch (error) {
        console.error('Failed to initialize Solana wallet:', error);
        showNotification('Failed to initialize Solana wallet.', 'error');
    }
};


// --- UTILITIES ---
function truncateAddress(address) {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('hide');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 5000); // Notification will disappear after 5 seconds
}

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        showNotification(`Failed to load data: ${error.message || error}`, 'error');
        return null;
    }
}

async function postData(endpoint, data, isFormData = false) {
    try {
        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: isFormData ? data : JSON.stringify(data),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }
        return result;
    } catch (error) {
        console.error(`Error sending data to ${endpoint}:`, error);
        showNotification(`Failed to perform action: ${error.message || error}`, 'error');
        return null;
    }
}

// --- WALLET MANAGEMENT ---
async function connectWallet() {
    if (!phantomWallet) {
        showNotification('Phantom wallet not initialized. Please refresh the page or install Phantom.', 'error');
        return;
    }

    if (phantomWallet.publicKey) {
        showNotification(`Wallet already connected: ${truncateAddress(phantomWallet.publicKey.toBase58())}`, 'info');
        return;
    }

    try {
        await phantomWallet.connect();
        if (phantomWallet.publicKey) {
            currentWalletAddress = phantomWallet.publicKey.toBase58();
            updateWalletUI(currentWalletAddress);
            showNotification(`Wallet connected: ${truncateAddress(currentWalletAddress)}`, 'success');
            // Update user data after connection
            loadUserNfts();
            loadUserAfoxBalance();
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        showNotification('Wallet connection error. Please try again.', 'error');
    }
}

function updateWalletUI(address) {
    const walletDisplays = document.querySelectorAll('.web3-wallet-display span');
    walletDisplays.forEach(display => {
        display.textContent = address ? truncateAddress(address) : 'Not Connected';
    });
    // Update button text
    document.querySelectorAll('.web3-btn').forEach(btn => {
        if (btn.id && btn.id.includes('connectWalletBtn')) {
            btn.textContent = address ? 'Wallet Connected' : 'Connect Wallet';
            btn.disabled = !!address; // Disable button if wallet is connected
        }
    });
}

// --- DYNAMIC CONTENT: LOADING AND DISPLAY ---

// --- Announcements ---
async function loadAnnouncements() {
    const announcementsList = document.getElementById('announcementsList');
    if (!announcementsList) return;
    announcementsList.innerHTML = '<p class="loading-message">Loading announcements...</p>';

    const announcements = await fetchData('/announcements');
    if (announcements) {
        announcementsList.innerHTML = ''; // Clear placeholders
        if (announcements.length === 0) {
            announcementsList.innerHTML = '<p class="no-data-message">No announcements found.</p>';
            return;
        }
        // Sort by date in descending order, so new ones are on top
        announcements.sort((a, b) => new Date(b.date) - new Date(a.date));
        announcements.forEach(announcement => {
            const date = new Date(announcement.date).toLocaleDateString();
            announcementsList.innerHTML += `
                <div class="announcement-item">
                    <h4>New Announcement</h4>
                    <p>${announcement.text}</p>
                    <small>${date}</small>
                </div>
            `;
        });
    } else {
        announcementsList.innerHTML = '<p class="error-message">Failed to load announcements.</p>';
    }
}

async function publishAnnouncement() {
    const announcementInput = document.getElementById('announcementInput');
    const text = announcementInput.value.trim();

    if (!text) {
        showNotification('Announcement text cannot be empty.', 'warning');
        return;
    }

    const publishButton = document.getElementById('publishButton');
    publishButton.disabled = true;
    publishButton.textContent = 'Publishing...';
    showNotification('Publishing announcement...', 'info');

    // It's assumed your backend will check if the connected wallet has permission to publish
    const result = await postData('/announcements', { text, authorWallet: currentWalletAddress });
    if (result) {
        showNotification('Announcement successfully published!', 'success');
        announcementInput.value = '';
        loadAnnouncements(); // Reload to show the new announcement
    } else {
        showNotification('Failed to publish announcement.', 'error');
    }
    publishButton.disabled = false;
    publishButton.textContent = 'Publish Announcement';
}


// --- Games ---
async function loadGames() {
    const gameList = document.getElementById('game-list');
    if (!gameList) return;
    gameList.innerHTML = '<p class="loading-message">Loading games...</p>';

    const games = await fetchData('/games');
    if (games) {
        gameList.innerHTML = '';
        if (games.length === 0) {
            gameList.innerHTML = '<p class="no-data-message">No games found.</p>';
            return;
        }
        games.forEach(game => {
            gameList.innerHTML += `
                <div class="game-item web3-placeholder game">
                    <h4>${game.title}</h4>
                    <p>${game.description}</p>
                    <small>Developer: ${game.developer ? truncateAddress(game.developer) : 'N/A'}</small>
                    ${game.url ? `<a href="${game.url}" target="_blank" rel="noopener noreferrer" class="web3-btn small-btn">Play</a>` : '<p>Game link not available.</p>'}
                </div>
            `;
        });
    } else {
        gameList.innerHTML = '<p class="error-message">Failed to load games.</p>';
    }
}

async function uploadGame() {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to upload a game.', 'warning');
        return;
    }
    const gameTitle = prompt("Enter game title:");
    const gameDescription = prompt("Enter game description:");
    const gameUrl = prompt("Enter game URL (if any):");

    if (!gameTitle || !gameDescription) {
        showNotification('Game title and description are required.', 'warning');
        return;
    }

    const gameData = {
        title: gameTitle,
        description: gameDescription,
        developer: currentWalletAddress,
        url: gameUrl || '',
    };

    const result = await postData('/games', gameData);
    if (result) {
        showNotification('Game successfully uploaded!', 'success');
        loadGames(); // Reload the game list
    } else {
        showNotification('Failed to upload game.', 'error');
    }
}


// --- Advertisements ---
async function loadAds() {
    const adList = document.getElementById('ad-list');
    if (!adList) return;
    adList.innerHTML = '<p class="loading-message">Loading ads...</p>';

    const ads = await fetchData('/ads');
    if (ads) {
        adList.innerHTML = '';
        if (ads.length === 0) {
            adList.innerHTML = '<p class="no-data-message">No ads found.</p>';
            return;
        }
        ads.forEach(ad => {
            adList.innerHTML += `
                <div class="ad-item web3-placeholder ad">
                    ${ad.imageUrl ? `<img src="${ad.imageUrl}" alt="${ad.title}" class="ad-image">` : ''}
                    <h4>${ad.title}</h4>
                    <p>${ad.content}</p>
                    <small>Advertiser: ${ad.advertiser ? truncateAddress(ad.advertiser) : 'N/A'}</small>
                    ${ad.link ? `<a href="${ad.link}" target="_blank" rel="noopener noreferrer" class="web3-btn small-btn">Learn More</a>` : ''}
                </div>
            `;
        });
    } else {
        adList.innerHTML = '<p class="error-message">Failed to load ads.</p>';
    }
}

async function postAd() {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to post an ad.', 'warning');
        return;
    }
    const adTitle = prompt("Enter ad title:");
    const adContent = prompt("Enter ad content:");
    const adLink = prompt("Enter ad link (if any):");
    const adImageUrl = prompt("Enter ad image URL (if any):");

    if (!adTitle || !adContent) {
        showNotification('Ad title and content are required.', 'warning');
        return;
    }

    const adData = {
        title: adTitle,
        content: adContent,
        advertiser: currentWalletAddress,
        link: adLink || '',
        imageUrl: adImageUrl || '',
    };

    const result = await postData('/ads', adData);
    if (result) {
        showNotification('Ad successfully posted!', 'success');
        loadAds(); // Reload the ad list
    } else {
        showNotification('Failed to post ad.', 'error');
    }
}


// --- NFT Portal ---

async function loadMarketplaceNfts() {
    const marketplaceNftList = document.getElementById('marketplace-nft-list');
    if (!marketplaceNftList) return;
    marketplaceNftList.innerHTML = '<p class="loading-message">Loading marketplace NFTs...</p>';

    const response = await fetchData('/nfts/marketplace');
    if (response && response.nfts) {
        const nfts = response.nfts;
        marketplaceNftList.innerHTML = '';
        if (nfts.length === 0) {
            marketplaceNftList.innerHTML = '<p class="no-data-message">No NFTs found on the marketplace.</p>';
            return;
        }
        nfts.forEach(nft => {
            const nftCard = document.createElement('div');
            nftCard.className = 'nft-card marketplace-nft';
            nftCard.innerHTML = `
                <img src="${nft.image}" alt="${nft.name}">
                <h4>${nft.name}</h4>
                <p>${nft.description}</p>
                <p><strong>Owner:</strong> ${truncateAddress(nft.owner)}</p>
                ${nft.isListed ? `<p><strong>Price:</strong> ${nft.price} SOL</p>` : '<p>Not listed for sale</p>'}
                <button class="web3-btn small-btn view-nft-details" data-nft-id="${nft._id}">Details</button>
                ${nft.isListed && nft.owner !== currentWalletAddress ? `<button class="web3-btn small-btn buy-nft-btn" data-nft-id="${nft._id}" data-nft-price="${nft.price}" data-nft-mint="${nft.mint}">Buy</button>` : ''}
            `;
            marketplaceNftList.appendChild(nftCard);
        });
        attachNftDetailListeners();
        attachBuyNftListeners();
    } else {
        marketplaceNftList.innerHTML = '<p class="error-message">Failed to load marketplace NFTs.</p>';
    }
}

async function loadUserNfts() {
    const userNftList = document.getElementById('user-nft-list');
    if (!userNftList) return;
    userNftList.innerHTML = '<p class="loading-message">Loading your NFTs...</p>';

    if (!currentWalletAddress) {
        userNftList.innerHTML = '<p class="info-message">Connect your wallet to view your NFTs.</p>';
        return;
    }

    // In a real dApp, you would query NFTs associated with currentWalletAddress
    // For example, via a blockchain indexer or your backend that tracks them.
    // For now, we simulate:
    const allNftsResponse = await fetchData(`/nfts/user/${currentWalletAddress}`); // Assumes you have an endpoint for user NFTs
    if (allNftsResponse && allNftsResponse.nfts) {
        const userNfts = allNftsResponse.nfts;
        userNftList.innerHTML = '';
        const nftToSellSelect = document.getElementById('nftToSell');
        nftToSellSelect.innerHTML = '<option value="">-- Please select an NFT --</option>'; // Clear previous options

        if (userNfts.length === 0) {
            userNftList.innerHTML = '<p class="no-data-message">You do not have any NFTs on this platform yet.</p>';
            return;
        }

        userNfts.forEach(nft => {
            const nftCard = document.createElement('div');
            nftCard.className = 'nft-card user-nft';
            nftCard.innerHTML = `
                <img src="${nft.image}" alt="${nft.name}">
                <h4>${nft.name}</h4>
                <p>${nft.description}</p>
                <p>Mint: ${truncateAddress(nft.mint)}</p>
                ${nft.isListed ? `<p>Listed: ${nft.price} SOL</p>` : '<p>Not listed</p>'}
                <button class="web3-btn small-btn view-nft-details" data-nft-id="${nft._id}">Details</button>
                ${!nft.isListed ? `<button class="web3-btn small-btn list-my-nft-btn" data-nft-id="${nft._id}">List for Sale</button>` : ''}
            `;
            userNftList.appendChild(nftCard);

            // Populate the "List for Sale" dropdown
            if (!nft.isListed) { // Only unlisted NFTs can be selected for sale
                const option = document.createElement('option');
                option.value = nft._id; // Use MongoDB ID for selection
                option.textContent = `${nft.name} (Mint: ${truncateAddress(nft.mint)})`;
                nftToSellSelect.appendChild(option);
            }
        });
        attachNftDetailListeners();
        attachListMyNftListeners(); // Attach listener for "List for Sale" button
    } else {
        userNftList.innerHTML = '<p class="error-message">Failed to load your NFTs.</p>';
    }
}

async function mintNft(event) {
    event.preventDefault();
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to create an NFT.', 'warning');
        return;
    }

    const form = document.getElementById('mintNftFormSection');
    const formData = new FormData();
    const nftFile = form.elements.nftFile.files[0];
    const nftName = form.elements.mintNftName.value;
    const nftDescription = form.elements.mintNftDescription.value;
    const nftAttributes = form.elements.mintNftAttributes.value.trim();

    if (!nftFile || !nftName || !nftDescription) {
        showNotification('Please fill in all required fields (Image, Name, Description).', 'warning');
        return;
    }

    formData.append('nftFile', nftFile);
    formData.append('name', nftName);
    formData.append('description', nftDescription);
    formData.append('creatorWallet', currentWalletAddress);

    if (nftAttributes) {
        try {
            // Check if it's valid JSON
            JSON.parse(nftAttributes);
            formData.append('attributes', nftAttributes);
        } catch (e) {
            showNotification('Attributes must be in JSON format (e.g., `[{"trait_type": "Rarity", "value": "Rare"}]`). Minting without attributes.', 'warning');
            // If attributes are invalid, just don't add them to FormData or handle differently
        }
    }

    const mintButton = form.querySelector('button[type="submit"]');
    mintButton.disabled = true;
    mintButton.textContent = 'Creating...';
    showNotification('Preparing to create your NFT...', 'info');

    try {
        // It's assumed your backend will handle file upload to IPFS (or another CDN)
        // and return an image link, then prepare data for minting.
        // Actual minting on the blockchain is usually done on the backend or requires smart contract interaction.
        const result = await postData('/nfts/mint', formData, true); // `true` means it's FormData
        if (result) {
            showNotification(`NFT successfully created! Mint address: ${truncateAddress(result.mintAddress)}`, 'success');
            form.reset();
            loadUserNfts(); // Reload user NFTs
            loadMarketplaceNfts(); // Update marketplace
        }
    } catch (error) {
        showNotification(`Failed to create NFT: ${error.message}`, 'error');
    } finally {
        mintButton.disabled = false;
        mintButton.textContent = 'Create NFT';
    }
}

async function listNftForSale(event) {
    event.preventDefault();
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to list an NFT for sale.', 'warning');
        return;
    }

    const nftToSellId = document.getElementById('nftToSell').value;
    const price = parseFloat(document.getElementById('salePrice').value);
    const duration = parseInt(document.getElementById('listingDuration').value); // Duration is not used in this example, but left for extension

    if (!nftToSellId || isNaN(price) || price <= 0) {
        showNotification('Please select an NFT and enter a valid price.', 'warning');
        return;
    }

    const listButton = event.target.querySelector('button[type="submit"]');
    listButton.disabled = true;
    listButton.textContent = 'Listing...';
    showNotification('Listing NFT for sale...', 'info');

    // Get NFT mintAddress by its MongoDB ID
    const userNftsResponse = await fetchData(`/nfts/user/${currentWalletAddress}`);
    const selectedNft = userNftsResponse && userNftsResponse.nfts ? userNftsResponse.nfts.find(nft => nft._id === nftToSellId) : null;

    if (!selectedNft) {
        showNotification('Selected NFT not found in your collection.', 'error');
        listButton.disabled = false;
        listButton.textContent = 'List NFT';
        return;
    }

    try {
        // In a real dApp, this operation would initiate a blockchain transaction (e.g., interaction with a marketplace program)
        const result = await postData('/nfts/list', {
            nftId: nftToSellId, // Send MongoDB ID
            price: price,
            sellerWallet: currentWalletAddress,
            // duration: duration, // Can be added if your smart contract/backend supports it
        });

        if (result) {
            showNotification(`NFT "${selectedNft.name}" successfully listed for ${price} SOL!`, 'success');
            document.getElementById('listNftForm').reset();
            loadUserNfts();
            loadMarketplaceNfts();
        }
    } catch (error) {
        showNotification(`Failed to list NFT: ${error.message}`, 'error');
    } finally {
        listButton.disabled = false;
        listButton.textContent = 'List NFT';
    }
}

async function buyNft(nftId, price, mintAddress) {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to buy an NFT.', 'warning');
        return;
    }

    if (!phantomWallet || !phantomWallet.publicKey) {
        showNotification('Wallet not connected.', 'error');
        return;
    }

    // Get current SOL balance for checking
    let solBalanceInLamports = 0;
    try {
        solBalanceInLamports = await solanaConnection.getBalance(phantomWallet.publicKey);
        const solBalance = solBalanceInLamports / solanaWeb3.LAMPORTS_PER_SOL;
        if (solBalance < price) {
            showNotification(`Insufficient SOL for purchase. You need ${price} SOL, you have ${solBalance.toFixed(4)} SOL.`, 'error');
            return;
        }
    } catch (balanceError) {
        console.error("Error getting SOL balance:", balanceError);
        showNotification("Failed to check your SOL balance. Please try again.", "error");
        return;
    }


    showNotification(`Attempting to buy NFT (Mint: ${truncateAddress(mintAddress)}) for ${price} SOL...`, 'info');

    try {
        // --- REAL NFT PURCHASE LOGIC ---
        // 1. Get listing information from the backend (to ensure the NFT is still for sale)
        const listingInfo = await fetchData(`/nfts/listing/${nftId}`);
        if (!listingInfo || !listingInfo.isListed || listingInfo.price !== price) {
             showNotification('This NFT is no longer available at the specified price or has already been sold.', 'error');
             loadMarketplaceNfts(); // Update the marketplace list
             return;
        }

        // 2. Create a transaction to buy the NFT.
        // This could be a direct SOL transfer to the seller or interaction with a marketplace smart contract.
        // For simplicity, we simulate a direct SOL transfer to the seller. A real marketplace is more complex.

        const sellerPublicKey = new solanaWeb3.PublicKey(listingInfo.sellerWallet);
        const amountInLamports = price * solanaWeb3.LAMPORTS_PER_SOL;

        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: phantomWallet.publicKey,
                toPubkey: sellerPublicKey,
                lamports: amountInLamports,
            })
        );

        // 3. Get a recent blockhash
        const { blockhash } = await solanaConnection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = phantomWallet.publicKey;

        // 4. Sign the transaction via Phantom wallet
        const signedTransaction = await phantomWallet.signTransaction(transaction);

        // 5. Send the transaction to the Solana network
        const signature = await solanaConnection.sendRawTransaction(signedTransaction.serialize());

        // 6. Await transaction confirmation
        showNotification('Transaction sent, awaiting confirmation...', 'info');
        await solanaConnection.confirmTransaction(signature, 'confirmed');

        showNotification(`NFT purchase successful! Tx: ${truncateAddress(signature)}`, 'success');

        // --- BACKEND UPDATE ---
        // After a successful blockchain transaction, you would update the NFT status on the backend:
        const updateResult = await postData(`/nfts/buy`, {
            nftId: nftId,
            newOwnerWallet: currentWalletAddress,
            isListed: false, // After purchase, NFT should no longer be listed
            price: null // Reset price
        });

        if (updateResult) {
            showNotification(`NFT owner updated on the platform!`, 'success');
            loadMarketplaceNfts();
            loadUserNfts();
            document.getElementById('nftDetailsModal').style.display = 'none'; // Close modal window
        } else {
             showNotification(`Failed to update NFT owner on the backend. Please contact support.`, 'error');
        }

    } catch (error) {
        console.error('Error during NFT purchase:', error);
        showNotification(`NFT purchase failed: ${error.message}. Check console for details.`, 'error');
    }
}

async function transferNft(nftId, recipientWallet) {
    if (!currentWalletAddress || !phantomWallet || !phantomWallet.publicKey) {
        showNotification('Please connect your wallet to transfer NFT.', 'warning');
        return;
    }

    if (!recipientWallet) {
        showNotification('Please enter recipient address.', 'warning');
        return;
    }

    try {
        const allNftsResponse = await fetchData(`/nfts/user/${currentWalletAddress}`);
        const nftToTransfer = allNftsResponse && allNftsResponse.nfts ? allNftsResponse.nfts.find(nft => nft._id === nftId) : null;

        if (!nftToTransfer) {
            showNotification('NFT to transfer not found in your collection.', 'error');
            return;
        }

        const mintPublicKey = new solanaWeb3.PublicKey(nftToTransfer.mint);
        const sourceTokenAccount = await splToken.Token.getAssociatedTokenAddress(
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
            splToken.TOKEN_PROGRAM_ID,
            mintPublicKey,
            phantomWallet.publicKey
        );

        const destinationPublicKey = new solanaWeb3.PublicKey(recipientWallet);
        const destinationTokenAccount = await splToken.Token.getAssociatedTokenAddress(
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
            splToken.TOKEN_PROGRAM_ID,
            mintPublicKey,
            destinationPublicKey
        );

        const transaction = new solanaWeb3.Transaction();

        // Check if the recipient's Associated Token Account exists. If not, create it.
        try {
            await solanaConnection.getAccountInfo(destinationTokenAccount);
        } catch (e) {
            transaction.add(
                splToken.Token.createAssociatedTokenAccountInstruction(
                    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    splToken.TOKEN_PROGRAM_ID,
                    mintPublicKey,
                    destinationTokenAccount,
                    destinationPublicKey,
                    phantomWallet.publicKey
                )
            );
        }

        transaction.add(
            splToken.Token.createTransferInstruction(
                splToken.TOKEN_PROGRAM_ID,
                sourceTokenAccount,
                destinationTokenAccount,
                phantomWallet.publicKey,
                [],
                1 // Transfer 1 token (for NFT)
            )
        );

        const { blockhash } = await solanaConnection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = phantomWallet.publicKey;

        showNotification(`Sending NFT "${nftToTransfer.name}" to ${truncateAddress(recipientWallet)}...`, 'info');

        const signedTransaction = await phantomWallet.signTransaction(transaction);
        const signature = await solanaConnection.sendRawTransaction(signedTransaction.serialize());
        await solanaConnection.confirmTransaction(signature, 'confirmed');

        showNotification(`NFT successfully transferred! Tx: ${truncateAddress(signature)}`, 'success');

        // Update owner on the backend
        await postData(`/nfts/transfer`, {
            nftId: nftId,
            newOwnerWallet: recipientWallet
        });
        loadUserNfts();
        loadMarketplaceNfts();
        document.getElementById('nftDetailsModal').style.display = 'none';

    } catch (error) {
        console.error('Error transferring NFT:', error);
        showNotification(`Failed to transfer NFT: ${error.message}`, 'error');
    }
}


// Attach event listeners for dynamically added NFT detail buttons
function attachNftDetailListeners() {
    document.querySelectorAll('.view-nft-details').forEach(button => {
        button.onclick = async (e) => {
            const nftId = e.target.dataset.nftId;
            const allNftsResponse = await fetchData('/nfts/marketplace'); // Get all to find by ID
            const nft = allNftsResponse && allNftsResponse.nfts ? allNftsResponse.nfts.find(item => item._id === nftId) : null;

            if (nft) {
                const modal = document.getElementById('nftDetailsModal');
                document.getElementById('nftDetailImage').src = nft.image;
                document.getElementById('nftDetailName').textContent = nft.name;
                document.getElementById('nftDetailDescription').textContent = nft.description;
                document.getElementById('nftDetailOwner').textContent = truncateAddress(nft.owner);
                document.getElementById('nftDetailMint').textContent = truncateAddress(nft.mint);

                const attributesList = document.getElementById('attributesList');
                attributesList.innerHTML = '';
                try {
                    const attributes = typeof nft.attributes === 'string' ? JSON.parse(nft.attributes) : nft.attributes;
                    if (attributes && Array.isArray(attributes) && attributes.length > 0) {
                        attributes.forEach(attr => {
                            const li = document.createElement('li');
                            li.textContent = `${attr.trait_type}: ${attr.value}`;
                            attributesList.appendChild(li);
                        });
                    } else {
                        attributesList.innerHTML = '<li>No attributes</li>';
                    }
                } catch (e) {
                    attributesList.innerHTML = '<li>Error loading attributes.</li>';
                    console.error("Error parsing NFT attributes:", e);
                }


                // Simulate transaction history
                document.getElementById('nftDetailHistory').textContent = 'Loading simulated history...';
                setTimeout(() => {
                    document.getElementById('nftDetailHistory').textContent = `Created by ${truncateAddress(nft.creatorWallet || 'N/A')} on ${new Date(nft.date).toLocaleDateString()}. Current owner: ${truncateAddress(nft.owner)}.`;
                }, 1000);

                const solscanLink = `https://solscan.io/token/${nft.mint}?cluster=devnet`; // Change cluster if necessary
                document.getElementById('nftDetailSolscanLink').href = solscanLink;

                const buyBtn = document.getElementById('nftDetailBuyBtn');
                const sellBtn = document.getElementById('nftDetailSellBtn');
                const transferBtn = document.getElementById('nftDetailTransferBtn');

                // Logic for Buy/Sell/Transfer buttons
                if (nft.isListed && nft.owner !== currentWalletAddress) {
                    buyBtn.style.display = 'inline-block';
                    buyBtn.onclick = () => buyNft(nft._id, nft.price, nft.mint);
                } else {
                    buyBtn.style.display = 'none';
                }

                if (nft.owner === currentWalletAddress) {
                    sellBtn.style.display = 'inline-block';
                    sellBtn.onclick = () => {
                        // Populate NFT listing form and scroll to it
                        document.getElementById('nftToSell').value = nft._id;
                        document.getElementById('nftDetailsModal').style.display = 'none';
                        document.getElementById('nft-section').scrollIntoView({ behavior: 'smooth' });
                    };
                    transferBtn.style.display = 'inline-block';
                    transferBtn.onclick = async () => {
                        const recipient = prompt("Enter recipient wallet address:");
                        if (recipient) {
                            await transferNft(nft._id, recipient);
                        } else {
                            showNotification("Transfer canceled.", "info");
                        }
                    };
                } else {
                    sellBtn.style.display = 'none';
                    transferBtn.style.display = 'none';
                }

                modal.style.display = 'block';
            } else {
                showNotification('NFT details not found.', 'error');
            }
        };
    });
}

function attachBuyNftListeners() {
    document.querySelectorAll('.buy-nft-btn').forEach(button => {
        button.onclick = (e) => {
            const nftId = e.target.dataset.nftId;
            const price = parseFloat(e.target.dataset.nftPrice);
            const mintAddress = e.target.dataset.nftMint;
            buyNft(nftId, price, mintAddress);
        };
    });
}

function attachListMyNftListeners() {
    document.querySelectorAll('.list-my-nft-btn').forEach(button => {
        button.onclick = (e) => {
            const nftId = e.target.dataset.nftId;
            document.getElementById('nftToSell').value = nftId;
            document.getElementById('nft-section').scrollIntoView({ behavior: 'smooth' });
            showNotification('Select an NFT in the "List Your NFT for Sale" form below.', 'info');
        };
    });
}


// --- Posts (blog) ---
async function loadPosts() {
    const postsList = document.querySelector('#aurum-news .news-content'); // Use the same container as for news
    if (!postsList) return;
    postsList.innerHTML = '<p class="loading-message">Loading news and posts...</p>';

    const posts = await fetchData('/posts'); // Assumes you have a /posts endpoint
    if (posts) {
        postsList.innerHTML = '';
        if (posts.length === 0) {
            postsList.innerHTML = '<p class="no-data-message">No news or posts found.</p>';
            return;
        }
        posts.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date
        posts.forEach(post => {
            const date = new Date(post.date).toLocaleDateString();
            postsList.innerHTML += `
                <div class="news-item">
                    <h4>${post.title}</h4>
                    <p>${post.content}</p>
                    <small>By ${post.authorWallet ? truncateAddress(post.authorWallet) : 'Anonymous'} on ${date}</small>
                </div>
            `;
        });
    } else {
        postsList.innerHTML = '<p class="error-message">Failed to load news and posts.</p>';
    }
}


// --- DAO ---
// (Simulation, as a real DAO requires complex blockchain logic)

const proposals = []; // Local storage for DAO proposal simulation
let nextProposalId = 1;

async function displayProposals() {
    const activeList = document.getElementById('active-proposals-list');
    const completedList = document.getElementById('completed-proposals-list');

    if (!activeList || !completedList) return;

    activeList.innerHTML = '<p class="loading-message">Loading active proposals...</p>';
    completedList.innerHTML = '<p class="loading-message">Loading completed proposals...</p>';

    const now = Date.now();

    // In a real application, you would fetch proposals from your backend/smart contract
    // For now, we simulate, but could load from backend:
    const fetchedProposals = await fetchData('/dao/proposals');

    activeList.innerHTML = ''; // Clear after loading
    completedList.innerHTML = ''; // Clear after loading

    if (!fetchedProposals || fetchedProposals.length === 0) {
        activeList.innerHTML = '<p class="no-data-message">No active proposals at the moment.</p>';
        completedList.innerHTML = '<p class="no-data-message">No completed proposals yet.</p>';
        return;
    }

    // Update local array for voting simulation
    // In a real DAO, each vote would be a separate record on the blockchain or in a database.
    proposals.length = 0; // Clear local array
    fetchedProposals.forEach(p => proposals.push(p));

    proposals.forEach(p => {
        const item = document.createElement('div');
        item.className = 'dao-proposal-item';
        item.innerHTML = `
            <h4>Proposal #${p.id}: ${p.title}</h4>
            <p>${p.description}</p>
            <p>Creator: <span class="dao-creator">${truncateAddress(p.creatorWallet)}</span></p>
            <p>Votes FOR: <span class="dao-votes-for">${p.votesFor}</span> | Votes AGAINST: <span class="dao-votes-against">${p.votesAgainst}</span></p>
            <p>Expires: ${new Date(p.expiresAt).toLocaleDateString()} ${new Date(p.expiresAt).toLocaleTimeString()}</p>
            <div class="dao-vote-buttons">
            </div>
        `;

        const voteButtonsContainer = item.querySelector('.dao-vote-buttons');

        // Check if the proposal has expired
        if (now < p.expiresAt) {
            voteButtonsContainer.innerHTML = `
                <button class="web3-btn dao-vote-btn" data-proposal-id="${p._id}" data-vote-type="for">Vote FOR</button>
                <button class="web3-btn dao-vote-btn" data-proposal-id="${p._id}" data-vote-type="against">Vote AGAINST</button>
            `;
            activeList.appendChild(item);
        } else {
            // Mark as completed and disable voting
            voteButtonsContainer.innerHTML = '<p>Voting closed</p>';
            completedList.appendChild(item);
        }
    });

    attachDaoVoteListeners();
}

function attachDaoVoteListeners() {
    document.querySelectorAll('.dao-vote-btn').forEach(button => {
        button.onclick = (e) => {
            if (!currentWalletAddress) {
                showNotification('Please connect your wallet to vote.', 'warning');
                return;
            }
            const proposalId = e.target.dataset.proposalId; // Use MongoDB ID
            const voteType = e.target.dataset.voteType; // 'for' or 'against'
            castDaoVote(proposalId, voteType, currentWalletAddress);
        };
    });
}

async function castDaoVote(proposalId, voteType, voterWallet) {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to vote.', 'warning');
        return;
    }

    const proposal = proposals.find(p => p._id === proposalId);
    if (!proposal) {
        showNotification('Proposal not found.', 'error');
        return;
    }

    if (Date.now() >= new Date(proposal.expiresAt).getTime()) {
        showNotification('Voting for this proposal has ended.', 'warning');
        return;
    }

    // In a real DAO, the check for already voted would be on the blockchain/backend
    // Here we use a simple simulation
    if (proposal.voters.includes(voterWallet)) {
        showNotification('You have already voted on this proposal.', 'warning');
        return;
    }

    const voteButton = document.querySelector(`.dao-vote-btn[data-proposal-id="${proposalId}"][data-vote-type="${voteType}"]`);
    if (voteButton) {
        voteButton.disabled = true;
        voteButton.textContent = 'Voting...';
    }
    showNotification('Submitting your vote...', 'info');

    try {
        const result = await postData(`/dao/vote`, {
            proposalId: proposalId,
            voteType: voteType,
            voterWallet: voterWallet
        });

        if (result) {
            showNotification(`You successfully voted "${voteType}" on proposal #${proposal.id}!`, 'success');
            displayProposals(); // Update UI
        }
    } catch (error) {
        showNotification(`Failed to vote: ${error.message}`, 'error');
    } finally {
        if (voteButton) {
            voteButton.disabled = false;
            voteButton.textContent = `Vote ${voteType === 'for' ? 'FOR' : 'AGAINST'}`;
        }
    }
}

async function createNewProposal(event) {
    event.preventDefault();
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to create a proposal.', 'warning');
        return;
    }

    const title = document.getElementById('proposalTitle').value.trim();
    const description = document.getElementById('proposalDescription').value.trim();

    if (!title || !description) {
        showNotification('Proposal title and description cannot be empty.', 'warning');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Creating...';
    showNotification('Submitting proposal...', 'info');

    try {
        // In a real DAO this would be a blockchain transaction (e.g., creating a proposal in a smart contract)
        const result = await postData('/dao/proposals', {
            title: title,
            description: description,
            creatorWallet: currentWalletAddress,
            // expiresAt will be calculated on the backend or in the smart contract
        });

        if (result) {
            showNotification('Proposal successfully created!', 'success');
            document.getElementById('newProposalForm').reset();
            document.getElementById('createProposalModal').style.display = 'none';
            displayProposals(); // Update UI
        }
    } catch (error) {
        showNotification(`Failed to create proposal: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Proposal';
    }
}

// --- Staking (Simulation) ---
let userAfoxBalance = 0;
let userStakedAmount = 0;
let userRewardsAmount = 0;
const STAKING_APR = 10; // 10% annual percentage rate
const MIN_STAKE_AMOUNT = 1;

function updateStakingUI() {
    document.getElementById('userAfoxBalance').textContent = `${userAfoxBalance.toFixed(2)} AFOX`;
    document.getElementById('userStakedAmount').textContent = `${userStakedAmount.toFixed(2)} AFOX`;
    document.getElementById('userRewardsAmount').textContent = `${userRewardsAmount.toFixed(2)} AFOX`;
    document.getElementById('stakingApr').textContent = `${STAKING_APR}%`;
    document.getElementById('minStakeAmount').textContent = `${MIN_STAKE_AMOUNT} AFOX`;
}

async function loadUserAfoxBalance() {
    if (!currentWalletAddress) {
        document.getElementById('userAfoxBalance').textContent = 'Connect Wallet';
        document.getElementById('userStakedAmount').textContent = '0 AFOX';
        document.getElementById('userRewardsAmount').textContent = '0 AFOX';
        return;
    }
    // In a real application: query AFOX balance from Solana network and staking data from backend/smart contract
    // For demonstration, we simulate:
    try {
        const tokenAccountInfo = await solanaConnection.getParsedTokenAccountsByOwner(
            new solanaWeb3.PublicKey(currentWalletAddress),
            { mint: new solanaWeb3.PublicKey('GLkewtq8s2Yr24o5LT5mzzEeccKuSsy8H5RCHaE9uRAd') } // Your AFOX mint address
        );

        if (tokenAccountInfo.value.length > 0) {
            userAfoxBalance = tokenAccountInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        } else {
            userAfoxBalance = 0;
        }

        // Load staking data from backend
        const stakingData = await fetchData(`/staking/${currentWalletAddress}`);
        if (stakingData) {
            userStakedAmount = stakingData.stakedAmount || 0;
            userRewardsAmount = stakingData.rewards || 0;
        } else {
            userStakedAmount = 0;
            userRewardsAmount = 0;
        }

        showNotification(`AFOX balance and staking data loaded.`, 'info');

    } catch (error) {
        console.error('Error loading AFOX balance or staking data:', error);
        showNotification('Failed to load AFOX balance or staking data.', 'error');
        userAfoxBalance = 0; // Reset if error
        userStakedAmount = 0;
        userRewardsAmount = 0;
    } finally {
        updateStakingUI();
    }
}

// Simulate daily rewards - in a real dApp, this would be either on-chain or calculated by the backend
function simulateDailyRewards() {
    if (userStakedAmount > 0) {
        const dailyRate = STAKING_APR / 100 / 365;
        userRewardsAmount += userStakedAmount * dailyRate;
        updateStakingUI();
    }
}
setInterval(simulateDailyRewards, 5000); // Simulate rewards accrual every 5 seconds

async function handleStakeAfox() {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to stake.', 'warning');
        return;
    }
    const amount = parseFloat(document.getElementById('stakeAmountInput').value);
    if (isNaN(amount) || amount < MIN_STAKE_AMOUNT || amount > userAfoxBalance) {
        showNotification(`Please enter a valid amount (minimum ${MIN_STAKE_AMOUNT} AFOX) within your balance.`, 'warning');
        return;
    }

    const stakeButton = document.getElementById('stakeAfoxBtn');
    stakeButton.disabled = true;
    stakeButton.textContent = 'Staking...';
    showNotification('Sending AFOX for staking...', 'info');

    try {
        // In a real application:
        // 1. Create a staking transaction (interaction with the staking smart contract)
        // Example: transfer AFOX to the staking smart contract address
        // const stakeProgramId = new solanaWeb3.PublicKey('STAKING_PROGRAM_ADDRESS');
        // const afoxtokenMint = new solanaWeb3.PublicKey('GLkewtq8s2Yr24o5LT5mzzEeccKuSsy8H5RCHaE9uRAd');
        // const fromTokenAccount = await splToken.Token.getAssociatedTokenAddress(
        //     splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, afoxtokenMint, phantomWallet.publicKey
        // );
        // const toStakeAccount = // (your logic for the staking account on the smart contract);
        // const transaction = new solanaWeb3.Transaction().add(
        //     splToken.Token.createTransferInstruction(
        //         splToken.TOKEN_PROGRAM_ID,
        //         fromTokenAccount,
        //         toStakeAccount,
        //         phantomWallet.publicKey,
        //         [],
        //         amount * (10 ** 9) // Convert to lamports if token has 9 decimal places
        //     )
        // );
        // const { blockhash } = await solanaConnection.getRecentBlockhash();
        // transaction.recentBlockhash = blockhash;
        // transaction.feePayer = phantomWallet.publicKey;
        // const signedTransaction = await phantomWallet.signTransaction(transaction);
        // const signature = await solanaConnection.sendRawTransaction(signedTransaction.serialize());
        // await solanaConnection.confirmTransaction(signature, 'confirmed');
        // showNotification(`Staking transaction confirmed: ${truncateAddress(signature)}`, 'success');

        // 2. After a successful blockchain transaction, update the state on the backend
        const result = await postData('/staking/stake', {
            walletAddress: currentWalletAddress,
            amount: amount
        });

        if (result) {
            userAfoxBalance -= amount;
            userStakedAmount += amount;
            showNotification(`${amount.toFixed(2)} AFOX successfully staked!`, 'success');
            document.getElementById('stakeAmountInput').value = '';
        }
    } catch (error) {
        console.error('Error staking AFOX:', error);
        showNotification(`Failed to stake AFOX: ${error.message}`, 'error');
    } finally {
        stakeButton.disabled = false;
        stakeButton.textContent = 'Stake';
        updateStakingUI();
        loadUserAfoxBalance(); // Reload for updated data
    }
}

async function handleClaimRewards() {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to claim rewards.', 'warning');
        return;
    }
    if (userRewardsAmount === 0) {
        showNotification('No rewards to claim.', 'info');
        return;
    }

    const claimButton = document.getElementById('claimRewardsBtn');
    claimButton.disabled = true;
    claimButton.textContent = 'Claiming...';
    showNotification('Claiming rewards...', 'info');

    try {
        // In a real application:
        // 1. Create a transaction to claim rewards (interaction with the staking smart contract)
        // 2. Sign and send the transaction
        // 3. Await confirmation

        // 2. After a successful blockchain transaction, update the state on the backend
        const result = await postData('/staking/claim-rewards', {
            walletAddress: currentWalletAddress
        });

        if (result) {
            userAfoxBalance += userRewardsAmount;
            userRewardsAmount = 0;
            showNotification('Rewards successfully claimed!', 'success');
        }
    } catch (error) {
        console.error('Error claiming rewards:', error);
        showNotification(`Failed to claim rewards: ${error.message}`, 'error');
    } finally {
        claimButton.disabled = false;
        claimButton.textContent = 'Claim Rewards';
        updateStakingUI();
        loadUserAfoxBalance();
    }
}

async function handleUnstakeAfox() {
    if (!currentWalletAddress) {
        showNotification('Please connect your wallet to unstake.', 'warning');
        return;
    }
    if (userStakedAmount === 0) {
        showNotification('You have no AFOX staked.', 'info');
        return;
    }

    const confirmUnstake = confirm(`Are you sure you want to unstake all ${userStakedAmount.toFixed(2)} AFOX? This will also reset any current unclaimed rewards.`);
    if (!confirmUnstake) return;

    const unstakeButton = document.getElementById('unstakeAfoxBtn');
    unstakeButton.disabled = true;
    unstakeButton.textContent = 'Unstaking...';
    showNotification('Unstaking AFOX...', 'info');

    try {
        // In a real application:
        // 1. Create a transaction to unstake
        // 2. Sign and send the transaction
        // 3. Await confirmation

        // 2. After a successful blockchain transaction, update the state on the backend
        const result = await postData('/staking/unstake', {
            walletAddress: currentWalletAddress
        });

        if (result) {
            userAfoxBalance += userStakedAmount;
            userStakedAmount = 0;
            userRewardsAmount = 0; // Rewards are usually reset when unstaking
            showNotification('AFOX successfully unstaked!', 'success');
        }
    } catch (error) {
        console.error('Error unstaking AFOX:', error);
        showNotification(`Failed to unstake AFOX: ${error.message}`, 'error');
    } finally {
        unstakeButton.disabled = false;
        unstakeButton.textContent = 'Unstake Tokens';
        updateStakingUI();
        loadUserAfoxBalance();
    }
}


// --- GENERAL UI MIDDLEWARE AND INITIALIZATION ---

// Hamburger Menu
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const closeMainMenuCross = document.getElementById('closeMainMenuCross');

    if (menuToggle && mainNav && closeMainMenuCross) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !isExpanded);
            mainNav.setAttribute('aria-hidden', isExpanded);
            mainNav.classList.toggle('active');
            // Add 'menu-open' class to body to block scrolling
            document.body.classList.toggle('menu-open', !isExpanded);
        });

        closeMainMenuCross.addEventListener('click', () => {
            menuToggle.setAttribute('aria-expanded', 'false');
            mainNav.setAttribute('aria-hidden', 'true');
            mainNav.classList.remove('active');
            document.body.classList.remove('menu-open');
        });

        // Close menu when clicking on a menu item
        mainNav.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', () => {
                menuToggle.setAttribute('aria-expanded', 'false');
                mainNav.setAttribute('aria-hidden', 'true');
                mainNav.classList.remove('active');
                document.body.classList.remove('menu-open');
            });
        });
    }

    // Close modals
    document.querySelectorAll('.modal .close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };


    // --- Button and Form Handlers ---

    // Copy button (for contract address)
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const addressSpan = e.target.previousElementSibling;
            if (addressSpan) {
                const textToCopy = addressSpan.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showNotification('Address copied to clipboard!', 'info');
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    showNotification('Failed to copy address.', 'error');
                });
            }
        });
    });

    // Web3 wallet connection buttons
    document.getElementById('connectWalletBtnWeb3')?.addEventListener('click', connectWallet);
    document.getElementById('connectWalletNftBtn')?.addEventListener('click', connectWallet);
    document.getElementById('connectWalletBtnDao')?.addEventListener('click', connectWallet);

    // Announcements
    document.getElementById('publishButton')?.addEventListener('click', publishAnnouncement);

    // Games
    document.getElementById('uploadGameBtnWeb3')?.addEventListener('click', uploadGame);
    document.getElementById('loadMoreGamesBtn')?.addEventListener('click', loadGames); // Just reload for demonstration

    // Advertisements (Ads)
    document.getElementById('postAdBtnWeb3')?.addEventListener('click', postAd);

    // NFT
    document.getElementById('mintNftBtn')?.addEventListener('click', () => {
        // Scroll to NFT creation section
        document.getElementById('mint-nft-section').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('mintNftFormSection')?.addEventListener('submit', mintNft);
    document.getElementById('listNftForm')?.addEventListener('submit', listNftForSale);
    document.getElementById('viewMyNftsBtn')?.addEventListener('click', loadUserNfts);

    // DAO
    document.getElementById('createProposalBtn')?.addEventListener('click', () => {
        if (!currentWalletAddress) {
            showNotification('Connect wallet to create a proposal.', 'warning');
            return;
        }
        document.getElementById('createProposalModal').style.display = 'block';
    });
    document.getElementById('closeProposalModal')?.addEventListener('click', () => {
        document.getElementById('createProposalModal').style.display = 'none';
    });
    document.getElementById('newProposalForm')?.addEventListener('submit', createNewProposal);

    // Staking
    document.getElementById('stakeAfoxBtn')?.addEventListener('click', handleStakeAfox);
    document.getElementById('claimRewardsBtn')?.addEventListener('click', handleClaimRewards);
    document.getElementById('unstakeAfoxBtn')?.addEventListener('click', handleUnstakeAfox);


    // --- Initial data load on startup ---
    initializeWallet(); // Initialize wallet on page load
    loadAnnouncements();
    loadGames();
    loadAds();
    loadMarketplaceNfts();
    loadPosts(); // Load posts in "News" section
    displayProposals(); // Initialize DAO UI
    updateStakingUI(); // Initialize staking UI
    loadUserAfoxBalance(); // Load initial AFOX balance (simulation)
});
