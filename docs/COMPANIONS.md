# 页面小伙伴

七位可选角色：亚托莉、紬·文德斯、神山识、库特、后藤独、伊地知虹夏、喜多郁代。一次显示一位；不引入 Live2D 引擎、角色服务或聊天接口。

## 使用方式

- 点击角色：按各自性格切换弹跳、摇摆、轻转圈、害羞缩身、欢呼和点头等小动作，同时显示一句鼓励。台词是本站创作，不是原作引文。
- 连续点三下：触发开心连击与爱心/星光彩蛋。每次只保留一组短动画，连续点击不会叠加大量粒子。
- 点爱心或长按约半秒：摸摸头，显示角色自己的回应。拖动超过阈值会取消长按，不会边移动边误触。
- 拖动角色：调整位置；也可以聚焦角色后用方向键移动，Home 复位。
- 星星按钮：打开角色选择，设置安静陪伴、复位位置或隐藏。
- 向下箭头：收成小圆钮。点击圆钮重新展开。
- 隐藏后：从页脚「小伙伴」恢复。
- 手机首次访问默认收起；桌面首次访问默认展开。选择、位置、收起、隐藏和安静偏好按部署 base 保存在本机，可用性不依赖存储成功。

角色会避让展开或收起的音乐播放器。切换站内页面保留同一实例；弹窗使用本站共享的原生 dialog 控制器，支持 Esc、焦点恢复和弹窗互斥。导航时清除临时气泡和定时器，关闭角色选择。

音乐实际播放时，角色可轻微随节奏摇摆；安静陪伴或系统「减少动态效果」会关闭角色动作。没有音乐时不持续摆动。页面进入后台会暂停角色动作并清除气泡。

点击动画使用浏览器原生 Web Animations API，最长一组约 1.6 秒。新点击会取消旧的一组，完成、切页、开始拖动、收起、隐藏、进入后台和开启安静/减少动作时清理动画及粒子。浏览器不支持该 API 时仍显示文字回应。键盘 Enter / 空格也可以触发普通互动，爱心按钮提供无需长按的摸头入口。

## 素材来源与处理

2026-11-17 检索、核对并下载参考图；所有运行时图片随站点本地发布，不依赖第三方图片热链。

| 角色       | 参考出处                                                                                                                                                                                                | 本站素材                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 亚托莉     | [ATRI 动画官方小游戏](https://atri-anime.com/special/adventure/)，[透明 SD 原图](https://atri-anime.com/assets/img/special/adventure/header/header_atri.png)                                            | 原图缩放、透明留白整理后编码为 WebP                            |
| 紬·文德斯  | [Key Summer Pockets REFLECTION BLUE 角色页](https://key.visualarts.gr.jp/summer_rb/character.html#wenders)，[官方立绘](https://key.visualarts.gr.jp/summer_rb/common/image/character_image_wenders.png) | 以角色造型为参考，用 imagegen 新绘透明 Q 版，再缩放和编码 WebP |
| 神山识     | [Key 角色页](https://key.visualarts.gr.jp/summer_rb/character.html#shiki)，[官方立绘](https://key.visualarts.gr.jp/summer_rb/common/image/character_image_shiki.png)                                    | 同上                                                           |
| 库特       | [COSPA 官方商品页](https://www.cospa.com/nijigencospa/detail/id/00000049456)，[商品图](https://www.cospa.com/images/items/pc/86723.jpg)                                                                 | 参考造型，新绘透明 Q 版；不使用商品摄影背景或挂链              |
| 后藤独     | [GEE!STORE / COSPA 官方商品页](https://www.geestore.com/detail/id/00000127313)，[参考图](https://www.cospa.com/images/items/pc/202311/B294PJ8n7kKs.jpg)                                                 | 参考造型，新绘透明 Q 版和姿势；不直接复制商品展板              |
| 伊地知虹夏 | [官方商品页](https://www.geestore.com/detail/id/00000127314)，[参考图](https://www.cospa.com/images/items/pc/202311/4knMvZylT2Av.jpg)                                                                   | 同上                                                           |
| 喜多郁代   | [官方商品页](https://www.geestore.com/detail/id/00000127316)，[参考图](https://www.cospa.com/images/items/pc/202311/W4LkHK8LURH4.jpg)                                                                   | 同上                                                           |

以上角色的权利归原权利人。可公开浏览的素材不等于已取得再分发许可；本站素材是个人博客的角色装饰，不表示官方合作或获得商业授权。后续需要替换或移除时，修改 `src/data/companions.json` 与 `public/images/companions/`，不用改播放器或文章系统。

## 维护边界与验收

- `Companion.astro`：静态语义、部署 base、角色 JSON 和选择弹窗。无 JavaScript 时隐藏挂件与恢复按钮。
- `companion-state.ts`：可独立测试的目录、偏好校验、位置归一化、视口限制与播放器避让。
- `companion-reactions.ts`：角色性格、有限关键帧、连击窗口和摸头回应；`companion-motion.ts` 负责动画批次替换、结束与取消后的清理。
- `companion.ts`：一个持久控制器；定时器只用于临时回应，位置更新由拖动、ResizeObserver 或 resize 触发。
- `companion.css`：共享配色与 44px 操作目标；动作集中在 transform、translate 和 opacity。
- `tests/companion.test.mjs`：角色范围、损坏偏好、已移除角色、窄屏与播放器碰撞。
- `scripts/verify-build.mjs`：每个页面恰好一个持久小伙伴，选择项与目录一致，图片存在且包含正确的部署 base。

验收时检查桌面与手机宽度、切换七位角色、点击回应、鼠标拖动与键盘移动、收起/恢复、隐藏/页脚找回、刷新偏好、音乐播放/暂停及跨页连续播放。系统减少动作还应关闭专辑旋转与角色动作。实际执行结果记录在本次交付报告中，不把构建通过当作帧率或真实手机测量。
