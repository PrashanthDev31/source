import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdvertisementPlanPage from './pages/AdvertisementPlanPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import MarketplacePage from './pages/MarketplacePage';
import ChatPage from './pages/ChatPage';

const GOOGLE_CLIENT_ID = "117194583119-ipg9t7ohp034hfapg6h0s3ohja0ajdbj.apps.googleusercontent.com";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [cart, setCart] = useState([]);
  const [isCartAnimating, setIsCartAnimating] = useState(false);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setCart([]);
    localStorage.removeItem('token');
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: decodedToken.id, name: decodedToken.name });

        fetch('http://localhost:8000/api/cart', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
          })
          .then(cartData => {
            const formattedCart = cartData.map(item => ({ ...item, name: item.productName }));
            setCart(formattedCart);
          })
          .catch(() => handleLogout());
      } catch {
        handleLogout();
      }
    }
  }, [token, handleLogout]);

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
    } catch (error) {
      console.error("Error during backend authentication:", error);
    }
  }, []);

  const triggerCartAnimation = useCallback(() => {
    setIsCartAnimating(true);
    setTimeout(() => setIsCartAnimating(false), 820);
  }, []);

  const handleAddToCart = useCallback(async (itemsToAdd) => {
    if (!token) return;
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
  }, [token, triggerCartAnimation]);

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

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<HomePage isAuthenticated={isAuthenticated} onLogout={handleLogout} onAddToCart={handleAddToCart} cartItemCount={cartItemCount} isCartAnimating={isCartAnimating} user={user} />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/advertisement" element={<AdvertisementPlanPage onAddToCart={handleAddToCart} onUpdateCart={handleUpdateCart} cart={cart} cartItemCount={cartItemCount} isCartAnimating={isCartAnimating} />} />
          <Route path="/checkout" element={<CheckoutPage cart={cart} onUpdateCart={handleUpdateCart} token={token} />} />
          <Route path="/order-success" element={<OrderSuccessPage token={token} onOrderFinalized={handleOrderFinalized} />} />
          <Route path="/order-history" element={<OrderHistoryPage token={token} />} />
          <Route path="/marketplace" element={<MarketplacePage token={token} user={user} />} />
          <Route path="/chat/:sellerId" element={<ChatPage />} />
        </Routes>
      
    </GoogleOAuthProvider>
  );
}

export default App;
