import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import NamespaceList from '@/pages/namespace/NamespaceList';
import EnvironmentList from '@/pages/environment/EnvironmentList';
import GroupList from '@/pages/group/GroupList';
import ConfigurationList from '@/pages/configuration/ConfigurationList';
import ConfigurationEditor from '@/pages/configuration/ConfigurationEditor';
import VersionHistory from '@/pages/configuration/VersionHistory';
import OperationLogList from '@/pages/audit/OperationLogList';

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
      { path: 'configuration/:id/edit', element: <ConfigurationEditor /> },
      { path: 'configuration/:id/versions', element: <VersionHistory /> },
      { path: 'audit', element: <OperationLogList /> },
    ],
  },
]);
