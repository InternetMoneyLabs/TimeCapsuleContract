const CONTRACT_CONFIG = {
    feeRecipient: 'bc1qyetzzylgkyq6rcqx4uu9jyrhzs0ume44t9rfrw',
    feeAmount: 0.0001,
    unlockBlockHeight: 263527,
    network: 'signet',
    inscriptionPostage: 10000 
};

let walletConnected = false;
let currentWallet = null;
let userAddress = null;
let userPublicKey = null;
let currentNetwork = { network: 'unknown' };
let networkStatusInterval = null;
let countdownInterval = null;
let carouselAutoSlideInterval = null;

function showModal(title, bodyHtml, isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
    if (!modalOverlay) return;

    const modalTitle = modalOverlay.querySelector('.modal-title');
    const modalBody = modalOverlay.querySelector('.modal-body');
    const modalClose = modalOverlay.querySelector('.modal-close');
    const modalOk = modalOverlay.querySelector('.modal-footer .btn-primary');

    if (modalTitle) modalTitle.textContent = title;
    if (modalBody && !isWalletModal && bodyHtml !== undefined) modalBody.innerHTML = bodyHtml;

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
        modalClose.onclick = closeModal;
    }
    if (modalOk && !isWalletModal) {
        modalOk.onclick = closeModal;
    }
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModal();
    };

    setTimeout(() => {
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) {
            modalElement.style.opacity = '1';
            modalElement.style.transform = 'translateY(0)';
        }
    }, 10);
}

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
        }, 300);
    }
}

function shortenAddress(address, chars = 6) {
    if (!address) return '';
    return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

async function fetchSignetBalance(address) {
    if (!address) return 'N/A';
    try {
        const response = await fetch(`https://mempool.space/signet/api/address/${address}`);
        if (!response.ok) {
            console.warn(`Mempool API error for ${address}: ${response.status}`);
            return 'Error';
        }
        const data = await response.json();
        const balanceSat = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) + 
                           (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum);
        return `${(balanceSat / 100000000).toFixed(4)} Signet BTC`;
    } catch (error) {
        console.error(`Failed to fetch balance for ${address} from mempool.space:`, error);
        return 'N/A (API)';
    }
}


function updateWalletDisplay(walletName, address, network, balanceStr = 'Loading...') {
    const walletStatusEl = document.getElementById('walletStatus');
    const walletInfoEl = document.getElementById('walletInfo');
    const walletAddressEl = document.getElementById('walletAddress');
    const walletBalanceEl = document.getElementById('walletBalance');
    const connectWalletButton = document.getElementById('connectWallet');
    const disconnectWalletButton = document.getElementById('disconnectWallet');

    if (walletConnected) {
        walletStatusEl.style.display = 'none';
        walletInfoEl.style.display = 'flex';
        walletAddressEl.textContent = `${walletName}: ${shortenAddress(address)}`;
        walletBalanceEl.textContent = `Balance: ${balanceStr}`;
        connectWalletButton.style.display = 'none';
        disconnectWalletButton.style.display = 'inline-block';
    } else {
        walletStatusEl.style.display = 'block';
        walletStatusEl.textContent = 'Wallet Status: Not Connected';
        walletInfoEl.style.display = 'none';
        connectWalletButton.style.display = 'inline-block';
        disconnectWalletButton.style.display = 'none';
    }
}


async function initWalletConnection() {
    const connectWalletButton = document.getElementById('connectWallet');
    const disconnectWalletButton = document.getElementById('disconnectWallet');
    
    await checkWalletsAvailability(); 

    connectWalletButton.onclick = () => {
        showModal('Select Bitcoin Wallet', '', true);
        const modalElement = document.getElementById('walletSelectionModal');
        if (modalElement) {
            const walletOptions = modalElement.querySelectorAll('.wallet-option');
            walletOptions.forEach(button => {
                button.onclick = async () => {
                    const walletType = button.getAttribute('data-wallet');
                    if (button.classList.contains('unavailable')) {
                        hideModal(true);
                        showModal("Wallet Not Found", `<p>The ${walletType} wallet was not detected. Please install it and refresh.</p>`);
                        return;
                    }
                    hideModal(true);
                    try {
                        await connectToWallet(walletType);
                    } catch (error) {
                        console.error(`Failed to connect to ${walletType}:`, error);
                        updateWalletDisplay(null, null, null, null); 
                        walletConnected = false;
                        currentWallet = null;
                        showModal("Connection Error", `<p>Failed to connect to ${walletType}.</p><p>Details: ${error.message || 'Ensure wallet is installed, unlocked, and try again.'}</p>`);
                    }
                    updateEncryptButtonState();
                };
            });
        }
    };

    disconnectWalletButton.onclick = async () => {
        const providerName = currentWallet?._brand?.name || "Wallet";
        if (currentWallet && typeof currentWallet.disconnect === 'function') {
            try { await currentWallet.disconnect(); } catch (e) { console.warn(`Error on ${providerName}.disconnect(): ${e.message}`); }
        }
        handleDisconnect(providerName);
    };

    await checkInitialConnection();
    const tcppLinkInWalletModal = document.getElementById('tcppLink');
    if (tcppLinkInWalletModal) {
        tcppLinkInWalletModal.onclick = (e) => {
            e.preventDefault(); hideModal(true);
            showModal("Terms & Privacy Policy", `<div class="tcpp-content"><h3>Terms of Service</h3><p>Last Updated: May 10, 2025</p><h4>1. Acceptance</h4><p>Use of Bitcoin Time Capsule ("Service") means you accept these Terms.</p><h4>2. Experimental Use</h4><p>This is a Signet testnet demo. Use for testing only. No real value involved.</p><h4>3. Risks</h4><p>Service is experimental, use at your own risk. No warranties.</p><h3>Privacy Policy</h3><p>Last Updated: May 10, 2025</p><h4>1. Data</h4><p>Public blockchain data (addresses, TXIDs) may be logged. No private keys handled.</p><h4>2. Third Parties</h4><p>Wallet interactions are subject to provider T&Cs.</p></div>`);
        };
    }
}

