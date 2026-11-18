# 添加与管理音乐

正式歌单位于 `src/data/music.json`。本站没有文件接收服务器，上传到本机浏览器不会改变网站文件。音乐通过仓库提交管理。

1. 把自己有权发布的音频文件放入 `public/music/`，封面放入 `public/images/`。
2. 在清单中新增记录。`id` 必须唯一，只用小写字母、数字和连字符。
3. 运行检查与构建，再提交仓库。

```json
{
  "id": "your-song-id",
  "title": "歌曲名称",
  "artist": "作者或说明",
  "src": "music/your-song.mp3",
  "cover": "images/your-cover.webp",
  "album": "专辑名称",
  "sourceUrl": "https://example.com/official-album",
  "preview": false,
  "demo": false
}
```

上面是格式示例，文件必须实际存在，不能照抄示例路径后直接发布。建议使用浏览器兼容且大小适中的 MP3/AAC；很大的无损音频更适合以后放在对象存储。浏览器是否支持某个编码仍取决于系统。

2026-11-18 按用户要求从正式歌单及 `public/music/` 移除原创合成示例「纸上微光」，当时保留 Summer Pockets 与青き此方两首；2026-11-19 的新增清单见下节。旧的播放记忆如果指向已移除曲目，会清空该曲目的进度，等待用户从第一首手动播放；有效音量和播放模式保留。历史验收记录与 legacy 恢复资料仍按原版本留存。

`src` 与 `cover` 可以替换为完整 HTTP(S) 地址，以后迁移对象存储无需重写播放器。HTTPS 站点应使用 HTTPS 资源，外部服务还需要允许实际的音频访问与范围请求。远端文件的可用性需要自己保证。

歌单支持可选的 `thumbnail`。迷你播放器和歌单优先使用这张小图，音乐房间的唱片使用 `cover`。只填写 `cover` 时，所有位置共用同一张图。

## Summer Pockets 歌曲与封面

2026-11-16 将用户提供的两首音频加入歌单，放在原创示例之前。浏览器版本采用 MP3（LAME VBR，质量档 3），保持完整曲长、原采样率与声道，原始本地文件未修改。

