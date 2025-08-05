const express = require("express");
const cors = require("cors");
const { poolPromise } = require("./src/database/database.js");
const apiRoutes = require('./src/routes/api');

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ "message": "Ok, the server is running!" });
});

app.use('/api', apiRoutes);

const HTTP_PORT = 8000;

const startServer = async () => {
    try {
        await poolPromise;
        console.log("Database connection successful. Starting server...");
        app.listen(HTTP_PORT, () => {
            console.log(`Server running on http://localhost:${HTTP_PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to the database. Server will not start.");
        console.error(err);
        process.exit(1);
    }
};

startServer();