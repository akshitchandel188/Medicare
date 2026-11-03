import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';
import { FaPaperPlane, FaTimes, FaPills, FaBook } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import API from '../../config/api';

// ─── Constants ───────────────────────────────────────────────────────────────
// Keep at most this many turns (user + bot pairs) in memory for context
const MAX_HISTORY_TURNS = 3;

// ─── Helper: source type → readable label ────────────────────────────────────
function sourceTypeLabel(type) {
  switch (type) {
    case 'medicine_overview':     return 'Medicine Info';
    case 'medicine_dosage':       return 'Dosage Guide';
    case 'medicine_side_effects': return 'Side Effects';
    case 'medicine_precautions':  return 'Precautions';
    case 'medicine_uses':         return 'Uses';
    case 'blog_article':          return 'HealthMeds Blog';
    default:                      return 'Knowledge Base';
  }
}

// ─── Source icon ─────────────────────────────────────────────────────────────
function SourceIcon({ type }) {
  if (type === 'blog_article') return <FaBook style={{ marginRight: '5px', opacity: 0.7 }} />;
  return <FaPills style={{ marginRight: '5px', opacity: 0.7 }} />;
}

// ─── Chatbot Component ───────────────────────────────────────────────────────
const Chatbot = ({ onClose }) => {
  const [messages, setMessages]   = useState([{
    sender: 'bot',
    text: 'Hello! I\'m the HealthMeds AI Medicine Assistant. Ask me about medicines, health topics, or finding products in our catalog.',
    sources:  [],
    products: [],
  }]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // conversationHistory is what we send to the backend for multi-turn context: [{ role, content }, ...]
  const [conversationHistory, setConversationHistory] = useState([]);

  const chatEndRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();

    // Add user message to UI immediately
    const userMessage = { sender: 'user', text: userText, sources: [], products: [] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Build the history array we'll send to the backend.
    // We trim to the last MAX_HISTORY_TURNS * 2 items (user + model alternating)
    const historyToSend = conversationHistory.slice(-(MAX_HISTORY_TURNS * 2));

    try {
      const controller  = new AbortController();
      const timeoutId   = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const response = await fetch(`${API}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:             userText,
          conversationHistory: historyToSend,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      const { reply = '', sources = [], products = [] } = data;

      // Add bot reply to UI
      const botMessage = { sender: 'bot', text: reply, sources, products };
      setMessages(prev => [...prev, botMessage]);

      // Update conversation history for multi-turn context.
      // We append the user's message and the assistant's reply so follow-up questions work.
      setConversationHistory(prev => [
        ...prev,
        { role: 'user',      content: userText },
        { role: 'assistant', content: reply },
      ]);

    } catch (error) {
      let errorText = 'Sorry, something went wrong. Please try again.';
      if (error.name === 'AbortError') {
        errorText = 'The request timed out. Please try again.';
      } else if (error.message) {
        errorText = error.message;
      }
      setMessages(prev => [...prev, { sender: 'bot', text: errorText, sources: [], products: [] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-window">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <FaPills className="chatbot-header-icon" />
            <div>
              <h3>HealthMeds AI Assistant</h3>
              <span className="chatbot-header-sub">Powered by RAG + Groq</span>
            </div>
          </div>
          <button onClick={onClose} className="close-btn" aria-label="Close chat"><FaTimes /></button>
        </div>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <div className="chatbot-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message-group ${msg.sender}`}>

              {/* The text bubble */}
              <div className={`message-bubble ${msg.sender}`}>
                {msg.text}
              </div>

              {/* Sources / Citations — only shown for bot messages with sources */}
              {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                <div className="sources-panel">
                  <span className="sources-label">Sources:</span>
                  <ul className="sources-list">
                    {msg.sources.map((src, i) => (
                      <li key={i} className="source-item">
                        <SourceIcon type={src.type} />
                        <span>{src.name}</span>
                        <span className="source-type-badge">{sourceTypeLabel(src.type)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Product Cards — only shown when live products were found */}
              {msg.sender === 'bot' && msg.products && msg.products.length > 0 && (
                <div className="product-cards-row">
                  {msg.products.map((product) => (
                    <div key={product.id} className="product-mini-card">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="product-mini-image"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="product-mini-info">
                        <p className="product-mini-name">{product.name}</p>
                        <p className="product-mini-meta">{product.manufacturer}</p>
                        <div className="product-mini-price-row">
                          <span className="product-mini-price">₹{product.price}</span>
                          <span className={`product-mini-status ${product.status === 'In Stock' ? 'in-stock' : 'out-of-stock'}`}>
                            {product.status}
                          </span>
                        </div>
                        {product.rx_required && (
                          <span className="product-mini-rx">Rx Required</span>
                        )}
                      </div>
                      <Link to={`/product/${product.id}`} className="product-mini-link" onClick={onClose}>
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}

          {/* Loading dots */}
          {isLoading && (
            <div className="chat-message-group bot">
              <div className="message-bubble bot loading">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <form className="chatbot-input" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about medicines, symptoms, or products..."
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message">
            <FaPaperPlane />
          </button>
        </form>

      </div>
    </div>
  );
};

export default Chatbot;