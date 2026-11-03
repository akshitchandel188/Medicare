import React, { useState, useEffect } from 'react';
import {
  FaRupeeSign,
  FaShoppingCart,
  FaUsers,
  FaMotorcycle,
  FaBoxes,
  FaSyncAlt,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaPrescriptionBottleAlt,
  FaChartLine,
  FaWarehouse,
  FaShieldAlt,
  FaTruck
} from 'react-icons/fa';
import './Dashboard.css';
import API from '../../config/api';

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      setError('');
      const response = await fetch(`${API}/api/admin/analytics`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Could not sync analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // 30s live polling
    return () => clearInterval(interval);
  }, []);

  if (loading && !analytics) {
    return (
      <div className="dashboard-container">
        <div className="analytics-loading-box">
          <div className="analytics-spinner"></div>
          <p>Compiling live analytics and database metrics...</p>
        </div>
      </div>
    );
  }

  const {
    financials = {},
    orderStatuses = [],
    salesTrend = [],
    inventory = {},
    categories = [],
    customers = {},
    fleet = {}
  } = analytics || {};

  // Status color mapper
  const getStatusColor = (status) => {
    const s = status.toLowerCase();
    if (s.includes('delivered')) return '#10b981';
    if (s.includes('out for delivery')) return '#f59e0b';
    if (s.includes('processing')) return '#3b82f6';
    if (s.includes('shipped')) return '#8b5cf6';
    if (s.includes('cancelled')) return '#ef4444';
    return '#64748b';
  };

  // Find max revenue in trend for relative bar heights
  const maxTrendRevenue = Math.max(...salesTrend.map(t => t.revenue), 500);

  // Fulfillment rate calculation
  const totalOrdersCount = financials.totalOrders || 1;
  const fulfillmentRate = Math.min(100, Math.round(((fleet.completedDeliveries || 0) / totalOrdersCount) * 100));

  return (
    <div className="dashboard-container">
      {/* ── Dashboard Header ── */}
      <div className="dashboard-header-row">
        <div>
          <h1>Analytics & Executive Overview</h1>
          <p>Real-time telemetry on revenue, order pipeline, inventory health, and delivery operations</p>
        </div>
        <div className="dashboard-header-actions">
          <div className="live-status-pill">
            <span className="live-pulse-dot"></span>
            <span>Live DB Telemetry</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className={`btn-sync-analytics ${refreshing ? 'spinning' : ''}`}
            title="Refresh analytics data"
            disabled={refreshing}
          >
            <FaSyncAlt /> {refreshing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="analytics-error-banner">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {/* ── Top Executive KPI Cards ── */}
      <div className="analytics-kpi-grid">
        {/* Card 1: Total Revenue */}
        <div className="kpi-card highlight-green">
          <div className="kpi-content">
            <span className="kpi-label">Total Revenue</span>
            <h2 className="kpi-value">₹{Number(financials.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="kpi-badge-subtext green">
              <span>Avg. Order: ₹{Number(financials.averageOrderValue || 0).toFixed(1)}</span>
            </div>
          </div>
          <div className="kpi-icon-badge green">
            <FaRupeeSign />
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="kpi-card highlight-blue">
          <div className="kpi-content">
            <span className="kpi-label">Total Orders</span>
            <h2 className="kpi-value">{financials.totalOrders || 0}</h2>
            <div className="kpi-badge-subtext blue">
              <span>{orderStatuses.find(s => s.status === 'Processing')?.count || 0} Processing now</span>
            </div>
          </div>
          <div className="kpi-icon-badge blue">
            <FaShoppingCart />
          </div>
        </div>

        {/* Card 3: Active Customers */}
        <div className="kpi-card highlight-purple">
          <div className="kpi-content">
            <span className="kpi-label">Total Customers</span>
            <h2 className="kpi-value">{customers.total || 0}</h2>
            <div className="kpi-badge-subtext purple">
              <span>{customers.active || 0} Active accounts</span>
            </div>
          </div>
          <div className="kpi-icon-badge purple">
            <FaUsers />
          </div>
        </div>

        {/* Card 4: Delivery Fleet */}
        <div className="kpi-card highlight-amber">
          <div className="kpi-content">
            <span className="kpi-label">Fleet on Duty</span>
            <h2 className="kpi-value">{fleet.onlineRiders || 0} <span className="kpi-sub-count">/ {fleet.totalRiders || 0}</span></h2>
            <div className="kpi-badge-subtext amber">
              <span>{fleet.activeDeliveries || 0} In-transit • {fleet.completedDeliveries || 0} Delivered</span>
            </div>
          </div>
          <div className="kpi-icon-badge amber">
            <FaMotorcycle />
          </div>
        </div>

        {/* Card 5: Inventory Catalog */}
        <div className="kpi-card highlight-indigo">
          <div className="kpi-content">
            <span className="kpi-label">Active Medicines</span>
            <h2 className="kpi-value">{inventory.totalProducts || 0}</h2>
            <div className="kpi-badge-subtext indigo">
              <span>{inventory.lowStock || 0} Low stock • {inventory.rxRequired || 0} Rx Required</span>
            </div>
          </div>
          <div className="kpi-icon-badge indigo">
            <FaBoxes />
          </div>
        </div>
      </div>

      {/* ── Main Analytics Section Grid (2-Column) ── */}
      <div className="analytics-sections-grid">
        {/* Section 1: Order Pipeline & Status Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h3>Order Pipeline & Fulfillment Distribution</h3>
              <p>Breakdown of all {financials.totalOrders || 0} customer orders by operational stage</p>
            </div>
            <div className="card-header-icon blue">
              <FaChartLine />
            </div>
          </div>

          {/* Segmented multi-color progress bar */}
          <div className="pipeline-multi-bar">
            {orderStatuses.map((st, idx) => {
              const pct = ((st.count / totalOrdersCount) * 100).toFixed(1);
              return (
                <div
                  key={idx}
                  className="multi-bar-segment"
                  style={{
                    width: `${Math.max(Number(pct), 3)}%`,
                    backgroundColor: getStatusColor(st.status)
                  }}
                  title={`${st.status}: ${st.count} orders (${pct}%)`}
                />
              );
            })}
          </div>

          {/* Status Breakdown List */}
          <div className="status-breakdown-list">
            {orderStatuses.map((st, idx) => {
              const pct = Math.round((st.count / totalOrdersCount) * 100);
              const color = getStatusColor(st.status);
              return (
                <div key={idx} className="status-breakdown-row">
                  <div className="status-name-group">
                    <span className="status-color-dot" style={{ backgroundColor: color }}></span>
                    <strong>{st.status}</strong>
                  </div>
                  <div className="status-progress-track">
                    <div
                      className="status-progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    ></div>
                  </div>
                  <div className="status-count-group">
                    <span className="status-order-count">{st.count} orders</span>
                    <span className="status-order-pct">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Pharmacy Inventory & Stock Health */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h3>Pharmacy Catalog & Stock Health</h3>
              <p>Live inventory safety thresholds and therapeutic category distribution</p>
            </div>
            <div className="card-header-icon emerald">
              <FaWarehouse />
            </div>
          </div>

          {/* Stock Health Badges */}
          <div className="inventory-health-badges">
            <div className="health-badge in-stock">
              <FaCheckCircle className="badge-ico green" />
              <div>
                <strong>{inventory.inStock || 0}</strong>
                <span>In Stock (&gt;15)</span>
              </div>
            </div>
            <div className="health-badge low-stock">
              <FaExclamationTriangle className="badge-ico amber" />
              <div>
                <strong>{inventory.lowStock || 0}</strong>
                <span>Low Stock (&lt;15)</span>
              </div>
            </div>
            <div className="health-badge out-stock">
              <FaExclamationTriangle className="badge-ico red" />
              <div>
                <strong>{inventory.outOfStock || 0}</strong>
                <span>Out of Stock</span>
              </div>
            </div>
            <div className="health-badge rx-stock">
              <FaPrescriptionBottleAlt className="badge-ico purple" />
              <div>
                <strong>{inventory.rxRequired || 0}</strong>
                <span>Rx Required</span>
              </div>
            </div>
          </div>

          {/* Category Distribution with visual bars */}
          <div className="category-distribution-header">
            <h4>Top Therapeutic Categories</h4>
          </div>
          <div className="category-distribution-list">
            {categories.slice(0, 5).map((cat, idx) => {
              const maxCatCount = categories[0]?.count || 1;
              const catPct = Math.round((cat.count / maxCatCount) * 100);
              return (
                <div key={idx} className="category-row">
                  <div className="category-info">
                    <span className="category-name">{cat.category}</span>
                    <span className="category-count">{cat.count} products</span>
                  </div>
                  <div className="category-bar-track">
                    <div
                      className="category-bar-fill"
                      style={{ width: `${catPct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Revenue & Order Activity Trend */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h3>Recent Revenue & Sales Timeline</h3>
              <p>Daily performance and order volume trajectory across recent dates</p>
            </div>
            <div className="card-header-icon indigo">
              <FaChartLine />
            </div>
          </div>

          <div className="trend-histogram-container">
            <div className="trend-bars-wrapper">
              {salesTrend.map((item, idx) => {
                const heightPct = Math.max(15, Math.round((item.revenue / maxTrendRevenue) * 100));
                return (
                  <div key={idx} className="trend-column" title={`${item.date}: ₹${item.revenue} (${item.orders} orders)`}>
                    <div className="trend-amount-tooltip">
                      ₹{item.revenue}
                    </div>
                    <div className="trend-bar-slot">
                      <div
                        className="trend-bar-pillar"
                        style={{ height: `${heightPct}%` }}
                      >
                        <span className="trend-bar-orders">{item.orders}</span>
                      </div>
                    </div>
                    <span className="trend-date-label">
                      {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 4: Fleet & Operations Summary */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h3>Fulfillment & Fleet Operations</h3>
              <p>Rider readiness, order turnaround, and dispatch efficiency metrics</p>
            </div>
            <div className="card-header-icon amber">
              <FaTruck />
            </div>
          </div>

          <div className="operations-metrics-grid">
            <div className="ops-metric-box">
              <div className="ops-metric-header">
                <span className="ops-metric-title">Fulfillment Velocity</span>
                <span className="ops-metric-pill green">{fulfillmentRate}%</span>
              </div>
              <div className="ops-gauge-track">
                <div className="ops-gauge-fill green" style={{ width: `${fulfillmentRate}%` }}></div>
              </div>
              <small className="ops-metric-desc">{fleet.completedDeliveries || 0} of {financials.totalOrders || 0} lifetime orders delivered successfully</small>
            </div>

            <div className="ops-metric-box">
              <div className="ops-metric-header">
                <span className="ops-metric-title">Riders on Duty</span>
                <span className="ops-metric-pill blue">{fleet.onlineRiders || 0} Active</span>
              </div>
              <div className="ops-gauge-track">
                <div
                  className="ops-gauge-fill blue"
                  style={{ width: `${Math.round(((fleet.onlineRiders || 0) / (fleet.totalRiders || 1)) * 100)}%` }}
                ></div>
              </div>
              <small className="ops-metric-desc">{fleet.onlineRiders || 0} ready to claim pickups • {fleet.totalRiders || 0} registered</small>
            </div>

            <div className="ops-metric-box">
              <div className="ops-metric-header">
                <span className="ops-metric-title">Unassigned Orders</span>
                <span className={`ops-metric-pill ${fleet.unassignedOrders > 0 ? 'amber' : 'green'}`}>
                  {fleet.unassignedOrders || 0} Pending
                </span>
              </div>
              <small className="ops-metric-desc">
                {fleet.unassignedOrders > 0
                  ? 'Orders waiting in Pickup Pool for available rider dispatch'
                  : 'All ready orders currently claimed or assigned to riders'}
              </small>
            </div>

            <div className="ops-metric-box">
              <div className="ops-metric-header">
                <span className="ops-metric-title">Platform Security & Audit</span>
                <span className="ops-metric-pill purple">Protected</span>
              </div>
              <small className="ops-metric-desc">
                {customers.blocked || 0} suspended accounts • Multi-tier role separation enforced
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
