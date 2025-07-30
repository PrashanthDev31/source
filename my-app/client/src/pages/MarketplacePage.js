import React, { useState, useEffect, useRef } from 'react';

const SpinnerIcon = ({ color = 'text-white' }) => (
    <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Camera Modal Component ---
const CameraModal = ({ onClose, onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                onClose(); // Close modal if camera access is denied
            }
        };
        if (!capturedImage) {
            startCamera();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [capturedImage, stream, onClose]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageUrl = canvas.toDataURL('image/jpeg');
            setCapturedImage(imageUrl);
            stream.getTracks().forEach(track => track.stop()); // Stop camera feed
        }
    };

    const handleUsePicture = () => {
        if (capturedImage) {
            fetch(capturedImage)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                });
        }
    };
    
    const handleRetake = () => {
        setCapturedImage(null);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                <h3 className="text-xl font-bold mb-4">{capturedImage ? 'Preview' : 'Live Camera'}</h3>
                <div className="relative">
                    <video ref={videoRef} autoPlay playsInline className={`w-full rounded ${capturedImage ? 'hidden' : 'block'}`}></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {capturedImage && <img src={capturedImage} alt="Captured" className="w-full rounded" />}
                </div>
                <div className="mt-4 flex justify-end gap-4">
                    {capturedImage ? (
                        <>
                            <button onClick={handleRetake} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Retake</button>
                            <button onClick={handleUsePicture} className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700">Use Picture</button>
                        </>
                    ) : (
                        <>
                            <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Cancel</button>
                            <button onClick={handleCapture} className="py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Take Picture</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


function MarketplacePage({ onNavigate, token, user }) {
    const [listings, setListings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [price, setPrice] = useState('');
    const [imageFiles, setImageFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    const isFormValid = title && location && price && imageFiles.length > 0;

    const fetchListings = async (query = '') => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/api/marketplace?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Failed to fetch listings');
            const data = await response.json();
            setListings(data);
        } catch (error) {
            console.error("Error fetching listings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchListings();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchListings(searchTerm);
    };

    const handleFileChange = (e) => {
        setImageFiles(prev => [...prev, ...Array.from(e.target.files)]);
    };

    const handleCameraCapture = (file) => {
        setImageFiles(prev => [...prev, file]);
        setShowCamera(false);
    };
    
    // Replace the old handleContactSeller function
const handleContactSeller = async (listing) => {
    if (!token) {
        onNavigate('login');
        return;
    }
    try {
        const response = await fetch('http://localhost:8000/api/conversations/find-or-create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                listingId: listing.id,
                sellerId: listing.sellerId
            })
        });
        if (!response.ok) throw new Error('Could not start conversation');
        
        const conversation = await response.json();
        onNavigate('chat', { conversationId: conversation._id });

    } catch (err) {
        console.error("Error starting conversation:", err);
        // You might want to show an error to the user here
    }
};

    const handleCreateListing = async (e) => {
        e.preventDefault();
        if (!isFormValid) {
            setError('Title, Location, Price, and at least one Image are required.');
            return;
        }
        setIsUploading(true);
        setError('');

        const uploadedImageUrls = [];
        for (const file of imageFiles) {
            const formData = new FormData();
            formData.append('image', file);
            try {
                const imageResponse = await fetch('http://localhost:8000/api/marketplace/upload-image', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData,
                });
                if (!imageResponse.ok) throw new Error('Image upload failed');
                const imageData = await imageResponse.json();
                uploadedImageUrls.push(imageData.imageUrl);
            } catch (err) {
                setError('Failed to upload one or more images. Please try again.');
                setIsUploading(false);
                return;
            }
        }

        try {
            const listingData = { title, price: parseFloat(price), location, imageUrls: uploadedImageUrls };
            const listingResponse = await fetch('http://localhost:8000/api/marketplace', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(listingData),
            });
            if (!listingResponse.ok) throw new Error('Failed to create listing');
            
            setShowCreateForm(false);
            setTitle('');
            setLocation('');
            setPrice('');
            setImageFiles([]);
            fetchListings();

        } catch (err) {
            setError('Failed to create listing. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-100">
            {showCamera && <CameraModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <button onClick={() => onNavigate('home')} className="text-purple-600 hover:text-purple-800 font-semibold">&larr; Back to Home</button>
                    {token && (
                         <button onClick={() => setShowCreateForm(!showCreateForm)} className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors">
                            {showCreateForm ? 'Cancel' : '+ Create Listing'}
                        </button>
                    )}
                </div>
            </header>

            <main className="container mx-auto px-6 py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Desi Marketplace</h1>
                    <p className="text-gray-600 mt-2">Buy and sell goods within the community.</p>
                </div>

                {showCreateForm && (
                    <div className="bg-white p-8 rounded-lg shadow-lg mb-12 max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold mb-6">Create a New Listing</h2>
                        <form onSubmit={handleCreateListing} className="space-y-4">
                            <input type="text" placeholder="Item Name / Title *" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded-lg" />
                            <input type="text" placeholder="Location (e.g., City, State) *" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 border rounded-lg" />
                            <input type="number" placeholder="Price (USD) *" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-3 border rounded-lg" step="0.01" />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image(s) *</label>
                                <div className="flex items-center gap-4">
                                    <input type="file" onChange={handleFileChange} multiple className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"/>
                                    <button type="button" onClick={() => setShowCamera(true)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300">
                                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    </button>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">You have selected {imageFiles.length} image(s).</div>
                            </div>
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <button type="submit" disabled={!isFormValid || isUploading} className="w-full py-3 px-6 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center">
                                {isUploading ? <><SpinnerIcon /> Posting...</> : 'Post Listing'}
                            </button>
                        </form>
                    </div>
                )}

                <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12 flex gap-4">
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search for items..." className="flex-grow w-full p-3 border rounded-lg shadow-sm" />
                    <button type="submit" className="py-3 px-6 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors">Search</button>
                </form>

                {isLoading ? <p className="text-center">Loading listings...</p> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {listings.length === 0 ? <p className="col-span-full text-center">No listings found.</p> :
                            listings.map(item => (
                                <div key={item.id} className="bg-white rounded-lg shadow-lg overflow-hidden group">
                                    <div className="relative">
                                        <img src={(item.imageUrls && item.imageUrls.length > 0) ? item.imageUrls[0] : 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image'} alt={item.title} className="w-full h-48 object-cover" />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                                            {user?.id !== item.sellerId && (
                                                <button 
                                                    onClick={() => handleContactSeller(item)}
                                                    className="py-2 px-4 bg-white text-gray-800 font-semibold rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                >
                                                    Contact Seller
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="font-bold text-lg">{item.title}</h3>
                                        <p className="text-2xl font-bold text-green-600 my-2">${parseFloat(item.price).toFixed(2)}</p>
                                        <p className="text-sm text-gray-500"><svg className="w-4 h-4 inline -mt-1 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>{item.location}</p>
                                        <div className="border-t mt-4 pt-4 text-sm text-gray-500">
                                            <p>Seller: {item.sellerName}</p>
                                            <p>Posted: {new Date(item.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}
            </main>
        </div>
    );
}

export default MarketplacePage;
