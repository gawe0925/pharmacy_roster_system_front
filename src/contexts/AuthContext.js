// contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, memberAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 獲取當前用戶完整信息
  const fetchCurrentUserData = async (loginEmail) => {
    try {
      const token = localStorage.getItem('token'); // 統一使用 'token'
      if (!token) {
        return null;
      }

      if (!loginEmail) {
        return null;
      }

      // 從員工列表中找到完整的用戶數據
      const membersResponse = await memberAPI.list();
      let members = [];
      if (membersResponse.data) {
        members = membersResponse.data;
      } else if (Array.isArray(membersResponse)) {
        members = membersResponse;
      }

      // 根據登入時使用的 email 找到當前用戶
      const currentUser = members.find(member => {
        return member.email.toLowerCase() === loginEmail.toLowerCase();
      });

      if (currentUser) {
        return currentUser;
      }

      return null;
    } catch (error) {
      console.error('獲取當前用戶數據失敗:', error);
      return null;
    }
  };

  // 驗證 token 和用戶信息的一致性
  const validateTokenUserConsistency = (token, user) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tokenUserId = parseInt(payload.user_id);
      const userIdFromStorage = parseInt(user.id);
      
      console.log('Token validation:', {
        tokenUserId,
        userIdFromStorage,
        isConsistent: tokenUserId === userIdFromStorage
      });
      
      return tokenUserId === userIdFromStorage;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token'); // 統一使用 'token'
        const refreshToken = localStorage.getItem('refresh_token');
        const storedUser = localStorage.getItem('user');
        
        if (token && refreshToken && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
          try {
            const basicUser = JSON.parse(storedUser);
            
            // 驗證 token 和用戶信息是否一致
            if (basicUser.id && !validateTokenUserConsistency(token, basicUser)) {
              console.warn('Token and user data inconsistent, clearing auth state');
              localStorage.removeItem('token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              setUser(null);
              return;
            }
            
            // 獲取登入時的 email
            const loginEmail = basicUser.email || basicUser.username;
            
            if (loginEmail) {
              const fullUserData = await fetchCurrentUserData(loginEmail);
              
              if (fullUserData) {
                // 再次驗證完整用戶數據的一致性
                if (validateTokenUserConsistency(token, fullUserData)) {
                  setUser(fullUserData);
                  localStorage.setItem('user', JSON.stringify(fullUserData));
                } else {
                  console.warn('Full user data inconsistent with token, clearing auth state');
                  localStorage.removeItem('token');
                  localStorage.removeItem('refresh_token');
                  localStorage.removeItem('user');
                  setUser(null);
                }
              } else {
                setUser(basicUser);
              }
            } else {
              setUser(basicUser);
            }
          } catch (parseError) {
            console.error('解析用戶數據失敗:', parseError);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
          }
        }
      } catch (error) {
        console.error('初始化認證失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      
      const response = await authAPI.login(credentials);
      const { access, refresh } = response.data;
      
      if (access && refresh) {
        // 原子性更新：先清除舊數據，再設置新數據
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // 設置新的認證數據
        localStorage.setItem('token', access); // 統一使用 'token'
        localStorage.setItem('refresh_token', refresh);
        
        const loginEmail = credentials.email || credentials.username;
        
        try {
          // 獲取完整用戶數據
          const fullUserData = await fetchCurrentUserData(loginEmail);
          
          if (fullUserData) {
            // 驗證 token 和用戶數據的一致性
            if (validateTokenUserConsistency(access, fullUserData)) {
              setUser(fullUserData);
              localStorage.setItem('user', JSON.stringify(fullUserData));
              console.log('Login successful - User:', fullUserData.first_name, fullUserData.last_name);
            } else {
              throw new Error('Token and user data mismatch');
            }
          } else {
            // 如果無法獲取完整數據，使用基本數據
            const basicUserData = {
              email: loginEmail,
              username: loginEmail,
            };
            setUser(basicUserData);
            localStorage.setItem('user', JSON.stringify(basicUserData));
          }
        } catch (fetchError) {
          console.error('獲取完整數據時出錯:', fetchError);
          // 清除不一致的數據
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          throw fetchError;
        }
        
        return { success: true, data: response.data };
      } else {
        throw new Error('回應數據無效');
      }
    } catch (error) {
      console.error('登入錯誤:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '登入失敗';
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token'); // 統一使用 'token'
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshUserData = async () => {
    try {
      if (!user || !user.email) {
        return null;
      }
      
      // 驗證當前 token 是否還有效
      const token = localStorage.getItem('token');
      if (!token || !validateTokenUserConsistency(token, user)) {
        console.warn('Token invalid during refresh, logging out');
        logout();
        return null;
      }
      
      const fullUserData = await fetchCurrentUserData(user.email);
      
      if (fullUserData && validateTokenUserConsistency(token, fullUserData)) {
        setUser(fullUserData);
        localStorage.setItem('user', JSON.stringify(fullUserData));
        return fullUserData;
      }
    } catch (error) {
      console.error('刷新用戶數據失敗:', error);
    }
    return user;
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};