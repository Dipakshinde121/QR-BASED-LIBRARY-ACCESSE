document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Protection Check
    const adminUserStr = localStorage.getItem('adminUser');
    const adminToken = localStorage.getItem('adminToken');
    if (!adminUserStr || !adminToken) {
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
    const tabFines = document.getElementById('tab-fines');
    const tabAnalytics = document.getElementById('tab-analytics');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const sectionInventory = document.getElementById('section-inventory');
    const sectionCheckouts = document.getElementById('section-checkouts');
    const sectionFines = document.getElementById('section-fines');
    const sectionAnalytics = document.getElementById('section-analytics');
    const checkoutsTableBody = document.getElementById('checkouts-table-body');
    const checkoutsCount = document.getElementById('checkouts-count');
    const finesTableBody = document.getElementById('fines-table-body');
    const finesCount = document.getElementById('fines-count');
    const statStudents = document.getElementById('stat-students');
    const statActive = document.getElementById('stat-active');
    const statUnpaid = document.getElementById('stat-unpaid');
    const statPaid = document.getElementById('stat-paid');

    // Chart instances references to prevent reuse errors
    let mostBorrowedChartInstance = null;
    let hourlyCheckoutsChartInstance = null;

    // Update Welcome Title
    adminWelcome.textContent = `Welcome, ${adminUser.name}`;

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminToken');
        window.location.href = 'admin-login.html';
    });

    // Handle CSV Export Report Download
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', () => {
            const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/transactions/export`;
            
            // Disable button during download to prevent double clicks and show loading state
            downloadReportBtn.disabled = true;
            const originalHTML = downloadReportBtn.innerHTML;
            downloadReportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 5px;"></i>Downloading...';
            
            fetch(apiEndpoint, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            })
            .then(response => {
                if (response.status === 401) {
                    localStorage.removeItem('adminUser');
                    localStorage.removeItem('adminToken');
                    window.location.href = 'admin-login.html';
                    throw new Error('Unauthorized session. Please sign in again.');
                }
                if (!response.ok) {
                    throw new Error('Failed to generate export report.');
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'library_transactions_report.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                showToast('CSV transaction report downloaded successfully!', 'success');
            })
            .catch(error => {
                console.error('[Admin Dashboard] Export CSV error:', error);
                showToast(error.message || 'Error downloading CSV report.', 'error');
            })
            .finally(() => {
                downloadReportBtn.disabled = false;
                downloadReportBtn.innerHTML = originalHTML;
            });
        });
    }

    // Tab Switching Logic
    tabInventory.addEventListener('click', () => {
        switchTab('inventory');
    });

    tabCheckouts.addEventListener('click', () => {
        switchTab('checkouts');
    });

    if (tabFines) {
        tabFines.addEventListener('click', () => {
            switchTab('fines');
        });
    }

    if (tabAnalytics) {
        tabAnalytics.addEventListener('click', () => {
            switchTab('analytics');
        });
    }

    function switchTab(tabName) {
        // Reset tab active classes and styles
        tabInventory.classList.remove('active');
        tabCheckouts.classList.remove('active');
        if (tabFines) tabFines.classList.remove('active');
        if (tabAnalytics) tabAnalytics.classList.remove('active');
        
        tabInventory.style.color = 'var(--text-muted)';
        tabInventory.style.borderBottom = '3px solid transparent';
        tabCheckouts.style.color = 'var(--text-muted)';
        tabCheckouts.style.borderBottom = '3px solid transparent';
        if (tabFines) {
            tabFines.style.color = 'var(--text-muted)';
            tabFines.style.borderBottom = '3px solid transparent';
        }
        if (tabAnalytics) {
            tabAnalytics.style.color = 'var(--text-muted)';
            tabAnalytics.style.borderBottom = '3px solid transparent';
        }

        // Hide all sections
        sectionInventory.style.display = 'none';
        sectionCheckouts.style.display = 'none';
        if (sectionFines) sectionFines.style.display = 'none';
        if (sectionAnalytics) sectionAnalytics.style.display = 'none';

        if (tabName === 'inventory') {
            tabInventory.classList.add('active');
            tabInventory.style.color = 'var(--text-primary)';
            tabInventory.style.borderBottom = '3px solid var(--accent-cyan)';
            sectionInventory.style.display = 'block';
            fetchInventory();
        } else if (tabName === 'checkouts') {
            tabCheckouts.classList.add('active');
            tabCheckouts.style.color = 'var(--text-primary)';
            tabCheckouts.style.borderBottom = '3px solid var(--accent-cyan)';
            sectionCheckouts.style.display = 'block';
            fetchActiveCheckouts();
        } else if (tabName === 'fines') {
            if (tabFines) {
                tabFines.classList.add('active');
                tabFines.style.color = 'var(--text-primary)';
                tabFines.style.borderBottom = '3px solid var(--accent-cyan)';
            }
            if (sectionFines) sectionFines.style.display = 'block';
            fetchFines();
        } else if (tabName === 'analytics') {
            if (tabAnalytics) {
                tabAnalytics.classList.add('active');
                tabAnalytics.style.color = 'var(--text-primary)';
                tabAnalytics.style.borderBottom = '3px solid var(--accent-cyan)';
            }
            if (sectionAnalytics) sectionAnalytics.style.display = 'block';
            fetchAnalytics();
        }
    }

    // Load initial tab data
    fetchInventory();

    /**
     * Fetches all books from backend database and populates the dashboard UI table
     */
    function fetchInventory() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/inventory`;

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
                throw new Error('Unauthorized');
            }
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
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/active-checkouts`;

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
                throw new Error('Unauthorized');
            }
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

        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/return-book`;
        const payload = {
            transaction_id: transactionId
        };

        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.status === 401) {
                alert('Session expired. Please sign in again.');
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
                throw new Error('Unauthorized');
            }
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
            if (data.overdue) {
                showToast(`Overdue return! Fine of $${data.fine_amount.toFixed(2)} generated (${data.days_overdue} days late).`, 'error');
            } else {
                showToast('Book successfully returned.', 'success');
            }
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

    /**
     * Fetches all fines (active and historic) from the database
     */
    function fetchFines() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/fines`;

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                throw new Error('Failed to fetch library fines.');
            }
            return response.json();
        })
        .then(fines => {
            console.log('[Admin Dashboard] Fines loaded:', fines);
            
            finesCount.textContent = `${fines.length} Fine Record${fines.length !== 1 ? 's' : ''}`;
            finesTableBody.innerHTML = '';

            if (fines.length === 0) {
                finesTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 45px; text-align: center; color: var(--text-muted);">
                            <i class="fa-solid fa-face-smile" style="font-size: 24px; margin-bottom: 10px; opacity: 0.5; color: var(--accent-cyan);"></i>
                            <div>No library fines on record. Excellent!</div>
                        </td>
                    </tr>
                `;
                return;
            }

            fines.forEach(fine => {
                const row = document.createElement('tr');
                const isPaid = fine.status === 'paid';

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

                // Actions cell
                let actionBtn = '-';
                if (!isPaid) {
                    actionBtn = `
                        <button type="button" class="submit-btn collect-fine-btn" data-fine-id="${fine.id}" style="width: auto; padding: 6px 12px; font-size: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);">
                            <i class="fa-solid fa-cash-register" style="margin-right: 4px;"></i> Collect
                        </button>
                    `;
                }

                row.innerHTML = `
                    <td>
                        <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">${fine.student_name}</div>
                        <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">Roll: ${fine.student_roll || 'Admin'}</div>
                    </td>
                    <td>
                        <div style="font-weight: 500; color: var(--text-primary);">${fine.book_title}</div>
                    </td>
                    <td style="color: var(--text-muted); font-size: 13px; line-height: 1.4;">
                        <div><strong style="font-size: 10px; text-transform: uppercase; color: var(--text-muted);">Due:</strong> ${formattedDueDate}</div>
                        <div><strong style="font-size: 10px; text-transform: uppercase; color: var(--text-muted);">Ret:</strong> ${formattedReturnDate}</div>
                    </td>
                    <td style="font-weight: 600; color: ${isPaid ? 'var(--text-primary)' : '#ef4444'};">
                        $${fine.fine_amount.toFixed(2)}
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <i class="fa-solid ${statusIcon}"></i> ${statusText}
                        </span>
                    </td>
                    <td>
                        ${actionBtn}
                    </td>
                `;
                finesTableBody.appendChild(row);
            });

            // Attach listeners to Collect buttons
            document.querySelectorAll('.collect-fine-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fineId = e.currentTarget.getAttribute('data-fine-id');
                    if (confirm('Confirm payment collection for this fine?')) {
                        collectFinePayment(fineId);
                    }
                });
            });
        })
        .catch(error => {
            console.error('[Admin Dashboard] Fines fetch error:', error);
            finesCount.textContent = 'Connection Error';
            finesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 40px; text-align: center; color: hsl(346, 84%, 61%);">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <div>Failed to load fines database. Connect your backend server.</div>
                    </td>
                </tr>
            `;
        });
    }

    /**
     * Sends payment POST request to collect fine
     */
    function collectFinePayment(fineId) {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/pay-fine`;
        
        fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ fine_id: fineId })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'Payment collection failed.'); });
            }
            return response.json();
        })
        .then(data => {
            console.log('[Admin Dashboard] Fine paid successfully:', data);
            showToast('Fine payment collected successfully!', 'success');
            fetchFines();
        })
        .catch(error => {
            console.error('[Admin Dashboard] Fine payment collection error:', error);
            showToast(error.message || 'Error collecting fine payment.', 'error');
        });
    }

    /**
     * Fetches dynamic analytics stats from backend and renders visual metrics using Chart.js
     */
    function fetchAnalytics() {
        const apiEndpoint = `${CONFIG.API_BASE_URL}/api/admin/statistics`;

        fetch(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminToken');
                window.location.href = 'admin-login.html';
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                throw new Error('Failed to fetch analytics statistics.');
            }
            return response.json();
        })
        .then(data => {
            console.log('[Admin Dashboard] Analytics statistics loaded:', data);

            // Update Summary Stats Cards
            if (statStudents) statStudents.textContent = data.summary.total_students;
            if (statActive) statActive.textContent = data.summary.active_checkouts;
            if (statUnpaid) statUnpaid.textContent = `$${data.summary.total_fines_unpaid.toFixed(2)}`;
            if (statPaid) statPaid.textContent = `$${data.summary.total_fines_paid.toFixed(2)}`;

            // Render Charts
            renderMostBorrowedChart(data.most_borrowed);
            renderHourlyCheckoutsChart(data.hourly_checkouts);
        })
        .catch(error => {
            console.error('[Admin Dashboard] Analytics fetch error:', error);
            showToast(error.message || 'Failed to load analytics.', 'error');
        });
    }

    function renderMostBorrowedChart(mostBorrowed) {
        const ctx = document.getElementById('mostBorrowedChart');
        if (!ctx) return;

        // Destroy previous instance to prevent visual glitching
        if (mostBorrowedChartInstance) {
            mostBorrowedChartInstance.destroy();
        }

        const labels = mostBorrowed.map(item => item.title);
        const dataValues = mostBorrowed.map(item => item.count);

        // Gradient styling
        const canvasCtx = ctx.getContext('2d');
        const gradient = canvasCtx.createLinearGradient(0, 0, canvasCtx.canvas.width, 0);
        gradient.addColorStop(0, 'rgba(167, 139, 250, 0.85)'); // Violet 400
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.4)');   // Violet 600

        mostBorrowedChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Checkouts count',
                    data: dataValues,
                    backgroundColor: gradient,
                    borderColor: '#a78bfa',
                    borderWidth: 1.5,
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#18181b',
                        titleColor: '#f4f4f5',
                        bodyColor: '#a1a1aa',
                        borderColor: '#27272a',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Borrowed: ${context.parsed.x} times`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(39, 39, 42, 0.4)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#a1a1aa',
                            font: {
                                family: 'Outfit',
                                size: 11
                            },
                            stepSize: 1,
                            beginAtZero: true
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#f4f4f5',
                            font: {
                                family: 'Outfit',
                                size: 11,
                                weight: '500'
                            },
                            callback: function(value) {
                                // Shorten long book titles in Y-axis
                                const title = this.getLabelForValue(value);
                                return title.length > 22 ? title.substring(0, 20) + '...' : title;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderHourlyCheckoutsChart(hourlyCheckouts) {
        const ctx = document.getElementById('hourlyCheckoutsChart');
        if (!ctx) return;

        // Destroy previous instance
        if (hourlyCheckoutsChartInstance) {
            hourlyCheckoutsChartInstance.destroy();
        }

        // Sort hour keys (00, 01, ..., 23)
        const sortedHours = Object.keys(hourlyCheckouts).sort();
        const labels = sortedHours.map(hour => `${hour}:00`);
        const dataValues = sortedHours.map(hour => hourlyCheckouts[hour]);

        // Gradient fill styling
        const canvasCtx = ctx.getContext('2d');
        const fillGradient = canvasCtx.createLinearGradient(0, 0, 0, 260);
        fillGradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)');  // Cyan 400 semi-transparent
        fillGradient.addColorStop(1, 'rgba(34, 211, 238, 0.0)');  // Fade out completely

        hourlyCheckoutsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Checkouts',
                    data: dataValues,
                    borderColor: '#22d3ee', // Cyan 400
                    borderWidth: 2,
                    pointBackgroundColor: '#22d3ee',
                    pointBorderColor: '#18181b',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 6,
                    pointRadius: 4,
                    fill: true,
                    backgroundColor: fillGradient,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#18181b',
                        titleColor: '#f4f4f5',
                        bodyColor: '#a1a1aa',
                        borderColor: '#27272a',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Checkouts: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#a1a1aa',
                            font: {
                                family: 'Outfit',
                                size: 10
                            },
                            // Only show every 2 hours to avoid crowding
                            callback: function(val, index) {
                                return index % 2 === 0 ? this.getLabelForValue(val) : '';
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(39, 39, 42, 0.4)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#a1a1aa',
                            font: {
                                family: 'Outfit',
                                size: 11
                            },
                            stepSize: 1,
                            beginAtZero: true
                        }
                    }
                }
            }
        });
    }

    // Initialize Socket.IO connection to the backend sync server
    try {
        const socket = io(CONFIG.API_BASE_URL);
        
        socket.on('connect', () => {
            console.log('[WebSocket] Connected to real-time sync server.');
        });
        
        socket.on('checkout_update', (data) => {
            console.log('[WebSocket] Real-time checkout update received:', data);
            showToast(`${data.student_name} checked out "${data.book_title}"`, 'success');
            
            // Re-fetch lists dynamically depending on which tab is active
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                if (activeTab.id === 'tab-checkouts') {
                    fetchActiveCheckouts();
                } else if (activeTab.id === 'tab-inventory') {
                    fetchInventory();
                } else if (activeTab.id === 'tab-analytics') {
                    fetchAnalytics();
                }
            }
        });
        
        socket.on('return_update', (data) => {
            console.log('[WebSocket] Real-time return update received:', data);
            
            // Re-fetch lists dynamically depending on which tab is active
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                if (activeTab.id === 'tab-checkouts') {
                    fetchActiveCheckouts();
                } else if (activeTab.id === 'tab-inventory') {
                    fetchInventory();
                } else if (activeTab.id === 'tab-fines') {
                    fetchFines();
                } else if (activeTab.id === 'tab-analytics') {
                    fetchAnalytics();
                }
            }
        });
        
        socket.on('disconnect', () => {
            console.log('[WebSocket] Disconnected from server.');
        });
    } catch (wsErr) {
        console.error('[WebSocket] Initialization failed:', wsErr);
    }
});