const handleDisconnect = (providerName = "Wallet") => {
    walletConnected = false;
    userAddress = null;
    userPublicKey = null;
    currentWallet = null;
    currentNetwork = { network: 'unknown' };
    updateWalletDisplay();
    updateEncryptButtonState();
    if(networkStatusInterval) clearInterval(networkStatusInterval);
    networkStatusInterval = null;
};

const handleAccountsChanged = async (accounts, providerName = "Wallet") => {
    if (!accounts || accounts.length === 0) {
        handleDisconnect(providerName);
        return;
    }
    userAddress = accounts[0].address || accounts[0]; 
    
    let balanceStr = 'Loading...';
    if (currentWallet && currentWallet.getBalance) {
        try {
            const balanceData = await currentWallet.getBalance();
            balanceStr = formatBalance(balanceData, providerName);
        } catch (e) { balanceStr = 'N/A'; }
    } else if (userAddress && (providerName.includes("Xverse") || providerName.includes("Leather"))) {
        balanceStr = await fetchSignetBalance(userAddress);
    }

    if (currentWallet && currentWallet.getNetwork) {
        try {
            currentNetwork = await currentWallet.getNetwork();
            if (!currentNetwork || !currentNetwork.network || typeof currentNetwork.network !== 'string') { 
                currentNetwork = { network: CONTRACT_CONFIG.network }; 
            }
        } catch (e) { currentNetwork = { network: CONTRACT_CONFIG.network }; }
    }
    
    updateWalletDisplay(currentWallet?._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    walletConnected = true; 
    updateEncryptButtonState();
};

const handleNetworkChanged = async (networkInfo, providerName = "Wallet") => {
    if (typeof networkInfo === 'string') {
        currentNetwork = { network: networkInfo.toLowerCase() };
    } else if (networkInfo && typeof networkInfo.network === 'string') {
        currentNetwork = { network: networkInfo.network.toLowerCase() };
    } else if (currentWallet && currentWallet.getNetwork) { 
        try {
            currentNetwork = await currentWallet.getNetwork();
             if (!currentNetwork || !currentNetwork.network || typeof currentNetwork.network !== 'string') { 
                currentNetwork = { network: CONTRACT_CONFIG.network }; 
            }
        } catch (e) { currentNetwork = { network: CONTRACT_CONFIG.network };  }
    } else { currentNetwork = { network: CONTRACT_CONFIG.network }; }

    const balanceStr = document.getElementById('walletBalance')?.textContent.replace('Balance: ','') || 'Loading...';
    updateWalletDisplay(currentWallet?._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    
    if (currentNetwork.network !== CONTRACT_CONFIG.network) {
        await promptNetworkSwitch(currentWallet?._brand?.name || providerName);
    }
    updateEncryptButtonState();
};

function formatBalance(balanceData, walletName) {
    if (balanceData === null || balanceData === undefined) return 'N/A';
    let sats;
    if (typeof balanceData === 'number') { 
        sats = balanceData;
    } else if (typeof balanceData.total === 'number') { 
        sats = balanceData.total;
    } else if (walletName === "OKX" && typeof balanceData.satoshi === 'number') {
        sats = balanceData.satoshi;
    } else {
        return 'N/A (Format)';
    }
    return `${(sats / 100000000).toFixed(4)} Signet BTC`;
}
    
async function checkInitialConnection() {
    try {
        if (typeof window.unisat?.getAccounts === 'function') {
            const accounts = await window.unisat.getAccounts();
            if (accounts && accounts.length > 0) {
                userAddress = accounts[0];
                currentWallet = window.unisat; 
                currentWallet._brand = { name: "Unisat" };
                currentNetwork = await window.unisat.getNetwork();
                if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};
                const balanceData = await currentWallet.getBalance();
                handleInitialWalletConnection('Unisat', currentNetwork, formatBalance(balanceData, "Unisat"));
                return;
            }
        }

        if (typeof window.okxwallet?.bitcoin?.selectedAccount === 'object' && window.okxwallet.bitcoin.selectedAccount?.address) {
             const acc = window.okxwallet.bitcoin.selectedAccount;
             userAddress = acc.address;
             userPublicKey = acc.publicKey;
             currentWallet = window.okxwallet.bitcoin;
             currentWallet._brand = { name: "OKX" };
             currentNetwork = await window.okxwallet.bitcoin.getNetwork();
             if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};
             const balanceData = await currentWallet.getBalance();
             handleInitialWalletConnection('OKX', currentNetwork, formatBalance(balanceData, "OKX"));
             return;
        }
    } catch (error) { console.warn("Error during initial wallet connection check:", error); }
}

