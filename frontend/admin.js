document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const submitBtn = document.getElementById('admin-login-btn');

    // Handle Form Submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent standard page reload

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        // Set Loading State on Button
        setButtonLoadingState(true);

        const payload = { email, password };

        // Post credentials to backend server
        fetch(`${CONFIG.API_BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                // Throw error with message from server if available
                throw new Error(data.message || 'Authentication failed.');
            }
            return data;
        })
        .then(result => {
            console.log('[Admin Auth] Authentication success:', result);
            
            // Store user session info (simulated session/JWT placeholder)
            localStorage.setItem('adminUser', JSON.stringify(result.user));
            localStorage.setItem('adminToken', result.token);

            // Redirect to admin dashboard on success
            window.location.href = 'admin-dashboard.html';
        })
        .catch(error => {
            console.error('[Admin Auth] Error:', error.message);
            alert(error.message);
            
            // Reset loader
            setButtonLoadingState(false);
            passwordInput.value = '';
            passwordInput.focus();
        });
    });

    /**
     * Toggles button loading state visually
     */
    function setButtonLoadingState(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.innerHTML = `
                <span>Authenticating...</span>
                <i class="fa-solid fa-spinner fa-spin button-icon"></i>
            `;
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = `
                <span>Authenticate</span>
                <i class="fa-solid fa-right-to-bracket button-icon"></i>
            `;
        }
    }
});
