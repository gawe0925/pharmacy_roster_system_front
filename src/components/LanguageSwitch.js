import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitch = () => {
  const { language, switchLanguage } = useLanguage();

  const toggleLanguage = () => {
    switchLanguage(language === 'zh' ? 'en' : 'zh');
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 滑塊語言切換按鈕 */}
      <button
        onClick={toggleLanguage}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '90px',
          height: '36px',
          background: 'rgba(87, 83, 78, 0.1)',  // 更深的莫蘭迪灰
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(87, 83, 78, 0.2)',
          borderRadius: '18px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          padding: '2px',
          boxShadow: '0 4px 15px rgba(87, 83, 78, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(87, 83, 78, 0.15)';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 6px 20px rgba(87, 83, 78, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(87, 83, 78, 0.1)';
          e.target.style.transform = 'translateY(0px)';
          e.target.style.boxShadow = '0 4px 15px rgba(87, 83, 78, 0.1)';
        }}
      >
        {/* 滑塊背景 */}
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: language === 'zh' ? '2px' : '46px',
            width: '42px',
            height: '30px',
            background: 'linear-gradient(135deg, #57534e, #44403c)',  // 更深的莫蘭迪灰漸變
            borderRadius: '15px',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(87, 83, 78, 0.4)',
          }}
        />

        {/* 中文選項 */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '42px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: language === 'zh' ? 'white' : 'rgba(87, 83, 78, 0.8)',
            transition: 'all 0.3s ease',
          }}
        >
          中文
        </div>

        {/* 英文選項 */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '42px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '600',
            color: language === 'en' ? 'white' : 'rgba(87, 83, 78, 0.8)',
            transition: 'all 0.3s ease',
          }}
        >
          EN
        </div>
      </button>
    </div>
  );
};

export default LanguageSwitch;