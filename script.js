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
        if (modalElement) { modalElement.style.opacity = '0'; modalElement.style.transform = 'translateY(-50px)'; }
    };
    if (modalClose) modalClose.onclick = closeModal;
    if (modalOk && !isWalletModal) modalOk.onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };
    setTimeout(() => {
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) { modalElement.style.opacity = '1'; modalElement.style.transform = 'translateY(0)';}
    }, 10);
}

function hideModal(isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
    if (modalOverlay) {
        const modalElement = modalOverlay.querySelector('.modal');
        if (modalElement) { modalElement.style.opacity = '0'; modalElement.style.transform = 'translateY(-50px)';}
        setTimeout(() => { modalOverlay.classList.remove('active'); }, 300);
    }
}

function shortenAddress(address, chars = 6) {
    if (!address || typeof address !== 'string') return '';
    return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

async function fetchSignetBalance(address) {
    if (!address) return 'N/A';
    try {
        const response = await fetch(`https://mempool.space/signet/api/address/${address}`);
        if (!response.ok) { console.warn(`Mempool API error for ${address}: ${response.status}`); return 'Error'; }
        const data = await response.json();
        const balanceSat = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) + (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum);
        return `${(balanceSat / 100000000).toFixed(4)} tBTC`; // tBTC for Signet clarity
    } catch (error) { console.error(`Failed to fetch balance for ${address}:`, error); return 'N/A (API)'; }
}

function updateWalletDisplay(walletName, address, network, balanceStr = 'Loading...') {
    const walletStatusEl = document.getElementById('walletStatus');
    const walletInfoEl = document.getElementById('walletInfo');
    const walletAddressEl = document.getElementById('walletAddress');
    const walletBalanceEl = document.getElementById('walletBalance');
    const connectWalletButton = document.getElementById('connectWallet');
    const disconnectWalletButton = document.getElementById('disconnectWallet');

    if (walletConnected && address) {
        walletStatusEl.style.display = 'none';
        walletInfoEl.style.display = 'flex';
        walletAddressEl.textContent = `${walletName || 'Wallet'}: ${shortenAddress(address)}`;
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
        document.querySelectorAll('#walletSelectionModal .wallet-option').forEach(button => {
            button.onclick = async () => {
                const walletType = button.getAttribute('data-wallet');
                if (button.classList.contains('unavailable')) {
                    hideModal(true); showModal("Wallet Not Found", `<p>${walletType} wallet not detected. Please install/enable it.</p>`); return;
                }
                hideModal(true);
                try { await connectToWallet(walletType); } 
                catch (error) {
                    console.error(`Connection to ${walletType} failed:`, error);
                    updateWalletDisplay(null, null, null, null); walletConnected = false; currentWallet = null;
                    showModal("Connection Error", `<p>Failed to connect: ${error.message || 'Unknown error.'}</p>`);
                }
                updateEncryptButtonState();
            };
        });
    };
    disconnectWalletButton.onclick = async () => {
        const providerName = currentWallet?._brand?.name || "Wallet";
        if (currentWallet && typeof currentWallet.disconnect === 'function') {
            try { await currentWallet.disconnect(); } catch (e) { console.warn(`Error on ${providerName}.disconnect(): ${e.message}`); }
        } else if (currentWallet && currentWallet._satsConnect && typeof currentWallet._satsConnect.disconnect === 'function') { // SatsConnect specific
             try { await currentWallet._satsConnect.disconnect(); } catch (e) { console.warn(`Error on SatsConnect.disconnect(): ${e.message}`); }
        }
        handleDisconnect(providerName);
    };
    await checkInitialConnection();
    const tcppLink = document.getElementById('tcppLink');
    if (tcppLink) tcppLink.onclick = (e) => { e.preventDefault(); hideModal(true); showModal("Terms & Privacy", `<div class="tcpp-content"><h3>Terms</h3><p>Experimental use on Signet. No real value.</p><h3>Privacy</h3><p>Public data logged. Wallet T&Cs apply.</p></div>`); };
}

