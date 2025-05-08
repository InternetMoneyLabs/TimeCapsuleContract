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
let networkStatusInterval = null;
let countdownInterval = null;
let carouselAutoSlideInterval = null; // New interval for carousel


// Utility function to show modals
function showModal(title, bodyHtml, isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
    // Ensure the correct modal is found
    if (!modalOverlay) {
        console.error("Modal overlay element not found:", isWalletModal ? '#walletSelectionModal' : '#modalOverlay');
        return;
    }

    const modalTitle = modalOverlay.querySelector('.modal-title');
    const modalBody = modalOverlay.querySelector('.modal-body');
    const modalClose = modalOverlay.querySelector('.modal-close');
    // Note: We are no longer setting innerHTML for the wallet modal body here
    const modalOk = modalOverlay.querySelector('.modal-footer .btn-primary'); // Assuming OK button exists in regular modal footer


    if (modalTitle) modalTitle.textContent = title;
    // Only set bodyHtml if it's provided and it's not the wallet modal (wallet modal body is pre-configured)
    if (modalBody && !isWalletModal && bodyHtml !== undefined) {
         modalBody.innerHTML = bodyHtml;
    }


    modalOverlay.classList.add('active');

    // Close logic for both modals
    const closeModal = () => {
        modalOverlay.classList.remove('active');
        // Clear modal content when hidden (optional, depends on usage)
        // if (modalBody) modalBody.innerHTML = ''; // Be cautious clearing wallet modal body
    };

    if (modalClose) {
        // Remove existing listener before adding a new one to prevent duplicates
        const oldCloseHandler = modalClose._closeHandler;
         if (oldCloseHandler) {
             modalClose.removeEventListener('click', oldCloseHandler);
         }
         const newCloseHandler = closeModal;
         modalClose.addEventListener('click', newCloseHandler);
         modalClose._closeHandler = newCloseHandler; // Store for removal
    }

    if (modalOk && !isWalletModal) { // Only apply to the regular modal's OK button
        // Remove existing listener
         const oldOkHandler = modalOk._okHandler;
         if (oldOkHandler) {
             modalOk.removeEventListener('click', oldOkHandler);
         }
         const newOkHandler = closeModal;
         modalOk.addEventListener('click', newOkHandler);
         modalOk._okHandler = newOkHandler; // Store for removal
    }

    // Close modal on outside click
     // Remove existing listener
     const oldOverlayClickHandler = modalOverlay._overlayClickHandler;
     if (oldOverlayClickHandler) {
         modalOverlay.removeEventListener('click', oldOverlayClickHandler);
     }
     const newOverlayClickHandler = (e) => {
         if (e.target === modalOverlay) {
             closeModal();
         }
     };
    modalOverlay.addEventListener('click', newOverlayClickHandler);
     modalOverlay._overlayClickHandler = newOverlayClickHandler; // Store for removal

     console.log(`Modal shown: ${title}`);
}

// Utility function to hide modals
function hideModal(isWalletModal = false) {
    const modalOverlay = isWalletModal ? document.getElementById('walletSelectionModal') : document.getElementById('modalOverlay');
     if (modalOverlay) {
         modalOverlay.classList.remove('active');
          console.log(`Modal hidden: ${isWalletModal ? 'Wallet' : 'Regular'}`);
          // Optional: Clear modal content when hidden
         // const modalBody = modalOverlay.querySelector('.modal-body');
         // if (modalBody && !isWalletModal) { // Be cautious clearing wallet modal body
         //      modalBody.innerHTML = '';
         // }
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
        console.error("Wallet elements not found on page load.");
        return; // Critical elements missing, cannot proceed with wallet init
    }
    console.log("Wallet elements found.");


    // Check for available wallets and update UI *before* the button is clicked
    checkWalletsAvailability();

    connectWalletButton.onclick = () => {
        console.log("Connect Wallet button clicked. Attempting to show wallet selection modal.");
        // The checkWalletsAvailability function already runs on page load and configures the modal content (shows/hides wallets or message).
        // We just need to show the modal overlay. The title and body structure are already in index.html.
        // Pass empty string for bodyHtml as it's not needed to set content here.
        showModal('Select your Bitcoin wallet', '', true);

         // Re-attach event listeners to the wallet options within the modal every time it's opened
         // This is necessary because the modal might have been hidden/shown, and we want clicks to work.
         // We should only re-attach if the modal element is confirmed to exist.
         const modalElement = document.getElementById('walletSelectionModal');
         if (modalElement) {
              const walletOptions = modalElement.querySelectorAll('.wallet-option');
              walletOptions.forEach(button => {
                  // Remove existing listeners to prevent duplicates
                  const oldClickHandler = button._clickHandler; // Use a custom property to store the handler
                  if (oldClickHandler) {
                      button.removeEventListener('click', oldClickHandler);
                  }

                  const newClickHandler = async () => {
                      const walletType = button.getAttribute('data-wallet');
                       console.log(`Wallet option clicked: ${walletType}`);
                      if (button.classList.contains('unavailable')) {
                           console.log(`${walletType} wallet unavailable.`);
                           // Hide the wallet selection modal first
                           hideModal(true);
                           // Then show the "Wallet Not Found" modal
                           showModal("Wallet Not Found", `<p>The ${walletType} wallet was not detected. Please install the browser extension or mobile app.</p>`);
                           return;
                      }
                       console.log(`Attempting to connect to ${walletType}.`);
                       // Hide the wallet selection modal before attempting connection
                      hideModal(true);


                      try {
                          await connectToWallet(walletType);
                          // Update encrypt button state on successful connection
                          const encryptMessageBtn = document.getElementById('encryptMessageBtn');
                          if (walletConnected && encryptMessageBtn) {
                             encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                             encryptMessageBtn.disabled = false;
                          }
                           console.log("Wallet connection successful.");
                      } catch (error) {
                          console.error(`Failed to connect to ${walletType}:`, error);
                          const walletStatus = document.getElementById('walletStatus');
                          const encryptMessageBtn = document.getElementById('encryptMessageBtn');
                          if (walletStatus) walletStatus.textContent = `Connection Failed: ${error.message || error}`;
                          walletConnected = false;
                          userAddress = null;
                          userPublicKey = null;
                          currentWallet = null;
                           if (encryptMessageBtn) {
                              encryptMessageBtn.textContent = "Connect Wallet First";
                              encryptMessageBtn.disabled = true;
                           }
                          showModal("Connection Error", `<p>Failed to connect to ${walletType}. Please ensure the wallet is installed, unlocked, and supports Signet.</p><p>Details: ${error.message || error}</p>`);
                      }
                  };
                   button.addEventListener('click', newClickHandler);
                   button._clickHandler = newClickHandler; // Store the handler for removal
              });
         } else {
             console.error("Wallet selection modal not found when trying to re-attach listeners.");
         }
    };

     // Handle wallet disconnection (basic example, actual event listeners vary by wallet)
    const handleDisconnect = () => {
        console.log("Wallet disconnected");
        walletConnected = false;
        userAddress = null;
        userPublicKey = null;
        currentWallet = null;
        walletStatus.textContent = 'Wallet Status: Disconnected';
        connectWalletButton.style.display = 'inline-block'; // Show connect button
         encryptMessageBtn.textContent = "Connect Wallet First";
         encryptMessageBtn.disabled = true;
         // Stop monitoring network status if wallet disconnects
         clearInterval(networkStatusInterval);
         networkStatusInterval = null;
        showModal("Wallet Disconnected", "<p>Your wallet has been disconnected.</p>");
         // Clear any wallet-specific state or UI elements
     };


    if (window.bitcoin && window.bitcoin.on) {
         console.log("Adding Bitcoin provider listeners.");
        window.bitcoin.on('accountsChanged', handleDisconnect);
        window.bitcoin.on('networkChanged', handleDisconnect);
         // Check initial connection via this provider if it exists
        checkInitialConnection();
    } else if (window.unisat && window.unisat.on) {
         console.log("Adding Unisat provider listeners.");
        window.unisat.on('accountsChanged', handleDisconnect);
        window.unisat.on('networkChanged', handleDisconnect);
         // Check initial connection via this provider if it exists
        checkInitialConnection(); // Unisat is Sats Connect compatible, check Sats Connect first
    } else if (typeof window.satsconnect !== 'undefined') {
         console.log("Sats Connect API detected. Checking initial connection via Sats Connect.");
         // Sats Connect handles Xverse and Leather generally
         checkInitialConnection();
         // Sats Connect doesn't usually have a global 'on' method for network/account changes,
         // wallet-specific providers exposed via Sats Connect might, or you might rely on polling.
         // Keeping polling logic in startNetworkStatusMonitoring.
    }
    // Add similar listeners for OKX and Leather if their APIs support it and are not covered by Sats Connect

    // Event listener for the Terms and Privacy Policy link in the wallet modal
    const tcppLinkInWalletModal = document.getElementById('tcppLink');
    if (tcppLinkInWalletModal) {
        tcppLinkInWalletModal.addEventListener('click', (e) => {
            e.preventDefault();
             // Hide the wallet modal before showing the T&CP modal
            hideModal(true);
             // Display the Terms and Privacy Policy content
            showModal("Terms and Privacy Policy", "<p>This is a placeholder for Terms of Service and Privacy Policy. In a production application, the full text would be loaded here.</p>");
        });
    }
}

