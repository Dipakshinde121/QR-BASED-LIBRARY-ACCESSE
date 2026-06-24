document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Protection Guard
    const studentUserStr = localStorage.getItem('studentUser');
    const studentToken = localStorage.getItem('studentToken');
    if (!studentUserStr || !studentToken) {
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
    
    const myBooksTableBody = document.getElementById('my-books-table-body');
    const myBooksCount = document.getElementById('my-books-count');
    const availableBooksTableBody = document.getElementById('available-books-table-body');
    const availableBooksCount = document.getElementById('available-books-count');

    // Update Banner Info
    studentWelcome.textContent = `Welcome back, ${studentUser.name}`;
    studentRollDisplay.textContent = `Roll Number: ${studentUser.roll_number}`;

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('studentUser');
        localStorage.removeItem('studentToken');
        window.location.href = 'student-login.html';
    });

    // Modal & Scanner Elements
    const scannerModal = document.getElementById('scanner-modal');
    const closeScannerHeaderBtn = document.getElementById('close-scanner-header-btn');
    const closeScannerBtn = document.getElementById('close-scanner-btn');
    const scannerStatus = document.getElementById('scanner-status');
    let html5QrCode = null;

    // Handle QR Scan Button Click
    scanQrBtn.addEventListener('click', () => {
        // Open Modal
        scannerModal.classList.add('active');
        scannerStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--accent-purple);"></i> <span>Requesting camera access...</span>`;
        
        // Initialize HTML5 QR Code instance
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }

        // Start scanning with environment/back camera if possible, fallback to user/front
        const config = {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).then(() => {
            scannerStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-cyan);"></i> <span style="color: var(--accent-cyan); font-weight: 600;">Camera active. Scanning...</span>`;
        }).catch(err => {
            console.warn('[Scanner] Back camera fail, trying front:', err);
            // Fallback to front camera if environment camera is not available
            html5QrCode.start(
                { facingMode: "user" },
                config,
                onScanSuccess,
                onScanFailure
            ).then(() => {
                scannerStatus.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-cyan);"></i> <span style="color: var(--accent-cyan); font-weight: 600;">Front camera active. Scanning...</span>`;
            }).catch(userErr => {
                console.error('[Scanner] Both cameras failed:', userErr);
                scannerStatus.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: hsl(346, 84%, 61%);"></i> <span style="color: hsl(346, 84%, 61%);">Camera error: ${userErr.message || 'Permission denied'}</span>`;
            });
        });
    });

    // Close Scanner functions
    function stopAndCloseScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            scannerStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--text-muted);"></i> <span>Stopping camera...</span>`;
            html5QrCode.stop().then(() => {
                console.log('[Scanner] Camera stream stopped successfully.');
                scannerModal.classList.remove('active');
            }).catch(err => {
                console.error('[Scanner] Error stopping:', err);
                scannerModal.classList.remove('active');
            });
        } else {
            scannerModal.classList.remove('active');
        }
    }

    closeScannerHeaderBtn.addEventListener('click', stopAndCloseScanner);
    closeScannerBtn.addEventListener('click', stopAndCloseScanner);

    // Callbacks
    function onScanSuccess(decodedText, decodedResult) {
        console.log('[Scanner] QR Code detected:', decodedText);
        
        // Stop scanning immediately to release camera resources
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                console.log('[Scanner] Scanner stopped after successful read.');
                scannerModal.classList.remove('active');
                
                // Process and display payload
                handleDecodedPayload(decodedText);
            }).catch(err => {
                console.error('[Scanner] Error stopping after success:', err);
                scannerModal.classList.remove('active');
                handleDecodedPayload(decodedText);
            });
        } else {
            scannerModal.classList.remove('active');
            handleDecodedPayload(decodedText);
        }
    }

    function onScanFailure(error) {
        // Quietly fail as scanning searches every frame, do not spam console
    }

    // Toast notification utility
    function showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' 
            ? '<i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 18px;"></i>' 
            : '<i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 18px;"></i>';

        toast.innerHTML = `
            ${icon}
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Show transition
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 50);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    function handleDecodedPayload(text) {
        console.log('[Scanner] Processing decoded payload...');
        const bookIdPayload = text.trim();
        
        if (!bookIdPayload) {
            showToast('Invalid Library QR Code.', 'error');
            return;
        }

        // 2. Perform Checkout fetch POST
        const checkoutEndpoint = `${CONFIG.API_BASE_URL}/api/student/checkout`;
        const requestPayload = {
            user_id: studentUser.id,
            book_id: bookIdPayload
        };

        console.log('[Scanner] Sending checkout request with encrypted QR token...');

        fetch(checkoutEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${studentToken}`
            },
            body: JSON.stringify(requestPayload)
        })
        .then(response => {
            if (response.status === 401) {
                alert('Session expired. Please sign in again.');
                localStorage.removeItem('studentUser');
                localStorage.removeItem('studentToken');
                window.location.href = 'student-login.html';
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                // Read the error message from response if possible
                return response.json().then(errData => {
                    throw new Error(errData.message || 'Checkout request failed.');
                }).catch(() => {
                    throw new Error('Checkout request failed.');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('[Scanner] Checkout successful:', data);
            
            // Show premium success notification
            showToast('Book Successfully Checked Out!', 'success');
            
            // Refresh dashboard lists immediately
            fetchMyBooks();
            fetchAvailableBooks();
            fetchFines();
        })
        .catch(error => {
            console.error('[Scanner] Checkout error:', error);
            showToast(error.message || 'Failed to connect to checkout server.', 'error');
        });
    }



    // Load initial data
    fetchMyBooks();
    fetchAvailableBooks();
    fetchFines();

    /**
     * Fetches student's fines history and checks for unpaid fees
     */
    function fetchFines() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/student/fines/${studentUser.id}`;
        const unpaidAlert = document.getElementById('unpaid-fines-alert');
        const sectionFines = document.getElementById('section-fines');
        const finesTableBody = document.getElementById('my-fines-table-body');
        const finesTotalSpan = document.getElementById('my-fines-total');

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${studentToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('studentUser');
                localStorage.removeItem('studentToken');
                window.location.href = 'student-login.html';
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                throw new Error('Failed to fetch fine records.');
            }
            return response.json();
        })
        .then(fines => {
            console.log('[Student Dashboard] Fines loaded:', fines);
            
            let totalUnpaid = 0.0;
            let unpaidCount = 0;
            
            finesTableBody.innerHTML = '';
            
            if (fines.length === 0) {
                sectionFines.style.display = 'none';
                unpaidAlert.style.display = 'none';
                return;
            }

            sectionFines.style.display = 'block';

            fines.forEach(fine => {
                const isPaid = fine.status === 'paid';
                if (!isPaid) {
                    totalUnpaid += fine.fine_amount;
                    unpaidCount++;
                }

                const row = document.createElement('tr');

                // Format Dates
                const dueDate = new Date(fine.due_time);
                const formattedDueDate = dueDate.toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                let formattedReturnDate = '-';
                if (fine.return_time) {
                    const returnDate = new Date(fine.return_time);
                    formattedReturnDate = returnDate.toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }

                const statusClass = isPaid ? 'status-ok' : 'status-overdue';
                const statusIcon = isPaid ? 'fa-circle-check' : 'fa-triangle-exclamation';
                const statusText = isPaid ? 'Paid' : 'Unpaid';

                row.innerHTML = `
                    <td>
                        <div style="font-weight: 500; color: var(--text-primary);">${fine.book_title}</div>
                    </td>
                    <td style="color: var(--text-muted); font-size: 13px;">${formattedDueDate}</td>
                    <td style="color: var(--text-muted); font-size: 13px;">${formattedReturnDate}</td>
                    <td style="font-weight: 600; color: ${isPaid ? 'var(--text-primary)' : '#ef4444'};">
                        $${fine.fine_amount.toFixed(2)}
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="fa-solid ${statusIcon}"></i> ${statusText}
                        </span>
                    </td>
                `;
                finesTableBody.appendChild(row);
            });

            // Update Fines Badge Total
            finesTotalSpan.textContent = `Unpaid Fines: $${totalUnpaid.toFixed(2)}`;

            // Toggle Alert Warning Banner
            if (unpaidCount > 0) {
                unpaidAlert.style.display = 'flex';
                document.getElementById('fines-alert-message').textContent = 
                    `You have ${unpaidCount} outstanding library fine(s) totaling $${totalUnpaid.toFixed(2)}. New checkouts are blocked until all fines are paid.`;
            } else {
                unpaidAlert.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('[Student Dashboard] Fines fetch error:', error);
        });
    }

    /**
     * Fetches current student's active unreturned borrow logs from backend
     */
    function fetchMyBooks() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/student/active-checkouts/${studentUser.id}`;

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${studentToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('studentUser');
                localStorage.removeItem('studentToken');
                window.location.href = 'student-login.html';
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                throw new Error('Failed to fetch your borrow records.');
            }
            return response.json();
        })
            .then(checkouts => {
                console.log('[Student Dashboard] Borrow logs loaded:', checkouts);
                myBooksCount.textContent = `${checkouts.length} Book${checkouts.length !== 1 ? 's' : ''} Checked Out`;
                
                myBooksTableBody.innerHTML = '';

                if (checkouts.length === 0) {
                    myBooksTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" style="padding: 45px; text-align: center; color: var(--text-muted);">
                                <i class="fa-solid fa-book-open" style="font-size: 28px; margin-bottom: 10px; opacity: 0.5; color: var(--accent-cyan);"></i>
                                <div style="font-weight: 500; color: var(--text-primary);">No Books Checked Out</div>
                                <div style="font-size: 12px; margin-top: 4px;">Use the scanner to borrow books from the library.</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                checkouts.forEach(checkout => {
                    const row = document.createElement('tr');

                    // Format Date
                    const checkoutDate = new Date(checkout.checkout_time);
                    const formattedDate = checkoutDate.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });

                    // Countdown Math
                    const dueDate = new Date(checkout.due_time);
                    const now = new Date();
                    const diffMs = dueDate - now;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                    let remainingClass = '';
                    let remainingText = '';
                    let remainingIcon = '';

                    if (diffMs < 0) {
                        remainingClass = 'status-overdue';
                        remainingText = 'Overdue';
                        remainingIcon = 'fa-triangle-exclamation';
                    } else if (diffDays <= 3) {
                        remainingClass = 'status-warning';
                        remainingText = `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;
                        remainingIcon = 'fa-hourglass-half';
                    } else {
                        remainingClass = 'status-ok';
                        remainingText = `${diffDays} days left`;
                        remainingIcon = 'fa-circle-check';
                    }

                    row.innerHTML = `
                        <td>
                            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${checkout.book_title}</div>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">ID: ${checkout.book_uid}</div>
                        </td>
                        <td style="color: var(--text-muted);">
                            <i class="fa-solid fa-location-dot" style="font-size: 11px; margin-right: 4px; color: var(--accent-cyan); opacity: 0.7;"></i>
                            ${checkout.slot_location}
                        </td>
                        <td style="color: var(--text-muted); font-size: 13px;">
                            ${formattedDate}
                        </td>
                        <td>
                            <span class="status-badge ${remainingClass}">
                                <i class="fa-solid ${remainingIcon}"></i> ${remainingText}
                            </span>
                        </td>
                    `;
                    myBooksTableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('[Student Dashboard] My books fetch error:', error);
                myBooksCount.textContent = 'Connection Error';
                myBooksTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="padding: 40px; text-align: center; color: hsl(346, 84%, 61%);">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>Failed to load borrow records. Connect backend server.</div>
                        </td>
                    </tr>
                `;
            });
    }

    /**
     * Fetches all available books from backend database catalog
     */
    function fetchAvailableBooks() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/books/available`;

        fetch(apiEndpoint)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch available catalog.');
                }
                return response.json();
            })
            .then(books => {
                console.log('[Student Dashboard] Available catalog loaded:', books);
                availableBooksCount.textContent = `${books.length} Book${books.length !== 1 ? 's' : ''} Available`;

                availableBooksTableBody.innerHTML = '';

                if (books.length === 0) {
                    availableBooksTableBody.innerHTML = `
                        <tr>
                            <td colspan="2" style="padding: 45px; text-align: center; color: var(--text-muted);">
                                <i class="fa-solid fa-book-bookmark" style="font-size: 28px; margin-bottom: 10px; opacity: 0.5; color: var(--accent-purple);"></i>
                                <div style="font-weight: 500; color: var(--text-primary);">No Available Books</div>
                                <div style="font-size: 12px; margin-top: 4px;">All library books are currently checked out.</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                books.forEach(book => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>
                            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${book.title}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">by ${book.author}</div>
                        </td>
                        <td style="color: var(--text-muted);">
                            <i class="fa-solid fa-location-dot" style="font-size: 11px; margin-right: 4px; color: var(--accent-purple); opacity: 0.7;"></i>
                            ${book.slot_location}
                        </td>
                    `;
                    availableBooksTableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('[Student Dashboard] Available books fetch error:', error);
                availableBooksCount.textContent = 'Connection Error';
                availableBooksTableBody.innerHTML = `
                    <tr>
                        <td colspan="2" style="padding: 40px; text-align: center; color: hsl(346, 84%, 61%);">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>Failed to load available catalog. Connect backend server.</div>
                        </td>
                    </tr>
                `;
            });
    }
});
