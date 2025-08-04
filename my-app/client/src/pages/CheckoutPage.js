import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';

const STRIPE_PUBLISHABLE_KEY = "pk_test_51Rok6wRqzu5xWulF2IxdbyErvsbE48UeX8JtQfcOVFF26wf6NYRSSRRx1rOT50XVaD0qzg2WZAQ12O6oOU8FZpx400FuCqJJ0i";
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const SpinnerIcon = ({ color = 'text-white' }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

function CheckoutForm({ isCartEmpty }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsLoading(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}`,
            },
        });

        if (error.type === "card_error" || error.type === "validation_error") {
            setMessage(error.message);
        } else {
            setMessage("An unexpected error occurred.");
        }
        setIsLoading(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" />
            <button 
                disabled={isLoading || !stripe || !elements || isCartEmpty} 
                id="submit" 
                className="w-full mt-6 py-3 px-4 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 flex items-center justify-center"
            >
                <span id="button-text">{isLoading ? <SpinnerIcon /> : "Pay now"}</span>
            </button>
            {message && <div id="payment-message" className="text-red-500 mt-4 text-center">{message}</div>}
        </form>
    );
}

function CheckoutPage({ cart, onUpdateCart, token }) {
    const navigate = useNavigate();
    const [clientSecret, setClientSecret] = useState("");
    
    useEffect(() => {
        const createPaymentIntent = async () => {
            if (cart.length > 0 && token) {
                try {
                    const response = await fetch("http://localhost:8000/api/create-payment-intent", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    });
                    if (!response.ok) {
                        throw new Error("Failed to get client secret from server");
                    }
                    const data = await response.json();
                    setClientSecret(data.clientSecret);
                } catch (error) { 
                    console.error("Error creating payment intent:", error); 
                }
            }
        };
        createPaymentIntent();
    }, [cart, token]);

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const handleQuantityChange = (itemName, amount) => {
        const item = cart.find(i => i.name === itemName);
        if (item) {
            const newQuantity = item.quantity + amount;
            onUpdateCart(itemName, newQuantity);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4">
                    <button onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Shopping</button>
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Checkout</h1>
                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-1/2 bg-white p-8 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6">Order Summary</h2>
                        {cart.length === 0 ? ( <p className="text-gray-600">Your cart is empty.</p> ) : (
                            <div className="space-y-4">
                                {cart.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500">${parseFloat(item.price).toFixed(2)}</p></div>
                                        <div className="flex items-center gap-2"><button onClick={() => handleQuantityChange(item.name, -1)} className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">-</button><span className="w-8 text-center font-semibold">{item.quantity}</span><button onClick={() => handleQuantityChange(item.name, 1)} className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">+</button></div>
                                    </div>
                                ))}
                                <div className="border-t pt-4 mt-6 flex justify-between font-bold text-lg"><span>Total</span><span>${total.toFixed(2)}</span></div>
                            </div>
                        )}
                    </div>
                    <div className="lg:w-1/2 bg-white p-8 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-6">Payment Information</h2>
                        {clientSecret && cart.length > 0 ? (
                            <Elements key={clientSecret} options={{ clientSecret, appearance: { theme: 'stripe' } }} stripe={stripePromise}>
                                <CheckoutForm isCartEmpty={cart.length === 0} />
                            </Elements>
                        ) : (
                            <div className="flex justify-center items-center h-32">
                                {cart.length > 0 ? (
                                    <>
                                        <SpinnerIcon color="text-purple-500" />
                                        <span className="ml-4 text-gray-500">Loading Payment Options...</span>
                                    </>
                                ) : (
                                    <p className="text-gray-500">Add items to your cart to proceed with payment.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default CheckoutPage;