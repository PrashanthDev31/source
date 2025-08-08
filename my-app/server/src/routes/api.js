const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../database/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');

const JWT_SECRET = process.env.JWT_SECRET;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient('marketplace-images');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const PRODUCT_PRICES = { 
    'Modern Desk Lamp': 79.99, 
    'Ergonomic Chair': 349.99, 
    'Wireless Headphones': 199.99, 
    'Smart Mug': 129.99, 
    'Basic Ad (monthly)': 69.99, 
    'Standard Ad (monthly)': 129.99 
};

const authenticateToken = (req, res, next) => { 
    const authHeader = req.headers['authorization']; 
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.sendStatus(401); 
    jwt.verify(token, JWT_SECRET, (err, user) => { 
        if (err) return res.sendStatus(403); 
        req.user = user; 
        next(); 
    }); 
};

// --- AUTH ROUTE ---
router.post('/auth/google', async (req, res) => { 
    const { googleId, email, name } = req.body; 
    if (!googleId || !email || !name) { 
        return res.status(400).json({ message: 'Missing required user information.' }); 
    } 
    try { 
        const pool = await poolPromise; 
        let request = pool.request(); 
        let result = await request
            .input('googleId', sql.NVarChar, googleId)
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM users WHERE googleId = @googleId OR email = @email'); 
        
        let user = result.recordset[0]; 
        if (!user) { 
            let insertRequest = pool.request(); 
            result = await insertRequest
                .input('googleId_insert', sql.NVarChar, googleId)
                .input('email_insert', sql.NVarChar, email)
                .input('name_insert', sql.NVarChar, name)
                .query('INSERT INTO users (googleId, email, name) OUTPUT INSERTED.* VALUES (@googleId_insert, @email_insert, @name_insert)'); 
            user = result.recordset[0]; 
        } 
        const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1d' }); 
        res.status(200).json({ message: 'Authentication successful!', user: user, token: token }); 
    } catch (err) { 
        console.error('API Auth Error:', err); 
        res.status(500).json({ message: 'An error occurred during authentication.' }); 
    } 
});

// --- CART ROUTES ---
router.get('/cart', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().input('userId', sql.Int, req.user.id).query('SELECT * FROM cart_items WHERE userId = @userId');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve cart.' });
    }
});

router.post('/cart', authenticateToken, async (req, res) => {
    const { itemsToAdd } = req.body;
    try {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        for (const item of itemsToAdd) {
            const price = PRODUCT_PRICES[item.name];
            if (price === undefined) {
                await transaction.rollback();
                return res.status(400).json({ message: `Invalid product name: ${item.name}` });
            }
            const request = new sql.Request(transaction);
            const result = await request
                .input('userId', sql.Int, req.user.id)
                .input('productName', sql.NVarChar, item.name)
                .query('SELECT * FROM cart_items WHERE userId = @userId AND productName = @productName');

            if (result.recordset.length > 0) {
                const updateRequest = new sql.Request(transaction);
                await updateRequest
                    .input('userId', sql.Int, req.user.id)
                    .input('productName', sql.NVarChar, item.name)
                    .input('quantity', sql.Int, result.recordset[0].quantity + item.quantity)
                    .input('price', sql.Decimal(10, 2), price)
                    .query('UPDATE cart_items SET quantity = @quantity, price = @price WHERE userId = @userId AND productName = @productName');
            } else {
                const insertRequest = new sql.Request(transaction);
                await insertRequest
                    .input('userId', sql.Int, req.user.id)
                    .input('productName', sql.NVarChar, item.name)
                    .input('quantity', sql.Int, item.quantity)
                    .input('price', sql.Decimal(10, 2), price)
                    .query('INSERT INTO cart_items (userId, productName, quantity, price) VALUES (@userId, @productName, @quantity, @price)');
            }
        }

        await transaction.commit();
        const finalCart = await pool.request().input('userId', sql.Int, req.user.id).query('SELECT * FROM cart_items WHERE userId = @userId');
        res.status(201).json(finalCart.recordset);
    } catch (err) {
        console.error('API Cart POST Error:', err);
        res.status(500).json({ message: 'Failed to add item to cart.' });
    }
});

