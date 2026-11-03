import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PrescriptionUploadPage.css';
import { FaUpload, FaFileImage, FaFilePdf, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { BsFileEarmarkMedicalFill } from 'react-icons/bs';
import API from '../config/api';

const PrescriptionUploadPage = () => {
    const navigate = useNavigate();
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleFileSelect = (event) => {
        const file = event.target.files[0];

        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            setError('Please upload only JPG, PNG, or PDF files');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB');
            return;
        }

        setError('');
        setSelectedFile(file);

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setPreview(null);
        setError('');
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('prescription', selectedFile);

            // TODO: Replace with actual API endpoint
            const response = await fetch(`${API}/api/prescriptions/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Add auth token if needed
                    // 'x-auth-token': token
                },
            });

            if (response.ok) {
                setUploadSuccess(true);
                setTimeout(() => {
                    navigate('/products'); // Redirect to products page
                }, 2000);
            } else {
                const data = await response.json();
                setError(data.message || 'Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="prescription-upload-page">
            <div className="upload-container">
                <div className="upload-header">
                    <BsFileEarmarkMedicalFill className="header-icon" />
                    <h1>Upload Prescription</h1>
                    <p>Upload your prescription and we'll deliver your medicines to your doorstep</p>
                </div>

                {!uploadSuccess ? (
                    <>
                        <div className="upload-area">
                            {!selectedFile ? (
                                <label htmlFor="file-input" className="file-drop-zone">
                                    <FaUpload className="upload-icon" />
                                    <h3>Click to upload or drag and drop</h3>
                                    <p>JPG, PNG or PDF (Max 5MB)</p>
                                    <input
                                        id="file-input"
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            ) : (
                                <div className="file-preview">
                                    <button className="remove-file-btn" onClick={handleRemoveFile}>
                                        <FaTimes />
                                    </button>

                                    {preview ? (
                                        <img src={preview} alt="Prescription preview" className="preview-image" />
                                    ) : (
                                        <div className="pdf-preview">
                                            <FaFilePdf className="pdf-icon" />
                                            <p>{selectedFile.name}</p>
                                        </div>
                                    )}

                                    <div className="file-info">
                                        <p className="file-name">{selectedFile.name}</p>
                                        <p className="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="error-message">
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="upload-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => navigate('/')}
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                className="upload-submit-btn"
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                            >
                                {uploading ? 'Uploading...' : 'Upload & Continue'}
                            </button>
                        </div>

                        <div className="upload-instructions">
                            <h3>Instructions for a valid prescription</h3>
                            <ul>
                                <li>Prescription should be clear and readable</li>
                                <li>Include doctor's name and signature</li>
                                <li>Prescription should not be older than 6 months</li>
                                <li>Ensure all medicine names are visible</li>
                            </ul>
                        </div>
                    </>
                ) : (
                    <div className="success-message">
                        <FaCheckCircle className="success-icon" />
                        <h2>Prescription Uploaded Successfully!</h2>
                        <p>Redirecting you to browse medicines...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrescriptionUploadPage;
