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
        window.location.href = 'student-login.html';
    });

    // Handle QR Scan Button Click
    scanQrBtn.addEventListener('click', () => {
        alert('Initializing Camera Scanner... \n(Scanner camera module implementation will be set up in the next phase!)');
    });

    // Load initial data
    fetchMyBooks();
    fetchAvailableBooks();

    /**
     * Fetches current student's active unreturned borrow logs from backend
     */
    function fetchMyBooks() {
        const apiEndpoint = `http://localhost:5000/api/student/active-checkouts/${studentUser.id}`;

        fetch(apiEndpoint)
            .then(response => {
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
        const apiEndpoint = 'http://localhost:5000/api/books/available';

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
