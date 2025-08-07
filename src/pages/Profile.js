import './Profile.css';

function Profile() {
  return (
    <div className="profile">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Manage your account settings and preferences</p>
      </div>
      
      <div className="profile-content">
        <div className="coming-soon">
          <div className="coming-soon-icon">👤</div>
          <h2>Profile Settings Coming Soon</h2>
          <p>Update your personal information, change your password, and customize your account preferences.</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;