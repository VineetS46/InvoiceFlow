// src/pages/Admin.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Admin.css';
import { Button, CircularProgress } from '@material-ui/core';

const Admin = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUsers = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                const token = await user.getIdToken();
                const response = await fetch('http://localhost:7071/api/getUsers', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Could not fetch users.');
                const data = await response.json();
                setUsers(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUsers();
    }, [user]);

    const handleSetRole = async (targetUid, newRole) => {
        if (!window.confirm(`Are you sure you want to make this user an '${newRole}'?`)) return;

        try {
            const token = await user.getIdToken();
            const response = await fetch('http://localhost:7071/api/setRole', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: targetUid, role: newRole })
            });
            if (!response.ok) throw new Error('Failed to set role.');
            // Refresh the user list to show the change
            const updatedUsers = users.map(u => u.uid === targetUid ? { ...u, role: newRole } : u);
            setUsers(updatedUsers);
            alert('Role updated successfully!');
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (isLoading) return <div className="loading-container"><CircularProgress /></div>;
    if (error) return <div className="error-container">{error}</div>;

    return (
        <div className="admin-panel">
            <h1>Admin Panel - User Management</h1>
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.uid}>
                            <td>{u.username}</td>
                            <td>{u.email}</td>
                            <td>
                                <span className={`role-badge ${u.role}`}>{u.role || 'user'}</span>
                            </td>
                            <td>
                                {u.role !== 'admin' ? (
                                    <Button variant="contained" color="primary" onClick={() => handleSetRole(u.uid, 'admin')}>
                                        Make Admin
                                    </Button>
                                ) : (
                                    <Button variant="contained" color="secondary" onClick={() => handleSetRole(u.uid, 'user')}>
                                        Remove Admin
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Admin;