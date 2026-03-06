const express = require('express');
const requestIdMiddleware = require('./middleware/request-id.middleware');
const systemRoutes = require('./routes/system.routes');
const contentReadRoutes = require('./routes/content-read.routes');
const contentWriteRoutes = require('./routes/content-write.routes');

const app = express();

app.use(requestIdMiddleware);
app.use(express.json({ limit: '5mb' }));
app.use(systemRoutes);
app.use(contentReadRoutes);
app.use(contentWriteRoutes);

module.exports = app;