async function checkInitialConnection() {
     console.log("Checking for initial wallet connection.");
     try {
        // Check for Sats Connect first as it can represent multiple wallets
        if (typeof window.satsconnect !== 'undefined') {
            console.log("Attempting Sats Connect wallet_getAccount.");
            const response = await window.satsconnect.request('wallet_getAccount', {
                 addresses: ['ordinals', 'payment']
             });

            if (response.status === 'success' && response.result && response.result.addresses && response.result.addresses.length > 0) {
                 console.log("Initial Sats Connect account found.");
                 // Assume Xverse or Leather if using Sats Connect
                 const walletType = typeof window.BitcoinProvider !== 'undefined' ? 'Xverse' : (typeof window.Leather !== 'undefined' || typeof window.StacksProvider !== 'undefined' ? 'Leather' : 'Unknown');

                const accounts = response.result.addresses;
                userAddress = accounts[0].address || accounts[0].address; // Use .address property
                userPublicKey = accounts[0].publicKey || null; // May not be available for all wallets/methods

                // Find the network
                const paymentAddressInfo = accounts.find(acc => acc.purpose === 'payment');
                let currentNetwork = 'unknown';
                if (paymentAddressInfo && paymentAddressInfo.network) {
                     currentNetwork = paymentAddressInfo.network.toLowerCase();
                }

                 const walletStatus = document.getElementById('walletStatus');
                 const connectWalletButton = document.getElementById('connectWallet');
                 const encryptMessageBtn = document.getElementById('encryptMessageBtn');


                if (currentNetwork !== CONTRACT_CONFIG.network) {
                    if (walletStatus) walletStatus.textContent = `Connected (${walletType}): Wrong network (${currentNetwork.toUpperCase()}).`;
                     promptNetworkSwitch(walletType); // Prompt user to switch
                     // Keep connected state true but indicate wrong network
                     walletConnected = true; // Still connected, just on wrong network
                     if (connectWalletButton) connectWalletButton.style.display = 'none'; // Hide connect button
                     if (encryptMessageBtn) {
                        encryptMessageBtn.textContent = "Wrong Network";
                        encryptMessageBtn.disabled = true;
                     }

                } else {
                     if (walletStatus) walletStatus.textContent = `Connected (${walletType}): ${currentNetwork.toUpperCase()}`;
                     walletConnected = true;
                     if (connectWalletButton) connectWalletButton.style.display = 'none'; // Hide connect button
                     if (encryptMessageBtn) {
                        encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                        encryptMessageBtn.disabled = false;
                     }

                     console.log(`Initial connection found: ${walletType} wallet connected. Address: ${userAddress}, Public Key: ${userPublicKey}`);
                      // Set a placeholder currentWallet for Sats Connect methods
                     currentWallet = {
                         // Simulate methods using satsconnect requests
                         signPsbt: async (psbtHex, options) => {
                             console.log("Using Sats Connect signPsbt");
                             const signResponse = await window.satsconnect.request('wallet_signPsbt', {
                                psbtHex: psbtHex,
                                network: CONTRACT_CONFIG.network,
                                 ...options
                             });
                             if (signResponse.status === 'success') {
                                 return signResponse.result.psbtHex;
                             } else {
                                 throw new Error(signResponse.error || 'PSBT signing failed (Sats Connect).');
                             }
                        },
                         pushTx: async (signedTxHex) => {
                              console.log("Using Sats Connect pushTx");
                              const pushResponse = await window.satsconnect.request('wallet_pushTx', {
                                 txHex: signedTxHex,
                                  network: CONTRACT_CONFIG.network
                              });
                              if (pushResponse.status === 'success') {
                                  return pushResponse.result.txId;
                              } else {
                                   throw new Error(pushResponse.error || 'Transaction push failed (Sats Connect).');
                              }
                         },
                          // Add other simulated methods if needed, e.g., getNetwork, requestAccounts
                         getNetwork: async () => ({ network: currentNetwork }), // Simulate getNetwork
                         requestAccounts: async () => accounts.map(acc => acc.address), // Simulate requestAccounts
                     };
                      startNetworkStatusMonitoring(); // Start monitoring
                }
            } else {
                console.log("No initial Sats Connect account found.");
                 // If Sats Connect didn't find an account, check other specific providers if necessary
                 // Note: Unisat might expose window.unisat even if Sats Connect fails, or vice versa.
                 // The logic flow for checking providers can be complex depending on how they inject themselves.
                 // The current structure attempts Sats Connect, then relies on button click for others if Sats Connect doesn't connect initially.
            }
        } else {
            console.log("Sats Connect API not detected.");
            // Fallback to checking other providers directly if Sats Connect is not available
            // This might be redundant if Sats Connect is the primary intended method for Xverse/Leather.
            // Re-evaluate if direct checks for window.BitcoinProvider or window.Leather are truly needed
            // or if Sats Connect is the intended single point of interaction for them.
        }
     } catch (error) {
         console.warn("Error during initial Sats Connect wallet connection check:", error);
         // This catch block handles errors during the *check* itself (e.g., API not ready),
         // not necessarily that a wallet isn't connected.
     }
}


function checkWalletsAvailability() {
    console.log("Checking wallet availability.");
    const walletSelectionModal = document.getElementById('walletSelectionModal');
     if (!walletSelectionModal) {
         console.error("walletSelectionModal not found in checkWalletsAvailability.");
         return;
     }
    const walletOptions = walletSelectionModal.querySelectorAll('.wallet-option');
    const walletAvailabilityMessage = document.getElementById('walletAvailabilityMessage');
    const walletSelectInstruction = document.getElementById('walletSelectInstruction');

    if (!walletOptions.length || !walletAvailabilityMessage || !walletSelectInstruction) {
         console.error("Wallet option buttons, availability message, or instruction element not found in wallet modal body.");
         // This is a critical structural issue in index.html
         return;
    }

     let walletsFound = 0;

     // Unisat (uses window.unisat)
     if (typeof window.unisat !== 'undefined') {
         document.querySelector('.wallet-option[data-wallet="unisat"]').classList.remove('unavailable');
         document.querySelector('.wallet-option[data-wallet="unisat"]').classList.add('available');
         document.querySelector('.wallet-option[data-wallet="unisat"]').style.display = 'flex';
         walletsFound++;
         console.log("Unisat detected.");
     } else {
          document.querySelector('.wallet-option[data-wallet="unisat"]').classList.remove('available');
          document.querySelector('.wallet-option[data-wallet="unisat"]').classList.add('unavailable');
          document.querySelector('.wallet-option[data-wallet="unisat"]').style.display = 'none';
           console.log("Unisat not detected.");
     }

     // Xverse (uses window.BitcoinProvider) - check Sats Connect compatibility
     if (typeof window.BitcoinProvider !== 'undefined') {
        document.querySelector('.wallet-option[data-wallet="xverse"]').classList.remove('unavailable');
        document.querySelector('.wallet-option[data-wallet="xverse"]').classList.add('available');
        document.querySelector('.wallet-option[data-wallet="xverse"]').style.display = 'flex';
         walletsFound++;
          console.log("Xverse (via BitcoinProvider) detected.");
     } else {
        document.querySelector('.wallet-option[data-wallet="xverse"]').classList.remove('available');
        document.querySelector('.wallet-option[data-wallet="xverse"]').classList.add('unavailable');
        document.querySelector('.wallet-option[data-wallet="xverse"]').style.display = 'none';
         console.log("Xverse (via BitcoinProvider) not detected.");
     }

     // OKX (uses window.okxwallet.bitcoin)
     if (typeof window.okxwallet !== 'undefined' && typeof window.okxwallet.bitcoin !== 'undefined') {
          document.querySelector('.wallet-option[data-wallet="okx"]').classList.remove('unavailable');
          document.querySelector('.wallet-option[data-wallet="okx"]').classList.add('available');
          document.querySelector('.wallet-option[data-wallet="okx"]').style.display = 'flex';
         walletsFound++;
         console.log("OKX detected.");
     } else {
        document.querySelector('.wallet-option[data-wallet="okx"]').classList.remove('available');
        document.querySelector('.wallet-option[data-wallet="okx"]').classList.add('unavailable');
        document.querySelector('.wallet-option[data-wallet="okx"]').style.display = 'none';
         console.log("OKX not detected.");
     }

     // Leather (uses window.Leather or window.StacksProvider) - check Sats Connect compatibility
      if (typeof window.Leather !== 'undefined' || typeof window.StacksProvider !== 'undefined') {
         document.querySelector('.wallet-option[data-wallet="leather"]').classList.remove('unavailable');
         document.querySelector('.wallet-option[data-wallet="leather"]').classList.add('available');
         document.querySelector('.wallet-option[data-wallet="leather"]').style.display = 'flex';
         walletsFound++;
         console.log("Leather detected.");
      } else {
         document.querySelector('.wallet-option[data-wallet="leather"]').classList.remove('available');
         document.querySelector('.wallet-option[data-wallet="leather"]').classList.add('unavailable');
         document.querySelector('.wallet-option[data-wallet="leather"]').style.display = 'none';
         console.log("Leather not detected.");
      }

     console.log(`Wallets found: ${walletsFound}`);

     if (walletsFound === 0) {
         walletSelectInstruction.style.display = 'none'; // Hide the instruction
         walletAvailabilityMessage.style.display = 'block'; // Show the "No Wallets Found" message
         console.log("No wallets found, showing message.");
     } else {
         walletSelectInstruction.style.display = 'block'; // Show the instruction
         walletAvailabilityMessage.style.display = 'none'; // Hide the "No Wallets Found" message
          console.log("Wallets found, showing options.");
     }
}


