import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../config/api';

const AuthContext = createContext(null);

// Safely parse JSON from a response, avoiding "unexpected end of data" SyntaxError
const safeJson = async (res) => {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return { message: res.statusText || 'Unexpected server response' };
  }
};

// All fetch calls use credentials: 'include' so the browser automatically
// sends the HTTP-only auth cookie with every request.
const authFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // One-time migration: clear any stale token from old localStorage-based auth system
  useEffect(() => {
    if (localStorage.getItem('token')) {
      localStorage.removeItem('token');
    }
  }, []);

  // Fetch orders for the logged-in user (cookie is sent automatically)
  const fetchOrders = async () => {
    try {
      const response = await authFetch(`${API}/api/orders`);
      if (response.ok) {
        const data = await safeJson(response);
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  // Fetch addresses for the logged-in user
  const fetchAddresses = async () => {
    try {
      const response = await authFetch(`${API}/api/addresses`);
      if (response.ok) {
        const data = await safeJson(response);
        setAddresses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    }
  };

  // On every page load, ask the backend "is my cookie still valid?"
  // If the token has expired, the backend returns 401 and we show guest view.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await authFetch(`${API}/api/users/me`);
        if (response.ok) {
          const data = await safeJson(response);
          setUser(data.user);
          // Load user-specific data in parallel
          fetchOrders();
          fetchAddresses();
        } else {
          // 401 means token expired or no cookie — treat as guest
          setUser(null);
          setAddresses([]);
          setOrders([]);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signup = async (userData) => {
    return authFetch(`${API}/api/users/signup`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  };

  const login = async (credentials) => {
    const response = await authFetch(`${API}/api/users/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.ok) {
      const data = await safeJson(response);
      setUser(data.user);
      // Load user data after login
      fetchOrders();
      fetchAddresses();

      if (data.user && data.user.role === 'delivery') {
        navigate('/delivery/dashboard');
      } else {
        navigate('/');
      }
    } else {
      const errorData = await safeJson(response);
      throw new Error(errorData.message || 'Login failed');
    }
  };

  const deliverySignup = async (partnerData) => {
    const response = await authFetch(`${API}/api/delivery/signup`, {
      method: 'POST',
      body: JSON.stringify(partnerData),
    });

    if (response.ok) {
      const data = await safeJson(response);
      setUser(data.user);
      navigate('/delivery/dashboard');
      return data;
    } else {
      const errorData = await safeJson(response);
      throw new Error(errorData.message || 'Registration failed.');
    }
  };

  const deliveryLogin = async (credentials) => {
    const response = await authFetch(`${API}/api/delivery/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.ok) {
      const data = await safeJson(response);
      setUser(data.user);
      navigate('/delivery/dashboard');
      return data;
    } else {
      const errorData = await safeJson(response);
      throw new Error(errorData.message || 'Delivery login failed.');
    }
  };

  const logout = async () => {
    // Tell the backend to clear the cookie
    await authFetch(`${API}/api/users/logout`, { method: 'POST' });
    setUser(null);
    setAddresses([]);
    setOrders([]);
    navigate('/');
  };

  const addAddress = async (newAddressData) => {
    try {
      const response = await authFetch(`${API}/api/addresses`, {
        method: 'POST',
        body: JSON.stringify(newAddressData),
      });

      if (!response.ok) {
        const errorData = await safeJson(response);
        throw new Error(errorData.message || 'Failed to add address.');
      }

      await fetchAddresses();
      return await safeJson(response);
    } catch (error) {
      console.error('Error adding address:', error);
      throw error;
    }
  };

  const addOrder = async (orderData) => {
    const response = await authFetch(`${API}/api/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to place order.');
    }

    await fetchOrders();
    return await response.json();
  };

  const value = {
    user,
    loading,
    login,
    deliveryLogin,
    logout,
    signup,
    deliverySignup,
    addresses,
    addAddress,
    orders,
    addOrder,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};