import React from 'react';

export const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total } = pagination;

  return (
    <div className="admin-pagination">
      <span>
        Showing page {page} of {totalPages} ({total} total records)
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          &larr; Previous
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
};

export default Pagination;