async function connectToWallet(walletType) {
    const walletStatus = document.getElementById('walletStatus');
     if (walletStatus) walletStatus.textContent = `Connecting to ${walletType}...`;
     console.log(`Attempting connection to ${walletType}...`);


    try {
        let accounts = [];
        let currentNetwork = { network: 'unknown' };
         let walletInstance = null; // Store the actual wallet API object


        if (walletType === 'unisat' && typeof window.unisat !== 'undefined') {
            walletInstance = window.unisat;
            accounts = await walletInstance.requestAccounts();
            currentNetwork = await walletInstance.getNetwork();
            currentWallet = walletInstance; // Set currentWallet to the actual provider

        } else if (walletType === 'xverse' && typeof window.BitcoinProvider !== 'undefined' && typeof window.satsconnect !== 'undefined') {
             // Sats Connect for Xverse
             console.log("Using Sats Connect for Xverse connection.");
             const response = await window.satsconnect.request('wallet_connect', {
                addresses: ['ordinals', 'payment'],
                network: CONTRACT_CONFIG.network // Request Signet network
            });

            if (response.status === 'success') {
                accounts = response.result.addresses;
                 const paymentAddressInfo = accounts.find(acc => acc.purpose === 'payment');
                 if (paymentAddressInfo && paymentAddressInfo.network) {
                      currentNetwork = { network: paymentAddressInfo.network.toLowerCase() };
                 } else {
                      throw new Error("Could not retrieve network information from Xverse (Sats Connect).");
                 }
                 // Set currentWallet to use simulated Sats Connect methods
                 currentWallet = {
                    requestAccounts: async () => accounts.map(acc => acc.address),
                    getNetwork: async () => currentNetwork,
                    signPsbt: async (psbtHex, options) => {
                         console.log("Using Sats Connect signPsbt for Xverse");
                         const signResponse = await window.satsconnect.request('wallet_signPsbt', {
                            psbtHex: psbtHex,
                            network: CONTRACT_CONFIG.network,
                             ...options // Pass options like autoFinalized, etc.
                         });
                         if (signResponse.status === 'success') {
                             return signResponse.result.psbtHex;
                         } else {
                             throw new Error(signResponse.error || 'PSBT signing failed in Xverse (Sats Connect).');
                         }
                    },
                     pushTx: async (signedTxHex) => {
                         console.log("Using Sats Connect pushTx for Xverse");
                         const pushResponse = await window.satsconnect.request('wallet_pushTx', {
                            txHex: signedTxHex,
                             network: CONTRACT_CONFIG.network // Specify network for push
                         });
                         if (pushResponse.status === 'success') {
                             return pushResponse.result.txId;
                         } else {
                              throw new Error(pushResponse.error || 'Transaction push failed in Xverse (Sats Connect).');
                         }
                     }
                 };

            } else {
                throw new Error(response.error || 'Xverse connection failed (Sats Connect).');
            }

        } else if (walletType === 'okx' && typeof window.okxwallet !== 'undefined' && typeof window.okxwallet.bitcoin !== 'undefined') {
            walletInstance = window.okxwallet.bitcoin;
             console.log("Using OKX wallet API.");
            // OKX connect might return an object with address and publicKey directly
             const connectResult = await walletInstance.connect();
             if (connectResult && connectResult.address) {
                 accounts = [connectResult]; // Format to match other wallets
             } else {
                  throw new Error("OKX wallet connection did not return address.");
             }

             // Check network after connecting
            currentNetwork = await walletInstance.getNetwork(); // OKX might have getNetwork or similar
            currentWallet = walletInstance; // Set currentWallet to the actual provider

        } else if (walletType === 'leather' && (typeof window.Leather !== 'undefined' || typeof window.StacksProvider !== 'undefined') && typeof window.satsconnect !== 'undefined') {
            // Attempt Sats Connect for Leather first
            try {
                 console.log("Using Sats Connect for Leather connection.");
                 const response = await window.satsconnect.request('wallet_connect', {
                    addresses: ['ordinals', 'payment'],
                    network: CONTRACT_CONFIG.network // Request Signet network
                });

                if (response.status === 'success') {
                    accounts = response.result.addresses;
                     const paymentAddressInfo = accounts.find(acc => acc.purpose === 'payment');
                    if (paymentAddressInfo && paymentAddressInfo.network) {
                         currentNetwork = { network: paymentAddressInfo.network.toLowerCase() };
                    } else {
                         throw new Error("Could not retrieve network information from Leather (Sats Connect).");
                    }
                    // Set currentWallet to use simulated Sats Connect methods
                    currentWallet = {
                         requestAccounts: async () => accounts.map(acc => acc.address),
                         getNetwork: async () => currentNetwork,
                         signPsbt: async (psbtHex, options) => {
                              console.log("Using Sats Connect signPsbt for Leather");
                             const signResponse = await window.satsconnect.request('wallet_signPsbt', {
                                psbtHex: psbtHex,
                                network: CONTRACT_CONFIG.network,
                                 ...options // Pass options
                             });
                              if (signResponse.status === 'success') {
                                 return signResponse.result.psbtHex;
                             } else {
                                 throw new Error(signResponse.error || 'PSBT signing failed in Leather (Sats Connect).');
                             }
                        },
                         pushTx: async (signedTxHex) => {
                              console.log("Using Sats Connect pushTx for Leather");
                             const pushResponse = await window.satsconnect.request('wallet_pushTx', {
                                txHex: signedTxHex,
                                 network: CONTRACT_CONFIG.network
                             });
                             if (pushResponse.status === 'success') {
                                 return pushResponse.result.txId;
                             } else {
                                  throw new Error(pushResponse.error || 'Transaction push failed in Leather (Sats Connect).');
                             }
                         }
                    };

                } else {
                     throw new Error(response.error || 'Leather connection failed (Sats Connect).');
                }

            } catch (satsConnectError) {
                 console.warn("Sats Connect failed for Leather, trying Leather specific API if available:", satsConnectError);
                 // Fallback to Leather specific API if Sats Connect fails or is not the preferred method
                 if (typeof window.Leather !== 'undefined' && window.Leather.requestAccounts) {
                     walletInstance = window.Leather;
                      console.log("Using Leather native API.");
                     accounts = await walletInstance.requestAccounts(); // Leather's own API might return simpler array of addresses
                     // Leather might not have a getNetwork method directly accessible in the same way
                     // Assume success and check network status later or rely on promptNetworkSwitch
                      currentNetwork = { network: 'unknown' }; // Default to unknown, will be checked/prompted
                      currentWallet = walletInstance; // Set currentWallet to the actual provider

                      // Bind native API methods if they exist
                     if (walletInstance.signPsbt) {
                         currentWallet.signPsbt = walletInstance.signPsbt.bind(walletInstance);
                     } else {
                          console.warn("Leather native API signPsbt method not found.");
                     }
                      if (walletInstance.pushTx) {
                         currentWallet.pushTx = walletInstance.pushTx.bind(walletInstance);
                      } else {
                           console.warn("Leather native API pushTx method not found.");
                      }

                 } else {
                      throw new Error(`Leather wallet not found or connection failed. Details: ${satsConnectError.message || satsConnectError}`);
                 }
            }

        } else {
             console.error(`Wallet provider for ${walletType} not found or supported API not available.`);
            throw new Error(`Wallet provider for ${walletType} not found or supported API not available.`);
        }

        if (!accounts || accounts.length === 0) {
            console.error("No accounts found after connecting.");
            throw new Error("No accounts found or connected.");
        }

        // Assuming the first account is the desired one
        userAddress = accounts[0].address || accounts[0]; // Use .address property if available, fallback to the item itself
        userPublicKey = accounts[0].publicKey || null; // May not be available for all wallets/methods

         console.log(`Connected account: ${userAddress}, Network: ${currentNetwork.network}`);

        if (currentNetwork.network !== CONTRACT_CONFIG.network) {
             const walletStatus = document.getElementById('walletStatus');
             const encryptMessageBtn = document.getElementById('encryptMessageBtn');
            if (walletStatus) walletStatus.textContent = `Connected (${walletType}): Wrong network (${currentNetwork.network.toUpperCase()}).`;
            console.warn(`Wallet connected to wrong network: ${currentNetwork.network}. Prompting switch.`);

             // Attempt to switch network if supported by wallet API or guide user
             const switchConfirmed = await promptNetworkSwitch(walletType);
             if (!switchConfirmed) {
                 // User did not confirm switch, disconnect or show error?
                 // For now, throw an error forcing manual switch
                 console.error("User did not confirm network switch.");
                 // Set status message indicating wrong network and disabled state
                 if (walletStatus) walletStatus.textContent = `Connected (${walletType}): Wrong network (${currentNetwork.network.toUpperCase()}). MANUAL SWITCH REQUIRED.`;
                 if (encryptMessageBtn) {
                     encryptMessageBtn.textContent = "Wrong Network";
                     encryptMessageBtn.disabled = true;
                 }
                 walletConnected = true; // Still technically connected but unusable
                 throw new Error(`Please manually switch your ${walletType} to Bitcoin ${CONTRACT_CONFIG.network.toUpperCase()} to proceed.`);
             }
             console.log("User confirmed network switch.");
             // Re-check network after switch attempt (if wallet API supports it)
             let networkAfterSwitch = currentNetwork; // Assume current network if getNetwork is not available
             if (currentWallet && currentWallet.getNetwork) {
                  try {
                     networkAfterSwitch = await currentWallet.getNetwork();
                      console.log(`Network after switch attempt: ${networkAfterSwitch.network}`);
                  } catch (getNetworkError) {
                      console.warn("Failed to get network after switch attempt:", getNetworkError);
                  }
             }

             if (networkAfterSwitch.network !== CONTRACT_CONFIG.network) {
                  console.error(`Network is still incorrect after switch attempt: ${networkAfterSwitch.network}`);
                   // Still on wrong network after prompt/switch attempt
                  if (walletStatus) walletStatus.textContent = `Connected (${walletType}): Wrong network (${networkAfterSwitch.network.toUpperCase()}). MANUAL SWITCH REQUIRED.`;
                  if (encryptMessageBtn) {
                      encryptMessageBtn.textContent = "Wrong Network";
                      encryptMessageBtn.disabled = true;
                  }
                   walletConnected = true; // Still connected but unusable
                   throw new Error(`Failed to switch ${walletType} to Bitcoin ${CONTRACT_CONFIG.network.toUpperCase()}. Please switch manually.`);
             } else {
                  console.log("Network switch successful or confirmed manually.");
                  // Network is correct now
                  if (walletStatus) walletStatus.textContent = `Connected (${walletType}): ${CONTRACT_CONFIG.network.toUpperCase()}`;
                 walletConnected = true; // Confirm connected and on correct network
                 const connectWalletButton = document.getElementById('connectWallet');
                 if (connectWalletButton) connectWalletButton.style.display = 'none'; // Hide connect button on success
                 if (encryptMessageBtn) {
                     encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                     encryptMessageBtn.disabled = false;
                 }
                 console.log(`${walletType} wallet connected and on correct network.`);
                 startNetworkStatusMonitoring(); // Start monitoring the now correct network
                 return; // Exit successfully after manual switch confirmation and re-check
             }
        } else {
             // Network is correct from the start
             const walletStatus = document.getElementById('walletStatus');
             const connectWalletButton = document.getElementById('connectWallet');
             const encryptMessageBtn = document.getElementById('encryptMessageBtn');
            if (walletStatus) walletStatus.textContent = `Connected (${walletType}): ${currentNetwork.network.toUpperCase()}`;
            walletConnected = true;
            if (connectWalletButton) connectWalletButton.style.display = 'none'; // Hide connect button on success
             if (encryptMessageBtn) {
                 encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                 encryptMessageBtn.disabled = false;
             }
            console.log(`${walletType} wallet connected successfully on correct network.`);

             // Start monitoring network status if wallet supports events or polling
             startNetworkStatusMonitoring();
        }


    } catch (error) {
        console.error("Wallet connection error:", error);
        const walletStatus = document.getElementById('walletStatus');
        const connectWalletButton = document.getElementById('connectWallet');
        const encryptMessageBtn = document.getElementById('encryptMessageBtn');

        if (walletStatus) walletStatus.textContent = `Connection Failed: ${error.message || error}`;
        walletConnected = false;
        userAddress = null;
        userPublicKey = null;
        currentWallet = null; // Clear the wallet instance on failure
        if (connectWalletButton) connectWalletButton.style.display = 'inline-block'; // Show connect button on failure
         if (encryptMessageBtn) {
             encryptMessageBtn.textContent = "Connect Wallet First";
             encryptMessageBtn.disabled = true;
         }
        showModal("Connection Error", `<p>Failed to connect wallet.</p><p>Details: ${error.message || error}</p>`);
        throw error; // Re-throw to be caught by the button's catch block if needed
    }
}

