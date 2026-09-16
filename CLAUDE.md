# 幽墟回廊 · 项目交接文档

**这个文件是给 Claude 看的。** 新开一个会话时它会被自动读取，所以用户不需要重复交代背景。
改动了下面记录的任何事实（地址、流程、决定、坑），**请同步更新这个文件**。

用户用中文交流，回复用中文。

---

## 一句话

一个用背单词打怪的地牢 Roguelike，纯静态网页，没有构建步骤，没有依赖。
答对一题砍怪一刀，答错挨一口。50 层，词汇从 CEFR A1 爬到 B1。

## 三个地址

| 用途 | 地址 |
| --- | --- |
| 代码仓库（唯一源） | https://github.com/audience20060904-lang/youxu-huilang |
| 线上网站 | https://audience20060904-lang.github.io/youxu-huilang/ |
| 废弃的旧副本 | `https://claude.ai/artifact/AUmzcwqghnNKk9hGFYxhJL` |

## 已经定下来的事（别再重新讨论）

1. **GitHub 是唯一源。** 这个仓库的 `main` 分支就是全部真相。
2. **不要再碰那个 Artifact。** 游戏最早是作为 Claude Artifact 写的，代码从那里导出后推进了本仓库。
   那个 Artifact 现在是一份冻结的旧副本，用户已决定弃用它 —— **不要往那边同步，不要republish，
   也不要主动提议用它**。（用户没说要删，所以也别删。）
3. **用户不自己改代码。** 工作方式是：用户提需求 → Claude 在本仓库改 → 提交并推到 `main` → 网站自动更新。
   不要把「你去 GitHub 网页上点开文件改一下」当成交付。
4. **网站已经跑通了**，用户确认能正常打开。别再问「Pages 开了吗」。

## 文件结构

`index.html` 按固定顺序加载脚本，**顺序不能乱**（`util` 提供全局函数 → `words`/`content` 依赖它 → `game` 依赖全部）：

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面骨架：四个标签页（冒险/信息/遗物/设置）+ 十个弹层 |
| `style.css` | 全部样式，颜色变量在 `:root` |
| `util.js` | 全局小工具（随机、localStorage 存档、语音朗读），必须最先加载 |
| `words-a1.js` | 词库 430 词 + 派生索引 `WMAP` / `BYCAT` / `BYLV` |
| `content.js` | 数值配置：章节 `CHAPTER`、怪物 `FOES`/`BOSS`、遗物 `RELICS`。**调平衡只改这个文件** |
| `art.js` | SVG 美术，剪影用 `currentColor`，颜色交给 CSS |
| `game.js` | 全部游戏逻辑，约 1900 行 |

## 常见改动

- **加单词** → `words-a1.js` 的 `WORDS` 数组，格式 `["英文","中文","类别",难度]`，四个字段都要给。
  难度 1=A1 2=A2 3=B1。类别必须在同文件的 `CAT_CN` 里有中文名。
  ⚠️ **英文不能重复** —— `WMAP` 按英文做键，重了会被静默覆盖，不报错。
- **调数值**（血量/伤害/掉率/成长曲线）→ 全在 `content.js` 的 `CHAPTER` 和 `FOES` 里。
  50 层的成长曲线很敏感，改之前先算一遍（文件里有注释说明为什么经验是每 3 层 +1）。
- **加遗物** → `content.js` 的 `RELICS` 加一条，**然后必须在 `game.js` 里加对应的 `hasRelic("id")` 分支**，
  两边不同步的话遗物会存在但没效果。
  数值规矩：**全是整数加减，整个伤害公式只有「暴击 ×2」一个乘区**，不要引入第二个乘法。

## 部署机制

`.github/workflows/deploy.yml`：推到 `main` 就自动部署，也可以手动触发（`workflow_dispatch`）。
流程是 checkout → configure-pages → 把游戏文件拷进 `_site` → upload-pages-artifact → deploy-pages。
通常 30～60 秒上线。

仓库 Settings → Pages 的 Source 已经设成 **GitHub Actions**，这是一次性设置，已完成。

## 踩过的坑（别再踩）

- **不要用 `actions/configure-pages` 的 `enablement: true`。** 第一次部署时它会失败：
  `Create Pages site failed. Error: Resource not accessible by integration`。
  Actions 的 GITHUB_TOKEN 没有创建 Pages 站点的权限，无论 workflow 的 `permissions` 块写什么都不行。
  必须由仓库主人在 Settings 里手动开一次（已经开好了）。
- **Claude 的 GitHub App 不能创建仓库**（`POST /user/repos` 返回 403）。需要新仓库时让用户自己建。
- **workflow 是显式列举要发布哪些文件的**（`cp index.html style.css *.js .nojekyll _site/`）。
  新增任何需要上线的文件，**必须同时加进这个 cp 列表**，否则不会出现在网站上。
  ⚠️ 特别是以后绑定自定义域名时 GitHub 会生成的 `CNAME` 文件 —— 漏了域名就会失效。
- **Claude 的沙盒访问不了 `*.github.io`**（代理返回 `403 to CONNECT`）。
  所以没法用 curl 自测线上网站，只能看 Actions 日志判断部署是否成功，或者请用户帮忙打开确认。
  本地自测可以：`python3 -m http.server` 然后用 Playwright 打开（Chromium 在 `/opt/pw-browsers`）。
- 页面顶部内置了报错横幅（`#errbar`），JS 一出错会直接显示在页面上，不用开 F12。排查问题时先问用户看没看到它。

## 待办

- [ ] **网站图标**：现在没有 favicon，浏览器标签页空白，请求 `/favicon.ico` 会 404。原 Artifact 的图标是 🗡🔥
- [ ] **自定义域名**：用户想绑 `www.xxx.com`，还没买域名。买了之后：Settings → Pages 填域名 →
      DNS 加 CNAME 指向 `audience20060904-lang.github.io` → **把 `CNAME` 加进 workflow 的 cp 列表** → 勾 Enforce HTTPS
- [ ] 第二章还没做（`content.js` 的 `ROUTES` 里目前只有「石廊」一条路，铁匠铺在主城里是灰的）

## 新会话怎么接手

1. 如果这个仓库不在会话的 GitHub scope 里，先用 `add_repo` 加上 `audience20060904-lang/youxu-huilang`，然后 clone。
2. 改完提交推到 `main`，然后用 Actions 的 API 确认部署成功（`list_workflow_runs` 看 conclusion）。
   **不要用 curl 去验证网站** —— 沙盒访问不了 github.io，见上面「踩过的坑」。
3. 部署失败的话，用 `get_job_logs` 带 `failed_only: true` 看日志。
