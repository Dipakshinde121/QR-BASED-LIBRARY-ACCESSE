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
    const tableBody = document.getElementById('inventory-table-body');
    const inventoryCount = document.getElementById('inventory-count');

    // Update Welcome Title
    adminWelcome.textContent = `Welcome, ${adminUser.name}`;

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminUser');
        window.location.href = 'admin-login.html';
    });

    // Load Live Inventory
    fetchInventory();

    /**
     * Fetches all books from backend database and populates the dashboard UI table
     */
    function fetchInventory() {
        // API Endpoint (defined in backend/routes/admin.js)
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

                // Clear Loading Row
                tableBody.innerHTML = '';

                if (books.length === 0) {
                    tableBody.innerHTML = `
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
                    tableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('[Admin Dashboard] Fetch error:', error);
                inventoryCount.textContent = 'Connection Error';
                tableBody.innerHTML = `
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
});
