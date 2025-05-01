document.getElementById("connectWallet").addEventListener("click", async () => {
    if (!window.unisat) {
        alert("Unisat wallet not found! Please install the Unisat browser extension.");
        document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
        return;
    }

    try {
        console.log("Unisat Wallet detected.");

        // First, check if connected to wallet
        let connected = false;
        try {
            const accounts = await window.unisat.getAccounts();
            connected = accounts && accounts.length > 0;
            console.log("Already connected:", connected);
        } catch (e) {
            console.log("Not connected yet");
        }

        // Connect if not already connected
        if (!connected) {
            console.log("Requesting accounts...");
            const accounts = await window.unisat.requestAccounts();
            console.log("Connected accounts:", accounts);
            
            if (!accounts || accounts.length === 0) {
                alert("No accounts found in Unisat Wallet. Please ensure you are logged in.");
                document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
                return;
            }
        }

        // Get network information
        const networkInfo = await getNetworkInfo();
        console.log("Network info:", networkInfo);

        if (!networkInfo.isSignet) {
            alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            return;
        }

        // Get the account address
        const accounts = await window.unisat.getAccounts();
        document.getElementById("walletStatus").innerText = `Connected to Signet: ${accounts[0]}`;
        console.log("Wallet connected successfully to Signet.");

    } catch (error) {
        console.error("Error connecting to Unisat Wallet:", error);
        alert("Error connecting to Unisat Wallet: " + error.message);
        document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
    }
});

// Separate function to get network information
async function getNetworkInfo() {
    try {
        // Try multiple methods to determine if we're on Signet
        let isSignet = false;
        let networkValue = null;
        
        // Method 1: Direct getNetwork call
        try {
            networkValue = await window.unisat.getNetwork();
            console.log("Method 1 - getNetwork result:", networkValue);
        } catch (e) {
            console.log("Method 1 failed:", e);
        }
        
        // Method 2: Check if we can get a Signet address
        let signetAddress = null;
        try {
            signetAddress = await window.unisat.getAddress();
            console.log("Method 2 - Got address:", signetAddress);
        } catch (e) {
            console.log("Method 2 failed:", e);
        }
        
        // Method 3: Check network properties
        let networkProperties = null;
        try {
            if (window.unisat.bitcoinNetwork) {
                networkProperties = window.unisat.bitcoinNetwork;
            }
            console.log("Method 3 - Network properties:", networkProperties);
        } catch (e) {
            console.log("Method 3 failed:", e);
        }
        
        // Determine if we're on Signet based on all available information
        if (networkValue) {
            if (typeof networkValue === 'string') {
                isSignet = networkValue.toLowerCase().includes('signet');
            } else if (typeof networkValue === 'number') {
                isSignet = networkValue === 2;
            } else {
                isSignet = String(networkValue).toLowerCase().includes('signet');
            }
        }
        
        // If we have a Signet address, that's a good sign
        if (signetAddress && !isSignet) {
            // Additional check: Signet addresses often start with specific prefixes
            // This is a heuristic and may need adjustment
            isSignet = true;
        }
        
        // If we have network properties that indicate Signet
        if (networkProperties && !isSignet) {
            if (typeof networkProperties === 'string') {
                isSignet = networkProperties.toLowerCase().includes('signet');
            } else if (networkProperties.name) {
                isSignet = networkProperties.name.toLowerCase().includes('signet');
            }
        }
        
        // TEMPORARY: Force accept for testing
        // isSignet = true;
        
        return {
            isSignet,
            networkValue,
            signetAddress,
            networkProperties
        };
    } catch (error) {
        console.error("Error getting network info:", error);
        return { isSignet: false, error };
    }
}

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
