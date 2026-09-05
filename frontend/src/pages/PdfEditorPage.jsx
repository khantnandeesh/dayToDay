import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PdfEditor from '../components/pdf/PdfEditor';

export default function PdfEditorPage() {
  const location = useLocation();
  const initialPdfUrl = location.state?.fileUrl || null;
  const initialFilename = location.state?.fileName || null;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <PdfEditor initialPdfUrl={initialPdfUrl} initialFilename={initialFilename} />
      </div>
    </div>
  );
}
