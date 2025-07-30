import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

function OrderHistoryPage({ onNavigate, token }) {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/orders', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch orders');
                const data = await response.json();
                setOrders(data);
            } catch (error) {
                console.error("Error fetching orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (token) fetchOrders();
    }, [token]);

    const handleDownloadPdf = (order) => {
        // Create a new PDF document
        const doc = new jsPDF();

        // --- Add Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('YourLogo Inc.', 20, 20);
        doc.setFontSize(16);
        doc.text('Order Receipt', 20, 30);
        
        // --- Add Order Details ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Order ID: #${order.id}`, 20, 45);
        doc.text(`Order Date: ${new Date(order.date).toLocaleDateString()}`, 20, 52);

        // --- Add a line separator ---
        doc.setLineWidth(0.5);
        doc.line(20, 60, 190, 60);

        // --- Add Table Header ---
        doc.setFont('helvetica', 'bold');
        doc.text('Item', 20, 70);
        doc.text('Qty', 130, 70);
        doc.text('Price', 150, 70);
        doc.text('Subtotal', 170, 70);
        doc.setFont('helvetica', 'normal');
        
        // --- Add Order Items ---
        let yPosition = 80;
        order.items.forEach(item => {
            doc.text(item.name, 20, yPosition);
            doc.text(item.quantity.toString(), 130, yPosition);
            doc.text(`$${parseFloat(item.price).toFixed(2)}`, 150, yPosition);
            doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 170, yPosition);
            yPosition += 7;
        });

        // --- Add another line separator ---
        doc.line(20, yPosition, 190, yPosition);

        // --- Add Total ---
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 150, yPosition + 10);
        doc.text(`$${parseFloat(order.total).toFixed(2)}`, 170, yPosition + 10);

        // --- Add Footer ---
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('Thank you for your business!', 20, yPosition + 30);

        // --- Save the PDF ---
        doc.save(`receipt-order-${order.id}.pdf`);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <button onClick={() => onNavigate('home')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Your Order History</h1>
                {isLoading ? <p>Loading orders...</p> : (
                    <div className="space-y-8">
                        {orders.length === 0 ? <p>You have not placed any orders yet.</p> :
                            orders.map(order => (
                                <div key={order.id} className="bg-white p-6 rounded-lg shadow-lg">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4">
                                        <div>
                                            <p className="font-bold text-lg">Order #{order.id}</p>
                                            <p className="text-sm text-gray-500">Placed on: {new Date(order.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4 mt-4 sm:mt-0">
                                            <p className="font-bold text-xl">${parseFloat(order.total).toFixed(2)}</p>
                                            <button 
                                                onClick={() => handleDownloadPdf(order)}
                                                className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm"
                                            >
                                                Download PDF
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {order.items.map((item, index) => (
                                            <div key={index} className="flex justify-between text-gray-700">
                                                <span>{item.name} (x{item.quantity})</span>
                                                <span>${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}
            </main>
        </div>
    );
}

export default OrderHistoryPage;
