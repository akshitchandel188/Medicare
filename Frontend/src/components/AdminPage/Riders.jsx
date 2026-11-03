import React, { useState, useEffect } from 'react';
import {
  FaMotorcycle,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaBan,
  FaPhoneAlt,
  FaShieldAlt,
  FaUserCheck,
  FaSyncAlt
} from 'react-icons/fa';
import './Riders.css';
import API from '../../config/api';

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRiders = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API}/api/admin/riders`);
      if (!response.ok) {
        throw new Error('Failed to fetch delivery partners');
      }
      const data = await response.json();
      setRiders(data);
    } catch (err) {
      setError(err.message || 'Error fetching riders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  // Toggle Approval
  const handleToggleApproval = async (userId) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API}/api/admin/riders/${userId}/toggle-approval`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        setRiders(riders.map(r => r.id === userId ? { ...r, is_approved: data.is_approved } : r));
      } else {
        alert('Failed to update approval status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating approval status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Block/Suspend
  const handleToggleBlock = async (userId) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API}/api/admin/riders/${userId}/toggle-block`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        setRiders(riders.map(r => r.id === userId ? { ...r, is_blocked: data.is_blocked } : r));
      } else {
        alert('Failed to update rider block status.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating rider block status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const totalRiders = riders.length;
  const onlineRiders = riders.filter(r => r.is_online).length;
  const pendingApprovals = riders.filter(r => !r.is_approved).length;
  const totalDeliveries = riders.reduce((sum, r) => sum + (parseInt(r.total_deliveries, 10) || 0), 0);

  // Filtering
  const filteredRiders = riders.filter((rider) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      (rider.full_name && rider.full_name.toLowerCase().includes(s)) ||
      (rider.email && rider.email.toLowerCase().includes(s)) ||
      (rider.phone_number && rider.phone_number.includes(s)) ||
      (rider.vehicle_number && rider.vehicle_number.toLowerCase().includes(s));

    if (!matchesSearch) return false;

    if (filterStatus === 'Online') return rider.is_online;
    if (filterStatus === 'Offline') return !rider.is_online;
    if (filterStatus === 'Pending') return !rider.is_approved;
    if (filterStatus === 'Blocked') return rider.is_blocked;

    return true;
  });

  return (
    <div className="riders-admin-container">
      {/* Page Header */}
      <div className="riders-header-row">
        <div>
          <h2>Delivery Fleet Partners</h2>
          <p>Manage, verify, and monitor medicine delivery riders</p>
        </div>
        <button onClick={fetchRiders} className="refresh-btn" title="Refresh list">
          <FaSyncAlt /> Refresh Fleet
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="fleet-stats-grid">
        <div className="fleet-stat-card">
          <div className="stat-icon-box blue">
            <FaMotorcycle />
          </div>
          <div>
            <span className="stat-title">Total Registered Fleet</span>
            <span className="stat-num">{totalRiders}</span>
          </div>
        </div>

        <div className="fleet-stat-card">
          <div className="stat-icon-box green">
            <span className="live-dot-pulse"></span>
          </div>
          <div>
            <span className="stat-title">Online Right Now</span>
            <span className="stat-num">{onlineRiders}</span>
          </div>
        </div>

        <div className="fleet-stat-card">
          <div className="stat-icon-box amber">
            <FaShieldAlt />
          </div>
          <div>
            <span className="stat-title">Pending Approvals</span>
            <span className="stat-num">{pendingApprovals}</span>
          </div>
        </div>

        <div className="fleet-stat-card">
          <div className="stat-icon-box purple">
            <FaCheckCircle />
          </div>
          <div>
            <span className="stat-title">All-Time Deliveries</span>
            <span className="stat-num">{totalDeliveries}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="riders-controls-bar">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by rider name, phone, email, plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-box">
          <label>Filter:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All Partners ({totalRiders})</option>
            <option value="Online">Online Now ({onlineRiders})</option>
            <option value="Offline">Offline ({totalRiders - onlineRiders})</option>
            <option value="Pending">Pending Approval ({pendingApprovals})</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Riders Table */}
      {loading ? (
        <div className="loading-state">Loading delivery fleet...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : filteredRiders.length === 0 ? (
        <div className="empty-riders-box">
          <FaMotorcycle className="empty-icon" />
          <h3>No delivery partners found</h3>
          <p>
            {searchTerm || filterStatus !== 'All'
              ? 'Try adjusting your search or filter.'
              : 'New riders can register via /delivery/signup to join the fleet.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="riders-table">
            <thead>
              <tr>
                <th>Rider</th>
                <th>Contact</th>
                <th>Vehicle & Hub</th>
                <th>Duty Status</th>
                <th>Verification</th>
                <th>Deliveries</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.map((rider) => (
                <tr key={rider.id} className={rider.is_blocked ? 'row-blocked' : ''}>
                  {/* Rider Info */}
                  <td>
                    <div className="rider-cell-name">
                      <div className="rider-avatar-sm">
                        {rider.full_name ? rider.full_name.charAt(0).toUpperCase() : 'R'}
                      </div>
                      <div>
                        <strong>{rider.full_name}</strong>
                        <span className="rider-id-sub">ID: #{rider.id}</span>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td>
                    <div className="rider-cell-contact">
                      <span>{rider.email}</span>
                      {rider.phone_number && (
                        <a href={`tel:${rider.phone_number}`} className="phone-link">
                          <FaPhoneAlt /> {rider.phone_number}
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Vehicle & Hub */}
                  <td>
                    <div className="vehicle-cell">
                      <span className="vehicle-badge">
                        {rider.vehicle_type || 'Motorcycle'}
                      </span>
                      <span className="plate-num">{rider.vehicle_number || 'N/A'}</span>
                      <span className="city-sub">{rider.city || 'Delhi NCR'}</span>
                    </div>
                  </td>

                  {/* Duty Status */}
                  <td>
                    {rider.is_online ? (
                      <span className="badge-online">
                        <span className="dot-green"></span> Online
                      </span>
                    ) : (
                      <span className="badge-offline">
                        <span className="dot-grey"></span> Offline
                      </span>
                    )}
                  </td>

                  {/* Verification Status */}
                  <td>
                    {rider.is_approved ? (
                      <span className="badge-approved">
                        <FaCheckCircle /> Approved
                      </span>
                    ) : (
                      <span className="badge-pending">
                        <FaTimesCircle /> Pending
                      </span>
                    )}
                  </td>

                  {/* Deliveries */}
                  <td>
                    <div className="deliveries-cell">
                      <strong>{rider.total_deliveries || 0}</strong>
                      {parseInt(rider.active_orders_count, 10) > 0 && (
                        <span className="active-runs-badge">
                          {rider.active_orders_count} active
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="action-buttons-cell">
                      {/* Approve / Revoke */}
                      <button
                        onClick={() => handleToggleApproval(rider.id)}
                        disabled={actionLoading}
                        className={`action-btn ${rider.is_approved ? 'btn-revoke' : 'btn-approve'}`}
                        title={rider.is_approved ? 'Revoke Approval' : 'Approve Rider'}
                      >
                        {rider.is_approved ? 'Revoke' : 'Approve'}
                      </button>

                      {/* Block / Unblock */}
                      <button
                        onClick={() => handleToggleBlock(rider.id)}
                        disabled={actionLoading}
                        className={`action-btn ${rider.is_blocked ? 'btn-unblock' : 'btn-block'}`}
                        title={rider.is_blocked ? 'Unblock Rider' : 'Suspend Rider'}
                      >
                        {rider.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Riders;
