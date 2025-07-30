const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false 
    }
};

const ensureTablesExist = async (pool) => {
    try {
        const request = pool.request();
        // Existing tables
        await request.query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U') CREATE TABLE users (id INT PRIMARY KEY IDENTITY(1,1), googleId NVARCHAR(255) UNIQUE, email NVARCHAR(255) UNIQUE, name NVARCHAR(255))`);
        console.log("Users table is ready.");
        await request.query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cart_items' and xtype='U') CREATE TABLE cart_items (id INT PRIMARY KEY IDENTITY(1,1), userId INT FOREIGN KEY REFERENCES users(id), productName NVARCHAR(255) NOT NULL, quantity INT NOT NULL, price DECIMAL(10, 2) NOT NULL)`);
        console.log("Cart items table is ready.");
        await request.query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' and xtype='U') CREATE TABLE orders (id INT PRIMARY KEY IDENTITY(1,1), userId INT FOREIGN KEY REFERENCES users(id), orderDate DATETIME DEFAULT GETDATE(), totalAmount DECIMAL(10, 2) NOT NULL, stripePaymentIntentId NVARCHAR(255) UNIQUE NOT NULL)`);
        console.log("Orders table is ready.");
        await request.query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' and xtype='U') CREATE TABLE order_items (id INT PRIMARY KEY IDENTITY(1,1), orderId INT FOREIGN KEY REFERENCES orders(id), productName NVARCHAR(255) NOT NULL, quantity INT NOT NULL, price DECIMAL(10, 2) NOT NULL)`);
        console.log("Order items table is ready.");

        // --- CORRECTED MARKETPLACE SCHEMA ---
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='marketplace_listings' and xtype='U')
            CREATE TABLE marketplace_listings (
                id INT PRIMARY KEY IDENTITY(1,1),
                userId INT FOREIGN KEY REFERENCES users(id),
                title NVARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                location NVARCHAR(255) NOT NULL,
                createdAt DATETIME DEFAULT GETDATE()
            )
        `);
        console.log("Marketplace listings table is ready.");

        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='listing_images' and xtype='U')
            CREATE TABLE listing_images (
                id INT PRIMARY KEY IDENTITY(1,1),
                listingId INT FOREIGN KEY REFERENCES marketplace_listings(id) ON DELETE CASCADE,
                imageUrl NVARCHAR(MAX) NOT NULL
            )
        `);
        console.log("Listing images table is ready.");

    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Connected to Azure SQL Database');
        ensureTablesExist(pool);
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        throw err; 
    });

module.exports = {
    sql, poolPromise
};
