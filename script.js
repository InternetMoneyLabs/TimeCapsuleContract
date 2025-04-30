document.getElementById("connectWallet").addEventListener("click", async () => {
    if (window.unisat) {
        try {
            // Request accounts from Unisat wallet
            const accounts = await window.unisat.requestAccounts();
            console.log("Connected accounts:", accounts); // Debugging: Log connected accounts

            // Get the current network from Unisat wallet
            const network = await window.unisat.getNetwork();
            console.log("Detected network:", network); // Debugging: Log the network value

            // Normalize the network name for comparison
            const normalizedNetwork = network.trim().toLowerCase();
            if (normalizedNetwork !== "signet" && normalizedNetwork !== "bitcoin-signet") {
                console.error("Unexpected network value:", network); // Log unexpected network value
                alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
                document.getElementById("walletStatus").innerText = "Wallet Status: Not Connected";
                return;
            }

            if (accounts && accounts.length > 0) {
                const CONTRACT_ADDRESS = "tb1psc5acrr862j3c7qgfrspsdh72822wdym22gk5t8uar8j52wzxc0q3c3tql";
                const API_BASE_URL = "https://api.bestinslot.xyz";

                async function fetchTransactions() {
                    try {
                        const response = await fetch(`${API_BASE_URL}/brc-20/address/${CONTRACT_ADDRESS}`);
                        if (!response.ok) {
                            throw new Error(`Error fetching transactions: ${response.statusText}`);
                        }
                        const transactions = await response.json();
                        console.log("Transactions:", transactions);

                        // Display transactions on the website
                        const outputElement = document.getElementById("output");
                        outputElement.innerHTML = JSON.stringify(transactions, null, 2);
                    } catch (error) {
                        console.error("Failed to fetch transactions:", error);
                    }
                }

                // Update wallet status
                document.getElementById("walletStatus").innerText = `Connected to Signet: ${accounts[0]}`;

                // Fetch transactions
                fetchTransactions();
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
