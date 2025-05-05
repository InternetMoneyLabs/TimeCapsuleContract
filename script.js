// Contract configuration
const CONTRACT_CONFIG = {
    feeAmount: 0.0001, // Fee in BTC
    feeRecipient: "tb1psc5acrr862j3c7qgfrspsdh72822wdym22gk5t8uar8j52wzxc0q3c3tql",
    unlockDays: 21, // Days until message unlocks
    unlockBlockHeight: 263527, // Block height when messages unlock (approx 3 months from block 250567)
    feeDistribution: {
        firstUnlocker: 30,
        secondUnlocker: 20,
        thirdUnlocker: 10,
        contractSupport: 40
    }
};

// Store wallet connection state
let walletConnected = false;
let currentAccount = null;
let currentWalletType = null;

// Global variables for pagination
let allMessages = [];
let currentPage = 1;
const messagesPerPage = 10;

// Check for existing connection on page load
document.addEventListener('DOMContentLoaded', async () => {
    await updateBlockHeightInfo();
    await loadStoredMessages();
    initVisitorCounter();
    setupDonationCopy();
    
    // Add character counter for message textarea
    const messageTextarea = document.getElementById('message');
    const charCount = document.getElementById('charCount');
    
    if (messageTextarea && charCount) {
        messageTextarea.addEventListener('input', function() {
            const message = this.value;
            charCount.textContent = message.length;
            
            // Calculate and display byte size
            const sizeInfo = calculateMessageBytes(message);
            const byteCount = document.getElementById('byteCount');
            if (byteCount) {
                byteCount.textContent = sizeInfo.base64Size;
                
                // Change color based on byte size
                if (!sizeInfo.withinLimit) {
                    byteCount.style.color = '#e74c3c';
                } else if (sizeInfo.base64Size > 60) {
                    byteCount.style.color = '#f39c12';
                } else {
                    byteCount.style.color = '';
                }
            }
            
            // Change color if approaching character limit
            if (message.length > 120) {
                charCount.style.color = '#e74c3c';
            } else if (message.length > 100) {
                charCount.style.color = '#f39c12';
            } else {
                charCount.style.color = '';
            }
        });
    }
    
    // Update the connect wallet button to show wallet selection modal
    const connectWalletBtn = document.getElementById("connectWallet");
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', function() {
            if (walletConnected) {
                disconnectWallet();
            } else {
                showWalletSelectionModal();
            }
        });
    }
});

// Setup donation address copy functionality
function setupDonationCopy() {
    const donationAddress = document.getElementById('donationAddress');
    const donationAddressText = document.getElementById('donationAddressText');
    
    if (donationAddress && donationAddressText) {
        donationAddress.addEventListener('click', function() {
            // Get the text content from the span
            const address = donationAddressText.textContent.trim();
            
            // Copy to clipboard
            navigator.clipboard.writeText(address)
                .then(() => {
                    // Show confirmation
                    const confirmation = this.querySelector('.copy-confirmation');
                    if (confirmation) {
                        confirmation.classList.add('show');
                        
                        // Hide after animation completes
                        setTimeout(() => {
                            confirmation.classList.remove('show');
                        }, 2000);
                    }
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                });
        });
    }
}

// Tab switching functionality
function switchTab(tabId, clickedButton) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show the selected tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate the clicked tab button
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

// Wait for wallet to be available
function waitForWallet(walletType, timeout = 3000) {
    return new Promise((resolve) => {
        let walletProvider = null;
        
        // Check if wallet is already available
        if (walletType === 'unisat' && window.unisat) walletProvider = window.unisat;
        if (walletType === 'xverse' && window.SatsConnect) walletProvider = window.SatsConnect;
        if (walletType === 'okx' && window.okxwallet && window.okxwallet.bitcoin) walletProvider = window.okxwallet.bitcoin;
        if (walletType === 'leather' && window.btc) walletProvider = window.btc;
        
        if (walletProvider) {
            return resolve(walletProvider);
        }
        
        // Set up polling if wallet is not immediately available
        let timer = null;
        const interval = setInterval(() => {
            if (walletType === 'unisat' && window.unisat) walletProvider = window.unisat;
            if (walletType === 'xverse' && window.SatsConnect) walletProvider = window.SatsConnect;
            if (walletType === 'okx' && window.okxwallet && window.okxwallet.bitcoin) walletProvider = window.okxwallet.bitcoin;
            if (walletType === 'leather' && window.btc) walletProvider = window.btc;
            
            if (walletProvider) {
                clearInterval(interval);
                clearTimeout(timer);
                return resolve(walletProvider);
            }
        }, 100);
        
        timer = setTimeout(() => {
            clearInterval(interval);
            return resolve(null);
        }, timeout);
    });
}

