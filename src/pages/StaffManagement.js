import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitch from '../components/LanguageSwitch';
import { memberAPI } from '../services/api';
import '../styles/StaffManagement.css';

const StaffManagement = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [allStaff, setAllStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        mobile: '',
        position_type: 'casual',
        is_active: true,
        password: '',
        confirm_password: ''
    });

    // 檢查用戶權限
    const isCurrentUserAdmin = () => {
        return user?.is_superuser === true;
    };

    const isCurrentUserManager = () => {
        return user?.is_superuser === false && user?.is_manager === true;
    };

    const isCurrentUserEmployee = () => {
        return user?.is_superuser === false && user?.is_manager === false;
    };

    const canEditPassword = () => {
        if (!editingStaff) return true; // 新增用戶時可以設密碼

        const userIsAdmin = isCurrentUserAdmin();
        const isEditingSelf = editingStaff.email === user?.email;

        return userIsAdmin || isEditingSelf;
    };

    // 載入員工數據
    useEffect(() => {
        if (user && allStaff.length === 0) {
            loadStaff();
        }
    }, [user, allStaff.length]);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const response = await memberAPI.list();
            
            let staffData = [];
            if (response.data) {
                staffData = response.data;
            } else if (Array.isArray(response)) {
                staffData = response;
            }
            
            setAllStaff(staffData || []);
        } catch (error) {
            console.error('載入員工資料失敗:', error);
            alert(t('loadStaffError') || '載入員工資料失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    };

    // 根據權限過濾員工數據
    const getFilteredStaff = () => {
        if (isCurrentUserAdmin()) {
            return allStaff;
        } else if (isCurrentUserManager()) {
            return allStaff.filter(member => member.is_superuser === false);
        } else {
            return allStaff.filter(member => member.email === user?.email);
        }
    };

    // 職位類型翻譯
    const getPositionTypeDisplay = (positionType) => {
        const types = {
            'full': t('fullTime') || '正職員工',
            'part': t('partTime') || '兼職員工', 
            'casual': t('casual') || '臨時工',
            'admin': t('admin') || '管理員',
        };
        return types[positionType] || positionType;
    };

    // 檢查員工是否為管理員
    const isAdmin = (member) => {
        return member.is_superuser === true;
    };

    // 檢查員工是否為經理
    const isManager = (member) => {
        return member.is_superuser === false && member.is_manager === true;
    };

    // 獲取用戶角色顯示
    const getUserRoleDisplay = () => {
        if (isCurrentUserAdmin()) return t('admin') || '管理員';
        if (isCurrentUserManager()) return t('manager') || '經理';
        return t('employee') || '職員';
    };

    // 獲取過濾後的員工列表
    const staff = getFilteredStaff();

    // 搜索過濾
    const filteredStaff = staff.filter(member =>
        member.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPositionTypeDisplay(member.position_type)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 處理表單輸入
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // 提交表單
    const handleSubmit = async (e) => {
        e.preventDefault();
        // 密碼驗證
        if (formData.password && formData.password !== formData.confirm_password) {
            alert(t('passwordMismatch') || '密碼確認不一致');
            return;
        }

        if (formData.password && formData.password.length < 6) {
            alert(t('passwordTooShort') || '密碼至少需要6個字符');
            return;
        }

        try {
            if (editingStaff) {
                // 更新現有員工
                const userIsAdmin = isCurrentUserAdmin();
                const isEditingSelf = editingStaff.email === user?.email;
                
                let updateData;
                
                if (userIsAdmin) {
                    updateData = {
                        first_name: formData.first_name,
                        last_name: formData.last_name,
                        email: formData.email,
                        mobile: formData.mobile,
                        position_type: formData.position_type,
                        is_active: formData.is_active
                    };
                    
                    // 管理員可以修改任何人的密碼
                    if (formData.password) {
                        updateData.password = formData.password;
                    }
                } else if (isEditingSelf) {
                    // 用戶只能修改自己的部分資料
                    updateData = {
                        mobile: formData.mobile,
                    };

                    // 只有管理員和經理可以修改職位類型
                    if (isCurrentUserManager() || isCurrentUserAdmin()) {
                        updateData.position_type = formData.position_type;
                        updateData.is_active = formData.is_active;
                    }
                    
                    // 用戶可以修改自己的密碼
                    if (formData.password) {
                        updateData.password = formData.password;
                    }
                } else {
                    // 經理修改其他員工（不包括密碼）
                    updateData = {
                        mobile: formData.mobile,
                        position_type: formData.position_type,
                        is_active: formData.is_active
                    };
                }

                const updatedStaff = await memberAPI.update(editingStaff.id, updateData);
                
                setAllStaff(prev => 
                    prev.map(member => 
                        member.id === editingStaff.id ? updatedStaff : member
                    )
                );
                
                resetForm();
                alert(t('updateStaffSuccess') || '員工資料更新成功！');
            } else {
                // 創建新員工
                if (!isCurrentUserAdmin() && !isCurrentUserManager()) {
                    alert(t('noPermissionAddStaff') || '您沒有權限新增員工');
                    return;
                }
                
                if (!formData.password) {
                    alert(t('passwordRequired') || '新用戶密碼為必填');
                    return;
                }
                
                // 準備新員工數據 - 確保包含所有必要的字段
                const newStaffData = {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    mobile: formData.mobile || '',
                    position_type: formData.position_type,
                    is_active: true,
                    permanent_position: formData.position_type === 'full',
                    password: formData.password
                };

                console.log('準備新增的員工數據:', newStaffData);
                
                const newStaff = await memberAPI.create(newStaffData);
                console.log('新增成功的員工:', newStaff);
                
                // 更新本地狀態
                setAllStaff(prev => [...prev, newStaff]);
                
                resetForm();
                alert(t('addStaffSuccess') || '新增員工成功！');
            }
        } catch (error) {
            console.error('操作失敗:', error);
            console.error('錯誤回應:', error.response);
            
            // 更詳細的錯誤處理
            let errorMessage = t('operationFailed') || '操作失敗';
            
            if (error.response?.data) {
                const errorData = error.response.data;
                console.error('後端錯誤詳情:', errorData);
                
                if (typeof errorData === 'string') {
                    errorMessage = errorData;
                } else if (errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error) {
                    errorMessage = errorData.error;
                } else {
                    // 處理字段驗證錯誤
                    const fieldErrors = [];
                    for (const [field, errors] of Object.entries(errorData)) {
                        if (Array.isArray(errors)) {
                            fieldErrors.push(`${field}: ${errors.join(', ')}`);
                        } else if (typeof errors === 'string') {
                            fieldErrors.push(`${field}: ${errors}`);
                        }
                    }
                    if (fieldErrors.length > 0) {
                        errorMessage = fieldErrors.join('\n');
                    }
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            alert(`${t('operationFailed') || '操作失敗'}：\n${errorMessage}`);
        }
    };

    // 重置表單
    const resetForm = () => {
        setFormData({
            first_name: '',
            last_name: '',
            email: '',
            mobile: '',
            position_type: 'casual',
            is_active: true,
            password: '',
            confirm_password: ''
        });
        setShowAddForm(false);
        setEditingStaff(null);
    };

    // 編輯員工
    const handleEdit = (member) => {
        setFormData({
            first_name: member.first_name || '',
            last_name: member.last_name || '',
            email: member.email || '',
            mobile: member.mobile || '',
            position_type: member.position_type || 'casual',
            is_active: member.is_active !== false,
            password: '',
            confirm_password: ''
        });
        setEditingStaff(member);
        setShowAddForm(true);
    };

    // 切換員工狀態
    const handleToggleStatus = async (member) => {
        if (!isCurrentUserAdmin() && !isCurrentUserManager()) {
            alert(t('noPermissionModifyStatus') || '您沒有權限修改員工狀態');
            return;
        }

        if (isAdmin(member)) {
            alert(t('cannotDeactivateAdmin') || '無法停用管理員帳戶');
            return;
        }

        if (!member.id) {
            console.error('員工 ID 不存在:', member);
            alert(t('incompleteStaffData') || '員工資料不完整，無法執行操作');
            return;
        }

        const newStatus = !member.is_active;
        const action = newStatus ? (t('confirmActivate') || '確定啟用') : (t('confirmDeactivate') || '確定停用');
        const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email;
        
        if (window.confirm(`${action} ${name} ${t('questionMark') || '嗎？'}`)) {
            try {
                const updatedStaff = await memberAPI.update(member.id, {
                    is_active: newStatus
                });
                
                setAllStaff(prev => 
                    prev.map(staffMember => 
                        staffMember.id === member.id ? updatedStaff : staffMember
                    )
                );
                
                alert(t('statusUpdateSuccess') || '員工狀態更新成功！');
                
            } catch (error) {
                console.error('狀態更新失敗:', error);
                
                let errorMessage = t('statusUpdateFailed') || '狀態更新失敗';
                if (error.response?.data?.detail) {
                    errorMessage = error.response.data.detail;
                } else if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                
                alert(errorMessage);
            }
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="loading-spinner"></div>
                <p>{t('loading') || '載入中...'}</p>
            </div>
        );
    }

    const canAddStaff = isCurrentUserAdmin() || isCurrentUserManager();

    return (
        <div className="staff-management">
            <div className="page-header">
                <div className="header-content">
                    <h1 className="page-title">{t('staffManagement')}</h1>
                    <div className="header-actions">
                        <LanguageSwitch />
                        {canAddStaff && (
                            <button 
                                className="btn-primary"
                                onClick={() => setShowAddForm(true)}
                            >
                                <span className="btn-icon">+</span>
                                {t('addStaff')}
                            </button>
                        )}
                        <button 
                            className="btn-secondary"
                            onClick={() => navigate('/dashboard')}
                        >
                            ← {t('backToDashboard')}
                        </button>
                    </div>
                </div>
            </div>

            {/* 搜索區域 */}
            <div className="search-section">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder={t('searchStaff')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="search-stats">
                    {t('totalStaff')}: {filteredStaff.length} {t('people')}
                    <span className="user-role-badge">
                        ({getUserRoleDisplay()})
                    </span>
                </div>
            </div>

            {/* 員工列表 */}
            <div className="staff-grid">
                {filteredStaff.map((member, index) => {
                    const memberIsAdmin = isAdmin(member);
                    const memberIsManager = isManager(member);
                    
                    return (
                        <div key={member.id || `${member.email}-${index}`} className={`staff-card ${!member.is_active ? 'inactive-card' : ''}`}>
                            <div className="staff-avatar">
                                {(member.first_name || member.email || 'U')[0].toUpperCase()}
                            </div>
                            
                            <div className="staff-info">
                                <h3 className="staff-name">
                                    {member.first_name || (t('notSet') || '未設定')} {member.last_name || ''}
                                </h3>
                                <p className="staff-email">📧 {member.email}</p>
                                <p className="staff-mobile">📱 {member.mobile || (t('notSet') || '未設定')}</p>
                                <p className="staff-position">
                                    💼 {getPositionTypeDisplay(member.position_type)}
                                </p>
                            </div>

                            <div className="staff-status">
                                <span className={`status-badge ${member.is_active ? 'active' : 'inactive'}`}>
                                    {member.is_active ? (t('active') || '在職') : (t('inactive') || '離職')}
                                </span>
                                {memberIsAdmin && (
                                    <span className="status-badge admin">
                                        {t('admin') || '管理員'}
                                    </span>
                                )}
                                {memberIsManager && (
                                    <span className="status-badge manager">
                                        {t('manager') || '經理'}
                                    </span>
                                )}
                            </div>

                            <div className="staff-actions">
                                <button 
                                    className="btn-edit"
                                    onClick={() => handleEdit(member)}
                                    title={t('edit') || '編輯'}
                                >
                                    ✏️
                                </button>
                                
                                {!memberIsAdmin && (isCurrentUserAdmin() || isCurrentUserManager()) ? (
                                    <button 
                                        className={`btn-toggle ${member.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                                        onClick={() => handleToggleStatus(member)}
                                        title={member.is_active ? (t('deactivate') || '停用') : (t('activate') || '啟用')}
                                    >
                                        {member.is_active ? '🚫' : '✅'}
                                    </button>
                                ) : memberIsAdmin ? (
                                    <span className="admin-indicator">
                                        {t('admin') || '管理員'}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredStaff.length === 0 && (
                <div className="no-results">
                    <div className="no-results-icon">👥</div>
                    <p>{searchTerm ? (t('noStaffFound') || '沒有找到符合條件的員工') : (t('noStaffData') || '暫無員工資料')}</p>
                </div>
            )}

            {/* 新增/編輯表單 Modal */}
            {showAddForm && (
                <div className="modal-overlay" onClick={resetForm}>
                    <div className="modal-content staff-form-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingStaff ? (t('editStaff') || '編輯員工') : (t('addStaff') || '新增員工')}</h2>
                            <button className="close-btn" onClick={resetForm}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="staff-form">
                            <div className="form-grid">
                                {/* 姓名欄位 */}
                                <div className="form-group">
                                    <label className="form-label">
                                        {t('firstName') || '名字'} <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleInputChange}
                                        required
                                        disabled={editingStaff && !isCurrentUserAdmin()}
                                        className={`form-input ${editingStaff && !isCurrentUserAdmin() ? 'disabled' : ''}`}
                                        placeholder={t('enterFirstName') || '請輸入名字'}
                                    />
                                    {editingStaff && !isCurrentUserAdmin() && (
                                        <span className="permission-hint">{t('adminOnlyModify') || '僅管理員可修改'}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('lastName') || '姓氏'}</label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleInputChange}
                                        disabled={editingStaff && !isCurrentUserAdmin()}
                                        className={`form-input ${editingStaff && !isCurrentUserAdmin() ? 'disabled' : ''}`}
                                        placeholder={t('enterLastName') || '請輸入姓氏'}
                                    />
                                    {editingStaff && !isCurrentUserAdmin() && (
                                        <span className="permission-hint">{t('adminOnlyModify') || '僅管理員可修改'}</span>
                                    )}
                                </div>

                                {/* Email 和手機 */}
                                <div className="form-group">
                                    <label className="form-label">
                                        {t('email') || 'Email'} <span className="required">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                        disabled={editingStaff && !isCurrentUserAdmin()}
                                        className={`form-input ${editingStaff && !isCurrentUserAdmin() ? 'disabled' : ''}`}
                                        placeholder={t('enterEmail') || '請輸入電子郵件'}
                                    />
                                    {editingStaff && !isCurrentUserAdmin() && (
                                        <span className="permission-hint">{t('adminOnlyModify') || '僅管理員可修改'}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('mobile') || '手機號碼'}</label>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleInputChange}
                                        className="form-input"
                                        placeholder={t('enterMobile') || '請輸入手機號碼'}
                                    />
                                </div>

                                {/* 密碼字段 - 同一行 */}
                                {canEditPassword() && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">
                                                {editingStaff ? (t('newPassword') || '新密碼') : (t('password') || '密碼')}
                                                {!editingStaff && <span className="required">*</span>}
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                required={!editingStaff}
                                                className="form-input"
                                                placeholder={editingStaff ? (t('leaveBlankToKeep') || '留空保持原密碼') : (t('enterPassword') || '請輸入密碼')}
                                                minLength="6"
                                            />
                                            {editingStaff && (
                                                <span className="permission-hint">{t('passwordHint') || '留空則不修改密碼，至少6個字符'}</span>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                {t('confirmPassword') || '確認密碼'}
                                                {!editingStaff && <span className="required">*</span>}
                                            </label>
                                            <input
                                                type="password"
                                                name="confirm_password"
                                                value={formData.confirm_password}
                                                onChange={handleInputChange}
                                                required={!editingStaff && formData.password}
                                                className="form-input"
                                                placeholder={t('confirmPasswordPlaceholder') || '請再次輸入密碼'}
                                                minLength="6"
                                            />
                                        </div>
                                    </>
                                )}

                                {!canEditPassword() && editingStaff && (
                                    <div className="form-group" style={{gridColumn: '1 / -1'}}>
                                        <div className="password-restriction-notice">
                                            <span className="permission-hint">
                                                {t('passwordEditRestriction') || '只有管理員或用戶本人可以修改密碼'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 職位類型 - 移到最後，增加權限控制 */}
                                <div className="form-group">
                                    <label className="form-label">
                                        {t('positionType') || '職位類型'} <span className="required">*</span>
                                    </label>
                                    <select
                                        name="position_type"
                                        value={formData.position_type}
                                        onChange={handleInputChange}
                                        required
                                        className="form-select"
                                        disabled={editingStaff && isCurrentUserEmployee()}
                                    >
                                        <option value="casual">{t('casual') || '臨時工'}</option>
                                        <option value="part">{t('partTime') || '兼職員工'}</option>
                                        <option value="full">{t('fullTime') || '正職員工'}</option>
                                        {isCurrentUserAdmin() && (
                                            <option value="admin">{t('admin') || '管理員'}</option>
                                        )}
                                    </select>
                                </div>

                                {/* 空的佔位 div，讓職位類型保持在左邊 */}
                                <div className="form-group">
                                </div>

                                {/* 在職狀態 - 只有編輯時才顯示 */}
                                {editingStaff && (
                                    <div className="form-group checkbox-full-width">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                name="is_active"
                                                checked={formData.is_active}
                                                onChange={handleInputChange}
                                                className="form-checkbox"
                                                disabled={isCurrentUserEmployee() && editingStaff.email === user?.email}
                                            />
                                            <span className="checkbox-mark"></span>
                                            {t('activeStatus') || '在職狀態'}
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn-cancel" onClick={resetForm}>
                                    {t('cancel') || '取消'}
                                </button>
                                <button type="submit" className="btn-submit">
                                    {editingStaff ? (t('update') || '更新') : (t('add') || '新增')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;