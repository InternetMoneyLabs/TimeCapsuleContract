// Global wallet variables
let walletConnected = false;
let currentAccount = null;
let currentWalletType = null;

// Contract configuration
const CONTRACT_CONFIG = {
    unlockBlockHeight: 263527,
    feeRecipient: "tb1qrz46wz6skvskgeerp6q88grv9p4y3r8qd8c8fl",
    feeAmount: 0.0001 // in BTC
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize wallet connection
    initWalletConnection();
    
    // Initialize message input handlers
    initMessageInput();
    
    // Initialize modal handlers
    initModalHandlers();
    
    // Initialize block height and countdown
    initBlockHeightAndCountdown();
});

// ===== WALLET CONNECTION FUNCTIONALITY =====

// Function to initialize wallet connection
function initWalletConnection() {
    const connectWalletBtn = document.getElementById('connectWallet');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', showWalletSelectionModal);
    }

    // Set up wallet selection modal
    const walletOptions = document.querySelectorAll('.wallet-option');
    walletOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const walletType = option.dataset.wallet;
            try {
                await connectWallet(walletType);
                hideWalletSelectionModal();
            } catch (error) {
                console.error(`Error connecting to ${walletType} wallet:`, error);
                showModal("Connection Error", `<p>Failed to connect to ${walletType} wallet: ${error.message}</p>`);
            }
        });
    });

    // Close wallet modal buttons
    const walletModalClose = document.getElementById('walletModalClose');
    if (walletModalClose) {
        walletModalClose.addEventListener('click', hideWalletSelectionModal);
    }
}

// Function to show wallet selection modal
function showWalletSelectionModal() {
    const modal = document.getElementById('walletSelectionModal');
    if (modal) {
        modal.classList.add('active');
    }
}