router.put('/cart/:productName', authenticateToken, async (req, res) => {
    const { productName } = req.params;
    const { quantity } = req.body;
    try {
        const pool = await poolPromise;
        if (quantity > 0) {
            await pool.request()
                .input('userId', sql.Int, req.user.id)
                .input('productName', sql.NVarChar, productName)
                .input('quantity', sql.Int, quantity)
                .query('UPDATE cart_items SET quantity = @quantity WHERE userId = @userId AND productName = @productName');
        } else {
            await pool.request()
                .input('userId', sql.Int, req.user.id)
                .input('productName', sql.NVarChar, productName)
                .query('DELETE FROM cart_items WHERE userId = @userId AND productName = @productName');
        }
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update cart item.' });
    }
});

// --- PAYMENT ROUTES ---
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const cartResult = await pool.request().input('userId', sql.Int, req.user.id).query('SELECT * FROM cart_items WHERE userId = @userId');
        if (cartResult.recordset.length === 0) {
            return res.status(400).json({ message: 'Cart is empty.' });
        }
        const total = cartResult.recordset.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
        const totalInCents = Math.round(total * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalInCents,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error('API Payment Error:', err);
        res.status(500).json({ message: 'Failed to create payment intent.' });
    }
});

// --- ORDERS ROUTES ---
router.post('/orders/create-from-cart', authenticateToken, async (req, res) => {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ message: 'Payment Intent ID is required.' });
    try {
        const pool = await poolPromise;
        const checkRequest = pool.request();
        const existingOrder = await checkRequest
            .input('stripePaymentIntentId', sql.NVarChar, paymentIntentId)
            .query('SELECT id FROM orders WHERE stripePaymentIntentId = @stripePaymentIntentId');
        if (existingOrder.recordset.length > 0) {
            return res.status(200).json({ message: 'Order already processed.', orderId: existingOrder.recordset[0].id });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        const cartRequest = new sql.Request(transaction);
        const cartResult = await cartRequest.input('userId', sql.Int, req.user.id).query('SELECT * FROM cart_items WHERE userId = @userId');
        const cartItems = cartResult.recordset;
        if (cartItems.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Cannot create order from an empty cart.' });
        }

        const totalAmount = cartItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
        const orderRequest = new sql.Request(transaction);
        const orderResult = await orderRequest
            .input('userId', sql.Int, req.user.id)
            .input('totalAmount', sql.Decimal(10, 2), totalAmount)
            .input('stripePaymentIntentId', sql.NVarChar, paymentIntentId)
            .query('INSERT INTO orders (userId, totalAmount, stripePaymentIntentId) OUTPUT INSERTED.id VALUES (@userId, @totalAmount, @stripePaymentIntentId)');
        const newOrderId = orderResult.recordset[0].id;

        for (const item of cartItems) {
            const orderItemRequest = new sql.Request(transaction);
            await orderItemRequest
                .input('orderId', sql.Int, newOrderId)
                .input('productName', sql.NVarChar, item.productName)
                .input('quantity', sql.Int, item.quantity)
                .input('price', sql.Decimal(10, 2), item.price)
                .query('INSERT INTO order_items (orderId, productName, quantity, price) VALUES (@orderId, @productName, @quantity, @price)');
        }

        const clearCartRequest = new sql.Request(transaction);
        await clearCartRequest.input('userId', sql.Int, req.user.id).query('DELETE FROM cart_items WHERE userId = @userId');

        await transaction.commit();
        res.status(201).json({ message: 'Order created successfully!', orderId: newOrderId });
    } catch (err) {
        console.error('API Create Order Error:', err);
        res.status(500).json({ message: 'Failed to create order.' });
    }
});

router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('userId', sql.Int, req.user.id)
            .query(`SELECT o.id, o.orderDate, o.totalAmount, oi.productName, oi.quantity, oi.price 
                    FROM orders o 
                    JOIN order_items oi ON o.id = oi.orderId 
                    WHERE o.userId = @userId 
                    ORDER BY o.orderDate DESC`);
        const orders = {};
        result.recordset.forEach(row => {
            if (!orders[row.id]) {
                orders[row.id] = { id: row.id, date: row.orderDate, total: row.totalAmount, items: [] };
            }
            orders[row.id].items.push({ name: row.productName, quantity: row.quantity, price: row.price });
        });
        res.json(Object.values(orders));
    } catch (err) {
        console.error('API Get Orders Error:', err);
        res.status(500).json({ message: 'Failed to retrieve order history.' });
    }
});

