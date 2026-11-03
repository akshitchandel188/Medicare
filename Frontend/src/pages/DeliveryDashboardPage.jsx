import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaMotorcycle,
  FaBoxOpen,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaDirections,
  FaRupeeSign,
  FaSignOutAlt,
  FaShieldAlt,
  FaExclamationTriangle,
  FaPills,
  FaUserEdit,
  FaSyncAlt,
  FaTimes,
  FaSearch
} from 'react-icons/fa';
import { BsArrowLeft } from 'react-icons/bs';
import './DeliveryDashboardPage.css';
import API from '../config/api';

const DeliveryDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    activeOrders: 0,
    deliveredToday: 0,
    totalDelivered: 0,
    estimatedEarningsToday: 0
  });
  const [activeOrders, setActiveOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [pickupSearch, setPickupSearch] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'available' | 'history' | 'profile'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal State for OTP
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [otpError, setOtpError] = useState('');

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    try {
      setErrorMsg('');
      const [profileRes, activeRes, availableRes, historyRes] = await Promise.all([
        fetch(`${API}/api/delivery/profile`, { credentials: 'include' }),
        fetch(`${API}/api/delivery/orders/active`, { credentials: 'include' }),
        fetch(`${API}/api/delivery/orders/available`, { credentials: 'include' }),
        fetch(`${API}/api/delivery/orders/history`, { credentials: 'include' })
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile);
        setStats(data.stats);
      } else if (profileRes.status === 403 || profileRes.status === 401) {
        navigate('/delivery/login');
        return;
      }

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveOrders(activeData);
      }

      if (availableRes.ok) {
        const availableData = await availableRes.json();
        setAvailableOrders(availableData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistoryOrders(historyData);
      }

    } catch (err) {
      console.error('Failed to load delivery data:', err);
      setErrorMsg('Could not sync with delivery server. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Duty Status (Online / Offline)
  const handleToggleDuty = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API}/api/delivery/duty-status`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => ({ ...prev, is_online: data.isOnline }));
      }
    } catch (err) {
      console.error('Failed to toggle duty:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Claim / Accept an Order
  const handleAcceptOrder = async (orderId) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API}/api/delivery/orders/${orderId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchDashboardData();
        setActiveTab('active');
      } else {
        const errData = await res.json();
        alert(errData.message || 'Failed to accept order.');
      }
    } catch (err) {
      console.error('Error accepting order:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit OTP to Complete Delivery
  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    setOtpError('');
    if (!selectedOrderForDelivery) return;

    try {
      setActionLoading(true);
      const res = await fetch(`${API}/api/delivery/orders/${selectedOrderForDelivery.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otp: otpInput,
          notes: deliveryNotes
        })
      });

      if (res.ok) {
        setSelectedOrderForDelivery(null);
        setOtpInput('');
        setDeliveryNotes('');
        await fetchDashboardData();
        setActiveTab('history');
      } else {
        const errData = await res.json();
        setOtpError(errData.message || 'Verification failed.');
      }
    } catch (err) {
      console.error('Error completing delivery:', err);
      setOtpError('Network error while completing delivery.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <FaMotorcycle style={{ fontSize: '2.5rem', color: '#2563eb', marginBottom: '15px' }} />
          <p>Loading Delivery Partner Dashboard...</p>
        </div>
      </div>
    );
  }

  const isOnline = profile?.is_online;
  const riderInitial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : (user?.name?.charAt(0) || 'R');

  // Filter available orders by search term
  const filteredAvailableOrders = availableOrders.filter(order => {
    if (!pickupSearch.trim()) return true;
    const term = pickupSearch.toLowerCase();
    const idStr = `ORD-${String(order.id).padStart(5, '0')}`.toLowerCase();
    const addr = (order.shipping_address || '').toLowerCase();
    const name = (order.shipping_name || '').toLowerCase();
    return idStr.includes(term) || addr.includes(term) || name.includes(term);
  });

  return (
    <div className="delivery-fleet-app">
      {/* Rider Fleet Topbar - Clean and focused for drivers, without customer shopping links */}
      <header className="fleet-top-navbar">
        <div className="fleet-brand">
          <div className="fleet-logo-icon">
            <FaMotorcycle />
          </div>
          <div>
            <span className="fleet-brand-name">HealthMeds <strong>Fleet</strong></span>
            <span className="fleet-hub-tag">{profile?.city || 'Delhi NCR'} Hub</span>
          </div>
        </div>

        <div className="fleet-top-actions">
          <button onClick={fetchDashboardData} className="rider-refresh-btn" title="Sync live orders">
            <FaSyncAlt /> Sync
          </button>
          <button onClick={logout} className="rider-top-logout" title="Sign Out">
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </header>

      <div className="profile-page-container delivery-dashboard-page">
        <div className="delivery-header-title-row">
          <div>
            <h2>Delivery Partner Dashboard</h2>
            <p className="delivery-subtitle">Manage deliveries, track earnings, and dispatch packages</p>
          </div>
        </div>

        <div className="profile-dashboard">
        {/* Left Sidebar - Styled identically to ProfilePage, fixed on scroll */}
        <div className="profile-sidebar delivery-rider-sidebar">
          <div className="user-info">
            <div className="user-avatar delivery-avatar">
              {riderInitial}
            </div>
            <strong>{profile?.full_name || user?.name || 'Delivery Partner'}</strong>
            <span>{profile?.email || user?.email}</span>
            <div className="rider-vehicle-pill">
              {profile?.vehicle_type || 'Motorcycle'} • {profile?.vehicle_number || 'Registered Rider'}
            </div>

            {/* Duty Status Switch */}
            <button
              onClick={handleToggleDuty}
              disabled={actionLoading}
              className={`duty-toggle-switch ${isOnline ? 'online' : 'offline'}`}
            >
              <span className="duty-dot"></span>
              <span>{isOnline ? '🟢 Online • Ready' : '⚪ Offline'}</span>
            </button>
          </div>

          <nav className="profile-nav">
            <button
              onClick={() => setActiveTab('active')}
              className={activeTab === 'active' ? 'active' : ''}
            >
              <FaMotorcycle /> Active Runs
              {activeOrders.length > 0 && (
                <span className="nav-badge-pill warning">{activeOrders.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('available')}
              className={activeTab === 'available' ? 'active' : ''}
            >
              <FaBoxOpen /> Pickup Pool
              {availableOrders.length > 0 && (
                <span className="nav-badge-pill blue">{availableOrders.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={activeTab === 'history' ? 'active' : ''}
            >
              <FaClock /> Past Deliveries
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={activeTab === 'profile' ? 'active' : ''}
            >
              <FaUserEdit /> Rider Profile
            </button>

            <button onClick={logout} className="logout-nav-btn">
              <FaSignOutAlt /> Sign Out
            </button>
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="profile-content delivery-content-panel">
          {/* Quick Metrics Bar */}
          <div className="rider-summary-cards">
            <div className="summary-card highlight">
              <span className="summary-title">Today's Payout</span>
              <span className="summary-value green">₹{stats.estimatedEarningsToday}</span>
              <small>₹50 per delivery base</small>
            </div>
            <div className="summary-card">
              <span className="summary-title">Active Runs</span>
              <span className="summary-value orange">{activeOrders.length}</span>
              <small>In-transit now</small>
            </div>
            <div className="summary-card">
              <span className="summary-title">Delivered Today</span>
              <span className="summary-value blue">{stats.deliveredToday}</span>
              <small>Completed packages</small>
            </div>
            <div className="summary-card">
              <span className="summary-title">All-Time Deliveries</span>
              <span className="summary-value">{profile?.total_deliveries || stats.totalDelivered || 0}</span>
              <small>Total lifetime trips</small>
            </div>
          </div>

          {!isOnline && (
            <div className="offline-alert-box">
              <FaExclamationTriangle />
              <span>You are currently <strong>Offline</strong>. Switch to <strong>Online • Ready</strong> on the sidebar to accept new orders.</span>
            </div>
          )}

          {/* TAB 1: ACTIVE DELIVERIES */}
          {activeTab === 'active' && (
            <div className="delivery-tab-pane">
              <div className="content-tab-header">
                <h3>Active Deliveries ({activeOrders.length})</h3>
                <p>Orders currently in transit for delivery</p>
              </div>

              {activeOrders.length === 0 ? (
                <div className="empty-panel-box">
                  <FaBoxOpen className="empty-panel-icon" />
                  <p>You have no deliveries currently in progress.</p>
                  <button onClick={() => setActiveTab('available')} className="btn-primary-blue">
                    Check Pickup Pool
                  </button>
                </div>
              ) : (
                <div className="delivery-cards-list">
                  {activeOrders.map(order => (
                    <div key={order.id} className="delivery-run-card">
                      <div className="run-card-header">
                        <div>
                          <span className="run-order-id">Order #ORD-{String(order.id).padStart(5, '0')}</span>
                          <span className="run-date">{new Date(order.order_date).toLocaleDateString()}</span>
                        </div>
                        <span className="order-status out-for-delivery">Out for Delivery</span>
                      </div>

                      <div className="run-customer-details">
                        <div className="cust-row">
                          <FaMapMarkerAlt className="pin-icon" />
                          <div>
                            <strong>{order.shipping_name}</strong>
                            <p className="cust-address">{order.shipping_address}</p>
                          </div>
                        </div>

                        <div className="run-actions-row">
                          {order.shipping_phone && (
                            <a href={`tel:${order.shipping_phone}`} className="run-action-btn phone">
                              <FaPhoneAlt /> Call Customer
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.shipping_address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="run-action-btn maps"
                          >
                            <FaDirections /> Open GPS Route
                          </a>
                        </div>
                      </div>

                      <div className="run-medicines-section">
                        <span className="meds-label"><FaPills /> Package Medicines ({order.items?.length || 0}):</span>
                        <div className="meds-tags-wrap">
                          {order.items?.map((it, idx) => (
                            <span key={idx} className="med-tag">
                              {it.quantity}x {it.product_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="run-card-footer">
                        <div className="run-amount-block">
                          <span>Collect Amount:</span>
                          <strong>₹{Number(order.total_amount).toFixed(2)}</strong>
                        </div>
                        <button
                          onClick={() => setSelectedOrderForDelivery(order)}
                          className="btn-complete-delivery"
                        >
                          <FaShieldAlt /> Verify PIN & Complete Delivery
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PICKUP POOL */}
          {activeTab === 'available' && (
            <div className="delivery-tab-pane">
              <div className="content-tab-header">
                <div className="content-tab-header-flex">
                  <div>
                    <h3>Pickup Pool ({availableOrders.length})</h3>
                    <p>Available orders ready for pickup from local pharmacy partner</p>
                  </div>
                  {availableOrders.length > 2 && (
                    <div className="pickup-filter-box">
                      <FaSearch className="filter-search-icon" />
                      <input
                        type="text"
                        placeholder="Search address or order..."
                        value={pickupSearch}
                        onChange={(e) => setPickupSearch(e.target.value)}
                      />
                      {pickupSearch && (
                        <button
                          className="clear-search-btn"
                          onClick={() => setPickupSearch('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {availableOrders.length === 0 ? (
                <div className="empty-panel-box">
                  <FaCheckCircle className="empty-panel-icon success" />
                  <p>All ready orders have been claimed! New orders will appear here automatically.</p>
                  <button onClick={fetchDashboardData} className="btn-secondary-light">
                    Refresh Orders Feed
                  </button>
                </div>
              ) : filteredAvailableOrders.length === 0 ? (
                <div className="empty-panel-box">
                  <p>No available pickups match "<strong>{pickupSearch}</strong>".</p>
                  <button onClick={() => setPickupSearch('')} className="btn-secondary-light">
                    Clear Search Filter
                  </button>
                </div>
              ) : (
                <div className="delivery-cards-list">
                  {filteredAvailableOrders.map(order => (
                    <div key={order.id} className="delivery-run-card available-card">
                      <div className="run-card-header">
                        <div>
                          <span className="run-order-id">Order #ORD-{String(order.id).padStart(5, '0')}</span>
                          <span className="run-date">{new Date(order.order_date).toLocaleDateString()}</span>
                        </div>
                        <span className="order-status processing">Ready for Pickup</span>
                      </div>

                      <div className="run-customer-details">
                        <div className="cust-row">
                          <FaMapMarkerAlt className="pin-icon" />
                          <div>
                            <strong>Delivery Destination:</strong>
                            <p className="cust-address">{order.shipping_address}</p>
                          </div>
                        </div>
                      </div>

                      <div className="available-meta-bar">
                        <span>📦 {order.items?.length || 1} Item(s)</span>
                        <span>Order Total: <strong>₹{Number(order.total_amount).toFixed(2)}</strong></span>
                        <span className="payout-badge">+₹50 Payout</span>
                      </div>

                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={actionLoading || !isOnline}
                        className="btn-accept-delivery"
                      >
                        {actionLoading ? 'Claiming...' : (
                          <>
                            <FaMotorcycle /> Accept & Start Delivery
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAST DELIVERIES */}
          {activeTab === 'history' && (
            <div className="delivery-tab-pane">
              <div className="content-tab-header">
                <h3>Past Completed Deliveries ({historyOrders.length})</h3>
                <p>Archive of deliveries completed with trip payouts</p>
              </div>

              {historyOrders.length === 0 ? (
                <div className="empty-panel-box">
                  <FaClock className="empty-panel-icon" />
                  <p>You haven't completed any deliveries yet.</p>
                </div>
              ) : (
                <div className="delivery-history-list">
                  {historyOrders.map(order => (
                    <div key={order.id} className="order-item history-order-item">
                      <div className="order-info">
                        <strong>Order #ORD-{String(order.id).padStart(5, '0')}</strong>
                        <span>Delivered: {order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'Delivered'}</span>
                        <span>Patient: {order.shipping_name || 'Customer'}</span>
                        <span className="order-status delivered">Delivered</span>
                      </div>
                      <div className="history-right-pill">
                        <span className="payout-earned-tag">+₹50 Earned</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RIDER PROFILE */}
          {activeTab === 'profile' && (
            <div className="delivery-tab-pane">
              <div className="content-tab-header">
                <h3>Rider & Fleet Profile</h3>
                <p>View your registered vehicle and delivery account information.</p>
              </div>

              <div className="delivery-profile-scroll-area">
                <form className="profile-edit-form" onSubmit={(e) => { e.preventDefault(); alert('Profile is verified and up-to-date.'); }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" defaultValue={profile?.full_name || user?.name} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" defaultValue={profile?.email || user?.email} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" defaultValue={profile?.phone_number || user?.phone} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Vehicle Type</label>
                    <input type="text" defaultValue={profile?.vehicle_type || 'Motorcycle'} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Vehicle License Plate</label>
                    <input type="text" defaultValue={profile?.vehicle_number || 'N/A'} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Operating City / Hub</label>
                    <input type="text" defaultValue={profile?.city || 'Delhi NCR'} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Account Status</label>
                    <input type="text" defaultValue={profile?.is_approved ? 'Verified Partner (Active)' : 'Under Review'} readOnly />
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      {selectedOrderForDelivery && (
        <div className="delivery-modal-overlay">
          <div className="delivery-modal-card-light">
            <div className="modal-header-light">
              <div className="modal-icon-badge">
                <FaShieldAlt />
              </div>
              <div className="modal-title-wrap">
                <h3>Verify Delivery Handover</h3>
                <p>Ask <strong>{selectedOrderForDelivery.shipping_name}</strong> for their 4-digit security PIN displayed on their order screen.</p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setSelectedOrderForDelivery(null);
                  setOtpError('');
                  setOtpInput('');
                }}
              >
                <FaTimes />
              </button>
            </div>

            {otpError && <div className="modal-error-text">{otpError}</div>}

            <form onSubmit={handleCompleteDelivery} className="otp-modal-form-light">
              <div className="form-group">
                <label>4-Digit Security PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="e.g. 4821"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="otp-pin-input-light"
                />
              </div>

              <div className="form-group">
                <label>Delivery Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Handed to customer at doorstep"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                />
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDelivery(null)}
                  className="btn-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !otpInput}
                  className="btn-modal-confirm"
                >
                  {actionLoading ? 'Verifying...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DeliveryDashboardPage;
