// Configuration (adjust as needed)
const CONTRACT_CONFIG = {
    feeRecipient: 'bc1qyetzzylgkyq6rcqx4uu9jyrhzs0ume44t9rfrw', // Replace with actual recipient
    feeAmount: 0.0001, // Storage Fee in Signet BTC
    unlockBlockHeight: 263527, // Target unlock block height
    network: 'signet', // Target network
    inscriptionPostage: 10000 // Example postage for inscription
};

// Global state
let walletConnected = false;
let currentWallet = null; // Stores the connected wallet provider object
let userAddress = null;
let userPublicKey = null;
let currentNetwork = { network: 'unknown' }; // Store current network info
let networkStatusInterval = null;
let countdownInterval = null;
let carouselAutoSlideInterval = null;


// Utility function to show modals
function showModal(title, bodyHtml, isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
    if (!modalOverlay) {
        console.error("Modal overlay element not found:", isWalletModal ? '#walletSelectionModal' : '#modalOverlay');
        return;
    }

    const modalTitle = modalOverlay.querySelector('.modal-title');
    const modalBody = modalOverlay.querySelector('.modal-body');
    const modalClose = modalOverlay.querySelector('.modal-close');
    const modalOk = modalOverlay.querySelector('.modal-footer .btn-primary');

    if (modalTitle) modalTitle.textContent = title;
    if (modalBody && !isWalletModal && bodyHtml !== undefined) {
        modalBody.innerHTML = bodyHtml;
    }

    modalOverlay.classList.add('active');

    const closeModal = () => {
        modalOverlay.classList.remove('active');
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) {
            modalElement.style.opacity = '0';
            modalElement.style.transform = 'translateY(-50px)';
        }
    };

    if (modalClose) {
        const oldCloseHandler = modalClose._closeHandler;
        if (oldCloseHandler) modalClose.removeEventListener('click', oldCloseHandler);
        const newCloseHandler = closeModal;
        modalClose.addEventListener('click', newCloseHandler);
        modalClose._closeHandler = newCloseHandler;
    }

    if (modalOk && !isWalletModal) {
        const oldOkHandler = modalOk._okHandler;
        if (oldOkHandler) modalOk.removeEventListener('click', oldOkHandler);
        const newOkHandler = closeModal;
        modalOk.addEventListener('click', newOkHandler);
        modalOk._okHandler = newOkHandler;
    }

    const oldOverlayClickHandler = modalOverlay._overlayClickHandler;
    if (oldOverlayClickHandler) modalOverlay.removeEventListener('click', oldOverlayClickHandler);
    const newOverlayClickHandler = (e) => {
        if (e.target === modalOverlay) closeModal();
    };
    modalOverlay.addEventListener('click', newOverlayClickHandler);
    modalOverlay._overlayClickHandler = newOverlayClickHandler;

    setTimeout(() => {
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) {
            modalElement.style.opacity = '1';
            modalElement.style.transform = 'translateY(0)';
        }
    }, 10);
    console.log(`Modal shown: ${title}`);
}

// Utility function to hide modals
function hideModal(isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
    if (modalOverlay) {
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) {
            modalElement.style.opacity = '0';
            modalElement.style.transform = 'translateY(-50px)';
        }
        setTimeout(() => {
            modalOverlay.classList.remove('active');
            console.log(`Modal hidden: ${isWalletModal ? 'Wallet' : 'Regular'}`);
        }, 300);
    } else {
        console.error("Modal overlay element not found for hiding:", isWalletModal ? '#walletSelectionModal' : '#modalOverlay');
    }
}


