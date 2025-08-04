import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function OrderSuccessPage({ token, onOrderFinalized }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [status, setStatus] = useState('loading'); 
    const [orderId, setOrderId] = useState(null);
    const hasFinalized = useRef(false);

    useEffect(() => {
        const finalizeOrder = async () => {
            if (hasFinalized.current) return;
            hasFinalized.current = true;

            const urlParams = new URLSearchParams(location.search);
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
                // Clean up the URL
                navigate('/order-success', { replace: true });
            } catch (error) {
                console.error("Error finalizing order:", error);
                setStatus('error');
            }
        };

        if (token) {
            finalizeOrder();
        }
    }, [token, onOrderFinalized, location.search, navigate]);

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
                        <button onClick={() => navigate('/')} className="w-full py-3 px-6 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 transition-colors">Continue Shopping</button>
                        <button onClick={() => navigate('/order-history')} className="w-full py-3 px-6 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-colors">View Order History</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default OrderSuccessPage;