| 曲目                 | 艺术家 | 站内音频                          | 封面来源                                                                                          |
| -------------------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Summer Pockets       | 水月陵 | `public/music/summer-pockets.mp3` | [Key 官方《Summer Pockets Original SoundTrack》](https://key.visualarts.gr.jp/summer/sound.html)  |
| 青き此方（青之此方） | YURiKA | `public/music/aoki-konata.mp3`    | [Key 官方《アスタロア／青き此方／夏の砂時計》](https://key.visualarts.gr.jp/summer_rb/sound.html) |

封面分别保存为 `public/images/summer-pockets-ost.jpg` 与 `public/images/summer-pockets-rb-vocal.jpg`，使用对应官方专辑图片，不依赖外部图片热链。图片与商业曲目的权利归相应权利人，未标记为本站原创或示例。第二首在播放器中同时保留日文曲名与用户提供的中文译名。

## 2026-11-19 新增曲目与经典试听

歌单现有 5 首完整音乐与 3 首官方发行渠道试听。前两首的 ID、顺序和保存偏好保持不变。

本次用户提供的三首文件已经是有效的 MPEG Layer III 音频。使用 FFmpeg 完整解码到空输出检查通过，均为 44.1 kHz、双声道。直接逐字节复制到站内，不重新编码、不修改原文件；复制前后 SHA-256 一致。

| 曲目            | 艺术家 / 专辑                                                   | 时长    | 站内文件                   | 封面与曲目信息来源                                                                                                     |
| --------------- | --------------------------------------------------------------- | ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 夏恋            | Otokaze / OTOKAZE                                               | 4:26.01 | `music/natsukoi.mp3`       | [艺术家 Bandcamp 专辑](https://otokaze-music.bandcamp.com/album/o-t-o-k-a-z-e)，与 2012 原专辑曲长一致，非 2024 重制版 |
| RING RING RING! | Key Sounds Label · 麻枝准 / Little Busters! Original SoundTrack | 3:55.00 | `music/ring-ring-ring.mp3` | [Key 官方 OST](https://key.soundslabel.com/ksl_html/ksl0035/ksl0035.html)，KSLA0033–35，Disc 1 第 2 首                 |
| Sea, You & Me   | 麻枝准 · VISUAL ARTS / Key / Summer Pockets Original SoundTrack | 5:10.24 | `music/sea-you-and-me.mp3` | [Key 官方 OST](https://key.visualarts.gr.jp/summer/sound.html)，复用已有封面                                           |

新增音频 SHA-256：

```text
383b665430254e1bfc0d7bcc32142b545e8c2fe44e312279c21fc4dccd0d1d3a  natsukoi.mp3
c936fdc09653fd208678ed61b81c06e5ca47c63409a5b556df30f4af0f811e80  ring-ring-ring.mp3
2a4994f3720db5d281f62d5bd8142753dc9a0eb5cde09a08b817c394afd9a773  sea-you-and-me.mp3
```

另选 AIR《鳥の詩》、CLANNAD《渚》与 Kanon《Last regrets》。这三首在所有播放器标题中均标为「官方试听」，使用 Apple 公开 lookup 返回的 HTTPS AAC/M4A `previewUrl`，直接远程播放，不下载、转码或重托管为完整歌曲。音乐页在每条试听旁提供 Apple Music 完整版入口，并标注 Apple Music Preview；试听实际时长以浏览器解码后的片段为准，lookup 的 `trackTimeMillis` 是完整版时长，不能当作试听时长。

| 试听                   | 官方专辑页                                                               | Apple 元数据与收听                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 鳥の詩 · Lia           | [AIR OST](https://key.soundslabel.com/ksl_html/ksl0005/ksl0005.html)     | [lookup](https://itunes.apple.com/lookup?id=818439884&entity=song&country=jp) · [收听](https://music.apple.com/jp/album/818439884?i=818439887) |
| 渚 · VISUAL ARTS / Key | [CLANNAD OST](https://key.soundslabel.com/ksl_html/ksl0014/ksl0014.html) | [lookup](https://itunes.apple.com/lookup?id=823583025&entity=song&country=jp) · [收听](https://music.apple.com/jp/album/823583025?i=823583054) |
| Last regrets · 彩菜    | [Kanon OST](https://key.soundslabel.com/ksl_html/ksl0006/ksl0006.html)   | [lookup](https://itunes.apple.com/lookup?id=813627592&entity=song&country=jp) · [收听](https://music.apple.com/jp/album/813627592?i=813627831) |

Otokaze 封面使用艺术家 Bandcamp 页面实际 `og:image`，页面署名为 Jun Takahashi（artwork）、Tomomi Takamatsu / Digi Crates Records（photograph）。Little Busters、AIR、CLANNAD、Kanon 封面使用对应 Key 官方专辑页图片。保留完整画面，非方图用白底补齐画布，不裁切封面内容、不放大低分辨率原图；输出不超过 600 px 的 WebP 与 96 px 缩略图，本地提供图片。商业音乐与图片权利归相应权利人，不标为本站原创或开放许可。

清单支持可选 `album`、HTTPS `sourceUrl` 与 `preview`。音乐页从数据计算完整/试听数量并输出来源链接，仍只有一个持久音频实例。外部试听依赖 Apple 服务、网络与地区可用性；失败使用现有错误提示和重试流程，不静默替换成别的歌曲。

## 状态与交互

- 首次加载不设置音频地址、不自动播放；由用户按下播放后开始加载。
- 顺序播放到最后一首后停止；单曲循环在结束后重播；随机播放有多首时避免立即重复同一首。
- 迷你条和音乐房间使用同一份模式下拉选择，当前模式以文字和不同图标显示。选择不会自动开始播放，两处选择、说明和保存偏好同步；模式实际作用于歌曲结束后的下一步。
- 迷你播放器与音乐页共享音频实例。Astro `ClientRouter` 在站内导航时保留 `transition:persist` 子树，不重复创建音频或绑定事件。
- 刷新、跨站跳转、打开另一个标签页属于新文档，会中断播放；保存的歌曲、位置、音量和模式可供下一次手动播放时恢复。
- 保存的歌曲 ID 不在当前清单时，从第一首的开头等待手动播放，保留有效音量与模式，不把已删除歌曲的进度带到另一首。
- 使用原生按钮和范围控件支持键盘。聚焦播放器面板后，空格播放/暂停，左右键快退/快进五秒。聚焦滑块后使用浏览器原生方向键、Home 和 End。
- 点击「收起播放器」可变成右下角的小控件，继续播放并保留暂停/播放与展开入口。隐藏的完整条同时退出键盘焦点；展开后焦点返回收起按钮。收起偏好单独保存，跨页保留，刷新仍需手动播放；存储不可用时当前会话仍可使用。
- 收起后专辑封面随实际播放状态缓慢旋转，18 秒一圈；暂停会停在当前角度，恢复播放后继续。展开完整播放器时停止这一小封面动画；系统「减少动态效果」关闭旋转。
- 手机点击迷你播放器的歌名可以展开进度，模式选择在手机迷你条中也可用。音量可在独立音乐页调整，系统可能接管移动端音量。
- 鼠标或触摸拖动进度时先预览时间，松手后定位，避免拖动过程反复重启音频解码。键盘方向键、Home / End 保持即时定位；取消拖动恢复实际播放位置。
- 音频加载失败会在当前页的迷你条和音乐页显示提示；再次按播放会重新加载失败音源，同一首中途出错时尽量保留进度。持续失败时检查文件路径、网络与格式。加载期间再次点击播放按钮可以取消。偏好存储不可用时仍可正常播放。
- 收起状态出现错误时显示提示标记，并通过状态区域播报；展开可以查看原因和重试。歌单使用与全站弹层相同的能力检查、互斥和焦点恢复规则。
- 手机迷你条计入底部安全区；错误提示出现时增加页脚留白，仍可滚动查看底部内容。安全区样式不代表已完成 iPhone 真机测试。

不要以“绕过自动播放限制”维持音乐。站内导航由路由器尽力保持同一播放实例；浏览器生命周期、系统暂停或网络错误仍可能停止播放。
