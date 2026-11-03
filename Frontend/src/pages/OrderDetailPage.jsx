import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OrderDetailPage.css';
import { BsArrowLeft, BsCheckCircle, BsClock, BsTruck, BsBox } from 'react-icons/bs';
import MockOrderTrackingMap from '../components/OrderTrackingMap/MockOrderTrackingMap';
import API from '../config/api';

const OrderDetailPage = () => {
    const { orderId } = useParams();
    const { user } = useAuth();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            try {
                const response = await fetch(`${API}/api/orders/${orderId}`, {
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    setOrder(data);
                } else {
                    console.error('Failed to fetch order details');
                }
            } catch (error) {
                console.error('Error fetching order:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchOrderDetails();
        }
    }, [orderId, user]);

    if (loading) {
        return <div className="order-detail-loading">Loading order details...</div>;
    }

    if (!order) {
        return (
            <div className="order-not-found">
                <h2>Order not found</h2>
                <Link to="/my-orders">Back to My Orders</Link>
            </div>
        );
    }

    // Order status timeline
    const statuses = ['Order Placed', 'Processing', 'Out for Delivery', 'Delivered'];
    const currentStatusIndex = statuses.indexOf(order.status || 'Order Placed');

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Order Placed': return <BsBox />;
            case 'Processing': return <BsClock />;
            case 'Out for Delivery': return <BsTruck />;
            case 'Delivered': return <BsCheckCircle />;
            default: return <BsBox />;
        }
    };

    return (
        <div className="order-detail-page">
            <Link to="/profile" className="back-link">
                <BsArrowLeft /> Back to My Orders
            </Link>

            <div className="order-detail-container">
                {/* Order Header */}
                <div className="order-header">
                    <div>
                        <h1>Order #{order.id}</h1>
                        <p className="order-date">
                            Placed on {new Date(order.order_date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <div className="order-total">
                        <span className="total-label">Total Amount</span>
                        <span className="total-amount">₹{Number(order.total_amount).toFixed(2)}</span>
                    </div>
                </div>

                {/* Live Tracking - Mock Map */}
                {order.status === 'Out for Delivery' && (
                    <MockOrderTrackingMap order={order} />
                )}

                {/* Tracking Timeline */}
                <div className="tracking-timeline">
                    <h2>Order Status</h2>
                    <div className="timeline">
                        {statuses.map((status, index) => (
                            <div
                                key={status}
                                className={`timeline-item ${index <= currentStatusIndex ? 'completed' : ''} ${index === currentStatusIndex ? 'current' : ''}`}
                            >
                                <div className="timeline-icon">
                                    {getStatusIcon(status)}
                                </div>
                                <div className="timeline-content">
                                    <h3>{status}</h3>
                                    {index === currentStatusIndex && (
                                        <p className="current-status-text">Current Status</p>
                                    )}
                                </div>
                                {index < statuses.length - 1 && <div className="timeline-line"></div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Items */}
                <div className="order-items-section">
                    <h2>Order Items ({order.items?.length || 0})</h2>
                    <div className="order-items-list">
                        {order.items?.map((item) => (
                            <div key={item.id} className="order-item">
                                <div className="item-info">
                                    <h3>{item.product_name}</h3>
                                    <p className="item-category">{item.product_category}</p>
                                </div>
                                <div className="item-details">
                                    <span className="item-quantity">Qty: {item.quantity}</span>
                                    <span className="item-price">₹{Number(item.price_at_purchase).toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery Information & Partner Details */}
                <div className="delivery-info-section">
                    <h2>Delivery Details</h2>

                    {/* Delivery Security PIN for Customer */}
                    {order.delivery_otp && order.status === 'Out for Delivery' && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
                            border: '2px dashed #10b981',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.25rem 0', color: '#047857', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🔒 Delivery Security PIN
                                </h3>
                                <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>
                                    Please share this 4-digit PIN with your delivery rider upon package arrival.
                                </p>
                            </div>
                            <div style={{
                                background: '#10b981',
                                color: 'white',
                                padding: '0.5rem 1.25rem',
                                borderRadius: '10px',
                                fontSize: '1.75rem',
                                fontWeight: '800',
                                letterSpacing: '0.25em',
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                            }}>
                                {order.delivery_otp}
                            </div>
                        </div>
                    )}

                    {/* Assigned Rider Card */}
                    {order.delivery_partner_name && (
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }}>
                            <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>
                                    Assigned Delivery Partner
                                </span>
                                <h3 style={{ margin: '0.25rem 0', color: '#0f172a', fontSize: '1.15rem' }}>
                                    {order.delivery_partner_name}
                                </h3>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                                    Vehicle: {order.vehicle_type || 'Motorcycle'} {order.vehicle_number ? `(${order.vehicle_number})` : ''}
                                </p>
                            </div>

                            {order.delivery_partner_phone && (
                                <a
                                    href={`tel:${order.delivery_partner_phone}`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: '#2563eb',
                                        color: 'white',
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        textDecoration: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    📞 Call Rider
                                </a>
                            )}
                        </div>
                    )}

                    <div className="info-card">
                        <div className="info-row">
                            <span className="info-label">Name:</span>
                            <span className="info-value">{order.shipping_name}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Address:</span>
                            <span className="info-value">{order.shipping_address}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Phone:</span>
                            <span className="info-value">{order.shipping_phone}</span>
                        </div>
                        {order.estimated_delivery && (
                            <div className="info-row">
                                <span className="info-label">Estimated Delivery:</span>
                                <span className="info-value">
                                    {new Date(order.estimated_delivery).toLocaleString('en-IN')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailPage;