// Wallet Connection Logic
async function initWalletConnection() {
    console.log("Initializing wallet connection.");
    const connectWalletButton = document.getElementById('connectWallet');
    const walletStatus = document.getElementById('walletStatus');
    const walletSelectionModal = document.getElementById('walletSelectionModal');
    const encryptMessageBtn = document.getElementById('encryptMessageBtn');

    if (!connectWalletButton || !walletStatus || !walletSelectionModal || !encryptMessageBtn) {
        console.error("Critical wallet UI elements not found.");
        return;
    }

    await checkWalletsAvailability(); // Ensure this runs and completes

    connectWalletButton.onclick = () => {
        console.log("Connect Wallet button clicked.");
        showModal('Select your Bitcoin wallet', '', true);
        const modalElement = document.getElementById('walletSelectionModal');
        if (modalElement) {
            const walletOptions = modalElement.querySelectorAll('.wallet-option');
            walletOptions.forEach(button => {
                const oldClickHandler = button._clickHandler;
                if (oldClickHandler) button.removeEventListener('click', oldClickHandler);

                const newClickHandler = async () => {
                    const walletType = button.getAttribute('data-wallet');
                    if (button.classList.contains('unavailable')) {
                        hideModal(true);
                        showModal("Wallet Not Found", `<p>The ${walletType} wallet was not detected. Please install it and refresh the page.</p>`);
                        return;
                    }
                    hideModal(true);
                    try {
                        await connectToWallet(walletType);
                        updateEncryptButtonState(); // Update button state after connection attempt
                    } catch (error) {
                        console.error(`Failed to connect to ${walletType}:`, error);
                        walletStatus.textContent = `Connection Failed: ${error.message || 'Unknown error'}`;
                        walletConnected = false;
                        userAddress = null;
                        userPublicKey = null;
                        currentWallet = null;
                        currentNetwork = { network: 'unknown' };
                        updateEncryptButtonState();
                        showModal("Connection Error", `<p>Failed to connect to ${walletType}. Ensure the wallet is installed, unlocked, and try again.</p><p>Details: ${error.message || 'Unknown error'}</p>`);
                    }
                };
                button.addEventListener('click', newClickHandler);
                button._clickHandler = newClickHandler;
            });
        }
    };

    const handleDisconnect = (providerName = "Wallet") => {
        console.log(`${providerName} disconnected or session ended.`);
        walletConnected = false;
        userAddress = null;
        userPublicKey = null;
        currentWallet = null;
        currentNetwork = { network: 'unknown' };
        walletStatus.textContent = 'Wallet Status: Disconnected';
        connectWalletButton.style.display = 'inline-block';
        updateEncryptButtonState();
        clearInterval(networkStatusInterval);
        networkStatusInterval = null;
        // Avoid showing modal if it was a deliberate disconnect or page unload
        // showModal("Wallet Disconnected", "<p>Your wallet has been disconnected.</p>");
    };

    const handleAccountsChanged = async (accounts, providerName = "Wallet") => {
        console.log(`${providerName} accounts changed:`, accounts);
        if (!accounts || accounts.length === 0) {
            handleDisconnect(providerName);
            return;
        }
        userAddress = accounts[0].address || accounts[0]; // OKX might pass string array
        
        // Re-verify network and update UI
        if (currentWallet && currentWallet.getNetwork) {
            try {
                currentNetwork = await currentWallet.getNetwork();
                if (!currentNetwork || !currentNetwork.network) { // Handle OKX undefined network
                    currentNetwork = { network: CONTRACT_CONFIG.network }; // Default to signet
                }
            } catch (e) {
                console.warn(`Error getting network from ${providerName} after accountsChanged:`, e);
                currentNetwork = { network: CONTRACT_CONFIG.network }; // Default
            }
        } else {
            // If getNetwork isn't available, assume last known or default. This part is tricky.
            // For SatsConnect, network info comes with account typically.
            console.warn(`${providerName} does not have a getNetwork method. Network state might be stale.`);
        }
        
        const walletTypeName = currentWallet?._brand?.name || providerName;
        walletStatus.textContent = `Connected (${walletTypeName}): ${currentNetwork.network ? currentNetwork.network.toUpperCase() : 'SIGNET'}`;
        walletConnected = true; // Account changed, but still connected.
        connectWalletButton.style.display = 'none';
        updateEncryptButtonState();
        console.log(`Active account: ${userAddress}, Network: ${currentNetwork.network}`);
    };

    const handleNetworkChanged = async (networkInfo, providerName = "Wallet") => {
        console.log(`${providerName} network changed:`, networkInfo);
        if (typeof networkInfo === 'string') {
            currentNetwork = { network: networkInfo.toLowerCase() };
        } else if (networkInfo && networkInfo.network) {
            currentNetwork = networkInfo;
        } else if (currentWallet && currentWallet.getNetwork) { // Fallback if direct info is not good
            try {
                currentNetwork = await currentWallet.getNetwork();
                 if (!currentNetwork || !currentNetwork.network) { // Handle OKX undefined network
                    currentNetwork = { network: CONTRACT_CONFIG.network }; // Default to signet
                }
            } catch (e) {
                 console.warn(`Error getting network from ${providerName} after networkChanged:`, e);
                 currentNetwork = { network: CONTRACT_CONFIG.network }; // Default
            }
        } else {
            currentNetwork = { network: CONTRACT_CONFIG.network }; // Default if un-obtainable
        }

        const walletTypeName = currentWallet?._brand?.name || providerName;
        walletStatus.textContent = `Connected (${walletTypeName}): ${currentNetwork.network ? currentNetwork.network.toUpperCase() : 'SIGNET'}`;
        
        if (currentNetwork.network !== CONTRACT_CONFIG.network) {
            promptNetworkSwitch(walletTypeName);
        }
        updateEncryptButtonState();
    };
    
    // Unisat listeners
    if (window.unisat && window.unisat.on) {
        console.log("Attaching Unisat listeners.");
        window.unisat.on('accountsChanged', (accounts) => handleAccountsChanged(accounts, "Unisat"));
        window.unisat.on('networkChanged', (network) => handleNetworkChanged(network, "Unisat"));
        // Unisat doesn't have a standard 'disconnect' event. Handled by accountsChanged []
    }

    // OKX Wallet listeners
    if (typeof window.okxwallet?.bitcoin?.on === 'function') {
        console.log("Attaching OKX Wallet listeners.");
        window.okxwallet.bitcoin.on('accountsChanged', (accounts) => handleAccountsChanged(accounts, "OKX")); // OKX might pass {address, publicKey} or just address strings
        window.okxwallet.bitcoin.on('networkChanged', (network) => handleNetworkChanged(network, "OKX"));
        // OKX might also use accountsChanged [] for disconnects
    }
    
    // For SatsConnect compatible wallets (Xverse, Leather), events are typically handled by the library
    // or by re-requesting info. `sats-connect` itself doesn't emit standardized events on `window`.
    // We rely on `checkInitialConnection` and manual connect/monitoring.

    // General `window.bitcoin` (potentially for Xverse if it still uses this)
    // This is less common now with more specific provider objects
    if (window.bitcoin && window.bitcoin.on && window.bitcoin !== window.unisat && window.bitcoin !== window.okxwallet?.bitcoin) {
        console.log("Attaching generic window.bitcoin listeners (e.g., for older Xverse).");
        window.bitcoin.on('accountsChanged', (accounts) => handleAccountsChanged(accounts, "Generic Bitcoin Provider"));
        window.bitcoin.on('networkChanged', (network) => handleNetworkChanged(network, "Generic Bitcoin Provider"));
    }


    await checkInitialConnection();

    const tcppLinkInWalletModal = document.getElementById('tcppLink');
    if (tcppLinkInWalletModal) {
        tcppLinkInWalletModal.addEventListener('click', (e) => {
            e.preventDefault();
            hideModal(true);
            showModal("Terms and Privacy Policy", `
                <div class="tcpp-content" style="text-align: left; max-height: 70vh; overflow-y: auto;">
                    <h3>Terms of Service</h3><p>Last Updated: May 9, 2025</p>
                    <h4>1. Acceptance of Terms</h4><p>By using the Bitcoin Time Capsule ("Service"), you agree to these Terms. If you disagree, do not use the Service.</p>
                    <h4>2. Service Description</h4><p>This is an experimental Signet testnet application for time-locked messages. For testing only.</p>
                    <h4>3. Risks</h4><p>The Service is experimental and may have bugs or errors. Use at your own risk. No warranties provided.</p>
                    <h4>4. Fees & Transactions</h4><p>Blockchain transactions are irreversible. Fees apply as displayed. Signet BTC has no real value.</p>
                    <h4>5. Limitation of Liability</h4><p>We are not liable for any damages arising from your use of the Service.</p>
                    <h3>Privacy Policy</h3><p>Last Updated: May 9, 2025</p>
                    <h4>1. Information</h4><p>We may log public blockchain data (addresses, transaction IDs) for operational purposes. No private keys are stored or requested beyond wallet interactions.</p>
                    <h4>2. Data Use</h4><p>Data is used to operate and improve the Service. Blockchain data is public.</p>
                    <h4>3. Third Parties</h4><p>Interactions with wallet providers are subject to their terms and policies.</p>
                </div>
            `);
        });
    }
}