// --- MARKETPLACE ROUTES ---
router.get('/marketplace', async (req, res) => {
    console.log("Marketplace API called");
    const { search } = req.query;
    try {
        console.log("Waiting for DB connection...");
        const pool = await poolPromise;
        console.log("✅ DB connection acquired");

        let query = `
            SELECT 
                m.id, m.title, m.price, m.location, m.createdAt, 
                u.name as sellerName, u.id as sellerId,
                (SELECT li.imageUrl 
                 FROM listing_images li 
                 WHERE li.listingId = m.id FOR JSON PATH) as imageUrls
            FROM marketplace_listings m
            JOIN users u ON m.userId = u.id
        `;

        let request = pool.request();
        if (search) {
            query += ` WHERE m.title LIKE @searchTerm`;
            request.input('searchTerm', sql.NVarChar, `%${search}%`);
        }
        query += ' ORDER BY m.createdAt DESC';

        console.log("Running query:", query);
        const result = await request.query(query);
        console.log("✅ Query completed");

        const listings = result.recordset.map(listing => ({
            ...listing,
            imageUrls: listing.imageUrls ? JSON.parse(listing.imageUrls).map(img => img.imageUrl) : []
        }));
        console.log(`✅ Returning ${listings.length} listings`);
        res.json(listings);
    } catch (err) {
        console.error('❌ API Marketplace GET Error:', err);
        res.status(500).json({ message: 'Failed to retrieve marketplace listings.' });
    }
});


router.post('/marketplace/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    try {
        const blobName = `${uuidv4()}-${req.file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.upload(req.file.buffer, req.file.size, {
            blobHTTPHeaders: { blobContentType: req.file.mimetype }
        });
        res.status(200).json({ imageUrl: blockBlobClient.url });
    } catch (error) {
        console.error("Image upload error:", error);
        res.status(500).json({ message: "Error uploading image." });
    }
});

router.post('/marketplace', authenticateToken, async (req, res) => {
    const { title, price, location, imageUrls } = req.body;
    if (!title || price === undefined || !location) {
        return res.status(400).json({ message: 'Title, price, and location are required.' });
    }
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const listingRequest = new sql.Request(transaction);
        const listingResult = await listingRequest
            .input('userId', sql.Int, req.user.id)
            .input('title', sql.NVarChar, title)
            .input('price', sql.Decimal(10, 2), price)
            .input('location', sql.NVarChar, location)
            .query('INSERT INTO marketplace_listings (userId, title, price, location) OUTPUT INSERTED.id VALUES (@userId, @title, @price, @location)');
        
        const newListingId = listingResult.recordset[0].id;
        if (imageUrls && imageUrls.length > 0) {
            for (const imageUrl of imageUrls) {
                const imageRequest = new sql.Request(transaction);
                await imageRequest
                    .input('listingId', sql.Int, newListingId)
                    .input('imageUrl', sql.NVarChar, imageUrl)
                    .query('INSERT INTO listing_images (listingId, imageUrl) VALUES (@listingId, @imageUrl)');
            }
        }
        
        await transaction.commit();
        res.status(201).json({ message: 'Listing created successfully!' });
    } catch (err) {
        await transaction.rollback();
        console.error('API Marketplace POST Error:', err);
        res.status(500).json({ message: 'Failed to create listing.' });
    }
});

// --- CHAT ROUTES ---
router.get('/messages/:otherUserId', authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const userId = req.user.id;
        const roomId = [userId, otherUserId].sort().join("_");
        const messages = await Message.find({
            room: roomId,
            hiddenFor: { $ne: userId }
        }).sort({ sentAt: 1 });
        res.json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/messages', authenticateToken, async (req, res) => {
    try {
        const { otherUserId, text } = req.body;
        if (!otherUserId || !text) {
            return res.status(400).json({ error: 'otherUserId and text are required' });
        }
        const userId = req.user.id;
        const roomId = [userId, otherUserId].sort().join("_");
        const msg = new Message({
            room: roomId,
            senderId: userId,
            receiverId: otherUserId,
            text,
            sentAt: new Date()
        });
        await msg.save();
        res.status(201).json(msg);
    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