// Function to hide wallet selection modal
function hideWalletSelectionModal() {
    const modal = document.getElementById('walletSelectionModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Function to connect wallet
async function connectWallet(walletType) {
    // Update status to connecting
    const walletStatus = document.getElementById('walletStatus');
    if (walletStatus) {
        walletStatus.textContent = `Wallet Status: Connecting to ${walletType}...`;
    }
    
    try {
        let account;
        
        switch(walletType) {
            case 'unisat':
                if (!window.unisat) {
                    throw new Error("Unisat wallet not found. Please install the extension.");
                }
                
                // Request account access
                const accounts = await window.unisat.requestAccounts();
                account = accounts[0];
                
                // Check if we're on Signet
                const network = await window.unisat.getNetwork();
                if (network !== 'signet') {
                    throw new Error("Please switch to Signet network in your Unisat wallet.");
                }
                break;
                
            case 'xverse':
                if (!window.SatsConnect) {
                    throw new Error("Xverse wallet not found. Please install the extension.");
                }
                
                // Connect using SatsConnect
                const connectOptions = {
                    payload: {
                        network: {
                            type: 'testnet'
                        },
                        appDetails: {
                            name: "Bitcoin Time Capsule",
                            icon: window.location.origin + "/favicon.ico"
                        }
                    },
                    onFinish: (response) => {
                        account = response.addresses[0].address;
                        updateWalletStatus(account, walletType);
                    },
                    onCancel: () => {
                        throw new Error("Connection cancelled by user.");
                    }
                };
                
                window.SatsConnect.connect(connectOptions);
                return; // Return early as this is handled in callbacks
                
            case 'leather':
                const provider = window.LeatherProvider || window.btc;
                if (!provider) {
                    throw new Error("Leather wallet not found. Please install the extension.");
                }
                
                // Request account access
                const leatherAccounts = await provider.request('getAddresses');
                account = leatherAccounts[0].address;
                break;
                
            case 'okx':
                if (!window.okxwallet || !window.okxwallet.bitcoin) {
                    throw new Error("OKX wallet not found. Please install the extension.");
                }
                
                // Request account access
                const okxAccounts = await window.okxwallet.bitcoin.connect();
                account = okxAccounts.address;
                break;
                
            default:
                throw new Error(`Unsupported wallet type: ${walletType}`);
        }
        
        // Update wallet status
        updateWalletStatus(account, walletType);
        
    } catch (error) {
        console.error("Error connecting wallet:", error);
        
        // Update status to error
        if (walletStatus) {
            walletStatus.textContent = `Wallet Status: Connection Error`;
        }
        
        throw error;
    }
}

// Function to update wallet status
function updateWalletStatus(account, walletType) {
    walletConnected = true;
    currentAccount = account;
    currentWalletType = walletType;
    
    // Update UI
    const walletStatus = document.getElementById('walletStatus');
    const connectWalletBtn = document.getElementById('connectWallet');
    
    if (walletStatus) {
        const shortAddress = `${account.substring(0, 6)}...${account.substring(account.length - 4)}`;
        walletStatus.textContent = `Connected: ${shortAddress}`;
        walletStatus.style.color = 'var(--color-success)';
    }
    
    if (connectWalletBtn) {
        connectWalletBtn.textContent = 'Disconnect';
        connectWalletBtn.removeEventListener('click', showWalletSelectionModal);
        connectWalletBtn.addEventListener('click', disconnectWallet);
    }
}

// Function to disconnect wallet
function disconnectWallet() {
    walletConnected = false;
    currentAccount = null;
    currentWalletType = null;
    
    // Update UI
    const walletStatus = document.getElementById('walletStatus');
    const connectWalletBtn = document.getElementById('connectWallet');
    
    if (walletStatus) {
        walletStatus.textContent = 'Wallet Status: Not Connected';
        walletStatus.style.color = 'var(--color-warning)';
    }
    
    if (connectWalletBtn) {
        connectWalletBtn.textContent = 'Connect Wallet';
        connectWalletBtn.removeEventListener('click', disconnectWallet);
        connectWalletBtn.addEventListener('click', showWalletSelectionModal);
    }
}

// ===== MESSAGE FUNCTIONALITY =====

// Function to initialize message input
function initMessageInput() {
    // Character counter for message input
    const messageInput = document.getElementById('message');
    if (messageInput) {
        messageInput.addEventListener('input', updateCharCount);
    }
    
    // Encrypt message button
    const encryptBtn = document.querySelector('button[onclick="encryptMessage()"]');
    if (encryptBtn) {
        encryptBtn.onclick = function(e) {
            e.preventDefault();
            encryptMessage();
        };
    }
    
    // Sign transaction button
    const signTransactionBtn = document.getElementById('signTransaction');
    if (signTransactionBtn) {
        signTransactionBtn.addEventListener('click', signAndSubmitTransaction);
    }
    
    // Check message button
    const checkMessageBtn = document.querySelector('button[onclick="checkMessage()"]');
    if (checkMessageBtn) {
        checkMessageBtn.onclick = function(e) {
            e.preventDefault();
            checkMessage();
        };
    }
    
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            switchTab(tabId, this);
        });
    });
}

// Function to update character count
function updateCharCount() {
    const messageInput = document.getElementById('message');
    const charCount = document.getElementById('charCount');
    const byteCount = document.getElementById('byteCount');
    
    if (messageInput && charCount && byteCount) {
        const text = messageInput.value;
        const chars = text.length;
        const bytes = new TextEncoder().encode(text).length;
        
        charCount.textContent = chars;
        byteCount.textContent = bytes;
        
        // Warn if over limit
        if (chars > 150 || bytes > 80) {
            charCount.style.color = 'var(--color-error)';
            byteCount.style.color = 'var(--color-error)';
        } else {
            charCount.style.color = '';
            byteCount.style.color = '';
        }
    }
}