const handleDisconnect = (providerName = "Wallet") => {
    walletConnected = false; userAddress = null; userPublicKey = null; currentWallet = null; currentNetwork = { network: 'unknown' };
    updateWalletDisplay(); updateEncryptButtonState();
    if(networkStatusInterval) clearInterval(networkStatusInterval); networkStatusInterval = null;
};

const handleAccountsChanged = async (accounts, providerName = "Wallet") => {
    if (!accounts || accounts.length === 0) { handleDisconnect(providerName); return; }
    userAddress = accounts[0].address || accounts[0]; 
    let balanceStr = 'Loading...';
    if (currentWallet && typeof currentWallet.getBalance === 'function') {
        try { balanceStr = formatBalance(await currentWallet.getBalance(), providerName); } catch (e) { balanceStr = 'N/A'; }
    } else if (userAddress && currentWallet && currentWallet._satsConnect) { // Specific for SatsConnect shim
        balanceStr = await fetchSignetBalance(userAddress);
    }

    if (currentWallet && typeof currentWallet.getNetwork === 'function') {
        try {
            const netInfo = await currentWallet.getNetwork();
            currentNetwork = (netInfo && typeof netInfo.network === 'string') ? { network: netInfo.network.toLowerCase() } : { network: CONTRACT_CONFIG.network };
        } catch (e) { currentNetwork = { network: CONTRACT_CONFIG.network }; }
    }
    updateWalletDisplay(currentWallet?._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    walletConnected = true; 
    updateEncryptButtonState();
};

const handleNetworkChanged = async (networkInfo, providerName = "Wallet") => {
    if (typeof networkInfo === 'string') currentNetwork = { network: networkInfo.toLowerCase() };
    else if (networkInfo && typeof networkInfo.network === 'string') currentNetwork = { network: networkInfo.network.toLowerCase() };
    else if (currentWallet && typeof currentWallet.getNetwork === 'function') {
        try {
            const netInfo = await currentWallet.getNetwork();
            currentNetwork = (netInfo && typeof netInfo.network === 'string') ? { network: netInfo.network.toLowerCase() } : { network: CONTRACT_CONFIG.network };
        } catch (e) { currentNetwork = { network: CONTRACT_CONFIG.network }; }
    } else { currentNetwork = { network: CONTRACT_CONFIG.network }; }

    const balanceStr = document.getElementById('walletBalance')?.textContent.replace('Balance: ','') || 'Loading...';
    updateWalletDisplay(currentWallet?._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    if (currentNetwork.network !== CONTRACT_CONFIG.network) await promptNetworkSwitch(currentWallet?._brand?.name || providerName);
    updateEncryptButtonState();
};

function formatBalance(balanceData, walletName) {
    if (balanceData === null || balanceData === undefined) return 'N/A';
    let sats;
    if (typeof balanceData === 'number') sats = balanceData;
    else if (balanceData && typeof balanceData.total === 'number') sats = balanceData.total; // Unisat-like
    else if (balanceData && typeof balanceData.satoshi === 'number') sats = balanceData.satoshi; // OKX-like
    else if (balanceData && typeof balanceData.confirmed === 'number') sats = balanceData.confirmed; // General structure
    else return 'N/A (Format)';
    return `${(sats / 100000000).toFixed(4)} tBTC`;
}
    
async function checkInitialConnection() {
    try {
        if (typeof window.unisat?.getAccounts === 'function') {
            const accounts = await window.unisat.getAccounts();
            if (accounts && accounts.length > 0) {
                userAddress = accounts[0]; currentWallet = window.unisat; currentWallet._brand = { name: "Unisat" };
                currentNetwork = await window.unisat.getNetwork(); if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};
                handleInitialWalletConnection('Unisat', currentNetwork, formatBalance(await currentWallet.getBalance(), "Unisat")); return;
            }
        }
        if (typeof window.okxwallet?.bitcoin?.selectedAccount === 'object' && window.okxwallet.bitcoin.selectedAccount?.address) {
             const acc = window.okxwallet.bitcoin.selectedAccount; userAddress = acc.address; userPublicKey = acc.publicKey;
             currentWallet = window.okxwallet.bitcoin; currentWallet._brand = { name: "OKX" };
             currentNetwork = await window.okxwallet.bitcoin.getNetwork(); if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network};
             handleInitialWalletConnection('OKX', currentNetwork, formatBalance(await currentWallet.getBalance(), "OKX")); return;
        }
    } catch (error) { console.warn("Error during initial wallet connection check:", error.message); }
}