async function checkInitialConnection() {
    console.log("Checking for initial wallet connection.");
    try {
        // Check Unisat
        if (typeof window.unisat?.requestAccounts === 'function') {
            try {
                const accounts = await window.unisat.getAccounts();
                if (accounts && accounts.length > 0) {
                    console.log("Initial connection found with Unisat.");
                    userAddress = accounts[0];
                    currentWallet = window.unisat; // Set the provider
                    currentNetwork = await window.unisat.getNetwork();
                    handleInitialWalletConnection('Unisat', currentNetwork);
                    return;
                }
            } catch (e) { console.warn("Unisat not initially connected or error:", e.message); }
        }

        // Check OKX
        if (typeof window.okxwallet?.bitcoin?.connect === 'function') {
            try {
                // OKX's `connect` might auto-connect if previously approved or list accounts.
                // `getAccounts` might be better if it exists and doesn't prompt.
                // For OKX, an explicit `isConnected` or `getAccounts` without prompt is better.
                // Let's assume if `okxwallet.bitcoin.selectedAccount` exists, it's connected.
                if (window.okxwallet.bitcoin.selectedAccount) {
                     const acc = window.okxwallet.bitcoin.selectedAccount;
                     userAddress = acc.address;
                     userPublicKey = acc.publicKey;
                     currentWallet = window.okxwallet.bitcoin;
                     currentNetwork = await window.okxwallet.bitcoin.getNetwork();
                     if (!currentNetwork || !currentNetwork.network) currentNetwork = {network: CONTRACT_CONFIG.network};
                     console.log("Initial connection found with OKX.");
                     handleInitialWalletConnection('OKX', currentNetwork);
                     return;
                }
            } catch (e) { console.warn("OKX not initially connected or error:", e.message); }
        }
        
        // Check SatsConnect (for Xverse/Leather)
        if (typeof window.satsConnect?. évekRequest === 'function' || typeof window.satsconnect?.request === 'function') { // satsConnect casing
            const sc = window.satsConnect || window.satsconnect;
            try {
                // This request usually prompts if not connected.
                // A 'getAccounts' type request without prompt is better for *initial check*.
                // SatsConnect doesn't have a simple "am I connected?" without potential prompt.
                // We might skip auto-connecting via SatsConnect to avoid unexpected popups on page load.
                // User can click "Connect Wallet".
                console.log("SatsConnect detected. Initial connection check deferred to user action or specific wallet logic.");

            } catch (e) { console.warn("SatsConnect initial check error (or no pre-existing connection):", e.message); }
        }


        console.log("No silent initial wallet connection found.");
    } catch (error) {
        console.warn("Error during initial wallet connection check:", error);
    }
}

function handleInitialWalletConnection(walletType, networkInfo) {
    const walletStatus = document.getElementById('walletStatus');
    const connectWalletButton = document.getElementById('connectWallet');
    
    walletConnected = true;
    currentNetwork = networkInfo;
    if (!currentNetwork || !currentNetwork.network) { // Handle OKX undefined network
        currentNetwork = { network: CONTRACT_CONFIG.network };
    }

    console.log(`Initial connection established with ${walletType}. Address: ${userAddress}, Network: ${currentNetwork.network}`);
    
    walletStatus.textContent = `Connected (${walletType}): ${currentNetwork.network.toUpperCase()}`;
    connectWalletButton.style.display = 'none';

    if (currentNetwork.network !== CONTRACT_CONFIG.network) {
        promptNetworkSwitch(walletType);
    }
    updateEncryptButtonState();
    startNetworkStatusMonitoring();
}

async function checkWalletsAvailability() {
    console.log("Checking wallet availability.");
    const walletOptions = document.querySelectorAll('#walletSelectionModal .wallet-option');
    const walletAvailabilityMessage = document.getElementById('walletAvailabilityMessage');
    const walletSelectInstruction = document.getElementById('walletSelectInstruction');

    if (!walletOptions.length || !walletAvailabilityMessage || !walletSelectInstruction) {
        console.error("Wallet availability UI elements missing.");
        return;
    }

    let walletsFound = 0;

    const updateOption = (walletKey, isAvailable) => {
        const option = document.querySelector(`.wallet-option[data-wallet="${walletKey}"]`);
        if (option) {
            if (isAvailable) {
                option.classList.remove('unavailable');
                option.classList.add('available');
                walletsFound++;
            } else {
                option.classList.add('unavailable');
                option.classList.remove('available');
            }
            option.style.display = 'flex'; // Always show, style indicates availability
        }
    };
    
    // Check for Unisat
    await new Promise(r => setTimeout(r, 50)); // Short delay for provider injection
    updateOption('unisat', typeof window.unisat?.requestAccounts === 'function');
    
    // Check for Xverse (via BitcoinProvider or SatsConnect)
    await new Promise(r => setTimeout(r, 50));
    const xverseAvailable = typeof window.BitcoinProvider === 'object' || typeof window.satsConnect === 'object' || typeof window.satsconnect === 'object';
    updateOption('xverse', xverseAvailable);

    // Check for OKX
    await new Promise(r => setTimeout(r, 50));
    updateOption('okx', typeof window.okxwallet?.bitcoin?.connect === 'function');

    // Check for Leather (via Leather object or SatsConnect)
    await new Promise(r => setTimeout(r, 50));
    const leatherAvailable = typeof window.Leather === 'object' || typeof window.StacksProvider === 'object' || typeof window.satsConnect === 'object' || typeof window.satsconnect === 'object';
    updateOption('leather', leatherAvailable);

    console.log(`Wallets found: ${walletsFound}`);
    walletSelectInstruction.style.display = 'block';
    walletAvailabilityMessage.style.display = walletsFound === 0 ? 'block' : 'none';
}


