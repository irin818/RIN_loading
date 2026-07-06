# RIN Main Menu Prototype

> 角色中心式开场 / 主菜单场景原型

## 功能概述

黑绿主题的 AI companion / cyber room 个人 AI 形象场景。RIN 位于虚拟终端风格环境中，配合主菜单 UI，具有基础待机动画和交互反应。

## 场景路径

```
Assets/Scenes/MainMenu/RIN_MainMenu.unity
```

## Prefab 路径

```
Assets/RIN/Prefabs/RIN_MainMenu.prefab
```

## 脚本说明

### 角色脚本 (Assets/RIN/Scripts/Character/)

| 脚本 | 功能 | 状态 |
|------|------|------|
| `RINLookAtCursor.cs` | 头部/眼睛跟随鼠标 | ✅ 已安装，但因无骨骼自动禁用 |
| `RINBlinkController.cs` | 随机自动眨眼 (BlendShape) | ✅ 已安装，但因无 BlendShape 自动禁用 |
| `RINTailSway.cs` | 尾巴正弦摆动 | ✅ 已安装，但因无尾骨自动禁用 |
| `RINEarTwitch.cs` | 耳朵随机抖动 | ✅ 已安装，但因无耳骨自动禁用 |
| `RINExpressionController.cs` | 表情管理 (Neutral/Smile/Curious/Serious/Glitch) | ✅ 状态追踪模式（无 BlendShape 时仅记录状态） |
| `RINInteractionController.cs` | 统一交互控制 (Hover/Click/LongIdle 反应) | ✅ 完整可用 |

### UI 脚本 (Assets/RIN/Scripts/UI/)

| 脚本 | 功能 |
|------|------|
| `MainMenuController.cs` | 主菜单管理 (按钮事件、状态文本、StartSession/Shutdown) |
| `MenuHoverHandler.cs` | 按钮 hover/click 事件 → RINInteractionController |

### 系统脚本 (Assets/RIN/Scripts/Systems/)

| 脚本 | 功能 |
|------|------|
| `IdleWatcher.cs` | 空闲检测 (30s → RIN 歪头反应, 90s → 灯光闪烁) |

### Editor 脚本 (Assets/Editor/)

| 脚本 | 功能 |
|------|------|
| `SceneBuilder.cs` | 一键构建完整场景 (Unity 菜单: RIN → Build Main Menu Scene) |

## 当前支持的交互

- ✅ RIN 在场景中可见（黑绿配色材质）
- ✅ 主菜单 5 个按钮: START SESSION, CONTINUE MEMORY, MEMORY ARCHIVE, SETTINGS, SHUTDOWN
- ✅ Hover 时按钮变亮放 大 + RIN 触发 HoverReact 动画
- ✅ Click 时触发 RIN ClickReact 动画
- ✅ START SESSION 显示 "Session Starting..." 并触发 RIN 笑脸反应
- ✅ SHUTDOWN 退出 Play Mode
- ✅ Idle 待机动画（呼吸起伏）
- ✅ Greeting 开场动画
- ✅ LongIdle 歪头反应（30 秒无操作）
- ✅ 90 秒无操作 → 环境灯光闪烁
- ✅ 快速连续点击触发特殊 Glitch 反应
- ✅ 黑绿 cyber room 环境（地面、墙壁、桌子、显示器、发光面板、数据屏幕）
- ✅ 专业灯光（Key + Fill + Rim 绿色背光 + 显示器点光）

## 当前资产限制

| 项目 | 状态 | 说明 |
|------|------|------|
| RIN FBX | 静态模型 | 无骨骼、无 BlendShape、无尾巴/耳朵骨骼 |
| 骨骼动画 | 降级为根对象动画 | Idle/Greeting/HoverReact/ClickReact/LongIdleReact 使用 Transform 动画 |
| 眨眼 | 禁用 | 无 BlendShape |
| 看向鼠标 | 禁用 | 无 headBone |
| 尾巴摆动 | 禁用 | 无 tailBone |
| 耳朵抖动 | 禁用 | 无 earBone |
| 表情 | 仅状态追踪 | 无 BlendShape |
| 材质 | 占位材质 | 单一 M_Outfit 材质，后续可分部位设置 |
| 字体 | LegacyRuntime | 建议替换为自定义字体 |

## 后续建议

### 资产升级
- 导入带骨骼的 RIN 模型 (Humanoid Rig)
- 添加面部 BlendShape (blink_left, blink_right, smile, brow_raise, etc.)
- 添加尾巴骨骼链 (tail_01 → tail_0N)
- 添加耳朵骨骼 (ear_L, ear_R)

### 动画升级
- 真正的 Idle 动画 (Humanoid Avatar)
- 导入或制作 Greeting/Hover/Click 动画
- Spring Bone / Dynamic Bone 用于尾巴和耳朵

### 场景升级
- 安装 URP 以获得更好的后处理效果
- Cinemachine 开场序列
- 环境粒子效果 (浮动数据粒子)
- 更丰富的 cyber room 模型

### 功能升级
- Dialogue 系统
- 音频系统 (BGM/SFX/Voice)
- 设置面板
- 记忆存档浏览
- 场景切换

## 如何测试

### 在 Unity Editor 中

1. 用 Unity 6000.5.1f1 打开项目: `/Users/irin/Documents/RIN_loading/Rin_unity`
2. 打开场景: `Assets/Scenes/MainMenu/RIN_MainMenu.unity`
3. 点击 Play
4. 观察:
   - RIN 在画面中央偏右位置
   - 左侧主菜单 UI 淡入
   - RIN 有轻微上下浮动 (Idle 动画)
   - 鼠标悬停菜单按钮 → 按钮变亮，RIN 轻微移动
   - 点击 START SESSION → 状态文本 "Session Starting..."
   - 等待 30 秒无操作 → RIN 歪头反应
   - 快速连续点击按钮 3 次 → Glitch 反应

### 从命令行

```bash
/Applications/Unity/Hub/Editor/6000.5.1f1/Unity.app/Contents/MacOS/Unity \
  -projectPath /Users/irin/Documents/RIN_loading/Rin_unity \
  -executeMethod RIN.Editor.SceneBuilder.BuildAll \
  -quit -batchmode
```

## 技术信息

- Unity 版本: 6000.5.1f1
- 渲染管线: Built-in
- 目标平台: macOS Standalone
- 语言: C# (.NET Standard 2.1)
