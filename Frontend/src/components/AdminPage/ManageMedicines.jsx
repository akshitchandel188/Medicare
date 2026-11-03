import React, { useState, useEffect } from 'react';
import { FaPlus, FaSearch, FaEdit, FaTrash } from 'react-icons/fa';
import AddMedicineModal from './AddMedicineModal';
import EditMedicineModal from './EditMedicineModal';
import './ManageMedicines.css';
import API from '../../config/api';

const ManageMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch products from API on mount
  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/admin/products`);
      if (response.ok) {
        const data = await response.json();
        setMedicines(data);
      } else {
        console.error('Failed to fetch medicines');
      }
    } catch (error) {
      console.error('Error fetching medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async (newMedicine) => {
    try {
      const response = await fetch(`${API}/api/admin/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMedicine.name,
          category: newMedicine.category,
          subcategory: newMedicine.subcategory || null,
          price: newMedicine.price,
          originalPrice: newMedicine.originalPrice || newMedicine.price,
          discount: newMedicine.discount || 0,
          description: newMedicine.description || '',
          image: newMedicine.image || '',
          manufacturer: newMedicine.manufacturer,
          unitsAvailable: newMedicine.stock || 0,
          rxRequired: false,
          dosage: '',
          sideEffects: [],
          precautions: [],
          status: newMedicine.stock > 0 ? 'In Stock' : 'Out of Stock'
        })
      });

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        alert('Medicine added successfully!');
      } else {
        alert('Failed to add medicine');
      }
    } catch (error) {
      console.error('Error adding medicine:', error);
      alert('Error adding medicine');
    }
  };

  const handleUpdateMedicine = async (updatedMedicine) => {
    try {
      const response = await fetch(`${API}/api/admin/products/${updatedMedicine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedMedicine.name,
          category: updatedMedicine.category,
          subcategory: updatedMedicine.subcategory || null,
          price: updatedMedicine.price,
          originalPrice: updatedMedicine.originalPrice || updatedMedicine.price,
          discount: updatedMedicine.discount || 0,
          description: updatedMedicine.description || '',
          image: updatedMedicine.image || '',
          manufacturer: updatedMedicine.manufacturer,
          unitsAvailable: updatedMedicine.stock || 0,
          rxRequired: false,
          dosage: '',
          sideEffects: [],
          precautions: [],
          status: updatedMedicine.stock > 0 ? 'In Stock' : 'Out of Stock'
        })
      });

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        setIsEditModalOpen(false);
        alert('Medicine updated successfully!');
      } else {
        alert('Failed to update medicine');
      }
    } catch (error) {
      console.error('Error updating medicine:', error);
      alert('Error updating medicine');
    }
  };

  const handleDelete = async (medicineId) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) {
      return;
    }

    try {
      const response = await fetch(`${API}/api/admin/products/${medicineId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchMedicines(); // Refresh the list
        alert('Medicine deleted successfully!');
      } else {
        alert('Failed to delete medicine');
      }
    } catch (error) {
      console.error('Error deleting medicine:', error);
      alert('Error deleting medicine');
    }
  };

  const handleEditClick = (medicine) => {
    setSelectedMedicine(medicine);
    setIsEditModalOpen(true);
  };

  const filteredMedicines = medicines.filter(med =>
    med.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatus = (stock) => {
    if (stock > 50) return 'In Stock';
    if (stock > 0) return 'Low Stock';
    return 'Out of Stock';
  };

  if (loading) {
    return (
      <div className="manage-medicines-container">
        <p>Loading medicines...</p>
      </div>
    );
  }

  return (
    <div className="manage-medicines-container">
      <div className="manage-medicines-header">
        <div>
          <h1>Manage Medicines</h1>
          <p>Add, edit, and manage your medicine inventory</p>
        </div>
        <button className="add-medicine-button" onClick={() => setIsAddModalOpen(true)}>
          <FaPlus /> Add Medicine
        </button>
      </div>

      <div className="medicine-inventory-section">
        <div className="section-header">
          <h2>Medicine Inventory</h2>
          <div className="search-bar">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search medicines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="medicine-table-container">
          <table>
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Manufacturer</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedicines.map((med) => (
                <tr key={med.id}>
                  <td>{med.name}</td>
                  <td>{med.category}</td>
                  <td>₹{med.price}</td>
                  <td>{med.units_available || 0}</td>
                  <td>{med.manufacturer}</td>
                  <td>{med.expiry_date || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${getStatus(med.units_available || 0).toLowerCase().replace(/\s/g, '-')}`}>
                      {getStatus(med.units_available || 0).replace(/ /g, '\u00a0')}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <FaEdit className="action-icon" onClick={() => handleEditClick(med)} />
                    <FaTrash className="action-icon trash-icon" onClick={() => handleDelete(med.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AddMedicineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddMedicine}
      />
      {isEditModalOpen && (
        <EditMedicineModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={handleUpdateMedicine}
          medicine={selectedMedicine}
        />
      )}
    </div>
  );
};

export default ManageMedicines;