function handleInitialWalletConnection(walletType, networkInfo, balanceStr) {
    walletConnected = true;
    currentNetwork = networkInfo;
    if (!currentNetwork || typeof currentNetwork.network !== 'string') { 
        currentNetwork = { network: CONTRACT_CONFIG.network };
    }
    
    updateWalletDisplay(walletType, userAddress, currentNetwork.network, balanceStr);

    if (currentNetwork.network !== CONTRACT_CONFIG.network) {
        promptNetworkSwitch(walletType);
    }
    updateEncryptButtonState();
    startNetworkStatusMonitoring();
}

async function checkWalletsAvailability() {
    let walletsFound = 0;
    const updateOption = (key, avail) => {
        const opt = document.querySelector(`.wallet-option[data-wallet="${key}"]`);
        if(opt) { opt.classList.toggle('unavailable', !avail); if(avail) walletsFound++; opt.style.display = 'flex'; }
    };
    
    await new Promise(r => setTimeout(r, 50)); 
    updateOption('unisat', typeof window.unisat?.requestAccounts === 'function');
    
    await new Promise(r => setTimeout(r, 50));
    const scObj = window.satsConnect || window.satsconnect; // Handle casing
    updateOption('xverse', typeof window.BitcoinProvider === 'object' || typeof scObj?.request === 'function');

    await new Promise(r => setTimeout(r, 50));
    updateOption('okx', typeof window.okxwallet?.bitcoin?.connect === 'function');

    await new Promise(r => setTimeout(r, 50));
    updateOption('leather', typeof window.LeatherProvider === 'function' || typeof window.Leather === 'object' || typeof scObj?.request === 'function');
    
    document.getElementById('walletSelectInstruction').style.display = 'block';
    document.getElementById('walletAvailabilityMessage').style.display = walletsFound === 0 ? 'block' : 'none';
}


