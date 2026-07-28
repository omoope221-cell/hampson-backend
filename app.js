const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xssSanitize = require('./middleware/xssSanitize');

const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { apiLimiter } = require('./middleware/rateLimiter');
const apiRouter = require('./routes');

const app = express();

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — locked to the configured client origin, credentials allowed for
// the httpOnly refresh-token cookie.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body & cookie parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Sanitize against NoSQL injection & XSS
app.use(mongoSanitize());
app.use(xssSanitize);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting on the whole API
app.use('/api', apiLimiter);

// Static file serving for uploaded passports/profile pictures
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check (unauthenticated, useful for uptime monitors / load balancers)
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date().toISOString() }));

// Versioned API
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}`, apiRouter);

// This is a private system — there is intentionally no public-facing
// content served outside of /api/*, /uploads/* and /health.
app.all('*', notFound);

app.use(errorHandler);

module.exports = app;
