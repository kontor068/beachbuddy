
import React from 'react';
import { Island } from '../types';

interface AdminImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: (data: Island[]) => void;
}

export const AdminImportModal: React.FC<AdminImportModalProps> = () => {
    return null;
};