async function connectToWallet(walletType) {
    const walletStatus = document.getElementById('walletStatus');
    const connectWalletButton = document.getElementById('connectWallet');
    walletStatus.textContent = `Connecting to ${walletType}...`;
    console.log(`Attempting connection to ${walletType}...`);

    try {
        let accounts = [];
        let providerName = walletType.charAt(0).toUpperCase() + walletType.slice(1); // e.g. "Unisat"

        currentNetwork = { network: 'unknown' }; // Reset before connection

        if (walletType === 'unisat' && typeof window.unisat !== 'undefined') {
            accounts = await window.unisat.requestAccounts();
            currentNetwork = await window.unisat.getNetwork();
            currentWallet = window.unisat;
            currentWallet._brand = { name: "Unisat" };
        } else if (walletType === 'okx' && typeof window.okxwallet?.bitcoin !== 'undefined') {
            const result = await window.okxwallet.bitcoin.connect(); // Returns { address, publicKey }
            accounts = result.address ? [result.address] : []; // OKX might also return account list
            userPublicKey = result.publicKey;
            currentNetwork = await window.okxwallet.bitcoin.getNetwork();
            if (!currentNetwork || !currentNetwork.network) currentNetwork = {network: CONTRACT_CONFIG.network}; // OKX specific
            currentWallet = window.okxwallet.bitcoin;
            currentWallet._brand = { name: "OKX" };
        } else if ((walletType === 'xverse' || walletType === 'leather') && (typeof window.satsConnect === 'object' || typeof window.satsconnect === 'object')) {
            const sc = window.satsConnect || window.satsconnect;
            providerName = walletType === 'xverse' ? "Xverse (SatsConnect)" : "Leather (SatsConnect)";

            const response = await sc.request('wallet_connect', {
                network: CONTRACT_CONFIG.network, // Request signet directly
                addresses: [
                    { purpose: 'payment', networkType: CONTRACT_CONFIG.network }, // Specify network type
                    { purpose: 'ordinals', networkType: CONTRACT_CONFIG.network }
                ]
            });

            if (response.status === 'success' && response.result.addresses.length > 0) {
                accounts = response.result.addresses.map(a => a.address); // Extract addresses
                userPublicKey = response.result.addresses[0].publicKey; // Assuming first is primary
                // Network from SatsConnect connect response should be reliable
                const paymentAddrInfo = response.result.addresses.find(a => a.purpose === 'payment');
                currentNetwork = { network: paymentAddrInfo?.networkType || CONTRACT_CONFIG.network };
                
                currentWallet = {
                    _brand: { name: providerName },
                    requestAccounts: async () => accounts,
                    getNetwork: async () => currentNetwork,
                    signPsbt: async (psbtHex, options) => {
                        const signResp = await sc.request('wallet_signPsbt', { psbtHex, network: currentNetwork.network, ...options });
                        if (signResp.status === 'success') return signResp.result.psbtHex;
                        throw new Error(signResp.error?.message || 'SatsConnect PSBT signing failed.');
                    },
                    pushTx: async (txHex) => {
                        const pushResp = await sc.request('wallet_pushTx', { txHex, network: currentNetwork.network });
                        if (pushResp.status === 'success') return pushResp.result.txId;
                        throw new Error(pushResp.error?.message || 'SatsConnect transaction push failed.');
                    }
                };
            } else {
                throw new Error(response.error?.message || `${providerName} connection failed.`);
            }
        } else {
            throw new Error(`${providerName} provider not found or not supported.`);
        }

        if (!accounts || accounts.length === 0) throw new Error("No accounts found or permission denied.");
        userAddress = accounts[0]; // Assuming first account

        walletConnected = true;
        walletStatus.textContent = `Connected (${currentWallet._brand?.name || providerName}): ${currentNetwork.network.toUpperCase()}`;
        connectWalletButton.style.display = 'none';
        
        console.log(`${currentWallet._brand?.name || providerName} connected. Address: ${userAddress}, Network: ${currentNetwork.network}`);

        if (currentNetwork.network !== CONTRACT_CONFIG.network) {
            const switched = await promptNetworkSwitch(currentWallet._brand?.name || providerName);
            if (switched && currentWallet && currentWallet.getNetwork) { // Re-check network if possible
                currentNetwork = await currentWallet.getNetwork();
                 if (!currentNetwork || !currentNetwork.network) currentNetwork = {network: CONTRACT_CONFIG.network};
                walletStatus.textContent = `Connected (${currentWallet._brand?.name || providerName}): ${currentNetwork.network.toUpperCase()}`;
            }
            if (currentNetwork.network !== CONTRACT_CONFIG.network) {
                 // If still not on correct network, update UI and disable actions
                updateEncryptButtonState(); // This will set button to "Wrong Network"
                console.warn("Still on wrong network after switch prompt.");
                 // Do not throw error here, let user see "Wrong Network" state
            }
        }
        
        updateEncryptButtonState();
        startNetworkStatusMonitoring();

    } catch (error) {
        console.error(`Error connecting to ${walletType}:`, error);
        walletStatus.textContent = `Connection Failed: ${error.message || 'Unknown error'}`;
        walletConnected = false;
        userAddress = null;
        userPublicKey = null;
        currentWallet = null;
        currentNetwork = { network: 'unknown' };
        connectWalletButton.style.display = 'inline-block';
        updateEncryptButtonState();
        // showModal("Connection Error", `<p>Failed to connect to ${walletType}.</p><p>Details: ${error.message || 'Ensure wallet is unlocked and try again.'}</p>`);
        throw error; // Re-throw for the calling context if needed
    }
}

async function promptNetworkSwitch(walletTypeName) {
    console.log(`Prompting network switch for ${walletTypeName}. Required: ${CONTRACT_CONFIG.network}`);
    
    // Some wallets like Unisat might have a direct switch method
    if (currentWallet && currentWallet.switchNetwork && typeof currentWallet.switchNetwork === 'function') {
        try {
            await currentWallet.switchNetwork(CONTRACT_CONFIG.network);
            // Verify network after switch
            currentNetwork = await currentWallet.getNetwork();
            if (!currentNetwork || !currentNetwork.network) currentNetwork = {network: CONTRACT_CONFIG.network};
            
            if (currentNetwork.network === CONTRACT_CONFIG.network) {
                console.log("Network switched successfully via wallet API.");
                document.getElementById('walletStatus').textContent = `Connected (${walletTypeName}): ${currentNetwork.network.toUpperCase()}`;
                updateEncryptButtonState();
                return true;
            }
        } catch (switchError) {
            console.warn(`Failed to switch network via ${walletTypeName} API:`, switchError.message);
            // Fall through to manual prompt if API switch fails
        }
    }

    // Manual switch prompt
    return new Promise((resolve) => {
        const modalTitle = "Switch Network Required";
        const modalBody = `
            <p>Your ${walletTypeName} is on the wrong network (current: ${currentNetwork.network ? currentNetwork.network.toUpperCase() : 'Unknown'}).</p>
            <p>Please switch to <strong>Bitcoin ${CONTRACT_CONFIG.network.toUpperCase()}</strong>.</p>
            <p>Instructions:</p>
            <ul>
                <li><strong>Unisat:</strong> Network icon (top-right) → "Bitcoin Testnet, Signet".</li>
                <li><strong>Xverse:</strong> Settings → Network → "Bitcoin Testnet (Signet)".</li>
                <li><strong>OKX:</strong> Settings/Wallet → Network → "Bitcoin Testnet".</li>
                <li><strong>Leather:</strong> Network selector → "Signet".</li>
            </ul>
            <p>Click "OK" after switching in your wallet. If you don't switch, functionality will be limited.</p>`;
        
        showModal(modalTitle, modalBody, false); // Use regular modal

        const modalOkButton = document.querySelector('#modalOverlay .modal-footer .btn-primary');
        if (modalOkButton) {
            const oldOkHandler = modalOkButton._okHandlerForSwitch;
            if (oldOkHandler) modalOkButton.removeEventListener('click', oldOkHandler);

            const newOkHandler = async () => {
                hideModal();
                // Re-check network
                if (currentWallet && currentWallet.getNetwork) {
                    try {
                        currentNetwork = await currentWallet.getNetwork();
                        if (!currentNetwork || !currentNetwork.network) currentNetwork = {network: CONTRACT_CONFIG.network};
                    } catch (e) { console.warn("Error re-checking network:", e); }
                }
                document.getElementById('walletStatus').textContent = `Connected (${walletTypeName}): ${currentNetwork.network.toUpperCase()}`;
                updateEncryptButtonState(); // Reflect new network state
                resolve(currentNetwork.network === CONTRACT_CONFIG.network);
            };
            modalOkButton.addEventListener('click', newOkHandler);
            modalOkButton._okHandlerForSwitch = newOkHandler;
        }
    });
}


