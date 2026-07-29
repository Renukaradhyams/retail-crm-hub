"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const initDb_1 = require("./initDb");
const auth_1 = __importDefault(require("./routes/auth"));
const crm_1 = __importDefault(require("./routes/crm"));
const cash_1 = __importDefault(require("./routes/cash"));
const vm_1 = __importDefault(require("./routes/vm"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security & Middleware
app.set('trust proxy', 1); // Trust first proxy (Hostinger Passenger)
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://aradhyanextgenlabs.space',
    'http://aradhyanextgenlabs.space',
];
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);
// Mount API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/crm', crm_1.default);
app.use('/api/cash', cash_1.default);
app.use('/api/vm', vm_1.default);
app.use('/api/attendance', attendance_1.default);
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Serve static assets from frontend build folder (always, not just in production)
const frontendDist = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendDist));
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(frontendDist, 'index.html'));
});
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});
// Initialize DB and start server
(0, initDb_1.initDb)().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 BSC Retail CRM Backend listening on http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
