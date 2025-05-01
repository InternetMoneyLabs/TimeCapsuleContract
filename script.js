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
            
            // Change color if approaching limit
            if (this.value.length > 900) {
                charCount.style.color = '#e74c3c';
            } else if (this.value.length > 700) {
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
    const messageSection = document.getElementById("messageSection");
    
    if (connected && address) {
        connectButton.innerText = "Disconnect Wallet";
        walletStatus.innerText = `Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        walletStatus.style.color = '#2ecc71';
        // Show message input section
        if (messageSection) messageSection.style.display = "block";
    } else {
        connectButton.innerText = "Connect Wallet (Unisat)";
        walletStatus.innerText = "Wallet Status: Not Connected";
        walletStatus.style.color = '';
        // Hide message input section
        if (messageSection) messageSection.style.display = "none";
        // Hide encryption result
        const encryptionResult = document.getElementById("encryptionResult");
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
        // Wait for UniSat to be available
        const unisat = await waitForUnisat();
        if (!unisat) {
            alert("Unisat wallet not found! Please install the Unisat browser extension.");
            updateWalletUI(false);
            return;
        }
        
        console.log("Unisat detected:", unisat.version || "version unknown");
        
        // Request connection to wallet
        const accounts = await unisat.requestAccounts();
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
            alert("No accounts found in Unisat Wallet. Please ensure you are logged in.");
            updateWalletUI(false);
            return;
        }

        const address = accounts[0];
        currentAccount = address;
        
        // Get network information
        const network = await unisat.getNetwork();
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
            alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
            updateWalletUI(false);
            return;
        }
        
        // Successfully connected to Signet/Testnet
        walletConnected = true;
        updateWalletUI(true, address);
        console.log("Wallet connected successfully to Signet/Testnet.");
        
    } catch (error) {
        console.error("Error connecting to Unisat Wallet:", error);
        alert("Error connecting to Unisat Wallet: " + error.message);
        updateWalletUI(false);
    }
});

// Function to encrypt messages locally in the browser
function encryptMessage() {
    const message = document.getElementById("message").value;
    if (!message) {
        alert("Please enter a message to encrypt.");
        return;
    }
    
    // Check message length (reasonable limit for blockchain storage)
    if (message.length > 150) {
        alert("Message is too long. Please limit your message to 150 characters to ensure it can be stored on the blockchain.");
        return;
    }
    
    // Check message byte size
    const sizeInfo = calculateMessageBytes(message);
    if (!sizeInfo.withinLimit) {
        alert(`Your message is ${sizeInfo.base64Size} bytes after encoding, which exceeds the 80-byte OP_RETURN limit. Please shorten your message or use fewer special characters.`);
        return;
    }
    
    // Check for inappropriate content
    const contentCheck = checkMessageContent(message);
    if (!contentCheck.valid) {
        alert(contentCheck.reason);
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
        alert("Failed to encrypt the message. Please try again.");
    }
}

// Sign and submit transaction
document.getElementById("signTransaction").addEventListener("click", async () => {
    if (!walletConnected || !currentAccount) {
        alert("Wallet not connected! Please connect your wallet first.");
        return;
    }
    
    if (!window.txData) {
        alert("No transaction data found. Please encrypt a message first.");
        return;
    }
    
    try {
        const unisat = await waitForUnisat();
        if (!unisat) {
            alert("Unisat wallet not found! Please install the Unisat browser extension.");
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
        alert("Failed to send transaction: " + error.message);
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
    const timeRemainingElement = document.getElementById("timeRemaining");
    const progressBar = document.getElementById("progressBar");
    
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
            
            // Estimate time remaining (10 minutes per block on average)
            const minutesRemaining = remainingBlocks * 10;
            if (minutesRemaining <= 0) {
                timeRemainingElement.innerText = "Messages are now unlockable!";
                document.getElementById("blockStatus").classList.remove("pending");
                document.getElementById("blockStatus").classList.add("unlocked");
            } else {
                const days = Math.floor(minutesRemaining / (60 * 24));
                const hours = Math.floor((minutesRemaining % (60 * 24)) / 60);
                const minutes = minutesRemaining % 60;
                
                timeRemainingElement.innerText = `${days} days, ${hours} hours, ${minutes} minutes`;
            }
        } else {
            currentBlockHeightElement.innerText = "Unable to fetch";
            blocksRemainingElement.innerText = "Unknown";
            timeRemainingElement.innerText = "Unknown";
        }
    } catch (error) {
        console.error("Error updating block height info:", error);
        currentBlockHeightElement.innerText = "Error";
        blocksRemainingElement.innerText = "Error";
        timeRemainingElement.innerText = "Error";
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
