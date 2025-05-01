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

// Check for existing connection on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkExistingConnection();
    await updateBlockHeightInfo();
    await loadStoredMessages();
    initVisitorCounter();
    
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
});

// Tab switching functionality
function switchTab(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show the selected tab content
    document.getElementById(tabId).classList.add('active');
    
    // Activate the clicked tab button
    event.currentTarget.classList.add('active');
}

// Wait for UniSat wallet to be available
function waitForUnisat(timeout = 3000) {
    return new Promise((resolve) => {
        if (window.unisat) {
            return resolve(window.unisat);
        }
        
        let timer = null;
        const interval = setInterval(() => {
            if (window.unisat) {
                clearInterval(interval);
                clearTimeout(timer);
                return resolve(window.unisat);
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

// Calculate unlock block height (approximately)
function calculateUnlockBlockHeight() {
    // Bitcoin produces ~144 blocks per day
    const blocksPerDay = 144;
    const currentBlockHeight = 0; // This would need to be fetched from an API
    return currentBlockHeight + (CONTRACT_CONFIG.unlockDays * blocksPerDay);
}

// Check for existing wallet connection
async function checkExistingConnection() {
    try {
        const unisat = await waitForUnisat();
        if (!unisat) {
            return;
        }
        
        // Check if already connected
        const accounts = await unisat.getAccounts().catch(() => []);
        if (accounts && accounts.length > 0) {
            currentAccount = accounts[0];
            
            // Verify network
            const network = await unisat.getNetwork().catch(() => "unknown");
            let isSignetOrTestnet = false;
            
            if (network && network !== "unknown") {
                const networkStr = String(network).toLowerCase();
                isSignetOrTestnet = networkStr.includes("signet") || networkStr.includes("testnet");
            }
            
            if (!isSignetOrTestnet) {
                isSignetOrTestnet = isTestnetAddress(currentAccount);
            }
            
            if (isSignetOrTestnet) {
                walletConnected = true;
                updateWalletUI(true, currentAccount);
                console.log("Existing wallet connection detected:", currentAccount);
            }
        }
    } catch (error) {
        console.error("Error checking existing connection:", error);
    }
}

// Update wallet UI based on connection state
function updateWalletUI(connected, address = null) {
    const connectButton = document.getElementById("connectWallet");
    const walletStatus = document.getElementById("walletStatus");
    const encryptionResult = document.getElementById("encryptionResult");
    
    if (connected && address) {
        connectButton.innerText = "Disconnect Wallet";
        walletStatus.innerText = `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        walletStatus.style.color = '#2ecc71';
        // Show encryption result if it exists
        if (encryptionResult) encryptionResult.style.display = "none";
    } else {
        connectButton.innerText = "Connect Wallet (Unisat)";
        walletStatus.innerText = "Wallet Status: Not Connected";
        walletStatus.style.color = '';
        // Hide encryption result
        if (encryptionResult) encryptionResult.style.display = "none";
    }
}

// Connect or disconnect wallet
document.getElementById("connectWallet").addEventListener("click", async () => {
    // If already connected, disconnect
    if (walletConnected) {
        walletConnected = false;
        currentAccount = null;
        updateWalletUI(false);
        console.log("Wallet disconnected");
        return;
    }
    
    try {
        console.log("Attempting to connect to wallet...");
        
        // Check if unisat is defined in window object
        if (typeof window.unisat === 'undefined') {
            console.log("Unisat not found in window object. Checking if it's available through other means...");
            
            // Try to detect wallet through alternative methods
            if (window.bitcoin || window.BitcoinProvider) {
                console.log("Alternative Bitcoin provider detected");
                // Use alternative provider if available
                window.unisat = window.bitcoin || window.BitcoinProvider;
            } else {
                // Create a direct request to open the extension
                console.log("No wallet detected. Attempting to trigger extension via direct request...");
                
                // Create a custom event that might trigger extension
                const walletEvent = new CustomEvent('walletRequest', { detail: { wallet: 'unisat' } });
                window.dispatchEvent(walletEvent);
                
                // Give the extension a moment to respond
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check again if unisat is now available
                if (typeof window.unisat === 'undefined') {
                    showModal("Wallet Not Found", `
                        <p>Unisat wallet not found! Please install the Unisat browser extension.</p>
                        <p>If you're using Lockdown Mode, please disable it temporarily to use this application.</p>
                    `);
                    updateWalletUI(false);
                    return;
                }
            }
        }
        
        console.log("Unisat detected:", window.unisat.version || "version unknown");
        
        // Request connection to wallet with error handling
        let accounts;
        try {
            accounts = await window.unisat.requestAccounts();
        } catch (connectionError) {
            console.error("Error during requestAccounts:", connectionError);
            
            // Try alternative connection method if first one fails
            try {
                console.log("Trying alternative connection method...");
                accounts = await window.unisat.enable();
            } catch (altError) {
                console.error("Alternative connection also failed:", altError);
                showModal("Connection Error", `
                    <p>Could not connect to wallet. Please check if Lockdown Mode is enabled and disable it if necessary.</p>
                    <p>Error details: ${connectionError.message || "Unknown error"}</p>
                `);
                throw new Error("Could not connect to wallet.");
            }
        }
        
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
            showModal("No Accounts Found", "<p>No accounts found in Unisat Wallet. Please ensure you are logged in.</p>");
            updateWalletUI(false);
            return;
        }

        const address = accounts[0];
        currentAccount = address;
        
        // Get network information with fallback
        let network;
        try {
            network = await window.unisat.getNetwork();
        } catch (networkError) {
            console.error("Error getting network:", networkError);
            // Fallback to checking address format
            network = "unknown";
        }
        
        console.log("Network:", network);
        
        // Check if on Signet/Testnet using multiple methods
        let isSignetOrTestnet = false;
        
        // Method 1: Check network value
        if (network && network !== "unknown") {
            const networkStr = String(network).toLowerCase();
            isSignetOrTestnet = networkStr.includes("signet") || networkStr.includes("testnet");
            console.log("Network check result:", isSignetOrTestnet);
        }
        
        // Method 2: If network check failed or returned unknown, check address format
        if (!isSignetOrTestnet || network === "unknown") {
            isSignetOrTestnet = isTestnetAddress(address);
            console.log("Address format check result:", isSignetOrTestnet);
        }
        
        console.log("Final network determination:", isSignetOrTestnet, "Network value:", network, "Address:", address);
        
        if (!isSignetOrTestnet) {
            showModal("Wrong Network", `
                <p>⚠ You are NOT on Bitcoin Signet!</p>
                <p>Please switch your wallet network to Signet and try again.</p>
                <p>In Unisat Wallet, click the network selector and choose "Bitcoin Testnet, Signet".</p>
            `);
            updateWalletUI(false);
            return;
        }
        
        // Successfully connected to Signet/Testnet
        walletConnected = true;
        updateWalletUI(true, address);
        console.log("Wallet connected successfully to Signet/Testnet.");
        
    } catch (error) {
        console.error("Error connecting to Unisat Wallet:", error);
        showModal("Connection Error", `
            <p>Error connecting to Unisat Wallet: ${error.message}</p>
            <p>If you're using Lockdown Mode, please disable it temporarily to use this application.</p>
        `);
        updateWalletUI(false);
    }
});

// Function to encrypt messages locally in the browser
function encryptMessage() {
    const message = document.getElementById("message").value;
    if (!message) {
        showModal("Empty Message", "<p>Please enter a message to encrypt.</p>");
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
        // Simple encryption logic (for demonstration purposes)
        const encryptedMessage = btoa(message); // Base64 encoding
        document.getElementById("encryptedMessageOutput").innerText = encryptedMessage;
        console.log("Encrypted Message:", encryptedMessage);

        // Generate transaction data
        const txData = {
            message: encryptedMessage,
            timestamp: Date.now(),
            unlockDate: new Date(Date.now() + (CONTRACT_CONFIG.unlockDays * 24 * 60 * 60 * 1000)).toISOString(),
            fee: CONTRACT_CONFIG.feeAmount
        };
        
        document.getElementById("output").innerHTML = `
            <strong>Transaction Details:</strong><br>
            Fee: ${CONTRACT_CONFIG.feeAmount} Signet BTC<br>
            Recipient: ${CONTRACT_CONFIG.feeRecipient.substring(0, 6)}...${CONTRACT_CONFIG.feeRecipient.substring(CONTRACT_CONFIG.feeRecipient.length - 4)}<br>
            Unlock Date: ${new Date(txData.unlockDate).toLocaleDateString()}<br>
            Message Size: ${encryptedMessage.length} bytes (${sizeInfo.utf8Size} UTF-8 bytes)
        `;

        // Display the encryption result
        document.getElementById("encryptionResult").style.display = "block";
        
        // Store transaction data for later use
        window.txData = txData;
        
    } catch (error) {
        console.error("Error encrypting message:", error);
        showModal("Encryption Error", "<p>Failed to encrypt the message. Please try again.</p>");
    }
}

// Sign and submit transaction
document.getElementById("signTransaction").addEventListener("click", async () => {
    if (!walletConnected || !currentAccount) {
        showModal("Wallet Not Connected", "<p>Wallet not connected! Please connect your wallet first.</p>");
        return;
    }
    
    if (!window.txData) {
        showModal("No Transaction Data", "<p>No transaction data found. Please encrypt a message first.</p>");
        return;
    }
    
    try {
        const unisat = await waitForUnisat();
        if (!unisat) {
            showModal("Wallet Not Found", "<p>Unisat wallet not found! Please install the Unisat browser extension.</p>");
            return;
        }
        
        // Convert BTC amount to satoshis (1 BTC = 100,000,000 satoshis)
        const satoshis = Math.floor(CONTRACT_CONFIG.feeAmount * 100000000);
        
        // Create OP_RETURN data with the encrypted message
        const data = window.txData.message;
        
        // Prepare transaction
        document.getElementById("output").innerHTML += "<br><br>Preparing transaction...";
        
        // Send transaction with OP_RETURN data
        const txid = await unisat.sendBitcoin(
            CONTRACT_CONFIG.feeRecipient,
            satoshis,
            {
                memo: data // This will be stored as OP_RETURN data
            }
        );
        
        console.log("Transaction sent:", txid);
        
        // Show success message with transaction ID
        document.getElementById("output").innerHTML += `
            <br><br>✅ Transaction sent successfully!<br>
            Transaction ID: <a href="https://explorer.bc-2.jp/tx/${txid}" target="_blank">${txid}</a><br>
            Your message has been stored in the Bitcoin Time Capsule and will be unlockable after block ${CONTRACT_CONFIG.unlockBlockHeight}.
        `;
        
        // Add the new message to the stored messages list
        addNewMessageToList(txid);
        
    } catch (error) {
        console.error("Error sending transaction:", error);
        document.getElementById("output").innerHTML += `<br><br>❌ Error sending transaction: ${error.message}`;
        showModal("Transaction Error", `<p>Failed to send transaction: ${error.message}</p>`);
    }
});

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
    switchTab('storedTab');
}

// Fetch current block height from an API
async function getCurrentBlockHeight() {
    try {
        // Using mempool.space API for Signet
        const response = await fetch('https://mempool.space/signet/api/blocks/tip/height');
        const blockHeight = await response.text();
        return parseInt(blockHeight);
    } catch (error) {
        console.error("Error fetching block height:", error);
        return null;
    }
}

// Update block height information on the page
async function updateBlockHeightInfo() {
    const currentBlockHeightElement = document.getElementById("currentBlockHeight");
    const blocksRemainingElement = document.getElementById("blocksRemaining");
    const progressBar = document.getElementById("progressBar");
    
    // Countdown elements
    const countdownDays = document.getElementById("countdownDays");
    const countdownHours = document.getElementById("countdownHours");
    const countdownMinutes = document.getElementById("countdownMinutes");
    const countdownSeconds = document.getElementById("countdownSeconds");
    
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
            
            // Set interval to update countdown every second
            if (!window.countdownInterval) {
                window.countdownInterval = setInterval(() => {
                    updateCountdown(remainingBlocks);
                }, 1000);
            }
            
        } else {
            currentBlockHeightElement.innerText = "Unable to fetch";
            blocksRemainingElement.innerText = "Unknown";
            
            // Set countdown to unknown
            if (countdownDays) countdownDays.innerText = "--";
            if (countdownHours) countdownHours.innerText = "--";
            if (countdownMinutes) countdownMinutes.innerText = "--";
            if (countdownSeconds) countdownSeconds.innerText = "--";
        }
    } catch (error) {
        console.error("Error updating block height info:", error);
        currentBlockHeightElement.innerText = "Error";
        blocksRemainingElement.innerText = "Error";
    }
}

// Load sample stored messages (in a real implementation, these would come from an API)
async function loadStoredMessages() {
    const storedMessagesList = document.getElementById("storedMessagesList");
    
    // In a real implementation, you would fetch this data from bestinslot or another indexer
    const sampleMessages = [
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
        }
    ];
    
    // Clear loading message
    storedMessagesList.innerHTML = "";
    
    // Get current block height to determine status
    const currentBlockHeight = await getCurrentBlockHeight();
    
    // Add sample messages to the list
    sampleMessages.forEach(message => {
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

// Check a specific message by transaction ID
function checkMessage() {
    const txId = document.getElementById("txIdInput").value.trim();
    const messageStatus = document.getElementById("messageStatus");
    
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
                    <button onclick="unlockMessage('${txId}')">Unlock Message</button>
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
    });
}

// Placeholder function for unlocking a message
function unlockMessage(txId) {
    if (!walletConnected) {
        alert("Please connect your wallet first");
        return;
    }
    
    // In a real implementation, this would fetch the message from the blockchain
    // and distribute fees according to the contract rules
    alert(`This is a placeholder for unlocking message ${txId}. In the full implementation, this would retrieve the message from the blockchain and distribute fees.`);
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

// Check message content for inappropriate language
function checkMessageContent(message) {
    // Basic list of inappropriate words to filter
    // This is a very simple implementation - in production you would use a more comprehensive library
    const profanityList = [
        "fuck", "shit", "ass", "bitch", "dick", "pussy", "cock", "cunt", "whore", 
        "slut", "bastard", "damn", "piss", "crap", "hell", "porn", "sex", "nazi",
        "nigger", "faggot", "retard", "idiot", "stupid", "dumb", "moron"
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
    
    return { valid: true };
}
// Update countdown timer based on remaining blocks
function updateCountdown(remainingBlocks) {
    // Get countdown elements
    const countdownDays = document.getElementById("countdownDays");
    const countdownHours = document.getElementById("countdownHours");
    const countdownMinutes = document.getElementById("countdownMinutes");
    const countdownSeconds = document.getElementById("countdownSeconds");
    
    // If elements don't exist, return
    if (!countdownDays || !countdownHours || !countdownMinutes || !countdownSeconds) {
        return;
    }
    
    // Calculate time remaining
    if (remainingBlocks <= 0) {
        // If no blocks remaining, set countdown to 0
        countdownDays.innerText = "0";
        countdownHours.innerText = "0";
        countdownMinutes.innerText = "0";
        countdownSeconds.innerText = "0";
        
        // Change status to unlocked
        const blockStatus = document.getElementById("blockStatus");
        if (blockStatus) {
            blockStatus.classList.remove("pending");
            blockStatus.classList.add("unlocked");
        }
        
        // Clear interval if it exists
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
        
        return;
    }
    
    // Calculate time based on 10 minutes per block on average
    const totalSeconds = remainingBlocks * 10 * 60;
    
    // Get current time
    const now = new Date();
    
    // Calculate target time by adding total seconds to current time
    const targetTime = new Date(now.getTime() + totalSeconds * 1000);
    
    // Calculate difference in milliseconds
    const diff = targetTime - now;
    
    // Calculate days, hours, minutes, seconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Update countdown elements
    countdownDays.innerText = days;
    countdownHours.innerText = hours.toString().padStart(2, '0');
    countdownMinutes.innerText = minutes.toString().padStart(2, '0');
    countdownSeconds.innerText = seconds.toString().padStart(2, '0');
}

// Fetch current block height from mempool.space API
async function getCurrentBlockHeight() {
    try {
        // Using mempool.space API for Signet
        const response = await fetch('https://mempool.space/signet/api/blocks/tip/height');
        const blockHeight = await response.text();
        return parseInt(blockHeight);
    } catch (error) {
        console.error("Error fetching block height:", error);
        return null;
    }
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

// Initialize visitor counter when page loads
document.addEventListener('DOMContentLoaded', function() {
    initVisitorCounter();
});
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

// Initialize modal system
document.addEventListener('DOMContentLoaded', function() {
    // Ensure modal elements exist
    if (!document.getElementById('modalOverlay')) {
        console.error("Modal elements not found in the DOM");
    }
});
// Wallet connection system
let currentWalletType = null;

// Show wallet selection modal
function showWalletSelectionModal() {
    const walletModal = document.getElementById('walletSelectionModal');
    walletModal.classList.add('active');
    
    // Set up event listeners
    document.getElementById('walletModalClose').onclick = closeWalletModal;
    
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
    document.getElementById('walletSelectionModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Connect to selected wallet
async function connectWallet(walletType) {
    console.log(`Attempting to connect to ${walletType} wallet...`);
    
    try {
        switch(walletType) {
            case 'unisat':
                await connectUnisatWallet();
                break;
            case 'xverse':
                await connectXverseWallet();
                break;
            case 'okx':
                await connectOKXWallet();
                break;
            case 'leather':
                await connectLeatherWallet();
                break;
            default:
                throw new Error(`Unsupported wallet type: ${walletType}`);
        }
        
        // If connection was successful, store the wallet type
        currentWalletType = walletType;
        
    } catch (error) {
        console.error(`Error connecting to ${walletType} wallet:`, error);
        showModal("Connection Error", `<p>Failed to connect to ${walletType} wallet: ${error.message}</p>`);
    }
}

// Connect to Unisat wallet
async function connectUnisatWallet() {
    // Check if unisat is defined in window object
    if (typeof window.unisat === 'undefined') {
        console.log("Unisat not found in window object.");
        
        // Try to detect wallet through alternative methods
        if (window.bitcoin || window.BitcoinProvider) {
            console.log("Alternative Bitcoin provider detected");
            // Use alternative provider if available
            window.unisat = window.bitcoin || window.BitcoinProvider;
        } else {
            // Create a direct request to open the extension
            console.log("No wallet detected. Attempting to trigger extension via direct request...");
            
            // Create a custom event that might trigger extension
            const walletEvent = new CustomEvent('walletRequest', { detail: { wallet: 'unisat' } });
            window.dispatchEvent(walletEvent);
            
            // Give the extension a moment to respond
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check again if unisat is now available
            if (typeof window.unisat === 'undefined') {
                throw new Error("Unisat wallet not found. Please install the Unisat browser extension.");
            }
        }
    }
    
    console.log("Unisat detected:", window.unisat.version || "version unknown");
    
    // Request connection to wallet with error handling
    let accounts;
    try {
        accounts = await window.unisat.requestAccounts();
    } catch (connectionError) {
        console.error("Error during requestAccounts:", connectionError);
        
        // Try alternative connection method if first one fails
        try {
            console.log("Trying alternative connection method...");
            accounts = await window.unisat.enable();
        } catch (altError) {
            console.error("Alternative connection also failed:", altError);
            throw new Error("Could not connect to Unisat wallet.");
        }
    }
    
    console.log("Connected accounts:", accounts);
    
    if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in Unisat Wallet. Please ensure you are logged in.");
    }

    const address = accounts[0];
    currentAccount = address;
    
    // Get network information with fallback
    let network;
    try {
        network = await window.unisat.getNetwork();
    } catch (networkError) {
        console.error("Error getting network:", networkError);
        // Fallback to checking address format
        network = "unknown";
    }
    
    console.log("Network:", network);
    
    // Check if on Signet/Testnet using multiple methods
    let isSignetOrTestnet = false;
    
    // Method 1: Check network value
    if (network && network !== "unknown") {
        const networkStr = String(network).toLowerCase();
        isSignetOrTestnet = networkStr.includes("signet") || networkStr.includes("testnet");
        console.log("Network check result:", isSignetOrTestnet);
    }
    
    // Method 2: If network check failed or returned unknown, check address format
    if (!isSignetOrTestnet || network === "unknown") {
        isSignetOrTestnet = isTestnetAddress(address);
        console.log("Address format check result:", isSignetOrTestnet);
    }
    
    console.log("Final network determination:", isSignetOrTestnet, "Network value:", network, "Address:", address);
    
    if (!isSignetOrTestnet) {
        throw new Error("You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
    }
    
    // Successfully connected to Signet/Testnet
    walletConnected = true;
    updateWalletUI(true, address);
    console.log("Wallet connected successfully to Signet/Testnet.");
}

// Connect to Xverse wallet
async function connectXverseWallet() {
    // Check if Xverse is available
    if (typeof window.XverseProviders === 'undefined') {
        throw new Error("Xverse wallet not found. Please install the Xverse browser extension.");
    }
    
    try {
        // Request connection to Xverse wallet
        const accounts = await window.XverseProviders.BitcoinProvider.request('getAddresses');
        
        if (!accounts || accounts.length === 0 || !accounts.addresses || accounts.addresses.length === 0) {
            throw new Error("No accounts found in Xverse Wallet.");
        }
        
        // Get the first address (testnet)
        const testnetAddresses = accounts.addresses.filter(addr => addr.type === 'testnet');
        if (!testnetAddresses || testnetAddresses.length === 0) {
            throw new Error("No testnet addresses found. Please switch to Signet in Xverse wallet.");
        }
        
        const address = testnetAddresses[0].address;
        currentAccount = address;
        
        // Check if address is a testnet/signet address
        if (!isTestnetAddress(address)) {
            throw new Error("You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
        }
        
        // Successfully connected
        walletConnected = true;
        updateWalletUI(true, address);
        console.log("Xverse wallet connected successfully to Signet/Testnet.");
        
    } catch (error) {
        console.error("Error connecting to Xverse wallet:", error);
        throw error;
    }
}

// Connect to OKX wallet
async function connectOKXWallet() {
    // Check if OKX wallet is available
    if (typeof window.okxwallet === 'undefined') {
        throw new Error("OKX wallet not found. Please install the OKX wallet browser extension.");
    }
    
    try {
        // Request connection to OKX wallet
        const accounts = await window.okxwallet.bitcoin.connect();
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found in OKX Wallet.");
        }
        
        const address = accounts[0];
        currentAccount = address;
        
        // Check if address is a testnet/signet address
        if (!isTestnetAddress(address)) {
            throw new Error("You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
        }
        
        // Successfully connected
        walletConnected = true;
        updateWalletUI(true, address);
        console.log("OKX wallet connected successfully to Signet/Testnet.");
        
    } catch (error) {
        console.error("Error connecting to OKX wallet:", error);
        throw error;
    }
}

// Connect to Leather wallet
async function connectLeatherWallet() {
    // Check if Leather wallet is available
    if (typeof window.btc === 'undefined') {
        throw new Error("Leather wallet not found. Please install the Leather wallet browser extension.");
    }
    
    try {
        // Request connection to Leather wallet
        const accounts = await window.btc.request('getAddresses');
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found in Leather Wallet.");
        }
        
        const address = accounts[0];
        currentAccount = address;
        
        // Check if address is a testnet/signet address
        if (!isTestnetAddress(address)) {
            throw new Error("You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
        }
        
        // Successfully connected
        walletConnected = true;
        updateWalletUI(true, address);
        console.log("Leather wallet connected successfully to Signet/Testnet.");
        
    } catch (error) {
        console.error("Error connecting to Leather wallet:", error);
        throw error;
    }
}

// Disconnect wallet
function disconnectWallet() {
    walletConnected = false;
    currentAccount = null;
    currentWalletType = null;
    updateWalletUI(false);
    console.log("Wallet disconnected");
}

// Update the connect wallet button to show wallet selection modal
document.getElementById("connectWallet").removeEventListener("click", connectUnisatWallet);
document.getElementById("connectWallet").addEventListener("click", function() {
    if (walletConnected) {
        disconnectWallet();
    } else {
        showWalletSelectionModal();
    }
});
// Terms and Privacy Policy popup
document.addEventListener('DOMContentLoaded', function() {
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
// Move the Terms & Privacy Policy link handler to the wallet selection modal
document.addEventListener('DOMContentLoaded', function() {
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
