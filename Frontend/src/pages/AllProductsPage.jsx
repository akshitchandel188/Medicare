import React, { useEffect, useState } from 'react';
import './AllProductsPage.css';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard/ProductCard';
import { BsArrowLeft } from 'react-icons/bs';
import API from '../config/api';

const AllProductsPage = () => {
  const [searchParams] = useSearchParams();
  const subcategoryFilter = searchParams.get('subcategory');
  const categoryFilter = searchParams.get('category');
  const conditionFilter = searchParams.get('condition');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/api/products`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        } else {
          console.error('Failed to fetch products');
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Scroll to the top of the page whenever any filter changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [subcategoryFilter, categoryFilter, conditionFilter]);

  // Filter products based on URL parameters
  const filteredProducts = products.filter(product => {
    if (!subcategoryFilter && !categoryFilter && !conditionFilter) {
      return true;
    }
    if (subcategoryFilter && product.subcategory === subcategoryFilter) {
      return true;
    }
    if (categoryFilter && product.category === categoryFilter) {
      return true;
    }
    if (conditionFilter && product.condition === conditionFilter) {
      return true;
    }
    return false;
  });

  const pageTitle = subcategoryFilter || categoryFilter || conditionFilter || 'All Products';

  if (loading) {
    return (
      <div className="all-products-page">
        <div className="all-products-container">
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="all-products-page">
      <div className="all-products-container">
        <Link to="/" className="back-to-home">
          <BsArrowLeft /> Back to Home
        </Link>
        <h1 className="all-products-title" style={{ textTransform: 'capitalize' }}>
          {pageTitle.replace('-', ' ')}
        </h1>

        {filteredProducts.length > 0 ? (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="no-products-found">No products found in this category.</p>
        )}
      </div>
    </div>
  );
};

export default AllProductsPage;