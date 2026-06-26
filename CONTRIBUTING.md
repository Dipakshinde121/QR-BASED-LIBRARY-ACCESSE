# Contributing to QR-Based Library Access & Management System

Thank you for your interest in contributing to the **QR-Based Library Access & Management System**! Contributions from the open-source community help improve code quality, safety, and performance.

---

## 1. Onboarding & Setup Instructions

To set up a local development environment, follow these steps:

### A. Fork and Clone
1. Fork this repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/QR-BASED-LIBRARY-ACCESSE.git
   cd QR-BASED-LIBRARY-ACCESSE
   ```

### B. Environment Configuration
1. Initialize a Python virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate the virtual environment:
   * **Windows Powershell:** `.\.venv\Scripts\Activate.ps1`
   * **Linux/macOS:** `source .venv/bin/activate`
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root directory:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=library_access_db
   PORT=5000
   QR_ENCRYPTION_KEY=Op3ob-qUHFyWRuEBOuGS-L3l8T8CbtDtGVoIAe87vgc=
   ```

---

## 2. Running & Developing the Application

### A. Local Backend Server
Start the Flask development server (runs Socket.IO connections locally):
```bash
python backend/app.py
```
*Note: If MySQL is not running on localhost, the system automatically falls back to SQLite (`backend/library_access_sqlite.db`).*

### B. Static Frontend Server
Launch the HTTP static file server inside the `frontend/` directory:
```bash
cd frontend
python -m http.server 8000
```
Open `http://localhost:8000/index.html` in your web browser.

---

## 3. Testing Mapped Contributions

Before submitting a Pull Request, verify that your changes do not break existing workflows.

### A. Run Backend Unit Tests
Execute the pytest suite:
```bash
cd backend
pytest -v test_routes.py
```

### B. Run Backend Integration Tests
Execute the end-to-end user workflows verification script:
```bash
cd backend
python -u test_workflow.py
```

---

## 4. Coding & Component Conventions

Please adhere to the following project guidelines:
* **Stylesheets modularity:** Do not edit the massive root `frontend/style.css` directly with ad-hoc styling. Group components logically into `frontend/css/base.css`, `frontend/css/forms.css`, `frontend/css/tables.css`, or `frontend/css/components.css` and use imports.
* **Database fallback compatibility:** Ensure that any MySQL-specific DML queries are translated gracefully to SQLite dialect equivalents in the `SQLiteCursorWrapper` inside [db.py](file:///e:/QR-BASED-LIBRARY-ACCESSE/backend/db.py).
* **Documentation consistency:** Document any new endpoints in `openapi.json` and keep state updates logged in `BRAIN.MD`.

---

## 5. Submitting Pull Requests

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feature/your-awesome-change
   ```
2. Commit your modifications with meaningful messages:
   ```bash
   git commit -m "Explain what and why you changed"
   ```
3. Push to your branch and open a Pull Request targeting `main`. Ensure all unit tests are green!

---

## 6. License
By contributing, you agree that your contributions will be licensed under the project's [MIT License](file:///e:/QR-BASED-LIBRARY-ACCESSE/LICENSE).