function startNetworkStatusMonitoring() {
    console.log("Starting network status monitoring.");
    if (networkStatusInterval) clearInterval(networkStatusInterval);

    networkStatusInterval = setInterval(async () => {
        if (!walletConnected || !currentWallet) {
            // If was connected but provider lost, attempt to re-establish or disconnect
            console.warn("Wallet disconnected or provider lost during monitoring interval.");
            clearInterval(networkStatusInterval);
            networkStatusInterval = null;
            // Attempt a soft re-check before full disconnect
            await checkInitialConnection(); 
            if (!walletConnected) { // If still not connected
                document.getElementById('walletStatus').textContent = 'Wallet Status: Disconnected';
                document.getElementById('connectWallet').style.display = 'inline-block';
                updateEncryptButtonState();
            }
            return;
        }

        try {
            let newNetworkInfo = { network: CONTRACT_CONFIG.network }; // Default to avoid issues
            if (currentWallet.getNetwork) {
                 newNetworkInfo = await currentWallet.getNetwork();
                 if (!newNetworkInfo || !newNetworkInfo.network) newNetworkInfo = {network: CONTRACT_CONFIG.network};
            } else {
                console.warn("currentWallet.getNetwork is not a function. Cannot monitor network changes effectively.");
                // For SatsConnect, network info might be less dynamic or require re-requesting accounts.
                // Keep currentNetwork as is if getNetwork is not available.
                newNetworkInfo = currentNetwork; // Maintain last known
            }

            if (newNetworkInfo.network !== currentNetwork.network) {
                console.log(`Network change detected by monitor: ${currentNetwork.network} -> ${newNetworkInfo.network}`);
                currentNetwork = newNetworkInfo;
                const walletTypeName = currentWallet._brand?.name || "Wallet";
                document.getElementById('walletStatus').textContent = `Connected (${walletTypeName}): ${currentNetwork.network.toUpperCase()}`;
                updateEncryptButtonState(); // This will show "Wrong Network" if applicable
                if (currentNetwork.network !== CONTRACT_CONFIG.network) {
                    // Optionally, inform user, but avoid repeated popups from monitoring.
                    // A small, non-intrusive notification might be better here.
                    console.warn(`Wallet is on ${currentNetwork.network.toUpperCase()}, but ${CONTRACT_CONFIG.network.toUpperCase()} is required.`);
                }
            }
            // Also, good to check if accounts changed or connection dropped
            if (currentWallet.requestAccounts || currentWallet.getAccounts) { // Unisat uses getAccounts
                const getAccountsMethod = currentWallet.getAccounts || currentWallet.requestAccounts;
                try {
                    const accounts = await getAccountsMethod.call(currentWallet);
                    if (!accounts || accounts.length === 0 || accounts[0] !== userAddress) {
                        console.log("Account change or disconnection detected by monitor.");
                        // Trigger full re-connection or disconnect logic
                        document.getElementById('walletStatus').textContent = 'Wallet Status: Account Changed/Disconnected';
                        document.getElementById('connectWallet').style.display = 'inline-block';
                        walletConnected = false; // Force re-connection
                        updateEncryptButtonState();
                        clearInterval(networkStatusInterval);
                        return;
                    }
                } catch (e) {
                    console.warn("Error checking accounts during monitoring:", e.message);
                    // Could indicate wallet locked or disconnected
                    document.getElementById('walletStatus').textContent = 'Wallet Status: Check Connection';
                    walletConnected = false;
                    updateEncryptButtonState();
                    clearInterval(networkStatusInterval);
                }
            }


        } catch (error) {
            console.error("Error during network status monitoring:", error);
            // Potentially handle disconnect if error indicates loss of connection
            document.getElementById('walletStatus').textContent = 'Wallet Status: Monitoring Error';
            // Consider stopping monitoring if errors persist
        }
    }, 7000); // Check every 7 seconds
}


// Carousel Auto-slide and Navigation
function initCarousel() {
    const carouselSlidesContainer = document.getElementById('twitterCarousel');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const indicatorsContainer = document.getElementById('carouselIndicators');

    if (!carouselSlidesContainer || !prevBtn || !nextBtn || !indicatorsContainer) {
        console.warn("Carousel elements not found, skipping initialization.");
        return;
    }
    
    const slides = carouselSlidesContainer.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;
    if (totalSlides === 0) {
        console.warn("No carousel slides found.");
        return;
    }

    let currentSlide = 0;

    // Clear existing indicators and create new ones
    indicatorsContainer.innerHTML = ''; 
    for (let i = 0; i < totalSlides; i++) {
        const indicator = document.createElement('div');
        indicator.classList.add('carousel-indicator');
        indicator.setAttribute('data-slide', i);
        indicatorsContainer.appendChild(indicator);
    }
    const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');

    function goToSlide(slideIndex) {
        currentSlide = (slideIndex + totalSlides) % totalSlides; // Wrap around
        
        slides.forEach((slide, index) => {
            slide.style.display = (index === currentSlide) ? 'flex' : 'none';
        });

        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentSlide);
        });
    }

    function autoSlide() {
        goToSlide(currentSlide + 1);
    }

    if (totalSlides > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        indicatorsContainer.style.display = 'flex';

        prevBtn.onclick = () => { goToSlide(currentSlide - 1); resetAutoSlide(); };
        nextBtn.onclick = () => { goToSlide(currentSlide + 1); resetAutoSlide(); };

        indicators.forEach((indicator, index) => {
            indicator.onclick = () => { goToSlide(index); resetAutoSlide(); };
        });
        
        if (carouselAutoSlideInterval) clearInterval(carouselAutoSlideInterval);
        carouselAutoSlideInterval = setInterval(autoSlide, 7000); // Auto-slide every 7 seconds
    } else {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        indicatorsContainer.style.display = 'none';
    }
    
    function resetAutoSlide() {
        if (totalSlides > 1) {
            clearInterval(carouselAutoSlideInterval);
            carouselAutoSlideInterval = setInterval(autoSlide, 7000);
        }
    }

    goToSlide(0); // Initialize to the first slide

    document.querySelectorAll('.copy-tweet-btn').forEach(button => {
        const oldHandler = button._copyHandler;
        if (oldHandler) button.removeEventListener('click', oldHandler);
        
        const newHandler = () => {
            const tweetText = button.getAttribute('data-tweet');
            const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
            window.open(twitterIntentUrl, '_blank');
        };
        button.addEventListener('click', newHandler);
        button._copyHandler = newHandler;
    });
    console.log("Carousel initialized.");
}


