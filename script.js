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

// Connect wallet button handler
document.getElementById("connectWallet").addEventListener("click", async () => {
    try {
        // Wait for UniSat to be available
        const unisat = await waitForUnisat();
        if (!unisat) {
            alert("Unisat wallet not found! Please install the Unisat browser extension.");
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            return;
        }
        
        console.log("Unisat detected:", unisat.version || "version unknown");
        
        // Request connection to wallet
        const accounts = await unisat.requestAccounts();
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
            alert("No accounts found in Unisat Wallet. Please ensure you are logged in.");
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            return;
        }
        
        // Get network information
        const network = await unisat.getNetwork();
        console.log("Network:", network);
        
        // Check if on Signet - accept any value that contains "signet" (case insensitive)
        // UniSat's own site uses a simple string comparison
        const networkStr = String(network).toLowerCase();
        const isSignet = networkStr.includes("signet");
        
        console.log("Is Signet:", isSignet, "Network value:", network);
        
        if (!isSignet) {
            alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            return;
        }
        
        // Successfully connected to Signet
        document.getElementById("walletStatus").innerText = `Connected to Signet: ${accounts[0]}`;
        console.log("Wallet connected successfully to Signet.");
        
    } catch (error) {
        console.error("Error connecting to Unisat Wallet:", error);
        alert("Error connecting to Unisat Wallet: " + error.message);
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