async function connectToWallet(walletType) {
    let accounts = [];
    let providerName = walletType.charAt(0).toUpperCase() + walletType.slice(1); 
    let balanceStr = 'Loading...';
    currentNetwork = { network: 'unknown' }; 

    if (walletType === 'unisat' && typeof window.unisat !== 'undefined') {
        accounts = await window.unisat.requestAccounts();
        currentNetwork = await window.unisat.getNetwork();
        currentWallet = window.unisat;
        currentWallet._brand = { name: "Unisat" };
        const balanceData = await currentWallet.getBalance();
        balanceStr = formatBalance(balanceData, "Unisat");
    } else if (walletType === 'okx' && typeof window.okxwallet?.bitcoin !== 'undefined') {
        const result = await window.okxwallet.bitcoin.connect(); 
        accounts = result.address ? [result.address] : (Array.isArray(result) ? result : []); 
        userPublicKey = result.publicKey;
        currentNetwork = await window.okxwallet.bitcoin.getNetwork();
        currentWallet = window.okxwallet.bitcoin;
        currentWallet._brand = { name: "OKX" };
        const balanceData = await currentWallet.getBalance();
        balanceStr = formatBalance(balanceData, "OKX");
    } else if ((walletType === 'xverse' || walletType === 'leather')) {
        const sc = window.satsConnect || window.satsconnect;
        if (!sc || typeof sc.request !== 'function') throw new Error(`${providerName} (SatsConnect) provider not found.`);
        
        providerName = walletType === 'xverse' ? "Xverse" : "Leather"; 

        const response = await sc.request('bitcoin_addresses', null); // New SatsConnect method

        if (response.status === 'success' && response.result.length > 0) {
            const paymentAccount = response.result.find(acc => acc.purpose === 'payment');
            const ordinalsAccount = response.result.find(acc => acc.purpose === 'ordinals');

            if (!paymentAccount) throw new Error (`${providerName} did not return a payment address.`);
            
            accounts = [paymentAccount.address]; 
            userPublicKey = paymentAccount.publicKey;
            currentNetwork = { network: paymentAccount.network || CONTRACT_CONFIG.network }; // Prefer network from address if available

            balanceStr = await fetchSignetBalance(paymentAccount.address);
            
            currentWallet = {
                _brand: { name: providerName },
                _satsConnect: sc,
                _paymentAddress: paymentAccount.address,
                _ordinalsAddress: ordinalsAccount?.address || paymentAccount.address, // Fallback to payment for ordinals if not present
                requestAccounts: async () => accounts, // Simplified
                getNetwork: async () => currentNetwork,
                getBalance: async () => fetchSignetBalance(paymentAccount.address), // Wrapper
                signPsbt: async (psbtBase64, options) => { // SatsConnect now expects base64
                    const signResp = await sc.request('sign_psbt', { psbt: psbtBase64, network: currentNetwork.network, addresses: [paymentAccount.address] });
                    if (signResp.status === 'success') return signResp.result.psbt; // Returns base64
                    throw new Error(signResp.error?.message || 'SatsConnect PSBT signing failed.');
                },
                pushTx: async (txHex) => { // pushTx typically wants hex
                    // SatsConnect might not have a direct pushTx; this would be an external API call
                    // For demo, we'll assume it has one or skip this part
                    throw new Error("pushTx not directly supported by this SatsConnect shim, use external API.");
                },
                disconnect: async () => { if (typeof sc.disconnect === 'function') await sc.disconnect(); }
            };
        } else {
            throw new Error(response.error?.message || `${providerName} connection failed.`);
        }
    } else {
        throw new Error(`${providerName} provider not found or not supported.`);
    }

    if (!accounts || accounts.length === 0) throw new Error("No accounts found or permission denied.");
    userAddress = accounts[0].address || accounts[0]; 
    if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};

    walletConnected = true;
    updateWalletDisplay(currentWallet._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    
    if (currentNetwork.network.toLowerCase() !== CONTRACT_CONFIG.network) {
        const switched = await promptNetworkSwitch(currentWallet._brand?.name || providerName);
        if (switched && currentWallet && currentWallet.getNetwork) { 
            currentNetwork = await currentWallet.getNetwork();
             if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};
            updateWalletDisplay(currentWallet._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
        }
    }
    
    updateEncryptButtonState();
    startNetworkStatusMonitoring();

    if (window.unisat && window.unisat.on && walletType === 'unisat') {
        window.unisat.removeListener('accountsChanged', handleAccountsChanged);
        window.unisat.removeListener('networkChanged', handleNetworkChanged);
        window.unisat.on('accountsChanged', (accs) => handleAccountsChanged(accs, "Unisat"));
        window.unisat.on('networkChanged', (net) => handleNetworkChanged(net, "Unisat"));
    }
    if (window.okxwallet?.bitcoin?.on && walletType === 'okx') {
        window.okxwallet.bitcoin.removeListener('accountsChanged', handleAccountsChanged);
        window.okxwallet.bitcoin.removeListener('networkChanged', handleNetworkChanged);
        window.okxwallet.bitcoin.on('accountsChanged', (res) => { const accs = Array.isArray(res) ? res : (res && res.address ? [res.address] : []); handleAccountsChanged(accs, "OKX")});
        window.okxwallet.bitcoin.on('networkChanged', (net) => handleNetworkChanged(net, "OKX"));
    }
}