async function promptNetworkSwitch(walletType) {
     console.log("Prompting network switch.");
     return new Promise((resolve) => {
        const modalTitle = "Switch Network";
        const modalBody = `<p>Your wallet is currently on the wrong network. Please switch to <strong>Bitcoin ${CONTRACT_CONFIG.network.toUpperCase()}</strong> in your ${walletType} wallet.</p>
                           <p>Instructions for switching:</p>
                           <ul>
                               <li><strong>Unisat:</strong> Click the network icon in the top-right -> Select "Bitcoin Testnet, Signet".</li>
                               <li><strong>Xverse:</strong> Go to Settings -> Network -> Choose "Bitcoin Testnet".</li>
                               <li><strong>OKX:</strong> Go to Settings -> Network -> Choose "Bitcoin Testnet".</li>
                               <li><strong>Leather:</strong> Click the network selector -> Choose "Signet".</li>
                           </ul>
                           <p>Click "I Switched" after changing the network in your wallet.</p>`;

        // Use the regular modal for network switch prompt
        showModal(modalTitle, modalBody, false);

        const modalOverlay = document.getElementById('modalOverlay');
        // Find the default OK button
        const modalOkButton = modalOverlay.querySelector('.modal-footer .btn-primary');
        const modalCloseButton = modalOverlay.querySelector('.modal-close');
        const modalFooter = modalOverlay.querySelector('.modal-footer');


        // Hide the default OK button
        if (modalOkButton && modalOkButton.id === 'modalOk') {
             modalOkButton.style.display = 'none';
        }


        // Create a temporary button for user confirmation of switch
        const confirmSwitchButton = document.createElement('button');
        confirmSwitchButton.textContent = 'I Switched';
        confirmSwitchButton.classList.add('btn', 'btn-primary'); // Add styling classes
         confirmSwitchButton.style.marginLeft = '10px'; // Ensure spacing


         // Remove any previously added 'I Switched' buttons to avoid duplicates
         const existingConfirmButton = modalFooter ? modalFooter.querySelector('.btn-primary[data-confirm-switch]') : null;
         if (existingConfirmButton) {
             existingConfirmButton.remove();
         }
         confirmSwitchButton.setAttribute('data-confirm-switch', 'true'); // Mark this button
         if (modalFooter) {
             // Add the confirm button to the footer
             modalFooter.appendChild(confirmSwitchButton);
         } else {
             console.error("Modal footer not found for adding switch confirmation button.");
         }


        // Remove existing listener before adding a new one
         const oldConfirmHandler = confirmSwitchButton._confirmHandler;
         if (oldConfirmHandler) {
             confirmSwitchButton.removeEventListener('click', oldConfirmHandler);
         }
        const newConfirmHandler = () => {
             hideModal();
            confirmSwitchButton.remove(); // Clean up the temporary button
            resolve(true); // User confirmed they switched
             console.log("Network switch confirmed by user.");
        };
        confirmSwitchButton.addEventListener('click', newConfirmHandler);
         confirmSwitchButton._confirmHandler = newConfirmHandler; // Store for removal


         // If user closes the modal without confirming switch
         // We need to ensure the close handler doesn't conflict with the modal's default close logic
         // The showModal function already sets up the close handler for the modalClose button and overlay click.
         // We just need to ensure closing *this specific prompt* resolves the promise.
         // Modify the existing close handler attached by showModal to also resolve false.

        const resolveFalseAndCleanUp = () => {
             confirmSwitchButton.remove(); // Clean up the temporary button
             resolve(false); // User did not confirm switch
             console.log("Network switch prompt closed by user.");
              // Re-enable the default OK button if it was hidden
             if (modalOkButton && modalOkButton.id === 'modalOk') {
                 modalOkButton.style.display = 'inline-block';
             }
         };

         // Override the close handler set by showModal temporarily
         const originalModalCloseHandler = modalClose.onclick; // Get the handler set by showModal
         modalClose.onclick = () => {
              originalModalCloseHandler(); // Run the original close logic
              resolveFalseAndCleanUp(); // Then resolve the promise and clean up
         };

         const originalOverlayClickHandler = modalOverlay._overlayClickHandler; // Get the handler set by showModal
         modalOverlay._overlayClickHandler = (e) => {
             if (e.target === modalOverlay) {
                  originalOverlayClickHandler(e); // Run the original overlay close logic
                  resolveFalseAndCleanUp(); // Then resolve the promise and clean up
             }
         };

    });
}


