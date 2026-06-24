document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('student-login-form');
    const rollInput = document.getElementById('student-roll');
    const passwordInput = document.getElementById('student-password');
    const submitBtn = document.getElementById('student-login-btn');

    // Handle Form Submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent page reload

        const rollNumber = rollInput.value.trim();
        const password = passwordInput.value;

        if (!rollNumber || !password) {
            alert("Please enter both roll number and password.");
            return;
        }

        // Set Loading State
        setButtonLoadingState(true);

        const payload = { roll_number: rollNumber, password };

        // Post credentials to backend student login API
        fetch(`${CONFIG.API_BASE_URL}/api/student/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Authentication failed.');
            }
            return data;
        })
        .then(result => {
            console.log('[Student Auth] Authentication success:', result);
            
            // Store user session info
            localStorage.setItem('studentUser', JSON.stringify(result.user));
            localStorage.setItem('studentToken', result.token);

            // Redirect to student dashboard on success
            window.location.href = 'student-dashboard.html';
        })
        .catch(error => {
            console.error('[Student Auth] Error:', error.message);
            alert(error.message);
            
            // Reset state
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
                <span>Logging in...</span>
                <i class="fa-solid fa-spinner fa-spin button-icon"></i>
            `;
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.innerHTML = `
                <span>Login</span>
                <i class="fa-solid fa-right-to-bracket button-icon"></i>
            `;
        }
    }
});
