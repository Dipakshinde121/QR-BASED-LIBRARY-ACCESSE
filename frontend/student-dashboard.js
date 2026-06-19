document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Protection Guard
    const studentUserStr = localStorage.getItem('studentUser');
    if (!studentUserStr) {
        alert('Session expired or unauthorized access. Please sign in.');
        window.location.href = 'student-login.html';
        return;
    }

    const studentUser = JSON.parse(studentUserStr);

    // DOM Elements
    const studentWelcome = document.getElementById('student-welcome');
    const studentRollDisplay = document.getElementById('student-roll-display');
    const logoutBtn = document.getElementById('logout-btn');
    const scanQrBtn = document.getElementById('scan-qr-btn');

    // Update Banner Info
    studentWelcome.textContent = `Welcome back, ${studentUser.name}`;
    studentRollDisplay.textContent = `Roll Number: ${studentUser.roll_number}`;

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('studentUser');
        window.location.href = 'student-login.html';
    });

    // Handle QR Scan Button Click (Foundation placeholder)
    scanQrBtn.addEventListener('click', () => {
        alert('Initializing Camera Scanner... \n(Scanner camera module implementation will be set up in the next phase!)');
    });
});
