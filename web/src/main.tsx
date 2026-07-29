import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// 全局主题：品牌蓝主色 + 浅灰画布底色，亮色 Sider/Header 方案（不设 colorBgContainer，避免污染输入框/卡片底色）
const theme = {
  token: {
    colorPrimary: '#2f54eb',
    borderRadius: 6,
    colorBgLayout: '#f5f7fa',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#fff',
      headerBg: '#fff',
    },
    Table: {
      headerBg: '#fafafa',
    },
  },
};

// 应用入口：挂载根组件，AntD 全局启用中文文案
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
