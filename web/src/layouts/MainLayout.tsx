import { useMemo, useState } from 'react';
import { Layout, Menu, Input, Typography, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  FolderOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

/** 侧边栏导航菜单：key 即路由路径 */
const menuItems = [
  { key: '/namespace', label: '命名空间', icon: <AppstoreOutlined /> },
  { key: '/environment', label: '环境', icon: <DeploymentUnitOutlined /> },
  { key: '/group', label: '配置组', icon: <FolderOutlined /> },
  { key: '/configuration', label: '配置管理', icon: <FileTextOutlined /> },
  { key: '/audit', label: '操作审计', icon: <AuditOutlined /> },
];

/**
 * 主布局：侧边栏导航 + 顶栏（当前页面标题 + 操作人输入框）+ 内容区。
 */
export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // 操作人：写 localStorage 的 operator，http.ts 请求拦截器读取并注入 X-Operator 头
  const [operator, setOperator] = useState(() => localStorage.getItem('operator') || 'portal');

  // 菜单高亮：深层路由（如 /configuration/:id/edit）归并到其一级菜单
  const currentMenuItem = useMemo(
    () => menuItems.find((item) => location.pathname.startsWith(item.key)),
    [location.pathname],
  );
  const selectedMenuKey = currentMenuItem ? currentMenuItem.key : '/configuration';

  const handleOperatorChange = (value: string) => {
    setOperator(value);
    localStorage.setItem('operator', value || 'portal');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <CloudServerOutlined style={{ color: '#2f54eb', fontSize: 20 }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>配置中心</span>
        </div>
        <Menu
          theme="light"
          mode="inline"
          style={{ borderInlineEnd: 'none', paddingTop: 8 }}
          selectedKeys={[selectedMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 16 }}>
            {currentMenuItem?.label ?? '配置中心'}
          </Typography.Text>
          <Tooltip title="操作人：写入操作审计日志的身份标识">
            <Input
              style={{ width: 160 }}
              prefix={<UserOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
              value={operator}
              onChange={(e) => handleOperatorChange(e.target.value)}
              placeholder="操作人"
            />
          </Tooltip>
        </Header>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
