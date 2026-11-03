import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaSearch, FaEdit, FaTrash, FaUserSlash, FaUserCheck } from 'react-icons/fa';
import './Customers.css';
import API from '../../config/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Function to fetch all users from the backend
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/admin/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers when the component first loads
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Function to handle blocking a user
  const handleBlock = async (customerId) => {
    try {
      await fetch(`${API}/api/admin/users/${customerId}/block`, { method: 'PUT' });
      // Update the user's status in the local state for an immediate UI update
      setCustomers(customers.map(cust => 
        cust.id === customerId ? { ...cust, is_blocked: true } : cust
      ));
    } catch (err) {
      alert('Failed to block user.');
    }
  };

  // Function to handle unblocking a user
  const handleUnblock = async (customerId) => {
    try {
      await fetch(`${API}/api/admin/users/${customerId}/unblock`, { method: 'PUT' });
      // Update the user's status in the local state
      setCustomers(customers.map(cust => 
        cust.id === customerId ? { ...cust, is_blocked: false } : cust
      ));
    } catch (err) {
      alert('Failed to unblock user.');
    }
  };
  
  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => !c.is_blocked).length;
  
  if (loading) return <p>Loading customers...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="customers-container">
      <div className="customers-header">
        <div>
          <h1>Customers</h1>
          <p>Manage customer accounts and information</p>
        </div>
      </div>

      <div className="customers-summary">
        <div className="summary-card">
          <div className="card-content">
            <p className="summary-title">Total Customers</p>
            <h2 className="summary-value">{totalCustomers}</h2>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-content">
            <p className="summary-title">Active Customers</p>
            <h2 className="summary-value">{activeCustomers}</h2>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-content">
            <p className="summary-title">Average Orders</p>
            <h2 className="summary-value">N/A</h2> {/* This would require more data */}
          </div>
        </div>
      </div>

      <div className="customer-list-section">
        <div className="section-header">
          <h2>Customer List</h2>
          <div className="search-bar">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
        <div className="customer-table-container">
          <table>
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>CUST-{String(customer.id).padStart(3, '0')}</td>
                  <td>{customer.full_name}</td>
                  <td className="contact-cell">
                    <p>{customer.email}</p>
                  </td>
                  <td>
                    <span className={`status-badge ${customer.is_blocked ? 'blocked' : 'active'}`}>
                      {customer.is_blocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {customer.is_blocked ? (
                      <FaUserCheck className="action-icon unblock-icon" title="Unblock User" onClick={() => handleUnblock(customer.id)} />
                    ) : (
                      <FaUserSlash className="action-icon block-icon" title="Block User" onClick={() => handleBlock(customer.id)} />
                    )}
                    <FaTrash className="action-icon trash-icon" title="Delete User" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;