async function promptNetworkSwitch(walletTypeName) {
    if (currentNetwork.network.toLowerCase() === CONTRACT_CONFIG.network) return true;

    if (currentWallet && currentWallet.switchNetwork && typeof currentWallet.switchNetwork === 'function') {
        try {
            if (walletTypeName === "Unisat" && currentNetwork.network.toLowerCase() === CONTRACT_CONFIG.network) return true;
            await currentWallet.switchNetwork(CONTRACT_CONFIG.network);
            const newNet = await currentWallet.getNetwork();
            currentNetwork = (!newNet || typeof newNet.network !== 'string') ? {network: CONTRACT_CONFIG.network} : {network: newNet.network.toLowerCase()};
            
            if (currentNetwork.network === CONTRACT_CONFIG.network) {
                updateWalletDisplay(walletTypeName, userAddress, currentNetwork.network, document.getElementById('walletBalance')?.textContent.replace('Balance: ',''));
                updateEncryptButtonState();
                return true;
            }
        } catch (switchError) { console.warn(`Wallet API switchNetwork for ${walletTypeName} failed:`, switchError.message); }
    }

    return new Promise((resolve) => {
        const modalTitle = "Incorrect Network";
        const modalBody = `<p>Your ${walletTypeName} is on <strong>${currentNetwork.network.toUpperCase()}</strong>.</p><p>Please switch to <strong>${CONTRACT_CONFIG.network.toUpperCase()}</strong> to proceed.</p><p>Click "OK" after switching in your wallet.</p>`;
        showModal(modalTitle, modalBody, false); 
        const modalOkButton = document.querySelector('#modalOverlay .modal-footer .btn-primary');
        if (modalOkButton) {
            modalOkButton.onclick = async () => {
                hideModal();
                if (currentWallet && currentWallet.getNetwork) {
                    try {
                        const newNet = await currentWallet.getNetwork();
                        currentNetwork = (!newNet || typeof newNet.network !== 'string') ? {network: CONTRACT_CONFIG.network} : {network: newNet.network.toLowerCase()};
                    } catch (e) { console.warn("Error re-checking network:", e); }
                }
                updateWalletDisplay(walletTypeName, userAddress, currentNetwork.network, document.getElementById('walletBalance')?.textContent.replace('Balance: ',''));
                updateEncryptButtonState(); 
                resolve(currentNetwork.network === CONTRACT_CONFIG.network);
            };
        } else { resolve(false); }
    });
}


function startNetworkStatusMonitoring() {
    if (networkStatusInterval) clearInterval(networkStatusInterval);
    networkStatusInterval = setInterval(async () => {
        if (!walletConnected || !currentWallet) {
            clearInterval(networkStatusInterval); networkStatusInterval = null; return;
        }
        try {
            let newNetworkInfo = { network: currentNetwork.network };
            if (currentWallet.getNetwork) {
                 newNetworkInfo = await currentWallet.getNetwork();
                 if (!newNetworkInfo || typeof newNetworkInfo.network !== 'string') newNetworkInfo = {network: CONTRACT_CONFIG.network};
                 else newNetworkInfo.network = newNetworkInfo.network.toLowerCase();
            }

            if (newNetworkInfo.network !== currentNetwork.network) {
                currentNetwork = newNetworkInfo;
                const balanceStr = document.getElementById('walletBalance')?.textContent.replace('Balance: ','') || 'Loading...';
                updateWalletDisplay(currentWallet._brand?.name || "Wallet", userAddress, currentNetwork.network, balanceStr);
                updateEncryptButtonState(); 
                if (currentNetwork.network !== CONTRACT_CONFIG.network) {
                    console.warn(`Monitor: Wallet switched to ${currentNetwork.network.toUpperCase()}, but ${CONTRACT_CONFIG.network.toUpperCase()} is required.`);
                }
            }
        } catch (error) { console.error("Error during network status monitoring:", error); }
    }, 7000); 
}

function initCarousel() {
    const carouselSlidesContainer = document.getElementById('twitterCarousel');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const indicatorsContainer = document.getElementById('carouselIndicators');

    if (!carouselSlidesContainer || !prevBtn || !nextBtn || !indicatorsContainer) return;
    
    const slides = carouselSlidesContainer.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    let currentSlide = 0;
    indicatorsContainer.innerHTML = ''; 
    slides.forEach((s, i) => { 
        s.classList.remove('active'); 
        const ind = document.createElement('div'); 
        ind.classList.add('carousel-indicator'); 
        ind.dataset.slide = i; 
        indicatorsContainer.appendChild(ind);
    });
    const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');

    function goToSlide(idx) {
        currentSlide = (idx + totalSlides) % totalSlides; 
        slides.forEach((s, i) => s.classList.toggle('active', i === currentSlide));
        indicators.forEach((ind, i) => ind.classList.toggle('active', i === currentSlide));
    }
    function autoSlide() { goToSlide(currentSlide + 1); }

    if (totalSlides > 1) {
        prevBtn.style.display = 'flex'; nextBtn.style.display = 'flex'; indicatorsContainer.style.display = 'flex';
        prevBtn.onclick = () => { goToSlide(currentSlide - 1); resetAutoSlide(); };
        nextBtn.onclick = () => { goToSlide(currentSlide + 1); resetAutoSlide(); };
        indicators.forEach((ind, i) => ind.onclick = () => { goToSlide(i); resetAutoSlide(); });
        if (carouselAutoSlideInterval) clearInterval(carouselAutoSlideInterval);
        carouselAutoSlideInterval = setInterval(autoSlide, 7000); 
    } else {
        prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; indicatorsContainer.style.display = 'none';
    }
    function resetAutoSlide() {
        if (totalSlides > 1) { clearInterval(carouselAutoSlideInterval); carouselAutoSlideInterval = setInterval(autoSlide, 7000); }
    }
    goToSlide(0); 
    document.querySelectorAll('.copy-tweet-btn').forEach(button => {
        button.onclick = () => {
            const tweetText = button.getAttribute('data-tweet');
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
        };
    });
}

