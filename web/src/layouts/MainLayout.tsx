import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, FileText, FolderOpen, KeyRound, LayoutGrid, Server, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** 侧边栏导航菜单：key 即路由路径（深层路由按前缀归并到一级菜单） */
const menuItems = [
  { key: '/namespace', label: '命名空间', icon: LayoutGrid },
  { key: '/environment', label: '环境', icon: Server },
  { key: '/group', label: '配置组', icon: FolderOpen },
  { key: '/configuration', label: '配置管理', icon: FileText },
  { key: '/audit', label: '操作审计', icon: ClipboardList },
];

/**
 * 主布局：深色侧边栏导航 + 顶栏（分区小标题 + 操作人/API Key 输入框）+ 内容区。
 */
export default function MainLayout() {
  const location = useLocation();

  // 操作人：写 localStorage 的 operator，http.ts 请求拦截器读取并注入 X-Operator 头
  const [operator, setOperator] = useState(() => localStorage.getItem('operator') || 'portal');
  // API Key：服务端启用鉴权（Auth:Enabled）时必填，http.ts 读取并注入 X-Api-Key 头
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '');

  // 菜单高亮：深层路由（如 /configuration/:id/edit）归并到其一级菜单
  const currentMenuItem = useMemo(
    () => menuItems.find((item) => location.pathname.startsWith(item.key)),
    [location.pathname],
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 深色侧边栏：品牌区 + 导航菜单（激活项白色浮起） */}
      <aside className="flex w-56 shrink-0 flex-col bg-zinc-950">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-white">
            <Server className="size-4" />
          </div>
          <span className="text-sm font-semibold text-white">配置中心</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 pt-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.key}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 font-medium text-white'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 右侧：顶栏 + 内容区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-6">
          {/* 分区小标题：页面主标题由各页 PageContainer 承担，这里只做方位提示 */}
          <span className="text-sm text-muted-foreground">{currentMenuItem?.label ?? '配置中心'}</span>
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                {/* asChild 包 span：让触发器始终挂在 span 上，不受输入框状态影响 */}
                <span className="relative">
                  <KeyRound className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 w-48 pl-8"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      localStorage.setItem('apiKey', e.target.value);
                    }}
                    placeholder="API Key（可选）"
                    type="password"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>API Key：服务端启用鉴权时必填，留空表示不发送</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="relative">
                  <User className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 w-40 pl-8"
                    value={operator}
                    onChange={(e) => {
                      setOperator(e.target.value);
                      localStorage.setItem('operator', e.target.value || 'portal');
                    }}
                    placeholder="操作人"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>操作人：写入操作审计日志的身份标识</TooltipContent>
            </Tooltip>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