function startNetworkStatusMonitoring() {
     console.log("Starting network status monitoring.");
     // Clear any existing interval
    if (networkStatusInterval) clearInterval(networkStatusInterval);

    // Poll the wallet's network status periodically (if getNetwork is available)
    if (currentWallet && currentWallet.getNetwork) {
         networkStatusInterval = setInterval(async () => {
            try {
                const network = await currentWallet.getNetwork();
                const walletStatus = document.getElementById('walletStatus');
                 const encryptMessageBtn = document.getElementById('encryptMessageBtn');
                 // Attempt to get a cleaner wallet name
                 const walletTypeName = currentWallet.constructor.name.replace('Provider', '').replace('Bitcoin', '').trim() || (currentWallet._brand ? currentWallet._brand.name : 'Wallet'); // Use _brand for Sats Connect simulation
                if (network.network !== CONTRACT_CONFIG.network) {
                    if (walletStatus) walletStatus.textContent = `Connected (${walletTypeName}): Wrong network (${network.network.toUpperCase()}).`;
                     if (encryptMessageBtn) {
                          encryptMessageBtn.textContent = "Wrong Network";
                          encryptMessageBtn.disabled = true;
                      }
                     // Optionally, prompt network switch again, but avoid excessive prompts
                     // promptNetworkSwitch(walletTypeName); // Avoid prompting automatically in polling
                } else {
                     if (walletStatus) walletStatus.textContent = `Connected (${walletTypeName}): ${network.network.toUpperCase()}`;
                      if (walletConnected && encryptMessageBtn && encryptMessageBtn.textContent !== "Encrypt & Generate Transaction") {
                         // If connected, on the correct network, and button state is not 'Encrypt', update it
                          const messageInput = document.getElementById('message');
                          const text = messageInput ? messageInput.value : '';
                          const characters = text.length;
                          const bytes = new TextEncoder().encode(text).length;

                           if (characters <= 150 && bytes <= 80 && text.trim() !== '') {
                               encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                               encryptMessageBtn.disabled = false;
                           } else {
                                // Re-evaluate based on message state if needed, or just re-enable
                                encryptMessageBtn.disabled = false; // Re-enable if on correct network and message valid
                           }
                      } else if (walletConnected && encryptMessageBtn && encryptMessageBtn.disabled) {
                           // If on correct network and button is disabled, check message constraints
                           const messageInput = document.getElementById('message');
                           const text = messageInput ? messageInput.value : '';
                           const characters = text.length;
                           const bytes = new TextEncoder().encode(text).length;
                            if (characters <= 150 && bytes <= 80 && text.trim() !== '') {
                                encryptMessageBtn.disabled = false;
                                encryptMessageBtn.textContent = "Encrypt & Generate Transaction";
                            }
                      }
                }
            } catch (error) {
                console.error("Failed to get network status during monitoring:", error);
                 // Handle cases where wallet becomes unavailable
                 if (walletConnected) {
                    document.getElementById('walletStatus').textContent = 'Wallet Status: Connection Lost';
                    walletConnected = false;
                     userAddress = null;
                     userPublicKey = null;
                     currentWallet = null;
                    document.getElementById('connectWallet').style.display = 'inline-block';
                     document.getElementById('encryptMessageBtn').textContent = "Connect Wallet First";
                     document.getElementById('encryptMessageBtn').disabled = true;
                    clearInterval(networkStatusInterval); // Stop monitoring
                    networkStatusInterval = null;
                    showModal("Wallet Disconnected", "<p>Your wallet connection was lost.</p>");
                 }
            }
        }, 10000); // Check every 10 seconds
    } else {
        console.warn("Current wallet does not support getNetwork method. Network status will not be actively monitored.");
         // Display connected status without network details if getNetwork is not available
         const walletStatus = document.getElementById('walletStatus');
          const walletTypeName = currentWallet ? (currentWallet.constructor.name.replace('Provider', '').replace('Bitcoin', '').trim() || (currentWallet._brand ? currentWallet._brand.name : 'Unknown Wallet')) : 'Unknown';
         if (walletStatus) walletStatus.textContent = `Connected (via ${walletTypeName})`;
    }
}


// Carousel Auto-slide and Navigation
function initCarousel() {
    console.log("Initializing carousel.");
    const carousel = document.getElementById('twitterCarousel');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const indicatorsContainer = document.getElementById('carouselIndicators');
     const carouselSlidesContainer = carousel ? carousel.querySelector('.carousel-slides') : null;


    if (!carousel || !prevBtn || !nextBtn || !indicatorsContainer || !carouselSlidesContainer) {
        console.error("Carousel elements not found for initialization.");
        return;
    }

    let currentSlide = 0;
    const slides = carouselSlidesContainer.querySelectorAll('.carousel-slide');
    const totalSlides = slides.length;

    if (totalSlides === 0) {
        console.warn("No carousel slides found.");
        // Hide carousel controls if no slides
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        indicatorsContainer.style.display = 'none';
        return;
    } else if (totalSlides === 1) {
         // If only one slide, hide navigation and indicators
         prevBtn.style.display = 'none';
         nextBtn.style.display = 'none';
         indicatorsContainer.style.display = 'none';
    } else {
         // Ensure controls are visible if there's more than one slide
         prevBtn.style.display = 'flex'; // Use flex because they are flex items
         nextBtn.style.display = 'flex';
         indicatorsContainer.style.display = 'flex';
    }


    // Ensure correct width for slides and container
     // Set container width to accommodate all slides side-by-side
    carouselSlidesContainer.style.width = `${totalSlides * 100}%`;
     // Set individual slide width to be 100% of the viewport/container width
    slides.forEach(slide => {
        slide.style.width = `${100 / totalSlides}%`; // Each slide takes up 1/totalSlides of the container width
    });


    // Create indicators if not already present or count is wrong
    const existingIndicators = indicatorsContainer.querySelectorAll('.carousel-indicator');
    if (existingIndicators.length !== totalSlides) {
         indicatorsContainer.innerHTML = ''; // Clear existing if count is wrong
        for (let i = 0; i < totalSlides; i++) {
            const indicator = document.createElement('div');
            indicator.classList.add('carousel-indicator');
            indicator.setAttribute('data-slide', i);
            indicatorsContainer.appendChild(indicator);
        }
    }
     const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');


    function goToSlide(slideIndex) {
        // Handle wrapping
        if (slideIndex < 0) {
            slideIndex = totalSlides - 1;
        } else if (slideIndex >= totalSlides) {
            slideIndex = 0;
        }

        currentSlide = slideIndex;
        // Transform the container to show the current slide
        carouselSlidesContainer.style.transform = `translateX(-${currentSlide * (100 / totalSlides)}%)`;

        // Update indicators
         if (indicators.length > 0) {
             indicators.forEach((indicator, index) => {
                 if (index === currentSlide) {
                     indicator.classList.add('active');
                 } else {
                     indicator.classList.remove('active');
                 }
             });
         }
    }

    // Add event listeners only if there's more than one slide
    if (totalSlides > 1) {
         prevBtn.addEventListener('click', () => {
            goToSlide(currentSlide - 1);
             resetAutoSlide(); // Reset timer on manual navigation
        });

        nextBtn.addEventListener('click', () => {
            goToSlide(currentSlide + 1);
             resetAutoSlide(); // Reset timer on manual navigation
        });

        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                goToSlide(index);
                 resetAutoSlide(); // Reset timer on manual navigation
            });
        });

        function startAutoSlide() {
             // Clear any existing auto-slide interval
             if (carouselAutoSlideInterval) clearInterval(carouselAutoSlideInterval);

             carouselAutoSlideInterval = setInterval(() => {
                goToSlide(currentSlide + 1);
            }, 5000); // Change slide every 5 seconds
        }

         function resetAutoSlide() {
             startAutoSlide(); // Stop current interval and start a new one
         }

        // Start auto-slide on initialization
        startAutoSlide();
    }


    // Initialize to the first slide
    goToSlide(0);

    // Copy tweet button logic
    document.querySelectorAll('.copy-tweet-btn').forEach(button => {
        // Remove existing listeners before adding to prevent duplicates on re-init if any
         const oldCopyHandler = button._copyHandler;
         if (oldCopyHandler) {
             button.removeEventListener('click', oldCopyHandler);
         }

        const newCopyHandler = async () => {
            const tweetText = button.getAttribute('data-tweet');
            try {
                await navigator.clipboard.writeText(tweetText);
                // Show a "Copied!" message next to the button
                const confirmation = document.createElement('span');
                confirmation.textContent = 'Copied!';
                confirmation.classList.add('copy-confirmation-inline'); // Use a specific class for styling
                button.parentNode.appendChild(confirmation);
                setTimeout(() => {
                    confirmation.remove();
                }, 2000); // Remove after 2 seconds
            } catch (err) {
                console.error('Failed to copy tweet text: ', err);
                showModal("Copy Error", "<p>Failed to copy tweet text to clipboard. Please try manually.</p>");
            }
        };
         button.addEventListener('click', newCopyHandler);
         button._copyHandler = newCopyHandler; // Store for removal
    });
     console.log("Carousel initialized.");
}


// Message Input Character and Byte Counter
function initMessageInput() {
    console.log("Initializing message input.");
    const messageInput = document.getElementById('message');
    const charCount = document.getElementById('charCount');
    const byteCount = document.getElementById('byteCount');
    const encryptButton = document.getElementById('encryptMessageBtn');
    const encryptionResultDiv = document.getElementById('encryptionResult'); // Get the encryption result div


    if (!messageInput || !charCount || !byteCount || !encryptButton || !encryptionResultDiv) {
        console.error("Message input or related elements not found.");
        return;
    }

     // Initially hide the encryption result section
     encryptionResultDiv.style.display = 'none';


    messageInput.addEventListener('input', () => {
        const text = messageInput.value;
        const characters = text.length;
        const bytes = new TextEncoder().encode(text).length; // Calculate bytes for UTF-8

        charCount.textContent = characters;
        byteCount.textContent = bytes;

        // Update colors if over limits
         if (characters > 150) {
             charCount.style.color = 'var(--color-error)'; // Red
         } else {
             charCount.style.color = 'var(--color-text-secondary)'; // Default color
         }
        if (bytes > 80) {
             byteCount.style.color = 'var(--color-error)'; // Red
        } else {
             byteCount.style.color = 'var(--color-text-secondary)'; // Default color
        }


        // Disable button if over limits or wallet not connected or message is empty
        // Use the updateEncryptButtonState function for consistency
        updateEncryptButtonState();

         // Hide encryption result if message is being edited
         encryptionResultDiv.style.display = 'none';
         document.getElementById('signTransaction').style.display = 'none';
    });

     // Function to update the state of the encrypt button
     const updateEncryptButtonState = () => {
        const text = messageInput.value.trim(); // Use trimmed value for empty check
        const characters = text.length;
        const bytes = new TextEncoder().encode(text).length;

        if (characters > 150 || bytes > 80 || !walletConnected || text === '') {
            encryptButton.disabled = true;
            if (!walletConnected) {
                encryptButton.textContent = "Connect Wallet First";
            } else if (text === '') {
                 encryptButton.textContent = "Enter Message";
            }
            else {
               encryptButton.textContent = "Message Too Long";
            }
        } else {
            encryptButton.disabled = false;
            encryptButton.textContent = "Encrypt & Generate Transaction";
        }
     };

     // Initial check on page load
     updateEncryptButtonState();


     // Ensure encrypt button state updates with wallet connection status
     // Use a MutationObserver on walletStatus to detect text changes (connected/disconnected)
     const walletStatusObserver = new MutationObserver(updateEncryptButtonState);
     const walletStatusElement = document.getElementById('walletStatus');
     if (walletStatusElement) {
         walletStatusObserver.observe(walletStatusElement, { childList: true, subtree: true });
     } else {
         console.error("walletStatus element not found for observer.");
     }


    // Set up the click handler for the encrypt button
     // Remove existing listener before adding to prevent duplicates on re-init if any
      const oldEncryptHandler = encryptButton._encryptHandler;
      if (oldEncryptHandler) {
          encryptButton.removeEventListener('click', oldEncryptHandler);
      }
     const newEncryptHandler = encryptMessage;
      encryptButton.addEventListener('click', newEncryptHandler);
      encryptButton._encryptHandler = newEncryptHandler; // Store for removal

     console.log("Message input initialized.");
}

