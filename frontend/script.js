document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pickupInput = document.getElementById('pickup-input');
    const submitBtn = document.getElementById('submit-btn');
    const qrContainer = document.querySelector('.qr-card-container');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    
    // Dynamic book details panel elements
    const bookInfoCard = document.getElementById('book-info');
    const bookTitle = document.getElementById('book-title');
    const bookAuthor = document.getElementById('book-author');
    const bookLocation = document.getElementById('book-location');

    // Submit button event listener
    submitBtn.addEventListener('click', () => {
        handlePickupSubmission();
    });

    // Support submitting by pressing Enter in the input field
    pickupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handlePickupSubmission();
        }
    });

    /**
     * Handles the validation and execution of the pick-up lookup
     */
    function handlePickupSubmission() {
        // Capture and trim the input value
        const inputValue = pickupInput.value.trim();

        // Check if the input is empty
        if (!inputValue) {
            alert("Please enter a number.");
            
            // Highlight input with a temporary error glow
            pickupInput.style.borderColor = 'hsl(346, 84%, 61%)'; // Neon red
            pickupInput.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.25)';
            setTimeout(() => {
                pickupInput.style.borderColor = '';
                pickupInput.style.boxShadow = '';
            }, 1500);
            
            pickupInput.focus();
            return;
        }

        console.log(`[Library Kiosk] Querying pick-up number: "${inputValue}"`);

        // Trigger loading and fetch backend API
        fetchBookDetails(inputValue);
    }

    /**
     * Fetches book details from the backend database via the Express API
     */
    function fetchBookDetails(bookUid) {
        // Prepare UI: Trigger scanning state and show loading indicator
        qrContainer.classList.remove('success');
        qrContainer.classList.add('scanning');
        qrPlaceholder.innerHTML = `
            <div class="qr-inner-content">
                <i class="fa-solid fa-spinner fa-spin qr-icon" style="color: var(--accent-cyan);"></i>
                <div class="qr-placeholder-text">Searching Database...</div>
                <div class="qr-placeholder-subtext">Fetching book details from backend server</div>
            </div>
        `;
        
        // Hide book info from previous searches
        bookInfoCard.style.display = 'none';

        // Read API endpoint from configuration
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/books/pickup/${encodeURIComponent(bookUid)}`;

        fetch(apiEndpoint)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('NOT_FOUND');
                    } else {
                        throw new Error('SERVER_ERROR');
                    }
                }
                return response.json();
            })
            .then(book => {
                console.log("[Library Kiosk] Book data fetched successfully:", book);
                
                // Add a small 1-second delay for smooth scanning visual transition
                setTimeout(() => {
                    // Reset scanner laser
                    qrContainer.classList.remove('scanning');
                    qrContainer.classList.add('success');

                    // 1. Populate and show the book info card above the QR placeholder
                    bookTitle.textContent = book.title;
                    bookAuthor.textContent = `by ${book.author}`;
                    bookLocation.textContent = book.slot_location;
                    bookInfoCard.style.display = 'block';

                    // 2. Clear placeholder and render real QR code canvas
                    qrPlaceholder.innerHTML = '';
                    
                    const canvas = document.createElement('canvas');
                    canvas.id = 'qr-canvas';
                    canvas.style.opacity = '0';
                    canvas.style.transform = 'scale(0.8)';
                    canvas.style.transition = 'var(--transition-smooth)';
                    qrPlaceholder.appendChild(canvas);

                    new QRious({
                        element: canvas,
                        value: book.encrypted_payload, // Raw encrypted Fernet string
                        size: 200,
                        background: 'transparent',
                        foreground: '#06b6d4', // Accent cyan color
                        level: 'H'
                    });

                    // Trigger smooth entry transitions
                    setTimeout(() => {
                        canvas.style.opacity = '1';
                        canvas.style.transform = 'scale(1)';
                    }, 50);

                }, 1000);
            })
            .catch(error => {
                console.error("[Library Kiosk] API request failed:", error);
                
                // Reset loader state with transition
                setTimeout(() => {
                    qrContainer.classList.remove('scanning');
                    resetPlaceholder();

                    if (error.message === 'NOT_FOUND') {
                        alert("Invalid pick-up number. Please try again.");
                    } else {
                        alert("Could not connect to the backend server. Make sure it is running on port 5000.");
                    }
                }, 1000);
            });
    }

    /**
     * Resets the QR placeholder back to its default inactive state
     */
    function resetPlaceholder() {
        qrPlaceholder.innerHTML = `
            <div class="qr-inner-content">
                <i class="fa-solid fa-qrcode qr-icon"></i>
                <div class="qr-placeholder-text">Awaiting Pick-Up Number</div>
                <div class="qr-placeholder-subtext">Enter your number above to initialize the QR code</div>
            </div>
        `;
    }

    /**
     * Generates a mock SHA-like secure session token/hash for the payload
     */
    function generateMockSecureHash(uid) {
        const rawString = `${uid}-${new Date().getTime()}-SecureSaltKey`;
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            const char = rawString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
});
