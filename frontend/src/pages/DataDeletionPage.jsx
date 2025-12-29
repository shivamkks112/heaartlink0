import { useEffect } from 'react';

const DataDeletionPage = () => {
  useEffect(() => {
    window.location.href = '/data-deletion.html';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Data Deletion Policy...</p>
      </div>
    </div>
  );
};

export default DataDeletionPage;