// Function to encrypt message
function encryptMessage() {
    const messageInput = document.getElementById('message');
    const encryptionResult = document.getElementById('encryptionResult');
    const encryptedMessageOutput = document.getElementById('encryptedMessageOutput');
    const output = document.getElementById('output');
    
    if (!messageInput || !encryptionResult || !encryptedMessageOutput || !output) {
        console.error("Required elements not found");
        return;
    }
    
    const message = messageInput.value.trim();
    
    if (!message) {
        showModal("Error", "<p>Please enter a message to encrypt.</p>");
        return;
    }
    
    if (message.length > 150 || new TextEncoder().encode(message).length > 80) {
        showModal("Error", "<p>Message is too long. Please keep it under 150 characters or 80 bytes.</p>");
        return;
    }
    
    if (!walletConnected) {
        showModal("Wallet Required", "<p>Please connect your wallet first to encrypt a message.</p>");
        return;
    }
    
    try {
        // Base64 encode the message (not true encryption, just encoding)
        const encodedMessage = btoa(message);
        
        // Show the encoded message
        encryptedMessageOutput.textContent = encodedMessage;
        
        // Create transaction data
        const txData = {
            message: encodedMessage,
            timestamp: Date.now(),
            unlockBlockHeight: CONTRACT_CONFIG.unlockBlockHeight
        };
        
        // Store transaction data for later use
        window.txData = txData;
        
        // Show transaction details
        output.innerHTML = `
            <p><strong>Recipient:</strong> ${CONTRACT_CONFIG.feeRecipient}</p>
            <p><strong>Amount:</strong> ${CONTRACT_CONFIG.feeAmount} BTC</p>
            <p><strong>Unlock Block:</strong> ${CONTRACT_CONFIG.unlockBlockHeight}</p>
            <p><strong>Message Size:</strong> ${new TextEncoder().encode(encodedMessage).length} bytes</p>
        `;
        
        // Show the encryption result
        encryptionResult.style.display = "block";
        
    } catch (error) {
        console.error("Error encrypting message:", error);
        showModal("Encryption Error", `<p>Failed to encrypt message: ${error.message}</p>`);
    }
}

// Function to sign and submit transaction
async function signAndSubmitTransaction() {
    if (!walletConnected || !currentAccount) {
        showModal("Wallet Required", "<p>Please connect your wallet first to sign and submit the transaction.</p>");
        return;
    }
    
    // Get the transaction data that was stored when encrypting the message
    const txData = window.txData;
    if (!txData) {
        showModal("Error", "<p>No transaction data found. Please encrypt a message first.</p>");
        return;
    }
    
    try {
        // Show loading state
        const signButton = document.getElementById('signTransaction');
        const originalText = signButton.innerText;
        signButton.innerText = "Signing...";
        signButton.disabled = true;
        
        // Create the transaction based on wallet type
        let txResult;
        
        switch(currentWalletType) {
            case 'unisat':
                // Create a simple payment transaction for Unisat
                txResult = await window.unisat.sendBitcoin(
                    CONTRACT_CONFIG.feeRecipient,
                    CONTRACT_CONFIG.feeAmount
                );
                break;
                
            case 'leather':
                // For Leather wallet
                const provider = window.LeatherProvider || window.btc;
                txResult = await provider.request('sendTransfer', {
                    address: CONTRACT_CONFIG.feeRecipient,
                    amount: CONTRACT_CONFIG.feeAmount * 100000000, // Convert to sats
                    memo: txData.message // Include the encoded message as memo
                });
                break;
                
            case 'okx':
                // For OKX wallet
                const okxProvider = window.okxwallet.bitcoin;
                txResult = await okxProvider.transfer({
                    to: CONTRACT_CONFIG.feeRecipient,
                    amount: CONTRACT_CONFIG.feeAmount,
                    memo: txData.message
                });
                break;
                
            case 'xverse':
                // For Xverse wallet using SatsConnect
                const sendBtcOptions = {
                    payload: {
                        network: {
                            type: 'testnet'
                        },
                        recipients: [
                            {
                                address: CONTRACT_CONFIG.feeRecipient,
                                amountSats: Math.floor(CONTRACT_CONFIG.feeAmount * 100000000)
                            }
                        ],
                        senderAddress: currentAccount
                    },
                    onFinish: (response) => {
                        handleTransactionSuccess(response.txid);
                    },
                    onCancel: () => {
                        signButton.innerText = originalText;
                        signButton.disabled = false;
                        showModal("Transaction Cancelled", "<p>The transaction was cancelled.</p>");
                    }
                };
                
                window.SatsConnect.sendBtc(sendBtcOptions);
                return; // Return early as this is handled in callbacks
                
            default:
                throw new Error(`Unsupported wallet type: ${currentWalletType}`);
        }
        
        // Handle successful transaction (for non-Xverse wallets)
        handleTransactionSuccess(txResult);
        
    } catch (error) {
        console.error("Error signing transaction:", error);
        showModal("Transaction Error", `<p>Failed to sign and submit the transaction: ${error.message}</p>`);
        
        // Reset button state
        const signButton = document.getElementById('signTransaction');
        if (signButton) {
            signButton.innerText = "Sign & Submit";
            signButton.disabled = false;
        }
    }
}

