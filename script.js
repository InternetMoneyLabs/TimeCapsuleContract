// Implement the signAndSubmitTransaction function
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