// Message Input Character and Byte Counter
function initMessageInput() {
    const messageInput = document.getElementById('message');
    const charCountEl = document.getElementById('charCount');
    const byteCountEl = document.getElementById('byteCount');
    const encryptionResultDiv = document.getElementById('encryptionResult');
    const encryptButton = document.getElementById('encryptMessageBtn'); // Added for direct reference

    if (!messageInput || !charCountEl || !byteCountEl || !encryptionResultDiv || !encryptButton) {
        console.error("Message input or related UI elements not found.");
        return;
    }

    encryptionResultDiv.style.display = 'none'; // Initially hide

    messageInput.addEventListener('input', () => {
        const text = messageInput.value;
        const characters = text.length;
        const bytes = new TextEncoder().encode(text).length;

        charCountEl.textContent = characters;
        byteCountEl.textContent = bytes;

        charCountEl.style.color = characters > 150 ? 'var(--color-error)' : 'var(--color-text-secondary)';
        byteCountEl.style.color = bytes > 80 ? 'var(--color-error)' : 'var(--color-text-secondary)';
        
        updateEncryptButtonState(); // Update button based on input and wallet state

        encryptionResultDiv.style.display = 'none'; // Hide result if message is edited
        document.getElementById('signTransaction').style.display = 'none';
    });

    const oldEncryptHandler = encryptButton._encryptHandler;
    if(oldEncryptHandler) encryptButton.removeEventListener('click', oldEncryptHandler);
    
    const newEncryptHandler = encryptMessage; // Defined later
    encryptButton.addEventListener('click', newEncryptHandler);
    encryptButton._encryptHandler = newEncryptHandler;
    
    updateEncryptButtonState(); // Initial state check
    console.log("Message input initialized.");
}

function updateEncryptButtonState() {
    const encryptButton = document.getElementById('encryptMessageBtn');
    const messageInput = document.getElementById('message');
    
    if (!encryptButton || !messageInput) return; // Should not happen if init was successful

    const text = messageInput.value; // Use raw value for char/byte count consistency
    const trimmedText = text.trim();
    const characters = text.length; // Count all characters as typed
    const bytes = new TextEncoder().encode(text).length;

    if (!walletConnected) {
        encryptButton.disabled = true;
        encryptButton.textContent = "Connect Wallet First";
        return;
    }
    if (currentNetwork.network !== CONTRACT_CONFIG.network) {
        encryptButton.disabled = true;
        encryptButton.textContent = "Wrong Network";
        return;
    }
    if (trimmedText === '') {
        encryptButton.disabled = true;
        encryptButton.textContent = "Enter Message";
    } else if (characters > 150) {
        encryptButton.disabled = true;
        encryptButton.textContent = "Message Too Long (Chars)";
    } else if (bytes > 80) {
        encryptButton.disabled = true;
        encryptButton.textContent = "Message Too Long (Bytes)";
    } else {
        encryptButton.disabled = false;
        encryptButton.textContent = "Encode & Generate Transaction";
    }
}


// Modal Handlers (showModal/hideModal cover most of this now)
function initModalHandlers() {
    // Basic modal close/ok functionality is now part of showModal.
    // Specific modal button handlers (like for wallet selection or terms) are in their respective init functions.
    console.log("Modal core handlers initialized via showModal/hideModal.");
}

// Block Height and Countdown Logic
function initBlockHeightAndCountdown() {
    const currentBlockHeightElement = document.getElementById('currentBlockHeight');
    const unlockBlockHeightElement = document.getElementById('unlockBlockHeight');
    const progressBar = document.getElementById('progressBar');
    const blockStatusDiv = document.getElementById('blockStatus'); // Renamed for clarity

    if (!currentBlockHeightElement || !unlockBlockHeightElement || !progressBar || !blockStatusDiv) {
        console.error("Block height or countdown UI elements not found.");
        return;
    }

    const unlockBlock = parseInt(unlockBlockHeightElement.textContent, 10);
    let currentSimulatedBlock = 0; 

    async function fetchCurrentBlockHeight() {
        try {
            // For demo: Simulate block height increase.
            // In a real app, fetch from an API: const response = await fetch('https://mempool.space/signet/api/blocks/tip/height');
            // const height = await response.text(); currentSimulatedBlock = parseInt(height);
            if (currentBlockHeightElement.textContent === 'Loading...' || isNaN(parseInt(currentBlockHeightElement.textContent))) {
                currentSimulatedBlock = Math.floor(unlockBlock * 0.85); // Start closer for demo
            } else {
                currentSimulatedBlock = parseInt(currentBlockHeightElement.textContent, 10);
                if (currentSimulatedBlock < unlockBlock) {
                     currentSimulatedBlock += Math.floor(Math.random() * 2) + 1; // Simulate 1-2 new blocks
                     currentSimulatedBlock = Math.min(currentSimulatedBlock, unlockBlock);
                }
            }
            currentBlockHeightElement.textContent = currentSimulatedBlock;
            updateBlockStatusUI(currentSimulatedBlock, unlockBlock);
        } catch (error) {
            console.error("Failed to fetch/simulate current block height:", error);
            currentBlockHeightElement.textContent = 'Error';
            blockStatusDiv.innerHTML = '<p class="status-text error-text">Failed to load block status.</p>';
            blockStatusDiv.className = 'status-indicator error';
            if (countdownInterval) clearInterval(countdownInterval);
        }
    }

    function updateBlockStatusUI(currentBlock, targetUnlockBlock) {
        const blocksRemaining = Math.max(0, targetUnlockBlock - currentBlock);
        
        const progressPercentage = Math.min(100, (currentBlock / targetUnlockBlock) * 100);
        progressBar.style.width = `${progressPercentage}%`;
        
        const blocksRemainingEl = document.getElementById('blocksRemaining');
        if (blocksRemainingEl) blocksRemainingEl.textContent = blocksRemaining;

        if (blocksRemaining <= 0) {
            blockStatusDiv.className = 'status-indicator unlocked';
            blockStatusDiv.querySelector('.status-text').textContent = '🎉 Time Capsule messages are now unlockable!';
            // Hide countdown grid elements if they exist
            const countdownGrid = blockStatusDiv.querySelector('.countdown-grid');
            if (countdownGrid) countdownGrid.style.display = 'none';
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = null;
        } else {
            blockStatusDiv.className = 'status-indicator pending';
            blockStatusDiv.querySelector('.status-text').innerHTML = `Time Capsule messages will be unlockable in approximately <span id="blocksRemaining">${blocksRemaining}</span> blocks`;
            const countdownGrid = blockStatusDiv.querySelector('.countdown-grid');
            if (countdownGrid) countdownGrid.style.display = 'grid'; // Ensure visible

            // Average block time: 10 minutes = 600 seconds
            const estimatedTotalSecondsRemaining = blocksRemaining * 600;
            const now = new Date().getTime();
            const estimatedUnlockTimestamp = now + (estimatedTotalSecondsRemaining * 1000);

            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                const currentTime = new Date().getTime();
                let diff = estimatedUnlockTimestamp - currentTime;

                if (diff <= 0) {
                    diff = 0; // Prevent negative countdown
                    // When countdown hits zero, re-fetch block height to confirm.
                    fetchCurrentBlockHeight(); 
                    // clearInterval(countdownInterval); // fetch will handle clearing if unlocked
                }

                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);

                document.getElementById('countdownDays').textContent = d;
                document.getElementById('countdownHours').textContent = h.toString().padStart(2, '0');
                document.getElementById('countdownMinutes').textContent = m.toString().padStart(2, '0');
                document.getElementById('countdownSeconds').textContent = s.toString().padStart(2, '0');
            }, 1000);
        }
    }

    fetchCurrentBlockHeight(); // Initial call
    setInterval(fetchCurrentBlockHeight, 30000); // Poll for new block height every 30 seconds
    console.log("Block height and countdown initialized.");
}

