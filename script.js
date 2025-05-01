document.getElementById("connectWallet").addEventListener("click", async () => {
    if (window.unisat) {
        try {
            console.log("Unisat Wallet detected."); // Debugging: Log wallet detection

            // Request accounts from Unisat wallet
            const accounts = await window.unisat.requestAccounts();
            console.log("Connected accounts:", accounts); // Debugging: Log connected accounts

            // Get the current network from Unisat wallet
            const network = await window.unisat.getNetwork();
            console.log("Detected network:", network); // Debugging: Log the network value
            console.log("Network type:", typeof network); // Log the type of the network value

            // More comprehensive network detection
            let isSignet = false;
            
            // Handle different return types and formats
            if (typeof network === 'string') {
                const normalizedNetwork = network.trim().toLowerCase();
                console.log("Normalized network (string):", normalizedNetwork);
                isSignet = normalizedNetwork === "signet" || 
                           normalizedNetwork === "bitcoin-signet" || 
                           normalizedNetwork.includes("signet");
            } else if (typeof network === 'number') {
                console.log("Network as number:", network);
                // Some wallets use 2 for signet (0=mainnet, 1=testnet, 2=signet)
                isSignet = network === 2;
            } else if (network !== null && network !== undefined) {
                // Try to handle object or other return types
                const networkStr = String(network).toLowerCase();
                console.log("Network converted to string:", networkStr);
                isSignet = networkStr === "signet" || 
                           networkStr === "2" || 
                           networkStr.includes("signet");
            }
            
            // Debug output
            console.log("Is Signet detected:", isSignet);
            
            // Force accept connection for testing (REMOVE THIS IN PRODUCTION)
            // isSignet = true;
            
            if (!isSignet) {
                console.error("Not on Signet network. Detected:", network);
                alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
                document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
                return;
            }

            if (accounts && accounts.length > 0) {
                console.log("Wallet connected successfully."); // Debugging: Log successful connection
                document.getElementById("walletStatus").innerText = `Connected to Signet: ${accounts[0]}`;
            } else {
                alert("No accounts found in Unisat Wallet. Please ensure you are logged in.");
                document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            }
        } catch (error) {
            console.error("Error connecting to Unisat Wallet:", error);
            alert("Error connecting to Unisat Wallet: " + error.message);
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
        }
    } else {
        alert("Unisat wallet not found! Please install the Unisat browser extension.");
        document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
    }
});

// Function to encrypt messages locally in the browser
function encryptMessage() {
    const message = document.getElementById("message").value;
    if (!message) {
        alert("Please enter a message to encrypt.");
        return;
    }

    try {
        // Simple encryption logic (for demonstration purposes)
        const encryptedMessage = btoa(message); // Base64 encoding
        document.getElementById("encryptedMessageOutput").innerText = `Encrypted Message: ${encryptedMessage}`;
        console.log("Encrypted Message:", encryptedMessage);

        // Display the "Sign & Submit" button
        document.getElementById("signTransaction").style.display = "block";
    } catch (error) {
        console.error("Error encrypting message:", error);
        alert("Failed to encrypt the message. Please try again.");
    }
}