// Modal Handlers
function initModalHandlers() {
    console.log("Initializing modal handlers.");
    const modalOverlay = document.getElementById('modalOverlay');
    const walletSelectionModal = document.getElementById('walletSelectionModal');

     // Close modals when clicking outside - Handled within showModal function now
    // Close modals when clicking the close button - Handled within showModal function now
    // Close the main modal when clicking OK - Handled within showModal function now

    // Handle Terms and Privacy Policy Link in Wallet Modal - Event listener moved to initWalletConnection
     console.log("Modal handlers initialized.");
}

// Block Height and Countdown Logic
function initBlockHeightAndCountdown() {
    console.log("Initializing block height and countdown.");
    // This is a placeholder. In a real application, you would fetch the current block height
    // and calculate the countdown based on the target unlock block height.
    // You would need an API for this (e.g., mempool.space API).

    const currentBlockHeightElement = document.getElementById('currentBlockHeight');
    const unlockBlockHeightElement = document.getElementById('unlockBlockHeight');
    const progressBar = document.getElementById('progressBar');
    const blockStatus = document.getElementById('blockStatus');


     if (!currentBlockHeightElement || !unlockBlockHeightElement || !progressBar || !blockStatus) {
         console.error("Block height or countdown elements not found.");
         return;
     }

    const unlockBlock = parseInt(unlockBlockHeightElement.textContent, 10);
    let currentBlock = 0; // Placeholder

     // Function to fetch current block height (example using a hypothetical API)
     async function fetchCurrentBlockHeight() {
         try {
             // Replace with actual API call (e.g., fetch('https://mempool.space/api/blocks/tip/height'))
             // For now, we'll simulate a block height increase
             // const response = await fetch('https://api.example.com/currentblock'); // Replace with a real API endpoint
             // if (!response.ok) {
             //     throw new Error(`API error: ${response.status}`);
             // }
             // const data = await response.json();
             // currentBlock = data.height; // Adjust based on actual API response structure

              // Simulate block height increase for demo
              // Start well below unlock block on initial load if it's still default 'Loading...'
             const initialSimulatedBlock = 263000; // Start at a block well before unlock height
             let currentBlockText = currentBlockHeightElement.textContent;

             // Check if the current text is 'Loading...' or not a number
             if (currentBlockText === 'Loading...' || isNaN(parseInt(currentBlockText, 10))) {
                  currentBlock = initialSimulatedBlock;
             } else {
                 currentBlock = parseInt(currentBlockText, 10);
                  // Simulate increase, but cap at unlockBlock to avoid exceeding it prematurely by simulation
                  currentBlock += Math.floor(Math.random() * 5) + 1; // Simulate 1-5 new blocks per update
                  currentBlock = Math.min(currentBlock, unlockBlock); // Cap at unlock block
             }


             currentBlockHeightElement.textContent = currentBlock;
             updateBlockStatus();
         } catch (error) {
             console.error("Failed to fetch current block height:", error);
             currentBlockHeightElement.textContent = 'Error';
             blockStatus.innerHTML = '<p class="status-text">Failed to load block status.</p>';
             blockStatus.className = 'status-indicator error';
              // Stop countdown if block height fetching fails
            if (countdownInterval) clearInterval(countdownInterval);
             countdownInterval = null;
         }
     }

    function updateBlockStatus() {
         console.log(`Updating block status. Current block: ${currentBlock}, Unlock block: ${unlockBlock}`);
        const blocksRemaining = unlockBlock - currentBlock;
         const blockStatus = document.getElementById('blockStatus'); // Re-get element
         if (!blockStatus) {
             console.error("blockStatus element not found in updateBlockStatus.");
             return;
         }

        if (blocksRemaining <= 0) {
            blockStatus.className = 'status-indicator unlocked';
            blockStatus.innerHTML = '<p class="status-text">🎉 Time Capsule messages are now unlockable!</p>';
            progressBar.style.width = '100%';
             // Stop the second-by-second countdown when unlocked
            if (countdownInterval) clearInterval(countdownInterval);
             countdownInterval = null;
             // Ensure countdown display is zero when unlocked (if elements exist)
              const countdownDays = document.getElementById('countdownDays');
              const countdownHours = document.getElementById('countdownHours');
              const countdownMinutes = document.getElementById('countdownMinutes');
              const countdownSeconds = document.getElementById('countdownSeconds');
             if (countdownDays) countdownDays.textContent = '0';
             if (countdownHours) countdownHours.textContent = '00';
             if (countdownMinutes) countdownMinutes.textContent = '00';
             if (countdownSeconds) countdownSeconds.textContent = '00';


        } else {
            blockStatus.className = 'status-indicator pending';
             // Rebuild or update the internal content of blockStatus if needed
             // Ensure countdown elements are present before trying to update them
             if (!document.getElementById('countdownDays')) {
                  // If countdown elements are missing, rebuild the structure
                  blockStatus.innerHTML = `<div class="countdown-grid">
                                             <div class="countdown-item">
                                                 <span id="countdownDays" class="countdown-value">--</span>
                                                 <span class="countdown-label">Days</span>
                                             </div>
                                             <div class="countdown-item">
                                                 <span id="countdownHours" class="countdown-value">--</span>
                                                 <span class="countdown-label">Hours</span>
                                             </div>
                                             <div class="countdown-item">
                                                 <span id="countdownMinutes" class="countdown-value">--</span>
                                                 <span class="countdown-label">Minutes</span>
                                             </div>
                                             <div class="countdown-item">
                                                 <span id="countdownSeconds" class="countdown-value">--</span>
                                                 <span class="countdown-label">Seconds</span>
                                             </div>
                                         </div>
                                         <p class="status-text">Time Capsule messages will be unlockable in approximately <span id="blocksRemaining">${blocksRemaining}</span> blocks</p>`;
             } else {
                 // Just update the blocks remaining text
                 const blocksRemainingElement = document.getElementById('blocksRemaining');
                 if (blocksRemainingElement) blocksRemainingElement.textContent = blocksRemaining;
             }


            // Update progress bar
            const progressPercentage = (currentBlock / unlockBlock) * 100;
            progressBar.style.width = `${Math.min(progressPercentage, 100)}%`; // Cap at 100%

             // Calculate and display estimated time remaining based on *current time* and *blocks remaining*
             // Assuming average block time is 10 minutes (600 seconds)
             const estimatedSecondsRemaining = blocksRemaining * 600;
             const now = new Date().getTime();
             const estimatedUnlockTime = now + (estimatedSecondsRemaining * 1000); // Estimated unlock time in ms


             // Clear previous interval to avoid multiple timers
             if (countdownInterval) clearInterval(countdownInterval);

            // Start second-by-second countdown
             countdownInterval = setInterval(() => {
                 const currentTime = new Date().getTime();
                 const timeDifference = estimatedUnlockTime - currentTime;

                  const countdownDaysElement = document.getElementById('countdownDays');
                  const countdownHoursElement = document.getElementById('countdownHours');
                  const countdownMinutesElement = document.getElementById('countdownMinutes');
                  const countdownSecondsElement = document.getElementById('countdownSeconds');

                 // Ensure elements exist before updating
                 if (!countdownDaysElement || !countdownHoursElement || !countdownMinutesElement || !countdownSecondsElement) {
                      console.error("Countdown elements not found during interval update.");
                      clearInterval(countdownInterval);
                      countdownInterval = null;
                      return;
                 }


                 if (timeDifference <= 0) {
                     countdownDaysElement.textContent = '0';
                     countdownHoursElement.textContent = '00';
                     countdownMinutesElement.textContent = '00';
                     countdownSecondsElement.textContent = '00';
                     updateBlockStatus(); // Re-run status check in case blocks updated faster
                     clearInterval(countdownInterval);
                     countdownInterval = null;
                 } else {
                     const totalSeconds = Math.floor(timeDifference / 1000);
                     const seconds = totalSeconds % 60;
                     const minutes = Math.floor((totalSeconds / 60) % 60);
                     const hours = Math.floor((totalSeconds / 3600) % 24);
                     const days = Math.floor(totalSeconds / 86400);

                     countdownDaysElement.textContent = days;
                     countdownHoursElement.textContent = hours.toString().padStart(2, '0');
                     countdownMinutesElement.textContent = minutes.toString().padStart(2, '0');
                     countdownSecondsElement.textContent = seconds.toString().padStart(2, '0');
                 }
             }, 1000); // Update every second
        }
         console.log("Block status updated.");
    }

     // Initial fetch and update
     fetchCurrentBlockHeight();

     // Poll for new block height periodically (e.g., every 60 seconds)
     setInterval(fetchCurrentBlockHeight, 60000); // Adjust interval as needed (e.g., 60000 for 1 minute)
      console.log("Block height polling started.");
}

