import React, { useState, useEffect } from 'react';
import { FaEdit, FaSearch, FaMotorcycle, FaCheckCircle, FaTimes, FaShieldAlt } from 'react-icons/fa';
import StatusModal from './StatusModal';
import './Orders.css';
import API from '../../config/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Assign Rider Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [orderToAssign, setOrderToAssign] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // 1. Fetch Orders from Backend
  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API}/api/admin/orders`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch registered riders for the assignment dropdown
  const fetchRiders = async () => {
    try {
      const response = await fetch(`${API}/api/admin/riders`);
      if (response.ok) {
        const data = await response.json();
        setRiders(data);
      }
    } catch (error) {
      console.error("Error fetching riders:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRiders();
  }, []);

  // 2. Update Order Status Function
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API}/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
        setIsModalOpen(false);
      } else {
        alert("Failed to update status in database.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Server error while updating status.");
    }
  };

  // 3. Dispatch / Assign Order to Rider
  const handleAssignRiderSubmit = async (e) => {
    e.preventDefault();
    if (!orderToAssign || !selectedRiderId) return;

    try {
      setAssignLoading(true);
      const res = await fetch(`${API}/api/admin/orders/${orderToAssign.id}/assign-rider`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryPartnerId: selectedRiderId })
      });

      if (res.ok) {
        const assignedRider = riders.find(r => String(r.id) === String(selectedRiderId));
        const resData = await res.json();

        // Update local orders list immediately
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o.id === orderToAssign.id
              ? {
                  ...o,
                  status: 'Out for Delivery',
                  delivery_partner_id: selectedRiderId,
                  delivery_partner_name: assignedRider?.full_name || 'Assigned Rider',
                  delivery_partner_phone: assignedRider?.phone_number || '',
                  vehicle_type: assignedRider?.vehicle_type || 'Motorcycle',
                  vehicle_number: assignedRider?.vehicle_number || '',
                  delivery_otp: resData.order?.delivery_otp || o.delivery_otp
                }
              : o
          )
        );

        setIsAssignModalOpen(false);
        setOrderToAssign(null);
        setSelectedRiderId('');
      } else {
        alert("Failed to assign rider.");
      }
    } catch (err) {
      console.error("Error assigning rider:", err);
      alert("Server error assigning rider.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleEditClick = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  const handleOpenAssignModal = (order) => {
    setOrderToAssign(order);
    setSelectedRiderId(order.delivery_partner_id ? String(order.delivery_partner_id) : '');
    setIsAssignModalOpen(true);
  };

  // Filter Logic (Search & Status)
  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (order.shipping_name && order.shipping_name.toLowerCase().includes(searchLower)) ||
      (order.email && order.email.toLowerCase().includes(searchLower)) ||
      (order.delivery_partner_name && order.delivery_partner_name.toLowerCase().includes(searchLower)) ||
      String(order.id).includes(searchLower);

    const matchesStatus = statusFilter === 'All Status' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="orders-container"><p className="loading-text">Loading orders...</p></div>;

  return (
    <div className="orders-container">
      <div className="orders-header">
        <div>
          <h1>Orders & Dispatch</h1>
          <p>View, manage, and dispatch orders to delivery riders</p>
        </div>
      </div>

      <div className="orders-section">
        <div className="section-header">
          <h2>All Orders ({filteredOrders.length})</h2>
          <div className="filters">
            <div className="searchh-bar">
              <FaSearch className="searchh-icon" />
              <input 
                type="text" 
                placeholder="Search by Name, Email, Rider, or ID..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <select
              className="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All Status</option>
              <option>Order Placed</option>
              <option>Processing</option>
              <option>Out for Delivery</option>
              <option>Delivered</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>

        <div className="orders-table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer Info</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Assigned Rider</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="order-id">#ORD-{String(order.id).padStart(5, '0')}</td>
                  <td>
                    <div className="customer-info">
                      <strong>{order.shipping_name}</strong>
                      <span>{order.email}</span>
                      <small style={{ color: '#64748b' }}>{order.shipping_address?.slice(0, 35)}...</small>
                    </div>
                  </td>
                  <td>{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="order-total">₹{Number(order.total_amount).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {order.status}
                    </span>
                  </td>

                  {/* Assigned Rider Column */}
                  <td>
                    {order.delivery_partner_name ? (
                      <div className="rider-cell-wrapper">
                        <span className="rider-assigned-pill">
                          <FaMotorcycle className="rider-icon" />
                          <strong className="rider-name-text">{order.delivery_partner_name}</strong>
                        </span>
                        <button
                          onClick={() => handleOpenAssignModal(order)}
                          className="btn-reassign-link"
                          title="Reassign to another rider"
                        >
                          Change Rider
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenAssignModal(order)}
                        className="btn-assign-rider"
                      >
                        <FaMotorcycle /> + Assign Rider
                      </button>
                    )}
                  </td>

                  <td className="actions-cell">
                    <FaEdit 
                      className="action-icon edit-icon" 
                      title="Edit Status"
                      onClick={() => handleEditClick(order)} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <p className="no-data">No orders found.</p>
          )}
        </div>
      </div>
      
      {/* Status Modal */}
      {isModalOpen && selectedOrder && (
        <StatusModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdate={(newStatus) => handleUpdateStatus(selectedOrder.id, newStatus)}
          order={selectedOrder}
        />
      )}

      {/* Assign Rider Dispatch Modal */}
      {isAssignModalOpen && orderToAssign && (
        <div className="assign-modal-overlay">
          <div className="assign-modal-card">
            <div className="assign-modal-header">
              <div className="modal-title-with-icon">
                <FaMotorcycle className="modal-top-icon" />
                <div>
                  <h3>Dispatch Order #{orderToAssign.id}</h3>
                  <p>Assign this medicine package to a registered delivery partner</p>
                </div>
              </div>
              <button
                className="close-x-btn"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setOrderToAssign(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAssignRiderSubmit} className="assign-modal-form">
              <div className="assign-order-summary">
                <div><strong>Patient:</strong> {orderToAssign.shipping_name}</div>
                <div><strong>Destination:</strong> {orderToAssign.shipping_address}</div>
                <div><strong>Amount:</strong> ₹{orderToAssign.total_amount}</div>
              </div>

              <div className="assign-field-group">
                <label htmlFor="rider-select">Select Delivery Rider:</label>
                <select
                  id="rider-select"
                  required
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="rider-select-input"
                >
                  <option value="">-- Choose an active rider --</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.vehicle_type || 'Bike'} - {r.vehicle_number || 'No plate'}) • {r.is_online ? '🟢 Online' : '⚪ Offline'}
                    </option>
                  ))}
                </select>
              </div>

              {riders.length === 0 && (
                <p className="no-riders-warning">
                  ⚠️ No delivery riders are registered yet. New partners can sign up at <code>/delivery/signup</code>.
                </p>
              )}

              <div className="assign-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !selectedRiderId}
                  className="btn-dispatch-confirm"
                >
                  {assignLoading ? 'Dispatching...' : 'Confirm & Dispatch Rider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;