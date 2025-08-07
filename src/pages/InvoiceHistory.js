import './InvoiceHistory.css';

function InvoiceHistory() {
  return (
    <div className="invoice-history">
      <div className="page-header">
        <h1 className="page-title">Invoice History</h1>
        <p className="page-subtitle">View and manage all your invoices</p>
      </div>
      
      <div className="invoice-history-content">
        <div className="coming-soon">
          <div className="coming-soon-icon">📄</div>
          <h2>Invoice History Coming Soon</h2>
          <p>View, search, and manage all your invoices in one centralized location with advanced filtering options.</p>
        </div>
      </div>
    </div>
  );
}

export default InvoiceHistory;