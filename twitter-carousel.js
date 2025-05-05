// Twitter Carousel Implementation
document.addEventListener('DOMContentLoaded', function() {
    initTwitterCarousel();
    
    // Re-initialize carousel on window resize for better responsiveness
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Adjust carousel height based on content
            adjustCarouselHeight();
        }, 250);
    });
});

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
    
    // Initial adjustment of carousel height
    adjustCarouselHeight();
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
