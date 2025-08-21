import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitch from '../components/LanguageSwitch';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';


const Login = () => {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || t('loginFailed') || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card fade-in-up">
        {/* 語言切換 */}
        <div className="language-switch-container">
          <LanguageSwitch />
        </div>

        {/* 標題區域 */}
        <div className="login-header">
          <h1 className="login-title title">
            {t('loginTitle')}
          </h1>
          <p className="login-subtitle subtitle">
            {t('loginSubtitle')}
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              {t('email')}
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              placeholder={t('emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {t('password')}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-field"
              placeholder={t('passwordPlaceholder')}
              required
            />
          </div>

          {error && (
            <div className="error-message login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-button"
            disabled={loading}
          >
            {loading ? (
              <div className="loading-content">
                <div className="loading-spinner"></div>
                {t('loggingIn')}
              </div>
            ) : (
              t('login')
            )}
          </button>
        </form>

        {/* 額外資訊 */}
        <div className="login-footer">
          <p className="forgot-password-text">
            {t('forgotPassword')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;