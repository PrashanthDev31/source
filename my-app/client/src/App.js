import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Import Page Components
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdvertisementPlanPage from './pages/AdvertisementPlanPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import MarketplacePage from './pages/MarketplacePage';

const GOOGLE_CLIENT_ID = "117194583119-ipg9t7ohp034hfapg6h0s3ohja0ajdbj.apps.googleusercontent.com";

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [pageData, setPageData] = useState({});
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [cart, setCart] = useState([]);
  const [isCartAnimating, setIsCartAnimating] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_intent')) {
        setCurrentPage('order-success');
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setCart([]);
    localStorage.removeItem('token');
    setCurrentPage('home'); 
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (token) {
        try {
          const decodedToken = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: decodedToken.id, name: decodedToken.name });
          
          const response = await fetch('http://localhost:8000/api/cart', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const cartData = await response.json();
            const formattedCart = cartData.map(item => ({ ...item, name: item.productName }));
            setCart(formattedCart);
          } else {
            handleLogout();
          }
        } catch (error) {
          console.error("Failed to initialize app state:", error);
          handleLogout();
        }
      }
    };
    bootstrap();
  }, [token, handleLogout]);

  const handleNavigation = useCallback((page, data = {}) => {
      setPageData(data);
      setCurrentPage(page);
  }, []);

  const handleLogin = useCallback(async (googleUserInfo) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: googleUserInfo.sub,
          email: googleUserInfo.email,
          name: googleUserInfo.name,
        }),
      });
      if (!response.ok) throw new Error('Backend authentication failed');
      const data = await response.json();
      
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('token', data.token);
      
      setCurrentPage('home');
    } catch (error) {
      console.error("Error during backend authentication:", error);
    }
  }, []);

  const triggerCartAnimation = useCallback(() => {
    setIsCartAnimating(true);
    setTimeout(() => setIsCartAnimating(false), 820);
  }, []);

  const handleAddToCart = useCallback(async (itemsToAdd) => {
    if (!token) {
        handleNavigation('login');
        return;
    }
    try {
      const response = await fetch('http://localhost:8000/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemsToAdd }),
      });
      if (!response.ok) throw new Error('Failed to add to cart');
      const updatedCartData = await response.json();
      const formattedCart = updatedCartData.map(item => ({ ...item, name: item.productName }));
      setCart(formattedCart);
      triggerCartAnimation();
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  }, [token, handleNavigation, triggerCartAnimation]);
  
  const handleUpdateCart = useCallback(async (itemName, newQuantity) => {
    if (!token) return;
    try {
      await fetch(`http://localhost:8000/api/cart/${encodeURIComponent(itemName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      if (newQuantity <= 0) {
          setCart(currentCart => currentCart.filter(item => item.name !== itemName));
      } else {
          setCart(currentCart => currentCart.map(item => item.name === itemName ? { ...item, quantity: newQuantity } : item));
      }
      triggerCartAnimation();
    } catch (error) {
        console.error("Error updating cart:", error);
    }
  }, [token, triggerCartAnimation]);
  
  const handleOrderFinalized = useCallback(() => {
      setCart([]);
  }, []);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const isAuthenticated = !!token;

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage onNavigate={handleNavigation} onLogin={handleLogin} />;
      case 'advertisement':
        return <AdvertisementPlanPage onNavigate={handleNavigation} onAddToCart={handleAddToCart} onUpdateCart={handleUpdateCart} cart={cart} cartItemCount={cartItemCount} isCartAnimating={isCartAnimating} />;
      case 'checkout':
        return <CheckoutPage onNavigate={handleNavigation} cart={cart} onUpdateCart={handleUpdateCart} token={token} />;
      case 'order-success':
        return <OrderSuccessPage onNavigate={handleNavigation} token={token} onOrderFinalized={handleOrderFinalized} />;
      case 'order-history':
        return <OrderHistoryPage onNavigate={handleNavigation} token={token} />;
      case 'marketplace':
        return <MarketplacePage onNavigate={handleNavigation} token={token} user={user} />;
      case 'home':
      default:
        return <HomePage onNavigate={handleNavigation} isAuthenticated={isAuthenticated} onLogout={handleLogout} onAddToCart={handleAddToCart} cartItemCount={cartItemCount} isCartAnimating={isCartAnimating} user={user} />;
    }
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {renderPage()}
    </GoogleOAuthProvider>
  );
}

export default App;