// Tab functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (!tabButtons.length || !tabContents.length) {
        console.warn("Tab UI elements not found.");
        return;
    }

    tabButtons.forEach(button => {
        const oldHandler = button._tabHandler;
        if (oldHandler) button.removeEventListener('click', oldHandler);

        const newHandler = () => {
            const targetTabId = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            const targetContent = document.getElementById(targetTabId);
            if (targetContent) targetContent.classList.add('active');
        };
        button.addEventListener('click', newHandler);
        button._tabHandler = newHandler;
    });

    if (tabButtons.length > 0) tabButtons[0].click(); // Activate first tab
    console.log("Tabs initialized.");
}

// Donation address copy
function initDonationAddressCopy() {
    const donationAddressDiv = document.getElementById('donationAddress');
    if (!donationAddressDiv) {
        console.error("Donation address UI element not found.");
        return;
    }
    
    const addressTextEl = document.getElementById('donationAddressText');
    const confirmationEl = donationAddressDiv.querySelector('.copy-confirmation');

    if (!addressTextEl || !confirmationEl) {
        console.error("Donation address sub-elements (text or confirmation) not found.");
        return;
    }

    const oldHandler = donationAddressDiv._copyHandler;
    if(oldHandler) donationAddressDiv.removeEventListener('click', oldHandler);

    const newHandler = async () => {
        try {
            await navigator.clipboard.writeText(addressTextEl.textContent);
            confirmationEl.classList.add('show');
            // The animation itself will hide it after 2s
            setTimeout(() => confirmationEl.classList.remove('show'), 2000); // Ensure it's removed
        } catch (err) {
            console.error('Failed to copy donation address:', err);
            showModal("Copy Error", "<p>Could not copy address. Please try manually.</p>");
        }
    };
    donationAddressDiv.addEventListener('click', newHandler);
    donationAddressDiv._copyHandler = newHandler;
    console.log("Donation address copy initialized.");
}

// Encode Message and Generate Transaction (Placeholder for PSBT)
async function encryptMessage() { // "Encrypt" is Base64 encoding as per spec
    console.log("Encode message button clicked.");
    if (!walletConnected || !currentWallet) {
        showModal("Wallet Error", "<p>Please connect your wallet and ensure it's on the correct network.</p>");
        // Attempt to recover wallet state
        await checkInitialConnection();
        if (!walletConnected) return;
    }
    updateEncryptButtonState(); // Re-check conditions
    if (document.getElementById('encryptMessageBtn').disabled) { // If still disabled after update
        console.warn("Encode attempt aborted due to validation failure (e.g. message too long, wrong network).");
        return;
    }

    const messageInput = document.getElementById('message');
    const encodedMessageOutput = document.getElementById('encodedMessageOutput');
    const outputDiv = document.getElementById('output');
    const signTransactionButton = document.getElementById('signTransaction');
    const encryptionResultDiv = document.getElementById('encryptionResult');

    const message = messageInput.value; // Do not trim here if original spaces are intended for encoding
    if (message.trim() === '') { // But check for effectively empty message
        showModal("Error", "<p>Please enter a message to encode.</p>");
        return;
    }

    const encodedMessage = btoa(unescape(encodeURIComponent(message))); // Correct Base64 for UTF-8
    encodedMessageOutput.textContent = encodedMessage;

    // Placeholder for PSBT generation. In a real app, this would be complex.
    const dummyPsbtHex = "70736274ff0100...[dummy_psbt_data]..."; // Replace with real PSBT generation logic
    // The actual PSBT would include outputs for the message inscription (OP_RETURN or Ordinals envelope)
    // and an output to CONTRACT_CONFIG.feeRecipient for CONTRACT_CONFIG.feeAmount.
    // It would also need inputs (UTXOs) from the user's wallet.

    outputDiv.innerHTML = `
        <p class="alert alert-warning"><strong>Developer Note:</strong> The transaction details below are simplified for this demo. Real PSBT construction for inscriptions is complex and involves UTXO management, fee calculations, and specific output scripting for the message and contract fee.</p>
        <div class="transaction-detail"><span class="detail-label">Action:</span><span class="detail-value">Store Message (Inscription)</span></div>
        <div class="transaction-detail"><span class="detail-label">Fee Recipient:</span><span class="detail-value">${CONTRACT_CONFIG.feeRecipient}</span></div>
        <div class="transaction-detail"><span class="detail-label">Storage Fee:</span><span class="detail-value">${CONTRACT_CONFIG.feeAmount} Signet BTC</span></div>
        <div class="transaction-detail"><span class="detail-label">Unlock Block:</span><span class="detail-value">${CONTRACT_CONFIG.unlockBlockHeight}</span></div>
        <div class="transaction-detail"><span class="detail-label">Message (Base64):</span><span class="detail-value code-block small">${encodedMessage}</span></div>
        <div class="transaction-detail"><span class="detail-label">Dummy PSBT Hex:</span><span class="detail-value code-block small">${dummyPsbtHex}</span></div>
    `;

    encryptionResultDiv.style.display = 'block';
    signTransactionButton.style.display = 'block';
    
    const oldSignHandler = signTransactionButton._signHandler;
    if(oldSignHandler) signTransactionButton.removeEventListener('click', oldSignHandler);

    const newSignHandler = () => signAndSubmitTransaction(dummyPsbtHex, encodedMessage); // Pass dummy PSBT
    signTransactionButton.addEventListener('click', newSignHandler);
    signTransactionButton._signHandler = newSignHandler;
    
    console.log("Message encoded, placeholder transaction details generated.");
}