function handleInitialWalletConnection(walletType, networkInfo, balanceStr) {
    walletConnected = true; currentNetwork = networkInfo;
    if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = { network: CONTRACT_CONFIG.network };
    updateWalletDisplay(walletType, userAddress, currentNetwork.network, balanceStr);
    if (currentNetwork.network !== CONTRACT_CONFIG.network) promptNetworkSwitch(walletType);
    updateEncryptButtonState(); startNetworkStatusMonitoring();
}

async function checkWalletsAvailability() {
    let walletsFound = 0;
    const updateOption = (key, avail) => {
        const opt = document.querySelector(`.wallet-option[data-wallet="${key}"]`);
        if(opt) { opt.classList.toggle('unavailable', !avail); if(avail) walletsFound++; opt.style.display = 'flex'; }
    };
    
    await new Promise(r => setTimeout(r, 100)); 
    updateOption('unisat', typeof window.unisat?.requestAccounts === 'function');
    
    const scObj = window.satsConnect || window.satsconnect;
    updateOption('xverse', typeof window.BitcoinProvider === 'object' || (typeof scObj?.request === 'function' && typeof XverseProviders !== 'undefined')); // Xverse might expose XverseProviders
    
    updateOption('okx', typeof window.okxwallet?.bitcoin?.connect === 'function');
    
    updateOption('leather', typeof window.LeatherProvider === 'function' || (typeof scObj?.request === 'function' && typeof LeatherProvider !== 'undefined')); // Leather might expose LeatherProvider for SatsConnect
    
    document.getElementById('walletSelectInstruction').style.display = 'block';
    document.getElementById('walletAvailabilityMessage').style.display = walletsFound === 0 ? 'block' : 'none';
}