function initMessageInput() {
    const msgInput = document.getElementById('message'), charCntEl = document.getElementById('charCount'), byteCntEl = document.getElementById('byteCount'), encResDiv = document.getElementById('encryptionResult'), encBtn = document.getElementById('encryptMessageBtn');
    if (!msgInput || !charCntEl || !byteCntEl || !encResDiv || !encBtn) return;
    encResDiv.style.display = 'none'; 
    msgInput.oninput = () => {
        const txt = msgInput.value, chars = txt.length, bytes = new TextEncoder().encode(txt).length;
        charCntEl.textContent = chars; byteCntEl.textContent = bytes;
        charCntEl.style.color = chars > 150 ? 'var(--color-error)' : ''; byteCntEl.style.color = bytes > 80 ? 'var(--color-error)' : '';
        updateEncryptButtonState(); 
        encResDiv.style.display = 'none'; document.getElementById('signTransaction').style.display = 'none';
    };
    encBtn.onclick = encryptMessage;
    updateEncryptButtonState(); 
}

function updateEncryptButtonState() {
    const encBtn = document.getElementById('encryptMessageBtn'), msgInput = document.getElementById('message');
    if (!encBtn || !msgInput) return; 
    const txt = msgInput.value, trimTxt = txt.trim(), chars = txt.length, bytes = new TextEncoder().encode(txt).length;
    if (!walletConnected) { encBtn.disabled = true; encBtn.textContent = "Connect Wallet First"; return; }
    if (currentNetwork.network.toLowerCase() !== CONTRACT_CONFIG.network) { encBtn.disabled = true; encBtn.textContent = "Wrong Network"; return; }
    if (trimTxt === '') { encBtn.disabled = true; encBtn.textContent = "Enter Message"; }
    else if (chars > 150) { encBtn.disabled = true; encBtn.textContent = "Message Too Long (Chars)"; }
    else if (bytes > 80) { encBtn.disabled = true; encBtn.textContent = "Message Too Long (Bytes)"; }
    else { encBtn.disabled = false; encBtn.textContent = "Encode & Generate Transaction"; }
}