// Sign and Submit Transaction
async function signAndSubmitTransaction(psbtHex, originalMessageBase64) { // originalMessageBase64 for context if needed
    console.log("Sign and Submit button clicked.");
    if (!walletConnected || !currentWallet) {
        showModal("Wallet Error", "<p>Wallet not connected. Please connect your wallet.</p>");
        // Attempt to recover wallet state
        await checkInitialConnection();
        if (!walletConnected) return;
    }
    
    if (!currentWallet.signPsbt || !currentWallet.pushTx) {
        const walletName = currentWallet._brand?.name || "Connected wallet";
        showModal("Unsupported Wallet", `<p>${walletName} does not support the required PSBT signing or broadcasting functions needed by this demo.</p>`);
        return;
    }

    showModal("Signing Transaction", "<p>Please approve the transaction in your wallet...</p>");

    try {
        // For many wallets, you might need to specify options, e.g., if the PSBT is already finalized for inputs
        const signOptions = { 
            autoFinalized: true, // Common for wallets like Unisat if PSBT inputs are signed
            // For SatsConnect, it might be part of the PSBT structure itself or other options.
        };
        
        // This psbtHex is a DUMMY one. Real application needs actual PSBT.
        console.log("Attempting to sign PSBT (dummy):", psbtHex);
        const signedPsbtHex = await currentWallet.signPsbt(psbtHex, signOptions);
        console.log("Transaction signed (dummy PSBT), result:", signedPsbtHex);
        
        // At this point, signedPsbtHex would be the wallet-signed PSBT.
        // For this demo, we'll assume it's "signed" and proceed to "broadcast".
        
        hideModal(); // Hide signing modal
        showModal("Broadcasting Transaction", "<p>Broadcasting transaction (simulated for dummy PSBT)...</p>");

        // In a real scenario, pushTx would broadcast the signedPsbtHex.
        // Since our PSBT is a dummy, the broadcast will likely fail if attempted on a real node/API.
        // For the demo, we simulate a successful broadcast.
        // const txId = await currentWallet.pushTx(signedPsbtHex); // This would be the real call
        
        // Simulate TxID for demo purposes
        const simulatedTxId = "dummy_txid_" + Math.random().toString(36).substring(2, 15);
        console.log(`Simulated broadcast. Tx ID: ${simulatedTxId}`);
        
        hideModal();
        showModal("Transaction Submitted (Simulated)", 
            `<p>Your message has been submitted to the Bitcoin Signet network (simulation complete)!</p>
             <p>Transaction ID (Simulated): <a href="https://mempool.space/signet/tx/${simulatedTxId}" target="_blank">${simulatedTxId}</a></p>
             <p><strong>Note:</strong> This is based on a dummy PSBT. In a real application, this would be a live transaction.</p>`);
        
        // Reset message input and hide encryption section
        document.getElementById('message').value = '';
        document.getElementById('charCount').textContent = '0';
        document.getElementById('byteCount').textContent = '0';
        document.getElementById('encryptionResult').style.display = 'none';
        document.getElementById('signTransaction').style.display = 'none';
        updateEncryptButtonState();

    } catch (error) {
        console.error("Transaction signing or broadcasting failed:", error);
        hideModal();
        showModal("Transaction Failed", `<p>Could not sign or submit the transaction.</p><p>Details: ${error.message || 'Unknown error'}</p><p>This might be due to the dummy PSBT used in this demo or a wallet issue.</p>`);
    }
}


// Retrieve Stored Messages (Placeholder)
function loadStoredMessages() {
    const listEl = document.getElementById('storedMessagesList');
    // Placeholder: fetch from local storage or a backend
    listEl.innerHTML = '<p>No stored messages found (demo). This feature would list your past time capsules.</p>';
    console.log("Stored messages placeholder loaded.");
}

function retrieveMessage(txId, encodedMessage) { // Called from "Stored Messages" tab
    console.log(`Retrieving message for TxID: ${txId}`);
    try {
        const decodedMessage = decodeURIComponent(escape(atob(encodedMessage))); // Correct Base64 decode for UTF-8
        showModal("Retrieved Message", `<p><strong>Original Message:</strong></p><p>${decodedMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`);
    } catch (e) {
        console.error("Failed to decode message:", e);
        showModal("Decoding Error", "<p>Could not decode the message. It might be corrupted or not valid Base64.</p>");
    }
}

// Retrieve Message by ID (Placeholder)
function checkMessage() {
    const txIdInput = document.getElementById('txIdInput');
    const statusDiv = document.getElementById('messageStatus');
    const txId = txIdInput.value.trim();

    if (!txId) {
        statusDiv.innerHTML = '<p class="alert alert-warning">Please enter a Transaction ID.</p>';
        return;
    }
    statusDiv.innerHTML = `<p>Checking status for TX ID: ${txId} (demo)...</p>`;
    // Placeholder: query an API
    setTimeout(() => {
        const isUnlocked = Math.random() > 0.5;
        const dummyEncoded = 'SGVsbG8gZnJvbSB0aGUgZnV0dXJlIQ=='; // "Hello from the future!"
        statusDiv.innerHTML = `
            <div class="message-item alert ${isUnlocked ? 'alert-success' : 'alert-info'}">
                <p><strong>TX ID:</strong> ${txId}</p>
                <p><strong>Status:</strong> ${isUnlocked ? 'Unlocked (Demo)' : 'Pending (Demo)'}</p>
                ${isUnlocked ? `<p><strong>Encoded Message (Demo):</strong> <span class="code-block small">${dummyEncoded}</span></p>
                                <button class="btn btn-primary btn-sm mt-sm" onclick="decodeAndDisplayMessage('${dummyEncoded}')">Decode & View</button>`
                             : ''}
            </div>`;
    }, 1000);
    console.log(`Message check placeholder for TxID: ${txId}`);
}

function decodeAndDisplayMessage(encodedMessage) { // Called from "Lookup by ID" tab
    console.log(`Decoding message from lookup.`);
    try {
        const decodedMessage = decodeURIComponent(escape(atob(encodedMessage)));
        showModal("Retrieved Message", `<p><strong>Original Message:</strong></p><p>${decodedMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`);
    } catch (e) {
        console.error("Failed to decode message from lookup:", e);
        showModal("Decoding Error", "<p>Could not decode the message from lookup.</p>");
    }
}

// Visitor Counter (Placeholder)
function updateVisitorCounter() {
    const countElement = document.getElementById('visitorCount');
    if (countElement) {
        let count = parseInt(localStorage.getItem('visitorCount_timecapsule') || '0');
        count++;
        countElement.textContent = count.toLocaleString();
        localStorage.setItem('visitorCount_timecapsule', count.toString());
    }
}


// Document ready and initializations
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded - Initializing application");

    // Initialize UI components that don't depend on async wallet ops first
    initModalHandlers();
    initCarousel();
    initMessageInput(); 
    initBlockHeightAndCountdown();
    initTabs();
    initDonationAddressCopy();
    updateVisitorCounter();

    // Initialize wallet connection logic (includes availability checks and initial connection attempt)
    // This is async and might update UI elements like wallet status and encrypt button
    try {
        await initWalletConnection(); 
    } catch (e) {
        console.error("Error during wallet initialization:", e);
        // UI should reflect "Not Connected" state if initWalletConnection fails internally
    }
    
    // Load other data (placeholders for now)
    loadStoredMessages();

    console.log("Application initialization sequence complete.");
});