// Function to handle successful transaction
function handleTransactionSuccess(txId) {
    // Reset button state
    const signButton = document.getElementById('signTransaction');
    if (signButton) {
        signButton.innerText = "Sign & Submit";
        signButton.disabled = false;
    }
    
    // Show success message
    showModal("Transaction Submitted", `
        <p>Your message has been successfully stored in the Bitcoin Time Capsule!</p>
        <p><strong>Transaction ID:</strong> <a href="https://explorer.bc-2.jp/tx/${txId}" target="_blank">${txId}</a></p>
        <p>Your message will be unlockable after block ${CONTRACT_CONFIG.unlockBlockHeight}.</p>
    `);
    
    // Add the new message to the stored messages list
    addNewMessageToList(txId);
    
    // Reset the encryption form
    document.getElementById("encryptionResult").style.display = "none";
    document.getElementById("message").value = "";
    document.getElementById("charCount").textContent = "0";
    document.getElementById("byteCount").textContent = "0";
}

// Function to add new message to list
function addNewMessageToList(txId) {
    const storedMessagesList = document.getElementById('storedMessagesList');
    if (!storedMessagesList) return;
    
    // Create a new message item
    const messageItem = document.createElement('div');
    messageItem.className = 'message-item';
    messageItem.innerHTML = `
        <p><strong>Transaction ID:</strong> <a href="https://explorer.bc-2.jp/tx/${txId}" target="_blank">${txId}</a></p>
        <p><strong>Status:</strong> <span class="status-pending">Pending</span></p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;
    
    // Add to the list
    if (storedMessagesList.querySelector('p')) {
        // Remove placeholder text if it exists
        storedMessagesList.innerHTML = '';
    }
    
    // Add to the beginning of the list
    storedMessagesList.insertBefore(messageItem, storedMessagesList.firstChild);
    
    // Save to local storage
    saveMessageToLocalStorage(txId);
}

// Function to save message to local storage
function saveMessageToLocalStorage(txId) {
    try {
        // Get existing messages
        let messages = JSON.parse(localStorage.getItem('timeCapsuleMessages') || '[]');
        
        // Add new message
        messages.push({
            txId: txId,
            address: currentAccount,
            timestamp: Date.now(),
            status: 'pending'
        });
        
        // Save back to local storage
        localStorage.setItem('timeCapsuleMessages', JSON.stringify(messages));
    } catch (error) {
        console.error("Error saving message to local storage:", error);
    }
}

// Function to check message status
function checkMessage() {
    const txIdInput = document.getElementById('txIdInput');
    const messageStatus = document.getElementById('messageStatus');
    
    if (!txIdInput || !messageStatus) {
        console.error("Required elements not found");
        return;
    }
    
    const txId = txIdInput.value.trim();
    
    if (!txId) {
        messageStatus.innerHTML = `<p class="error-text">Please enter a transaction ID.</p>`;
        return;
    }
    
    // Show loading state
    messageStatus.innerHTML = `<p>Checking message status...</p>`;
    
    // Fetch message status from API
    fetchMessageStatus(txId)
        .then(status => {
            if (status.found) {
                messageStatus.innerHTML = `
                    <div class="message-item">
                        <p><strong>Transaction ID:</strong> <a href="https://explorer.bc-2.jp/tx/${txId}" target="_blank">${txId}</a></p>
                        <p><strong>Status:</strong> <span class="status-${status.unlocked ? 'unlocked' : 'pending'}">${status.unlocked ? 'Unlocked' : 'Pending'}</span></p>
                        <p><strong>Block Height:</strong> ${status.blockHeight}</p>
                        <p><strong>Unlock Block:</strong> ${CONTRACT_CONFIG.unlockBlockHeight}</p>
                        ${status.unlocked ? `<p><strong>Message:</strong> ${status.message}</p>` : ''}
                    </div>
                `;
            } else {
                messageStatus.innerHTML = `<p class="error-text">Message not found. Please check the transaction ID and try again.</p>`;
            }
        })
        .catch(error => {
            console.error("Error checking message status:", error);
            messageStatus.innerHTML = `<p class="error-text">Error checking message status: ${error.message}</p>`;
        });
}

// Function to fetch message status from API
async function fetchMessageStatus(txId) {
    // In a real implementation, this would call an API
    // For this demo, we'll simulate a response
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get current block height
    const currentBlockHeight = await fetchCurrentBlockHeight();
    
    // Simulate a response
    return {
        found: true,
        txId: txId,
        blockHeight: currentBlockHeight - Math.floor(Math.random() * 100),
        unlocked: currentBlockHeight >= CONTRACT_CONFIG.unlockBlockHeight,
        message: currentBlockHeight >= CONTRACT_CONFIG.unlockBlockHeight ? "This is a sample decoded message." : null
    };
}

// Function to switch tabs
function switchTab(tabId, button) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show the selected tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Update active button
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    button.classList.add('active');
}

// ===== MODAL FUNCTIONALITY =====

// Function to initialize modal handlers
function initModalHandlers() {
    // Close modal button
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // OK button in modal
    const modalOk = document.getElementById('modalOk');
    if (modalOk) {
        modalOk.addEventListener('click', closeModal);
    }
    
    // Click outside modal to close
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    // Initialize donation copy functionality
    const donationAddress = document.getElementById('donationAddress');
    if (donationAddress) {
        donationAddress.addEventListener('click', function() {
            const addressText = document.getElementById('donationAddressText').textContent;
            copyToClipboard(addressText);
            
            // Show confirmation
            const confirmation = donationAddress.querySelector('.copy-confirmation');
            if (confirmation) {
                confirmation.classList.add('show');
                setTimeout(() => {
                    confirmation.classList.remove('show');
                }, 2000);
            }
        });
    }
}

// Function to show modal
function showModal(title, content) {
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (modalOverlay && modalTitle && modalBody) {
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modalOverlay.classList.add('active');
    }
}

// Function to close modal
function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
    }
}

// Function to initialize donation copy functionality
function initDonationCopy() {
    const donationAddress = document.getElementById('donationAddress');
    if (donationAddress) {
        donationAddress.addEventListener('click', function() {
            const addressText = document.getElementById('donationAddressText').textContent;
            copyToClipboard(addressText);
            
            // Show confirmation
            const confirmation = donationAddress.querySelector('.copy-confirmation');
            if (confirmation) {
                confirmation.classList.add('show');
                setTimeout(() => {
                    confirmation.classList.remove('show');
                }, 2000);
            }
        });
    }
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy text: ', err);
        
        // Fallback method
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });
}

// ===== BLOCK HEIGHT AND COUNTDOWN FUNCTIONALITY =====

// Function to initialize block height and countdown
async function initBlockHeightAndCountdown() {
    try {
        // Fetch current block height from a Bitcoin Signet API
        const currentBlockHeight = await fetchCurrentBlockHeight();
        
        // Update UI with current block height
        updateBlockHeightUI(currentBlockHeight);
        
        // Start the countdown immediately with machine time
        startRealTimeCountdown(currentBlockHeight, CONTRACT_CONFIG.unlockBlockHeight);
        
        // Set up interval to refresh block height data every minute
        setInterval(async () => {
            try {
                const updatedBlockHeight = await fetchCurrentBlockHeight();
                updateBlockHeightUI(updatedBlockHeight);
            } catch (error) {
                console.error("Error updating block height:", error);
            }
        }, 60000); // Update every minute
    } catch (error) {
        console.error("Error initializing block height and countdown:", error);
        document.getElementById('currentBlockHeight').textContent = "Error loading";
        document.getElementById('blockStatus').innerHTML = `
            <p class="status-text">Error loading block data. Please refresh the page.</p>
        `;
    }
}

// Function to fetch current block height from a Bitcoin Signet API
async function fetchCurrentBlockHeight() {
    // Try multiple APIs for redundancy
    const apis = [
        "https://mempool.space/signet/api/blocks/tip/height",
        "https://explorer.bc-2.jp/api/blocks/tip/height"
    ];
    
    // Try each API until one succeeds
    for (const api of apis) {
        try {
            const response = await fetch(api);
            if (!response.ok) continue;
            
            const blockHeight = await response.text();
            return parseInt(blockHeight.trim(), 10);
        } catch (error) {
            console.warn(`Failed to fetch from ${api}:`, error);
            // Continue to next API
        }
    }
    
    // If all APIs fail, throw error
    throw new Error("Failed to fetch current block height from all APIs");
}

// Function to update block height UI
function updateBlockHeightUI(currentBlockHeight) {
    const currentBlockElement = document.getElementById('currentBlockHeight');
    if (currentBlockElement) {
        currentBlockElement.textContent = currentBlockHeight.toLocaleString();
    }
    
    const unlockBlockElement = document.getElementById('unlockBlockHeight');
    if (unlockBlockElement) {
        unlockBlockElement.textContent = CONTRACT_CONFIG.unlockBlockHeight.toLocaleString();
    }
    
    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        // Calculate blocks remaining
        const blocksRemaining = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
        
        // Use a smaller range to make progress more visible
        // Instead of using the full 12,381 blocks, use a smaller number
        // This will exaggerate the progress for better visibility
        const visibleProgressScale = 1000; // Smaller number makes progress appear larger
        
        // Calculate progress percentage with scaled value
        const progress = Math.min(100, Math.max(0, 
            (blocksRemaining / visibleProgressScale) * 100
        ));
        
        // Calculate inverse progress (how much is filled)
        // Ensure it's at least 5% visible and at most 100%
        const fillProgress = Math.min(100, Math.max(5, 100 - progress));
        
        // Set the width directly
        progressBar.style.width = fillProgress + '%';
        console.log(`Progress bar set to ${fillProgress}%`);
    }
    
    // Update blocks remaining
    const blocksRemainingElement = document.getElementById('blocksRemaining');
    if (blocksRemainingElement) {
        const blocksRemaining = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
        blocksRemainingElement.textContent = blocksRemaining.toLocaleString();
    }
}

// Function to start real-time countdown synced with machine time
function startRealTimeCountdown(currentBlockHeight, unlockBlockHeight) {
    const blocksRemaining = unlockBlockHeight - currentBlockHeight;
    
    if (blocksRemaining <= 0) {
        // Time capsule is already unlockable
        document.getElementById('blockStatus').className = 'status-indicator unlockable';
        document.getElementById('blockStatus').innerHTML = `
            <div class="countdown-complete">
                <span class="countdown-complete-text">Time Capsule Unlocked!</span>
            </div>
            <p class="status-text">Messages are now unlockable! Be among the first to unlock and receive rewards.</p>
        `;
        return;
    }
    
    // Calculate estimated total seconds remaining
    const totalSecondsRemaining = blocksRemaining * 600; // 600 seconds = 10 minutes per block
    
    // Calculate target unlock time based on current time
    const targetUnlockTime = Date.now() + (totalSecondsRemaining * 1000);
    
    // Update countdown immediately
    updateCountdownDisplay(targetUnlockTime);
    
    // Set interval to update countdown every second
    setInterval(() => {
        updateCountdownDisplay(targetUnlockTime);
    }, 1000); // Update every second
}

// Function to update countdown display based on target time
function updateCountdownDisplay(targetTime) {
    const now = Date.now();
    const timeRemaining = targetTime - now;
    
    if (timeRemaining <= 0) {
        // Time's up!
        document.getElementById('blockStatus').className = 'status-indicator unlockable';
        document.getElementById('blockStatus').innerHTML = `
            <div class="countdown-complete">
                <span class="countdown-complete-text">Time Capsule Unlocked!</span>
            </div>
            <p class="status-text">Messages are now unlockable! Be among the first to unlock and receive rewards.</p>
        `;
        return;
    }
    
    // Calculate days, hours, minutes, seconds
    const totalSeconds = Math.floor(timeRemaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    // Format with leading zeros for hours, minutes and seconds
    const formattedDays = days.toString();
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');
    
    // Update countdown UI
    document.getElementById('countdownDays').textContent = formattedDays;
    document.getElementById('countdownHours').textContent = formattedHours;
    document.getElementById('countdownMinutes').textContent = formattedMinutes;
    document.getElementById('countdownSeconds').textContent = formattedSeconds;
}
// Twitter Carousel Implementation
document.addEventListener('DOMContentLoaded', function() {
    initTwitterCarousel();
    
    // Re-initialize carousel on window resize for better responsiveness
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Adjust carousel height based on content
            adjustCarouselHeight();
        }, 250);
    });
});

function initTwitterCarousel() {
    // Twitter posts data
    const twitterPosts = [
        {
            image: "twitter-x.png",
            text: "🔒 Just sealed my thoughts in the #Bitcoin Time Capsule using BRC-2.0 tech! 🚀 My message is now forged into the blockchain until block 263527. Win a share of the unlock prize by being among the first to decrypt! #BitcoinTimeCapsule #BRC20",
        },
        {
            image: "twitter-xi.png",
            text: "✨ Bitcoin Time Capsule + BRC-2.0 = digital permanence like never before! 🔐 My encrypted message awaits at block 263527 with prizes for the first unlockers! Create your own blockchain time vault on Signet now! #BitcoinTimeCapsule 💎",
        },
        {
            image: "twitter-xiii.png",
            text: "🧠 My future self will thank me! Just used Bitcoin Time Capsule's BRC-2.0 platform to inscribe an encrypted message that unlocks with prizes at block 263527! 🏆 The future of digital permanence is here! #BitcoinTimeCapsule #Encryption",
        },
        {
            image: "twitter-xiiii.png",
            text: "🔮 Blockchain magic: My message is now immortalized via Bitcoin Time Capsule's BRC-2.0 contract! 💰 First unlockers at block 263527 share 60% of fees as prizes! Join the inscription revolution on Signet! #BitcoinTimeCapsule #BRC20 🚀",
        }
    ];

    // Get carousel elements
    const carousel = document.getElementById('twitterCarousel');
    const indicators = document.getElementById('carouselIndicators');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    
    if (!carousel || !indicators || !prevBtn || !nextBtn) {
        console.error("Carousel elements not found");
        return;
    }

    let currentSlide = 0;
    
    // Create slides
    twitterPosts.forEach((post, index) => {
        // Create slide
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        
        // For mobile, create shorter versions of the text
        const shortText = post.text.split(' ').slice(0, 15).join(' ') + '... #BitcoinTimeCapsule';
        
        slide.innerHTML = `
            <div class="carousel-slide-content">
                <img src="${post.image}" alt="Twitter post ${index + 1}" class="carousel-slide-image">
                <p class="carousel-slide-text full-text">${post.text}</p>
                <p class="carousel-slide-text short-text" style="display: none;">${shortText}</p>
                <div class="carousel-slide-actions">
                    <button class="copy-tweet-btn" data-tweet="${post.text}">
                        Copy & Post
                    </button>
                </div>
            </div>
        `;
        
        carousel.appendChild(slide);
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator';
        if (index === 0) indicator.classList.add('active');
        indicator.dataset.slide = index;
        
        indicator.addEventListener('click', () => {
            goToSlide(index);
        });
        
        indicators.appendChild(indicator);
        
        // Add event listener to copy button
        slide.querySelector('.copy-tweet-btn').addEventListener('click', function() {
            const tweetText = this.dataset.tweet;
            copyToClipboard(tweetText);
            
            // Show confirmation
            const originalText = this.innerHTML;
            this.innerHTML = 'Copied!';
            this.disabled = true;
            
            setTimeout(() => {
                this.innerHTML = originalText;
                this.disabled = false;
            }, 2000);
            
            // Open Twitter in new tab
            window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText), '_blank');
        });
    });
    
    // Set up navigation
    prevBtn.addEventListener('click', () => {
        goToSlide(currentSlide - 1);
    });
    
    nextBtn.addEventListener('click', () => {
        goToSlide(currentSlide + 1);
    });
    
    // Add touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    const carouselContainer = document.querySelector('.carousel-container');
    
    carouselContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});
    
    carouselContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, {passive: true});
    
    function handleSwipe() {
        const swipeThreshold = 50; // Minimum distance for a swipe
        if (touchEndX < touchStartX - swipeThreshold) {
            // Swipe left - go to next slide
            goToSlide(currentSlide + 1);
        } else if (touchEndX > touchStartX + swipeThreshold) {
            // Swipe right - go to previous slide
            goToSlide(currentSlide - 1);
        }
    }
    
    // Auto-advance slides every 8 seconds
    let slideInterval = setInterval(() => {
        goToSlide(currentSlide + 1);
    }, 8000);
    
    // Pause auto-advance when hovering over carousel
    carouselContainer.addEventListener('mouseenter', () => {
        clearInterval(slideInterval);
    });
    
    carouselContainer.addEventListener('mouseleave', () => {
        slideInterval = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, 8000);
    });
    
    // Also pause on touch for mobile
    carouselContainer.addEventListener('touchstart', () => {
        clearInterval(slideInterval);
    }, {passive: true});
    
    carouselContainer.addEventListener('touchend', () => {
        slideInterval = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, 8000);
    }, {passive: true});
    
    // Function to go to a specific slide
    function goToSlide(slideIndex) {
        const slides = carousel.querySelectorAll('.carousel-slide');
        const indicators = document.querySelectorAll('.carousel-indicator');
        
        // Handle wrapping
        if (slideIndex < 0) {
            slideIndex = slides.length - 1;
        } else if (slideIndex >= slides.length) {
            slideIndex = 0;
        }
        
        // Update current slide
        currentSlide = slideIndex;
        
        // Move carousel
        carousel.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update indicators
        indicators.forEach((indicator, index) => {
            if (index === currentSlide) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }
    
    // Helper function to copy text to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy text: ', err);
            
            // Fallback method
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }
    
    // Initial adjustment of carousel height
    adjustCarouselHeight();
}

// Function to adjust carousel height based on content
function adjustCarouselHeight() {
    const carouselSlides = document.querySelectorAll('.carousel-slide');
    if (!carouselSlides.length) return;
    
    // Get viewport width to determine if we're on mobile
    const viewportWidth = window.innerWidth;
    
    // For mobile screens, ensure images are properly sized
    if (viewportWidth <= 767) {
        const images = document.querySelectorAll('.carousel-slide-image');
        images.forEach(img => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.maxHeight = viewportWidth <= 480 ? '120px' : '180px';
            img.style.margin = '0 auto var(--space-xs)';
        });
        
        // Show shorter text on mobile
        const fullTexts = document.querySelectorAll('.full-text');
        const shortTexts = document.querySelectorAll('.short-text');
        
        if (viewportWidth <= 480) {
            fullTexts.forEach(text => text.style.display = 'none');
            shortTexts.forEach(text => text.style.display = 'block');
        } else {
            fullTexts.forEach(text => text.style.display = 'block');
            shortTexts.forEach(text => text.style.display = 'none');
        }
    } else {
        // On desktop, show full text
        const fullTexts = document.querySelectorAll('.full-text');
        const shortTexts = document.querySelectorAll('.short-text');
        
        fullTexts.forEach(text => text.style.display = 'block');
        shortTexts.forEach(text => text.style.display = 'none');
    }
}