function initBlockHeightAndCountdown() {
    const currBlkEl = document.getElementById('currentBlockHeight'), unlkBlkEl = document.getElementById('unlockBlockHeight'), progBar = document.getElementById('progressBar'), blkStatDiv = document.getElementById('blockStatus');
    if (!currBlkEl || !unlkBlkEl || !progBar || !blkStatDiv) return;
    const unlkBlk = parseInt(unlkBlkEl.textContent, 10); let currSimBlk = 0; 
    async function fetchCurrBlkHght() {
        try {
            // Replace with actual API for Signet: e.g. https://mempool.space/signet/api/blocks/tip/height
            // const resp = await fetch('https://mempool.space/signet/api/blocks/tip/height'); const hghtTxt = await resp.text(); currSimBlk = parseInt(hghtTxt);
            if (currBlkEl.textContent === 'Loading...' || isNaN(parseInt(currBlkEl.textContent))) currSimBlk = Math.floor(unlkBlk * 0.98);
            else { currSimBlk = parseInt(currBlkEl.textContent, 10); if (currSimBlk < unlkBlk) { currSimBlk += 1; currSimBlk = Math.min(currSimBlk, unlkBlk);}}
            currBlkEl.textContent = currSimBlk; updBlkStatUI(currSimBlk, unlkBlk);
        } catch (err) { currBlkEl.textContent = 'Error'; blkStatDiv.innerHTML = '<p class="status-text error-text">Block status error.</p>'; blkStatDiv.className = 'status-indicator error'; if (countdownInterval) clearInterval(countdownInterval); }
    }
    function updBlkStatUI(currBlk, trgtUnlkBlk) {
        const blksRem = Math.max(0, trgtUnlkBlk - currBlk), progPerc = Math.min(100, (currBlk / trgtUnlkBlk) * 100);
        progBar.style.width = `${progPerc}%`; 
        const blksRemEl = document.getElementById('blocksRemaining'); if (blksRemEl) blksRemEl.textContent = blksRem;
        if (blksRem <= 0) {
            blkStatDiv.className = 'status-indicator unlocked'; const stTxtEl = blkStatDiv.querySelector('.status-text'); if(stTxtEl) stTxtEl.textContent = '🎉 Capsules Unlockable!';
            const cntDwnGrid = blkStatDiv.querySelector('.countdown-grid'); if (cntDwnGrid) cntDwnGrid.style.display = 'none';
            if (countdownInterval) clearInterval(countdownInterval); countdownInterval = null;
        } else {
            blkStatDiv.className = 'status-indicator pending'; const stTxtEl = blkStatDiv.querySelector('.status-text'); if(stTxtEl) stTxtEl.innerHTML = `Unlocks in ~<span id="blocksRemaining">${blksRem}</span> blocks`;
            const cntDwnGrid = blkStatDiv.querySelector('.countdown-grid'); if (cntDwnGrid) cntDwnGrid.style.display = 'grid'; 
            const estTotSecsRem = blksRem * 600, now = new Date().getTime(), estUnlkTS = now + (estTotSecsRem * 1000);
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                const currTime = new Date().getTime(); let diff = estUnlkTS - currTime;
                if (diff <= 0) { diff = 0; fetchCurrBlkHght(); }
                const d = Math.floor(diff/(1000*60*60*24)), h = Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m = Math.floor((diff%(1000*60*60))/(1000*60)), s = Math.floor((diff%(1000*60))/1000);
                document.getElementById('countdownDays').textContent=d; document.getElementById('countdownHours').textContent=h.toString().padStart(2,'0'); document.getElementById('countdownMinutes').textContent=m.toString().padStart(2,'0'); document.getElementById('countdownSeconds').textContent=s.toString().padStart(2,'0');
            }, 1000);
        }
    }
    fetchCurrBlkHght(); setInterval(fetchCurrBlkHght, 30000); 
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tabs .tab-btn'), tabCnts = document.querySelectorAll('.tab-content');
    if (!tabBtns.length || !tabCnts.length) return;
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            const trgtTabId = btn.getAttribute('data-tab'); 
            tabBtns.forEach(b => b.classList.remove('active')); tabCnts.forEach(c => c.classList.remove('active')); 
            btn.classList.add('active'); const trgtCnt = document.getElementById(trgtTabId); if (trgtCnt) trgtCnt.classList.add('active');
        };
    });
    if (tabBtns.length > 0 && !document.querySelector('.tabs .tab-btn.active')) tabBtns[0].click();
    else if (document.querySelector('.tabs .tab-btn.active')) {
        const actTab = document.querySelector('.tabs .tab-btn.active'), actCntId = actTab.getAttribute('data-tab'), actCnt = document.getElementById(actCntId);
        if (actCnt) actCnt.classList.add('active');
    }
}

function initDonationAddressCopy() {
    const donAddrDiv = document.getElementById('donationAddress'); if (!donAddrDiv) return;
    const addrTxtEl = document.getElementById('donationAddressText'), confEl = donAddrDiv.querySelector('.copy-confirmation');
    if (!addrTxtEl || !confEl) return;
    donAddrDiv.onclick = async () => {
        try { await navigator.clipboard.writeText(addrTxtEl.textContent); confEl.classList.add('show'); setTimeout(() => confEl.classList.remove('show'), 2000); } 
        catch (err) { showModal("Copy Error", "<p>Could not copy address.</p>"); }
    };
}

async function encryptMessage() { 
    if (!walletConnected || !currentWallet) { showModal("Wallet Error", "<p>Connect wallet and ensure correct network.</p>"); await checkInitialConnection(); if (!walletConnected) return; }
    updateEncryptButtonState(); if (document.getElementById('encryptMessageBtn').disabled) return;
    const msgInput = document.getElementById('message'), encMsgOut = document.getElementById('encodedMessageOutput'), outDiv = document.getElementById('output'), signBtn = document.getElementById('signTransaction'), encResDiv = document.getElementById('encryptionResult');
    const msg = msgInput.value; if (msg.trim() === '') { showModal("Error", "<p>Enter message.</p>"); return; }
    const encMsg = btoa(unescape(encodeURIComponent(msg))); encMsgOut.textContent = encMsg;
    const dummyPsbt = "70736274..."; // Placeholder for actual PSBT construction
    outDiv.innerHTML = `<div class="transaction-detail"><span class="detail-label">Action:</span><span class="detail-value">Store Message</span></div><div class="transaction-detail"><span class="detail-label">Fee:</span><span class="detail-value">${CONTRACT_CONFIG.feeAmount} Signet BTC</span></div><div class="transaction-detail"><span class="detail-label">Message:</span><span class="detail-value code-block small">${encMsg}</span></div><p class="alert alert-info mt-sm">Real PSBT construction is complex & omitted for demo.</p>`;
    encResDiv.style.display = 'block'; signBtn.style.display = 'block';
    signBtn.onclick = () => signAndSubmitTransaction(dummyPsbt, encMsg); 
}

