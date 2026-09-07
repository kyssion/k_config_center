import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import './index.css';

// 应用入口：挂载根组件 + 全局 toast 容器（文案本身为中文，无需 locale 适配）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
