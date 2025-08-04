import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

const SpinnerIcon = ({ color = 'text-white' }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

function LoginPage({ onLogin }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoggingIn(true);
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        if (!userInfoResponse.ok) throw new Error('Failed to fetch user info from Google');
        const userInfo = await userInfoResponse.json();
        await onLogin(userInfo); 
      } catch (error) {
        console.error("Error fetching user info from Google:", error);
        setIsLoggingIn(false);
      }
    },
    onError: (errorResponse) => {
        console.error("Google Login Error:", errorResponse);
        setIsLoggingIn(false);
    },
    onNonOAuthError: () => {
        setIsLoggingIn(false);
    }
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="absolute top-4 left-4">
        <button onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
      </div>
      <div className="bg-white shadow-2xl rounded-2xl p-8 sm:p-12 w-full max-w-md text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">Welcome!</h1>
        <p className="text-gray-600 mb-8">Sign in or create an account with Google to continue.</p>
        <button 
            onClick={() => handleGoogleLogin()} 
            disabled={isLoggingIn}
            className="w-full inline-flex items-center justify-center py-3 px-4 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:bg-purple-400 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? (
              <><SpinnerIcon /> Signing In...</>
          ) : (
              <><svg className="w-6 h-6 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C41.38,36.405,44,30.638,44,24C44,22.259,43.862,21.35,43.611,20.083z"></path></svg>Continue with Google</>
          )}
        </button>
        <p className="text-xs text-gray-400 mt-8">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
      </div>
    </div>
  );
}

export default LoginPage;