// Consolidated JavaScript for Bitcoin Time Capsule
document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONTRACT_CONFIG = {
        unlockBlockHeight: 263527,
        feeRecipient: "tb1qrz46wz6skvskgeerp6q88grv9p4y3r8qd8c8fl", // Example testnet address
        feeAmount: 0.0001, // in BTC
        averageBlockTimeSeconds: 600, // 10 minutes per block on average
        totalExpectedBlocks: 12288 // Approximately 85 days worth of blocks (85 * 144)
    };

    // Global variables
    let walletConnected = false;
    let currentAccount = null;
    let currentWalletType = null;
    let lastBlockHeight = 0;
    let lastBlockFetchTime = 0;
    let countdownInterval = null;

    // Initialize all functionality
    initBlockHeightAndCountdown();
    initTwitterCarousel();
    initWalletConnectButton();
    initMessageInput();
    initDonationCopy();
    initModalHandlers();

    // ===== BLOCK HEIGHT AND COUNTDOWN FUNCTIONALITY =====
    async function initBlockHeightAndCountdown() {
        try {
            // Fetch current block height from a Bitcoin Signet API
            const currentBlockHeight = await fetchCurrentBlockHeight();
            lastBlockHeight = currentBlockHeight;
            lastBlockFetchTime = Date.now();
            
            // Update UI with current block height
            updateBlockHeightUI(currentBlockHeight);
            
            // Start the countdown immediately with machine time
            startRealTimeCountdown(currentBlockHeight, CONTRACT_CONFIG.unlockBlockHeight);
            
            // Set up interval to refresh block height data every minute
            setInterval(async () => {
                try {
                    const updatedBlockHeight = await fetchCurrentBlockHeight();
                    
                    // Only update if block height has changed
                    if (updatedBlockHeight !== lastBlockHeight) {
                        lastBlockHeight = updatedBlockHeight;
                        lastBlockFetchTime = Date.now();
                        updateBlockHeightUI(updatedBlockHeight);
                        
                        // Restart countdown with new block height
                        if (countdownInterval) {
                            clearInterval(countdownInterval);
                        }
                        startRealTimeCountdown(updatedBlockHeight, CONTRACT_CONFIG.unlockBlockHeight);
                    }
                } catch (error) {
                    console.error("Error updating block height:", error);
                }
            }, 60000); // Update every minute
        } catch (error) {
            console.error("Error initializing block height and countdown:", error);
            document.getElementById('currentBlockHeight').textContent = "Error loading";
            document.getElementById('blockStatus').innerHTML = `
                <p class="status-text">Error loading block data. Please refresh the page.</p>
            `;
        }
    }

    // Function to fetch current block height from a Bitcoin Signet API
    async function fetchCurrentBlockHeight() {
        // Try multiple APIs for redundancy
        const apis = [
            "https://mempool.space/signet/api/blocks/tip/height",
            "https://explorer.bc-2.jp/api/blocks/tip/height"
        ];
        
        // Try each API until one succeeds
        for (const api of apis) {
            try {
                const response = await fetch(api);
                if (!response.ok) continue;
                
                const blockHeight = await response.text();
                return parseInt(blockHeight.trim(), 10);
            } catch (error) {
                console.warn(`Failed to fetch from ${api}:`, error);
                // Continue to next API
            }
        }
        
        // If all APIs fail, throw error
        throw new Error("Failed to fetch current block height from all APIs");
    }

    // Function to update block height UI
    function updateBlockHeightUI(currentBlockHeight) {
        const currentBlockElement = document.getElementById('currentBlockHeight');
        if (currentBlockElement) {
            currentBlockElement.textContent = currentBlockHeight.toLocaleString();
        }
        
        const unlockBlockElement = document.getElementById('unlockBlockHeight');
        if (unlockBlockElement) {
            unlockBlockElement.textContent = CONTRACT_CONFIG.unlockBlockHeight.toLocaleString();
        }
        
        // Update progress bar - FIXED VERSION
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            // Calculate blocks remaining
            const blocksRemaining = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
            
            // Calculate progress percentage - directly based on remaining blocks
            // If we're at 251,146 and unlock is at 263,527, that's 12,381 blocks remaining
            const progress = Math.min(100, Math.max(0, 
                ((CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight) / 12381) * 100
            ));
            
            // Set the width directly with !important to override any other styles
            progressBar.setAttribute('style', `width: ${100-progress}% !important`);
            console.log(`Progress bar set to ${100-progress}%`);
        }
        
        // Update blocks remaining
        const blocksRemainingElement = document.getElementById('blocksRemaining');
        if (blocksRemainingElement) {
            const blocksRemaining = CONTRACT_CONFIG.unlockBlockHeight - currentBlockHeight;
            blocksRemainingElement.textContent = blocksRemaining.toLocaleString();
        }
    }

    // Function to start real-time countdown synced with machine time
    function startRealTimeCountdown(currentBlockHeight, unlockBlockHeight) {
        const blocksRemaining = unlockBlockHeight - currentBlockHeight;
        
        if (blocksRemaining <= 0) {
            // Time capsule is already unlockable
            document.getElementById('blockStatus').className = 'status-indicator unlockable';
            document.getElementById('blockStatus').innerHTML = `
                <div class="countdown-complete">
                    <span class="countdown-complete-text">Time Capsule Unlocked!</span>
                </div>
                <p class="status-text">Messages are now unlockable! Be among the first to unlock and receive rewards.</p>
            `;
            return;
        }
        
        // Calculate estimated total seconds remaining
        const totalSecondsRemaining = blocksRemaining * CONTRACT_CONFIG.averageBlockTimeSeconds;
        
        // Calculate target unlock time based on current time
        const targetUnlockTime = Date.now() + (totalSecondsRemaining * 1000);
        
        // Update countdown immediately
        updateCountdownDisplay(targetUnlockTime);
        
        // Set interval to update countdown every minute
        countdownInterval = setInterval(() => {
            updateCountdownDisplay(targetUnlockTime);
        }, 60000); // Update every minute
    }
    
    // Function to update countdown display based on target time
    function updateCountdownDisplay(targetTime) {
        const now = Date.now();
        const timeRemaining = targetTime - now;
        
        if (timeRemaining <= 0) {
            // Time's up!
            clearInterval(countdownInterval);
            document.getElementById('blockStatus').className = 'status-indicator unlockable';
            document.getElementById('blockStatus').innerHTML = `
                <div class="countdown-complete">
                    <span class="countdown-complete-text">Time Capsule Unlocked!</span>
                </div>
                <p class="status-text">Messages are now unlockable! Be among the first to unlock and receive rewards.</p>
            `;
            return;
        }
        
        // Calculate days, hours, minutes, seconds
        const totalSeconds = Math.floor(timeRemaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        // Format with leading zeros for hours and minutes
        const formattedDays = days.toString();
        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        
        // Update countdown UI
        document.getElementById('countdownDays').textContent = formattedDays;
        document.getElementById('countdownHours').textContent = formattedHours;
        document.getElementById('countdownMinutes').textContent = formattedMinutes;
        document.getElementById('countdownSeconds').textContent = "00"; // Always display "00" for seconds
    }

    // ===== TWITTER CAROUSEL FUNCTIONALITY =====
    function initTwitterCarousel() {
        // Twitter posts data
        const twitterPosts = [
            {
                image: "twitter-x.png",
                text: "🔒 Just sealed my thoughts in the #Bitcoin Time Capsule using BRC-2.0 tech! 🚀 My message is now forged into the blockchain until block 263527. Win a share of the unlock prize by being among the first to decrypt! #BitcoinTimeCapsule #BRC20",
            },
            {
                image: "twitter-xi.png",
                text: "✨ Bitcoin Time Capsule + BRC-2.0 = digital permanence like never before! 🔐 My encrypted message awaits at block 263527 with prizes for the first unlockers! Create your own blockchain time vault on Signet now! #BitcoinTimeCapsule 💎",
            },
            {
                image: "twitter-xiii.png",
                text: "🧠 My future self will thank me! Just used Bitcoin Time Capsule's BRC-2.0 platform to inscribe an encrypted message that unlocks with prizes at block 263527! 🏆 The future of digital permanence is here! #BitcoinTimeCapsule #Encryption",
            },
            {
                image: "twitter-xiiii.png",
                text: "🔮 Blockchain magic: My message is now immortalized via Bitcoin Time Capsule's BRC-2.0 contract! 💰 First unlockers at block 263527 share 60% of fees as prizes! Join the inscription revolution on Signet! #BitcoinTimeCapsule #BRC20 🚀",
            }
        ];

        // Get carousel elements
        const carousel = document.getElementById('twitterCarousel');
        const indicators = document.getElementById('carouselIndicators');
        const prevBtn = document.getElementById('prevSlide');
        const nextBtn = document.getElementById('nextSlide');
        
        if (!carousel || !indicators || !prevBtn || !nextBtn) {
            console.error("Carousel elements not found");
            return;
        }

        let currentSlide = 0;
        
        // Create slides
        twitterPosts.forEach((post, index) => {
            // Create slide
            const slide = document.createElement('div');
            slide.className = 'carousel-slide';
            
            // For mobile, create shorter versions of the text
            const shortText = post.text.split(' ').slice(0, 15).join(' ') + '... #BitcoinTimeCapsule';
            
            slide.innerHTML = `
                <div class="carousel-slide-content">
                    <img src="${post.image}" alt="Twitter post ${index + 1}" class="carousel-slide-image">
                    <p class="carousel-slide-text full-text">${post.text}</p>
                    <p class="carousel-slide-text short-text" style="display: none;">${shortText}</p>
                    <div class="carousel-slide-actions">
                        <button class="copy-tweet-btn" data-tweet="${post.text}">
                            Copy & Post
                        </button>
                    </div>
                </div>
            `;
            
            carousel.appendChild(slide);
            
            // Create indicator
            const indicator = document.createElement('div');
            indicator.className = 'carousel-indicator';
            if (index === 0) indicator.classList.add('active');
            indicator.dataset.slide = index;
            
            indicator.addEventListener('click', () => {
                goToSlide(index);
            });
            
            indicators.appendChild(indicator);
            
            // Add event listener to copy button
            slide.querySelector('.copy-tweet-btn').addEventListener('click', function() {
                const tweetText = this.dataset.tweet;
                copyToClipboard(tweetText);
                
                // Show confirmation
                const originalText = this.innerHTML;
                this.innerHTML = 'Copied!';
                this.disabled = true;
                
                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.disabled = false;
                }, 2000);
                
                // Open Twitter in new tab
                window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText), '_blank');
            });
        });
        
        // Set up navigation
        prevBtn.addEventListener('click', () => {
            goToSlide(currentSlide - 1);
        });
        
        nextBtn.addEventListener('click', () => {
            goToSlide(currentSlide + 1);
        });
        
        // Add touch support for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        const carouselContainer = document.querySelector('.carousel-container');
        
        carouselContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        
        carouselContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, {passive: true});
        
        function handleSwipe() {
            const swipeThreshold = 50; // Minimum distance for a swipe
            if (touchEndX < touchStartX - swipeThreshold) {
                // Swipe left - go to next slide
                goToSlide(currentSlide + 1);
            } else if (touchEndX > touchStartX + swipeThreshold) {
                // Swipe right - go to previous slide
                goToSlide(currentSlide - 1);
            }
        }
        
        // Auto-advance slides every 8 seconds
        let slideInterval = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, 8000);
        
        // Pause auto-advance when hovering over carousel
        carouselContainer.addEventListener('mouseenter', () => {
            clearInterval(slideInterval);
        });
        
        carouselContainer.addEventListener('mouseleave', () => {
            slideInterval = setInterval(() => {
                goToSlide(currentSlide + 1);
            }, 8000);
        });
        
        // Also pause on touch for mobile
        carouselContainer.addEventListener('touchstart', () => {
            clearInterval(slideInterval);
        }, {passive: true});
        
        carouselContainer.addEventListener('touchend', () => {
            slideInterval = setInterval(() => {
                goToSlide(currentSlide + 1);
            }, 8000);
        }, {passive: true});
        
        // Function to go to a specific slide
        function goToSlide(slideIndex) {
            const slides = carousel.querySelectorAll('.carousel-slide');
            const indicators = document.querySelectorAll('.carousel-indicator');
            
            // Handle wrapping
            if (slideIndex < 0) {
                slideIndex = slides.length - 1;
            } else if (slideIndex >= slides.length) {
                slideIndex = 0;
            }
            
            // Update current slide
            currentSlide = slideIndex;
            
            // Move carousel
            carousel.style.transform = `translateX(-${currentSlide * 100}%)`;
            
            // Update indicators
            indicators.forEach((indicator, index) => {
                if (index === currentSlide) {
                    indicator.classList.add('active');
                } else {
                    indicator.classList.remove('active');
                }
            });
        }
        
        // Adjust carousel height based on content
        adjustCarouselHeight();
        
        // Re-initialize carousel on window resize for better responsiveness
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                // Adjust carousel height based on content
                adjustCarouselHeight();
            }, 250);
        });
    }

    // Function to adjust carousel height based on content
    function adjustCarouselHeight() {
        const carouselSlides = document.querySelectorAll('.carousel-slide');
        if (!carouselSlides.length) return;
        
        // Get viewport width to determine if we're on mobile
        const viewportWidth = window.innerWidth;
        
        // For mobile screens, ensure images are properly sized
        if (viewportWidth <= 767) {
            const images = document.querySelectorAll('.carousel-slide-image');
            images.forEach(img => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.maxHeight = viewportWidth <= 480 ? '120px' : '180px';
                img.style.margin = '0 auto var(--space-xs)';
            });
            
            // Show shorter text on mobile
            const fullTexts = document.querySelectorAll('.full-text');
            const shortTexts = document.querySelectorAll('.short-text');
            
            if (viewportWidth <= 480) {
                fullTexts.forEach(text => text.style.display = 'none');
                shortTexts.forEach(text => text.style.display = 'block');
            } else {
                fullTexts.forEach(text => text.style.display = 'block');
                shortTexts.forEach(text => text.style.display = 'none');
            }
        } else {
            // On desktop, show full text
            const fullTexts = document.querySelectorAll('.full-text');
            const shortTexts = document.querySelectorAll('.short-text');
            
            fullTexts.forEach(text => text.style.display = 'block');
            shortTexts.forEach(text => text.style.display = 'none');
        }
    }

    // Helper function to copy text to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy text: ', err);
            
            // Fallback method
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    // ===== WALLET CONNECTION FUNCTIONALITY =====
    function initWalletConnectButton() {
        const connectWalletBtn = document.getElementById('connectWallet');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', showWalletSelectionModal);
        }

        // Set up wallet selection modal
        const walletOptions = document.querySelectorAll('.wallet-option');
        walletOptions.forEach(option => {
            option.addEventListener('click', async () => {
                const walletType = option.dataset.wallet;
                try {
                    await connectWallet(walletType);
                    hideWalletSelectionModal();
                } catch (error) {
                    console.error(`Error connecting to ${walletType} wallet:`, error);
                    showModal("Connection Error", `<p>Failed to connect to ${walletType} wallet: ${error.message}</p>`);
                }
            });
        });

        // Close wallet modal buttons
        const walletModalClose = document.getElementById('walletModalClose');
        if (walletModalClose) {
            walletModalClose.addEventListener('click', hideWalletSelectionModal);
        }

        // Terms and Privacy Policy link
        const tcppLink = document.getElementById('tcppLink');
        if (tcppLink) {
            tcppLink.addEventListener('click', (e) => {
                e.preventDefault();
                showModal("Terms of Service & Privacy Policy", `
                    <h3>Terms of Service</h3>
                    <p>By using the Bitcoin Time Capsule, you agree to the following terms:</p>
                    <ul>
                        <li>This is an experimental application running on Bitcoin Signet testnet.</li>
                        <li>No real Bitcoin (BTC) is used in this application.</li>
                        <li>Messages stored in the Time Capsule will be publicly visible after the unlock block height.</li>
                        <li>We are not responsible for any loss of funds or data.</li>
                    </ul>
                    
                    <h3>Privacy Policy</h3>
                    <p>When using the Bitcoin Time Capsule:</p>
                    <ul>
                        <li>Your wallet address will be stored to associate with your messages.</li>
                        <li>Messages are encoded but will be publicly visible after unlock.</li>
                        <li>We do not collect any personal information beyond what is necessary for the application to function.</li>
                        <li>We use local storage to improve your experience but do not track your activity across other websites.</li>
                    </ul>
                `);
            });
        }
    }

    // Function to show wallet selection modal
    function showWalletSelectionModal() {
        const modal = document.getElementById('walletSelectionModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Function to hide wallet selection modal
    function hideWalletSelectionModal() {
        const modal = document.getElementById('walletSelectionModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Function to connect wallet
    async function connectWallet(walletType) {
        // Update status to connecting
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus) {
            walletStatus.textContent = `Wallet Status: Connecting to ${walletType}...`;
        }
        
        try {
            let account;
            
            switch(walletType) {
                case 'unisat':
                    if (!window.unisat) {
                        throw new Error("Unisat wallet not found. Please install the extension.");
                    }
                    
                    // Request account access
                    const accounts = await window.unisat.requestAccounts();
                    account = accounts[0];
                    
                    // Check if we're on Signet
                    const network = await window.unisat.getNetwork();
                    if (network !== 'signet') {
                        throw new Error("Please switch to Signet network in your Unisat wallet.");
                    }
                    break;
                    
                case 'xverse':
                    if (!window.SatsConnect) {
                        throw new Error("Xverse wallet not found. Please install the extension.");
                    }
                    
                    // Connect using SatsConnect
                    const connectOptions = {
                        payload: {
                            network: {
                                type: 'testnet'
                            },
                            appDetails: {
                                name: "Bitcoin Time Capsule",
                                icon: window.location.origin + "/favicon.ico"
                            }
                        },
                        onFinish: (response) => {
                            account = response.addresses[0].address;
                            updateWalletStatus(account, walletType);
                        },
                        onCancel: () => {
                            throw new Error("Connection cancelled by user.");
                        }
                    };
                    
                    window.SatsConnect.connect(connectOptions);
                    return; // Return early as this is handled in callbacks
                    
                case 'leather':
                    const provider = window.LeatherProvider || window.btc;
                    if (!provider) {
                        throw new Error("Leather wallet not found. Please install the extension.");
                    }
                    
                    // Request account access
                    const leatherAccounts = await provider.request('getAddresses');
                    account = leatherAccounts[0].address;
                    break;
                    
                case 'okx':
                    if (!window.okxwallet || !window.okxwallet.bitcoin) {
                        throw new Error("OKX wallet not found. Please install the extension.");
                    }
                    
                    // Request account access
                    const okxAccounts = await window.okxwallet.bitcoin.connect();
                    account = okxAccounts.address;
                    break;
                    
                default:
                    throw new Error(`Unsupported wallet type: ${walletType}`);
            }
            
            // Update wallet status
            updateWalletStatus(account, walletType);
            
        } catch (error) {
            console.error("Error connecting wallet:", error);
            
            // Update status to error
            if (walletStatus) {
                walletStatus.textContent = `Wallet Status: Connection Error`;
            }
            
            throw error;
        }
    }

    // Function to update wallet status
    function updateWalletStatus(account, walletType) {
        walletConnected = true;
        currentAccount = account;
        currentWalletType = walletType;
        
        // Update UI
        const walletStatus = document.getElementById('walletStatus');
        const connectWalletBtn = document.getElementById('connectWallet');
        
        if (walletStatus) {
            const shortAddress = `${account.substring(0, 6)}...${account.substring(account.length - 4)}`;
            walletStatus.textContent = `Connected: ${shortAddress}`;
            walletStatus.style.color = 'var(--color-success)';
        }
        
        if (connectWalletBtn) {
            connectWalletBtn.textContent = 'Disconnect';
            connectWalletBtn.removeEventListener('click', showWalletSelectionModal);
            connectWalletBtn.addEventListener('click', disconnectWallet);
        }
        
        // Load user's stored messages
        loadStoredMessages();
    }

    // Function to disconnect wallet
    function disconnectWallet() {
        walletConnected = false;
        currentAccount = null;
        currentWalletType = null;
        
        // Update UI
        const walletStatus = document.getElementById('walletStatus');
        const connectWalletBtn = document.getElementById('connectWallet');
        
        if (walletStatus) {
            walletStatus.textContent = 'Wallet Status: Not Connected';
            walletStatus.style.color = 'var(--color-warning)';
        }
        
        if (connectWalletBtn) {
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.removeEventListener('click', disconnectWallet);
            connectWalletBtn.addEventListener('click', showWalletSelectionModal);
        }
        
        // Clear stored messages
        const storedMessagesList = document.getElementById('storedMessagesList');
        if (storedMessagesList) {
            storedMessagesList.innerHTML = '<p>Connect your wallet to view your stored messages.</p>';
        }
    }

    // ===== MESSAGE FUNCTIONALITY =====
    function initMessageInput() {
        // Character counter for message input
        const messageInput = document.getElementById('message');
        if (messageInput) {
            messageInput.addEventListener('input', updateCharCount);
        }
        
        // Sign transaction button
        const signTransactionBtn = document.getElementById('signTransaction');
        if (signTransactionBtn) {
            signTransactionBtn.addEventListener('click', signAndSubmitTransaction);
        }
        
        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
                switchTab(tabId, this);
            });
        });
    }

    // Function to update character count
    function updateCharCount() {
        const messageInput = document.getElementById('message');
        const charCount = document.getElementById('charCount');
        const byteCount = document.getElementById('byteCount');
        
        if (messageInput && charCount && byteCount) {
            const text = messageInput.value;
            const chars = text.length;
            const bytes = new TextEncoder().encode(text).length;
            
            charCount.textContent = chars;
            byteCount.textContent = bytes;
            
            // Warn if over limit
            if (chars > 150 || bytes > 80) {
                charCount.style.color = 'var(--color-error)';
                byteCount.style.color = 'var(--color-error)';
            } else {
                charCount.style.color = '';
                byteCount.style.color = '';
            }
        }
    }

    // Function to encrypt message
    function encryptMessage() {
        const messageInput = document.getElementById('message');
        const encryptionResult = document.getElementById('encryptionResult');
        const encryptedMessageOutput = document.getElementById('encryptedMessageOutput');
        const output = document.getElementById('output');
        
        if (!messageInput || !encryptionResult || !encryptedMessageOutput || !output) {
            console.error("Required elements not found");
            return;
        }
        
        const message = messageInput.value.trim();
        
        if (!message) {
            showModal("Error", "<p>Please enter a message to encrypt.</p>");
            return;
        }
        
        if (message.length > 150 || new TextEncoder().encode(message).length > 80) {
            showModal("Error", "<p>Message is too long. Please keep it under 150 characters or 80 bytes.</p>");
            return;
        }
        
        if (!walletConnected) {
            showModal("Wallet Required", "<p>Please connect your wallet first to encrypt a message.</p>");