// Tab functionality for Retrieve Messages section
function initTabs() {
    console.log("Initializing tabs.");
    const tabButtons = document.querySelectorAll('.tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (!tabButtons.length || !tabContents.length) {
        console.warn("Tab elements not found.");
        return;
    }


    tabButtons.forEach(button => {
        // Remove existing listeners before adding to prevent duplicates on re-init if any
        const oldTabHandler = button._tabHandler;
        if (oldTabHandler) {
            button.removeEventListener('click', oldTabHandler);
        }

        const newTabHandler = () => {
            const targetTabId = button.getAttribute('data-tab');

            // Deactivate all tabs and hide all content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the clicked tab and show the target content
            button.classList.add('active');
             const targetContent = document.getElementById(targetTabId);
             if (targetContent) {
                 targetContent.classList.add('active');
             } else {
                 console.error(`Target tab content element not found: #${targetTabId}`);
             }
        };
         button.addEventListener('click', newTabHandler);
         button._tabHandler = newTabHandler; // Store for removal
    });

     // Trigger click on the first tab to show content on load
     if (tabButtons.length > 0) {
         tabButtons[0].click();
     }
     console.log("Tabs initialized.");
}

// Donation address copy functionality
function initDonationAddressCopy() {
    console.log("Initializing donation address copy.");
    const donationAddress = document.getElementById('donationAddress');
    const donationAddressText = document.getElementById('donationAddressText');
    const copyIcon = donationAddress ? donationAddress.querySelector('.copy-icon') : null;
    const copyConfirmation = donationAddress ? donationAddress.querySelector('.copy-confirmation') : null;

    if (!donationAddress || !donationAddressText || !copyIcon || !copyConfirmation) {
        console.error("Donation address elements not found.");
        return;
    }

    donationAddress.style.cursor = 'pointer'; // Indicate it's clickable

     // Remove existing listener before adding to prevent duplicates on re-init if any
     const oldCopyHandler = donationAddress._copyHandler;
     if (oldCopyHandler) {
         donationAddress.removeEventListener('click', oldCopyHandler);
     }

    const newCopyHandler = async () => {
        try {
            await navigator.clipboard.writeText(donationAddressText.textContent);
            copyConfirmation.classList.add('show');
            setTimeout(() => {
                copyConfirmation.classList.remove('show');
            }, 2000); // Show for 2 seconds
             console.log("Donation address copied.");
        } catch (err) {
            console.error('Failed to copy donation address: ', err);
             showModal("Copy Error", "<p>Failed to copy donation address to clipboard. Please try manually.</p>");
        }
    };

     donationAddress.addEventListener('click', newCopyHandler);
     donationAddress._copyHandler = newCopyHandler; // Store for removal

     console.log("Donation address copy initialized.");
}

// Encrypt Message and Generate Transaction (Placeholder)
async function encryptMessage() {
    console.log("Encrypt message button clicked.");
    if (!walletConnected || !currentWallet) {
        showModal("Wallet Required", "<p>Please connect your wallet first.</p>");
        console.warn("Encrypt attempt failed: Wallet not connected.");
        return;
    }

    const messageInput = document.getElementById('message');
    const encryptedMessageOutput = document.getElementById('encryptedMessageOutput');
    const outputDiv = document.getElementById('output');
    const signTransactionButton = document.getElementById('signTransaction');
    const encryptionResultDiv = document.getElementById('encryptionResult');


    const message = messageInput.value.trim();

    if (!message) {
        showModal("Error", "<p>Please enter a message to encrypt.</p>");
         console.warn("Encrypt attempt failed: Message is empty.");
        return;
    }
     const bytes = new TextEncoder().encode(message).length;
      if (bytes > 80) {
           showModal("Message Too Long", "<p>Your message exceeds the 80-byte limit for inscription.</p>");
            console.warn("Encrypt attempt failed: Message too long.");
           return;
      }

    console.log(`Encrypting message (${bytes} bytes): "${message}"`);
    // Basic Base64 encoding (not real encryption)
    const encodedMessage = btoa(message);
    if (encryptedMessageOutput) encryptedMessageOutput.textContent = encodedMessage;

    // Prepare transaction data (This is a simplified placeholder)
    // In a real application, you would build a PSBT (Partially Signed Bitcoin Transaction)
    // to inscribe the message and send the fee.
    // This requires fetching UTXOs, calculating fees, and building the transaction structure.

    // Example placeholder transaction data structure
    const transactionData = {
        type: "Inscription",
        recipient: CONTRACT_CONFIG.feeRecipient,
        feeAmount: CONTRACT_CONFIG.feeAmount,
        unlockBlock: CONTRACT_CONFIG.unlockBlockHeight,
        message: encodedMessage,
        // Add more details like UTXOs used, fee rate, etc.
        // This needs to be structured according to the inscription method you use (e.g., Ordinals)
        // and the requirements of the specific wallet's signing method (e.g., signPsbt).
         // For demo purposes, let's add a dummy PSBT hex
        dummyPsbtHex: "70736274ff0100..." // Replace with real PSBT generation
    };

    if (outputDiv) {
         outputDiv.innerHTML = `
             <h3 class="card-subtitle">Generated Transaction Details (Placeholder)</h3>
             <div class="transaction-detail">
                 <span class="detail-label">Type:</span>
                 <span class="detail-value">${transactionData.type}</span>
             </div>
             <div class="transaction-detail">
                 <span class="detail-label">Recipient:</span>
                 <span class="detail-value">${transactionData.recipient}</span>
             </div>
              <div class="transaction-detail">
                 <span class="detail-label">Fee Amount:</span>
                 <span class="detail-value">${transactionData.feeAmount} ${CONTRACT_CONFIG.network.toUpperCase()} BTC</span>
             </div>
             <div class="transaction-detail">
                 <span class="detail-label">Unlock Block:</span>
                 <span class="detail-value">${transactionData.unlockBlock}</span>
             </div>
             <div class="transaction-detail">
                 <span class="detail-label">Message (Base64):</span>
                 <span class="detail-value code-block small">${transactionData.message}</span>
             </div>
             <p class="alert alert-warning mt-md"><strong>Note:</strong> This is a simplified representation. Building a real inscription transaction requires detailed PSBT construction and UTXO management.</p>
         `;
    }


     if (encryptionResultDiv) encryptionResultDiv.style.display = 'block'; // Show the result section
     if (signTransactionButton) {
          signTransactionButton.style.display = 'block'; // Show the sign button
          // Remove existing listener before adding to prevent duplicates on re-init if any
          const oldSignHandler = signTransactionButton._signHandler;
          if (oldSignHandler) {
              signTransactionButton.removeEventListener('click', oldSignHandler);
          }
         const newSignHandler = () => signAndSubmitTransaction(transactionData.dummyPsbtHex); // Pass the dummy PSBT hex
          signTransactionButton.addEventListener('click', newSignHandler);
          signTransactionButton._signHandler = newSignHandler; // Store for removal
     }

      console.log("Transaction details generated (placeholder).");
}

// Sign and Submit Transaction (Placeholder)
async function signAndSubmitTransaction(psbtHex) {
    console.log("Sign and Submit button clicked.");
    if (!walletConnected || !currentWallet) {
        showModal("Wallet Required", "<p>Please connect your wallet first.</p>");
         console.warn("Sign attempt failed: Wallet not connected.");
        return;
    }

    // In a real application, you would use the connected wallet's API
    // to sign the prepared PSBT. This is a highly simplified example.

    showModal("Signing Transaction", "<p>Please approve the transaction in your wallet...</p>");
     console.log("Prompted user to sign transaction in wallet.");

    try {
        // Example using a hypothetical signPsbt method available on currentWallet
        // The actual method signature and process vary significantly by wallet API.
        // You would need to prepare the PSBT string/object correctly before calling this.
        // This is a PLACEHOLDER and will not work without a proper PSBT and wallet method.

        if (!currentWallet.signPsbt) {
             const walletTypeName = currentWallet ? (currentWallet.constructor.name.replace('Provider', '').replace('Bitcoin', '').trim() || (currentWallet._brand ? currentWallet._brand.name : 'Unknown Wallet')) : 'Unknown';
             console.error(`Connected wallet (${walletTypeName}) does not support signPsbt.`);
             throw new Error(`The connected wallet (${walletTypeName}) does not support the required signing method (signPsbt).`);
        }
         console.log("Calling wallet signPsbt method.");

        // *** REPLACE WITH REAL PSBT GENERATION AND SIGNING LOGIC ***
        // The psbtHex passed here is the dummy one from encryptMessage.
        // In a real app, this would be a correctly built PSBT.

        const signedPsbtHex = await currentWallet.signPsbt(psbtHex, {
            // options for signing, e.g., extractTx: true
             autoFinalized: true // Example option, varies by wallet
        });

        hideModal(); // Hide signing modal
         console.log("Transaction signed successfully.");
        showModal("Transaction Signed", `<p>Transaction signed successfully!</p><p>Signed PSBT (Hex):</p><p class="code-block small">${signedPsbtHex}</p><p>Now you would typically broadcast this transaction to the Bitcoin network.</p>`);

        // In a real app, after signing, you would broadcast the transaction:
         if (!currentWallet.pushTx) {
              console.warn("Connected wallet does not have a pushTx method. Manual broadcast needed.");
              showModal("Broadcast Needed", `<p>Transaction signed, but your wallet does not support direct broadcasting.</p><p>Please use a broadcasting service to submit the following signed transaction hex:</p><p class="code-block small">${signedPsbtHex}</p>`);
         } else {
             showModal("Broadcasting Transaction", "<p>Broadcasting transaction via wallet...</p>");
             console.log("Calling wallet pushTx method.");
             try {
                  const txId = await currentWallet.pushTx(signedPsbtHex);
                  hideModal();
                   console.log(`Transaction broadcasted successfully. Tx ID: ${txId}`);
                  showModal("Transaction Broadcasted", `<p>Transaction broadcasted successfully!</p><p>Transaction ID: <a href="https://signet.spaces.bitcoindevkit.org/tx/${txId}" target="_blank">${txId}</a></p><p>It may take some time to appear on explorers.</p>`); // Example Signet explorer link
             } catch (pushError) {
                  console.error("Transaction broadcasting failed:", pushError);
                  hideModal();
                  showModal("Broadcast Failed", `<p>Failed to broadcast the transaction.</p><p>Details: ${pushError.message || pushError}</p><p>Please try manually broadcasting the signed transaction hex:</p><p class="code-block small">${signedPsbtHex}</p>`);
             }
         }


    } catch (error) {
        console.error("Transaction signing failed:", error);
        hideModal();
        showModal("Signing Failed", `<p>Failed to sign the transaction.</p><p>Details: ${error.message || error}</p>`);
    }
}


