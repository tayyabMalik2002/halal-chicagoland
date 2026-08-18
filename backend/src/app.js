const express = require('express');
const cors = require('cors');

const menuCategoriesRoutes = require('./routes/menuCategories');
const menuItemsRoutes = require('./routes/menuItems');
const customersRoutes = require('./routes/customers');
const ordersRoutes = require('./routes/orders');
const reservationsRoutes = require('./routes/reservations');
const reportsRoutes = require('./routes/reports');
const menuAnalysisRoutes = require('./routes/menuAnalysis');

const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' })); // liveness check, no DB touch — see docs/01-production-support.md §1.2

// Mount prefixes below are the source of truth for every route's full path
// (the individual files under ./routes only define paths relative to these).
app.use('/api/menu-categories', menuCategoriesRoutes);
app.use('/api/menu-items', menuItemsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', menuAnalysisRoutes); // no extra suffix — routes/menuAnalysis.js defines full /menu-analysis and /restaurants/:id/menu-analysis paths itself

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
