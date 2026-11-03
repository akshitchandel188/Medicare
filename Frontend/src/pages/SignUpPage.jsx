import React, { useState } from 'react';
import './SignUpPage.css';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BsArrowLeft, BsShieldLockFill } from 'react-icons/bs';
import { FaUserPlus, FaHeadset, FaHeart, FaCheckCircle, FaUser, FaPhoneAlt } from 'react-icons/fa';
import { MdEmail, MdVisibility } from 'react-icons/md';

const SignUpPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  
  // State for form inputs, loading, and errors
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handler to update state as user types
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  // Handler for form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- Client-side validation ---
    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (formData.password.length < 6) {
      return setError("Password must be at least 6 characters long.");
    }

    setIsLoading(true);

    try {
      // Call the signup function from our AuthContext
      const response = await signup({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });

      let data = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        data = { message: 'Unexpected response from server. Please verify backend service.' };
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create account.');
      }
      
      // On success, show an alert and redirect to the login page
      alert('Account created successfully! Please log in.');
      navigate('/login');

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page-container">
      <Link to="/" className="back-to-home">
        <BsArrowLeft /> Back to Home
      </Link>
      <div className="signup-content-wrapper">
        {/* Sign-up Form */}
        <div className="signup-form-column">
          <h3>Create Account</h3>
          <p className="form-subtitle">Fill in your details to get started</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <div className="input-wrapper">
                <FaUser className="input-icon left" />
                <input type="text" id="fullName" value={formData.fullName} onChange={handleChange} required className="left-icon" placeholder="Enter your full name" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <MdEmail className="input-icon left" />
                <input type="email" id="email" value={formData.email} onChange={handleChange} required className="left-icon" placeholder="your.email@example.com" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <div className="input-wrapper">
                <FaPhoneAlt className="input-icon left" />
                <input type="tel" id="phone" value={formData.phone} onChange={handleChange} required className="left-icon" placeholder="+91 9876543210" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input type="password" id="password" value={formData.password} onChange={handleChange} required className="right-icon" placeholder="Create a secure password" />
                <MdVisibility className="input-icon-right right" />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <input type="password" id="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="right-icon" placeholder="Confirm your password" />
                <MdVisibility className="input-icon-right right" />
              </div>
            </div>
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" required /> I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
              </label>
            </div>
            <button type="submit" className="action-btn" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
          <p className="signin-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;