// Retrieve Stored Messages (Placeholder)
function loadStoredMessages() {
    console.log("Loading stored messages (placeholder).");
    const storedMessagesList = document.getElementById('storedMessagesList');
    const nextMessagesBtn = document.getElementById('nextMessagesBtn');

    if (!storedMessagesList || !nextMessagesBtn) {
        console.error("Stored messages elements not found.");
        return;
    }

    // This is a placeholder. In a real application, you would fetch stored messages
    // associated with the connected wallet address from your indexer/API.

    storedMessagesList.innerHTML = '<p>Fetching stored messages...</p>';
    nextMessagesBtn.style.display = 'none';

    // Simulate fetching data
    setTimeout(() => {
        const messages = [
            { id: 'txid1abc...', status: 'Pending', unlockBlock: 270000 },
            { id: 'txid2def...', status: 'Unlocked', unlockBlock: 260000, messagePreview: 'SGVsbG8gRnV0dXJlIQ==' }, // Example Base64
            { id: 'txid3ghi...', status: 'Unlocked', unlockBlock: 262000, messagePreview: 'VGhpcyBpcyBhIHRlc3QgbWVzc2FnZQ==' }, // Example Base64
            // Add more dummy messages
        ];

        if (messages.length === 0) {
            storedMessagesList.innerHTML = '<p>No stored messages found for this address.</p>';
             console.log("No stored messages found (placeholder).");
        } else {
            storedMessagesList.innerHTML = messages.map(msg => `
                <div class="message-item">
                    <p><strong>Tx ID:</strong> ${msg.id}</p>
                    <p><strong>Status:</strong> ${msg.status}</p>
                    <p><strong>Unlock Block:</strong> ${msg.unlockBlock}</p>
                    ${msg.messagePreview ? `<p><strong>Preview (Base64):</strong> ${msg.messagePreview}</p>` : ''}
                     ${msg.status === 'Unlocked' && msg.messagePreview ? `<button class="btn btn-secondary btn-sm mt-sm" onclick="retrieveMessage('${msg.id}', '${msg.messagePreview}')">Retrieve Message</button>` : ''}
                </div>
            `).join('');
            // Show load more button if there are more messages to potentially load
            // nextMessagesBtn.style.display = 'block'; // Enable if pagination is implemented
             console.log(`${messages.length} stored messages loaded (placeholder).`);
        }
    }, 1500); // Simulate network delay
}

// Retrieve Message (for messages from "Stored Messages" tab)
function retrieveMessage(txId, encodedMessage) {
     // In a real application, you would fetch the full message content using the txId
     // from your indexer/API if it wasn't included in the initial load.
     // For this placeholder, we use the messagePreview provided.
     console.log("Attempting to retrieve and decode message for Tx ID:", txId);

      if (!encodedMessage) {
          showModal("Retrieval Error", `<p>Message content not available for ${txId}.</p>`);
           console.warn("Retrieval failed: Encoded message is null or empty.");
          return;
      }

     showModal("Retrieving Message", `<p>Decoding message content for ${txId}...</p>`);
      console.log("Decoding Base64 message...");

      try {
            const decodedMessage = atob(encodedMessage);
            hideModal();
            console.log("Message decoded successfully.");
            showModal("Retrieved Message", `<p><strong>Original Message:</strong></p><p>${decodedMessage}</p><p class="alert alert-info mt-md">Note: Messages are publicly visible after the unlock block height is reached.</p>`);
        } catch (error) {
            console.error("Failed to decode retrieved message:", error);
             hideModal();
            showModal("Decoding Error", "<p>Failed to decode the retrieved message. It might not be a valid Base64 encoded string.</p>");
        }
}

// Retrieve Message by ID (Placeholder)
function checkMessage() {
    console.log("Check Message button clicked.");
    const txIdInput = document.getElementById('txIdInput');
    const messageStatusDiv = document.getElementById('messageStatus');
     const checkMessageBtn = document.getElementById('checkMessageBtn'); // Get the button itself

    if (!txIdInput || !messageStatusDiv || !checkMessageBtn) {
        console.error("Message lookup elements not found.");
        return;
    }

    const txId = txIdInput.value.trim();

    if (!txId) {
        messageStatusDiv.innerHTML = '<p class="alert alert-warning">Please enter a Transaction ID.</p>';
         console.warn("Check message failed: No transaction ID entered.");
        return;
    }

    messageStatusDiv.innerHTML = '<p>Checking status for TX ID: ' + txId + '...</p>';
    console.log(`Checking status for TX ID: ${txId}`);

    // This is a placeholder. In a real application, you would query your indexer/API
    // with the transaction ID to get the message status and details.

    // Simulate fetching data
    // Disable the button while checking
    checkMessageBtn.disabled = true;
    setTimeout(() => {
        // Example response structure
        const status = Math.random() > 0.5 ? 'Unlocked' : 'Pending';
        const unlockBlock = 263527;
        // const messageContent = status === 'Unlocked' ? 'This is a sample unlocked message content encoded in Base64.' : null; // Example Base64
        const dummyEncodedMessage = status === 'Unlocked' ? 'VGhpcyBpcyBhIHNhbXBsZSB1bmxvY2tlZCBtZXNzYWdlIGNvbnRlbnQgZW5jb2RlZCBpbiBCYXNlNjQu' : null; // "This is a sample unlocked message content encoded in Base64."

         console.log(`Simulated status for ${txId}: ${status}`);

        messageStatusDiv.innerHTML = `
            <div class="message-item alert ${status === 'Unlocked' ? 'alert-success' : (status === 'Pending' ? 'alert-info' : 'alert-warning')}">
                <p><strong>TX ID:</strong> ${txId}</p>
                <p><strong>Status:</strong> ${status}</p>
                <p><strong>Unlock Block:</strong> ${unlockBlock}</p>
                ${status === 'Unlocked' && dummyEncodedMessage ? `
                    <p><strong>Encoded Message:</strong> <span class="code-block small">${dummyEncodedMessage}</span></p>
                    <button class="btn btn-primary btn-sm mt-sm" onclick="decodeAndDisplayMessage('${dummyEncodedMessage}')">Decode & View Message</button>
                ` : (status === 'Pending' ? '<p>Message is not yet unlockable.</p>' : '<p>Could not retrieve message status.</p>')}
            </div>
        `;
         // Re-enable the button
         checkMessageBtn.disabled = false;

    }, 1500); // Simulate network delay
}

// Function to decode and display message from lookup tab (Called by onclick in checkMessage result)
function decodeAndDisplayMessage(encodedMessage) {
     console.log("Attempting to decode message from lookup.");
     if (!encodedMessage) {
          showModal("Retrieval Error", `<p>Message content not available.</p>`);
          console.warn("Decoding failed: Encoded message is null or empty.");
          return;
      }

     showModal("Retrieving Message", `<p>Decoding message content...</p>`);
     console.log("Decoding Base64 message from lookup...");


      try {
            const decodedMessage = atob(encodedMessage);
            hideModal();
             console.log("Message decoded successfully from lookup.");
            showModal("Retrieved Message", `<p><strong>Original Message:</strong></p><p>${decodedMessage}</p><p class="alert alert-info mt-md">Note: Messages are publicly visible after the unlock block height is reached.</p>`);
        } catch (error) {
            console.error("Failed to decode retrieved message from lookup:", error);
             hideModal();
            showModal("Decoding Error", "<p>Failed to decode the retrieved message. It might not be a valid Base64 encoded string.</p>");
        }
}


// Document ready and initializations
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded - Initializing");

    // Initialize core components
    initModalHandlers(); // Initialize modal logic first
    initWalletConnection(); // Initialize wallet connection logic
    initCarousel(); // Initialize carousel with auto-slide
    initMessageInput(); // Initialize message input and button state
    initBlockHeightAndCountdown(); // Initialize block height and countdown
    initTabs(); // Initialize tab functionality
    initDonationAddressCopy(); // Initialize donation address copy

    // Load initial data (placeholders)
    loadStoredMessages(); // Load initial stored messages

     console.log("Initialization complete.");
});