async function signAndSubmitTransaction(psbtHex, originalMessageBase64) { 
    if (!walletConnected || !currentWallet) { showModal("Wallet Error", "<p>Wallet not connected.</p>"); await checkInitialConnection(); if (!walletConnected) return; }
    if (!currentWallet.signPsbt) { showModal("Unsupported Wallet", `<p>${currentWallet._brand?.name || "Wallet"} doesn't support PSBT signing for this demo.</p>`); return; }
    showModal("Signing Transaction", "<p>Approve transaction in your wallet...</p>");
    try {
        // SatsConnect expects PSBT as base64. Other wallets might expect hex.
        // This dummy psbtHex is hex. For SatsConnect, it should be converted to base64.
        let psbtToSign = psbtHex;
        if (currentWallet._satsConnect) { // Check if it's a SatsConnect shimmed wallet
           // Convert hex to Uint8Array then to base64
            const byteArray = new Uint8Array(psbtHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            psbtToSign = btoa(String.fromCharCode.apply(null, byteArray));
        }

        const signedPsbt = await currentWallet.signPsbt(psbtToSign, { autoFinalized: true }); // signedPsbt might be hex or base64
        
        hideModal(); 
        // For demo, we'll simulate broadcast success without actual pushTx which is complex and wallet-specific for hex/base64
        const simTxId = "sim_tx_" + Date.now().toString(16);
        showModal("Transaction Submitted (Simulated)", `<p>Capsule submitted (simulated)!</p><p>TxID (Sim): <a href="https://mempool.space/signet/tx/${simTxId}" target="_blank">${simTxId}</a></p><p>Real broadcast would use wallet's pushTx or an API.</p>`);
        document.getElementById('message').value = ''; updateEncryptButtonState();
        document.getElementById('encryptionResult').style.display = 'none'; document.getElementById('signTransaction').style.display = 'none';
    } catch (error) {
        hideModal();
        showModal("Transaction Failed", `<p>Sign/submit error.</p><p>Details: ${error.message || 'Unknown (check console)'}</p><p>Could be wallet rejection or demo limitation.</p>`);
    }
}

function loadStoredMessages() { document.getElementById('storedMessagesList').innerHTML = '<p>No capsules stored (Demo).</p>';}
function retrieveMessage(txId, encMsg) { try { const decMsg = decodeURIComponent(escape(atob(encMsg))); showModal("Retrieved Message", `<p><strong>Message:</strong></p><p style="word-break: break-word;">${decMsg.replace(/</g,"<").replace(/>/g,">")}</p>`); } catch (e) { showModal("Decoding Error", "<p>Could not decode message.</p>"); }}
function checkMessage() {
    const txIdIn = document.getElementById('txIdInput'), statDiv = document.getElementById('messageStatus'), txId = txIdIn.value.trim();
    if (!txId) { statDiv.innerHTML = '<p class="alert alert-warning">Enter Transaction ID.</p>'; return; }
    statDiv.innerHTML = `<p>Checking TXID: ${txId} (demo)...</p>`;
    setTimeout(() => { const unl = Math.random()>0.5, dEnc = 'SGVsbG8gdGhlcmUh'; statDiv.innerHTML = `<div class="message-item alert ${unl?'alert-success':'alert-info'}"><p><strong>TXID:</strong> ${txId}</p><p><strong>Status:</strong> ${unl?'Unlocked (Demo)':'Pending (Demo)'}</p>${unl?`<p class="code-block small">${dEnc}</p><button class="btn btn-primary btn-sm mt-sm" onclick="decodeAndDisplayMessage('${dEnc}')">Decode</button>`:''}</div>`;},1000);
}
function decodeAndDisplayMessage(encMsg) { try { const decMsg = decodeURIComponent(escape(atob(encMsg))); showModal("Retrieved Message", `<p><strong>Message:</strong></p><p style="word-break: break-word;">${decMsg.replace(/</g,"<").replace(/>/g,">")}</p>`); } catch (e) { showModal("Decoding Error", "<p>Could not decode.</p>"); }}
function updateVisitorCounter() { const cntEl = document.getElementById('visitorCount'); if(cntEl){let c = parseInt(localStorage.getItem('visitorCount_tc_v3')||'0');c++;cntEl.textContent=c.toLocaleString();localStorage.setItem('visitorCount_tc_v3',c.toString());}}

document.addEventListener('DOMContentLoaded', async function() {
    initCarousel(); initMessageInput(); initBlockHeightAndCountdown(); initTabs(); initDonationAddressCopy(); updateVisitorCounter();
    try { await initWalletConnection(); } catch (e) { console.error("Error during main wallet initialization:", e); }
    loadStoredMessages();
});