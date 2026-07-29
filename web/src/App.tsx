import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';

/** 根组件：只承载路由容器，全局配置在 main.tsx 的 ConfigProvider 完成 */
export default function App() {
  return <RouterProvider router={router} />;
}
