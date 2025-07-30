import React, { useState, useEffect, useRef } from 'react';

function OrderSuccessPage({ onNavigate, token, onOrderFinalized }) {
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [orderId, setOrderId] = useState(null);
    
    // --- FIX ---
    // Use a ref to prevent the finalizeOrder function from running more than once.
    // This is the key to solving the race condition.
    const hasFinalized = useRef(false);

    useEffect(() => {
        const finalizeOrder = async () => {
            // If we have already tried to finalize, do nothing.
            if (hasFinalized.current) {
                return;
            }
            // Set the lock to true immediately.
            hasFinalized.current = true;

            const urlParams = new URLSearchParams(window.location.search);
            const paymentIntentId = urlParams.get('payment_intent');

            if (!paymentIntentId) {
                setStatus('error');
                return;
            }

            try {
                const response = await fetch('http://localhost:8000/api/orders/create-from-cart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ paymentIntentId })
                });
                
                if (response.status !== 200 && response.status !== 201) {
                    throw new Error('Failed to finalize order on backend');
                }

                const data = await response.json();
                setOrderId(data.orderId);
                setStatus('success');
                onOrderFinalized();
                // Clean up the URL to prevent issues on refresh.
                window.history.replaceState({}, document.title, "/");
            } catch (error) {
                console.error("Error finalizing order:", error);
                setStatus('error');
            }
        };

        // Only attempt to finalize the order AFTER the token has been loaded.
        if (token) {
            finalizeOrder();
        }
    }, [token, onOrderFinalized]);

    const renderContent = () => {
        switch (status) {
            case 'success':
                return {
                    title: 'Thank you for your order!',
                    body: `Your Order ID is: #${orderId}`
                };
            case 'error':
                return {
                    title: 'There was an issue finalizing your order.',
                    body: 'Please check your order history to confirm the payment.'
                };
            default: // loading
                return {
                    title: 'Finalizing your order...',
                    body: 'Please wait a moment while we confirm your login and payment.'
                };
        }
    };

    const { title, body } = renderContent();

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center text-center p-4">
            <div className="bg-white p-10 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">{title}</h1>
                <p className="text-gray-600">{body}</p>
                {status !== 'loading' && (
                    <div className="mt-8 flex flex-col sm:flex-row gap-4">
                        <button onClick={() => onNavigate('home')} className="w-full py-3 px-6 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 transition-colors">Continue Shopping</button>
                        <button onClick={() => onNavigate('order-history')} className="w-full py-3 px-6 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors">View Order History</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OrderSuccessPage;
