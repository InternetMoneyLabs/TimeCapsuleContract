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

        const address = accounts[0];
        
        // Get network information
        const network = await unisat.getNetwork();
        console.log("Network:", network);
        
        // Check if on Signet/Testnet using multiple methods:
        // 1. Check network value if available
        // 2. Check address format as fallback
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
            document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
            return;
        }
        
        // Successfully connected to Signet/Testnet
        document.getElementById("walletStatus").innerText = `Connected to Signet: ${address}`;
        console.log("Wallet connected successfully to Signet/Testnet.");
        
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
