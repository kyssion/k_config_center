import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import NamespaceList from '@/pages/namespace/NamespaceList';
import EnvironmentList from '@/pages/environment/EnvironmentList';
import GroupList from '@/pages/group/GroupList';
import ConfigurationList from '@/pages/configuration/ConfigurationList';
import VersionHistory from '@/pages/configuration/VersionHistory';
import OperationLogList from '@/pages/audit/OperationLogList';

// Monaco（约 4MB）随编辑页专属 chunk 按需加载，主包不背编辑器体积
const ConfigurationEditor = lazy(() => import('@/pages/configuration/ConfigurationEditor'));

/** 编辑页懒加载兜底：与详情加载态一致的居中 spinner */
function EditorFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <span className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

/** 集中式路由表：MainLayout 为父路由，各页面嵌套渲染在其内容区 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/configuration" replace /> },
      { path: 'namespace', element: <NamespaceList /> },
      { path: 'environment', element: <EnvironmentList /> },
      { path: 'group', element: <GroupList /> },
      { path: 'configuration', element: <ConfigurationList /> },
      {
        path: 'configuration/:id/edit',
        element: (
          <Suspense fallback={<EditorFallback />}>
            <ConfigurationEditor />
          </Suspense>
        ),
      },
      { path: 'configuration/:id/versions', element: <VersionHistory /> },
      { path: 'audit', element: <OperationLogList /> },
    ],
  },
]);
