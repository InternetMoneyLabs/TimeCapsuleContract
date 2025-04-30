document.getElementById("connectWallet").addEventListener("click", async () => {
    if (window.unisat) {
        try {
            const accounts = await window.unisat.requestAccounts();
            const network = await window.unisat.getNetwork();

            console.log("Detected Network:", network); // Logs actual network name

            if (network !== "signet" && network !== "testnet") {  
                alert("⚠ You are NOT on Bitcoin Signet! Please switch your wallet network to Signet and try again.");
            } else {
                document.getElementById("walletStatus").innerText = `Connected to Signet: ${accounts[0]}`;
            }
        } catch (error) {
            alert("Error connecting wallet: " + error.message);
        }
    } else {
        alert("Unisat wallet not found! Please install the browser extension.");
    }
});
