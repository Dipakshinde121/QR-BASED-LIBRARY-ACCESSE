document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pickupInput = document.getElementById('pickup-input');
    const submitBtn = document.getElementById('submit-btn');
    const qrContainer = document.querySelector('.qr-card-container');
    const qrPlaceholder = document.getElementById('qr-placeholder');

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
     * Handles the validation and visualization logic for the pick-up number submission
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

        // Log the captured text to the browser console as requested
        console.log(`[Library Kiosk] Captured Pick-Up Number: "${inputValue}"`);

        // Show generating state with animations
        triggerScannerState(inputValue);
    }

    /**
     * Triggers the scanning laser and transitions the placeholder to demonstrate interactivity
     */
    function triggerScannerState(value) {
        // Reset container classes
        qrContainer.classList.remove('success');
        qrContainer.classList.add('scanning');

        // Update placeholder to "generating" state
        qrPlaceholder.innerHTML = `
            <div class="qr-inner-content">
                <i class="fa-solid fa-spinner fa-spin qr-icon" style="color: var(--accent-cyan);"></i>
                <div class="qr-placeholder-text">Generating QR Code...</div>
                <div class="qr-placeholder-subtext">Configuring access keys for pick-up</div>
            </div>
        `;

        // Simulate QR code generation time (1.2 seconds)
        setTimeout(() => {
            // Remove scanning animation
            qrContainer.classList.remove('scanning');
            // Add success style class
            qrContainer.classList.add('success');

            // Render the success layout with the captured value
            qrPlaceholder.innerHTML = `
                <div class="qr-inner-content" style="opacity: 0; transform: translateY(10px); transition: var(--transition-smooth);">
                    <i class="fa-solid fa-circle-check qr-icon"></i>
                    <div class="qr-placeholder-text">Pick-Up Code Verified</div>
                    <div class="qr-placeholder-subtext">Temporary Code Preview:</div>
                    <div class="success-number">${value}</div>
                    <div class="qr-placeholder-subtext" style="margin-top: 8px; font-size: 10px;">
                        Interactive check complete. Ready for QR generator integration!
                    </div>
                </div>
            `;

            // Trigger reflow & fade in the success elements smoothly
            setTimeout(() => {
                const innerContent = qrPlaceholder.querySelector('.qr-inner-content');
                if (innerContent) {
                    innerContent.style.opacity = '1';
                    innerContent.style.transform = 'translateY(0)';
                }
            }, 50);

        }, 1200);
    }
});