// Check if address is a testnet/signet address
function isTestnetAddress(address) {
    // Bitcoin testnet/signet addresses typically start with:
    // - tb1 (for SegWit)
    // - m, n, or 2 (for legacy)
    return address && (
        address.startsWith('tb1') || 
        address.startsWith('m') || 
        address.startsWith('n') || 
        address.startsWith('2')
    );
}

// Update wallet UI based on connection state
function updateWalletUI(connected, address = null) {
    const connectButton = document.getElementById("connectWallet");
    const walletStatus = document.getElementById("walletStatus");
    
    if (connected && address) {
        // Show wallet type if available
        const walletName = currentWalletType ? ` (${currentWalletType.charAt(0).toUpperCase() + currentWalletType.slice(1)})` : '';
        connectButton.innerText = `Disconnect${walletName}`;
        walletStatus.innerText = `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        walletStatus.style.color = '#2ecc71'; // Success color
    } else {
        connectButton.innerText = "Connect Wallet";
        walletStatus.innerText = "Wallet Status: Not Connected";
        walletStatus.style.color = ''; // Default color
    }
}

// Show wallet selection modal
function showWalletSelectionModal() {
    const walletModal = document.getElementById('walletSelectionModal');
    if (!walletModal) {
        console.error("Wallet selection modal not found!");
        return;
    }
    
    walletModal.classList.add('active');
    
    // Set up event listeners
    const walletModalClose = document.getElementById('walletModalClose');
    if (walletModalClose) {
        walletModalClose.onclick = closeWalletModal;
    }
    
    // Close when clicking outside
    walletModal.onclick = function(event) {
        if (event.target === walletModal) {
            closeWalletModal();
        }
    };
    
    // Set up wallet option buttons
    const walletOptions = document.querySelectorAll('.wallet-option');
    walletOptions.forEach(option => {
        option.onclick = function() {
            const walletType = this.getAttribute('data-wallet');
            connectWallet(walletType);
            closeWalletModal();
        };
    });
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
}

// Close wallet selection modal
function closeWalletModal() {
    const walletModal = document.getElementById('walletSelectionModal');
    if (walletModal) {
        walletModal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

// Connect to selected wallet
async function connectWallet(walletType) {
    console.log(`Attempting to connect to ${walletType} wallet...`);
    
    try {
        let accounts = [];
        let network = "unknown";
        let provider = null;
        
        switch(walletType) {
            case 'unisat':
                provider = await waitForWallet('unisat');
                if (!provider) throw new Error("Unisat wallet not found. Please install the Unisat browser extension.");
                
                try {
                    accounts = await provider.requestAccounts();
                } catch (connectionError) {
                    console.error("Error during Unisat requestAccounts:", connectionError);
                    // Try alternative connection method
                    try {
                        accounts = await provider.enable();
                    } catch (altError) {
                        throw new Error(`Unisat connection failed: ${altError.message || "Unknown error"}`);
                    }
                }
                
                network = await provider.getNetwork().catch(() => "unknown");
                break;
                
            case 'xverse':
                provider = await waitForWallet('xverse');
                if (!provider) throw new Error("Xverse wallet not found. Please install the Xverse browser extension.");
                
                try {
                    // Using the Sats Connect library approach
                    const getAddressOptions = {
                        payload: {
                            purposes: ['payment'],
                            message: 'Bitcoin Time Capsule needs your Signet address',
                            network: {
                                type: 'testnet'
                            }
                        },
                        onFinish: (response) => {
                            if (response && response.addresses && response.addresses.length > 0) {
                                const address = response.addresses[0].address;
                                accounts = [address];
                                network = 'testnet';
                                
                                // Continue with wallet connection
                                finishWalletConnection(accounts[0], network, walletType);
                            } else {
                                throw new Error("No testnet addresses found in Xverse.");
                            }
                        },
                        onCancel: () => {
                            throw new Error("Xverse wallet connection was cancelled.");
                        },
                        onError: (error) => {
                            throw new Error(`Xverse connection failed: ${error.message || "Unknown error"}`);
                        }
                    };
                    
                    // Call the getAddress method
                    provider.getAddress(getAddressOptions);
                    
                    // Return early as the connection will be handled in the callbacks
                    return;
                } catch (error) {
                    throw new Error(`Xverse connection failed: ${error.message || "Unknown error"}`);
                }
                break;
                
            case 'okx':
                provider = await waitForWallet('okx');
                if (!provider) throw new Error("OKX wallet not found. Please install the OKX wallet browser extension.");
                
                try {
                    const okxResult = await provider.connect();
                    if (!okxResult || okxResult.length === 0) {
                        throw new Error("No accounts found in OKX Wallet.");
                    }
                    accounts = okxResult;
                } catch (error) {
                    throw new Error(`OKX connection failed: ${error.message || "Unknown error"}`);
                }
                break;
                
            case 'leather':
                provider = await waitForWallet('leather');
                if (!provider) throw new Error("Leather wallet not found. Please install the Leather wallet browser extension.");
                
                try {
                    const leatherAccounts = await provider.request('getAddresses');
                    if (!leatherAccounts || leatherAccounts.length === 0) {
                        throw new Error("No accounts found in Leather Wallet.");
                    }
                    accounts = [leatherAccounts[0]];
                } catch (error) {
                    throw new Error(`Leather connection failed: ${error.message || "Unknown error"}`);
                }
                break;
                
            default:
                throw new Error(`Unsupported wallet type: ${walletType}`);
        }
        
        if (!accounts || accounts.length === 0) {
            throw new Error("Failed to retrieve accounts from the selected wallet.");
        }
        
        const address = accounts[0];
        currentAccount = address;
        
        // Check if on Signet/Testnet
        let isSignetOrTestnet = false;
        if (network && network !== "unknown") {
            const networkStr = String(network).toLowerCase();
            isSignetOrTestnet = networkStr.includes("signet") || networkStr.includes("testnet");
        }
        if (!isSignetOrTestnet) {
            isSignetOrTestnet = isTestnetAddress(address);
        }
        
        if (!isSignetOrTestnet) {
            throw new Error("You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
        }
        
        // Successfully connected
        walletConnected = true;
        currentWalletType = walletType;
        updateWalletUI(true, address);
        console.log(`${walletType} wallet connected successfully to Signet/Testnet.`);
        
    } catch (error) {
        console.error(`Error connecting to wallet:`, error);
        showModal("Connection Error", `<p>${error.message}</p>`);
        updateWalletUI(false);
    }
}

// Helper function to finish wallet connection after async callbacks
function finishWalletConnection(address, network, walletType) {
    try {
        currentAccount = address;
        
        // Check if on Signet/Testnet
        let isSignetOrTestnet = false;
        if (network && network !== "unknown") {
            const networkStr = String(network).toLowerCase();
            isSignetOrTestnet = networkStr.includes("signet") || networkStr.includes("testnet");
        }
        if (!isSignetOrTestnet) {
            isSignetOrTestnet = isTestnetAddress(address);
        }
        
        if (!isSignetOrTestnet) {
            showModal("Connection Error", "<p>You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.</p>");
            updateWalletUI(false);
            return;
        }
        
        // Successfully connected
        walletConnected = true;
        currentWalletType = walletType;
        updateWalletUI(true, address);
        console.log(`${walletType} wallet connected successfully to Signet/Testnet.`);
    } catch (error) {
        console.error(`Error finishing wallet connection:`, error);
        showModal("Connection Error", `<p>${error.message}</p>`);
        updateWalletUI(false);
    }
}

// Function to encode messages locally in the browser
function encryptMessage() {
    const message = document.getElementById("message").value;
    if (!message) {
        showModal("Empty Message", "<p>Please enter a message to encode.</p>");
        return;
    }
    
    // Check for unsupported characters/languages
    if (containsUnsupportedCharacters(message)) {
        const languagesList = getSupportedLanguages().map(lang => 
            `<div class="language-item">${lang}</div>`
        ).join('');
        
        showModal("Unsupported Language", `
            <p>Your message contains characters from an unsupported language. Currently, only Latin-based alphabets are supported.</p>
            <p>Supported languages include:</p>
            <div class="language-list">
                ${languagesList}
            </div>
            <p>Please modify your message to use only supported characters.</p>
        `);
        return;
    }
    
    // Check message length (reasonable limit for blockchain storage)
    if (message.length > 150) {
        showModal("Message Too Long", "<p>Message is too long. Please limit your message to 150 characters to ensure it can be stored on the blockchain.</p>");
        return;
    }
    
    // Check message byte size
    const sizeInfo = calculateMessageBytes(message);
    if (!sizeInfo.withinLimit) {
        showModal("Message Too Large", `<p>Your message is ${sizeInfo.base64Size} bytes after encoding, which exceeds the 80-byte OP_RETURN limit. Please shorten your message or use fewer special characters.</p>`);
        return;
    }
    
    // Check for inappropriate content
    const contentCheck = checkMessageContent(message);
    if (!contentCheck.valid) {
        showModal("Inappropriate Content", `<p>${contentCheck.reason}</p>`);
        return;
    }

    try {
        // Base64 encoding (not actual encryption)
        const encodedMessage = btoa(message); // Base64 encoding
        document.getElementById("encryptedMessageOutput").innerText = encodedMessage;
        console.log("Encoded Message:", encodedMessage);

        // Generate transaction data
        const txData = {
            message: encodedMessage,
            timestamp: Date.now(),
            unlockDate: new Date(Date.now() + (CONTRACT_CONFIG.unlockDays * 24 * 60 * 60 * 1000)).toISOString(),
            fee: CONTRACT_CONFIG.feeAmount
        };
        
        document.getElementById("output").innerHTML = `
            <div class="alert">
                <strong>Note:</strong> Messages are encoded with Base64, not encrypted. 
                They will be readable by anyone once the block height is reached.
            </div>
            <strong>Transaction Details:</strong><br>
            Fee: ${CONTRACT_CONFIG.feeAmount} Signet BTC<br>
            Recipient: ${CONTRACT_CONFIG.feeRecipient.substring(0, 6)}...${CONTRACT_CONFIG.feeRecipient.substring(CONTRACT_CONFIG.feeRecipient.length - 4)}<br>
            Unlock Date: ${new Date(txData.unlockDate).toLocaleDateString()}<br>
            Message Size: ${encodedMessage.length} bytes (${sizeInfo.utf8Size} UTF-8 bytes)
        `;

        // Display the encoding result
        document.getElementById("encryptionResult").style.display = "block";
        
        // Store transaction data for later use
        window.txData = txData;
        
    } catch (error) {
        console.error("Error encoding message:", error);
        showModal("Encoding Error", "<p>Failed to encode the message. Please try again.</p>");
    }
}

// Add a new message to the stored messages list
function addNewMessageToList(txId) {
    const storedMessagesList = document.getElementById("storedMessagesList");
    const currentDate = new Date().toLocaleDateString();
    
    const messageItem = document.createElement("div");
    messageItem.className = "message-item";
    messageItem.innerHTML = `
        <p><strong>Transaction:</strong> <a href="https://explorer.bc-2.jp/tx/${txId}" target="_blank">${txId.substring(0, 10)}...</a></p>
        <p><strong>Stored:</strong> ${currentDate} (just now)</p>
        <p><strong>Unlocks at block:</strong> ${CONTRACT_CONFIG.unlockBlockHeight}</p>
        <p><strong>Status:</strong> <span class="status-pending">Locked</span></p>
    `;
    
    // Add to the top of the list
    if (storedMessagesList.firstChild) {
        storedMessagesList.insertBefore(messageItem, storedMessagesList.firstChild);
    } else {
        storedMessagesList.appendChild(messageItem);
    }
    
    // Switch to the stored messages tab
    switchTab('storedTab', document.querySelector('.tab-btn[onclick*="storedTab"]'));
}

// Fetch current block height from an API with localStorage caching
async function getCurrentBlockHeight() {
    // Check localStorage cache first (30 minute cache)
    const cachedData = localStorage.getItem('blockHeightCache');
    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            const cacheAge = Date.now() - cache.timestamp;
            // Use cache if less than 30 minutes old
            if (cacheAge < 30 * 60 * 1000) {
                console.log("Using cached block height:", cache.blockHeight);
                return cache.blockHeight;
            }
        } catch (e) {
            console.warn("Error parsing cached block height:", e);
            // Continue to fetch fresh data if cache parsing fails
        }
    }

    // API endpoints in order of preference
    const apis = [
        // Hiro API (Stacks blockchain indexer with Bitcoin data)
        'https://api.hiro.so/ordinals/v1/stats',
        // Traditional Bitcoin APIs
        'https://mempool.space/signet/api/blocks/tip/height',
        'https://blockstream.info/signet/api/blocks/tip/height'
    ];
    
    for (const api of apis) {
        try {
            const response = await fetch(api, { 
                timeout: 5000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) continue;
            
            let blockHeight;
            
            // Parse response based on API format
            if (api.includes('hiro.so')) {
                // Hiro API returns JSON with different structure
                const data = await response.json();
                blockHeight = data.btcBlockHeight || data.latest_block_height;
            } else {
                // Other APIs return plain text
                const text = await response.text();
                blockHeight = parseInt(text);
            }
            
            if (blockHeight && !isNaN(blockHeight)) {
                // Cache the result in localStorage
                const cacheData = {
                    blockHeight: blockHeight,
                    timestamp: Date.now()
                };
                localStorage.setItem('blockHeightCache', JSON.stringify(cacheData));
                
                return blockHeight;
            }
        } catch (error) {
            console.warn(`Error fetching from ${api}:`, error);
            // Continue to next API
        }
    }
    
    console.error("All block height APIs failed");
    return null;
}

// Update block height information on the page
async function updateBlockHeightInfo() {
    const currentBlockHeightElement = document.getElementById("currentBlockHeight");
    const blocksRemainingElement = document.getElementById("blocksRemaining");
    const progressBar = document.getElementById("progressBar");
    const unlockBlockHeightElement = document.getElementById("unlockBlockHeight");
    const blockStatus = document.getElementById("blockStatus");
    
    // Set unlock block height from config
    if (unlockBlockHeightElement) {
        unlockBlockHeightElement.innerText = CONTRACT_CONFIG.unlockBlockHeight.toLocaleString();
    }
    
    try {
        const currentBlockHeight = await getCurrentBlockHeight();
        if (currentBlockHeight) {
            currentBlockHeightElement.innerText = currentBlockHeight.toLocaleString();
            
            const remainingBlocks = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
            blocksRemainingElement.innerText = remainingBlocks > 0 ? remainingBlocks.toLocaleString() : "0";
            
            // Update progress bar
            const startBlock = 250567; // Starting block when contract was created
            const totalBlocks = CONTRACT_CONFIG.unlockBlockHeight - startBlock;
            const completedBlocks = currentBlockHeight - startBlock;
            const progressPercentage = Math.min(100, Math.max(0, (completedBlocks / totalBlocks) * 100));
            
            if (progressBar) {
                progressBar.style.width = `${progressPercentage}%`;
            }
            
            // Update countdown timer
            updateCountdown(remainingBlocks);
            
            // Start the real-time countdown
            startRealTimeCountdown(remainingBlocks);
            
        } else {
            // Try to use last known block height from cache if API calls fail
            const cachedData = localStorage.getItem('blockHeightCache');
            if (cachedData) {
                try {
                    const cache = JSON.parse(cachedData);
                    const cacheAge = Date.now() - cache.timestamp;
                    const cacheAgeMinutes = Math.floor(cacheAge / (60 * 1000));
                    
                    currentBlockHeightElement.innerText = `${cache.blockHeight.toLocaleString()} (cached ${cacheAgeMinutes}m ago)`;
                    
                    const remainingBlocks = CONTRACT_CONFIG.unlockBlockHeight - cache.blockHeight;
                    blocksRemainingElement.innerText = remainingBlocks > 0 ? 
                        `~${remainingBlocks.toLocaleString()} (estimate)` : "0";
                    
                    // Update progress bar with cached data
                    const startBlock = 250567;
                    const totalBlocks = CONTRACT_CONFIG.unlockBlockHeight - startBlock;
                    const completedBlocks = cache.blockHeight - startBlock;
                    const progressPercentage = Math.min(100, Math.max(0, (completedBlocks / totalBlocks) * 100));
                    
                    if (progressBar) {
                        progressBar.style.width = `${progressPercentage}%`;
                    }
                    
                    // Update countdown with cached data
                    updateCountdown(remainingBlocks);
                    startRealTimeCountdown(remainingBlocks);
                    
                    if (blockStatus) {
                        blockStatus.innerHTML = `
                            <div class="status-indicator warning">
                                <p>⚠️ Using cached block height data from ${cacheAgeMinutes} minutes ago</p>
                                <p>Live block height information is currently unavailable</p>
                            </div>
                        `;
                    }
                    
                    return; // Exit early as we've handled the display with cached data
                } catch (e) {
                    console.warn("Error using cached block height:", e);
                    // Fall through to error handling if cache use fails
                }
            }
            
            // If no cache or cache use failed
            currentBlockHeightElement.innerText = "Unavailable";
            blocksRemainingElement.innerText = "Unknown";
            
            if (blockStatus) {
                blockStatus.innerHTML = `
                    <div class="status-indicator error">
                        <p>⚠️ Block height information is currently unavailable</p>
                        <p>Please check your connection and try again later</p>
                    </div>
                `;
            }
            
            // Set countdown to unknown
            updateCountdownToUnknown();
        }
    } catch (error) {
        console.error("Error updating block height info:", error);
        currentBlockHeightElement.innerText = "Error";
        blocksRemainingElement.innerText = "Error";
        
        if (blockStatus) {
            blockStatus.innerHTML = `
                <div class="status-indicator error">
                    <p>⚠️ Error retrieving block height information</p>
                    <p>Please try again later</p>
                </div>
            `;
        }
        
        updateCountdownToUnknown();
    }
    
    // Schedule next update in 5 minutes (reduced frequency to limit API calls)
    setTimeout(updateBlockHeightInfo, 5 * 60 * 1000);
}

function updateCountdownToUnknown() {
    const countdownDays = document.getElementById("countdownDays");
    const countdownHours = document.getElementById("countdownHours");
    const countdownMinutes = document.getElementById("countdownMinutes");
    const countdownSeconds = document.getElementById("countdownSeconds");
    
    if (countdownDays) countdownDays.innerText = "--";
    if (countdownHours) countdownHours.innerText = "--";
    if (countdownMinutes) countdownMinutes.innerText = "--";
    if (countdownSeconds) countdownSeconds.innerText = "--";
}

// Load stored messages (in a real implementation, these would come from an API)
async function loadStoredMessages() {
    const storedMessagesList = document.getElementById("storedMessagesList");
    const nextMessagesBtn = document.getElementById("nextMessagesBtn");
    
    if (!storedMessagesList) {
        console.error("storedMessagesList element not found");
        return;
    }
    
    // In a real implementation, you would fetch this data from bestinslot or another indexer
    // For demo purposes, let's create more sample messages to demonstrate pagination
    allMessages = [
        {
            txId: "9cd1e383b217bba2271b69cc5c0075c19f1d29307248cb50e75c18eb1842c3fc",
            storedDate: "April 28, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "7ab2d491c3e2f758e5f7832c9525c9c96c139c86b440264df394d8dd2e458a01",
            storedDate: "April 29, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "5fe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e1902b",
            storedDate: "April 30, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "6fe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e1902c",
            storedDate: "May 1, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "7fe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e1902d",
            storedDate: "May 1, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "8fe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e1902e",
            storedDate: "May 1, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "9fe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e1902f",
            storedDate: "May 2, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "afe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19030",
            storedDate: "May 2, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "bfe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19031",
            storedDate: "May 2, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "cfe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19032",
            storedDate: "May 2, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "dfe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19033",
            storedDate: "May 3, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "efe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19034",
            storedDate: "May 3, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        },
        {
            txId: "ffe72d45a19b2d5c0eb1e1d815d7175f4cb4a8a20cebc1acd7c2f73f29e19035",
            storedDate: "May 3, 2024",
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        }
    ];
    
    // Clear loading message
    storedMessagesList.innerHTML = "";
    
    // Get current block height to determine status
    const currentBlockHeight = await getCurrentBlockHeight();
    
    // Reset to first page
    currentPage = 1;
    
    // Display first page of messages
    displayMessages(currentBlockHeight);
    
    // Set up "Load More" button
    if (nextMessagesBtn) {
        // Show button only if there are more messages to load
        if (allMessages.length > messagesPerPage) {
            nextMessagesBtn.style.display = "block";
            nextMessagesBtn.onclick = () => {
                currentPage++;
                displayMessages(currentBlockHeight);
                
                // Hide button if we've shown all messages
                if (currentPage * messagesPerPage >= allMessages.length) {
                    nextMessagesBtn.style.display = "none";
                }
            };
        } else {
            nextMessagesBtn.style.display = "none";
        }
    }
    
    // Adjust display for tall screens
    adjustMessageListHeight();
}

// Display messages for the current page
function displayMessages(currentBlockHeight) {
    const storedMessagesList = document.getElementById("storedMessagesList");
    if (!storedMessagesList) return;
    
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = Math.min(startIndex + messagesPerPage, allMessages.length);
    
    // Get messages for current page
    const currentPageMessages = allMessages.slice(startIndex, endIndex);
    
    // Add messages to the list
    currentPageMessages.forEach(message => {
        const isUnlocked = currentBlockHeight >= message.unlockBlockHeight;
        const statusClass = isUnlocked ? "status-unlocked" : "status-pending";
        const statusText = isUnlocked ? "Unlockable" : "Locked";
        
        const messageItem = document.createElement("div");
        messageItem.className = "message-item";
        messageItem.innerHTML = `
            <p><strong>Transaction:</strong> <a href="https://explorer.bc-2.jp/tx/${message.txId}" target="_blank">${message.txId.substring(0, 10)}...</a></p>
            <p><strong>Stored:</strong> ${message.storedDate}</p>
            <p><strong>Unlocks at block:</strong> ${message.unlockBlockHeight}</p>
            <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
        `;
        
        storedMessagesList.appendChild(messageItem);
    });
}

// Adjust message list height based on screen size
function adjustMessageListHeight() {
    const storedMessagesList = document.getElementById("storedMessagesList");
    if (!storedMessagesList) return;
    
    // Get viewport height
    const viewportHeight = window.innerHeight;
    
    // Calculate available height (viewport height minus other elements)
    // This is an approximation - adjust these values based on your layout
    const headerHeight = 80; // Approximate header height
    const footerHeight = 100; // Approximate footer height
    const otherElementsHeight = 200; // Other elements in the tab (padding, margins, etc.)
    
    // Calculate ideal height for message list
    const idealHeight = viewportHeight - (headerHeight + footerHeight + otherElementsHeight);
    
    // Set minimum height (don't make it too small)
    const minHeight = 300;
    const finalHeight = Math.max(idealHeight, minHeight);
    
    // Apply height with max-height to allow scrolling if needed
    storedMessagesList.style.maxHeight = `${finalHeight}px`;
    storedMessagesList.style.overflowY = 'auto';
}

// Listen for window resize to adjust message list height
window.addEventListener('resize', adjustMessageListHeight);

// Check a specific message by transaction ID
function checkMessage() {
    const txId = document.getElementById("txIdInput").value.trim();
    const messageStatus = document.getElementById("messageStatus");
    
    if (!messageStatus) {
        console.error("messageStatus element not found");
        return;
    }
    
    if (!txId) {
        messageStatus.innerHTML = `<div class="status-indicator pending">Please enter a transaction ID</div>`;
        return;
    }
    
    // In a real implementation, you would fetch the actual message data
    // For now, we'll just show a placeholder response
    getCurrentBlockHeight().then(currentBlockHeight => {
        const isUnlocked = currentBlockHeight >= CONTRACT_CONFIG.unlockBlockHeight;
        
        if (isUnlocked) {
            messageStatus.innerHTML = `
                <div class="status-indicator unlocked">
                    <p>✅ This message is now unlockable!</p>
                    <p>To unlock and view the message content, connect your wallet and click below:</p>
                    <button onclick="unlockMessage('${txId}')" class="btn btn-primary">Unlock Message</button>
                </div>
            `;
        } else {
            const remainingBlocks = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
            const days = Math.floor((remainingBlocks * 10) / (60 * 24));
            
            messageStatus.innerHTML = `
                <div class="status-indicator pending">
                    <p>⏳ This message is still locked</p>
                    <p>It will be unlockable after block ${CONTRACT_CONFIG.unlockBlockHeight}</p>
                    <p>Estimated time remaining: ${days} days</p>
                </div>
            `;
        }
    }).catch(error => {
        console.error("Error checking message:", error);
        messageStatus.innerHTML = `<div class="status-indicator pending">Error checking message status. Please try again.</div>`;
    });
}

// Calculate message byte size after encoding
function calculateMessageBytes(message) {
    // Calculate UTF-8 bytes
    const encoder = new TextEncoder();
    const bytes = encoder.encode(message);
    
    // Calculate Base64 size (approximately 4/3 of the original)
    const base64Size = Math.ceil(bytes.length * 4 / 3);
    
    return {
        utf8Size: bytes.length,
        base64Size: base64Size,
        withinLimit: base64Size <= 80 // Standard OP_RETURN size limit
    };
}

// Update countdown based on remaining blocks
function updateCountdown(remainingBlocks) {
    // Approximate time calculations (10 minutes per block on average)
    const minutesPerBlock = 10;
    const totalMinutes = remainingBlocks * minutesPerBlock;
    
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = Math.floor(totalMinutes % 60);
    
    // Update the countdown elements
    const countdownDays = document.getElementById("countdownDays");
    const countdownHours = document.getElementById("countdownHours");
    const countdownMinutes = document.getElementById("countdownMinutes");
    const countdownSeconds = document.getElementById("countdownSeconds");
    
    if (countdownDays) countdownDays.innerText = days.toString().padStart(2, '0');
    if (countdownHours) countdownHours.innerText = hours.toString().padStart(2, '0');
    if (countdownMinutes) countdownMinutes.innerText = minutes.toString().padStart(2, '0');
    if (countdownSeconds) countdownSeconds.innerText = '00';
}

// Start a real-time countdown that ticks every second
function startRealTimeCountdown(remainingBlocks) {
    // Clear any existing interval
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    // Calculate the target date based on remaining blocks
    // Assuming 10 minutes per block on average
    const minutesPerBlock = 10;
    const totalMinutes = remainingBlocks * minutesPerBlock;
    const targetDate = new Date(Date.now() + totalMinutes * 60 * 1000);
    
    // Update the countdown every second
    window.countdownInterval = setInterval(() => {
        // Get current time
        const now = new Date().getTime();
        
        // Calculate the time remaining
        const distance = targetDate - now;
        
        // Time calculations
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        // Update the countdown elements
        const countdownDays = document.getElementById("countdownDays");
        const countdownHours = document.getElementById("countdownHours");
        const countdownMinutes = document.getElementById("countdownMinutes");
        const countdownSeconds = document.getElementById("countdownSeconds");
        
        if (countdownDays) countdownDays.innerText = days.toString().padStart(2, '0');
        if (countdownHours) countdownHours.innerText = hours.toString().padStart(2, '0');
        if (countdownMinutes) countdownMinutes.innerText = minutes.toString().padStart(2, '0');
        if (countdownSeconds) countdownSeconds.innerText = seconds.toString().padStart(2, '0');
        
        // If the countdown is finished
        if (distance < 0) {
            clearInterval(window.countdownInterval);
            
            // Set all values to zero
            if (countdownDays) countdownDays.innerText = '00';
            if (countdownHours) countdownHours.innerText = '00';
            if (countdownMinutes) countdownMinutes.innerText = '00';
            if (countdownSeconds) countdownSeconds.innerText = '00';
            
            // Update status text
            const statusText = document.querySelector('.status-text');
            if (statusText) {
                statusText.innerText = 'Time Capsule messages are now unlockable!';
            }
        }
    }, 1000);
}

// Check message content for inappropriate language
function checkMessageContent(message) {
    // Basic list of inappropriate words to filter
    // This is a very simple implementation - in production you would use a more comprehensive library
    const profanityList = [
        "fuck", "shit", "ass", "bitch", "dick", "pussy", "cock", "cunt", "whore", 
        "slut", "bastard", "damn", "piss", "crap", "hell", "porn", "sex", "nazi",
        "nigger", "faggot", "retard", "idiot", "stupid", "dumb", "moron"
    ];
    
    // Solicitation and scam-related terms
    const solicitationList = [
        "buy now", "limited offer", "special deal", "discount", "sale", "offer", 
        "investment", "opportunity", "earn money", "make money", "get rich", 
        "passive income", "join now", "sign up", "subscribe", "free money", 
        "guaranteed", "double your", "triple your", "contact me", "dm me", 
        "direct message", "telegram", "whatsapp", "signal", "discord", "click here",
        "link in bio", "check out", "promotion", "promo", "giveaway", "airdrop",
        "token", "ico", "presale", "pre-sale", "whitelist", "white-list"
    ];
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = message.toLowerCase();
    
    // Check if message contains any profanity
    for (const word of profanityList) {
        // Check for whole words, not partial matches
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerMessage)) {
            return {
                valid: false,
                reason: "Your message contains inappropriate language. Please edit your message to continue."
            };
        }
    }
    
    // Check for solicitation terms
    for (const term of solicitationList) {
        if (lowerMessage.includes(term)) {
            return {
                valid: false,
                reason: "Your message appears to contain solicitation or promotional content, which is not allowed. Please edit your message to continue."
            };
        }
    }
    
    return { valid: true };
}

// Handle visitor counter using localStorage
function initVisitorCounter() {
    const visitorCountElement = document.getElementById("visitorCount");
    if (!visitorCountElement) return;
    
    // Try to get visitor count from localStorage
    let count = localStorage.getItem('visitorCount');
    
    // If no count exists, initialize it
    if (!count) {
        count = 1;
    } else {
        // If user hasn't visited today, increment count
        const lastVisit = localStorage.getItem('lastVisit');
        const today = new Date().toDateString();
        
        if (lastVisit !== today) {
            count = parseInt(count) + 1;
            localStorage.setItem('lastVisit', today);
        }
    }
    
    // Save count to localStorage
    localStorage.setItem('visitorCount', count);
    
    // Update visitor count element
    visitorCountElement.innerText = count;
}

// Modal popup system
function showModal(title, content) {
    // Set modal content
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = content;
    
    // Show modal
    const modalOverlay = document.getElementById('modalOverlay');
    modalOverlay.classList.add('active');
    
    // Set up event listeners for closing
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modalOk').onclick = closeModal;
    
    // Also close when clicking outside the modal
    modalOverlay.onclick = function(event) {
        if (event.target === modalOverlay) {
            closeModal();
        }
    };
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    // Hide modal
    document.getElementById('modalOverlay').classList.remove('active');
    
    // Re-enable scrolling
    document.body.style.overflow = '';
}

// Check if a string contains unsupported characters
function containsUnsupportedCharacters(text) {
    // Define a regex pattern for supported characters (Latin, numbers, common symbols)
    const supportedPattern = /^[A-Za-z0-9\s.,!?@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    
    // If the text doesn't match the supported pattern, it contains unsupported characters
    return !supportedPattern.test(text);
}

// Get list of supported languages
function getSupportedLanguages() {
    return [
        "English",
        "Spanish",
        "French",
        "German",
        "Italian",
        "Portuguese",
        "Dutch",
        "Swedish",
        "Norwegian",
        "Danish",
        "Finnish",
        "Icelandic",
        "Greek (Latin script)",
        "Turkish (Latin script)",
        "Polish",
        "Czech",
        "Slovak",
        "Hungarian",
        "Romanian",
        "Croatian",
        "Serbian (Latin script)",
        "Slovenian",
        "Albanian",
        "Estonian",
        "Latvian",
        "Lithuanian"
    ];
}

// Initialize modal system and set up Terms & Privacy Policy link
document.addEventListener('DOMContentLoaded', function() {
    // Set up Terms & Privacy Policy link
    const tcppLink = document.getElementById('tcppLink');
    if (tcppLink) {
        tcppLink.addEventListener('click', function(e) {
            e.preventDefault();
            showModal("Terms & Privacy Policy", `
                <p><strong>Experimental Project Notice</strong></p>
                <p>This Bitcoin Time Capsule Contract is an experimental project running on Bitcoin Signet (testnet).</p>
                <p>Important information:</p>
                <ul>
                    <li>This is a demonstration project only</li>
                    <li>No real Bitcoin is used or stored</li>
                    <li>All data is stored on the Signet testnet blockchain</li>
                    <li>No personal data is collected beyond what you explicitly store in messages</li>
                    <li>Messages stored in the time capsule will become publicly viewable after the unlock block height</li>
                </ul>
                <p>By using this application, you acknowledge its experimental nature and understand that it should not be used for storing sensitive or important information.</p>
            `);
        });
    }
});

// Disconnect wallet
function disconnectWallet() {
    walletConnected = false;
    currentAccount = null;
    currentWalletType = null;
    updateWalletUI(false);
    console.log("Wallet disconnected");
}

// Function to unlock a message (placeholder)
function unlockMessage(txId) {
    if (!walletConnected) {
        showModal("Wallet Required", "<p>Please connect your wallet first to unlock this message.</p>");
        return;
    }
    
    // In a real implementation, this would interact with the blockchain
    showModal("Unlocking Message", `<p>Attempting to unlock message with transaction ID: ${txId.substring(0, 10)}...</p><p>This feature is not yet implemented in this demo.</p>`);
}
