import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";

const Logo = () => (
    <div className="flex items-center space-x-3">
        <img 
            src="https://desiconnectstorage.blob.core.windows.net/logo/logo.png" 
            alt="DesiConnect Logo" 
            className="h-8 w-auto"
        />
        <span className="font-bold text-xl text-gray-800">DesiConnect</span>
    </div>
);


const SpinnerIcon = ({ color = 'text-white' }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

function HomePage({  isAuthenticated, onLogout, onAddToCart, cartItemCount, isCartAnimating, user }) {
  const [loadingProduct, setLoadingProduct] = useState(null);
  const navigate = useNavigate();

  const catalogCategories = [ 'All Listings', 'Insurance', 'Spiritual And Astrology', 'Media Tv Newspapers', 'Catering', 'Party Rental', 'Home Remodeling', 'Meditation And Yoga', 'Childrens Education', 'Religious', 'Clothing', 'Driving School', 'Mortgages', 'Tax Preparers', 'Training IT And Others', 'Bridal Shop', 'Community Associations', 'Travel Agents', 'Martial Arts', 'Flower Shops', 'Groceries', 'Beauty', 'Attorneys And Immigration', 'Courier', 'Priests', 'Senior Living', 'Furniture', 'Real Estate Brokers', 'Hospitals', 'Visual Arts', 'Wedding And Matrimonial', 'Jewelry', 'Miscellaneous', 'Physicians', 'Information Technology', 'Home Appliances Goods', 'Sports Pub', 'Dentistry', 'Sports', 'Performing Arts', 'Sweet And Savour Shops', 'Restaurants' ];
  const columns = [[], [], [], []];
  catalogCategories.forEach((category, index) => { columns[index % 4].push(category); });
  const products = [ { name: 'Modern Desk Lamp' }, { name: 'Ergonomic Chair' }, { name: 'Wireless Headphones' }, { name: 'Smart Mug' } ];
  const PRODUCT_PRICES = { 'Modern Desk Lamp': 79.99, 'Ergonomic Chair': 349.99, 'Wireless Headphones': 199.99, 'Smart Mug': 129.99 };
  
  const handleProductAddToCart = async (product) => {
      setLoadingProduct(product.name);
      await onAddToCart([{...product, quantity: 1}]);
      setLoadingProduct(null);
  };

  return (
    <div className="bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <a href="#" onClick={() => navigate('/home')}>
                <Logo />
            </a>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#" onClick={() => navigate('/home')} className="nav-link-active font-semibold">Home</a>
              
              <div className="relative group">
                <a href="#" className="nav-link flex items-center">Catalog<svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg></a>
                <div className="absolute top-full left-0 w-screen max-w-4xl p-8 bg-white shadow-lg rounded-lg hidden group-hover:block">
                  <div className="flex justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">All Categories</h3>
                        <div className="grid grid-cols-4 gap-x-8 gap-y-4">
                            {columns.map((column, colIndex) => (
                            <div key={colIndex} className="space-y-3">
                                {column.map((category, catIndex) => (
                                <a key={catIndex} href="#" className="block text-gray-600 hover:text-purple-600 hover:font-semibold transition-colors">{category}</a>
                                ))}
                            </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-l pl-8 ml-8">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Community</h3>
                        <a href="#" onClick={() => navigate('/marketplace')} className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                            <p className="font-bold text-purple-700">🛍️ Desi Marketplace</p>
                            <p className="text-sm text-gray-600">Buy & sell used goods in the community.</p>
                        </a>
                    </div>
                  </div>
                </div>
              </div>

              <a href="#" className="nav-link">About Us</a>
              <a href="#" className="nav-link">Contact Us</a>
              <a href="#" className="nav-link">FAQ</a>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-4">
                <span className="text-gray-700 font-medium">Welcome, {user?.name.split(' ')[0]}</span>
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/order-history'); }} className="text-sm text-purple-600 hover:underline">Order History</a>
                {/* --- ADD THIS LINE --- */}
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/inbox'); }} className="text-sm text-purple-600 hover:underline">Inbox</a>
                <button onClick={onLogout} className="flex items-center text-gray-600 hover:text-purple-600">
                  {/*... svg icon ...*/}
                  <span className="ml-2 font-medium">Sign Out</span>
                </button>
              </div>
            ) : (
              <a href="#" onClick={() => navigate('/login')} className="hidden md:flex items-center text-gray-600 hover:text-purple-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="ml-2 font-medium">Login</span>
              </a>
            )}
            <button onClick={() => navigate('/checkout')} className={`relative hidden md:block ${isCartAnimating ? 'cart-shake' : ''}`}>
                <svg className="h-7 w-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {cartItemCount > 0 && <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cartItemCount}</span>}
            </button>
          </div>
        </nav>
      </header>
      <main className="container mx-auto px-6 py-12">
        <section className="bg-purple-100 rounded-lg p-8 md:p-16 flex flex-col md:flex-row items-center mb-16">
          <div className="md:w-1/2 text-center md:text-left mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">“Bridging cultures, building dreams.”</h1>
          </div>
          <div className="md:w-1/2">
             <a href="#" onClick={() => navigate('/advertisement')} className="block rounded-lg shadow-xl overflow-hidden transform transition-transform hover:scale-105">
                <img src="https://placehold.co/600x400/A78BFA/FFFFFF?text=Feature+your+business+with+Advertisement+Plan" alt="Feature your business with Advertisement Plan" className="w-full" />
             </a>
          </div>
        </section>
        <section>
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-2 section-title pb-4">Featured Products</h2>
          <p className="text-center text-gray-500 mb-10">Handpicked just for you</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product, index) => (
                <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
                    <img src={`https://placehold.co/400x300/E9D5FF/8B5CF6?text=Product+${index+1}`} alt={product.name} className="w-full h-48 object-cover" />
                    <div className="p-6">
                        <h3 className="font-semibold text-lg text-gray-800">{product.name}</h3>
                        <p className="text-gray-500 mt-1">${(PRODUCT_PRICES[product.name] || 0).toFixed(2)}</p>
                        <button 
                            onClick={() => handleProductAddToCart(product)} 
                            disabled={loadingProduct === product.name}
                            className="w-full mt-4 btn-primary text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center disabled:bg-gray-400"
                        >
                           {loadingProduct === product.name ? <SpinnerIcon color="text-gray-800" /> : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="bg-white mt-16 border-t"><div className="container mx-auto px-6 py-8"><div className="flex flex-col md:flex-row justify-between items-center"><p className="text-gray-600">&copy; 2024 YourCompany. All rights reserved.</p><div className="flex mt-4 md:mt-0 space-x-4"><a href="#" className="text-gray-500 hover:text-purple-600">Privacy Policy</a><a href="#" className="text-gray-500 hover:text-purple-600">Terms of Service</a><a href="#" className="text-gray-500 hover:text-purple-600">Contact</a></div></div></div></footer>
    </div>
  );
}

export default HomePage;