async function connectToWallet(walletType) {
    let accounts = []; let providerName = walletType.charAt(0).toUpperCase() + walletType.slice(1); 
    let balanceStr = 'Loading...'; currentNetwork = { network: 'unknown' }; 

    if (walletType === 'unisat' && typeof window.unisat !== 'undefined') {
        accounts = await window.unisat.requestAccounts(); currentNetwork = await window.unisat.getNetwork();
        currentWallet = window.unisat; currentWallet._brand = { name: "Unisat" };
        balanceStr = formatBalance(await currentWallet.getBalance(), "Unisat");
    } else if (walletType === 'okx' && typeof window.okxwallet?.bitcoin !== 'undefined') {
        const result = await window.okxwallet.bitcoin.connect(); 
        accounts = result.address ? [result.address] : (Array.isArray(result) ? result : []); 
        userPublicKey = result.publicKey; currentNetwork = await window.okxwallet.bitcoin.getNetwork();
        currentWallet = window.okxwallet.bitcoin; currentWallet._brand = { name: "OKX" };
        balanceStr = formatBalance(await currentWallet.getBalance(), "OKX");
    } else if (walletType === 'xverse' || walletType === 'leather') {
        const sc = window.satsConnect || window.satsconnect;
        if (!sc || typeof sc.request !== 'function') throw new Error(`${providerName} (SatsConnect) API not found.`);
        providerName = walletType.charAt(0).toUpperCase() + walletType.slice(1);
        
        const getAddressesOptions = { purposes: ['payment', 'ordinals'], network: { type: CONTRACT_CONFIG.network === 'signet' ? 'Signet': 'Mainnet' } };
        const addressesResponse = await sc.request('getAccounts', getAddressesOptions); // More generic SatsConnect call

        if (addressesResponse.status === 'success' && addressesResponse.result.length > 0) {
            const paymentAccount = addressesResponse.result.find(acc => acc.purpose === 'payment');
            if (!paymentAccount) throw new Error (`${providerName} did not provide a payment address.`);
            accounts = [paymentAccount.address]; userPublicKey = paymentAccount.publicKey;
            // Network from SatsConnect address is usually reliable. Fallback to config.
            currentNetwork = { network: (paymentAccount.network?.type || CONTRACT_CONFIG.network).toLowerCase() };
            balanceStr = await fetchSignetBalance(paymentAccount.address);
            currentWallet = {
                _brand: { name: providerName }, _satsConnect: sc, _paymentAddress: paymentAccount.address,
                requestAccounts: async () => accounts, getNetwork: async () => currentNetwork,
                getBalance: async () => fetchSignetBalance(paymentAccount.address),
                signPsbt: async (psbtBase64, options) => { // Expects base64
                    const signResp = await sc.request('signPsbt', { psbtBase64, broadcaster: null, network: currentNetwork.network.toUpperCase() }); // broadcaster null to sign only
                    if (signResp.status === 'success') return signResp.result.psbtBase64;
                    throw new Error(signResp.error?.message || 'SatsConnect PSBT signing failed.');
                },
                disconnect: async () => { if (typeof sc.disconnect === 'function') await sc.disconnect(); }
            };
        } else { throw new Error(addressesResponse.error?.message || `${providerName} connection via SatsConnect failed.`); }
    } else { throw new Error(`${providerName} provider detection/connection failed.`); }

    if (!accounts || accounts.length === 0) throw new Error("No accounts found or permission denied.");
    userAddress = accounts[0].address || accounts[0]; 
    if (!currentNetwork || typeof currentNetwork.network !== 'string') currentNetwork = {network: CONTRACT_CONFIG.network.toLowerCase()};
    else currentNetwork.network = currentNetwork.network.toLowerCase();

    walletConnected = true;
    updateWalletDisplay(currentWallet._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
    
    if (currentNetwork.network !== CONTRACT_CONFIG.network) {
        const switched = await promptNetworkSwitch(currentWallet._brand?.name || providerName);
        if (switched && currentWallet && typeof currentWallet.getNetwork === 'function') { 
            const newNet = await currentWallet.getNetwork();
            currentNetwork = (!newNet || typeof newNet.network !== 'string') ? {network: CONTRACT_CONFIG.network} : {network: newNet.network.toLowerCase()};
            updateWalletDisplay(currentWallet._brand?.name || providerName, userAddress, currentNetwork.network, balanceStr);
        }
    }
    updateEncryptButtonState(); startNetworkStatusMonitoring();
    // Attach/reattach event listeners specific to this connected wallet
    if (window.unisat && currentWallet === window.unisat) {
        window.unisat.removeAllListeners('accountsChanged'); window.unisat.removeAllListeners('networkChanged');
        window.unisat.on('accountsChanged', (accs) => handleAccountsChanged(accs, "Unisat"));
        window.unisat.on('networkChanged', (net) => handleNetworkChanged(net, "Unisat"));
    }
    if (window.okxwallet?.bitcoin && currentWallet === window.okxwallet.bitcoin) {
        window.okxwallet.bitcoin.removeAllListeners('accountsChanged'); window.okxwallet.bitcoin.removeAllListeners('networkChanged');
        window.okxwallet.bitcoin.on('accountsChanged', (res) => { const accs = Array.isArray(res) ? res : (res && res.address ? [res.address] : []); handleAccountsChanged(accs, "OKX")});
        window.okxwallet.bitcoin.on('networkChanged', (net) => handleNetworkChanged(net, "OKX"));
    }
}

async function promptNetworkSwitch(walletTypeName) {
    if (currentNetwork.network.toLowerCase() === CONTRACT_CONFIG.network) return true;
    if (currentWallet && currentWallet.switchNetwork && typeof currentWallet.switchNetwork === 'function') {
        try {
            if (walletTypeName === "Unisat" && currentNetwork.network.toLowerCase() === CONTRACT_CONFIG.network) return true;
            await currentWallet.switchNetwork(CONTRACT_CONFIG.network); // Unisat expects 'mainnet' or 'testnet' (which it maps to signet sometimes)
            const newNet = await currentWallet.getNetwork();
            currentNetwork = (!newNet || typeof newNet.network !== 'string') ? {network: CONTRACT_CONFIG.network} : {network: newNet.network.toLowerCase()};
            if (currentNetwork.network === CONTRACT_CONFIG.network) {
                updateWalletDisplay(walletTypeName, userAddress, currentNetwork.network, document.getElementById('walletBalance')?.textContent.replace('Balance: ',''));
                updateEncryptButtonState(); return true;
            }
        } catch (switchError) { console.warn(`Wallet API switchNetwork for ${walletTypeName} failed:`, switchError.message); }
    }
    return new Promise((resolve) => {
        showModal("Incorrect Network", `<p>Your ${walletTypeName} is on <strong>${currentNetwork.network.toUpperCase()}</strong>.</p><p>Please switch to <strong>${CONTRACT_CONFIG.network.toUpperCase()}</strong>.</p><p>Click "OK" after switching.</p>`, false); 
        const modalOkButton = document.querySelector('#modalOverlay .modal-footer .btn-primary');
        if (modalOkButton) modalOkButton.onclick = async () => {
            hideModal();
            if (currentWallet && typeof currentWallet.getNetwork === 'function') {
                try {
                    const newNet = await currentWallet.getNetwork();
                    currentNetwork = (!newNet || typeof newNet.network !== 'string') ? {network: CONTRACT_CONFIG.network} : {network: newNet.network.toLowerCase()};
                } catch (e) { console.warn("Error re-checking network:", e); }
            }
            updateWalletDisplay(walletTypeName, userAddress, currentNetwork.network, document.getElementById('walletBalance')?.textContent.replace('Balance: ',''));
            updateEncryptButtonState(); resolve(currentNetwork.network === CONTRACT_CONFIG.network);
        }; else resolve(false);
    });
}

function startNetworkStatusMonitoring() {
    if (networkStatusInterval) clearInterval(networkStatusInterval);
    networkStatusInterval = setInterval(async () => {
        if (!walletConnected || !currentWallet || typeof currentWallet.getNetwork !== 'function') { clearInterval(networkStatusInterval); networkStatusInterval = null; return; }
        try {
            const netInfo = await currentWallet.getNetwork();
            const newNetwork = (netInfo && typeof netInfo.network === 'string') ? netInfo.network.toLowerCase() : CONTRACT_CONFIG.network;
            if (newNetwork !== currentNetwork.network) {
                currentNetwork.network = newNetwork;
                const balanceStr = document.getElementById('walletBalance')?.textContent.replace('Balance: ','') || 'Loading...';
                updateWalletDisplay(currentWallet._brand?.name || "Wallet", userAddress, currentNetwork.network, balanceStr);
                updateEncryptButtonState(); 
                if (currentNetwork.network !== CONTRACT_CONFIG.network) console.warn(`Monitor: Wallet on ${currentNetwork.network.toUpperCase()}, ${CONTRACT_CONFIG.network.toUpperCase()} required.`);
            }
        } catch (error) { console.error("Network monitor error:", error); }
    }, 7500); 
}

function initCarousel() {
    const container = document.getElementById('twitterCarousel'), prev = document.getElementById('prevSlide'), next = document.getElementById('nextSlide'), indsCont = document.getElementById('carouselIndicators');
    if (!container || !prev || !next || !indsCont) return;
    const slides = container.querySelectorAll('.carousel-slide'), total = slides.length; if (total === 0) return;
    let current = 0; indsCont.innerHTML = ''; slides.forEach((s, i) => { s.classList.remove('active'); const ind = document.createElement('div'); ind.className = 'carousel-indicator'; ind.dataset.slide = i; indsCont.appendChild(ind); });
    const inds = indsCont.querySelectorAll('.carousel-indicator');
    function go(idx) { current = (idx + total) % total; slides.forEach((s, i) => s.classList.toggle('active', i === current)); inds.forEach((ind, i) => ind.classList.toggle('active', i === current));}
    function auto() { go(current + 1); }
    if (total > 1) {
        prev.style.display = 'flex'; next.style.display = 'flex'; indsCont.style.display = 'flex';
        prev.onclick = () => { go(current - 1); resetAuto(); }; next.onclick = () => { go(current + 1); resetAuto(); };
        inds.forEach((ind, i) => ind.onclick = () => { go(i); resetAuto(); });
        if (carouselAutoSlideInterval) clearInterval(carouselAutoSlideInterval); carouselAutoSlideInterval = setInterval(auto, 7000); 
    } else { prev.style.display = 'none'; next.style.display = 'none'; indsCont.style.display = 'none'; }
    function resetAuto() { if (total > 1) { clearInterval(carouselAutoSlideInterval); carouselAutoSlideInterval = setInterval(auto, 7000); }}
    go(0); document.querySelectorAll('.copy-tweet-btn').forEach(b => b.onclick = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(b.dataset.tweet)}`, '_blank'));
}

function initMessageInput() {
    const msgIn = document.getElementById('message'), charEl = document.getElementById('charCount'), byteEl = document.getElementById('byteCount'), resDiv = document.getElementById('encryptionResult'), btn = document.getElementById('encryptMessageBtn');
    if (!msgIn || !charEl || !byteEl || !resDiv || !btn) return;
    resDiv.style.display = 'none'; 
    msgIn.oninput = () => {
        const txt = msgIn.value, chars = txt.length, bytes = new TextEncoder().encode(txt).length;
        charEl.textContent = chars; byteEl.textContent = bytes;
        charEl.style.color = chars > 150 ? 'var(--color-error)' : ''; byteEl.style.color = bytes > 80 ? 'var(--color-error)' : '';
        updateEncryptButtonState(); resDiv.style.display = 'none'; document.getElementById('signTransaction').style.display = 'none';
    };
    btn.onclick = encryptMessage; updateEncryptButtonState(); 
}

function updateEncryptButtonState() {
    const btn = document.getElementById('encryptMessageBtn'), msgIn = document.getElementById('message'); if (!btn || !msgIn) return; 
    const txt = msgIn.value, trimTxt = txt.trim(), chars = txt.length, bytes = new TextEncoder().encode(txt).length;
    if (!walletConnected) { btn.disabled = true; btn.textContent = "Connect Wallet First"; return; }
    if (currentNetwork.network.toLowerCase() !== CONTRACT_CONFIG.network) { btn.disabled = true; btn.textContent = `Switch to ${CONTRACT_CONFIG.network.toUpperCase()}`; return; }
    if (trimTxt === '') { btn.disabled = true; btn.textContent = "Enter Message"; }
    else if (chars > 150) { btn.disabled = true; btn.textContent = "Too Long (150 Chars Max)"; }
    else if (bytes > 80) { btn.disabled = true; btn.textContent = "Too Large (80 Bytes Max)"; }
    else { btn.disabled = false; btn.textContent = "Encode & Generate Transaction"; }
}

function initBlockHeightAndCountdown() {
    const currEl = document.getElementById('currentBlockHeight'), unlkEl = document.getElementById('unlockBlockHeight'), bar = document.getElementById('progressBar'), statDiv = document.getElementById('blockStatus');
    if (!currEl || !unlkEl || !bar || !statDiv) return;
    const unlkBlk = parseInt(unlkEl.textContent, 10); let currSim = 0; 
    async function fetchHght() {
        try {
            // const r = await fetch('https://mempool.space/signet/api/blocks/tip/height'); const ht = await r.text(); currSim = parseInt(ht);
            if (currEl.textContent === 'Loading...' || isNaN(parseInt(currEl.textContent))) currSim = Math.floor(unlkBlk * 0.99);
            else { currSim = parseInt(currEl.textContent, 10); if (currSim < unlkBlk) { currSim += 1; currSim = Math.min(currSim, unlkBlk);}}
            currEl.textContent = currSim; updUI(currSim, unlkBlk);
        } catch (err) { currEl.textContent='Err'; statDiv.innerHTML='<p class="status-text error-text">Block err.</p>'; statDiv.className='status-indicator error'; if(countdownInterval)clearInterval(countdownInterval);}}
    function updUI(curr, trgt) {
        const rem = Math.max(0, trgt - curr), perc = Math.min(100, (curr / trgt) * 100); bar.style.width = `${perc}%`; 
        const remEl = document.getElementById('blocksRemaining'); if(remEl)remEl.textContent=rem;
        if (rem <= 0) {
            statDiv.className = 'status-indicator unlocked'; const stTxt = statDiv.querySelector('.status-text'); if(stTxt)stTxt.textContent='🎉 Capsules Now Unlockable!';
            const grid = statDiv.querySelector('.countdown-grid'); if(grid)grid.style.display='none'; if(countdownInterval)clearInterval(countdownInterval); countdownInterval = null;
        } else {
            statDiv.className = 'status-indicator pending'; const stTxt = statDiv.querySelector('.status-text'); if(stTxt)stTxt.innerHTML=`Unlocks in ~<span id="blocksRemaining">${rem}</span> blocks`;
            const grid = statDiv.querySelector('.countdown-grid'); if(grid)grid.style.display='grid'; 
            const secsRem = rem * 600, now = Date.now(), unlkTS = now + (secsRem * 1000);
            if(countdownInterval)clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                let diff = unlkTS - Date.now(); if (diff <= 0) { diff = 0; fetchHght(); }
                const d=Math.floor(diff/(1000*60*60*24)), h=Math.floor((diff%(1000*60*60*24))/(1000*60*60)), m=Math.floor((diff%(1000*60*60))/(1000*60)), s=Math.floor((diff%(1000*60))/1000);
                document.getElementById('countdownDays').textContent=d; document.getElementById('countdownHours').textContent=h.toString().padStart(2,'0'); document.getElementById('countdownMinutes').textContent=m.toString().padStart(2,'0'); document.getElementById('countdownSeconds').textContent=s.toString().padStart(2,'0');
            }, 1000);}}
    fetchHght(); setInterval(fetchHght, 20000); // Faster update for demo
}

function initTabs() {
    const btns = document.querySelectorAll('.tabs .tab-btn'), cnts = document.querySelectorAll('.tab-content'); if (!btns.length || !cnts.length) return;
    btns.forEach(b => b.onclick = () => { const id = b.dataset.tab; btns.forEach(x=>x.classList.remove('active')); cnts.forEach(x=>x.classList.remove('active')); b.classList.add('active'); const c=document.getElementById(id); if(c)c.classList.add('active'); });
    if (btns.length > 0 && !document.querySelector('.tabs .tab-btn.active')) btns[0].click(); else if (document.querySelector('.tabs .tab-btn.active')) { const actT=document.querySelector('.tabs .tab-btn.active'), actCId=actT.dataset.tab, actC=document.getElementById(actCId); if(actC)actC.classList.add('active');}
}

function initDonationAddressCopy() {
    const div = document.getElementById('donationAddress'); if (!div) return;
    const txtEl = document.getElementById('donationAddressText'), confEl = div.querySelector('.copy-confirmation'); if (!txtEl || !confEl) return;
    div.onclick = async () => { try { await navigator.clipboard.writeText(txtEl.textContent); confEl.classList.add('show'); setTimeout(() => confEl.classList.remove('show'), 2000); } catch (err) { showModal("Copy Error", "<p>Could not copy.</p>"); }};
}

async function encryptMessage() { 
    if (!walletConnected || !currentWallet) { showModal("Wallet Error", "<p>Connect wallet.</p>"); await checkInitialConnection(); if (!walletConnected) return; }
    updateEncryptButtonState(); if (document.getElementById('encryptMessageBtn').disabled) return;
    const msgIn=document.getElementById('message'), encOut=document.getElementById('encodedMessageOutput'), outDiv=document.getElementById('output'), signBtn=document.getElementById('signTransaction'), resDiv=document.getElementById('encryptionResult');
    const msg=msgIn.value; if (msg.trim()==='') { showModal("Input Error", "<p>Enter a message.</p>"); return; }
    const encMsg=btoa(unescape(encodeURIComponent(msg))); encOut.textContent=encMsg;
    const dummyPsbtB64 = "cHNidP8BAgMEBQYHCAkKDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=="; // Placeholder valid-ish base64 PSBT
    outDiv.innerHTML = `<div class="transaction-detail"><span class="detail-label">Action:</span><span class="detail-value">Store Message</span></div><div class="transaction-detail"><span class="detail-label">Fee:</span><span class="detail-value">${CONTRACT_CONFIG.feeAmount} tBTC</span></div><div class="transaction-detail"><span class="detail-label">Message:</span><span class="detail-value code-block small">${encMsg}</span></div><p class="alert alert-info mt-sm">Tx preview. Real PSBT is complex.</p>`;
    resDiv.style.display='block'; signBtn.style.display='block'; signBtn.onclick=()=>signAndSubmitTransaction(dummyPsbtB64, encMsg); 
}

async function signAndSubmitTransaction(psbtBase64, originalMessageBase64) { 
    if (!walletConnected || !currentWallet) { showModal("Wallet Error", "<p>Wallet not connected.</p>"); await checkInitialConnection(); if (!walletConnected) return; }
    if (!currentWallet.signPsbt) { showModal("Unsupported Wallet", `<p>${currentWallet._brand?.name || "Wallet"} doesn't support PSBT signing for this demo.</p>`); return; }
    showModal("Signing Transaction", "<p>Approve transaction in wallet...</p>");
    try {
        const signedPsbtBase64 = await currentWallet.signPsbt(psbtBase64, { autoFinalized: true }); // Assuming signPsbt expects base64
        hideModal(); 
        const simTxId = "sim_tx_" + Date.now().toString(36);
        showModal("Transaction Submitted (Simulated)", `<p>Capsule submitted (simulated)!</p><p>TxID (Sim): <a href="https://mempool.space/signet/tx/${simTxId}" target="_blank">${simTxId}</a></p><p>Real broadcast needs wallet's pushTx or API.</p>`);
        document.getElementById('message').value = ''; updateEncryptButtonState();
        document.getElementById('encryptionResult').style.display = 'none'; document.getElementById('signTransaction').style.display = 'none';
    } catch (error) {
        hideModal(); showModal("Transaction Failed", `<p>Sign/submit error: ${error.message || 'Unknown (check console)'}</p>`);
    }
}

function loadStoredMessages() { document.getElementById('storedMessagesList').innerHTML = '<p>No capsules (Demo).</p>';}
function retrieveMessage(txId, encMsg) { try { const dec=decodeURIComponent(escape(atob(encMsg))); showModal("Retrieved Message", `<p><strong>Msg:</strong></p><p style="word-break:break-word;">${dec.replace(/</g,"<").replace(/>/g,">")}</p>`); } catch (e) { showModal("Decode Error", "<p>Msg decode failed.</p>"); }}
function checkMessage() {
    const txIn=document.getElementById('txIdInput'), statDv=document.getElementById('messageStatus'), txId=txIn.value.trim(); if(!txId){statDv.innerHTML='<p class="alert alert-warning">Enter TXID.</p>';return;}
    statDv.innerHTML=`<p>Checking ${txId} (demo)...</p>`; setTimeout(()=>{const unl=Math.random()>0.5,dEnc='SGVsbG8gdGhlcmUh'; statDv.innerHTML=`<div class="message-item alert ${unl?'alert-success':'alert-info'}"><p><strong>TXID:</strong> ${txId}</p><p><strong>Status:</strong> ${unl?'Unlocked':'Pending'} (Demo)</p>${unl?`<p class="code-block small">${dEnc}</p><button class="btn btn-primary btn-sm mt-sm" onclick="decodeAndDisplayMessage('${dEnc}')">Decode</button>`:''}</div>`;},500);
}
function decodeAndDisplayMessage(encMsg) { try { const dec=decodeURIComponent(escape(atob(encMsg))); showModal("Retrieved Message", `<p><strong>Msg:</strong></p><p style="word-break:break-word;">${dec.replace(/</g,"<").replace(/>/g,">")}</p>`); } catch (e) { showModal("Decode Error", "<p>Decode failed.</p>"); }}
function updateVisitorCounter() { const el=document.getElementById('visitorCount'); if(el){let c=parseInt(localStorage.getItem('visitor_tc_v4')||'0');c++;el.textContent=c.toLocaleString();localStorage.setItem('visitor_tc_v4',c.toString());}}

document.addEventListener('DOMContentLoaded', async function() {
    initCarousel(); initMessageInput(); initBlockHeightAndCountdown(); initTabs(); initDonationAddressCopy(); updateVisitorCounter();
    try { await initWalletConnection(); } catch (e) { console.error("Main wallet init error:", e); }
    loadStoredMessages();
});