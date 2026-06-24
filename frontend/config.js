// Centralized Frontend Configuration
const CONFIG = {
    // Dynamically choose between local development server or public URL
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://your-backend-subdomain.onrender.com' // Replace with your live Render/PythonAnywhere backend URL
};
