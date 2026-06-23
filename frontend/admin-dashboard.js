document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Protection Check
    const adminUserStr = localStorage.getItem('adminUser');
    if (!adminUserStr) {
        alert('Session expired or unauthorized access. Please sign in.');
        window.location.href = 'admin-login.html';
        return;
    }

    const adminUser = JSON.parse(adminUserStr);
    
    // DOM Elements
    const adminWelcome = document.getElementById('admin-welcome');
    const logoutBtn = document.getElementById('logout-btn');
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const inventoryCount = document.getElementById('inventory-count');
    
    const tabInventory = document.getElementById('tab-inventory');
    const tabCheckouts = document.getElementById('tab-checkouts');
    const sectionInventory = document.getElementById('section-inventory');
    const sectionCheckouts = document.getElementById('section-checkouts');
    const checkoutsTableBody = document.getElementById('checkouts-table-body');
    const checkoutsCount = document.getElementById('checkouts-count');

    // Update Welcome Title
    adminWelcome.textContent = `Welcome, ${adminUser.name}`;

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminUser');
        window.location.href = 'admin-login.html';
    });

    // Tab Switching Logic
    tabInventory.addEventListener('click', () => {
        switchTab('inventory');
    });

    tabCheckouts.addEventListener('click', () => {
        switchTab('checkouts');
    });

    function switchTab(tabName) {
        if (tabName === 'inventory') {
            tabInventory.classList.add('active');
            tabCheckouts.classList.remove('active');
            tabInventory.style.color = 'var(--text-primary)';
            tabInventory.style.borderBottom = '3px solid var(--accent-cyan)';
            tabCheckouts.style.color = 'var(--text-muted)';
            tabCheckouts.style.borderBottom = '3px solid transparent';

            sectionInventory.style.display = 'block';
            sectionCheckouts.style.display = 'none';
            fetchInventory();
        } else {
            tabCheckouts.classList.add('active');
            tabInventory.classList.remove('active');
            tabCheckouts.style.color = 'var(--text-primary)';
            tabCheckouts.style.borderBottom = '3px solid var(--accent-cyan)';
            tabInventory.style.color = 'var(--text-muted)';
            tabInventory.style.borderBottom = '3px solid transparent';

            sectionCheckouts.style.display = 'block';
            sectionInventory.style.display = 'none';
            fetchActiveCheckouts();
        }
    }

    // Load initial tab data
    fetchInventory();

    /**
     * Fetches all books from backend database and populates the dashboard UI table
     */
    function fetchInventory() {
        const apiEndpoint = 'http://localhost:5000/api/admin/inventory';

        fetch(apiEndpoint)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch library inventory.');
                }
                return response.json();
            })
            .then(books => {
                console.log('[Admin Dashboard] Inventory loaded:', books);
                
                // Update Total Count Badge
                inventoryCount.textContent = `${books.length} Books Registered`;

                // Clear Table Body
                inventoryTableBody.innerHTML = '';

                if (books.length === 0) {
                    inventoryTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" style="padding: 45px; text-align: center; color: var(--text-muted);">
                                <i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 10px; opacity: 0.5;"></i>
                                <div>No books registered in database yet.</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                // Loop through books and create rows
                books.forEach(book => {
                    const row = document.createElement('tr');
                    
                    // Format Status Badge Style
                    const statusClass = `status-${book.status}`;
                    let statusIcon = 'fa-circle-check';
                    if (book.status === 'checked_out') statusIcon = 'fa-clock';
                    if (book.status === 'maintenance') statusIcon = 'fa-triangle-exclamation';

                    const statusText = book.status.replace('_', ' ');

                    row.innerHTML = `
                        <td style="font-family: monospace; font-weight: 600; color: var(--accent-cyan); letter-spacing: 0.5px;">
                            ${book.book_uid}
                        </td>
                        <td>
                            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${book.title}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">by ${book.author}</div>
                        </td>
                        <td style="color: var(--text-muted);">
                            <i class="fa-solid fa-location-dot" style="font-size: 11px; margin-right: 4px; color: var(--accent-cyan); opacity: 0.7;"></i>
                            ${book.slot_location}
                        </td>
                        <td>
                            <span class="status-badge ${statusClass}">
                                <i class="fa-solid ${statusIcon}"></i> ${statusText}
                            </span>
                        </td>
                    `;
                    inventoryTableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('[Admin Dashboard] Fetch error:', error);
                inventoryCount.textContent = 'Connection Error';
                inventoryTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="padding: 45px; text-align: center; color: hsl(346, 84%, 61%);">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>Failed to load inventory. Connect your backend server.</div>
                            <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">Error: ${error.message}</div>
                        </td>
                    </tr>
                `;
            });
    }

    /**
     * Fetches all active checkouts from backend database and populates the checkouts table
     */
    function fetchActiveCheckouts() {
        const apiEndpoint = 'http://localhost:5000/api/admin/active-checkouts';

        fetch(apiEndpoint)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch active checkouts.');
                }
                return response.json();
            })
            .then(checkouts => {
                console.log('[Admin Dashboard] Active checkouts loaded:', checkouts);
                
                // Update Count Badge
                checkoutsCount.textContent = `${checkouts.length} Active Checkouts`;

                // Clear Table Body
                checkoutsTableBody.innerHTML = '';

                if (checkouts.length === 0) {
                    checkoutsTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="padding: 45px; text-align: center; color: var(--text-muted);">
                                <i class="fa-solid fa-clock-rotate-left" style="font-size: 24px; margin-bottom: 10px; opacity: 0.5;"></i>
                                <div>No active checkouts found.</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                // Loop through checkouts and create rows
                checkouts.forEach(checkout => {
                    const row = document.createElement('tr');
                    
                    // Format Checkout Date
                    const checkoutDate = new Date(checkout.checkout_time);
                    const formattedCheckoutDate = checkoutDate.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    // Date Math for Time Remaining
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
                            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${checkout.student_name}</div>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">Roll: ${checkout.student_roll}</div>
                        </td>
                        <td>
                            <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${checkout.book_title}</div>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">ID: ${checkout.book_uid}</div>
                        </td>
                        <td style="color: var(--text-muted); font-size: 13px;">
                            <i class="fa-regular fa-calendar-days" style="margin-right: 5px;"></i>${formattedCheckoutDate}
                        </td>
                        <td>
                            <span class="status-badge ${remainingClass}">
                                <i class="fa-solid ${remainingIcon}"></i> ${remainingText}
                            </span>
                        </td>
                        <td>
                            <button type="button" class="submit-btn return-btn" data-id="${checkout.id}" style="width: auto; padding: 6px 12px; font-size: 12px; margin: 0; background: linear-gradient(135deg, var(--accent-cyan), #0891b2); height: auto; line-height: normal; box-shadow: 0 2px 6px rgba(8, 145, 178, 0.2);">
                                <i class="fa-solid fa-arrow-rotate-left" style="margin-right: 4px;"></i> Mark as Returned
                            </button>
                        </td>
                    `;
                    checkoutsTableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('[Admin Dashboard] Checkouts fetch error:', error);
                checkoutsCount.textContent = 'Connection Error';
                checkoutsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="padding: 45px; text-align: center; color: hsl(346, 84%, 61%);">
                            <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <div>Failed to load checkouts. Connect your backend server.</div>
                            <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">Error: ${error.message}</div>
                        </td>
                    </tr>
                `;
            });
    }

    // Set up event delegation on active checkouts table for returning books
    checkoutsTableBody.addEventListener('click', (e) => {
        const returnBtn = e.target.closest('.return-btn');
        if (returnBtn) {
            const transactionId = returnBtn.getAttribute('data-id');
            handleBookReturn(transactionId);
        }
    });

    // Handle book return request
    function handleBookReturn(transactionId) {
        if (!confirm("Confirm book return?")) {
            return;
        }

        const apiEndpoint = 'http://localhost:5000/api/admin/return-book';
        const payload = {
            transaction_id: transactionId
        };

        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.message || 'Failed to process book return.');
                }).catch(() => {
                    throw new Error('Failed to process book return.');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('[Admin Dashboard] Book return successful:', data);
            showToast('Book successfully returned.', 'success');
            fetchActiveCheckouts();
            fetchInventory();
        })
        .catch(error => {
            console.error('[Admin Dashboard] Return error:', error);
            showToast(error.message || 'Connection error during return.', 'error');
        });
    }

    // Toast notification utility for Admin Dashboard
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
});
