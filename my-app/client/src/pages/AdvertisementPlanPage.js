import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SpinnerIcon = ({ color = 'text-white' }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

function AdvertisementPlanPage({ onAddToCart, onUpdateCart, cart, cartItemCount, isCartAnimating }) {
    const navigate = useNavigate();
    const [quantities, setQuantities] = useState({ basic: 0, standard: 0 });
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const AD_PRICES = {
        basic: 69.99,
        standard: 129.99,
    };

    useEffect(() => {
        const basicInCart = cart.find(item => item.name === 'Basic Ad (monthly)');
        const standardInCart = cart.find(item => item.name === 'Standard Ad (monthly)');
        
        const newQuantities = { basic: 0, standard: 0 };
        if (basicInCart) newQuantities.basic = basicInCart.quantity;
        if (standardInCart) newQuantities.standard = standardInCart.quantity;
        setQuantities(newQuantities);
        setIsDirty(false);
    }, [cart]);

    const handleQuantityChange = (plan, amount) => { 
        setQuantities(prev => ({ ...prev, [plan]: Math.max(0, prev[plan] + amount) })); 
        setIsDirty(true);
    };

    const handleCartAction = async () => {
        setIsUpdating(true);
        const basicInCart = cart.find(i => i.name === 'Basic Ad (monthly)');
        const standardInCart = cart.find(i => i.name === 'Standard Ad (monthly)');

        const itemsToAdd = [];
        if (quantities.basic > 0 && !basicInCart) itemsToAdd.push({ name: 'Basic Ad (monthly)', quantity: quantities.basic });
        if (quantities.standard > 0 && !standardInCart) itemsToAdd.push({ name: 'Standard Ad (monthly)', quantity: quantities.standard });
        
        if (itemsToAdd.length > 0) {
            await onAddToCart(itemsToAdd);
        }

        if (basicInCart && quantities.basic !== basicInCart.quantity) {
            await onUpdateCart('Basic Ad (monthly)', quantities.basic);
        }
        if (standardInCart && quantities.standard !== standardInCart.quantity) {
            await onUpdateCart('Standard Ad (monthly)', quantities.standard);
        }
        
        setIsUpdating(false);
        setIsDirty(false);
    };

    const isButtonDisabled = isUpdating || !isDirty;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <button onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
                    {cartItemCount > 0 && (
                        <button onClick={() => navigate('/checkout')} className={`relative ${isCartAnimating ? 'cart-shake' : ''}`}>
                            <svg className="h-7 w-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cartItemCount}</span>
                        </button>
                    )}
                </div>
            </header>
            <main className="container mx-auto px-6 py-12">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">Desiconnectusa Advertisement Plan</h1>
                <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                    <div className="md:w-1/2"><img src="https://placehold.co/600x400/d1d5db/374151?text=Digital+Marketing" alt="Digital Marketing Advertisement" className="rounded-lg shadow-lg w-full"/></div>
                    <div className="md:w-1/2">
                        <p className="text-sm text-gray-500">DESICONNECTSHOP</p>
                        <h2 className="text-2xl font-bold text-gray-800 mt-1">Desiconnectusa.com Advertisement Plan</h2>
                        <p className="text-4xl font-bold text-green-600 my-4">From ${AD_PRICES.basic.toFixed(2)}</p>
                        <div className="mt-6 space-y-4">
                            <h3 className="text-md font-semibold text-gray-700">Advertisement Plans:</h3>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div><span className="font-medium text-gray-700">Basic Ad (monthly)</span><p className="text-sm text-gray-500">${AD_PRICES.basic.toFixed(2)}</p></div>
                                <div className="flex items-center gap-2"><button onClick={() => handleQuantityChange('basic', -1)} className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">-</button><span className="w-8 text-center font-semibold">{quantities.basic}</span><button onClick={() => handleQuantityChange('basic', 1)} className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">+</button></div>
                            </div>
                             <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div><span className="font-medium text-gray-700">Standard Ad (monthly)</span><p className="text-sm text-gray-500">${AD_PRICES.standard.toFixed(2)}</p></div>
                                <div className="flex items-center gap-2"><button onClick={() => handleQuantityChange('standard', -1)} className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">-</button><span className="w-8 text-center font-semibold">{quantities.standard}</span><button onClick={() => handleQuantityChange('standard', 1)} className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">+</button></div>
                            </div>
                        </div>
                        <div className="mt-8">
                            <button onClick={handleCartAction} className="w-full py-4 px-6 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center" disabled={isButtonDisabled}>
                                {isUpdating ? <><SpinnerIcon /> Updating...</> : "Add to Cart"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default AdvertisementPlanPage;